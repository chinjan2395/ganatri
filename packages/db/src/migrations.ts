/**
 * Migration helpers shared by tests and production startup.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import type { Database } from './db';

const require = createRequire(import.meta.url);

/** Resolve the drizzle SQL folder for both local dev and deployed monorepos. */
export function resolveMigrationsFolder(): string {
  const fromSrc = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
  if (existsSync(fromSrc)) return fromSrc;

  try {
    const pkgJson = require.resolve('@ganatri/db/package.json');
    const fromPkg = join(dirname(pkgJson), 'drizzle');
    if (existsSync(fromPkg)) return fromPkg;
  } catch {
    // package.json subpath may be unavailable in workspace dev; src path is enough.
  }

  throw new Error(`migrations folder not found (tried ${fromSrc})`);
}

/** All generated migration SQL files, sorted by filename (apply order). */
export function migrationPaths(): string[] {
  const dir = resolveMigrationsFolder();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    throw new Error(`no migration .sql files found in ${dir}`);
  }
  return files.map((f) => join(dir, f));
}

export function readMigrationFile(filename: string): string {
  const path = join(resolveMigrationsFolder(), filename);
  if (!existsSync(path)) {
    throw new Error(`migration file not found: ${path}`);
  }
  return readFileSync(path, 'utf8');
}

export function splitMigrationStatements(sqlText: string): string[] {
  return sqlText
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** True when Phase 9 scoring columns/tables are present. */
export async function isPhase9SchemaReady(db: Database): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'player_stats'
          AND column_name = 'highest_match_score'
      ) AS player_stats_ready,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'player_progression'
      ) AS progression_ready
  `);
  const row = result.rows[0] as { player_stats_ready: boolean; progression_ready: boolean } | undefined;
  return Boolean(row?.player_stats_ready && row?.progression_ready);
}

/**
 * Apply late migrations directly when drizzle-kit metadata is out of sync.
 * Statements that already ran (duplicate column/type/table) are ignored.
 */
export async function repairPhase9Schema(db: Database): Promise<void> {
  for (const filename of ['0004_nullable_room_host.sql', '0005_phase9_scoring_progression.sql']) {
    const statements = splitMigrationStatements(readMigrationFile(filename));
    for (const stmt of statements) {
      try {
        await db.execute(sql.raw(stmt));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes('already exists')
          || message.includes('duplicate key')
          || message.includes('duplicate_object')
        ) {
          continue;
        }
        throw err;
      }
    }
  }
}
