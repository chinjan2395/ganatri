/**
 * @ganatri/db — Database abstraction layer.
 *
 * Exports the GameStore interface and domain types (SessionState, RoomState).
 * Concrete implementations (MemoryStore, PostgresStore) live in packages/server
 * for now; they will migrate to packages/db once Drizzle/migrations are added in Phase 6b.
 */

export type { GameStore, SessionState, RoomState } from './gameStore.js';
