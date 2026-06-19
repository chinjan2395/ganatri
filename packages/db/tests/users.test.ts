import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, uuid, type TestDb } from './helpers/pglite';

describe('users (pg)', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.close();
  });

  it('upsertUser inserts then updates idempotently', async () => {
    const id = uuid();
    const first = await t.repo.upsertUser({ id, displayName: 'Alice', isGuest: false });
    expect(first.displayName).toBe('Alice');
    expect(first.isGuest).toBe(false);

    const second = await t.repo.upsertUser({ id, displayName: 'Alice2', isGuest: false });
    expect(second.id).toBe(id);
    expect(second.displayName).toBe('Alice2');

    const stats = await t.pglite.query<{ count: string }>(
      `select count(*)::text as count from users`
    );
    expect(Number(stats.rows[0]!.count)).toBe(1);
  });

  it('ensureGuest creates a guest row and is idempotent', async () => {
    const id = uuid();
    const a = await t.repo.ensureGuest(id, 'Guest');
    expect(a.isGuest).toBe(true);
    const b = await t.repo.ensureGuest(id, 'Guest');
    expect(b.id).toBe(a.id);

    const res = await t.pglite.query<{ count: string }>(
      `select count(*)::text as count from users`
    );
    expect(Number(res.rows[0]!.count)).toBe(1);
  });

  it('enforces unique email', async () => {
    await t.repo.upsertUser({ id: uuid(), displayName: 'A', email: 'x@y.com' });
    await expect(
      t.repo.upsertUser({ id: uuid(), displayName: 'B', email: 'x@y.com' })
    ).rejects.toThrow();
  });
});
