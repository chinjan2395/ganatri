/**
 * Test harness: a fresh in-memory Postgres (PGlite) with the real generated
 * migration applied, wrapped in a Drizzle client and a `PgPersistence` repo.
 *
 * Using the actual `drizzle/0000_*.sql` (not `db.push`) means every test hits
 * the exact DDL that production will run, so the schema and migration cannot
 * silently diverge.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from '../../src/schema';
import { PgPersistence } from '../../src/persistence/pg';
import type { Database } from '../../src/db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = join(__dirname, '..', '..', 'drizzle');

/** Locate the single generated migration SQL file. */
export function migrationPath(): string {
  const files = readdirSync(DRIZZLE_DIR).filter((f) => f.endsWith('.sql'));
  if (files.length !== 1) {
    throw new Error(
      `expected exactly one migration .sql in ${DRIZZLE_DIR}, found: ${files.join(', ')}`
    );
  }
  return join(DRIZZLE_DIR, files[0]!);
}

export function readMigrationSql(): string {
  return readFileSync(migrationPath(), 'utf8');
}

export interface TestDb {
  pglite: PGlite;
  /** Drizzle over pglite. Typed as the node-pg `Database` for repo injection. */
  db: PgliteDatabase<typeof schema>;
  repo: PgPersistence;
  close: () => Promise<void>;
}

/** Build a fresh DB with the real migration applied. Call once per test. */
export async function createTestDb(): Promise<TestDb> {
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema });

  const sql = readMigrationSql();
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await pglite.exec(stmt);
  }

  // PgliteDatabase and NodePgDatabase share the same Drizzle query-builder
  // surface used by PgPersistence; the cast lets the repo accept either.
  const repo = new PgPersistence(db as unknown as Database);

  return {
    pglite,
    db,
    repo,
    close: async () => {
      await pglite.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Seed helpers for FK-dependent rows
// ---------------------------------------------------------------------------

let seedCounter = 0;
export function uuid(): string {
  // Deterministic-ish v4-shaped UUID for tests (PGlite needs valid uuid text).
  seedCounter += 1;
  const hex = seedCounter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

export async function seedUser(
  t: TestDb,
  displayName = 'Player',
  opts: { email?: string; isGuest?: boolean } = {}
): Promise<string> {
  const id = uuid();
  await t.db.insert(schema.users).values({
    id,
    displayName,
    email: opts.email ?? null,
    isGuest: opts.isGuest ?? true,
  });
  return id;
}

export async function seedRoom(
  t: TestDb,
  hostUserId: string,
  opts: { roomCode?: string; status?: schema.RoomStatusValue } = {}
): Promise<string> {
  const rows = await t.db
    .insert(schema.rooms)
    .values({
      roomCode: opts.roomCode ?? `R${(seedCounter++).toString().padStart(5, '0')}`,
      hostUserId,
      status: opts.status ?? 'LOBBY',
    })
    .returning();
  return rows[0]!.id;
}

export async function seedGame(
  t: TestDb,
  roomId: string,
  opts: { seed?: string; seating?: string[] } = {}
): Promise<string> {
  const seating = opts.seating ?? ['p1', 'p2'];
  const rows = await t.db
    .insert(schema.games)
    .values({
      roomId,
      seed: opts.seed ?? '12345',
      seatingOrder: seating,
      playerCount: seating.length,
      startedAt: new Date(),
    })
    .returning();
  return rows[0]!.id;
}
