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
import { attachSessionMiddleware } from './auth/sessionMiddleware.js';
import {
  isOAuthEnabled,
  WEB_ORIGIN,
  SESSION_TTL_DAYS,
  cookiesSecure,
  getAdminSecret,
} from './config.js';
import { getGoogleAuthUrl, exchangeCode } from './auth/oauth.js';
import { getPersistence } from './persistence.js';
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

export interface AppInstance {
  io: Server;
  httpServer: ReturnType<typeof createServer>;
  /** Start listening. Returns the bound port. */
  listen(port?: number): Promise<number>;
  /** Gracefully close all connections. */
  close(): Promise<void>;
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

  if (path === '/health' || path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (path === '/auth/google/login') {
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
    await handleGoogleCallback(req, res, url);
    return;
  }

  if (path === '/auth/logout') {
    await handleLogout(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
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

    const user = await p.upsertOAuthUser({
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

    redirect(res, `${webRedirectBase}?auth_token=${encodeURIComponent(token)}`, [
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

  const host = process.env['HOST'] ?? '0.0.0.0';

  return {
    io,
    httpServer,
    listen(port = 0): Promise<number> {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => {
          if (getAdminSecret() === '') {
            console.warn('[admin] ADMIN_SECRET is not set — admin auth requires email only (insecure mode).');
          }
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
