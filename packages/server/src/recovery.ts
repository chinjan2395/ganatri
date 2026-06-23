/**
 * recovery.ts — Server-restart rehydration.
 *
 * On startup, reads every game whose room is still PLAYING from the DB,
 * replays its event log against the engine to reconstruct the live GameState,
 * and restores the in-memory store (rooms, ghost sessions, persistence maps).
 *
 * Ghost sessions have socketId === null. When a player reconnects, the
 * connection handler detects the ghost (by playerId) and adopts it so
 * handleReconnect restores the room context seamlessly.
 *
 * Constraints:
 *  - Fire-and-forget: a rehydration failure for one game never blocks the
 *    server or other games.
 *  - Logged-in users are matched via socket.data.userId (cookie auth).
 *    Guests are matched via the playerId the client stores in localStorage
 *    (sent as handshake auth.playerId).
 *  - If the event log ends in GAME_OVER (server crashed after the last move
 *    but before persisting the finish), the game is finalized and no room is
 *    created.
 */

import { v4 as uuidv4 } from 'uuid';
import { applyMove, cardId, createGame } from '@ganatri/engine';
import type { Card, GameEvent, GameState, Move } from '@ganatri/engine';
import type { GameEventRow, GamePersistence, GamePlayerRow, GameRow } from '@ganatri/db';
import { getPersistence, recordGameEnd, restoreGamePersistenceState } from './persistence.js';
import { scheduleGracePeriodForRecovery } from './handlers.js';
import { createSession, getRoom, store } from './store.js';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Load active games from the DB and restore them into the in-memory store.
 * Logs progress to console. Never throws.
 */
export async function rehydrateFromDb(): Promise<void> {
  const p = getPersistence();
  if (!p) return;

  let activeGames;
  try {
    activeGames = await p.loadActiveGames();
  } catch (err) {
    console.error('[recovery] loadActiveGames failed:', err);
    return;
  }

  if (activeGames.length === 0) {
    console.log('[recovery] no active games to rehydrate');
    return;
  }

  let successCount = 0;
  for (const gwp of activeGames) {
    try {
      await rehydrateGame(p, gwp.game, gwp.players, gwp.roomCode, gwp.hostUserId);
      successCount++;
    } catch (err) {
      console.error(`[recovery] failed to rehydrate game ${gwp.game.id}:`, err);
    }
  }

  console.log(
    `[recovery] rehydrated ${successCount}/${activeGames.length} active game(s)` +
    (successCount < activeGames.length ? ` (${activeGames.length - successCount} failed)` : ''),
  );
}

// ---------------------------------------------------------------------------
// Per-game rehydration
// ---------------------------------------------------------------------------

