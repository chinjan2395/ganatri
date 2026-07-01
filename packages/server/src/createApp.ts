/**
 * createApp.ts — factory for the HTTP + Socket.io server.
 *
 * Separated from index.ts so tests can create the server without
 * immediately calling listen().
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { randomBytes } from 'node:crypto';
import { Server } from 'socket.io';
import { setupSocketHandlers, type SocketHandlerTimers } from './handlers.js';
import { rehydrateFromDb } from './recovery.js';
import { attachSessionMiddleware } from './auth/sessionMiddleware.js';
import {
  isOAuthEnabled,
  WEB_ORIGIN,
  SESSION_TTL_DAYS,
  cookiesSecure,
} from './config.js';
import { getGoogleAuthUrl, exchangeCode } from './auth/oauth.js';
import { getPersistence } from './persistence.js';
import { isPhase9SchemaReady, getDb } from '@ganatri/db';
import {
  parseCookies,
  hashToken,
  randomSessionToken,
  buildSessionCookie,
  buildClearCookie,
  buildStateCookie,
  buildClearStateCookie,
  buildGuestCookie,
  buildClearGuestCookie,
  SESSION_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  GUEST_COOKIE_NAME,
} from './auth/session.js';
import { getSession } from './store.js';
import { track } from './analytics.js';

export interface AppInstance {
  io: Server;
  httpServer: ReturnType<typeof createServer>;
  /** Start listening. Returns the bound port. */
  listen(port?: number): Promise<number>;
  /** Gracefully close all connections. */
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// IP extraction
// ---------------------------------------------------------------------------

function getClientIp(req: IncomingMessage): string {
  if (process.env['TRUST_PROXY'] === '1') {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return (first ?? '127.0.0.1').trim();
    }
  }
  return req.socket?.remoteAddress ?? '127.0.0.1';
}

// ---------------------------------------------------------------------------
// Auth rate limiters
// ---------------------------------------------------------------------------

const AUTH_OAUTH_RATE_LIMIT_MAX = 10;
const AUTH_OAUTH_RATE_LIMIT_WINDOW_MS = 60_000;

const AUTH_BOOTSTRAP_RATE_LIMIT_MAX = 30;
const AUTH_BOOTSTRAP_RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const authOAuthIpRateLimit: Map<string, RateLimitEntry> = new Map();
const authBootstrapIpRateLimit: Map<string, RateLimitEntry> = new Map();

