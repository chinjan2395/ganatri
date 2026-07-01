/**
 * analytics.ts — Server-side analytics abstraction.
 *
 * Uses a pluggable adapter pattern so analytics can be swapped or disabled
 * without touching business logic. The default adapter is a no-op; activate
 * PostHog (or any other provider) by calling initAnalytics() at startup.
 *
 * All track() calls are fire-and-forget — they never throw or block.
 */

// ---------------------------------------------------------------------------
// Event taxonomy
// ---------------------------------------------------------------------------

export type AnalyticsEventName =
  | 'room_created'
  | 'player_joined'
  | 'player_left'
  | 'game_started'
  | 'game_finished'
  | 'game_abandoned'
  | 'disconnect'
  | 'reconnect'
  | 'turn_timed_out'
  | 'login'
  | 'guest_upgrade'
  | 'account_created';

export interface AnalyticsProperties {
  room_created: { playerCount?: number; isLoggedIn: boolean };
  player_joined: { roomCode: string; isLoggedIn: boolean };
  player_left: { roomCode: string; inGame: boolean };
  game_started: { roomCode: string; playerCount: number };
  game_finished: { roomCode: string; playerCount: number; durationMs?: number };
  game_abandoned: { roomCode: string; playerCount: number };
  disconnect: { inGame: boolean; isLoggedIn: boolean };
  reconnect: { inGame: boolean; isLoggedIn: boolean };
  turn_timed_out: { roomCode: string };
  login: { provider: string };
  guest_upgrade: Record<string, never>;
  account_created: { provider: string };
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface AnalyticsAdapter {
  track<E extends AnalyticsEventName>(
    distinctId: string,
    event: E,
    properties?: AnalyticsProperties[E],
  ): void;
}

// ---------------------------------------------------------------------------
// No-op adapter (default)
// ---------------------------------------------------------------------------

const NO_OP: AnalyticsAdapter = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  track() { /* intentional no-op */ },
};

// ---------------------------------------------------------------------------
// PostHog adapter
// ---------------------------------------------------------------------------

class PostHogAdapter implements AnalyticsAdapter {
  constructor(private readonly apiKey: string, private readonly host: string) {}

  track<E extends AnalyticsEventName>(
    distinctId: string,
    event: E,
    properties?: AnalyticsProperties[E],
  ): void {
    void fetch(`${this.host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        distinct_id: distinctId,
        event,
        properties: properties ?? {},
        timestamp: new Date().toISOString(),
      }),
    }).catch((err: unknown) => {
      console.warn('[analytics] PostHog track failed:', err);
    });
  }
}

// ---------------------------------------------------------------------------
// Module-level state + public API
// ---------------------------------------------------------------------------

let _adapter: AnalyticsAdapter = NO_OP;

/** Call once at startup to activate an adapter. No-op adapter is the default. */
export function initAnalytics(adapter: AnalyticsAdapter): void {
  _adapter = adapter;
}

/** Export for tests only — reset to no-op between test suites. */
export function __setAnalyticsAdapterForTests(adapter: AnalyticsAdapter): void {
  _adapter = adapter;
}

/** Track an analytics event. Fire-and-forget — never throws. */
export function track<E extends AnalyticsEventName>(
  distinctId: string,
  event: E,
  properties?: AnalyticsProperties[E],
): void {
  try {
    _adapter.track(distinctId, event, properties);
  } catch (err) {
    console.warn('[analytics] track error:', err);
  }
}

/** Create a PostHog adapter if env vars are configured, else return no-op. */
export function createAdapterFromEnv(): AnalyticsAdapter {
  const apiKey = process.env['POSTHOG_API_KEY'];
  if (!apiKey) return NO_OP;
  const host = process.env['POSTHOG_HOST'] ?? 'https://us.i.posthog.com';
  return new PostHogAdapter(apiKey, host);
}
