/**
 * Database configuration and initialization.
 *
 * Reads environment variables to determine:
 * - Which store implementation to use (memory or postgres)
 * - Connection parameters (database URL, pool size)
 *
 * In Phase 6b, this will be used to instantiate the correct store
 * (MemoryStore or PostgresStore). For now, only MemoryStore is available.
 */

/**
 * DatabaseConfig interface defines the configuration options for the store.
 */
export interface DatabaseConfig {
  /** The store engine: 'memory' (default) or 'postgres' */
  engine: 'memory' | 'postgres';
  /** PostgreSQL connection URL (required if engine is 'postgres') */
  postgresUrl?: string;
  /** Connection pool size (default: 10) */
  poolSize?: number;
}

/**
 * Get the database configuration from environment variables.
 *
 * Environment variables:
 * - STORE_ENGINE: 'memory' (default) or 'postgres'
 * - DATABASE_URL: Postgres connection string (required if STORE_ENGINE='postgres')
 * - DATABASE_POOL_SIZE: Connection pool size (default: 10)
 *
 * Returns the parsed DatabaseConfig.
 */
export function getDatabaseConfig(): DatabaseConfig {
  const engine = (process.env.STORE_ENGINE || 'memory') as 'memory' | 'postgres';
  const postgresUrl = process.env.DATABASE_URL;
  const poolSize = process.env.DATABASE_POOL_SIZE ? parseInt(process.env.DATABASE_POOL_SIZE, 10) : 10;

  // Validate: if postgres is selected, DATABASE_URL must be provided
  if (engine === 'postgres' && !postgresUrl) {
    throw new Error('DATABASE_URL environment variable is required when STORE_ENGINE=postgres');
  }

  return {
    engine,
    postgresUrl,
    poolSize,
  };
}
