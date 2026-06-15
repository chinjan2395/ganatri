/**
 * handlers.ts — Socket.io connection handler & all event routing.
 *
 * Business logic lives here. Transport (socket.io specifics) lives in
 * socketTransport.ts. State lives in store.ts.
 */

import type { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { applyMove, createGame, legalMoves, viewFor } from '@ganatri/engine';
import type { GameEvent, Move, MoveResult } from '@ganatri/engine';

import {
  type AdminAuthPayload,
  type AdminUpdateConfigPayload,
  type CreateRoomAck,
  type JoinRoomAck,
  type LeaveRoomAck,
  type MakeMoveAck,
  type StartGameAck,
  type RequestStateAck,
  type VoiceOfferPayload,
  type VoiceAnswerPayload,
  type VoiceIcePayload,
  type RequestIceServersAck,
  EVENTS,
} from './protocol.js';
import { getConfig, isAdminEmail, updateConfig } from './config.js';
import { getIceServers } from './iceConfig.js';
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_PLAYERS_TO_START = 2;
const MOVE_DEBOUNCE_MS = 100;

/** Alphabet for room codes: A-Z excluding O (and digits 1-9, no 0). */
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';

// ---------------------------------------------------------------------------
// Module-level transport instance (set once in setupSocketHandlers)
// ---------------------------------------------------------------------------

let transport: GameTransport;

// ---------------------------------------------------------------------------
// Turn timer helpers
// ---------------------------------------------------------------------------

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
    autoPlayTurn(roomCode, playerId, t);
  }, getConfig().turnTimeoutMs);
}

