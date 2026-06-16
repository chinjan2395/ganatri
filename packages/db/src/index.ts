/**
 * @ganatri/db — Database package
 *
 * Exports:
 * - Drizzle ORM database client (getDb, getDatabase, closeDatabase)
 * - All schema tables and their types
 * - Migration runner (migrate.ts — run via npm run db:migrate)
 *
 * Usage in server handlers:
 *   import { getDb, users, games } from "@ganatri/db";
 *   const db = getDb();
 *   const allUsers = await db.select().from(users);
 */

export { getDb, getDatabase, closeDatabase } from "./db";
export * from "./schema";
