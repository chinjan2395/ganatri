import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameEvent } from '@ganatri/engine';
import { createTestDb, migrationPaths, readMigrationSql, type TestDb } from './helpers/pglite';
import { gameEventTypeEnum, roomStatusEnum } from '../src/schema';

/**
 * The full set of `GameEvent.type` strings the engine can emit. Kept as an
 * explicit literal list so the drift guard fails loudly if the engine union
 * changes without the DB enum being updated.
 */
const ENGINE_EVENT_TYPES: ReadonlyArray<GameEvent['type']> = [
  'CARD_PLAYED',
  'CAPTURED',
  'CARD_DRAWN',
  'PART1_ENDED',
  'TRICK_WON',
  'CUT',
  'PLAYER_SAFE',
  'HANDS_REDISTRIBUTED',
  'GAME_OVER',
];

describe('schema migration', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.close();
  });

  it('applies the generated migration to a fresh PGlite db', async () => {
    const res = await t.pglite.query<{ count: string }>(
      `select count(*)::text as count from information_schema.tables where table_schema = 'public'`
    );
    expect(Number(res.rows[0]!.count)).toBe(11);
  });

  it('creates all 11 tables', async () => {
    const res = await t.pglite.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name`
    );
    const names = res.rows.map((r) => r.table_name);
    expect(names).toEqual([
      'auth_sessions',
      'game_events',
      'game_players',
      'games',
      'oauth_accounts',
      'player_progression',
      'player_stats',
      'rooms',
      'score_ledger',
      'user_blocks',
      'users',
    ]);
  });

  it('creates the expected indexes', async () => {
    const res = await t.pglite.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname = 'public'`
    );
    const idx = res.rows.map((r) => r.indexname);
    for (const expected of [
      'users_email_idx',
      'rooms_room_code_idx',
      'rooms_status_idx',
      'games_room_id_idx',
      'games_winner_id_idx',
      'games_started_at_idx',
      'game_players_game_id_idx',
      'game_players_user_id_idx',
      'game_events_game_id_idx',
      'game_events_game_id_seq_idx',
      'game_events_actor_user_id_idx',
      'player_stats_user_id_idx',
      // Phase A additions: auth + retention.
      'oauth_accounts_provider_identity_idx',
      'oauth_accounts_user_id_idx',
      'auth_sessions_token_hash_idx',
      'auth_sessions_user_id_idx',
      'game_events_ts_idx',
      'games_abandoned_ended_at_idx',
      'player_progression_user_id_idx',
      'score_ledger_user_id_idx',
      'score_ledger_game_id_idx',
      'score_ledger_user_id_created_at_idx',
      // Phase 8: social blocks.
      'user_blocks_blocked_id_idx',
    ]) {
      expect(idx).toContain(expected);
    }
  });

  it('auth_sessions has last_seen_at as a NOT NULL timestamptz column', async () => {
    const res = await t.pglite.query<{
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'auth_sessions' AND column_name = 'last_seen_at'`
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]!.data_type).toBe('timestamp with time zone');
    expect(res.rows[0]!.is_nullable).toBe('NO');
    expect(res.rows[0]!.column_default).toBe('now()');
  });

  it('user_blocks table has expected columns with correct types', async () => {
    const res = await t.pglite.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'user_blocks'
       ORDER BY ordinal_position`
    );
    const cols = res.rows;
    expect(cols.map((c) => c.column_name)).toEqual(['blocker_id', 'blocked_id', 'created_at']);
    const blocker = cols.find((c) => c.column_name === 'blocker_id')!;
    expect(blocker.data_type).toBe('uuid');
    expect(blocker.is_nullable).toBe('NO');
    const blocked = cols.find((c) => c.column_name === 'blocked_id')!;
    expect(blocked.data_type).toBe('uuid');
    expect(blocked.is_nullable).toBe('NO');
  });

  it('stores games.seed as text (not integer)', async () => {
    const res = await t.pglite.query<{ data_type: string }>(
      `select data_type from information_schema.columns where table_name = 'games' and column_name = 'seed'`
    );
    expect(res.rows[0]!.data_type).toBe('text');
  });

  it('player_stats.sum_finish_positions exists as integer NOT NULL DEFAULT 0', async () => {
    const res = await t.pglite.query<{
      data_type: string;
      is_nullable: string;
      column_default: string;
    }>(
      `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'player_stats' AND column_name = 'sum_finish_positions'`
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]!.data_type).toBe('integer');
    expect(res.rows[0]!.is_nullable).toBe('NO');
    expect(res.rows[0]!.column_default).toBe('0');
  });

  it('phase 9 scoring columns and tables exist with expected defaults', async () => {
    const gamePlayerCols = await t.pglite.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'game_players'
         AND column_name IN ('match_score', 'xp_earned', 'ranked_rating_delta')
       ORDER BY column_name`
    );
    expect(gamePlayerCols.rows.map((r) => r.column_name)).toEqual([
      'match_score',
      'ranked_rating_delta',
      'xp_earned',
    ]);

    const progressionCols = await t.pglite.query<{
      column_name: string;
      column_default: string | null;
    }>(
      `SELECT column_name, column_default
       FROM information_schema.columns
       WHERE table_name = 'player_progression'
       ORDER BY ordinal_position`
    );
    expect(progressionCols.rows.map((r) => r.column_name)).toEqual([
      'user_id',
      'ranked_rating',
      'total_xp',
      'level',
      'highest_match_score',
      'total_match_score',
      'ghost_finishes',
      'updated_at',
    ]);
    expect(
      progressionCols.rows.find((r) => r.column_name === 'level')?.column_default
    ).toBe('1');

    const statsCols = await t.pglite.query<{
      column_name: string;
      column_default: string | null;
    }>(
      `SELECT column_name, column_default
       FROM information_schema.columns
       WHERE table_name = 'player_stats'
         AND column_name IN ('highest_match_score', 'total_match_score', 'ghost_finishes')
       ORDER BY column_name`
    );
    expect(statsCols.rows).toEqual([
      { column_name: 'ghost_finishes', column_default: '0' },
      { column_name: 'highest_match_score', column_default: '0' },
      { column_name: 'total_match_score', column_default: '0' },
    ]);
  });
});

describe('enum-drift guard', () => {
  it('generated SQL enum labels match the Drizzle enum and the engine union', () => {
    const sql = readMigrationSql();
    const m = sql.match(
      /CREATE TYPE "public"\."game_event_type" AS ENUM\(([^)]*)\)/
    );
    expect(m).not.toBeNull();
    const sqlLabels = m![1]!
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''));

    // SQL == Drizzle schema enum.
    expect(sqlLabels).toEqual([...gameEventTypeEnum.enumValues]);
    // Drizzle schema enum == engine GameEvent union (order-independent).
    expect([...gameEventTypeEnum.enumValues].sort()).toEqual(
      [...ENGINE_EVENT_TYPES].sort()
    );
  });

  it('room_status enum matches the Drizzle schema', () => {
    const sql = readMigrationSql();
    const m = sql.match(/CREATE TYPE "public"\."room_status" AS ENUM\(([^)]*)\)/);
    expect(m).not.toBeNull();
    const sqlLabels = m![1]!
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''));
    expect(sqlLabels).toEqual([...roomStatusEnum.enumValues]);
  });

  it('drizzle journal lists every migration sql file', () => {
    const sqlTags = migrationPaths()
      .map((p) => p.split('/').pop()!.replace('.sql', ''))
      .sort();
    const journalPath = join(__dirname, '..', 'drizzle', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: Array<{ tag: string }>;
    };
    const journalTags = journal.entries.map((e) => e.tag).sort();
    expect(journalTags).toEqual(sqlTags);
  });
});
