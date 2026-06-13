/**
 * GameTransport interface.
 *
 * All networking is hidden behind this interface so a future LAN/offline
 * transport can be plugged in without touching game logic.
 */

import type { Move, MoveResult } from '@ganatri/engine';

export interface GameTransport {
  /** Send an event to a single connected player. */
  send(playerId: string, event: string, data: unknown): void;

  /** Broadcast an event to every socket in a room (including sender). */
  broadcast(roomCode: string, event: string, data: unknown): void;

  /** Register a handler invoked when a player's socket joins a room. */
  onPlayerJoin(handler: (playerId: string, roomCode: string) => void): void;

  /** Register a handler invoked when a player's socket disconnects. */
  onPlayerLeave(handler: (playerId: string) => void): void;

  /**
   * Register a handler for incoming move intents.
   * The handler must call `ack` exactly once with the result.
   */
  onMove(handler: (playerId: string, move: Move, ack: (result: MoveResult) => void) => void): void;
}
