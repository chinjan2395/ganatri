import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { GameEvent } from '@ganatri/engine';
import { createTestDb, readMigrationSql, type TestDb } from './helpers/pglite';
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
    expect(Number(res.rows[0]!.count)).toBe(6);
  });

  it('creates all 6 tables', async () => {
    const res = await t.pglite.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name`
    );
    const names = res.rows.map((r) => r.table_name);
    expect(names).toEqual([
      'game_events',
      'game_players',
      'games',
      'player_stats',
      'rooms',
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
    ]) {
      expect(idx).toContain(expected);
    }
  });

  it('stores games.seed as text (not integer)', async () => {
    const res = await t.pglite.query<{ data_type: string }>(
      `select data_type from information_schema.columns where table_name = 'games' and column_name = 'seed'`
    );
    expect(res.rows[0]!.data_type).toBe('text');
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
});
