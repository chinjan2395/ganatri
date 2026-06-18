/**
 * Pooled PostgreSQL client for Ganatri (node-postgres + Drizzle).
 *
 * The server can run without a DB (in-memory mode). When `DATABASE_URL` is set
 * we lazily build a single Drizzle client over a `pg.Pool`. Nothing connects at
 * import time, so importing this module is always safe.
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

let _pool: Pool | null = null;
let _db: Database | null = null;

/**
 * Get or lazily initialize the Drizzle client.
 * Returns `null` when `DATABASE_URL` is unset (in-memory mode).
 */
export function getDb(): Database | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!_db) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
    _db = drizzle(_pool, { schema });
  }
  return _db;
}

/**
 * Health check: runs `SELECT 1`. Returns `false` if the DB is unconfigured or
 * the query fails.
 */
export async function ping(): Promise<boolean> {
  const db = getDb();
  if (!db) {
    return false;
  }
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

/** Close the underlying pool and reset the singleton (for shutdown / tests). */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
  }
  _pool = null;
  _db = null;
}
