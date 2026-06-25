import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from 'node:http';
import { MemoryPersistence } from '@ganatri/db';
import type { AppInstance } from './createApp.js';

const EXCHANGE_PROFILE = {
  providerUserId: 'google-sub-callback',
  email: 'player@example.com',
  displayName: 'Callback Player',
  avatarUrl: 'https://example.com/avatar.png',
};

function httpRequest(
  port: number,
  path: string,
  method = 'GET',
  body?: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: 'localhost',
        port,
        path,
        method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('google oauth callback', () => {
  let app: AppInstance;
  let port: number;
  let persistence: MemoryPersistence;

  beforeEach(async () => {
    vi.resetModules();
    process.env['GOOGLE_CLIENT_ID'] = 'client-id';
    process.env['GOOGLE_CLIENT_SECRET'] = 'client-secret';
    process.env['OAUTH_REDIRECT_URI'] = 'http://localhost:4000/auth/google/callback';
    process.env['WEB_ORIGIN'] = 'http://localhost:5173';
    process.env['INSECURE_COOKIES'] = 'true';
    process.env['HOST'] = '127.0.0.1';

    vi.doMock('./auth/oauth.js', () => ({
      exchangeCode: vi.fn(async () => EXCHANGE_PROFILE),
      getGoogleAuthUrl: vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth'),
    }));

    const { __setPersistenceForTests } = await import('./persistence.js');
    const { createApp } = await import('./createApp.js');

    persistence = new MemoryPersistence();
    __setPersistenceForTests(persistence);
    app = createApp();
    port = await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
    const { __setPersistenceForTests } = await import('./persistence.js');
    __setPersistenceForTests(null);
    delete process.env['GOOGLE_CLIENT_ID'];
    delete process.env['GOOGLE_CLIENT_SECRET'];
    delete process.env['OAUTH_REDIRECT_URI'];
    delete process.env['WEB_ORIGIN'];
    delete process.env['INSECURE_COOKIES'];
    delete process.env['HOST'];
    vi.resetModules();
    vi.doUnmock('./auth/oauth.js');
  });

  it('sets the durable auth cookie on successful callback', async () => {
    const response = await httpRequest(port, '/auth/google/callback?code=test-code&state=oauth-state', 'GET', undefined, {
      Cookie: 'ganatri_oauth_state=oauth-state; ganatri_guest=guest-token',
    });

    expect(response.status).toBe(302);
    const location = response.headers.location;
    expect(typeof location).toBe('string');
    expect(location).toMatch(/^http:\/\/localhost:5173\/?\?auth_token=/);

    const setCookies = response.headers['set-cookie'];
    expect(Array.isArray(setCookies)).toBe(true);
    const cookies = Array.isArray(setCookies) ? setCookies.filter((cookie): cookie is string => typeof cookie === 'string') : [];

    const sessionCookie = cookies.find((cookie) => cookie.startsWith('ganatri_session='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('Max-Age=2592000');
    expect(sessionCookie).toContain('HttpOnly');

    expect(cookies.some((cookie) => cookie.startsWith('ganatri_oauth_state=;'))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith('ganatri_guest=;'))).toBe(true);

    const sessionCookieValue = sessionCookie ?? '';
    const [sessionCookiePair] = sessionCookieValue.split(';', 1);
    const token = decodeURIComponent(sessionCookiePair?.split('=', 2)[1] ?? '');
    const { hashToken } = await import('./auth/session.js');
    const resolved = await persistence.getAuthSessionByTokenHash(hashToken(token));
    expect(resolved?.user.displayName).toBe(EXCHANGE_PROFILE.displayName);
    expect(resolved?.user.email).toBe(EXCHANGE_PROFILE.email);
  });

  it('bootstrap migrates a legacy auth token into the durable cookie', async () => {
    const user = await persistence.upsertOAuthUser({
      provider: 'google',
      providerUserId: 'google-sub-bootstrap',
      email: 'bootstrap@example.com',
      displayName: 'Bootstrap User',
    });
    const token = 'legacy-auth-token';
    await persistence.createAuthSession({
      userId: user.id,
      tokenHash: (await import('./auth/session.js')).hashToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: 'bootstrap-test',
    });

    const response = await httpRequest(
      port,
      '/auth/bootstrap',
      'POST',
      JSON.stringify({ legacyToken: token }),
      { 'Content-Type': 'application/json' },
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ kind: 'auth' });
    const setCookies = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie']
      : [];
    expect(setCookies.some((cookie) => cookie.startsWith('ganatri_session='))).toBe(true);
  });

  it('bootstrap preserves a live guest runtime session for migration', async () => {
    const { createSession, resetStore } = await import('./store.js');
    resetStore();
    createSession('legacy-guest-token', 'guest-player-id', null, 'Guesty');

    const response = await httpRequest(
      port,
      '/auth/bootstrap',
      'POST',
      JSON.stringify({ legacyToken: 'legacy-guest-token' }),
      { 'Content-Type': 'application/json' },
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      kind: 'guest',
      guestToken: 'legacy-guest-token',
      playerId: 'guest-player-id',
    });
  });
});