function autoPlayTurn(roomCode: string, playerId: string, t: GameTransport): void {
  const room = getRoom(roomCode);
  if (!room || room.phase !== 'PLAYING' || !room.gameState) return;
  if (room.gameState.turn !== playerId) return;

  const moves = legalMoves(room.gameState, playerId);
  if (moves.length === 0) return;

  const result = applyMove(room.gameState, playerId, moves[0]!);
  if (!result.ok) return;

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

  // Compute turnStartedAt for the next turn before modifying room state.
  const nextTurnStartedAt =
    room.phase === 'PLAYING' && result.state.turn !== null ? Date.now() : null;

  // Send updated view to all players.
  for (const pid of room.players) {
    t.send(pid, EVENTS.STATE_UPDATE, {
      view: viewFor(result.state, pid),
      turnStartedAt: nextTurnStartedAt,
      turnTimeoutMs: getConfig().turnTimeoutMs,
    });
  }

  // Arm timer for the next player directly (avoids a redundant clearTurnTimer
  // call since we already cleared or the game ended above).
  if (room.phase === 'PLAYING' && result.state.turn !== null) {
    room.turnStartedAt = nextTurnStartedAt;
    room.turnTimer = setTimeout(() => {
      autoPlayTurn(roomCode, result.state.turn as string, t);
    }, getConfig().turnTimeoutMs);
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function setupSocketHandlers(io: Server): void {
  transport = new SocketTransport(io);

  io.on('connection', (socket) => {
    handleConnection(io, socket);
  });

  // Periodically delete DONE rooms that have passed their expiry window.
  setInterval(() => {
    const now = Date.now();
    const expiryMs = getConfig().roomExpiryMs;
    for (const [code, room] of store.rooms) {
      if (room.phase === 'DONE' && room.completedAt !== null && now - room.completedAt > expiryMs) {
        clearTurnTimer(room);
        store.rooms.delete(code);
      }
    }
  }, 60_000);
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

function handleConnection(io: Server, socket: Socket): void {
  // Resolve or create session.
  const incomingToken = socket.handshake.auth['token'] as string | undefined;
  let session: SessionState;

  if (incomingToken !== undefined && incomingToken !== '') {
    const existing = getSession(incomingToken);
    if (existing !== undefined) {
      // Reconnect path: restore socket binding.
      session = existing;
      existing.socketId = socket.id;
      handleReconnect(socket, session);
    } else {
      // Unknown token → issue fresh session (treat as new player).
      session = issueNewSession(socket);
    }
  } else {
    session = issueNewSession(socket);
  }

  // Register all event listeners for this socket.
  registerSocketEvents(io, socket, session);

  socket.on('disconnect', () => {
    store.adminSockets.delete(socket.id);
    handleDisconnect(socket, session);
  });
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

function issueNewSession(socket: Socket): SessionState {
  const token = uuidv4();
  const playerId = uuidv4();
  const session = createSession(token, playerId, socket.id);
  socket.emit(EVENTS.SESSION, { token, playerId });
  return session;
}

// ---------------------------------------------------------------------------
// Reconnect logic
// ---------------------------------------------------------------------------

function handleReconnect(socket: Socket, session: SessionState): void {
  const { playerId, roomCode } = session;

  // Re-join the socket.io room so they receive broadcasts again.
  if (roomCode !== null) {
    socket.join(roomCode);

    const room = getRoom(roomCode);
    if (room !== undefined) {
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
        });
      }
    }
  }

  // Re-issue the session payload (client may need the playerId).
  socket.emit(EVENTS.SESSION, { token: session.token, playerId: session.playerId });
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
      // Grace period expired. Seat is held; game pauses on disconnect in v1.
      room.gracePeriodTimers.delete(playerId);
      console.log(`Grace period expired for player ${playerId} in room ${roomCode}`);
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

function registerSocketEvents(io: Server, socket: Socket, session: SessionState): void {
  socket.on(EVENTS.CREATE_ROOM, (payloadOrAck: unknown, maybeAck?: (res: CreateRoomAck) => void) => {
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
        if (typeof n === 'string') name = n.trim().slice(0, 20);
      }
    }
    if (name) updateSession(session.token, { name });
    handleCreateRoom(socket, session, ack);
  });

  socket.on(EVENTS.JOIN_ROOM, (payload: unknown, ack: (res: JoinRoomAck) => void) => {
    if (typeof ack !== 'function') return;
    if (!isJoinRoomPayload(payload)) {
      ack({ ok: false, error: 'NOT_FOUND' });
      return;
    }
    if (typeof payload.name === 'string' && payload.name.trim()) {
      updateSession(session.token, { name: payload.name.trim().slice(0, 20) });
    }
    handleJoinRoom(socket, session, payload.roomCode.trim().toUpperCase(), ack);
  });

  socket.on(EVENTS.LEAVE_ROOM, (ack: (res: LeaveRoomAck) => void) => {
    if (typeof ack !== 'function') return;
    handleLeaveRoom(socket, session, ack);
  });

  socket.on(EVENTS.START_GAME, (ack: (res: StartGameAck) => void) => {
    if (typeof ack !== 'function') return;
    handleStartGame(session, ack);
  });

  socket.on(EVENTS.MAKE_MOVE, (payload: unknown, ack: (res: MakeMoveAck) => void) => {
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
    if (typeof ack !== 'function') return;
    handleRequestState(session, ack);
  });

  // Admin: authenticate
  socket.on(EVENTS.ADMIN_AUTH, (payload: AdminAuthPayload, ack: (res: { ok: boolean; reason?: string }) => void) => {
    if (typeof ack !== 'function') return;
    if (!payload || typeof payload.email !== 'string') {
      ack({ ok: false, reason: 'invalid_payload' });
      return;
    }
    if (isAdminEmail(payload.email)) {
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
      } else {
        broadcastRoomUpdate(roomCode);
      }
    }
    // For DONE rooms: no seat changes needed, just detach the socket below.
  }

  socket.leave(roomCode);
  updateSession(session.token, { roomCode: null });
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

  // Unicast the updated view to every connected player in the room.
  for (const pid of room.players) {
    if (pid === playerId) continue; // Mover's view sent in ack below.
    transport.send(pid, EVENTS.STATE_UPDATE, {
      view: viewFor(result.state, pid),
      turnStartedAt: room.turnStartedAt,
      turnTimeoutMs: getConfig().turnTimeoutMs,
    });
  }

  // Ack the mover with their redacted view.
  ack({ ok: true, view: viewFor(result.state, playerId), turnStartedAt: room.turnStartedAt });
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
// Broadcast helpers
// ---------------------------------------------------------------------------

function broadcastRoomUpdate(roomCode: string): void {
  const room = getRoom(roomCode);
  if (room === undefined) return;

  const playerNames: Record<string, string> = {};
  for (const pid of room.players) {
    const s = getSessionByPlayerId(pid);
    playerNames[pid] = s?.name || pid.slice(0, 6);
  }

  transport.broadcast(roomCode, EVENTS.ROOM_UPDATE, {
    roomCode,
    players: [...room.players],
    hostId: room.hostId,
    phase: room.phase === 'PLAYING' ? 'PLAYING' : room.phase === 'DONE' ? 'DONE' : 'LOBBY',
    disconnectedPlayers: [...room.disconnectedAt.keys()],
    playerNames,
  });
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
