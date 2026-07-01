/**
 * analytics.ts — Fire-and-forget analytics sink abstraction.
 *
 * Event taxonomy uses anonymous IDs only — no PII (no display names, emails,
 * or room codes). All sensitive identifiers are stripped before leaving the
 * server; only counts, durations, and booleans are collected.
 */

import { POSTHOG_HOST as DEFAULT_POSTHOG_HOST } from './config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnalyticsEventName =
  | 'room_created'
  | 'game_started'
  | 'game_finished'
  | 'game_abandoned'
  | 'player_joined'
  | 'player_left'
  | 'turn_timed_out'
  | 'player_disconnected'
  | 'player_reconnected'
  | 'account_created'
  | 'guest_upgraded';

export type AnalyticsProps = Record<string, string | number | boolean | null>;

export interface AnalyticsSink {
  track(event: AnalyticsEventName, props?: AnalyticsProps): void;
}

// ---------------------------------------------------------------------------
// NoopAnalyticsSink — default when POSTHOG_API_KEY is not set
// ---------------------------------------------------------------------------

export class NoopAnalyticsSink implements AnalyticsSink {
  track(_event: AnalyticsEventName, _props?: AnalyticsProps): void {
    // Intentionally empty — no-op.
  }
}

// ---------------------------------------------------------------------------
// PostHogAnalyticsSink — fire-and-forget via Node 18+ built-in fetch
// ---------------------------------------------------------------------------

export class PostHogAnalyticsSink implements AnalyticsSink {
  private readonly apiKey: string;
  private readonly host: string;

  constructor(apiKey: string, host?: string) {
    this.apiKey = apiKey;
    this.host = (host ?? DEFAULT_POSTHOG_HOST).replace(/\/$/, '');
  }

  track(event: AnalyticsEventName, props?: AnalyticsProps): void {
    const body = JSON.stringify({
      api_key: this.apiKey,
      distinct_id: 'server',
      event,
      timestamp: new Date().toISOString(),
      properties: { ...props },
    });

    // Fire-and-forget: never awaited, errors are caught and logged silently.
    void fetch(`${this.host}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch((err: unknown) => {
      console.error('[analytics] posthog capture failed (non-fatal):', err);
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _sink: AnalyticsSink | null = null;

/**
 * Returns the active analytics sink. Reads POSTHOG_API_KEY from process.env
 * at the time of first call (or after resetAnalyticsSink). When the env var
 * is not set, returns a NoopAnalyticsSink that does nothing.
 */
export function getAnalytics(): AnalyticsSink {
  if (!_sink) {
    const key = process.env['POSTHOG_API_KEY'];
    _sink = key ? new PostHogAnalyticsSink(key) : new NoopAnalyticsSink();
  }
  return _sink;
}

/** Reset for tests — allows the factory to re-create with a different env. */
export function resetAnalyticsSink(): void {
  _sink = null;
}
