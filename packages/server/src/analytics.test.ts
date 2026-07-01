/**
 * analytics.test.ts — Unit tests for the analytics adapter abstraction.
 *
 * Tests the adapter interface, PostHog adapter, no-op adapter, and public API.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  track,
  initAnalytics,
  __setAnalyticsAdapterForTests,
  createAdapterFromEnv,
  type AnalyticsAdapter,
  type AnalyticsEventName,
} from './analytics.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Spy adapter that records all track() calls. */
class SpyAdapter implements AnalyticsAdapter {
  calls: Array<{ distinctId: string; event: AnalyticsEventName; properties?: unknown }> = [];

  track<E extends AnalyticsEventName>(
    distinctId: string,
    event: E,
    properties?: unknown,
  ): void {
    this.calls.push({ distinctId, event, properties });
  }
}

// ---------------------------------------------------------------------------
// Main track() API
// ---------------------------------------------------------------------------

describe('track() function', () => {
  let spyAdapter: SpyAdapter;

  beforeEach(() => {
    spyAdapter = new SpyAdapter();
    __setAnalyticsAdapterForTests(spyAdapter);
  });

  afterEach(() => {
    __setAnalyticsAdapterForTests(new SpyAdapter());
  });

  it('delegates to the active adapter', () => {
    track('user-123', 'room_created', { playerCount: 2, isLoggedIn: true });
    expect(spyAdapter.calls).toEqual([
      { distinctId: 'user-123', event: 'room_created', properties: { playerCount: 2, isLoggedIn: true } },
    ]);
  });

  it('enforces type safety on properties', () => {
    // This should compile; TS will enforce that 'login' events must have { provider: string }
    track('user-123', 'login', { provider: 'google' });
    expect(spyAdapter.calls[0]?.properties).toEqual({ provider: 'google' });
  });

  it('accepts undefined properties', () => {
    track('user-123', 'guest_upgrade');
    expect(spyAdapter.calls).toEqual([
      { distinctId: 'user-123', event: 'guest_upgrade', properties: undefined },
    ]);
  });

  it('catches adapter errors and logs them (never throws)', () => {
    const errorAdapter: AnalyticsAdapter = {
      track() {
        throw new Error('adapter error');
      },
    };
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    __setAnalyticsAdapterForTests(errorAdapter);

    // Should not throw.
    expect(() => track('user-123', 'room_created', { playerCount: 1, isLoggedIn: false })).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('[analytics] track error:', expect.any(Error));

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// initAnalytics() setup
// ---------------------------------------------------------------------------

describe('initAnalytics()', () => {
  let spyAdapter: SpyAdapter;

  beforeEach(() => {
    spyAdapter = new SpyAdapter();
  });

  it('activates a custom adapter', () => {
    initAnalytics(spyAdapter);
    track('user-123', 'room_created', { playerCount: 1, isLoggedIn: false });
    expect(spyAdapter.calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// createAdapterFromEnv() factory
// ---------------------------------------------------------------------------

describe('createAdapterFromEnv()', () => {
  afterEach(() => {
    delete process.env['POSTHOG_API_KEY'];
    delete process.env['POSTHOG_HOST'];
  });

  it('returns a no-op adapter when POSTHOG_API_KEY is not set', () => {
    delete process.env['POSTHOG_API_KEY'];
    const adapter = createAdapterFromEnv();
    const spy = new SpyAdapter();
    // No-op adapter is a plain object, so just check it doesn't throw.
    expect(() => adapter.track('user-123', 'room_created', { playerCount: 1, isLoggedIn: false })).not.toThrow();
  });

  it('returns a PostHog adapter when POSTHOG_API_KEY is set', () => {
    process.env['POSTHOG_API_KEY'] = 'test-api-key';
    const adapter = createAdapterFromEnv();
    // Verify it's a PostHog adapter by checking fetch is called.
    const fetchSpy = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    globalThis.fetch = fetchSpy;

    adapter.track('user-123', 'room_created', { playerCount: 1, isLoggedIn: false });
    // Fire-and-forget, so we need to wait for microtask.
    vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  it('uses custom POSTHOG_HOST if provided', () => {
    process.env['POSTHOG_API_KEY'] = 'test-api-key';
    process.env['POSTHOG_HOST'] = 'https://custom.posthog.com';
    const adapter = createAdapterFromEnv();
    const fetchSpy = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    globalThis.fetch = fetchSpy;

    adapter.track('user-123', 'room_created', { playerCount: 1, isLoggedIn: false });
    vi.waitFor(() => {
      const [url] = (fetchSpy.mock.calls[0] ?? []) as [string];
      expect(url).toContain('custom.posthog.com');
    });
  });
});
