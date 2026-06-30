/**
 * handlers.ts — Socket.io connection handler & all event routing.
 *
 * Business logic lives here. Transport (socket.io specifics) lives in
 * socketTransport.ts. State lives in store.ts.
 */

import type { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { applyMove, createGame, legalMoves, viewFor } from '@ganatri/engine';
import type { GameEvent, GameState, Move, MoveResult } from '@ganatri/engine';

import {
  type AdminAuthPayload,
  type AdminUpdateConfigPayload,
  type AdminGetStatsAck,
  type AdminGetKpiStatsAck,
  type AdminSearchUsersPayload,
  type AdminSearchUsersAck,
  type AdminUserView,
  type AdminGetUserStatsPayload,
  type AdminGetUserStatsAck,
  type AdminUserStatsView,
  type AdminExportDataPayload,
  type AdminExportDataAck,
  type ExportGameView,
  type ExportGamePlayerView,
  type CreateRoomAck,
  type JoinRoomAck,
  type LeaveRoomAck,
  type MakeMoveAck,
  type StartGameAck,
  type RequestStateAck,
  type RequestHistoryAck,
  type GameHistoryEntry as WireGameHistoryEntry,
  type GetMyStatsAck,
  type GetMyProgressionAck,
  type GetMyScoreHistoryAck,
  type PlayerStatsView,
  type PlayerProgressionView,
  type ScoreHistoryEntryView,
  type MatchScoringView,
  type ScoreBreakdownRowView,
  type GetLeaderboardAck,
  type GetLeaderboardRequest,
  type LeaderboardEntryView,
  type UpdateDisplayNamePayload,
  type UpdateDisplayNameAck,
  type UpdateAvatarAck,
  type DeleteAccountAck,
  type DownloadMyDataAck,
  type AuthSessionView,
  type GetAuthSessionsAck,
  type RevokeAuthSessionPayload,
  type RevokeAuthSessionAck,
  type RevokeOtherAuthSessionsAck,
  type CoPlayerView,
  type GetRecentPlayersAck,
  type GetBlockedUsersAck,
  type InvitePlayerPayload,
  type InvitePlayerAck,
  type RespondToInvitePayload,
  type RespondToInviteAck,
  type BlockUserPayload,
  type BlockUserAck,
  type UnblockUserPayload,
  type UnblockUserAck,
  type InviteReceivedPayload,
  type InviteAcceptedPayload,
  type InviteRejectedPayload,
  type InviteCancelledPayload,
  type PlayerOnlineStatusPayload,
  type VoiceOfferPayload,
  type VoiceAnswerPayload,
  type VoiceIcePayload,
  type VoiceRenegotiatePayload,
  type RequestIceServersAck,
  EVENTS,
} from './protocol.js';
import type {
  GameHistoryEntry as DbGameHistoryEntry,
  PlayerProgression,
  PlayerStatsRow,
  LeaderboardEntry,
  CoPlayerEntry,
} from '@ganatri/db';
import { getConfig, isAdminEmail, isValidAdminSecret, updateConfig, RETENTION_DAYS } from './config.js';
import { getIceServers } from './iceConfig.js';
import { maybeTouchAuthenticatedSession } from './auth/sessionMiddleware.js';
import {
  type RoomState,
  type SessionState,
  store,
  createSession,
  createRoom,
  getRoom,
  getSession,
  getSessionByPlayerId,
  updateSession,
} from './store.js';
import type { GameTransport } from './transport.js';
import { SocketTransport } from './socketTransport.js';
import { recordGameStart, recordEvents, recordGameEnd, getPersistence, getRoomEventLog } from './persistence.js';
import { computeMatchScoringSnapshot, scoreFinishedGame } from './scoring.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_PLAYERS_TO_START = 2;
const MOVE_DEBOUNCE_MS = 100;
const MAX_PLAYER_NAME_LENGTH = 20;

/** Alphabet for room codes: A-Z excluding O (and digits 1-9, no 0). */
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';

// ---------------------------------------------------------------------------
// Module-level transport instance (set once in setupSocketHandlers)
// ---------------------------------------------------------------------------

let transport: GameTransport;

// ---------------------------------------------------------------------------
// Player name sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitizes a player name by trimming whitespace, limiting length, and removing
 * any HTML/special characters that could pose an XSS risk.
 */
function sanitizePlayerName(name: string): string {
  if (!name) return '';
  // Trim whitespace
  let sanitized = name.trim();
  // Enforce character limit
  sanitized = sanitized.slice(0, MAX_PLAYER_NAME_LENGTH);
  // Remove HTML/special characters that could be used for XSS
  // Remove < > and other potentially dangerous characters
  sanitized = sanitized.replace(/[<>]/g, '');
  return sanitized;
}

// ---------------------------------------------------------------------------
// Turn timer helpers
// ---------------------------------------------------------------------------

/**
 * Build a playerId -> display-name snapshot map for the given seating order,
 * falling back to the raw id when no session name is set.
 */
function namesFor(seating: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pid of seating) out[pid] = getSessionByPlayerId(pid)?.name || pid;
  return out;
}

function progressionViewOf(progression: PlayerProgression | null): PlayerProgressionView {
  const base = progression ?? {
    userId: '',
    rankedRating: 0,
    totalXp: 0,
    level: 1,
    highestMatchScore: 0,
    totalMatchScore: 0,
    ghostFinishes: 0,
    updatedAt: new Date(0),
  };
  const nextLevel = base.level + 1;
  const xpForNext = (nextLevel - 1) * (nextLevel - 1) * 25;
  return {
    rankedRating: base.rankedRating,
    totalXp: base.totalXp,
    level: base.level,
    xpToNextLevel: Math.max(0, xpForNext - base.totalXp),
    highestMatchScore: base.highestMatchScore,
    totalMatchScore: base.totalMatchScore,
    ghostFinishes: base.ghostFinishes,
    updatedAt: progression ? progression.updatedAt.toISOString() : null,
  };
}

function toBreakdownView(rows: ReadonlyArray<{ reason: ScoreBreakdownRowView['reason']; delta: number }>): ScoreBreakdownRowView[] {
  return rows.map((row) => ({ reason: row.reason, delta: row.delta }));
}

function matchScoringForState(roomCode: string, state: GameState, isAbandoned = false): MatchScoringView[] {
  const events = getRoomEventLog(roomCode);
  if (state.phase === 'GAME_OVER') {
    const scored = scoreFinishedGame({
      state,
      events,
      isAbandoned,
      userIdByPlayerId: Object.fromEntries(
        state.seating.map((pid: string) => [pid, getSessionByPlayerId(pid)?.userId ?? null])
      ),
      previousProgressionByUserId: {},
    });
    return scored.map((entry) => ({
      playerId: state.seating[entry.seatIndex] as string,
      matchScore: entry.matchScore,
      xpEarned: entry.xpEarned,
      rankedRatingDelta: entry.rankedRatingDelta,
      matchScoreBreakdown: toBreakdownView(entry.matchScoreBreakdown),
      ratingBreakdown: toBreakdownView(entry.ratingBreakdown),
      xpBreakdown: toBreakdownView(entry.xpBreakdown),
      ghostFinish: entry.ghostFinish,
    }));
  }

  const snapshot = computeMatchScoringSnapshot(state, events);
  return state.seating.map((playerId) => ({
    playerId,
    matchScore: snapshot.totals[playerId] ?? 0,
    xpEarned: 10 + (snapshot.totals[playerId] ?? 0),
    rankedRatingDelta: 0,
    matchScoreBreakdown: [],
    ratingBreakdown: [],
    xpBreakdown: [],
    ghostFinish: false,
  }));
}

function clearTurnTimer(room: RoomState): void {
  if (room.turnTimer !== null) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
  room.turnStartedAt = null;
}

function startTurnTimer(roomCode: string, playerId: string, t: GameTransport): void {
  const room = getRoom(roomCode);
  if (!room) return;
  clearTurnTimer(room);
  room.turnStartedAt = Date.now();
  room.turnTimer = setTimeout(() => {
    applyAutoMove(roomCode, playerId, t, 'timeout');
  }, getConfig().turnTimeoutMs);
}

/**
 * Common logic for auto-playing a move due to turn timeout or grace-period expiry.
 * Applies the first legal move, broadcasts game events, sends updated views,
 * and arms the next turn timer (if game continues).
 *
 * @param roomCode The room where the auto-move is happening
 * @param playerId The player whose turn it is
 * @param t The transport for broadcasting
 * @param reason Why the move is being auto-played: 'timeout' or 'grace-expired'
 */
function applyAutoMove(roomCode: string, playerId: string, t: GameTransport, reason: 'timeout' | 'grace-expired'): void {
  const room = getRoom(roomCode);
  if (!room || room.phase !== 'PLAYING' || !room.gameState) return;
  if (room.gameState.turn !== playerId) return;

  const moves = legalMoves(room.gameState, playerId);
  if (moves.length === 0) return;

  const move = moves[0]!;
  const result = applyMove(room.gameState, playerId, move);
  if (!result.ok) return;

  // Broadcast timeout event before game events so players see the notification.
  const moveDetails = { type: move.type, card: move.card };
  t.broadcast(roomCode, EVENTS.TURN_TIMEOUT, {
    playerId,
    move: moveDetails,
  });

  room.gameState = result.state;
  if (result.state.phase === 'GAME_OVER') {
    room.phase = 'DONE';
    room.completedAt = Date.now();
    clearTurnTimer(room);
  }

  // Broadcast each game event to the room.
  for (const event of result.events as GameEvent[]) {
    t.broadcast(roomCode, EVENTS.GAME_EVENT, { event });
  }

  // Persist events (async write-through; never blocks gameplay).
  // Order matters: recordEvents must run before recordGameEnd so the final
  // batch lands in the per-room event log that cut/stats tallies read.
  recordEvents(roomCode, result.events);
  if (result.state.phase === 'GAME_OVER') {
    recordGameEnd(roomCode, result.state, namesFor(result.state.seating), false);
  }

  // Compute turnStartedAt for the next turn before modifying room state.
  const nextTurnStartedAt =
    room.phase === 'PLAYING' && result.state.turn !== null ? Date.now() : null;

  // Send updated view to all players.
  for (const pid of room.players) {
    t.send(pid, EVENTS.STATE_UPDATE, {
      view: viewFor(result.state, pid),
      turnStartedAt: nextTurnStartedAt,
      turnTimeoutMs: getConfig().turnTimeoutMs,
      matchScoring: matchScoringForState(roomCode, result.state),
    });
  }

  // Arm timer for the next player directly (avoids a redundant clearTurnTimer
  // call since we already cleared or the game ended above).
  if (room.phase === 'PLAYING' && result.state.turn !== null) {
    room.turnStartedAt = nextTurnStartedAt;
    room.turnTimer = setTimeout(() => {
      applyAutoMove(roomCode, result.state.turn as string, t, 'timeout');
    }, getConfig().turnTimeoutMs);
  }
}

