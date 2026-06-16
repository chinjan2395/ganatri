/**
 * Socket.io implementation of GameTransport.
 *
 * This module is the only file that imports from 'socket.io'. Game logic
 * in handlers.ts only depends on the GameTransport interface, keeping the
 * transport swappable.
 */

import type { Server, Socket } from 'socket.io';
import type { Move, MoveResult } from '@ganatri/engine';
import type { GameTransport } from './transport.js';
import { getSession, getSessionByPlayerId } from './memoryStore.js';

export class SocketTransport implements GameTransport {
  private readonly io: Server;

  // Event handler registrations
  private joinHandler: ((playerId: string, roomCode: string) => void) | null = null;
  private leaveHandler: ((playerId: string) => void) | null = null;
  private moveHandler: ((playerId: string, move: Move, ack: (result: MoveResult) => void) => void) | null = null;

  constructor(io: Server) {
    this.io = io;
  }

  send(playerId: string, event: string, data: unknown): void {
    const session = getSessionByPlayerId(playerId);
    if (session?.socketId != null) {
      this.io.to(session.socketId).emit(event, data);
    }
  }

  broadcast(roomCode: string, event: string, data: unknown): void {
    this.io.to(roomCode).emit(event, data);
  }

  onPlayerJoin(handler: (playerId: string, roomCode: string) => void): void {
    this.joinHandler = handler;
  }

  onPlayerLeave(handler: (playerId: string) => void): void {
    this.leaveHandler = handler;
  }

  onMove(handler: (playerId: string, move: Move, ack: (result: MoveResult) => void) => void): void {
    this.moveHandler = handler;
  }

  /**
   * Called by setupSocketHandlers to wire up a newly connected socket.
   * This keeps socket-level wiring in the transport while business logic
   * lives in handlers.ts.
   */
  wireSocket(socket: Socket): void {
    socket.on('move_internal', (playerId: string, move: Move, ack: (result: MoveResult) => void) => {
      this.moveHandler?.(playerId, move, ack);
    });
  }

  /**
   * Make a socket join a Socket.io room so it receives broadcasts.
   */
  joinRoom(socketId: string, roomCode: string): void {
    const socket = this.io.sockets.sockets.get(socketId);
    socket?.join(roomCode);
  }

  /**
   * Make a socket leave a Socket.io room.
   */
  leaveRoom(socketId: string, roomCode: string): void {
    const socket = this.io.sockets.sockets.get(socketId);
    socket?.leave(roomCode);
  }

  /**
   * Notify the registered join handler (called from handlers.ts after
   * the session/room wiring is done).
   */
  notifyJoin(playerId: string, roomCode: string): void {
    this.joinHandler?.(playerId, roomCode);
  }

  /**
   * Notify the registered leave handler (called from disconnect logic).
   */
  notifyLeave(playerId: string): void {
    this.leaveHandler?.(playerId);
  }

  /**
   * Resolve the Socket object for a given session token (used by handlers.ts
   * to avoid importing socket.io directly).
   */
  getSocketForToken(token: string): Socket | undefined {
    const session = getSession(token);
    if (session?.socketId == null) return undefined;
    return this.io.sockets.sockets.get(session.socketId);
  }

  /**
   * Get the underlying io server (used to access room membership for
   * operations that need all sockets in a room — kept minimal).
   */
  getIO(): Server {
    return this.io;
  }
}
