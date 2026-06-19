/**
 * persistence.ts — async write-through bridge from the server handlers to the
 * durable `@ganatri/db` persistence layer.
 *
 * Design rules:
 *  - The engine is the synchronous authoritative source. DB writes are
 *    fire-and-forget: every exported function returns `void`, runs its async
 *    work internally, and wraps EVERYTHING in try/catch + `console.error`.
 *    A persistence failure must never block or break gameplay.
 *  - When `DATABASE_URL` is unset, `getPersistence()` returns `null` and every
 *    function is a no-op, so the server behaves exactly as it did before.
 *  - Per-room bookkeeping lives here (not in `store.ts`). It is keyed by room
 *    code and cleared when a game ends.
 *
 * Player identity: the server `playerId` is a UUID v4 and `users.id` is a UUID,
 * so they are used interchangeably (`userIdOf = pid => pid`).
 */

import { getDb, createPersistence, mappers } from '@ganatri/db';
import type {
  AppendEventInput,
  GamePersistence,
  PlayerStatsDelta,
} from '@ganatri/db';
import type { GameEvent, GameState } from '@ganatri/engine';

// ---------------------------------------------------------------------------
// Lazy singleton + test hook
// ---------------------------------------------------------------------------

let _p: GamePersistence | null | undefined;

/** Returns the persistence instance, or `null` in DB-less mode. */
export function getPersistence(): GamePersistence | null {
  if (_p === undefined) {
    const db = getDb();
    _p = db ? createPersistence(db) : null;
  }
  return _p;
}

/** For tests: inject a fresh persistence (e.g. `MemoryPersistence`) or `null`. */
export function __setPersistenceForTests(p: GamePersistence | null): void {
  _p = p;
}

// ---------------------------------------------------------------------------
// Per-room bookkeeping (kept out of store.ts on purpose)
// ---------------------------------------------------------------------------

/**
 * roomCode -> promise resolving to the DB game id (or null on failure).
 * Event/finish writes `await` this so they can never run before the game row
 * exists, closing the start->move race while keeping handlers synchronous.
 */
const gameIdPromises = new Map<string, Promise<string | null>>();
/** roomCode -> DB room id. */
const roomIds = new Map<string, string>();
/** roomCode -> running event sequence counter. */
const eventSeq = new Map<string, number>();
/** roomCode -> accumulated engine events (for cut-tally + stats at end). */
const eventLog = new Map<string, GameEvent[]>();
/** roomCode -> game start timestamp (ms). */
const startedAtMs = new Map<string, number>();

function clearRoom(roomCode: string): void {
  gameIdPromises.delete(roomCode);
  roomIds.delete(roomCode);
  eventSeq.delete(roomCode);
  eventLog.delete(roomCode);
  startedAtMs.delete(roomCode);
}

const userIdOf = (pid: string): string => pid;

// ---------------------------------------------------------------------------
// recordGameStart
// ---------------------------------------------------------------------------

/**
 * Persist the room (status PLAYING) and the started game. Fire-and-forget.
 * The game-id promise is registered synchronously so later event/finish calls
 * can await it even if they fire before the DB writes complete.
 */
export function recordGameStart(
  roomCode: string,
  hostId: string,
  seating: readonly string[],
  seed: number | string,
  namesById: Record<string, string>,
): void {
  const p = getPersistence();
  if (!p) return;

  eventSeq.set(roomCode, 0);
  eventLog.set(roomCode, []);
  startedAtMs.set(roomCode, Date.now());

  const promise = (async (): Promise<string | null> => {
    try {
      for (const pid of seating) {
        await p.ensureGuest(userIdOf(pid), namesById[pid] ?? pid);
      }
      const room = await p.recordRoomCreated({
        roomCode,
        hostUserId: userIdOf(hostId),
        status: 'PLAYING',
      });
      roomIds.set(roomCode, room.id);
      const game = await p.recordGameStarted({
        roomId: room.id,
        seed,
        seatingOrder: seating.map(userIdOf),
      });
      return game.id;
    } catch (err) {
      console.error(`[persistence] recordGameStart failed for ${roomCode}:`, err);
      return null;
    }
  })();

  gameIdPromises.set(roomCode, promise);
}

// ---------------------------------------------------------------------------
// recordEvents
// ---------------------------------------------------------------------------

