/**
 * Reproduces production breakage when Phase 9 code runs against a DB that only
 * has migrations 0000–0003 applied, and verifies the repair path fixes it.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from '../src/schema';
import { PgPersistence } from '../src/persistence/pg';
import type { Database } from '../src/db';
import { isPhase9SchemaReady, repairPhase9Schema } from '../src/migrations';

const DRIZZLE_DIR = join(__dirname, '..', 'drizzle');

async function createOldSchemaDb(): Promise<{
  repo: PgPersistence;
  db: PgliteDatabase<typeof schema>;
  close: () => Promise<void>;
}> {
  const files = readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => f <= '0003_user_blocks.sql');

  const pglite = new PGlite();
  const db = drizzle(pglite, { schema });
  for (const f of files) {
    const sql = readFileSync(join(DRIZZLE_DIR, f), 'utf8');
    for (const stmt of sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)) {
      await pglite.exec(stmt);
    }
  }
  return {
    repo: new PgPersistence(db as unknown as Database),
    db,
    close: () => pglite.close(),
  };
}

describe('pre-phase9 schema compatibility', () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  it('repairPhase9Schema upgrades an old database so stats queries work', async () => {
    const t = await createOldSchemaDb();
    close = t.close;
    const userId = '00000000-0000-4000-8000-000000000099';
    await t.db.insert(schema.users).values({ id: userId, displayName: 'Test', isGuest: false });

    expect(await isPhase9SchemaReady(t.db as unknown as Database)).toBe(false);
    await repairPhase9Schema(t.db as unknown as Database);
    expect(await isPhase9SchemaReady(t.db as unknown as Database)).toBe(true);

    await t.repo.upsertPlayerStats({ userId, gamesPlayed: 2, gamesWon: 1 });
    const stats = await t.repo.getPlayerStats(userId);
    expect(stats?.gamesPlayed).toBe(2);
  });
});
