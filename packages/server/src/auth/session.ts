/**
 * auth/session.ts — pure helpers for opaque session tokens and cookies.
 *
 * No socket.io / DB imports — everything here is deterministic and unit-tested.
 */

import { randomBytes, createHash } from 'node:crypto';

/** The cookie carrying the opaque session token. */
export const SESSION_COOKIE_NAME = 'ganatri_session';
/** The short-lived cookie carrying the OAuth CSRF state value. */
export const OAUTH_STATE_COOKIE_NAME = 'ganatri_oauth_state';

/** Generate a cryptographically random opaque session token (hex). */
export function randomSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/** SHA-256 hex digest of a token. Deterministic — used as the DB lookup key. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Parse a raw `Cookie` header into a name→value map. Returns an empty object
 * for undefined/empty/malformed input. Values are URL-decoded best-effort.
 */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    let value = part.slice(eq + 1).trim();
    // Strip surrounding quotes if present.
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/** The `; Secure` fragment when `secure`, else empty. */
function secureFlag(secure: boolean): string {
  return secure ? '; Secure' : '';
}

/**
 * Build the `Set-Cookie` value for the session cookie.
 * httpOnly, SameSite=Lax, Path=/, Max-Age derived from ttlDays. `Secure` is
 * included unless `secure` is false (local HTTP dev only).
 */
export function buildSessionCookie(token: string, ttlDays: number, secure = true): string {
  const maxAge = Math.max(0, Math.floor(ttlDays * 24 * 60 * 60));
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly${secureFlag(secure)}; SameSite=Lax`;
}

/** Build the `Set-Cookie` value that clears the session cookie. */
export function buildClearCookie(secure = true): string {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly${secureFlag(secure)}; SameSite=Lax`;
}

/** Build a short-lived (10 min) httpOnly cookie holding the OAuth CSRF state. */
export function buildStateCookie(state: string, secure = true): string {
  return `${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(state)}; Max-Age=600; Path=/; HttpOnly${secureFlag(secure)}; SameSite=Lax`;
}

/** Build the `Set-Cookie` value that clears the OAuth state cookie. */
export function buildClearStateCookie(secure = true): string {
  return `${OAUTH_STATE_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly${secureFlag(secure)}; SameSite=Lax`;
}