async function rehydrateGame(
  p: GamePersistence,
  game: GameRow,
  dbPlayers: GamePlayerRow[],
  roomCode: string | undefined,
  hostUserId: string | null | undefined,
): Promise<void> {
  if (!roomCode) throw new Error(`game ${game.id} has no room code`);

  // Skip if room already in store (guard against duplicate calls in tests).
  if (getRoom(roomCode) !== undefined) {
    console.warn(`[recovery] room ${roomCode} already in store, skipping`);
    return;
  }

  const seating = game.seatingOrder as string[];
  const dbEvents = await p.loadGameEvents(game.id);

  // Replay event log to reconstruct the current engine state.
  const gameState = replayGameState(seating, game.seed, dbEvents);

  // Always restore the persistence bookkeeping maps first so that any
  // subsequent recordGameEnd call (for the GAME_OVER edge case) resolves correctly.
  const engineEvents = dbEvents.map((ev) => ev.payload as GameEvent);
  restoreGamePersistenceState(
    roomCode,
    game.id,
    game.roomId,
    dbEvents.length,
    engineEvents,
    game.startedAt.getTime(),
  );

  if (gameState.phase === 'GAME_OVER') {
    // Server crashed after the last move but before persisting the game finish.
    // Finalize it now (fire-and-forget).
    console.warn(
      `[recovery] game ${game.id} reached GAME_OVER during replay — finalizing`,
    );
    const namesById = buildNamesById(dbPlayers, seating);
    recordGameEnd(roomCode, gameState, namesById, false);
    return;
  }

  const hostId = hostUserId ?? seating[0]!;

  // Build the in-memory room (all players start disconnected).
  store.rooms.set(roomCode, {
    code: roomCode,
    hostId,
    players: [...seating],
    gameState,
    phase: 'PLAYING',
    disconnectedAt: new Map(),
    gracePeriodTimers: new Map(),
    turnTimer: null,
    turnStartedAt: null,
    completedAt: null,
  });

  // Create ghost sessions for every player (socketId = null, roomCode set).
  // The connection handler adopts these when players reconnect.
  for (const pid of seating) {
    if (!store.playerIndex.has(pid)) {
      const dbPlayer = dbPlayers.find((dp) => dp.userId === pid);
      const name = dbPlayer?.displayNameSnapshot ?? pid.slice(0, 6);
      const ghostToken = `ghost:${uuidv4()}`;
      const session = createSession(ghostToken, pid, null, name);
      session.roomCode = roomCode;
    }
    // Start the grace-period countdown for each disconnected player so the
    // game auto-resolves if nobody reconnects.
    scheduleGracePeriodForRecovery(roomCode, pid);
  }

  console.log(
    `[recovery] restored room ${roomCode} (${seating.length}p, ${dbEvents.length} events replayed, ` +
    `phase=${gameState.phase})`,
  );
}

// ---------------------------------------------------------------------------
// Event-log replay
// ---------------------------------------------------------------------------

/**
 * Reconstruct a `GameState` by applying each move inferred from the event log.
 *
 * Strategy: every move starts with a CARD_PLAYED event. For Part 1 moves,
 * the following CAPTURED event (same player, same batch) tells us which table
 * cards were taken. For Part 2, the move is always PLAY_TRICK.
 *
 * If replay fails at a given event the last valid state is returned (the game
 * will be slightly behind but in a consistent engine state).
 */
function replayGameState(
  seating: string[],
  seed: string,
  dbEvents: GameEventRow[],
): GameState {
  let state = createGame(seating, seed);
  let i = 0;

  while (i < dbEvents.length && state.phase !== 'GAME_OVER') {
    const ev = dbEvents[i]!;
    const payload = ev.payload as GameEvent;

    if (payload.type !== 'CARD_PLAYED') {
      i++;
      continue;
    }

    const player = payload.player;
    const played: Card = payload.card;
    const playedId = cardId(played);

    let move: Move;

    if (state.phase === 'PART_1') {
      // Look ahead for a CAPTURED event belonging to this move's batch.
      let captureIds: string[] = [];
      for (let j = i + 1; j < dbEvents.length; j++) {
        const next = dbEvents[j]!.payload as GameEvent;
        if (next.type === 'CARD_PLAYED') break;
        if (next.type === 'CAPTURED' && next.player === player) {
          captureIds = next.cards
            .filter((c) => c.rank !== played.rank || c.suit !== played.suit)
            .map((c) => cardId(c));
          break;
        }
      }
      move = { type: 'PLAY_CAPTURE', card: playedId, capture: captureIds };
    } else {
      // PART_2: every play is a trick play.
      move = { type: 'PLAY_TRICK', card: playedId };
    }

    const result = applyMove(state, player, move);
    if (!result.ok) {
      console.error(
        `[recovery] replay error at seq ${ev.seq} (${result.error}) — stopping replay`,
      );
      break;
    }
    state = result.state;

    // Skip the rest of this move's event batch (non-CARD_PLAYED events).
    i++;
    while (
      i < dbEvents.length &&
      (dbEvents[i]!.payload as GameEvent).type !== 'CARD_PLAYED'
    ) {
      i++;
    }
  }

  return state;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildNamesById(
  players: GamePlayerRow[],
  seating: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pid of seating) {
    const p = players.find((dp) => dp.userId === pid);
    out[pid] = p?.displayNameSnapshot ?? pid.slice(0, 6);
  }
  return out;
}
