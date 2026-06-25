/**
 * auth/sessionMiddleware.ts — Socket.io connection middleware that resolves a
 * logged-in user from the `ganatri_session` cookie (if any).
 *
 * Guarantees:
 *  - Never throws — any error is logged and the connection proceeds as a guest.
 *  - When DATABASE_URL / persistence is unavailable, it is a pure no-op.
 *  - On a valid session it sets `socket.data.userId` + `socket.data.account`.
 */

import type { Server, Socket } from 'socket.io';
import { getPersistence } from '../persistence.js';
import { SESSION_TTL_DAYS } from '../config.js';
import { parseCookies, hashToken, SESSION_COOKIE_NAME } from './session.js';

/** Account fields attached to an authenticated socket. */
export interface SocketAccount {
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}

declare module 'socket.io' {
  interface SocketData {
    userId?: string;
    account?: SocketAccount;
    authSessionId?: string;
    authSessionTokenHash?: string;
    authSessionTouchedAt?: number;
  }
}

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

function nextExpiryDate(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Wire the session-resolution middleware onto an io server. */
export function attachSessionMiddleware(io: Server): void {
  io.use((socket: Socket, next: (err?: Error) => void) => {
    void resolveSession(socket).finally(() => next());
  });
}

async function resolveSession(socket: Socket): Promise<void> {
  try {
    const p = getPersistence();
    if (!p) return;

    const cookies = parseCookies(socket.handshake.headers.cookie);
    // Prefer the httpOnly cookie. Fall back to a one-shot authSessionToken sent in
    // the handshake after OAuth when the web client and API are on different sites.
    const token =
      cookies[SESSION_COOKIE_NAME]
      ?? (socket.handshake.auth['authSessionToken'] as string | undefined);
    if (!token) return;

    const tokenHash = hashToken(token);
    const resolved = await p.getAuthSessionByTokenHash(tokenHash);
    if (!resolved) return;
    const touched = await p.touchAuthSession(tokenHash, nextExpiryDate());
    const session = touched ?? resolved.session;

    socket.data.userId = resolved.user.id;
    socket.data.account = {
      displayName: resolved.user.displayName,
      email: resolved.user.email,
      avatarUrl: resolved.user.avatarUrl,
    };
    socket.data.authSessionId = session.id;
    socket.data.authSessionTokenHash = tokenHash;
    socket.data.authSessionTouchedAt = Date.now();
  } catch (err) {
    console.error('[auth] session middleware error (continuing as guest):', err);
  }
}

export function maybeTouchAuthenticatedSession(socket: Socket): void {
  const userId = socket.data.userId;
  const tokenHash = socket.data.authSessionTokenHash;
  if (!userId || !tokenHash) return;

  const now = Date.now();
  if (now - (socket.data.authSessionTouchedAt ?? 0) < TOUCH_INTERVAL_MS) return;
  socket.data.authSessionTouchedAt = now;

  const p = getPersistence();
  if (!p) return;

  void p.touchAuthSession(tokenHash, nextExpiryDate()).catch((err) => {
    console.error(`[auth] touchAuthSession failed for ${userId}:`, err);
  });
}
