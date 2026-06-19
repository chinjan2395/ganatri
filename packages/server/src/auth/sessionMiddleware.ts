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
  }
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
    const token = cookies[SESSION_COOKIE_NAME];
    if (!token) return;

    const user = await p.getUserBySessionTokenHash(hashToken(token));
    if (!user) return;

    socket.data.userId = user.id;
    socket.data.account = {
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  } catch (err) {
    console.error('[auth] session middleware error (continuing as guest):', err);
  }
}
