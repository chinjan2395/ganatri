import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Database connection with connection pooling.
 * Uses DATABASE_URL from environment for production and local dev via docker-compose.
 */
function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Set it in your .env file or environment variables. " +
        "For local dev, run: npm run db:up && npm run db:migrate"
    );
  }

  // Create a connection pool
  const pool = new Pool({
    connectionString: databaseUrl,
    // Pool size: start with 10 connections for a single Render instance
    // Increase as needed for horizontal scaling (Phase 7g)
    max: parseInt(process.env.DATABASE_POOL_SIZE || "10"),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
    process.exit(-1);
  });

  const db = drizzle(pool, { schema });

  return { db, pool };
}

let dbInstance: ReturnType<typeof createDatabase> | null = null;

/**
 * Get or create the shared database instance.
 * Ensures only one pool is created across the application.
 */
export function getDatabase() {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

/**
 * Get the Drizzle ORM instance (db object).
 * Use this for queries throughout the server.
 */
export function getDb() {
  return getDatabase().db;
}

/**
 * Close the database connection pool.
 * Call this when shutting down the server.
 */
export async function closeDatabase() {
  if (dbInstance) {
    await dbInstance.pool.end();
    dbInstance = null;
  }
}

// Export schema for use in migrations and type inference
export * from "./schema";
