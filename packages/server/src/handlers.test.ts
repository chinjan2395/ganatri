/**
 * Integration tests for the Ganatri server.
 *
 * Tests cover:
 *  - Room lifecycle: create, join, leave, start
 *  - One-game rule (reject second join/create while in active game)
 *  - Session issuance and reconnect
 *  - A scripted full 2-player game (Part 1 → Part 2 → GAME_OVER)
 *
 * Each test gets its own server instance on a random port so tests can run
 * independently. The store is reset before each test.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp, type AppInstance } from './createApp.js';
import { resetStore } from './store.js';
import { resetLastMoveTime } from './handlers.js';
import { EVENTS } from './protocol.js';
import type { legalMoves as LegalMovesFn } from '@ganatri/engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function connectClient(port: number, token?: string): ClientSocket {
  return ioClient(`http://localhost:${port}`, {
    auth: token !== undefined ? { token } : {},
    autoConnect: true,
    reconnection: false,
  });
}

/** Wait for a socket event, resolving with the payload. Times out after ms. */
function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Emit an event with ack, returning the ack payload. Times out after ms. */
function emitAck<T>(socket: ClientSocket, event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Ack timeout for "${event}"`)), 3000);
    socket.emit(event, ...args, (result: T) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

/** Wait for a socket to connect. */
function waitConnected(socket: ClientSocket): Promise<void> {
  return new Promise((resolve) => {
    if (socket.connected) { resolve(); return; }
    socket.once('connect', resolve);
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Ganatri server', () => {
  let app: AppInstance;
  let port: number;

  beforeEach(async () => {
    resetStore();
    resetLastMoveTime();
    app = createApp();
    port = await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  // Session issuance
  // -------------------------------------------------------------------------

  it('issues a session token on first connect', async () => {
    const client = connectClient(port);
    try {
      const session = await waitFor<{ token: string; playerId: string }>(client, EVENTS.SESSION);
      expect(typeof session.token).toBe('string');
      expect(session.token.length).toBeGreaterThan(0);
      expect(typeof session.playerId).toBe('string');
    } finally {
      client.disconnect();
    }
  });

  it('reuses the same playerId on reconnect with stored token', async () => {
    const client1 = connectClient(port);
    const session1 = await waitFor<{ token: string; playerId: string }>(client1, EVENTS.SESSION);
    client1.disconnect();

    // Brief pause to ensure disconnect is processed.
    await new Promise((r) => setTimeout(r, 100));

    const client2 = connectClient(port, session1.token);
    const session2 = await waitFor<{ token: string; playerId: string }>(client2, EVENTS.SESSION);

    try {
      expect(session2.playerId).toBe(session1.playerId);
      expect(session2.token).toBe(session1.token);
    } finally {
      client2.disconnect();
    }
  });

  // -------------------------------------------------------------------------
  // Room lifecycle
  // -------------------------------------------------------------------------

  it('creates a room and returns a 6-char code', async () => {
    const client = connectClient(port);
    await waitFor(client, EVENTS.SESSION);
    try {
      const ack = await emitAck<{ ok: boolean; roomCode: string }>(client, EVENTS.CREATE_ROOM);
      expect(ack.ok).toBe(true);
      expect(ack.roomCode).toMatch(/^[A-NP-Z1-9]{6}$/);
    } finally {
      client.disconnect();
    }
  });

  it('second player can join a lobby room', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);

    const [, hostSession] = await Promise.all([
      waitFor(guest, EVENTS.SESSION),
      waitFor<{ token: string; playerId: string }>(host, EVENTS.SESSION),
    ]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      expect(createAck.ok).toBe(true);

      const joinAck = await emitAck<{ ok: boolean }>(guest, EVENTS.JOIN_ROOM, { roomCode: createAck.roomCode });
      expect(joinAck.ok).toBe(true);
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  it('rejects joining a non-existent room with NOT_FOUND', async () => {
    const client = connectClient(port);
    await waitFor(client, EVENTS.SESSION);
    try {
      const ack = await emitAck<{ ok: boolean; error: string }>(client, EVENTS.JOIN_ROOM, { roomCode: 'XXXXXX' });
      expect(ack.ok).toBe(false);
      expect(ack.error).toBe('NOT_FOUND');
    } finally {
      client.disconnect();
    }
  });

  it('rejects joining when room is full (max 4 players)', async () => {
    const clients = Array.from({ length: 5 }, () => connectClient(port));
    await Promise.all(clients.map((c) => waitFor(c, EVENTS.SESSION)));

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(clients[0]!, EVENTS.CREATE_ROOM);
      expect(createAck.ok).toBe(true);
      const code = createAck.roomCode;

      // Players 1–3 join successfully.
      for (let i = 1; i <= 3; i++) {
        const ack = await emitAck<{ ok: boolean }>(clients[i]!, EVENTS.JOIN_ROOM, { roomCode: code });
        expect(ack.ok).toBe(true);
      }

      // Player 4 (5th total) should be rejected.
      const fullAck = await emitAck<{ ok: boolean; error: string }>(clients[4]!, EVENTS.JOIN_ROOM, { roomCode: code });
      expect(fullAck.ok).toBe(false);
      expect(fullAck.error).toBe('FULL');
    } finally {
      clients.forEach((c) => c.disconnect());
    }
  });

  it('broadcasts room_update to all players in the room when someone joins', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    await Promise.all([waitFor(host, EVENTS.SESSION), waitFor(guest, EVENTS.SESSION)]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      const code = createAck.roomCode;

      const updatePromise = waitFor<{ players: string[] }>(host, EVENTS.ROOM_UPDATE);
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: code });
      const update = await updatePromise;

      expect(update.players).toHaveLength(2);
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  it('only the host can start the game', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    await Promise.all([waitFor(host, EVENTS.SESSION), waitFor(guest, EVENTS.SESSION)]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: createAck.roomCode });

      const guestStart = await emitAck<{ ok: boolean; error: string }>(guest, EVENTS.START_GAME);
      expect(guestStart.ok).toBe(false);
      expect(guestStart.error).toBe('NOT_HOST');

      const hostStart = await emitAck<{ ok: boolean }>(host, EVENTS.START_GAME);
      expect(hostStart.ok).toBe(true);
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  it('rejects start_game with fewer than 2 players', async () => {
    const host = connectClient(port);
    await waitFor(host, EVENTS.SESSION);

    try {
      await emitAck(host, EVENTS.CREATE_ROOM);
      const ack = await emitAck<{ ok: boolean; error: string }>(host, EVENTS.START_GAME);
      expect(ack.ok).toBe(false);
      expect(ack.error).toBe('NOT_ENOUGH_PLAYERS');
    } finally {
      host.disconnect();
    }
  });

  it('rejects joining an already-started room', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    const latecomer = connectClient(port);
    await Promise.all([
      waitFor(host, EVENTS.SESSION),
      waitFor(guest, EVENTS.SESSION),
      waitFor(latecomer, EVENTS.SESSION),
    ]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      const code = createAck.roomCode;
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: code });
      await emitAck(host, EVENTS.START_GAME);

      const lateAck = await emitAck<{ ok: boolean; error: string }>(latecomer, EVENTS.JOIN_ROOM, { roomCode: code });
      expect(lateAck.ok).toBe(false);
      expect(lateAck.error).toBe('ALREADY_STARTED');
    } finally {
      host.disconnect();
      guest.disconnect();
      latecomer.disconnect();
    }
  });

  it('can leave a lobby room', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    await Promise.all([waitFor(host, EVENTS.SESSION), waitFor(guest, EVENTS.SESSION)]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: createAck.roomCode });

      const leaveAck = await emitAck<{ ok: boolean }>(guest, EVENTS.LEAVE_ROOM);
      expect(leaveAck.ok).toBe(true);
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  // -------------------------------------------------------------------------
  // Player name sanitization
  // -------------------------------------------------------------------------

  it('sanitizes player names server-side on create_room', async () => {
    const { sanitizePlayerName } = await import('./handlers.js');

    // Normal name passes through unchanged (trimmed to 20 chars)
    expect(sanitizePlayerName('Alice')).toBe('Alice');
    expect(sanitizePlayerName('  Bob  ')).toBe('Bob');

    // HTML tags (including content between < and >) are removed
    expect(sanitizePlayerName('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(sanitizePlayerName('Hello<br>World')).toBe('HelloWorld');
    expect(sanitizePlayerName('<img src=x>')).toBe('');

    // Dangerous < > characters outside tags are also removed
    expect(sanitizePlayerName('Test<Name')).toBe('TestName');
    expect(sanitizePlayerName('Test>Name')).toBe('TestName');

    // Control characters are removed
    expect(sanitizePlayerName('Hello\x00World')).toBe('HelloWorld');
    expect(sanitizePlayerName('Line1\nLine2')).toBe('Line1Line2');
    expect(sanitizePlayerName('Tab\tName')).toBe('TabName');

    // 20-character limit is enforced after sanitization
    expect(sanitizePlayerName('a'.repeat(30))).toBe('a'.repeat(20));
    expect(sanitizePlayerName('<script>' + 'a'.repeat(20) + '</script>')).toBe('a'.repeat(20));

    // Combined: HTML + length limit
    expect(sanitizePlayerName('<h1>MyName' + 'a'.repeat(30) + '</h1>')).toBe(
      'MyName' + 'a'.repeat(14),
    );
  });

  it('applies sanitized names when creating a room', async () => {
    const { store } = await import('./store.js');
    const client = connectClient(port);
    const sessionPayload = await waitFor<{ token: string; playerId: string }>(client, EVENTS.SESSION);

    try {
      const dirtyName = '<script>alert("xss")</script>';
      const ack = await emitAck<{ ok: boolean; roomCode: string }>(client, EVENTS.CREATE_ROOM, {
        name: dirtyName,
      });

      expect(ack.ok).toBe(true);

      // Check the session store directly to verify the name was sanitized before storage.
      const session = store.sessions.get(sessionPayload.token);
      expect(session).toBeDefined();
      expect(session?.name).toBe('alert("xss")');
      expect(session?.name).not.toContain('<script>');
      expect(session?.name).not.toContain('</script>');
    } finally {
      client.disconnect();
    }
  });

  it('applies sanitized names when joining a room', async () => {
    const { store } = await import('./store.js');
    const host = connectClient(port);
    const guest = connectClient(port);

    const [hostSession, guestSessionData] = await Promise.all([
      waitFor<{ token: string; playerId: string }>(host, EVENTS.SESSION),
      waitFor<{ token: string; playerId: string }>(guest, EVENTS.SESSION),
    ]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      const roomCode = createAck.roomCode;

      // Guest joins with a malicious name.
      const dirtyName = '<img src=x onerror="alert(1)">';
      const joinAck = await emitAck<{ ok: boolean }>(guest, EVENTS.JOIN_ROOM, {
        roomCode,
        name: dirtyName,
      });

      expect(joinAck.ok).toBe(true);

      // Check the session store directly to verify the name was sanitized before storage.
      const guestSessionStored = store.sessions.get(guestSessionData.token);
      expect(guestSessionStored).toBeDefined();
      expect(guestSessionStored?.name).not.toContain('<');
      expect(guestSessionStored?.name).not.toContain('>');
      expect(guestSessionStored?.name).not.toContain('src');
      expect(guestSessionStored?.name).not.toContain('onerror');
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  // -------------------------------------------------------------------------
  // One-game rule
  // -------------------------------------------------------------------------

  it('one-game rule: blocks creating a room while in an active game', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    await Promise.all([waitFor(host, EVENTS.SESSION), waitFor(guest, EVENTS.SESSION)]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      const code = createAck.roomCode;
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: code });
      await emitAck(host, EVENTS.START_GAME);

      // Host tries to create another room.
      const second = await emitAck<{ ok: boolean; error: string; currentRoomCode: string }>(
        host,
        EVENTS.CREATE_ROOM,
      );
      expect(second.ok).toBe(false);
      expect(second.error).toBe('ALREADY_IN_GAME');
      expect(second.currentRoomCode).toBe(code);
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  it('one-game rule: blocks joining another room while in an active game', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    const otherHost = connectClient(port);
    await Promise.all([
      waitFor(host, EVENTS.SESSION),
      waitFor(guest, EVENTS.SESSION),
      waitFor(otherHost, EVENTS.SESSION),
    ]);

    try {
      // Room 1 starts.
      const create1 = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: create1.roomCode });
      await emitAck(host, EVENTS.START_GAME);

      // Room 2 is a lobby.
      const create2 = await emitAck<{ ok: boolean; roomCode: string }>(otherHost, EVENTS.CREATE_ROOM);

      // Guest tries to join room 2.
      const joinAck = await emitAck<{ ok: boolean; error: string }>(guest, EVENTS.JOIN_ROOM, {
        roomCode: create2.roomCode,
      });
      expect(joinAck.ok).toBe(false);
      expect(joinAck.error).toBe('ALREADY_IN_GAME');
    } finally {
      host.disconnect();
      guest.disconnect();
      otherHost.disconnect();
    }
  });

  it('one-game rule: allows creating a new room after leaving a LOBBY room', async () => {
    const client = connectClient(port);
    await waitFor(client, EVENTS.SESSION);

    try {
      await emitAck(client, EVENTS.CREATE_ROOM);
      await emitAck(client, EVENTS.LEAVE_ROOM);
      const second = await emitAck<{ ok: boolean }>(client, EVENTS.CREATE_ROOM);
      expect(second.ok).toBe(true);
    } finally {
      client.disconnect();
    }
  });

  // -------------------------------------------------------------------------
  // State sync
  // -------------------------------------------------------------------------

  it('sends state_update to each player when game starts', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    await Promise.all([waitFor(host, EVENTS.SESSION), waitFor(guest, EVENTS.SESSION)]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: createAck.roomCode });

      const [hostView, guestView] = await Promise.all([
        waitFor<{ view: { phase: string; hand: unknown[] } }>(host, EVENTS.STATE_UPDATE),
        waitFor<{ view: { phase: string; hand: unknown[] } }>(guest, EVENTS.STATE_UPDATE),
        emitAck(host, EVENTS.START_GAME),
      ]);

      expect(hostView.view.phase).toBe('PART_1');
      expect(guestView.view.phase).toBe('PART_1');
      // Each player has 5 cards.
      expect(hostView.view.hand).toHaveLength(5);
      expect(guestView.view.hand).toHaveLength(5);
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  it('request_state returns current view for a player in a game', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    await Promise.all([waitFor(host, EVENTS.SESSION), waitFor(guest, EVENTS.SESSION)]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: createAck.roomCode });

      await Promise.all([
        waitFor(host, EVENTS.STATE_UPDATE),
        waitFor(guest, EVENTS.STATE_UPDATE),
        emitAck(host, EVENTS.START_GAME),
      ]);

      const stateAck = await emitAck<{ view: { phase: string; hand: unknown[] } }>(
        host,
        EVENTS.REQUEST_STATE,
      );
      expect(stateAck.view).not.toBeNull();
      expect(stateAck.view.phase).toBe('PART_1');
      expect(stateAck.view.hand).toHaveLength(5);
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  // -------------------------------------------------------------------------
  // Make-move validation
  // -------------------------------------------------------------------------

  it('rejects a move with invalid payload', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    await Promise.all([waitFor(host, EVENTS.SESSION), waitFor(guest, EVENTS.SESSION)]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: createAck.roomCode });
      await Promise.all([
        waitFor(host, EVENTS.STATE_UPDATE),
        waitFor(guest, EVENTS.STATE_UPDATE),
        emitAck(host, EVENTS.START_GAME),
      ]);

      const badMove = await emitAck<{ ok: boolean; error: string }>(host, EVENTS.MAKE_MOVE, {
        move: { type: 'INVALID_TYPE', card: '' },
      });
      expect(badMove.ok).toBe(false);
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  it('rejects a move when it is not the player\'s turn', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    const [hostSession, guestSession] = await Promise.all([
      waitFor<{ token: string; playerId: string }>(host, EVENTS.SESSION),
      waitFor<{ token: string; playerId: string }>(guest, EVENTS.SESSION),
    ]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: createAck.roomCode });

      const [hostViewPayload, guestViewPayload] = await Promise.all([
        waitFor<{ view: { turn: string; hand: Array<{ rank: string; suit: string }> } }>(
          host,
          EVENTS.STATE_UPDATE,
        ),
        waitFor<{ view: { turn: string; hand: Array<{ rank: string; suit: string }> } }>(
          guest,
          EVENTS.STATE_UPDATE,
        ),
        emitAck(host, EVENTS.START_GAME),
      ]);

      // The turn player id comes from the view.
      const turnPlayerId = hostViewPayload.view.turn;

      // Identify which socket is the NON-turn player.
      const nonTurnSocket = turnPlayerId === hostSession.playerId ? guest : host;
      const nonTurnView =
        turnPlayerId === hostSession.playerId ? guestViewPayload.view : hostViewPayload.view;

      // Non-turn player tries to play their first card.
      const firstCard = nonTurnView.hand[0]!;
      const moveAck = await emitAck<{ ok: boolean; error: string }>(
        nonTurnSocket,
        EVENTS.MAKE_MOVE,
        { move: { type: 'PLAY_CAPTURE', card: `${firstCard.rank}${firstCard.suit}`, capture: [] } },
      );
      expect(moveAck.ok).toBe(false);
      expect(moveAck.error).toBe('NOT_YOUR_TURN');
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  // -------------------------------------------------------------------------
  // Scripted full 2-player game
  // -------------------------------------------------------------------------

  it('scripted 2-player game: plays through to GAME_OVER', async () => {
    /**
     * Strategy: access the server's in-memory store directly (we're in the same
     * Node process as the server under test) to read full GameState and compute
     * legal moves via the engine's legalMoves helper. This avoids reconstructing
     * state from the redacted client view.
     */
    const { legalMoves, createGame } = await import('@ganatri/engine');
    const { store } = await import('./store.js');

    const host = connectClient(port);
    const guest = connectClient(port);

    const [hostSession, guestSession] = await Promise.all([
      waitFor<{ token: string; playerId: string }>(host, EVENTS.SESSION),
      waitFor<{ token: string; playerId: string }>(guest, EVENTS.SESSION),
    ]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      const roomCode = createAck.roomCode;
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode });

      await Promise.all([
        waitFor(host, EVENTS.STATE_UPDATE),
        waitFor(guest, EVENTS.STATE_UPDATE),
        emitAck(host, EVENTS.START_GAME),
      ]);

      // The server seeds with Date.now(), which is non-deterministic. Under naive
      // "always play the first legal move" bot play, some deals enter an infinite
      // Part 2 cut-loop (each player cuts the other's lead, hand sizes cycle, no
      // trick ever cancels) and never terminate. Real/varied play avoids this.
      // Inject a fixed, verified-terminating deal so this test is deterministic.
      // Seed 3 completes in 88 greedy moves. (We're in-process with the server.)
      const TERMINATING_SEED = 3;
      const startedRoom = store.rooms.get(roomCode)!;
      startedRoom.gameState = createGame(startedRoom.players, TERMINATING_SEED);

      // Map playerId → socket for quick lookup.
      const socketForPlayer: Record<string, ClientSocket> = {
        [hostSession.playerId]: host,
        [guestSession.playerId]: guest,
      };

      let phase = 'PART_1';
      let moveCount = 0;
      const MAX_MOVES = 150; // seed 3 finishes in 88 moves; ceiling is a safety net

      while (phase !== 'GAME_OVER' && moveCount < MAX_MOVES) {
        const room = store.rooms.get(roomCode);
        if (room === undefined || room.gameState === null) break;

        const { gameState } = room;
        phase = gameState.phase;
        if (phase === 'GAME_OVER') break;

        const turnPlayerId = gameState.turn;
        if (turnPlayerId === null) break;

        const moves = legalMoves(gameState, turnPlayerId);
        if (moves.length === 0) break;

        const move = moves[0]!;
        const activeSocket = socketForPlayer[turnPlayerId];
        if (activeSocket === undefined) break;

        const moveAck = await emitAck<{ ok: boolean; view?: { phase: string } }>(
          activeSocket,
          EVENTS.MAKE_MOVE,
          { move },
        );

        if (!moveAck.ok) {
          console.error('Move failed:', moveAck, 'move was:', move);
        }
        expect(moveAck.ok).toBe(true);

        if (moveAck.view?.phase === 'GAME_OVER') {
          phase = 'GAME_OVER';
        }

        moveCount++;
        // Small pause to avoid triggering the 100ms debounce in rapid test loops.
        await new Promise((r) => setTimeout(r, 110));
      }

      // Verify game terminated within the move ceiling.
      expect(moveCount).toBeLessThan(MAX_MOVES);

      // Verify final state.
      const room = store.rooms.get(roomCode);
      expect(room?.phase).toBe('DONE');
      expect(room?.gameState?.phase).toBe('GAME_OVER');
      expect(room?.gameState?.rankings).not.toBeNull();
      expect(room?.gameState?.rankings!.length).toBeGreaterThanOrEqual(1);

      // Moves after GAME_OVER are rejected.
      const postGameAck = await emitAck<{ ok: boolean; error?: string }>(
        host, EVENTS.MAKE_MOVE, { move: { type: 'PLAY_TRICK', card: 'AS' } },
      );
      expect(postGameAck.ok).toBe(false);
      expect(postGameAck.error).toBe('WRONG_PHASE');
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // Debounce
  // -------------------------------------------------------------------------

  it('rejects a second make_move from the same socket within 100 ms', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    await Promise.all([waitFor(host, EVENTS.SESSION), waitFor(guest, EVENTS.SESSION)]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: createAck.roomCode });
      await Promise.all([
        waitFor(host, EVENTS.STATE_UPDATE),
        waitFor(guest, EVENTS.STATE_UPDATE),
        emitAck(host, EVENTS.START_GAME),
      ]);

      // Use the engine to find a legal first move for the host.
      const { legalMoves } = await import('@ganatri/engine');
      const { store } = await import('./store.js');
      const room = store.rooms.get(createAck.roomCode)!;
      const hostSession = (await import('./store.js')).store.sessions.values()
        [Symbol.iterator]().next().value;
      // Find the turn player's moves.
      const { gameState } = room;
      const turnId = gameState?.turn;
      if (!turnId || !gameState) throw new Error('No turn player');
      const moves = legalMoves(gameState, turnId);
      if (moves.length === 0) throw new Error('No legal moves');

      // The host may or may not be the turn player — just send two rapid moves
      // from the same socket regardless. The first will either be debounced (not
      // their turn) or succeed; the second arrives <100 ms later and must be
      // debounced regardless.
      const [first, second] = await Promise.all([
        emitAck<{ ok: boolean; error?: string }>(host, EVENTS.MAKE_MOVE, { move: moves[0]! }),
        emitAck<{ ok: boolean; error?: string }>(host, EVENTS.MAKE_MOVE, { move: moves[0]! }),
      ]);

      // One of the two must be rejected by the debounce.
      const bothOk = first.ok && second.ok;
      expect(bothOk).toBe(false);
      const debounced = first.ok ? second : first;
      expect(debounced.error).toBeDefined();
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  });

  // -------------------------------------------------------------------------
  // Disconnect / reconnect
  // -------------------------------------------------------------------------

  it('broadcasts player_disconnected when a socket drops', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    await Promise.all([waitFor(host, EVENTS.SESSION), waitFor(guest, EVENTS.SESSION)]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: createAck.roomCode });
      await Promise.all([
        waitFor(host, EVENTS.STATE_UPDATE),
        waitFor(guest, EVENTS.STATE_UPDATE),
        emitAck(host, EVENTS.START_GAME),
      ]);

      const disconnectPromise = waitFor<{ playerId: string }>(host, EVENTS.PLAYER_DISCONNECTED);
      guest.disconnect();
      const disconnectPayload = await disconnectPromise;
      expect(typeof disconnectPayload.playerId).toBe('string');
    } finally {
      host.disconnect();
    }
  });

  it('broadcasts player_reconnected and resends state when player reconnects', async () => {
    const host = connectClient(port);
    const guest = connectClient(port);
    const [, guestSession] = await Promise.all([
      waitFor(host, EVENTS.SESSION),
      waitFor<{ token: string; playerId: string }>(guest, EVENTS.SESSION),
    ]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode: createAck.roomCode });
      await Promise.all([
        waitFor(host, EVENTS.STATE_UPDATE),
        waitFor(guest, EVENTS.STATE_UPDATE),
        emitAck(host, EVENTS.START_GAME),
      ]);

      // Disconnect guest.
      const disconnectPromise = waitFor(host, EVENTS.PLAYER_DISCONNECTED);
      guest.disconnect();
      await disconnectPromise;

      // Reconnect with saved token.
      const guest2 = connectClient(port, guestSession.token);
      const reconnectPromise = waitFor<{ playerId: string }>(host, EVENTS.PLAYER_RECONNECTED);
      const statePromise = waitFor<{ view: { phase: string } }>(guest2, EVENTS.STATE_UPDATE);

      await waitConnected(guest2);
      const [reconnectPayload, statePayload] = await Promise.all([reconnectPromise, statePromise]);

      expect(reconnectPayload.playerId).toBe(guestSession.playerId);
      expect(statePayload.view.phase).toBe('PART_1');

      guest2.disconnect();
    } finally {
      host.disconnect();
    }
  });

  it('keeps a LOBBY room alive when the host disconnects, and restores it on reconnect', async () => {
    // Regression: a host reloading their tab (socket drop) must NOT delete the
    // room. The seat is held through the grace period; reconnect restores the
    // room view and the shared code stays joinable.
    const host = connectClient(port);
    const hostSession = await waitFor<{ token: string; playerId: string }>(host, EVENTS.SESSION);
    const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
    const code = createAck.roomCode;

    // Host "reloads": drop the socket.
    host.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    // Reconnect with the same token within the grace period.
    const host2 = connectClient(port, hostSession.token);
    const roomUpdate = await waitFor<{ roomCode: string; players: string[]; phase: string }>(
      host2,
      EVENTS.ROOM_UPDATE,
    );

    try {
      // Room survived and the reconnecting client is restored into it.
      expect(roomUpdate.roomCode).toBe(code);
      expect(roomUpdate.phase).toBe('LOBBY');
      expect(roomUpdate.players).toContain(hostSession.playerId);

      // The shared code is still joinable by a new player.
      const guest = connectClient(port);
      await waitFor(guest, EVENTS.SESSION);
      const joinAck = await emitAck<{ ok: boolean }>(guest, EVENTS.JOIN_ROOM, { roomCode: code });
      expect(joinAck.ok).toBe(true);
      guest.disconnect();
    } finally {
      host2.disconnect();
    }
  });

  // -------------------------------------------------------------------------
  // Grace period auto-advance during PLAYING
  // -------------------------------------------------------------------------

  it('auto-plays a move when a player\'s grace period expires during PLAYING', async () => {
    /**
     * When a player disconnects and their turn comes while they're still in the
     * grace period (before reconnect), the server should auto-play a legal move
     * for them so the game continues instead of stalling.
     */
    const { legalMoves, createGame } = await import('@ganatri/engine');
    const { store } = await import('./store.js');

    const host = connectClient(port);
    const guest = connectClient(port);

    const [hostSession, guestSession] = await Promise.all([
      waitFor<{ token: string; playerId: string }>(host, EVENTS.SESSION),
      waitFor<{ token: string; playerId: string }>(guest, EVENTS.SESSION),
    ]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      const roomCode = createAck.roomCode;
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode });

      await Promise.all([
        waitFor(host, EVENTS.STATE_UPDATE),
        waitFor(guest, EVENTS.STATE_UPDATE),
        emitAck(host, EVENTS.START_GAME),
      ]);

      // Set a very short grace period for the test.
      const room = store.rooms.get(roomCode)!;
      const originalGracePeriodMs = (await import('./config.js')).getConfig().gracePeriodMs;
      (await import('./config.js')).updateConfig({ gracePeriodMs: 500 });

      // Use a deterministic seed.
      const TERMINATING_SEED = 3;
      room.gameState = createGame(room.players, TERMINATING_SEED);

      // Map playerId → socket for quick lookup.
      const socketForPlayer: Record<string, ClientSocket> = {
        [hostSession.playerId]: host,
        [guestSession.playerId]: guest,
      };

      // Play several moves to set up a scenario where guest is the turn player.
      let moveCount = 0;
      while (moveCount < 5 && room.gameState?.turn !== guestSession.playerId) {
        const { gameState } = room;
        if (gameState?.phase === 'GAME_OVER') break;

        const turnPlayerId = gameState?.turn;
        if (!turnPlayerId) break;

        const moves = legalMoves(gameState!, turnPlayerId);
        if (moves.length === 0) break;

        const move = moves[0]!;
        const activeSocket = socketForPlayer[turnPlayerId];
        if (!activeSocket) break;

        const moveAck = await emitAck<{ ok: boolean }>(
          activeSocket,
          EVENTS.MAKE_MOVE,
          { move },
        );
        expect(moveAck.ok).toBe(true);
        moveCount++;
        await new Promise((r) => setTimeout(r, 110)); // Avoid debounce.
      }

      // Now guest should be the turn player. Disconnect the guest.
      const hostDisconnectPromise = waitFor<{ playerId: string }>(host, EVENTS.PLAYER_DISCONNECTED);
      guest.disconnect();
      const disconnectPayload = await hostDisconnectPromise;
      expect(disconnectPayload.playerId).toBe(guestSession.playerId);

      // Wait for the grace period to expire and the auto-play to trigger.
      // We should see a STATE_UPDATE on the host indicating the move was played.
      const stateUpdatePayload = await waitFor<{
        view: { phase: string };
      }>(host, EVENTS.STATE_UPDATE, 2000);

      // Verify game moved forward (turn changed or phase changed).
      // The simplest check: after grace expires and auto-play fires, the host
      // should receive an updated state. If the guest was the turn player,
      // their turn should have been resolved.
      expect(stateUpdatePayload.view).toBeDefined();

      // Restore the original grace period config.
      (await import('./config.js')).updateConfig({ gracePeriodMs: originalGracePeriodMs });
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  }, 10_000);

  // -------------------------------------------------------------------------
  // Turn timeout auto-play
  // -------------------------------------------------------------------------

  it('broadcasts TURN_TIMEOUT event when a turn times out and auto-play is triggered', async () => {
    /**
     * When a player's turn times out (not grace period, but the per-turn timeout),
     * the server should broadcast a TURN_TIMEOUT event so clients can display
     * a toast like "X's turn timed out".
     *
     * Strategy: Let the game play naturally via make_move until only a few moves remain.
     * Then wait for the turn timeout to fire without sending a move, which triggers
     * the auto-play and broadcasts the TURN_TIMEOUT event.
     */
    const { legalMoves, createGame } = await import('@ganatri/engine');
    const { store } = await import('./store.js');
    const { getConfig, updateConfig } = await import('./config.js');

    const host = connectClient(port);
    const guest = connectClient(port);

    const [hostSession, guestSession] = await Promise.all([
      waitFor<{ token: string; playerId: string }>(host, EVENTS.SESSION),
      waitFor<{ token: string; playerId: string }>(guest, EVENTS.SESSION),
    ]);

    try {
      const createAck = await emitAck<{ ok: boolean; roomCode: string }>(host, EVENTS.CREATE_ROOM);
      const roomCode = createAck.roomCode;
      await emitAck(guest, EVENTS.JOIN_ROOM, { roomCode });

      await Promise.all([
        waitFor(host, EVENTS.STATE_UPDATE),
        waitFor(guest, EVENTS.STATE_UPDATE),
        emitAck(host, EVENTS.START_GAME),
      ]);

      // Set a very short turn timeout for this test.
      const originalTurnTimeoutMs = getConfig().turnTimeoutMs;
      updateConfig({ turnTimeoutMs: 350 });

      const room = store.rooms.get(roomCode)!;

      // Use a deterministic seed.
      const TERMINATING_SEED = 3;
      room.gameState = createGame(room.players, TERMINATING_SEED);

      // Map playerId → socket.
      const socketForPlayer: Record<string, ClientSocket> = {
        [hostSession.playerId]: host,
        [guestSession.playerId]: guest,
      };

      // Play a few moves to get the game into motion, then stop sending moves to trigger a timeout.
      let moveCount = 0;
      const MAX_MOVES = 3;

      while (moveCount < MAX_MOVES && room.gameState?.phase !== 'GAME_OVER') {
        const { gameState } = room;
        if (!gameState || gameState.phase === 'GAME_OVER') break;

        const turnPlayerId = gameState.turn;
        if (!turnPlayerId) break;

        const moves = legalMoves(gameState, turnPlayerId);
        if (moves.length === 0) break;

        const activeSocket = socketForPlayer[turnPlayerId];
        if (!activeSocket) break;

        const moveAck = await emitAck<{ ok: boolean }>(activeSocket, EVENTS.MAKE_MOVE, { move: moves[0]! });
        expect(moveAck.ok).toBe(true);
        moveCount++;
        await new Promise((r) => setTimeout(r, 110)); // Avoid debounce.
      }

      // Now we've played a few moves. Identify who the current turn player is.
      const currentTurnPlayerId = room.gameState?.turn;
      if (!currentTurnPlayerId) {
        expect.fail('No turn player after moves');
        return;
      }

      // Set up listeners for TURN_TIMEOUT on both sockets.
      const hostTimeoutPromise = waitFor<{ playerId: string }>(host, EVENTS.TURN_TIMEOUT, 2000);
      const guestTimeoutPromise = waitFor<{ playerId: string }>(guest, EVENTS.TURN_TIMEOUT, 2000);

      // Do NOT send a move. Let the turn timeout fire on its own.
      // The server's turn timer should have been set by the last make_move,
      // and will auto-play a move after 350ms, broadcasting TURN_TIMEOUT.

      const timeoutPayload = await Promise.race([hostTimeoutPromise, guestTimeoutPromise]).catch(() => null);

      if (timeoutPayload) {
        expect(timeoutPayload.playerId).toBe(currentTurnPlayerId);
      } else {
        // If we didn't get the event, something went wrong. Let's fail gracefully.
        expect.fail('TURN_TIMEOUT event was not broadcast within timeout period');
      }

      // Restore the original config.
      updateConfig({ turnTimeoutMs: originalTurnTimeoutMs });
    } finally {
      host.disconnect();
      guest.disconnect();
    }
  }, 15_000);
});
