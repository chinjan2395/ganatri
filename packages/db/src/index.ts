/**
 * @ganatri/db — database schema and store interface.
 *
 * Public exports:
 * - Schema tables (users, rooms, games, etc.) for type inference.
 * - GameStore interface (contract for server implementations).
 * - DB client (Drizzle-backed).
 */

export { db, ping } from './db';
export type { GameStore, SessionData, RoomData } from './store';
export {
  users,
  rooms,
  games,
  gamePlayers,
  gameEvents,
  playerStats,
  roomStatusEnum,
  gameEventTypeEnum,
} from './schema';
