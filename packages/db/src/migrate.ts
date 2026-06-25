/**
 * Apply pending Drizzle SQL migrations against the configured database.
 * No-op when DATABASE_URL is unset (in-memory server mode).
 */

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb } from './db';
import {
  isPhase9SchemaReady,
  repairPhase9Schema,
  resolveMigrationsFolder,
} from './migrations';

export async function runMigrations(): Promise<void> {
  const db = getDb();
  if (!db) return;

  const folder = resolveMigrationsFolder();
  console.log(`[migrate] applying migrations from ${folder}`);

  try {
    await migrate(db, { migrationsFolder: folder });
  } catch (err) {
    console.error('[migrate] drizzle migrator failed:', err);
  }

  if (await isPhase9SchemaReady(db)) {
    console.log('[migrate] schema ready (phase 9 scoring columns present)');
    return;
  }

  console.warn('[migrate] phase 9 schema missing — running repair SQL');
  await repairPhase9Schema(db);

  if (!(await isPhase9SchemaReady(db))) {
    throw new Error('database schema is missing phase 9 scoring tables/columns after migration repair');
  }

  console.log('[migrate] phase 9 schema repair complete');
}
