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
    const { user } = await t.repo.upsertOAuthUser({
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
    const { user } = await t.repo.upsertOAuthUser({
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
    const { user: first } = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-repeat',
      email: 'r@example.com',
      displayName: 'First',
    });
    const { user: second } = await t.repo.upsertOAuthUser({
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
    const { user: a } = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-null-1',
      email: null,
      displayName: 'Anon One',
    });
    const { user: b } = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-null-2',
      email: null,
      displayName: 'Anon Two',
    });
    expect(a.id).not.toBe(b.id);
  });

  it('returns the user for a valid session token hash', async () => {
    const { user } = await t.repo.upsertOAuthUser({
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
    const found = await t.repo.getAuthSessionByTokenHash('a'.repeat(64));
    expect(found?.user.id).toBe(user.id);
  });

  it('returns null for an expired session', async () => {
    const { user } = await t.repo.upsertOAuthUser({
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
    expect(await t.repo.getAuthSessionByTokenHash('b'.repeat(64))).toBeNull();
  });

  it('returns null for a revoked session', async () => {
    const { user } = await t.repo.upsertOAuthUser({
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
    expect(await t.repo.getAuthSessionByTokenHash('c'.repeat(64))).toBeNull();
  });

  it('revokeAuthSession is a no-op for an unknown token hash', async () => {
    await expect(t.repo.revokeAuthSession('d'.repeat(64))).resolves.toBeUndefined();
  });

  it('returns null for an unknown token hash', async () => {
    expect(await t.repo.getAuthSessionByTokenHash('f'.repeat(64))).toBeNull();
  });

  it('returns isNew=true on first login and isNew=false on repeat login', async () => {
    const first = await t.repo.upsertOAuthUser({ provider: 'google', providerUserId: 'g-isnew', email: 'new@isnew.com', displayName: 'IsNew' });
    expect(first.isNew).toBe(true);
    const second = await t.repo.upsertOAuthUser({ provider: 'google', providerUserId: 'g-isnew', email: 'new@isnew.com', displayName: 'IsNew' });
    expect(second.isNew).toBe(false);
    expect(second.user.id).toBe(first.user.id);
  });

  it('touches, lists, and revokes sessions by id', async () => {
    const { user } = await t.repo.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'g-manage',
      email: 'manage@example.com',
      displayName: 'Manage Me',
    });
    const current = await t.repo.createAuthSession({
      userId: user.id,
      tokenHash: '1'.repeat(64),
      expiresAt: new Date(Date.now() + 1_000),
      userAgent: 'Current Device',
    });
    const other = await t.repo.createAuthSession({
      userId: user.id,
      tokenHash: '2'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: 'Other Device',
    });

    const touched = await t.repo.touchAuthSession('1'.repeat(64), new Date(Date.now() + 120_000));
    expect(touched).not.toBeNull();
    expect(touched!.expiresAt.getTime()).toBeGreaterThan(current.expiresAt.getTime());

    const listed = await t.repo.listAuthSessions(user.id);
    expect(listed.map((session) => session.id).sort()).toEqual([current.id, other.id].sort());

    const revokedOthers = await t.repo.revokeOtherAuthSessions(user.id, current.id);
    expect(revokedOthers).toBe(1);

    await t.repo.revokeAuthSessionById(user.id, current.id);
    expect(await t.repo.getAuthSessionByTokenHash('1'.repeat(64))).toBeNull();
  });
});
