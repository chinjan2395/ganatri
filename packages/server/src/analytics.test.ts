/**
 * analytics.test.ts — Unit tests for the analytics abstraction layer.
 *
 * Tests the NoopAnalyticsSink, PostHogAnalyticsSink, and the singleton
 * factory (getAnalytics / resetAnalyticsSink).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NoopAnalyticsSink,
  PostHogAnalyticsSink,
  getAnalytics,
  resetAnalyticsSink,
  type AnalyticsEventName,
} from './analytics.js';

// ---------------------------------------------------------------------------
// NoopAnalyticsSink
// ---------------------------------------------------------------------------

describe('NoopAnalyticsSink', () => {
  it('track() does not throw for any event name', () => {
    const sink = new NoopAnalyticsSink();
    const events: AnalyticsEventName[] = [
      'room_created',
      'game_started',
      'game_finished',
      'game_abandoned',
      'player_joined',
      'player_left',
      'turn_timed_out',
      'player_disconnected',
      'player_reconnected',
      'account_created',
      'guest_upgraded',
    ];
    for (const event of events) {
      expect(() => sink.track(event)).not.toThrow();
    }
  });

  it('track() with props does not throw', () => {
    const sink = new NoopAnalyticsSink();
    expect(() =>
      sink.track('room_created', { playerCount: 1, isRanked: false, label: 'test', nullable: null }),
    ).not.toThrow();
  });

  it('calling track() on room_created — no error (integration smoke)', () => {
    const sink = new NoopAnalyticsSink();
    // Fire-and-forget — no return value, no side effects, no error.
    sink.track('room_created');
    // If we reach here without throwing, the test passes.
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PostHogAnalyticsSink
// ---------------------------------------------------------------------------

describe('PostHogAnalyticsSink', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    // Save real fetch and replace with a spy that resolves immediately.
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('track() does not throw when called', () => {
    const sink = new PostHogAnalyticsSink('test-key');
    expect(() => sink.track('game_started', { playerCount: 2 })).not.toThrow();
  });

  it('track() fires a POST to the PostHog capture endpoint (fire-and-forget)', async () => {
    const sink = new PostHogAnalyticsSink('test-key', 'https://us.i.posthog.com');
    sink.track('room_created', { playerCount: 1 });

    // Drain microtask queue so the fire-and-forget fetch resolves.
    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://us.i.posthog.com/capture');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body['api_key']).toBe('test-key');
    expect(body['event']).toBe('room_created');
    expect(body['distinct_id']).toBe('server');
  });

  it('track() does not throw even when fetch rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const sink = new PostHogAnalyticsSink('test-key');
    expect(() => sink.track('game_started')).not.toThrow();

    // Drain so the rejection handler runs and logs the error silently.
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// getAnalytics() singleton factory
// ---------------------------------------------------------------------------

describe('getAnalytics()', () => {
  afterEach(() => {
    resetAnalyticsSink();
    delete process.env['POSTHOG_API_KEY'];
  });

  it('returns a NoopAnalyticsSink when POSTHOG_API_KEY env var is not set', () => {
    delete process.env['POSTHOG_API_KEY'];
    resetAnalyticsSink();
    const sink = getAnalytics();
    expect(sink).toBeInstanceOf(NoopAnalyticsSink);
  });

  it('returns a PostHogAnalyticsSink when POSTHOG_API_KEY is set', () => {
    process.env['POSTHOG_API_KEY'] = 'test-key';
    resetAnalyticsSink();
    const sink = getAnalytics();
    expect(sink).toBeInstanceOf(PostHogAnalyticsSink);
  });

  it('returns the same singleton instance on repeated calls', () => {
    delete process.env['POSTHOG_API_KEY'];
    resetAnalyticsSink();
    const a = getAnalytics();
    const b = getAnalytics();
    expect(a).toBe(b);
  });

  it('resetAnalyticsSink() allows the factory to re-create with a new env var', () => {
    delete process.env['POSTHOG_API_KEY'];
    resetAnalyticsSink();
    const noopSink = getAnalytics();
    expect(noopSink).toBeInstanceOf(NoopAnalyticsSink);

    process.env['POSTHOG_API_KEY'] = 'new-key';
    resetAnalyticsSink();
    const postHogSink = getAnalytics();
    expect(postHogSink).toBeInstanceOf(PostHogAnalyticsSink);
  });

  it('PostHogAnalyticsSink.track() does not throw when POSTHOG_API_KEY is set', () => {
    process.env['POSTHOG_API_KEY'] = 'test-key';
    resetAnalyticsSink();
    const sink = getAnalytics();
    // Should not throw — fire-and-forget.
    expect(() => sink.track('room_created', { playerCount: 1 })).not.toThrow();
  });
});
