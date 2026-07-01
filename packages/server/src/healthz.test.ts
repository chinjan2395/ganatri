/**
 * healthz.test.ts
 *
 * Integration tests for the /healthz liveness probe endpoint.
 * The endpoint must always return 200 with {"ok":true} — no DB checks,
 * no external calls. Render/Railway use it to decide if the process
 * should be killed and restarted.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { request } from 'node:http';
import { createApp, type AppInstance } from './createApp.js';

// ---------------------------------------------------------------------------
// HTTP helper (same pattern as auth-rate-limit.test.ts)
// ---------------------------------------------------------------------------

function httpGet(
  port: number,
  path: string,
): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: 'localhost', port, path, method: 'GET' }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
          headers: res.headers,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('/healthz liveness probe', () => {
  let app: AppInstance;
  let port: number;

  beforeEach(async () => {
    app = createApp();
    port = await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with {"ok":true}', async () => {
    const resp = await httpGet(port, '/healthz');
    expect(resp.status).toBe(200);
    expect(JSON.parse(resp.body)).toEqual({ ok: true });
  });

  it('sets Content-Type to application/json', async () => {
    const resp = await httpGet(port, '/healthz');
    expect(String(resp.headers['content-type'] ?? '')).toContain('application/json');
  });

  it('responds the same way regardless of DB configuration', async () => {
    // No DATABASE_URL is set in this test environment, so persistence is
    // not configured — the liveness probe must still return 200.
    const resp = await httpGet(port, '/healthz');
    expect(resp.status).toBe(200);
    expect(JSON.parse(resp.body)).toEqual({ ok: true });
  });
});
