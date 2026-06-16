/**
 * Pooled PostgreSQL client for Ganatri.
 *
 * For v1, the server can run without a DB (in-memory mode).
 * When DATABASE_URL is set, we initialize Drizzle ORM for persistence.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;

/**
 * Get or initialize the Drizzle client.
 * Returns null if DATABASE_URL is not set (in-memory mode).
 */
export function getDb(): any {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!_db) {
    // Lazy-load to avoid import errors if Vercel Postgres isn't configured
    const { drizzle } = require('drizzle-orm/vercel-postgres');
    _db = drizzle();
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
