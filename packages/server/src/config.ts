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
}

const _config: GameConfig = {
  turnTimeoutMs: Number(process.env['TURN_TIMEOUT_MS'] ?? 10_000),
  maxPlayers: Number(process.env['MAX_PLAYERS'] ?? 4),
  gracePeriodMs: Number(process.env['GRACE_PERIOD_MS'] ?? 60_000),
  roomExpiryMs: Number(process.env['ROOM_EXPIRY_MS'] ?? 3_600_000),
};

/** Returns a read-only snapshot of the current config. */
export function getConfig(): Readonly<GameConfig> {
  return _config;
}

/** Merge a partial patch into the live config. Takes effect on the next timer/action. */
export function updateConfig(patch: Partial<GameConfig>): void {
  Object.assign(_config, patch);
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