function checkOAuthRateLimit(ip: string): boolean {
  const now = Date.now();
  for (const [key, entry] of authOAuthIpRateLimit) {
    if (entry.resetAt <= now) authOAuthIpRateLimit.delete(key);
  }
  const entry = authOAuthIpRateLimit.get(ip);
  if (entry === undefined || entry.resetAt <= now) {
    authOAuthIpRateLimit.set(ip, { count: 1, resetAt: now + AUTH_OAUTH_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= AUTH_OAUTH_RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function checkBootstrapRateLimit(ip: string): boolean {
  const now = Date.now();
  for (const [key, entry] of authBootstrapIpRateLimit) {
    if (entry.resetAt <= now) authBootstrapIpRateLimit.delete(key);
  }
  const entry = authBootstrapIpRateLimit.get(ip);
  if (entry === undefined || entry.resetAt <= now) {
    authBootstrapIpRateLimit.set(ip, { count: 1, resetAt: now + AUTH_BOOTSTRAP_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= AUTH_BOOTSTRAP_RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

/** Reset all auth rate-limit state — for tests only. */
export function resetAuthRateLimits(): void {
  authOAuthIpRateLimit.clear();
  authBootstrapIpRateLimit.clear();
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

/**
 * CORS origin policy. When WEB_ORIGIN is set we lock to it and allow
 * credentials (cookies). Otherwise fall back to '*' WITHOUT credentials.
 */
const corsOrigin = WEB_ORIGIN ?? '*';
const corsCredentials = Boolean(WEB_ORIGIN);

function applyCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (corsCredentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

const webRedirectBase = WEB_ORIGIN ?? '/';

function redirect(res: ServerResponse, location: string, setCookies: string[] = []): void {
  if (setCookies.length > 0) res.setHeader('Set-Cookie', setCookies);
  res.writeHead(302, { Location: location });
  res.end();
}

function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  setCookies: string[] = [],
): void {
  if (setCookies.length > 0) res.setHeader('Set-Cookie', setCookies);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return null;
  return JSON.parse(raw) as unknown;
}

// ---------------------------------------------------------------------------
// HTTP route handling
// ---------------------------------------------------------------------------

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  applyCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `http://${host}`);
  const path = url.pathname;

  if (path === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (path === '/health' || path === '/') {
    const p = getPersistence();
    let dbReady: boolean | null = null;
    let phase9Ready: boolean | null = null;
    if (p) {
      const db = getDb();
      if (db) {
        try {
          phase9Ready = await isPhase9SchemaReady(db);
          dbReady = true;
        } catch {
          dbReady = false;
        }
      }
    }
    const body = JSON.stringify({
      ok: dbReady !== false && (phase9Ready === null || phase9Ready),
      persistence: p ? 'configured' : 'disabled',
      dbReady,
      phase9Schema: phase9Ready,
    });
    res.writeHead(dbReady === false || phase9Ready === false ? 503 : 200, {
      'Content-Type': 'application/json',
    });
    res.end(body);
    return;
  }

  if (path === '/auth/google/login') {
    if (!checkOAuthRateLimit(getClientIp(req))) {
      redirect(res, `${webRedirectBase}?login=error`);
      return;
    }
    if (!isOAuthEnabled()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    const state = randomBytes(16).toString('hex');
    const sessionToken = url.searchParams.get('session_token');
    const cookies: string[] = [buildStateCookie(state, cookiesSecure())];
    if (sessionToken) {
      cookies.push(buildGuestCookie(sessionToken, cookiesSecure()));
    }
    redirect(res, getGoogleAuthUrl(state), cookies);
    return;
  }

  if (path === '/auth/google/callback') {
    if (!checkOAuthRateLimit(getClientIp(req))) {
      redirect(res, `${webRedirectBase}?login=error`, [
        buildClearStateCookie(cookiesSecure()),
        buildClearGuestCookie(cookiesSecure()),
      ]);
      return;
    }
    await handleGoogleCallback(req, res, url);
    return;
  }

  if (path === '/auth/bootstrap') {
    if (!checkBootstrapRateLimit(getClientIp(req))) {
      json(res, 429, { error: 'RATE_LIMITED' });
      return;
    }
    await handleAuthBootstrap(req, res);
    return;
  }

  if (path === '/auth/logout') {
    await handleLogout(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
}

async function handleAuthBootstrap(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('method not allowed');
    return;
  }

  const p = getPersistence();
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (p && cookieToken) {
    const tokenHash = hashToken(cookieToken);
    const resolved = await p.getAuthSessionByTokenHash(tokenHash);
    if (resolved) {
      await p.touchAuthSession(
        tokenHash,
        new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
      );
      json(res, 200, { kind: 'auth' });
      return;
    }
  }

  let legacyToken: string | undefined;
  try {
    const body = await readJsonBody(req);
    if (typeof body === 'object' && body !== null) {
      const raw = (body as Record<string, unknown>)['legacyToken'];
      if (typeof raw === 'string' && raw) legacyToken = raw;
    }
  } catch {
    json(res, 400, { kind: 'none' });
    return;
  }

  if (!legacyToken) {
    json(res, 200, { kind: 'none' });
    return;
  }

  if (p) {
    const tokenHash = hashToken(legacyToken);
    const resolved = await p.getAuthSessionByTokenHash(tokenHash);
    if (resolved) {
      await p.touchAuthSession(
        tokenHash,
        new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
      );
      json(
        res,
        200,
        { kind: 'auth' },
        [buildSessionCookie(legacyToken, SESSION_TTL_DAYS, cookiesSecure())],
      );
      return;
    }
  }

  const guestSession = getSession(legacyToken);
  if (guestSession) {
    json(res, 200, {
      kind: 'guest',
      guestToken: guestSession.token,
      playerId: guestSession.playerId,
    });
    return;
  }

  json(res, 200, { kind: 'none' });
}

async function handleGoogleCallback(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  if (!isOAuthEnabled()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  try {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const cookies = parseCookies(req.headers.cookie);
    const expectedState = cookies[OAUTH_STATE_COOKIE_NAME];

    // CSRF check: returned state must match the state cookie.
    if (!state || !expectedState || state !== expectedState) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('invalid state');
      return;
    }
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('missing code');
      return;
    }

    const profile = await exchangeCode(code);

    const p = getPersistence();
    if (!p) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('auth unavailable');
      return;
    }

    const { user, isNew } = await p.upsertOAuthUser({
      provider: 'google',
      providerUserId: profile.providerUserId,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    });

    const token = randomSessionToken();
    await p.createAuthSession({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
      userAgent: req.headers['user-agent'] ?? null,
    });

    // Track login / guest upgrade analytics.
    const isGuestUpgrade = Boolean(cookies[GUEST_COOKIE_NAME]);
    track(user.id, 'login', { provider: 'google' });
    if (isNew) {
      track(user.id, 'account_created', { provider: 'google' });
    }
    if (isGuestUpgrade) {
      track(user.id, 'guest_upgrade', {});
    }

    // Attempt guest → registered merge (non-fatal)
    const guestToken = cookies[GUEST_COOKIE_NAME];
    if (guestToken) {
      try {
        const guestSession = getSession(guestToken);
        if (guestSession && guestSession.userId === null) {
          await p.mergeGuestIntoUser(guestSession.playerId, user.id);
        }
      } catch (err) {
        console.error('[auth] guest merge failed (non-fatal):', err);
      }
    }

    const redirectUrl = new URL(webRedirectBase);
    redirectUrl.searchParams.set('auth_token', token);
    redirect(res, redirectUrl.toString(), [
      buildSessionCookie(token, SESSION_TTL_DAYS, cookiesSecure()),
      buildClearStateCookie(cookiesSecure()),
      buildClearGuestCookie(cookiesSecure()),
    ]);
  } catch (err) {
    console.error('[auth] google callback failed:', err);
    // Don't 500 the browser — bounce back to the client with an error flag.
    const base = WEB_ORIGIN ?? '';
    redirect(res, `${base}/?login=error`, [
      buildClearStateCookie(cookiesSecure()),
      buildClearGuestCookie(cookiesSecure()),
    ]);
  }
}

async function handleLogout(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    if (token) {
      const p = getPersistence();
      if (p) await p.revokeAuthSession(hashToken(token));
    }
  } catch (err) {
    console.error('[auth] logout revoke failed:', err);
  }
  redirect(res, webRedirectBase, [buildClearCookie(cookiesSecure())]);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createApp(): AppInstance {
  const httpServer = createServer((req, res) => {
    void handleRequest(req, res).catch((err) => {
      console.error('[http] request handler error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('internal error');
      }
    });
  });

  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: corsCredentials,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // Resolve a logged-in account from the session cookie (no-op for guests).
  attachSessionMiddleware(io);

  const timers: SocketHandlerTimers = setupSocketHandlers(io);

  // Rehydrate any games that were in-progress when the server last stopped.
  // Fire-and-forget: a DB failure never blocks server startup.
  void rehydrateFromDb();

  const host = process.env['HOST'] ?? '0.0.0.0';

  return {
    io,
    httpServer,
    listen(port = 0): Promise<number> {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => {
          const addr = httpServer.address();
          const boundPort = typeof addr === 'object' && addr !== null ? addr.port : port;
          resolve(boundPort);
        });
      });
    },
    close(): Promise<void> {
      // Clear both background intervals so tests (and graceful shutdown) don't
      // leak timers / keep the event loop alive.
      clearInterval(timers.roomCleanup);
      clearInterval(timers.retention);
      return new Promise((resolve, reject) => {
        io.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
