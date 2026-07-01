/**
 * analytics.test.ts
 *
 * Unit tests for the analytics module: adapter wiring, fire-and-forget
 * semantics, no-op default, createAdapterFromEnv() factory.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initAnalytics,
  track,
  createAdapterFromEnv,
  __setAnalyticsAdapterForTests,
  type AnalyticsAdapter,
} from './analytics.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpyAdapter(): AnalyticsAdapter & { calls: Array<{ distinctId: string; event: string; properties: unknown }> } {
  const calls: Array<{ distinctId: string; event: string; properties: unknown }> = [];
  return {
    calls,
    track(distinctId, event, properties) {
      calls.push({ distinctId, event, properties });
    },
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('analytics module', () => {
  afterEach(() => {
    // Reset to no-op after every test so state doesn't leak.
    __setAnalyticsAdapterForTests({ track() { /* no-op */ } });
    delete process.env['POSTHOG_API_KEY'];
    delete process.env['POSTHOG_HOST'];
  });

  it('initAnalytics with no-op adapter does not throw', () => {
    expect(() => {
      initAnalytics({ track() { /* no-op */ } });
    }).not.toThrow();
  });

  it('track() with default no-op adapter does not throw', () => {
    // Reset to built-in no-op (module initialises with NO_OP).
    __setAnalyticsAdapterForTests({ track() { /* no-op */ } });
    expect(() => {
      track('user-1', 'room_created', { isLoggedIn: false });
    }).not.toThrow();
  });

  it('track() calls through to a custom adapter with correct arguments', () => {
    const spy = makeSpyAdapter();
    __setAnalyticsAdapterForTests(spy);

    track('player-abc', 'game_started', { roomCode: 'ABC123', playerCount: 3 });

    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0]).toEqual({
      distinctId: 'player-abc',
      event: 'game_started',
      properties: { roomCode: 'ABC123', playerCount: 3 },
    });
  });

  it('track() is fire-and-forget — never throws even when adapter throws', () => {
    const throwingAdapter: AnalyticsAdapter = {
      track() {
        throw new Error('adapter failure');
      },
    };
    __setAnalyticsAdapterForTests(throwingAdapter);

    // Should not propagate the error.
    expect(() => {
      track('player-xyz', 'disconnect', { inGame: false, isLoggedIn: true });
    }).not.toThrow();
  });

  it('createAdapterFromEnv() returns no-op when POSTHOG_API_KEY is not set', () => {
    delete process.env['POSTHOG_API_KEY'];
    const adapter = createAdapterFromEnv();
    // No-op adapter: calling track should not throw.
    expect(() => {
      adapter.track('user-1', 'login', { provider: 'google' });
    }).not.toThrow();
  });

  it('createAdapterFromEnv() returns a functional adapter when POSTHOG_API_KEY is set', () => {
    process.env['POSTHOG_API_KEY'] = 'test-key-123';
    const adapter = createAdapterFromEnv();
    // It should have a track function (it's the PostHogAdapter).
    expect(typeof adapter.track).toBe('function');
    // Calling track should not throw (fetch will fail silently in tests).
    expect(() => {
      adapter.track('user-1', 'game_finished', { roomCode: 'TEST01', playerCount: 2 });
    }).not.toThrow();
  });

  it('createAdapterFromEnv() uses default PostHog host when POSTHOG_HOST is not set', () => {
    process.env['POSTHOG_API_KEY'] = 'test-key-456';
    delete process.env['POSTHOG_HOST'];
    // Should not throw when creating the adapter (default host is used internally).
    expect(() => {
      const adapter = createAdapterFromEnv();
      // Adapter should be non-null and functional.
      expect(typeof adapter.track).toBe('function');
    }).not.toThrow();
  });

  it('initAnalytics activates the adapter so subsequent track() calls use it', () => {
    const spy = makeSpyAdapter();
    initAnalytics(spy);

    track('player-1', 'player_joined', { roomCode: 'ROOM01', isLoggedIn: true });
    track('player-2', 'game_abandoned', { roomCode: 'ROOM01', playerCount: 2 });

    expect(spy.calls).toHaveLength(2);
    expect(spy.calls[0]?.event).toBe('player_joined');
    expect(spy.calls[1]?.event).toBe('game_abandoned');
  });
});
