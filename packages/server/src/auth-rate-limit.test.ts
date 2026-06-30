/**
 * auth-rate-limit.test.ts
 *
 * Integration tests for the per-IP rate limiters on auth HTTP endpoints:
 *   GET  /auth/google/login     — OAuth initiation (limit: 10/min)
 *   GET  /auth/google/callback  — OAuth code exchange (limit: 10/min)
 *   POST /auth/bootstrap        — Session bootstrap on page load (limit: 30/min)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from 'node:http';
import type { AppInstance } from './createApp.js';

// ---------------------------------------------------------------------------
// HTTP helper (same pattern as oauth-callback.test.ts)
// ---------------------------------------------------------------------------

function httpRequest(
  port: number,
  path: string,
  method = 'GET',
  body?: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('auth endpoint rate limiting', () => {
  let app: AppInstance;
  let port: number;
  let resetAuthRateLimits: () => void;

  beforeEach(async () => {
    vi.resetModules();

    // Disable OAuth so login/callback return 404 instead of redirect.
    // The rate-limit check fires BEFORE the isOAuthEnabled check,
    // so 429 will still be returned on the 11th request.
    delete process.env['GOOGLE_CLIENT_ID'];
    delete process.env['GOOGLE_CLIENT_SECRET'];
    delete process.env['OAUTH_REDIRECT_URI'];
    process.env['HOST'] = '127.0.0.1';

    const createAppModule = await import('./createApp.js');
    resetAuthRateLimits = createAppModule.resetAuthRateLimits;
    resetAuthRateLimits();

    app = createAppModule.createApp();
    port = await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
    resetAuthRateLimits();
    delete process.env['HOST'];
    vi.resetModules();
  });

  // -------------------------------------------------------------------------
  // OAuth login (/auth/google/login)
  // -------------------------------------------------------------------------

  it('allows the first 10 requests to /auth/google/login (under limit)', async () => {
    // With OAuth disabled these return 404, not 429.
    for (let i = 0; i < 10; i++) {
      const resp = await httpRequest(port, '/auth/google/login');
      expect(resp.status).not.toBe(429);
    }
  });

  it('returns 429 on the 11th request to /auth/google/login (over limit)', async () => {
    // Exhaust the 10-request window.
    for (let i = 0; i < 10; i++) {
      await httpRequest(port, '/auth/google/login');
    }
    // 11th request — must be rate-limited.
    const resp = await httpRequest(port, '/auth/google/login');
    expect(resp.status).toBe(429);
    expect(JSON.parse(resp.body)).toEqual({ error: 'RATE_LIMITED' });
  });

  // -------------------------------------------------------------------------
  // OAuth callback (/auth/google/callback)
  // -------------------------------------------------------------------------

  it('allows the first 10 requests to /auth/google/callback (under limit)', async () => {
    // With OAuth disabled these return 404, not 429.
    for (let i = 0; i < 10; i++) {
      const resp = await httpRequest(port, '/auth/google/callback?code=x&state=y');
      expect(resp.status).not.toBe(429);
    }
  });

  it('returns 429 on the 11th request to /auth/google/callback (over limit)', async () => {
    for (let i = 0; i < 10; i++) {
      await httpRequest(port, '/auth/google/callback?code=x&state=y');
    }
    const resp = await httpRequest(port, '/auth/google/callback?code=x&state=y');
    expect(resp.status).toBe(429);
    expect(JSON.parse(resp.body)).toEqual({ error: 'RATE_LIMITED' });
  });

  // -------------------------------------------------------------------------
  // Bootstrap (/auth/bootstrap)
  // -------------------------------------------------------------------------

  it('allows the first 30 requests to /auth/bootstrap (under limit)', async () => {
    for (let i = 0; i < 30; i++) {
      const resp = await httpRequest(
        port,
        '/auth/bootstrap',
        'POST',
        JSON.stringify({}),
        { 'Content-Type': 'application/json' },
      );
      expect(resp.status).not.toBe(429);
    }
  });

  it('returns 429 on the 31st request to /auth/bootstrap (over limit)', async () => {
    for (let i = 0; i < 30; i++) {
      await httpRequest(
        port,
        '/auth/bootstrap',
        'POST',
        JSON.stringify({}),
        { 'Content-Type': 'application/json' },
      );
    }
    const resp = await httpRequest(
      port,
      '/auth/bootstrap',
      'POST',
      JSON.stringify({}),
      { 'Content-Type': 'application/json' },
    );
    expect(resp.status).toBe(429);
    expect(JSON.parse(resp.body)).toEqual({ error: 'RATE_LIMITED' });
  });

  // -------------------------------------------------------------------------
  // IP isolation
  // -------------------------------------------------------------------------

  it('OAuth rate-limit buckets are isolated per IP', async () => {
    // Exhaust the limit for "127.0.0.1" (the loopback used in tests).
    for (let i = 0; i < 10; i++) {
      await httpRequest(port, '/auth/google/login');
    }
    // The 11th from the same IP is rate-limited.
    const blocked = await httpRequest(port, '/auth/google/login');
    expect(blocked.status).toBe(429);

    // A different IP (injected via X-Forwarded-For) gets its own bucket.
    const fromOtherIp = await httpRequest(port, '/auth/google/login', 'GET', undefined, {
      'X-Forwarded-For': '10.0.0.1',
    });
    expect(fromOtherIp.status).not.toBe(429);
  });

  it('bootstrap rate-limit buckets are isolated per IP', async () => {
    // Exhaust the bootstrap limit for loopback.
    for (let i = 0; i < 30; i++) {
      await httpRequest(port, '/auth/bootstrap', 'POST', JSON.stringify({}), {
        'Content-Type': 'application/json',
      });
    }
    const blocked = await httpRequest(port, '/auth/bootstrap', 'POST', JSON.stringify({}), {
      'Content-Type': 'application/json',
    });
    expect(blocked.status).toBe(429);

    // Different IP — own bucket, not blocked.
    const fromOtherIp = await httpRequest(
      port,
      '/auth/bootstrap',
      'POST',
      JSON.stringify({}),
      {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.0.0.2',
      },
    );
    expect(fromOtherIp.status).not.toBe(429);
  });

  it('resets correctly between tests — first request after reset is not blocked', async () => {
    // Fill both buckets to their limits.
    for (let i = 0; i < 10; i++) {
      await httpRequest(port, '/auth/google/login');
    }
    for (let i = 0; i < 30; i++) {
      await httpRequest(port, '/auth/bootstrap', 'POST', JSON.stringify({}), {
        'Content-Type': 'application/json',
      });
    }

    // Both should be blocked now.
    expect((await httpRequest(port, '/auth/google/login')).status).toBe(429);
    expect(
      (
        await httpRequest(port, '/auth/bootstrap', 'POST', JSON.stringify({}), {
          'Content-Type': 'application/json',
        })
      ).status,
    ).toBe(429);

    // Reset and confirm limits are cleared.
    resetAuthRateLimits();

    expect((await httpRequest(port, '/auth/google/login')).status).not.toBe(429);
    expect(
      (
        await httpRequest(port, '/auth/bootstrap', 'POST', JSON.stringify({}), {
          'Content-Type': 'application/json',
        })
      ).status,
    ).not.toBe(429);
  });
});