/**
 * Called when a grace period expires during PLAYING.
 * If it's the player's turn: auto-play their first legal move (forfeit).
 * If it's not their turn: they are fully removed from the game (forfeited).
 * Broadcasts ROOM_UPDATE so other players see the seat is gone.
 */
function gracePeriodExpired(roomCode: string, playerId: string, t: GameTransport): void {
  const room = getRoom(roomCode);
  if (!room || room.phase !== 'PLAYING' || !room.gameState) {
    // Grace period expired but we're not in PLAYING anymore (game ended, player left).
    // Clean up timers and state.
    if (room) {
      room.gracePeriodTimers.delete(playerId);
      room.disconnectedAt.delete(playerId);
    }
    return;
  }

  room.gracePeriodTimers.delete(playerId);
  room.disconnectedAt.delete(playerId);

  // If it's their turn, auto-play the first legal move (forfeit).
  if (room.gameState.turn === playerId) {
    applyAutoMove(roomCode, playerId, t, 'grace-expired');
  } else {
    // Not their turn: remove them from the game entirely (forfeit).
    // They are no longer in the disconnectedPlayers set.
    room.players = room.players.filter((p) => p !== playerId);
    if (room.players.length < MIN_PLAYERS_TO_START) {
      clearTurnTimer(room);
      room.phase = 'DONE';
      room.completedAt = Date.now();
      // Game abandoned (too few players). Persist before any state is cleared.
      if (room.gameState !== null) {
        recordGameEnd(roomCode, room.gameState, namesFor(room.gameState.seating), true);
      }
    }
    // Broadcast updated room state so other players see the seat is gone.
    broadcastRoomUpdate(roomCode);
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Timers created by setupSocketHandlers, returned so createApp can clear them. */
export interface SocketHandlerTimers {
  /** 60s DONE-room cleanup interval. */
  roomCleanup: ReturnType<typeof setInterval>;
  /** Daily data-retention prune interval. */
  retention: ReturnType<typeof setInterval>;
}

/**
 * Run the data-retention prune (events + abandoned games older than the
 * retention window). No-op when persistence is unconfigured. Never throws.
 */
async function runRetention(): Promise<void> {
  const p = getPersistence();
  if (!p) return;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const events = await p.pruneGameEventsBefore(cutoff);
    const games = await p.pruneAbandonedGamesBefore(cutoff);
    console.log(`[retention] pruned ${events} event(s) and ${games} abandoned game(s) older than ${RETENTION_DAYS}d`);
  } catch (err) {
    console.error('[retention] prune failed:', err);
  }
}

export function setupSocketHandlers(io: Server): SocketHandlerTimers {
  transport = new SocketTransport(io);

  io.on('connection', (socket) => {
    handleConnection(io, socket);
  });

  // Periodically delete DONE rooms that have passed their expiry window.
  const roomCleanup = setInterval(() => {
    const now = Date.now();
    const expiryMs = getConfig().roomExpiryMs;
    for (const [code, room] of store.rooms) {
      if (room.phase === 'DONE' && room.completedAt !== null && now - room.completedAt > expiryMs) {
        clearTurnTimer(room);
        store.rooms.delete(code);
      }
    }
  }, 60_000);

  // Data-retention job: run once on startup, then daily.
  void runRetention();
  const retention = setInterval(() => {
    void runRetention();
  }, 24 * 60 * 60 * 1000);

  return { roomCleanup, retention };
}

// ---------------------------------------------------------------------------
// Ghost session adoption (post-restart recovery)
// ---------------------------------------------------------------------------

/**
 * After a server restart, recovery.ts pre-populates ghost sessions (socketId
 * === null) for every player in a recovered game. When the player connects
 * with an unknown token (or no token), we match them by their playerId and
 * "adopt" the ghost: swap in the new token and socket, then call handleReconnect.
 *
 * Matching precedence:
 *  1. Logged-in users: authoritative playerId comes from socket.data.userId
 *     (resolved by the OAuth session cookie — cannot be spoofed by the client).
 *  2. Guests: use the playerId the client sends in handshake auth (from
 *     localStorage). Same trust level as the session token itself.
 */
function tryAdoptGhostSession(
  socket: Socket,
  incomingPlayerId?: string,
): SessionState | null {
  const candidatePlayerIds: string[] = [];
  if (incomingPlayerId) candidatePlayerIds.push(incomingPlayerId);
  if (socket.data.userId && socket.data.userId !== incomingPlayerId) {
    candidatePlayerIds.push(socket.data.userId);
  }

  for (const playerId of candidatePlayerIds) {
    const existingToken = store.playerIndex.get(playerId);
    if (existingToken === undefined) continue;

    const ghost = store.sessions.get(existingToken);
    if (!ghost || ghost.socketId !== null) continue;

    const authenticatedUserId = socket.data.userId;
    if (
      authenticatedUserId
      && ghost.userId !== null
      && ghost.userId !== authenticatedUserId
    ) {
      continue;
    }

    const newToken = uuidv4();
    store.sessions.delete(existingToken);
    ghost.token = newToken;
    ghost.socketId = socket.id;
    store.sessions.set(newToken, ghost);
    store.playerIndex.set(ghost.playerId, newToken);
    bindAccount(socket, ghost);
    socket.emit(EVENTS.SESSION, sessionPayload(ghost));
    return ghost;
  }

  return null;
}

/**
 * Set up a grace-period timer for a player that was disconnected at server
 * restart. Called by recovery.ts after creating ghost sessions so that games
 * auto-resolve if all players fail to reconnect.
 */
export function scheduleGracePeriodForRecovery(
  roomCode: string,
  playerId: string,
): void {
  const room = getRoom(roomCode);
  if (!room || room.phase !== 'PLAYING') return;
  if (room.gracePeriodTimers.has(playerId)) return; // already scheduled

  room.disconnectedAt.set(playerId, Date.now());
  const timer = setTimeout(() => {
    room.gracePeriodTimers.delete(playerId);
    room.disconnectedAt.delete(playerId);
    gracePeriodExpired(roomCode, playerId, transport);
  }, getConfig().gracePeriodMs);
  room.gracePeriodTimers.set(playerId, timer);
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

function handleConnection(io: Server, socket: Socket): void {
  // Resolve or create session.
  const incomingGuestToken = socket.handshake.auth['guestToken'] as string | undefined;
  // playerId sent from client localStorage — used to adopt ghost sessions after
  // a server restart when the old token is no longer in the store.
  const incomingPlayerId = socket.handshake.auth['playerId'] as string | undefined;
  let session: SessionState;

  if (incomingGuestToken !== undefined && incomingGuestToken !== '') {
    const existing = getSession(incomingGuestToken);
    if (existing !== undefined) {
      // Normal reconnect: token found in store.
      session = existing;
      existing.socketId = socket.id;
      bindAccount(socket, session);
      handleReconnect(socket, session);
    } else {
      // Token not recognised (e.g. server restarted). Check whether a ghost
      // session exists for this playerId so we can rejoin an in-progress game.
      const ghost = tryAdoptGhostSession(socket, incomingPlayerId);
      if (ghost !== null) {
        session = ghost;
        handleReconnect(socket, session);
      } else {
        session = issueNewSession(socket);
      }
    }
  } else {
    // No token — still check for a ghost before treating as completely new.
    const ghost = tryAdoptGhostSession(socket, incomingPlayerId);
    if (ghost !== null) {
      session = ghost;
      handleReconnect(socket, session);
    } else {
      session = issueNewSession(socket);
    }
  }

  // Register all event listeners for this socket.
  registerSocketEvents(io, socket, session);

  // Broadcast presence to all other clients when a logged-in user connects.
  if (session.userId !== null) {
    socket.broadcast.emit(EVENTS.PLAYER_ONLINE_STATUS, {
      userId: session.userId,
      isOnline: true,
    } satisfies PlayerOnlineStatusPayload);
  }

  socket.on('disconnect', () => {
    store.adminSockets.delete(socket.id);
    const userId = session.userId;
    handleDisconnect(socket, session);
    // Broadcast offline only if this socket was the active one (handleDisconnect nulls socketId).
    if (userId !== null && session.socketId === null) {
      socket.broadcast.emit(EVENTS.PLAYER_ONLINE_STATUS, {
        userId,
        isOnline: false,
      } satisfies PlayerOnlineStatusPayload);
    }
  });
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

/**
 * Copy any logged-in account info resolved by the socket auth middleware onto
 * the session. For a fresh logged-in session the playerId already equals the
 * userId (see issueNewSession). For a pre-existing guest token that arrives
 * with a login cookie we record the account but keep the original guest
 * playerId to avoid disrupting any in-progress room membership.
 */
function bindAccount(socket: Socket, session: SessionState): void {
  const userId = socket.data.userId;
  const account = socket.data.account;
  if (userId === undefined || account === undefined) return;
  session.userId = userId;
  session.account = account;
  if (!session.name && account.displayName) session.name = account.displayName;
}

function issueNewSession(socket: Socket): SessionState {
  const token = uuidv4();
  // Durable identity: a logged-in account uses its user id as the playerId so
  // history/stats survive restarts. Guests get a fresh random uuid.
  const playerId = socket.data.userId ?? uuidv4();
  const session = createSession(token, playerId, socket.id);
  bindAccount(socket, session);
  socket.emit(EVENTS.SESSION, sessionPayload(session));
  return session;
}

/** Build the SESSION payload, including account fields when logged in. */
function sessionPayload(session: SessionState): {
  playerId: string;
  guestToken?: string;
  loggedIn: boolean;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  name?: string;
} {
  if (session.userId !== null && session.account !== null) {
    return {
      playerId: session.playerId,
      loggedIn: true,
      displayName: session.account.displayName,
      ...(session.account.email !== null ? { email: session.account.email } : {}),
      ...(session.account.avatarUrl !== null ? { avatarUrl: session.account.avatarUrl } : {}),
    };
  }
  return {
    playerId: session.playerId,
    guestToken: session.token,
    loggedIn: false,
    ...(session.name ? { name: session.name } : {}),
  };
}

// ---------------------------------------------------------------------------
// Reconnect logic
// ---------------------------------------------------------------------------

function handleReconnect(socket: Socket, session: SessionState): void {
  const { playerId, roomCode } = session;

  // Re-join the socket.io room so they receive broadcasts again.
  if (roomCode !== null) {
    const room = getRoom(roomCode);
    if (room !== undefined) {
      socket.join(roomCode);

      // Cancel grace-period timer if it was running.
      const timer = room.gracePeriodTimers.get(playerId);
      if (timer !== undefined) {
        clearTimeout(timer);
        room.gracePeriodTimers.delete(playerId);
      }
      room.disconnectedAt.delete(playerId);

      // Broadcast reconnect event.
      socket.to(roomCode).emit(EVENTS.PLAYER_RECONNECTED, { playerId });

      // Restore the reconnecting client's room context (it has empty state after a
      // reload). The socket re-joined the channel above, so the broadcast reaches it.
      broadcastRoomUpdate(roomCode);

      // Send the player their current game view if a game is in progress.
      if (room.gameState !== null) {
        socket.emit(EVENTS.STATE_UPDATE, {
          view: viewFor(room.gameState, playerId),
          turnStartedAt: room.turnStartedAt,
          turnTimeoutMs: getConfig().turnTimeoutMs,
          matchScoring: matchScoringForState(roomCode, room.gameState),
        });
      }
    } else {
      // Room expired/deleted — clear the stale roomCode from the session.
      updateSession(session.token, { roomCode: null });
    }
  }

  // Re-issue the session payload (client may need the playerId + account info).
  socket.emit(EVENTS.SESSION, sessionPayload(session));
}

// ---------------------------------------------------------------------------
// Disconnect logic
// ---------------------------------------------------------------------------

function handleDisconnect(socket: Socket, session: SessionState): void {
  // Clean up debounce state for this specific socket.
  lastMoveTime.delete(socket.id);

  // Guard: if the session already points to a different (newer) socket, the
  // player reconnected before this disconnect event fired. Emitting
  // PLAYER_DISCONNECTED here would create a permanent "offline" ghost, and
  // nulling socketId would break message delivery to the live socket.
  if (session.socketId !== socket.id) return;

  session.socketId = null;
  const { playerId, roomCode } = session;

  if (roomCode === null) return;
  const room = getRoom(roomCode);
  if (room === undefined) return;

  if (room.phase === 'LOBBY') {
    // Hold the seat through a grace period (e.g. host refreshing the tab) so the
    // room — and its shared code — survives a brief disconnect. The seat is only
    // released if the player fails to reconnect before the timer fires.
    room.disconnectedAt.set(playerId, Date.now());
    socket.to(roomCode).emit(EVENTS.PLAYER_DISCONNECTED, { playerId });

    const timer = setTimeout(() => {
      room.gracePeriodTimers.delete(playerId);
      room.disconnectedAt.delete(playerId);
      removeFromLobby(roomCode, session);
    }, getConfig().gracePeriodMs);
    room.gracePeriodTimers.set(playerId, timer);
    return;
  }

  if (room.phase === 'PLAYING') {
    room.disconnectedAt.set(playerId, Date.now());

    // Broadcast disconnect to room.
    socket.to(roomCode).emit(EVENTS.PLAYER_DISCONNECTED, { playerId });

    // Start grace-period countdown.
    const timer = setTimeout(() => {
      gracePeriodExpired(roomCode, playerId, transport);
    }, getConfig().gracePeriodMs);

    room.gracePeriodTimers.set(playerId, timer);
  }
}

// ---------------------------------------------------------------------------
// Per-socket event listeners
// ---------------------------------------------------------------------------

/**
 * Tracks last move timestamp per socket to enforce the 100 ms debounce.
 * Keyed by socket.id. Entries are removed on disconnect to prevent leaks.
 */
const lastMoveTime: Map<string, number> = new Map();

/** For tests: clear debounce state between test runs. */
export function resetLastMoveTime(): void {
  lastMoveTime.clear();
}

// ---------------------------------------------------------------------------
// IP rate limiter (create_room + join_room)
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Single rate-limit bucket shared by create_room and join_room.
 * Key: IP address string. Value: { count, resetAt }.
 * Expired entries are pruned on each check to bound memory use.
 */
const ipRateLimit: Map<string, RateLimitEntry> = new Map();

/**
 * Check whether the given IP is within the rate limit.
 * Prunes expired entries on each call.
 * Returns true when the request is allowed, false when the limit is exceeded.
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Prune expired entries.
  for (const [key, entry] of ipRateLimit) {
    if (entry.resetAt <= now) ipRateLimit.delete(key);
  }

  const entry = ipRateLimit.get(ip);
  if (entry === undefined || entry.resetAt <= now) {
    // First request in this window.
    ipRateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // limit exceeded
  }

  entry.count += 1;
  return true;
}

/** For tests: reset rate-limit state and optionally control the clock. */
export function resetIpRateLimit(): void {
  ipRateLimit.clear();
}

/**
 * Exposed for tests that need to pre-fill the rate-limit bucket
 * (e.g. to advance the window without waiting 60 s).
 */
export function __setIpRateLimitForTests(
  ip: string,
  count: number,
  resetAt: number,
): void {
  ipRateLimit.set(ip, { count, resetAt });
}

const INVITE_TIMEOUT_MS = 60_000;

interface InviteState {
  inviterId: string;
  inviteeId: string;
  roomCode: string;
  timerId: ReturnType<typeof setTimeout>;
}

/** key: `${inviterId}:${inviteeId}` — at most one pending invite per directed pair */
const pendingInvites = new Map<string, InviteState>();

/** For tests: cancel all timers and clear invite state between runs. */
export function __resetPendingInvitesForTests(): void {
  for (const invite of pendingInvites.values()) {
    clearTimeout(invite.timerId);
  }
  pendingInvites.clear();
}

function registerSocketEvents(io: Server, socket: Socket, session: SessionState): void {
  const touchAuthSession = (): void => maybeTouchAuthenticatedSession(socket);

  socket.on(EVENTS.CREATE_ROOM, (payloadOrAck: unknown, maybeAck?: (res: CreateRoomAck) => void) => {
    touchAuthSession();
    // Support both (payload, ack) and legacy (ack) call forms.
    let ack: (res: CreateRoomAck) => void;
    let name = '';
    if (typeof payloadOrAck === 'function') {
      ack = payloadOrAck as (res: CreateRoomAck) => void;
    } else {
      if (typeof maybeAck !== 'function') return;
      ack = maybeAck;
      if (typeof payloadOrAck === 'object' && payloadOrAck !== null) {
        const n = (payloadOrAck as Record<string, unknown>)['name'];
        if (typeof n === 'string') name = sanitizePlayerName(n);
      }
    }
    // IP rate limit: skip when address is unavailable.
    const ip = socket.handshake.address;
    if (ip && !checkRateLimit(ip)) {
      ack({ ok: false, error: 'RATE_LIMITED' });
      return;
    }
    if (name) updateSession(session.token, { name });
    handleCreateRoom(socket, session, ack);
  });

  socket.on(EVENTS.JOIN_ROOM, (payload: unknown, ack: (res: JoinRoomAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    if (!isJoinRoomPayload(payload)) {
      ack({ ok: false, error: 'NOT_FOUND' });
      return;
    }
    // IP rate limit: skip when address is unavailable.
    const ip = socket.handshake.address;
    if (ip && !checkRateLimit(ip)) {
      ack({ ok: false, error: 'RATE_LIMITED' });
      return;
    }
    if (typeof payload.name === 'string' && payload.name.trim()) {
      updateSession(session.token, { name: sanitizePlayerName(payload.name) });
    }
    handleJoinRoom(socket, session, payload.roomCode.trim().toUpperCase(), ack);
  });

  socket.on(EVENTS.LEAVE_ROOM, (ack: (res: LeaveRoomAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    handleLeaveRoom(socket, session, ack);
  });

  socket.on(EVENTS.START_GAME, (ack: (res: StartGameAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    handleStartGame(session, ack);
  });

  socket.on(EVENTS.MAKE_MOVE, (payload: unknown, ack: (res: MakeMoveAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;

    // Rate-limit: debounce rapid double-submits.
    const now = Date.now();
    const last = lastMoveTime.get(socket.id) ?? 0;
    if (now - last < MOVE_DEBOUNCE_MS) {
      ack({ ok: false, error: 'NOT_YOUR_TURN', message: 'Move submitted too quickly — please wait.' });
      return;
    }
    lastMoveTime.set(socket.id, now);

    if (!isMakeMovePayload(payload)) {
      ack({ ok: false, error: 'NOT_YOUR_TURN', message: 'Invalid move payload.' });
      return;
    }
    handleMakeMove(session, payload.move, ack);
  });

  socket.on(EVENTS.REQUEST_STATE, (ack: (res: RequestStateAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    handleRequestState(session, ack);
  });

  socket.on(EVENTS.REQUEST_HISTORY, (ack: (res: RequestHistoryAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleRequestHistory(session, ack);
  });

  socket.on(EVENTS.GET_RECENT_PLAYERS, (ack: (res: GetRecentPlayersAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleGetRecentPlayers(session, ack);
  });

  socket.on(EVENTS.GET_BLOCKED_USERS, (ack: (res: GetBlockedUsersAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleGetBlockedUsers(session, ack);
  });

  socket.on(EVENTS.INVITE_PLAYER, (payload: unknown, ack: (res: InvitePlayerAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleInvitePlayer(socket, session, payload, ack);
  });

  socket.on(EVENTS.RESPOND_TO_INVITE, (payload: unknown, ack: (res: RespondToInviteAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleRespondToInvite(socket, session, payload, ack);
  });

  socket.on(EVENTS.BLOCK_USER, (payload: unknown, ack: (res: BlockUserAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleBlockUser(session, payload, ack);
  });

  socket.on(EVENTS.UNBLOCK_USER, (payload: unknown, ack: (res: UnblockUserAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleUnblockUser(session, payload, ack);
  });

  socket.on(EVENTS.GET_MY_STATS, (ack: (res: GetMyStatsAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleGetMyStats(session, ack);
  });

  socket.on(EVENTS.GET_MY_PROGRESSION, (ack: (res: GetMyProgressionAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleGetMyProgression(session, ack);
  });

  socket.on(EVENTS.GET_MY_SCORE_HISTORY, (ack: (res: GetMyScoreHistoryAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleGetMyScoreHistory(session, ack);
  });

  socket.on(EVENTS.GET_LEADERBOARD, (reqOrAck: GetLeaderboardRequest | ((res: GetLeaderboardAck) => void), maybeAck?: (res: GetLeaderboardAck) => void) => {
    touchAuthSession();
    // Support both: emit(event, payload, ack) and legacy emit(event, ack).
    let req: GetLeaderboardRequest;
    let ack: (res: GetLeaderboardAck) => void;
    if (typeof reqOrAck === 'function') {
      req = {};
      ack = reqOrAck;
    } else {
      req = reqOrAck ?? {};
      if (typeof maybeAck !== 'function') return;
      ack = maybeAck;
    }
    void handleGetLeaderboard(session, req, ack);
  });

  socket.on(EVENTS.UPDATE_DISPLAY_NAME, (payload: unknown, ack: (res: UpdateDisplayNameAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleUpdateDisplayName(socket, session, payload, ack).catch(console.error);
  });

  socket.on(EVENTS.UPDATE_AVATAR, (payload: unknown, ack: (res: UpdateAvatarAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleUpdateAvatar(socket, session, payload, ack).catch(console.error);
  });

  socket.on(EVENTS.GET_AUTH_SESSIONS, (ack: (res: GetAuthSessionsAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleGetAuthSessions(socket, session, ack).catch(console.error);
  });

  socket.on(EVENTS.REVOKE_AUTH_SESSION, (payload: unknown, ack: (res: RevokeAuthSessionAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleRevokeAuthSession(socket, session, payload, ack).catch(console.error);
  });

  socket.on(EVENTS.REVOKE_OTHER_AUTH_SESSIONS, (ack: (res: RevokeOtherAuthSessionsAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleRevokeOtherAuthSessions(socket, session, ack).catch(console.error);
  });

  socket.on(EVENTS.DELETE_ACCOUNT, (ack: (res: DeleteAccountAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleDeleteAccount(socket, session, ack).catch(console.error);
  });

  socket.on(EVENTS.DOWNLOAD_MY_DATA, (ack: (res: DownloadMyDataAck) => void) => {
    touchAuthSession();
    if (typeof ack !== 'function') return;
    void handleDownloadMyData(session, ack).catch(console.error);
  });

  // Admin: authenticate
  socket.on(EVENTS.ADMIN_AUTH, (payload: AdminAuthPayload, ack: (res: { ok: boolean; reason?: string }) => void) => {
    if (typeof ack !== 'function') return;
    if (!payload || typeof payload.email !== 'string') {
      ack({ ok: false, reason: 'invalid_payload' });
      return;
    }
    if (isAdminEmail(payload.email) && isValidAdminSecret(payload.secret ?? '')) {
      store.adminSockets.add(socket.id);
      ack({ ok: true });
    } else {
      ack({ ok: false, reason: 'not_authorized' });
    }
  });

  // Admin: get config
  socket.on(EVENTS.ADMIN_GET_CONFIG, (_: unknown, ack: (res: { ok?: boolean; reason?: string; config?: Readonly<import('./config.js').GameConfig> }) => void) => {
    if (typeof ack !== 'function') return;
    if (!store.adminSockets.has(socket.id)) {
      ack({ ok: false, reason: 'not_authorized' });
      return;
    }
    ack({ config: getConfig() });
  });

  // Admin: update config
  socket.on(EVENTS.ADMIN_UPDATE_CONFIG, (payload: AdminUpdateConfigPayload, ack: (res: { ok: boolean; reason?: string }) => void) => {
    if (typeof ack !== 'function') return;
    if (!store.adminSockets.has(socket.id)) {
      ack({ ok: false, reason: 'not_authorized' });
      return;
    }
    if (!payload || typeof payload.config !== 'object' || payload.config === null) {
      ack({ ok: false, reason: 'invalid_payload' });
      return;
    }
    const patch = payload.config;
    const isValidMs = (v: unknown): boolean => typeof v === 'number' && v > 0 && v < 3_600_000 * 24;
    const isValidPlayers = (v: unknown): boolean => typeof v === 'number' && v >= 2 && v <= 8;
    if (patch.turnTimeoutMs !== undefined && !isValidMs(patch.turnTimeoutMs)) {
      ack({ ok: false, reason: 'invalid_value: turnTimeoutMs' }); return;
    }
    if (patch.maxPlayers !== undefined && !isValidPlayers(patch.maxPlayers)) {
      ack({ ok: false, reason: 'invalid_value: maxPlayers' }); return;
    }
    if (patch.gracePeriodMs !== undefined && !isValidMs(patch.gracePeriodMs)) {
      ack({ ok: false, reason: 'invalid_value: gracePeriodMs' }); return;
    }
    if (patch.roomExpiryMs !== undefined && !isValidMs(patch.roomExpiryMs)) {
      ack({ ok: false, reason: 'invalid_value: roomExpiryMs' }); return;
    }
    updateConfig(patch);
    ack({ ok: true });
  });

  // Admin: get live server stats
  socket.on(EVENTS.ADMIN_GET_STATS, (_: unknown, ack: (res: AdminGetStatsAck) => void) => {
    if (typeof ack !== 'function') return;
    if (!store.adminSockets.has(socket.id)) {
      ack({ ok: false, reason: 'not_authorized' });
      return;
    }
    let lobbyRooms = 0, activeGames = 0, completedRooms = 0;
    for (const room of store.rooms.values()) {
      if (room.phase === 'LOBBY') lobbyRooms++;
      else if (room.phase === 'PLAYING') activeGames++;
      else completedRooms++;
    }
    const connectedPlayers = Array.from(store.sessions.values())
      .filter(s => s.socketId !== null).length;
    ack({
      ok: true,
      stats: {
        totalRooms: store.rooms.size,
        lobbyRooms,
        activeGames,
        completedRooms,
        connectedPlayers,
        totalSessions: store.sessions.size,
      },
    });
  });

  // Admin: get historical KPI stats from the DB.
  socket.on(EVENTS.ADMIN_GET_KPI_STATS, (_: unknown, ack: (res: AdminGetKpiStatsAck) => void) => {
    if (typeof ack !== 'function') return;
    if (!store.adminSockets.has(socket.id)) {
      ack({ ok: false, reason: 'NOT_AUTHORIZED' });
      return;
    }
    const p = getPersistence();
    if (!p) {
      ack({ ok: false, reason: 'UNAVAILABLE' });
      return;
    }
    void p.getAdminKpiStats(7).then((stats) => {
      ack({ ok: true, stats });
    }).catch(() => {
      ack({ ok: false, reason: 'UNAVAILABLE' });
    });
  });

  // Admin: search users by display name or email.
  socket.on(EVENTS.ADMIN_SEARCH_USERS, (payload: unknown, ack: (res: AdminSearchUsersAck) => void) => {
    if (typeof ack !== 'function') return;
    void handleAdminSearchUsers(socket, payload, ack);
  });

  // Admin: get full stats for a single user.
  socket.on(EVENTS.ADMIN_GET_USER_STATS, (payload: unknown, ack: (res: AdminGetUserStatsAck) => void) => {
    if (typeof ack !== 'function') return;
    void handleAdminGetUserStats(socket, payload, ack);
  });

  // Admin: export all games data.
  socket.on(EVENTS.ADMIN_EXPORT_DATA, (payload: unknown, ack: (res: AdminExportDataAck) => void) => {
    if (typeof ack !== 'function') return;
    void handleAdminExportData(socket, payload, ack);
  });

  // Voice chat: hand out ICE servers (STUN + minted Cloudflare TURN creds).
  // TURN credentials are short-lived and generated server-side; the Cloudflare
  // API token never reaches the client.
  socket.on(EVENTS.VOICE_ICE_SERVERS, (ack: (res: RequestIceServersAck) => void) => {
    if (typeof ack !== 'function') return;
    void getIceServers().then((iceServers) => ack({ iceServers }));
  });

  // Voice chat signaling relay — forward WebRTC offer/answer/ICE to the target
  // player's current socket. No room validation needed: callers only know peer
  // player IDs from room_update, which already enforces room membership.
  socket.on(EVENTS.VOICE_OFFER, (payload: VoiceOfferPayload) => {
    const target = getSessionByPlayerId(payload.targetPlayerId);
    if (target?.socketId) {
      io.to(target.socketId).emit(EVENTS.VOICE_OFFER_RELAY, {
        sourcePlayerId: session.playerId,
        offer: payload.offer,
      });
    }
  });

  socket.on(EVENTS.VOICE_ANSWER, (payload: VoiceAnswerPayload) => {
    const target = getSessionByPlayerId(payload.targetPlayerId);
    if (target?.socketId) {
      io.to(target.socketId).emit(EVENTS.VOICE_ANSWER_RELAY, {
        sourcePlayerId: session.playerId,
        answer: payload.answer,
      });
    }
  });

  socket.on(EVENTS.VOICE_ICE, (payload: VoiceIcePayload) => {
    const target = getSessionByPlayerId(payload.targetPlayerId);
    if (target?.socketId) {
      io.to(target.socketId).emit(EVENTS.VOICE_ICE_RELAY, {
        sourcePlayerId: session.playerId,
        candidate: payload.candidate,
      });
    }
  });

  socket.on(EVENTS.VOICE_RENEGOTIATE, (payload: VoiceRenegotiatePayload) => {
    const target = getSessionByPlayerId(payload.targetPlayerId);
    if (target?.socketId) {
      io.to(target.socketId).emit(EVENTS.VOICE_RENEGOTIATE_RELAY, {
        sourcePlayerId: session.playerId,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// create_room
// ---------------------------------------------------------------------------

function handleCreateRoom(socket: Socket, session: SessionState, ack: (res: CreateRoomAck) => void): void {
  // One-game rule: reject if already in an ACTIVE (PLAYING) game.
  if (session.roomCode !== null) {
    const existing = getRoom(session.roomCode);
    if (existing !== undefined && existing.phase === 'PLAYING') {
      ack({ ok: false, error: 'ALREADY_IN_GAME', currentRoomCode: session.roomCode });
      return;
    }
    // LOBBY or DONE room — leave it first silently.
    silentLeaveRoom(socket, session);
  }

  const code = generateRoomCode();
  createRoom(code, session.playerId);
  updateSession(session.token, { roomCode: code });
  socket.join(code);

  broadcastRoomUpdate(code);
  ack({ ok: true, roomCode: code });
}

// ---------------------------------------------------------------------------
// join_room
// ---------------------------------------------------------------------------

function handleJoinRoom(
  socket: Socket,
  session: SessionState,
  roomCode: string,
  ack: (res: JoinRoomAck) => void,
): void {
  const room = getRoom(roomCode);

  if (room === undefined) {
    ack({ ok: false, error: 'NOT_FOUND' });
    return;
  }

  // One-game rule.
  if (session.roomCode !== null) {
    const existing = getRoom(session.roomCode);
    if (existing !== undefined && existing.phase === 'PLAYING') {
      ack({ ok: false, error: 'ALREADY_IN_GAME', currentRoomCode: session.roomCode });
      return;
    }
    // Leave the lobby/done room first.
    silentLeaveRoom(socket, session);
  }

  if (room.phase === 'PLAYING') {
    // Allow rejoining the same room if they're already a player.
    if (room.players.includes(session.playerId)) {
      // Rejoin: re-attach socket.
      updateSession(session.token, { roomCode });
      socket.join(roomCode);
      if (room.gameState !== null) {
        socket.emit(EVENTS.STATE_UPDATE, {
          view: viewFor(room.gameState, session.playerId),
          turnStartedAt: room.turnStartedAt,
          turnTimeoutMs: getConfig().turnTimeoutMs,
          matchScoring: matchScoringForState(roomCode, room.gameState),
        });
      }
      ack({ ok: true });
      return;
    }
    ack({ ok: false, error: 'ALREADY_STARTED' });
    return;
  }

  if (room.phase === 'DONE') {
    ack({ ok: false, error: 'ALREADY_STARTED' });
    return;
  }

  if (room.players.length >= getConfig().maxPlayers) {
    ack({ ok: false, error: 'FULL' });
    return;
  }

  // Add player to room.
  if (!room.players.includes(session.playerId)) {
    room.players.push(session.playerId);
  }
  updateSession(session.token, { roomCode });
  socket.join(roomCode);

  broadcastRoomUpdate(roomCode);
  ack({ ok: true });
}

// ---------------------------------------------------------------------------
// leave_room
// ---------------------------------------------------------------------------

function handleLeaveRoom(socket: Socket, session: SessionState, ack: (res: LeaveRoomAck) => void): void {
  if (session.roomCode === null) {
    ack({ ok: true }); // idempotent
    return;
  }
  silentLeaveRoom(socket, session);
  ack({ ok: true });
}

/** Leave the current room without emitting an ack — used internally. */
/**
 * Remove a player from a LOBBY room without a live socket (grace-period expiry).
 * Deletes the room if it becomes empty, otherwise transfers host and notifies.
 */
function removeFromLobby(roomCode: string, session: SessionState): void {
  const room = getRoom(roomCode);
  // Only act if the player is still considered in this room and hasn't reconnected.
  if (room === undefined || room.phase !== 'LOBBY' || session.roomCode !== roomCode) return;

  room.players = room.players.filter((p) => p !== session.playerId);
  updateSession(session.token, { roomCode: null });

  if (room.players.length === 0) {
    store.rooms.delete(roomCode);
    return;
  }
  if (room.hostId === session.playerId) {
    room.hostId = room.players[0]!;
  }
  broadcastRoomUpdate(roomCode);
}

function silentLeaveRoom(socket: Socket, session: SessionState): void {
  const roomCode = session.roomCode;
  if (roomCode === null) return;

  const room = getRoom(roomCode);
  if (room !== undefined) {
    if (room.phase === 'LOBBY') {
      room.players = room.players.filter((p) => p !== session.playerId);
      if (room.players.length === 0) {
        store.rooms.delete(roomCode);
      } else {
        if (room.hostId === session.playerId && room.players.length > 0) {
          room.hostId = room.players[0]!;
        }
        broadcastRoomUpdate(roomCode);
      }
    } else if (room.phase === 'PLAYING') {
      // Explicit leave from an active game: remove the player fully so the turn
      // timer's transport.send loop no longer targets their socket in the new room.
      room.players = room.players.filter((p) => p !== session.playerId);
      const graceTimer = room.gracePeriodTimers.get(session.playerId);
      if (graceTimer !== undefined) {
        clearTimeout(graceTimer);
        room.gracePeriodTimers.delete(session.playerId);
      }
      room.disconnectedAt.delete(session.playerId);
      if (room.players.length < MIN_PLAYERS_TO_START) {
        clearTurnTimer(room);
        room.phase = 'DONE';
        room.completedAt = Date.now();
        // Game abandoned (too few players). Persist before any state is cleared.
        if (room.gameState !== null) {
          recordGameEnd(roomCode, room.gameState, namesFor(room.gameState.seating), true);
        }
      } else {
        broadcastRoomUpdate(roomCode);
      }
    }
    // For DONE rooms: no seat changes needed, just detach the socket below.
  }

  // Cancel any pending invites this player sent — their room is gone.
  if (session.userId !== null) {
    for (const [key, invite] of pendingInvites.entries()) {
      if (invite.inviterId === session.userId) {
        clearTimeout(invite.timerId);
        pendingInvites.delete(key);
        transport.send(invite.inviteeId, EVENTS.INVITE_CANCELLED, {
          inviterUserId: session.userId,
        } satisfies InviteCancelledPayload);
      }
    }
  }

  socket.leave(roomCode);
  updateSession(session.token, { roomCode: null });
}

// ---------------------------------------------------------------------------
// invite_player / respond_to_invite / block_user / unblock_user
// ---------------------------------------------------------------------------

async function handleInvitePlayer(
  socket: Socket,
  session: SessionState,
  payload: unknown,
  ack: (res: InvitePlayerAck) => void,
): Promise<void> {
  if (session.userId === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }
  const inviterUserId = session.userId;

  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  const targetUserId = (payload as InvitePlayerPayload)?.targetUserId;
  if (typeof targetUserId !== 'string' || targetUserId === '') return;

  if (targetUserId === inviterUserId) {
    ack({ ok: false, error: 'SELF_INVITE' });
    return;
  }

  // Find invitee's live session
  let inviteeSession: SessionState | null = null;
  for (const s of store.sessions.values()) {
    if (s.userId === targetUserId && s.socketId !== null) {
      inviteeSession = s;
      break;
    }
  }
  if (inviteeSession === null) {
    ack({ ok: false, error: 'OFFLINE' });
    return;
  }

  // Invitee already in an active game
  if (inviteeSession.roomCode !== null) {
    const inviteeRoom = getRoom(inviteeSession.roomCode);
    if (inviteeRoom !== undefined && inviteeRoom.phase === 'PLAYING') {
      ack({ ok: false, error: 'ALREADY_IN_ROOM' });
      return;
    }
  }

  // Block check (either direction)
  try {
    const blockedFwd = await p.isBlocked(inviterUserId, targetUserId);
    const blockedRev = await p.isBlocked(targetUserId, inviterUserId);
    if (blockedFwd || blockedRev) {
      ack({ ok: false, error: 'BLOCKED' });
      return;
    }
  } catch {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  // Inviter room: cannot invite from an active game; auto-create if needed
  if (session.roomCode !== null) {
    const inviterRoom = getRoom(session.roomCode);
    if (inviterRoom !== undefined && inviterRoom.phase === 'PLAYING') {
      ack({ ok: false, error: 'ALREADY_IN_GAME' });
      return;
    }
    if (inviterRoom === undefined || inviterRoom.phase === 'DONE') {
      silentLeaveRoom(socket, session);
    }
    // LOBBY room: keep using it
  }

  if (session.roomCode === null) {
    const newCode = generateRoomCode();
    createRoom(newCode, session.playerId);
    updateSession(session.token, { roomCode: newCode });
    socket.join(newCode);
    broadcastRoomUpdate(newCode);
  }

  const roomCode = session.roomCode!;

  // Replace any existing pending invite for this pair
  const inviteKey = `${inviterUserId}:${targetUserId}`;
  const existing = pendingInvites.get(inviteKey);
  if (existing !== undefined) {
    clearTimeout(existing.timerId);
    pendingInvites.delete(inviteKey);
  }

  const timerId = setTimeout(() => {
    pendingInvites.delete(inviteKey);
    transport.send(targetUserId, EVENTS.INVITE_CANCELLED, {
      inviterUserId,
    } satisfies InviteCancelledPayload);
  }, INVITE_TIMEOUT_MS);

  pendingInvites.set(inviteKey, { inviterId: inviterUserId, inviteeId: targetUserId, roomCode, timerId });

  transport.send(targetUserId, EVENTS.INVITE_RECEIVED, {
    inviterUserId,
    displayName: session.account?.displayName ?? session.name,
    avatarUrl: session.account?.avatarUrl ?? null,
    roomCode,
  } satisfies InviteReceivedPayload);

  ack({ ok: true, roomCode });
}

async function handleRespondToInvite(
  socket: Socket,
  session: SessionState,
  payload: unknown,
  ack: (res: RespondToInviteAck) => void,
): Promise<void> {
  if (session.userId === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }

  const p = payload as RespondToInvitePayload;
  const inviterUserId = p?.inviterUserId;
  const accept = p?.accept;
  if (typeof inviterUserId !== 'string' || typeof accept !== 'boolean') return;

  const inviteKey = `${inviterUserId}:${session.userId}`;
  const invite = pendingInvites.get(inviteKey);
  if (invite === undefined) {
    ack({ ok: false, error: 'NOT_FOUND' });
    return;
  }

  clearTimeout(invite.timerId);
  pendingInvites.delete(inviteKey);

  if (!accept) {
    if (p.block === true) {
      const persistence = getPersistence();
      if (persistence) {
        try { await persistence.blockUser(session.userId, inviterUserId); } catch { /* non-fatal */ }
      }
    }
    transport.send(inviterUserId, EVENTS.INVITE_REJECTED, {
      inviteeUserId: session.userId,
    } satisfies InviteRejectedPayload);
    ack({ ok: true });
    return;
  }

  // Accept: auto-join the inviter's room
  const room = getRoom(invite.roomCode);
  if (room === undefined || room.phase !== 'LOBBY') {
    ack({ ok: false, error: 'NOT_FOUND' });
    return;
  }

  if (session.roomCode !== null) {
    const existingRoom = getRoom(session.roomCode);
    if (existingRoom !== undefined && existingRoom.phase === 'PLAYING') {
      ack({ ok: false, error: 'UNAVAILABLE' });
      return;
    }
    silentLeaveRoom(socket, session);
  }

  if (!room.players.includes(session.playerId)) {
    room.players.push(session.playerId);
  }
  updateSession(session.token, { roomCode: invite.roomCode });
  socket.join(invite.roomCode);
  broadcastRoomUpdate(invite.roomCode);

  transport.send(inviterUserId, EVENTS.INVITE_ACCEPTED, {
    inviteeUserId: session.userId,
    displayName: session.account?.displayName ?? session.name,
    roomCode: invite.roomCode,
  } satisfies InviteAcceptedPayload);

  ack({ ok: true, roomCode: invite.roomCode });
}

async function handleBlockUser(
  session: SessionState,
  payload: unknown,
  ack: (res: BlockUserAck) => void,
): Promise<void> {
  if (session.userId === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }
  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }
  const targetUserId = (payload as BlockUserPayload)?.targetUserId;
  if (typeof targetUserId !== 'string' || targetUserId === '') return;
  try {
    await p.blockUser(session.userId, targetUserId);
    ack({ ok: true });
  } catch {
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

async function handleUnblockUser(
  session: SessionState,
  payload: unknown,
  ack: (res: UnblockUserAck) => void,
): Promise<void> {
  if (session.userId === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }
  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }
  const targetUserId = (payload as UnblockUserPayload)?.targetUserId;
  if (typeof targetUserId !== 'string' || targetUserId === '') return;
  try {
    await p.unblockUser(session.userId, targetUserId);
    ack({ ok: true });
  } catch {
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

// ---------------------------------------------------------------------------
// start_game
// ---------------------------------------------------------------------------

function handleStartGame(session: SessionState, ack: (res: StartGameAck) => void): void {
  const { roomCode, playerId } = session;
  if (roomCode === null) {
    ack({ ok: false, error: 'NOT_HOST' });
    return;
  }

  const room = getRoom(roomCode);
  if (room === undefined || (room.phase !== 'LOBBY' && room.phase !== 'DONE')) {
    ack({ ok: false, error: 'NOT_HOST' });
    return;
  }

  if (room.hostId !== playerId) {
    ack({ ok: false, error: 'NOT_HOST' });
    return;
  }

  if (room.players.length < MIN_PLAYERS_TO_START) {
    ack({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
    return;
  }

  // Reset end-of-game state before starting a new round.
  room.completedAt = null;

  // Create the game — seed from current timestamp for reproducibility in logs.
  const seed = Date.now();
  const gameState = createGame(room.players, seed);
  room.gameState = gameState;
  room.phase = 'PLAYING';

  // Persist the room + game start (async write-through; never blocks gameplay).
  recordGameStart(roomCode, room.hostId, room.players, seed, namesFor(room.players));

  broadcastRoomUpdate(roomCode);

  // Arm the first turn timer before sending views so turnStartedAt is set.
  if (gameState.turn !== null) {
    startTurnTimer(roomCode, gameState.turn, transport);
  }

  // Send each player their initial redacted view (includes turnStartedAt).
  for (const pid of room.players) {
    transport.send(pid, EVENTS.STATE_UPDATE, {
      view: viewFor(gameState, pid),
      turnStartedAt: room.turnStartedAt,
      turnTimeoutMs: getConfig().turnTimeoutMs,
      matchScoring: matchScoringForState(roomCode, gameState),
    });
  }

  ack({ ok: true });
}

// ---------------------------------------------------------------------------
// make_move
// ---------------------------------------------------------------------------

function handleMakeMove(session: SessionState, move: Move, ack: (res: MakeMoveAck) => void): void {
  const { roomCode, playerId } = session;

  if (roomCode === null) {
    ack({ ok: false, error: 'NOT_YOUR_TURN', message: 'You are not in a room.' });
    return;
  }

  const room = getRoom(roomCode);
  if (room === undefined || room.phase !== 'PLAYING' || room.gameState === null) {
    ack({ ok: false, error: 'WRONG_PHASE', message: 'Game is not active.' });
    return;
  }

  // Clear the current turn timer before applying the move.
  clearTurnTimer(room);

  const result: MoveResult = applyMove(room.gameState, playerId, move);

  if (!result.ok) {
    // Move rejected — restart the timer so the same player can try again.
    startTurnTimer(roomCode, playerId, transport);
    ack({ ok: false, error: result.error, message: result.message });
    return;
  }

  // Move was valid. Update state.
  room.gameState = result.state;

  if (result.state.phase === 'GAME_OVER') {
    room.phase = 'DONE';
    room.completedAt = Date.now();
    clearTurnTimer(room);
  }

  // Start the next player's turn timer (no-op if game ended).
  if (room.phase === 'PLAYING' && result.state.turn !== null) {
    startTurnTimer(roomCode, result.state.turn as string, transport);
  }

  // Broadcast each game event to the room.
  for (const event of result.events as GameEvent[]) {
    transport.broadcast(roomCode, EVENTS.GAME_EVENT, { event });
  }

  // Persist events (async write-through; never blocks gameplay).
  // Order matters: recordEvents must run before recordGameEnd so the final
  // batch lands in the per-room event log that cut/stats tallies read.
  recordEvents(roomCode, result.events);
  if (result.state.phase === 'GAME_OVER') {
    recordGameEnd(roomCode, result.state, namesFor(result.state.seating), false);
  }

  // Unicast the updated view to every connected player in the room.
  for (const pid of room.players) {
    if (pid === playerId) continue; // Mover's view sent in ack below.
    transport.send(pid, EVENTS.STATE_UPDATE, {
      view: viewFor(result.state, pid),
      turnStartedAt: room.turnStartedAt,
      turnTimeoutMs: getConfig().turnTimeoutMs,
      matchScoring: matchScoringForState(roomCode, result.state),
    });
  }

  // Ack the mover with their redacted view.
  ack({
    ok: true,
    view: viewFor(result.state, playerId),
    turnStartedAt: room.turnStartedAt,
    matchScoring: matchScoringForState(roomCode, result.state),
  });
}

// ---------------------------------------------------------------------------
// request_state
// ---------------------------------------------------------------------------

function handleRequestState(session: SessionState, ack: (res: RequestStateAck) => void): void {
  const { roomCode, playerId } = session;

  if (roomCode === null) {
    ack({ view: null });
    return;
  }

  const room = getRoom(roomCode);
  if (room === undefined || room.gameState === null) {
    ack({ view: null });
    return;
  }

  ack({ view: viewFor(room.gameState, playerId) });
}

// ---------------------------------------------------------------------------
// request_history
// ---------------------------------------------------------------------------

async function handleRequestHistory(
  session: SessionState,
  ack: (res: RequestHistoryAck) => void,
): Promise<void> {
  // Only durable (logged-in) accounts have a queryable history.
  if (session.userId === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }

  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  try {
    const games = await p.getUserGameHistory(session.userId);
    ack({ ok: true, games: games.map(flattenHistoryEntry) });
  } catch (err) {
    console.error(`[history] getUserGameHistory failed for ${session.userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

/**
 * Convert the DB's nested `GameHistoryEntry` (with a `game` sub-object and
 * `Date` fields) into the FLAT wire shape the web client expects. Date fields
 * are converted to ISO strings explicitly rather than relying on socket.io's
 * JSON coercion, so the wire contract is deterministic.
 */
function flattenHistoryEntry(e: DbGameHistoryEntry): WireGameHistoryEntry {
  return {
    id: e.game.id,
    startedAt: e.game.startedAt.toISOString(),
    endedAt: e.game.endedAt?.toISOString() ?? null,
    durationMs: e.game.durationMs ?? 0,
    playerCount: e.game.playerCount,
    isAbandoned: e.game.isAbandoned,
    winnerId: e.game.winnerId,
    you: {
      seatIndex: e.you.seatIndex,
      finalRank: e.you.finalRank,
      result: e.you.result,
      captureCount: e.you.captureCount,
      wasCut: e.you.wasCut,
    },
    players: e.players.map((pl) => ({
      userId: pl.userId,
      displayNameSnapshot: pl.displayNameSnapshot,
      seatIndex: pl.seatIndex,
      finalRank: pl.finalRank,
      result: pl.result,
      captureCount: pl.captureCount,
      wasCut: pl.wasCut,
      matchScore: pl.matchScore,
      xpEarned: pl.xpEarned,
      rankedRatingDelta: pl.rankedRatingDelta,
    })),
    matchScore: e.matchScore,
    xpEarned: e.xpEarned,
    rankedRatingDelta: e.rankedRatingDelta,
  };
}

// ---------------------------------------------------------------------------
// get_blocked_users
// ---------------------------------------------------------------------------

async function handleGetBlockedUsers(
  session: SessionState,
  ack: (res: GetBlockedUsersAck) => void,
): Promise<void> {
  if (session.userId === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }

  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  try {
    const blockedUsers = await p.getBlockedUsers(session.userId);
    ack({ ok: true, users: blockedUsers });
  } catch (err) {
    console.error(`[blocked-users] getBlockedUsers failed for ${session.userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

// ---------------------------------------------------------------------------
// get_recent_players
// ---------------------------------------------------------------------------

async function handleGetRecentPlayers(
  session: SessionState,
  ack: (res: GetRecentPlayersAck) => void,
): Promise<void> {
  if (session.userId === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }

  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  try {
    const entries = await p.getFrequentCoPlayers(session.userId, 20);

    const onlineUserIds = new Set<string>();
    for (const s of store.sessions.values()) {
      if (s.userId !== null && s.socketId !== null) {
        onlineUserIds.add(s.userId);
      }
    }

    const players: CoPlayerView[] = entries.map((e: CoPlayerEntry) => ({
      userId: e.userId,
      displayName: e.displayName,
      avatarUrl: e.avatarUrl,
      gamesPlayedTogether: e.gamesPlayedTogether,
      isOnline: onlineUserIds.has(e.userId),
    }));

    ack({ ok: true, players });
  } catch (err) {
    console.error(`[recent-players] getFrequentCoPlayers failed for ${session.userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

// ---------------------------------------------------------------------------
// get_my_stats
// ---------------------------------------------------------------------------

async function handleGetMyStats(
  session: SessionState,
  ack: (res: GetMyStatsAck) => void,
): Promise<void> {
  // Only durable (logged-in) accounts have aggregate statistics.
  if (session.userId === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }

  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  try {
    const row = await p.getPlayerStats(session.userId);
    // "Logged in, never finished a game" is a valid empty result, not an error.
    ack({ ok: true, stats: row === null ? zeroStatsView() : mapStatsView(row) });
  } catch (err) {
    console.error(`[stats] getPlayerStats failed for ${session.userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

async function handleGetMyProgression(
  session: SessionState,
  ack: (res: GetMyProgressionAck) => void,
): Promise<void> {
  if (session.userId === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }
  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }
  try {
    const progression = await p.getPlayerProgression(session.userId);
    ack({ ok: true, progression: progressionViewOf(progression) });
  } catch (err) {
    console.error(`[progression] getPlayerProgression failed for ${session.userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

async function handleGetMyScoreHistory(
  session: SessionState,
  ack: (res: GetMyScoreHistoryAck) => void,
): Promise<void> {
  if (session.userId === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }
  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }
  try {
    const history = await p.getScoreHistory(session.userId);
    const wire: ScoreHistoryEntryView[] = history.map((entry) => ({
      gameId: entry.gameId,
      createdAt: entry.createdAt.toISOString(),
      matchScore: entry.matchScore,
      xpEarned: entry.xpEarned,
      rankedRatingDelta: entry.rankedRatingDelta,
      rows: entry.rows.map((row) => ({
        kind: row.kind,
        reason: row.reason,
        delta: row.delta,
        createdAt: row.createdAt.toISOString(),
      })),
    }));
    ack({ ok: true, history: wire });
  } catch (err) {
    console.error(`[progression] getScoreHistory failed for ${session.userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

/** Map a DB stats row to the FLAT wire shape (Date → ISO string, derive winRate). */
function mapStatsView(row: PlayerStatsRow): PlayerStatsView {
  return {
    gamesPlayed: row.gamesPlayed,
    gamesWon: row.gamesWon,
    gamesLost: row.gamesLost,
    gamesAbandoned: row.gamesAbandoned,
    winRate: row.gamesPlayed > 0 ? row.gamesWon / row.gamesPlayed : 0,
    totalCaptures: row.totalCaptures,
    cutsGiven: row.cutsGiven,
    cutsReceived: row.cutsReceived,
    timesSafe: row.timesSafe,
    totalPlayTimeMs: row.totalPlayTimeMs,
    currentWinStreak: row.currentWinStreak,
    longestWinStreak: row.longestWinStreak,
    avgFinish: (row.gamesPlayed - row.gamesAbandoned) > 0 ? row.sumFinishPositions / (row.gamesPlayed - row.gamesAbandoned) : 0,
    highestMatchScore: row.highestMatchScore,
    totalMatchScore: row.totalMatchScore,
    ghostFinishes: row.ghostFinishes,
    averageMatchScore: row.gamesPlayed > 0 ? row.totalMatchScore / row.gamesPlayed : 0,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : (row.updatedAt ?? null),
  };
}

// ---------------------------------------------------------------------------
// get_leaderboard (public)
// ---------------------------------------------------------------------------

async function handleGetLeaderboard(
  session: SessionState,
  req: GetLeaderboardRequest,
  ack: (res: GetLeaderboardAck) => void,
): Promise<void> {
  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }
  try {
    const timeWindow = (req.timeWindow === 'week' || req.timeWindow === 'month')
      ? req.timeWindow
      : undefined;
    const rows = await p.getLeaderboard(20, 0, timeWindow);
    const entries = rows.map((r, i) => mapLeaderboardEntry(r, i));

    // When the requesting user is logged in but not in the top page, fetch
    // their own rank so the client can show their position below the list.
    let myEntry: LeaderboardEntryView | undefined;
    if (session.userId !== null) {
      const inTop = entries.some((e) => e.userId === session.userId);
      if (!inTop) {
        const myRank = await p.getMyLeaderboardRank(session.userId, timeWindow);
        if (myRank) {
          myEntry = { ...mapLeaderboardEntry(myRank, 0), rank: myRank.rank };
        }
      }
    }

    ack({ ok: true, entries, ...(myEntry !== undefined ? { myEntry } : {}) });
  } catch (err) {
    console.error('[leaderboard] getLeaderboard failed:', err);
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

/** Map a DB leaderboard row to the wire shape, assigning a 1-based rank. */
function mapLeaderboardEntry(row: LeaderboardEntry, i: number): LeaderboardEntryView {
  return {
    rank: i + 1,
    userId: row.userId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    gamesPlayed: row.gamesPlayed,
    gamesWon: row.gamesWon,
    winRate: row.gamesPlayed > 0 ? row.gamesWon / row.gamesPlayed : 0,
  };
}

/** An all-zero stats view for a logged-in user with no stats row yet. */
function zeroStatsView(): PlayerStatsView {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    gamesAbandoned: 0,
    winRate: 0,
    totalCaptures: 0,
    cutsGiven: 0,
    cutsReceived: 0,
    timesSafe: 0,
    totalPlayTimeMs: 0,
    currentWinStreak: 0,
    longestWinStreak: 0,
    avgFinish: 0,
    highestMatchScore: 0,
    totalMatchScore: 0,
    ghostFinishes: 0,
    averageMatchScore: 0,
    updatedAt: null,
  };
}

// ---------------------------------------------------------------------------
// update_display_name
// ---------------------------------------------------------------------------

async function handleUpdateDisplayName(
  socket: Socket,
  session: SessionState,
  payload: unknown,
  ack: (res: UpdateDisplayNameAck) => void,
): Promise<void> {
  // Guard: must be a logged-in account (userId and account are set together by bindAccount).
  if (session.userId === null || session.account === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }

  // Validate and sanitize the incoming name.
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as Record<string, unknown>)['newDisplayName'] !== 'string'
  ) {
    ack({ ok: false, error: 'INVALID_NAME' });
    return;
  }

  const sanitized = sanitizePlayerName(
    (payload as UpdateDisplayNamePayload).newDisplayName
  );
  if (sanitized === '') {
    ack({ ok: false, error: 'INVALID_NAME' });
    return;
  }

  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  try {
    await p.updateUserDisplayName(session.userId, sanitized);
  } catch (err) {
    console.error(`[account] updateUserDisplayName failed for ${session.userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  // Update the in-memory session so subsequent broadcasts/SESSIONs are correct.
  // session.account is guaranteed non-null (guarded above).
  session.account.displayName = sanitized;
  updateSession(session.token, { name: sanitized });

  // Re-emit SESSION so the frontend picks up the new display name immediately.
  socket.emit(EVENTS.SESSION, sessionPayload(session));

  ack({ ok: true, displayName: sanitized });
}

// ---------------------------------------------------------------------------
// update_avatar
// ---------------------------------------------------------------------------

function isValidAvatarUrl(v: unknown): boolean {
  if (v === null) return true;
  if (typeof v !== 'string') return false;
  if (/^preset:[1-8]$/.test(v)) return true;
  // HTTPS URL, max 512 chars, basic check
  if (v.startsWith('https://') && v.length <= 512 && !v.includes('\n') && !v.includes(' ')) return true;
  return false;
}

async function handleUpdateAvatar(
  socket: Socket,
  session: SessionState,
  payload: unknown,
  ack: (res: UpdateAvatarAck) => void,
): Promise<void> {
  // Guard: must be a logged-in account.
  if (session.userId === null || session.account === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }

  // Extract and validate avatarUrl from payload.
  const avatarUrl = (payload !== null && typeof payload === 'object')
    ? (payload as Record<string, unknown>)['avatarUrl']
    : undefined;

  if (!isValidAvatarUrl(avatarUrl)) {
    ack({ ok: false, error: 'INVALID_AVATAR' });
    return;
  }

  const validated = avatarUrl as string | null;

  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  try {
    await p.updateUserAvatarUrl(session.userId, validated);
  } catch (err) {
    console.error(`[account] updateUserAvatarUrl failed for ${session.userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  // Update the in-memory session so subsequent SESSIONs are correct.
  session.account.avatarUrl = validated;

  // Re-emit SESSION so the frontend picks up the new avatar immediately.
  socket.emit(EVENTS.SESSION, sessionPayload(session));

  ack({ ok: true, avatarUrl: validated });
}

function authSessionView(
  authSession: {
    id: string;
    userAgent: string | null;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
  },
  currentSessionId: string,
): AuthSessionView {
  return {
    id: authSession.id,
    current: authSession.id === currentSessionId,
    userAgent: authSession.userAgent?.trim() || 'Unknown device',
    createdAt: authSession.createdAt.toISOString(),
    lastSeenAt: authSession.lastSeenAt.toISOString(),
    expiresAt: authSession.expiresAt.toISOString(),
  };
}

async function handleGetAuthSessions(
  socket: Socket,
  session: SessionState,
  ack: (res: GetAuthSessionsAck) => void,
): Promise<void> {
  if (session.userId === null || session.account === null || !socket.data.authSessionId) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }

  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  try {
    const sessions = await p.listAuthSessions(session.userId);
    ack({
      ok: true,
      sessions: sessions.map((authSession) =>
        authSessionView(authSession, socket.data.authSessionId!),
      ),
    });
  } catch (err) {
    console.error(`[auth] listAuthSessions failed for ${session.userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

async function handleRevokeAuthSession(
  socket: Socket,
  session: SessionState,
  payload: unknown,
  ack: (res: RevokeAuthSessionAck) => void,
): Promise<void> {
  if (session.userId === null || session.account === null || !socket.data.authSessionId) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }
  if (
    typeof payload !== 'object'
    || payload === null
    || typeof (payload as Record<string, unknown>)['sessionId'] !== 'string'
  ) {
    ack({ ok: false, error: 'NOT_FOUND' });
    return;
  }

  const targetSessionId = (payload as RevokeAuthSessionPayload).sessionId;
  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  try {
    const sessions = await p.listAuthSessions(session.userId);
    if (!sessions.some((authSession) => authSession.id === targetSessionId)) {
      ack({ ok: false, error: 'NOT_FOUND' });
      return;
    }

    await p.revokeAuthSessionById(session.userId, targetSessionId);
    const revokedCurrent = targetSessionId === socket.data.authSessionId;

    if (revokedCurrent) {
      const revokedUserId = session.userId;
      session.userId = null;
      session.account = null;
      socket.data.authSessionId = undefined;
      socket.data.authSessionTokenHash = undefined;
      socket.data.authSessionTouchedAt = undefined;
      updateSession(session.token, { name: '' });
      socket.emit(EVENTS.SESSION, sessionPayload(session));
      socket.broadcast.emit(EVENTS.PLAYER_ONLINE_STATUS, {
        userId: revokedUserId,
        isOnline: false,
      } satisfies PlayerOnlineStatusPayload);
    }

    ack({ ok: true, revokedCurrent });
  } catch (err) {
    console.error(`[auth] revokeAuthSessionById failed for ${session.userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

async function handleRevokeOtherAuthSessions(
  socket: Socket,
  session: SessionState,
  ack: (res: RevokeOtherAuthSessionsAck) => void,
): Promise<void> {
  if (session.userId === null || session.account === null || !socket.data.authSessionId) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }

  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  try {
    const revokedCount = await p.revokeOtherAuthSessions(session.userId, socket.data.authSessionId);
    ack({ ok: true, revokedCount });
  } catch (err) {
    console.error(`[auth] revokeOtherAuthSessions failed for ${session.userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

// ---------------------------------------------------------------------------
// delete_account (right to erasure)
// ---------------------------------------------------------------------------

async function handleDeleteAccount(
  socket: Socket,
  session: SessionState,
  ack: (res: DeleteAccountAck) => void,
): Promise<void> {
  // Guard: must be a logged-in account.
  if (session.userId === null || session.account === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }
  // Capture userId now — silentLeaveRoom does not null it, but we want a stable
  // local binding so TS narrowing is preserved across the function call.
  const userId = session.userId;

  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  // Clean up any room membership before deleting the DB record.
  // session.userId is still populated at this point so invite cancellation works.
  silentLeaveRoom(socket, session);

  try {
    await p.deleteUser(userId);
  } catch (err) {
    console.error(`[account] deleteUser failed for ${userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  // Convert the session back to a guest (strip account binding).
  session.userId = null;
  session.account = null;
  updateSession(session.token, { name: '' });

  // Re-emit SESSION as guest so the frontend transitions back to the logged-out state.
  socket.emit(EVENTS.SESSION, sessionPayload(session));

  ack({ ok: true });
}

// ---------------------------------------------------------------------------
// download_my_data (GDPR/CCPA right to access)
// ---------------------------------------------------------------------------

async function handleDownloadMyData(
  session: SessionState,
  ack: (res: DownloadMyDataAck) => void,
): Promise<void> {
  // Guard: must be a logged-in account.
  if (session.userId === null) {
    ack({ ok: false, error: 'NOT_LOGGED_IN' });
    return;
  }

  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }

  const userId = session.userId;

  try {
    const [games, statsRow] = await Promise.all([
      p.getUserGameHistory(userId),
      p.getPlayerStats(userId),
    ]);

    ack({
      ok: true,
      data: {
        userId,
        displayName: session.account?.displayName ?? null,
        email: session.account?.email ?? null,
        exportedAt: new Date().toISOString(),
        stats: statsRow ? mapStatsView(statsRow) : null,
        games: games.map(flattenHistoryEntry),
      },
    });
  } catch (err) {
    console.error(`[data-export] download_my_data failed for ${userId}:`, err);
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

function broadcastRoomUpdate(roomCode: string): void {
  const room = getRoom(roomCode);
  if (room === undefined) return;

  const playerNames: Record<string, string> = {};
  const playerAvatarUrls: Record<string, string | null> = {};
  for (const pid of room.players) {
    const s = getSessionByPlayerId(pid);
    playerNames[pid] = s?.name || pid.slice(0, 6);
    playerAvatarUrls[pid] = s?.account?.avatarUrl ?? null;
  }

  transport.broadcast(roomCode, EVENTS.ROOM_UPDATE, {
    roomCode,
    players: [...room.players],
    hostId: room.hostId,
    phase: room.phase === 'PLAYING' ? 'PLAYING' : room.phase === 'DONE' ? 'DONE' : 'LOBBY',
    disconnectedPlayers: [...room.disconnectedAt.keys()],
    playerNames,
    playerAvatarUrls,
  });
}

// ---------------------------------------------------------------------------
// Admin: user management handlers
// ---------------------------------------------------------------------------

async function handleAdminSearchUsers(
  socket: Socket,
  payload: unknown,
  ack: (res: AdminSearchUsersAck) => void,
): Promise<void> {
  if (!store.adminSockets.has(socket.id)) {
    ack({ ok: false, error: 'NOT_AUTHORIZED' });
    return;
  }
  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }
  const raw = payload as AdminSearchUsersPayload | undefined;
  const query = (typeof raw?.query === 'string' ? raw.query : '').trim();
  if (query === '') {
    // Refuse blind DB scan — return empty list immediately.
    ack({ ok: true, users: [] });
    return;
  }
  const limit = Math.min(typeof raw?.limit === 'number' ? raw.limit : 20, 100);
  try {
    const results = await p.searchUsers(query, limit);
    const users: AdminUserView[] = results.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      email: r.email,
      avatarUrl: r.avatarUrl,
      isGuest: r.isGuest,
      gamesPlayed: r.gamesPlayed,
      gamesWon: r.gamesWon,
    }));
    ack({ ok: true, users });
  } catch {
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

async function handleAdminGetUserStats(
  socket: Socket,
  payload: unknown,
  ack: (res: AdminGetUserStatsAck) => void,
): Promise<void> {
  if (!store.adminSockets.has(socket.id)) {
    ack({ ok: false, error: 'NOT_AUTHORIZED' });
    return;
  }
  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }
  const raw = payload as AdminGetUserStatsPayload | undefined;
  const userId = typeof raw?.userId === 'string' ? raw.userId : '';
  if (!userId) {
    ack({ ok: false, error: 'NOT_FOUND' });
    return;
  }
  try {
    const result = await p.adminGetUserStats(userId);
    if (result === null) {
      ack({ ok: false, error: 'NOT_FOUND' });
      return;
    }
    const stats: AdminUserStatsView = {
      userId: result.userId,
      displayName: result.displayName,
      email: result.email,
      avatarUrl: result.avatarUrl,
      isGuest: result.isGuest,
      gamesPlayed: result.gamesPlayed,
      gamesWon: result.gamesWon,
      gamesLost: result.gamesLost,
      gamesAbandoned: result.gamesAbandoned,
      winRate: result.winRate,
      totalCaptures: result.totalCaptures,
      cutsGiven: result.cutsGiven,
      cutsReceived: result.cutsReceived,
      timesSafe: result.timesSafe,
      totalPlayTimeMs: result.totalPlayTimeMs,
      longestWinStreak: result.longestWinStreak,
      currentWinStreak: result.currentWinStreak,
      highestMatchScore: result.highestMatchScore,
      totalMatchScore: result.totalMatchScore,
      ghostFinishes: result.ghostFinishes,
      progression: result.progression ? progressionViewOf(result.progression) : null,
      updatedAt: result.updatedAt,
    };
    ack({ ok: true, stats });
  } catch {
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

async function handleAdminExportData(
  socket: Socket,
  payload: unknown,
  ack: (res: AdminExportDataAck) => void,
): Promise<void> {
  if (!store.adminSockets.has(socket.id)) {
    ack({ ok: false, error: 'NOT_AUTHORIZED' });
    return;
  }
  const p = getPersistence();
  if (!p) {
    ack({ ok: false, error: 'UNAVAILABLE' });
    return;
  }
  const raw = payload as AdminExportDataPayload | undefined;
  const limit = Math.min(
    typeof raw?.limit === 'number' && raw.limit > 0 ? raw.limit : 500,
    500,
  );
  try {
    const rows = await p.exportGamesData(limit);
    const games: ExportGameView[] = rows.map((r) => ({
      id: r.id,
      roomCode: r.roomCode,
      seed: r.seed,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      durationMs: r.durationMs,
      playerCount: r.playerCount,
      isAbandoned: r.isAbandoned,
      winnerId: r.winnerId,
      players: r.players.map((p): ExportGamePlayerView => ({
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
        finalRank: p.finalRank,
        captureCount: p.captureCount,
        wasCut: p.wasCut,
        result: p.result,
        matchScore: p.matchScore,
        xpEarned: p.xpEarned,
        rankedRatingDelta: p.rankedRatingDelta,
      })),
    }));
    ack({ ok: true, games });
  } catch {
    ack({ ok: false, error: 'UNAVAILABLE' });
  }
}

// ---------------------------------------------------------------------------
// Room code generation
// ---------------------------------------------------------------------------

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    if (!store.rooms.has(code)) return code;
  }
  throw new Error('Failed to generate unique room code after 100 attempts');
}

// ---------------------------------------------------------------------------
// Payload validators
// ---------------------------------------------------------------------------

function isJoinRoomPayload(v: unknown): v is { roomCode: string; name?: string } {
  return typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>)['roomCode'] === 'string';
}

function isMakeMovePayload(v: unknown): v is { move: Move } {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  const move = obj['move'];
  if (typeof move !== 'object' || move === null) return false;
  const m = move as Record<string, unknown>;
  const type = m['type'];
  if (type !== 'PLAY_CAPTURE' && type !== 'PLAY_TRICK') return false;
  if (typeof m['card'] !== 'string' || m['card'] === '') return false;
  if (type === 'PLAY_CAPTURE') {
    if (!Array.isArray(m['capture'])) return false;
    if (!(m['capture'] as unknown[]).every((c) => typeof c === 'string')) return false;
  }
  return true;
}
