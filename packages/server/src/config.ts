/**
 * Runtime configuration for the Ganatri server.
 *
 * Defaults are read from environment variables at startup. The admin socket
 * API (handlers.ts) can override values at runtime via updateConfig().
 */

export interface GameConfig {
  turnTimeoutMs: number;
  maxPlayers: number;
  gracePeriodMs: number;
  roomExpiryMs: number;
  databaseUrl?: string;
}

/**
 * Parse a numeric env var, falling back to `fallback` when the value is absent,
 * malformed, or non-finite (so a bad env never yields `NaN`).
 */
function numEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const _config: GameConfig = {
  turnTimeoutMs: numEnv(process.env['TURN_TIMEOUT_MS'], 10_000),
  maxPlayers: numEnv(process.env['MAX_PLAYERS'], 4),
  gracePeriodMs: numEnv(process.env['GRACE_PERIOD_MS'], 60_000),
  roomExpiryMs: numEnv(process.env['ROOM_EXPIRY_MS'], 3_600_000),
  databaseUrl: process.env['DATABASE_URL'],
};

/** Returns a read-only snapshot of the current config. */
export function getConfig(): Readonly<GameConfig> {
  return _config;
}

/** Merge a partial patch into the live config. Takes effect on the next timer/action. */
export function updateConfig(patch: Partial<GameConfig>): void {
  Object.assign(_config, patch);
}

// ---------------------------------------------------------------------------
// OAuth / session env config
// ---------------------------------------------------------------------------

/** Days a server-issued auth session token remains valid (default 30). */
export const SESSION_TTL_DAYS: number = numEnv(process.env['SESSION_TTL_DAYS'], 30);

/** Days of game data to retain before the daily prune job removes it. */
export const RETENTION_DAYS: number = numEnv(process.env['RETENTION_DAYS'], 30);

/**
 * Whether the `Secure` attribute should be set on auth cookies. Secure by
 * default; only disabled when `INSECURE_COOKIES=true` (local HTTP dev only,
 * since `Secure` cookies are dropped over `http://localhost`).
 */
export function cookiesSecure(): boolean {
  return process.env['INSECURE_COOKIES'] !== 'true';
}

/** Google OAuth client id (unset → OAuth disabled). */
export const GOOGLE_CLIENT_ID: string | undefined = process.env['GOOGLE_CLIENT_ID'];
/** Google OAuth client secret (unset → OAuth disabled). */
export const GOOGLE_CLIENT_SECRET: string | undefined = process.env['GOOGLE_CLIENT_SECRET'];
/** OAuth redirect URI registered with Google (unset → OAuth disabled). */
export const OAUTH_REDIRECT_URI: string | undefined = process.env['OAUTH_REDIRECT_URI'];
/** Public origin of the web client, used for CORS + post-login redirects. */
export const WEB_ORIGIN: string | undefined = process.env['WEB_ORIGIN'];

/**
 * True only when all three Google OAuth env vars are set. When false, every
 * OAuth route 404s and the server behaves exactly as a no-op guest-only build.
 */
export function isOAuthEnabled(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && OAUTH_REDIRECT_URI);
}

const _adminEmails = new Set(
  (process.env['ADMIN_EMAILS'] ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/** Returns true if the given email is in the ADMIN_EMAILS set. */
export function isAdminEmail(email: string): boolean {
  return _adminEmails.has(email.trim().toLowerCase());
}
