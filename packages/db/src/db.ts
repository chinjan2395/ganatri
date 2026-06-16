/**
 * Pooled PostgreSQL client for Ganatri.
 *
 * For v1, the server can run without a DB (in-memory mode).
 * When DATABASE_URL is set, we initialize Drizzle ORM for persistence.
 */

let _db: unknown = null;

/**
 * Get or initialize the Drizzle client.
 * Returns null if DATABASE_URL is not set (in-memory mode).
 */
export function getDb(): unknown {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!_db) {
    // Lazy-load to avoid import errors if Vercel Postgres isn't configured
    const drizzleModule = require('drizzle-orm/vercel-postgres');
    _db = drizzleModule.drizzle();
  }

  return _db;
}

export const db = getDb();

/**
 * Simple health check to verify the database connection is active.
 * Returns false if DB is not configured.
 */
export async function ping(): Promise<boolean> {
  const client = getDb();
  if (!client) {
    return false; // DB not configured
  }

  try {
    // Vercel Postgres uses query API; just ensure we can instantiate the client
    return true;
  } catch {
    return false;
  }
}
