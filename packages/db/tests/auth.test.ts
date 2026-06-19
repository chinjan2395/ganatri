import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, seedUser, type TestDb } from './helpers/pglite';

/**
 * OAuth user resolution + durable auth sessions (pg-backed).
 * Resolution paths and session validity are also exercised against both impls
 * in the shared contract suite (memory.test.ts).
 */
describe('auth (pg)', () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.close();
  });

  it('creates a new non-guest user for a first-time login', async () => {
    const user = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-1',
      email: 'new@example.com',
      displayName: 'New Person',
      avatarUrl: 'https://img/1.png',
    });
    expect(user.isGuest).toBe(false);
    expect(user.email).toBe('new@example.com');
    expect(user.avatarUrl).toBe('https://img/1.png');
  });

  it('links to an existing user matched by email and clears guest flag', async () => {
    const existingId = await seedUser(t, 'Old Name', {
      email: 'link@example.com',
      isGuest: true,
    });
    const user = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-link',
      email: 'link@example.com',
      displayName: 'Linked Name',
    });
    expect(user.id).toBe(existingId);
    expect(user.isGuest).toBe(false);
    expect(user.displayName).toBe('Linked Name');
  });

  it('is idempotent across repeat logins (same provider identity)', async () => {
    const first = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-repeat',
      email: 'r@example.com',
      displayName: 'First',
    });
    const second = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-repeat',
      email: 'r@example.com',
      displayName: 'Second',
      avatarUrl: 'https://img/x.png',
    });
    expect(second.id).toBe(first.id);
    expect(second.displayName).toBe('Second');
    expect(second.avatarUrl).toBe('https://img/x.png');

    // Exactly one oauth_accounts row exists for this identity.
    const rows = await t.pglite.query<{ count: string }>(
      `select count(*)::text as count from oauth_accounts where provider = 'google' and provider_user_id = 'g-repeat'`
    );
    expect(Number(rows.rows[0]!.count)).toBe(1);
  });

  it('creates a separate user when email is null and identity is new', async () => {
    const a = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-null-1',
      email: null,
      displayName: 'Anon One',
    });
    const b = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-null-2',
      email: null,
      displayName: 'Anon Two',
    });
    expect(a.id).not.toBe(b.id);
  });

  it('returns the user for a valid session token hash', async () => {
    const user = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-sess',
      email: 's@example.com',
      displayName: 'S',
    });
    await t.repo.createAuthSession({
      userId: user.id,
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: 'vitest',
    });
    const found = await t.repo.getUserBySessionTokenHash('a'.repeat(64));
    expect(found!.id).toBe(user.id);
  });

  it('returns null for an expired session', async () => {
    const user = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-exp',
      email: 'e@example.com',
      displayName: 'E',
    });
    await t.repo.createAuthSession({
      userId: user.id,
      tokenHash: 'b'.repeat(64),
      expiresAt: new Date(Date.now() - 1_000),
    });
    expect(await t.repo.getUserBySessionTokenHash('b'.repeat(64))).toBeNull();
  });

  it('returns null for a revoked session', async () => {
    const user = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-rev',
      email: 'rv@example.com',
      displayName: 'RV',
    });
    await t.repo.createAuthSession({
      userId: user.id,
      tokenHash: 'c'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await t.repo.revokeAuthSession('c'.repeat(64));
    expect(await t.repo.getUserBySessionTokenHash('c'.repeat(64))).toBeNull();
  });

  it('revokeAuthSession is a no-op for an unknown token hash', async () => {
    await expect(t.repo.revokeAuthSession('d'.repeat(64))).resolves.toBeUndefined();
  });

  it('returns null for an unknown token hash', async () => {
    expect(await t.repo.getUserBySessionTokenHash('f'.repeat(64))).toBeNull();
  });
});
