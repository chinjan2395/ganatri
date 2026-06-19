/**
 * Unit tests for the pure session/cookie helpers in auth/session.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  hashToken,
  randomSessionToken,
  parseCookies,
  buildSessionCookie,
  buildClearCookie,
  buildStateCookie,
  SESSION_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
} from './session.js';

describe('auth/session helpers', () => {
  it('hashToken is deterministic and a 64-char sha-256 hex digest', () => {
    const a = hashToken('hello');
    const b = hashToken('hello');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('hello')).not.toBe(hashToken('world'));
  });

  it('randomSessionToken returns distinct hex strings', () => {
    const t1 = randomSessionToken();
    const t2 = randomSessionToken();
    expect(t1).toMatch(/^[0-9a-f]{64}$/);
    expect(t1).not.toBe(t2);
  });

  it('parseCookies handles undefined, empty, and multiple values', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
    expect(parseCookies('a=1; b=2')).toEqual({ a: '1', b: '2' });
  });

  it('parseCookies URL-decodes values and strips quotes', () => {
    expect(parseCookies('x=%20space%20')).toEqual({ x: ' space ' });
    expect(parseCookies('q="quoted"')).toEqual({ q: 'quoted' });
  });

  it('parseCookies ignores malformed segments', () => {
    expect(parseCookies('garbage; good=ok; =noname')).toEqual({ good: 'ok' });
  });

  it('buildSessionCookie carries the security flags and Max-Age', () => {
    const c = buildSessionCookie('tok', 30);
    expect(c.startsWith(`${SESSION_COOKIE_NAME}=tok;`)).toBe(true);
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Secure');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Path=/');
    expect(c).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
  });

  it('buildClearCookie expires the session cookie immediately', () => {
    const c = buildClearCookie();
    expect(c).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(c).toContain('Max-Age=0');
    expect(c).toContain('HttpOnly');
  });

  it('buildStateCookie sets the short-lived CSRF state cookie', () => {
    const c = buildStateCookie('abc');
    expect(c.startsWith(`${OAUTH_STATE_COOKIE_NAME}=abc;`)).toBe(true);
    expect(c).toContain('Max-Age=600');
    expect(c).toContain('HttpOnly');
  });
});
