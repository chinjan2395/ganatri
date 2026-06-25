/**
 * Apply pending Drizzle SQL migrations against the configured database.
 * No-op when DATABASE_URL is unset (in-memory server mode).
 */

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDb } from './db';

const MIGRATIONS_FOLDER = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');

export async function runMigrations(): Promise<void> {
  const db = getDb();
  if (!db) return;
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
