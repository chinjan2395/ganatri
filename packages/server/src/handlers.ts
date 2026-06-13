/**
 * handlers.ts — Socket.io connection handler & all event routing.
 *
 * Business logic lives here. Transport (socket.io specifics) lives in
 * socketTransport.ts. State lives in store.ts.
 */

import type { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { applyMove, createGame, viewFor } from '@ganatri/engine';
import type { GameEvent, Move, MoveResult } from '@ganatri/engine';

import {
  type CreateRoomAck,
  type JoinRoomAck,
  type LeaveRoomAck,
  type MakeMoveAck,
  type StartGameAck,
  type RequestStateAck,
  EVENTS,
} from './protocol.js';
import {
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

const MAX_PLAYERS = 4;
const MIN_PLAYERS_TO_START = 2;
const GRACE_PERIOD_MS = 60_000;
const MOVE_DEBOUNCE_MS = 100;

/** Alphabet for room codes: A-Z excluding O (and digits 1-9, no 0). */
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';

// ---------------------------------------------------------------------------
// Module-level transport instance (set once in setupSocketHandlers)
// ---------------------------------------------------------------------------

let transport: GameTransport;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function setupSocketHandlers(io: Server): void {
  transport = new SocketTransport(io);

  io.on('connection', (socket) => {
    handleConnection(socket);
  });
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

function handleConnection(socket: Socket): void {
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
  registerSocketEvents(socket, session);

  socket.on('disconnect', () => {
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
        socket.emit(EVENTS.STATE_UPDATE, { view: viewFor(room.gameState, playerId) });
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
  // Clean up debounce entry to prevent unbounded map growth and socket.id reuse issues.
  lastMoveTime.delete(socket.id);

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
    }, GRACE_PERIOD_MS);
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
    }, GRACE_PERIOD_MS);

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

function registerSocketEvents(socket: Socket, session: SessionState): void {
  socket.on(EVENTS.CREATE_ROOM, (ack: (res: CreateRoomAck) => void) => {
    if (typeof ack !== 'function') return;
    handleCreateRoom(socket, session, ack);
  });

  socket.on(EVENTS.JOIN_ROOM, (payload: unknown, ack: (res: JoinRoomAck) => void) => {
    if (typeof ack !== 'function') return;
    if (!isJoinRoomPayload(payload)) {
      ack({ ok: false, error: 'NOT_FOUND' });
      return;
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
        socket.emit(EVENTS.STATE_UPDATE, { view: viewFor(room.gameState, session.playerId) });
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

  if (room.players.length >= MAX_PLAYERS) {
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
    // Remove from player list (only valid in LOBBY).
    if (room.phase === 'LOBBY') {
      room.players = room.players.filter((p) => p !== session.playerId);
      // If room is now empty, clean it up.
      if (room.players.length === 0) {
        store.rooms.delete(roomCode);
      } else {
        // Transfer host if the host left.
        if (room.hostId === session.playerId && room.players.length > 0) {
          room.hostId = room.players[0]!;
        }
        broadcastRoomUpdate(roomCode);
      }
    }
    // For PLAYING/DONE rooms, the seat is kept; only the socket leaves the room channel.
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
  if (room === undefined || room.phase !== 'LOBBY') {
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

  // Create the game — seed from current timestamp for reproducibility in logs.
  const seed = Date.now();
  const gameState = createGame(room.players, seed);
  room.gameState = gameState;
  room.phase = 'PLAYING';

  broadcastRoomUpdate(roomCode);

  // Send each player their initial redacted view.
  for (const pid of room.players) {
    transport.send(pid, EVENTS.STATE_UPDATE, { view: viewFor(gameState, pid) });
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

  const result: MoveResult = applyMove(room.gameState, playerId, move);

  if (!result.ok) {
    ack({ ok: false, error: result.error, message: result.message });
    return;
  }

  // Move was valid. Update state.
  room.gameState = result.state;

  if (result.state.phase === 'GAME_OVER') {
    room.phase = 'DONE';
  }

  // Broadcast each game event to the room.
  for (const event of result.events as GameEvent[]) {
    transport.broadcast(roomCode, EVENTS.GAME_EVENT, { event });
  }

  // Unicast the updated view to every connected player in the room.
  for (const pid of room.players) {
    if (pid === playerId) continue; // Mover's view sent in ack below.
    transport.send(pid, EVENTS.STATE_UPDATE, { view: viewFor(result.state, pid) });
  }

  // Ack the mover with their redacted view.
  ack({ ok: true, view: viewFor(result.state, playerId) });
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

  transport.broadcast(roomCode, EVENTS.ROOM_UPDATE, {
    roomCode,
    players: [...room.players],
    hostId: room.hostId,
    phase: room.phase === 'PLAYING' ? 'PLAYING' : room.phase === 'DONE' ? 'DONE' : 'LOBBY',
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

function isJoinRoomPayload(v: unknown): v is { roomCode: string } {
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