/** Append a batch of engine events to the durable log. Fire-and-forget. */
export function recordEvents(roomCode: string, events: readonly GameEvent[]): void {
  const p = getPersistence();
  if (!p) return;
  if (events.length === 0) return;

  void (async (): Promise<void> => {
    try {
      const gameIdPromise = gameIdPromises.get(roomCode);
      if (!gameIdPromise) return;
      const gameId = await gameIdPromise;
      if (!gameId) return;

      const log = eventLog.get(roomCode);
      if (log) log.push(...events);

      let seq = eventSeq.get(roomCode) ?? 0;
      const batch: AppendEventInput[] = events.map((ev) => {
        const mapped = mappers.mapEvent(ev, { userIdOf });
        return {
          gameId,
          seq: seq++,
          eventType: mapped.eventType,
          actorUserId: mapped.actorUserId,
          payload: mapped.payload,
        };
      });
      eventSeq.set(roomCode, seq);

      await p.appendGameEvents(batch);
    } catch (err) {
      console.error(`[persistence] recordEvents failed for ${roomCode}:`, err);
    }
  })();
}

// ---------------------------------------------------------------------------
// recordGameEnd
// ---------------------------------------------------------------------------

/**
 * Finalize a game: write game_players, the finished game row, room status, and
 * aggregate player stats. Fire-and-forget and idempotent per room — the gameId
 * promise entry is deleted first thing, so concurrent / double GAME_OVER call
 * sites can't double-write.
 */
export function recordGameEnd(
  roomCode: string,
  state: GameState,
  namesById: Record<string, string>,
  isAbandoned: boolean,
): void {
  const p = getPersistence();
  if (!p) return;

  // Idempotency guard: consume the gameId promise so a second call bails.
  const gameIdPromise = gameIdPromises.get(roomCode);
  if (!gameIdPromise) return;
  gameIdPromises.delete(roomCode);

  const roomId = roomIds.get(roomCode);
  const log = eventLog.get(roomCode) ?? [];
  const startMs = startedAtMs.get(roomCode) ?? Date.now();

  void (async (): Promise<void> => {
    try {
      const gameId = await gameIdPromise;
      if (!gameId) {
        clearRoom(roomCode);
        return;
      }

      const durationMs = Date.now() - startMs;

      const players = mappers.mapFinalPlayers({
        state,
        events: log,
        userIdOf,
        displayNameOf: (pid: string) => namesById[pid] ?? pid,
        isAbandoned,
      });

      await p.recordGameFinished({
        gameId,
        endedAt: new Date(),
        durationMs,
        winnerId: mappers.mapWinner(state.rankings),
        isAbandoned,
        players,
      });

      if (roomId) {
        await p.updateRoomStatus(roomId, isAbandoned ? 'ABANDONED' : 'DONE', new Date());
      }

      await writePlayerStats(p, players, log, state, durationMs, isAbandoned);
    } catch (err) {
      console.error(`[persistence] recordGameEnd failed for ${roomCode}:`, err);
    } finally {
      clearRoom(roomCode);
    }
  })();
}

// ---------------------------------------------------------------------------
// Player stats
// ---------------------------------------------------------------------------

async function writePlayerStats(
  p: GamePersistence,
  players: ReturnType<typeof mappers.mapFinalPlayers>,
  log: readonly GameEvent[],
  state: GameState,
  durationMs: number,
  isAbandoned: boolean,
): Promise<void> {
  const cuts = mappers.tallyCuts(log);
  const safeSet = new Set(mappers.mapSafeOrder(state.part2));

  for (const player of players) {
    if (player.userId == null) continue;
    const userId = player.userId;
    const won = player.finalRank === 1;

    // Win-streak is a non-atomic read-modify-write. Safe under the one-active-
    // game-per-player invariant (a user can't finish two games concurrently);
    // revisit if that rule is ever relaxed.
    let currentWinStreak = won ? 1 : 0;
    let longestWinStreak = currentWinStreak;
    try {
      const prev = await p.getPlayerStats(userId);
      currentWinStreak = won ? (prev?.currentWinStreak ?? 0) + 1 : 0;
      longestWinStreak = Math.max(prev?.longestWinStreak ?? 0, currentWinStreak);
    } catch (err) {
      console.error(`[persistence] getPlayerStats failed for ${userId}:`, err);
    }

    const delta: PlayerStatsDelta = {
      userId,
      gamesPlayed: 1,
      gamesWon: won ? 1 : 0,
      gamesLost: player.finalRank != null && player.finalRank !== 1 ? 1 : 0,
      gamesAbandoned: isAbandoned ? 1 : 0,
      totalCaptures: player.captureCount,
      timesSafe: safeSet.has(userId) ? 1 : 0,
      cutsGiven: cuts.cutsGiven[userId] ?? 0,
      cutsReceived: cuts.cutsReceived[userId] ?? 0,
      totalPlayTimeMs: durationMs,
      currentWinStreak,
      longestWinStreak,
      sumFinishPositions: isAbandoned ? 0 : (player.finalRank ?? 0),
    };

    try {
      await p.upsertPlayerStats(delta);
    } catch (err) {
      console.error(`[persistence] upsertPlayerStats failed for ${userId}:`, err);
    }
  }
}
