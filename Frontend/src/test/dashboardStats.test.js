import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fmtDuration, timeAgo, computeFeedingStats, computeSleepStats } from '../lib/dashboardStats.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── fmtDuration ────────────────────────────────────────────────────────────────

describe('fmtDuration', () => {
  it('returns "0m" for 0 seconds', () => {
    expect(fmtDuration(0)).toBe('0m');
  });

  it('returns "0m" for null/undefined', () => {
    expect(fmtDuration(null)).toBe('0m');
    expect(fmtDuration(undefined)).toBe('0m');
  });

  it('returns "0m" for negative values', () => {
    expect(fmtDuration(-10)).toBe('0m');
  });

  it('returns minutes only for < 1 hour', () => {
    expect(fmtDuration(45)).toBe('0m');    // 45s = 0 full minutes
    expect(fmtDuration(60)).toBe('1m');    // exactly 1 minute
    expect(fmtDuration(90)).toBe('1m');    // 1m 30s → 1m (floor)
    expect(fmtDuration(120)).toBe('2m');
  });

  it('returns "1m 30s" equivalent — 90 seconds shows as 1m', () => {
    // fmtDuration floors to minutes: 90s = 1m 30s → shows "1m"
    expect(fmtDuration(90)).toBe('1m');
  });

  it('returns "1h 0m" for exactly 3600 seconds', () => {
    expect(fmtDuration(3600)).toBe('1h 0m');
  });

  it('returns "1h 2m" for 3750 seconds', () => {
    // 3750s = 1h + 150s; floor(150/60) = 2m
    expect(fmtDuration(3750)).toBe('1h 2m');
  });

  it('returns "10h 30m" for a long sleep', () => {
    expect(fmtDuration(10 * 3600 + 30 * 60)).toBe('10h 30m');
  });
});

// ── timeAgo ────────────────────────────────────────────────────────────────────

describe('timeAgo', () => {
  it('returns "just now" for timestamps less than 1 minute ago', () => {
    // Use 20s ago: Math.round(20/60) = 0 → "just now". 30s rounds to 1 (Math.round(0.5)=1).
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    expect(timeAgo('2026-04-16T11:59:40Z')).toBe('just now');
  });

  it('returns "just now" for the exact current timestamp', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    expect(timeAgo('2026-04-16T12:00:00Z')).toBe('just now');
  });

  it('returns "45m ago" for 45 minutes ago', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    expect(timeAgo('2026-04-16T11:15:00Z')).toBe('45m ago');
  });

  it('returns "1h ago" for exactly 1 hour ago', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    expect(timeAgo('2026-04-16T11:00:00Z')).toBe('1h ago');
  });

  it('returns "2h 30m ago" for 2.5 hours ago', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    expect(timeAgo('2026-04-16T09:30:00Z')).toBe('2h 30m ago');
  });

  it('returns "Nh ago" (no minutes) when remainder is 0', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    expect(timeAgo('2026-04-16T10:00:00Z')).toBe('2h ago');
  });
});

// ── computeFeedingStats ────────────────────────────────────────────────────────

describe('computeFeedingStats', () => {
  it('returns nulls and empty for empty array', () => {
    const { mostRecentFeed, todayFeeds, avgGapStr } = computeFeedingStats([]);
    expect(mostRecentFeed).toBeNull();
    expect(todayFeeds).toHaveLength(0);
    expect(avgGapStr).toBeNull();
  });

  it('returns nulls and empty for null input', () => {
    const { mostRecentFeed, todayFeeds, avgGapStr } = computeFeedingStats(null);
    expect(mostRecentFeed).toBeNull();
    expect(todayFeeds).toHaveLength(0);
    expect(avgGapStr).toBeNull();
  });

  it('excludes feeds without endedAt from completed feeds', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    const feeds = [
      { id: 1, startedAt: '2026-04-16T08:00:00Z', endedAt: null }, // incomplete
      { id: 2, startedAt: '2026-04-16T09:00:00Z', endedAt: '2026-04-16T09:20:00Z' },
    ];
    const { mostRecentFeed, todayFeeds } = computeFeedingStats(feeds);
    expect(mostRecentFeed.id).toBe(2);
    expect(todayFeeds).toHaveLength(1);
  });

  it('correctly identifies the most recent feed', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    const feeds = [
      { id: 1, startedAt: '2026-04-16T07:00:00Z', endedAt: '2026-04-16T07:20:00Z' },
      { id: 2, startedAt: '2026-04-16T10:00:00Z', endedAt: '2026-04-16T10:18:00Z' },
    ];
    const { mostRecentFeed } = computeFeedingStats(feeds);
    expect(mostRecentFeed.id).toBe(2);
  });

  it('computes avgGapStr for 3 today feeds', () => {
    vi.setSystemTime(new Date('2026-04-16T14:00:00Z'));
    // Three feeds: 7am, 10am, 13pm → gaps are 180min, 180min → avg 180min = 3h 0m
    const feeds = [
      { id: 1, startedAt: '2026-04-16T07:00:00Z', endedAt: '2026-04-16T07:20:00Z' },
      { id: 2, startedAt: '2026-04-16T10:00:00Z', endedAt: '2026-04-16T10:18:00Z' },
      { id: 3, startedAt: '2026-04-16T13:00:00Z', endedAt: '2026-04-16T13:22:00Z' },
    ];
    const { avgGapStr } = computeFeedingStats(feeds);
    expect(avgGapStr).toBe('3h 0m');
  });

  it('returns null avgGapStr when only 1 feed today', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    const feeds = [
      { id: 1, startedAt: '2026-04-16T09:00:00Z', endedAt: '2026-04-16T09:20:00Z' },
    ];
    const { avgGapStr } = computeFeedingStats(feeds);
    expect(avgGapStr).toBeNull();
  });
});

// ── computeSleepStats ──────────────────────────────────────────────────────────

describe('computeSleepStats', () => {
  it('returns zeros for empty array', () => {
    const { completedSleep, totalSleepSecs, longestSleepSecs, mostRecentSleep } = computeSleepStats([]);
    expect(completedSleep).toHaveLength(0);
    expect(totalSleepSecs).toBe(0);
    expect(longestSleepSecs).toBe(0);
    expect(mostRecentSleep).toBeNull();
  });

  it('returns zeros for null input', () => {
    const { totalSleepSecs } = computeSleepStats(null);
    expect(totalSleepSecs).toBe(0);
  });

  it('only includes sleep from last 24 hours', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    const sleep = [
      // 36 hours ago — should be excluded
      { id: 1, startedAt: '2026-04-15T00:00:00Z', endedAt: '2026-04-15T08:00:00Z' },
      // 2 hours ago — should be included
      { id: 2, startedAt: '2026-04-16T09:30:00Z', endedAt: '2026-04-16T10:00:00Z' },
    ];
    const { completedSleep } = computeSleepStats(sleep);
    expect(completedSleep).toHaveLength(1);
    expect(completedSleep[0].id).toBe(2);
  });

  it('sums total sleep seconds correctly', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    // Two sessions: 1h and 30m = 5400s total
    const sleep = [
      { id: 1, startedAt: '2026-04-16T07:00:00Z', endedAt: '2026-04-16T08:00:00Z' }, // 3600s
      { id: 2, startedAt: '2026-04-16T09:00:00Z', endedAt: '2026-04-16T09:30:00Z' }, // 1800s
    ];
    const { totalSleepSecs } = computeSleepStats(sleep);
    expect(totalSleepSecs).toBe(5400);
  });

  it('identifies longest sleep session', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    const sleep = [
      { id: 1, startedAt: '2026-04-16T07:00:00Z', endedAt: '2026-04-16T08:00:00Z' }, // 3600s
      { id: 2, startedAt: '2026-04-16T09:00:00Z', endedAt: '2026-04-16T11:00:00Z' }, // 7200s (longest)
    ];
    const { longestSleepSecs } = computeSleepStats(sleep);
    expect(longestSleepSecs).toBe(7200);
  });

  it('identifies most recent sleep session', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    const sleep = [
      { id: 1, startedAt: '2026-04-16T07:00:00Z', endedAt: '2026-04-16T08:00:00Z' },
      { id: 2, startedAt: '2026-04-16T09:00:00Z', endedAt: '2026-04-16T11:00:00Z' },
    ];
    const { mostRecentSleep } = computeSleepStats(sleep);
    expect(mostRecentSleep.id).toBe(2);
  });

  it('excludes sessions without endedAt', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    const sleep = [
      { id: 1, startedAt: '2026-04-16T09:00:00Z', endedAt: null }, // ongoing
      { id: 2, startedAt: '2026-04-16T07:00:00Z', endedAt: '2026-04-16T08:00:00Z' },
    ];
    const { completedSleep } = computeSleepStats(sleep);
    expect(completedSleep).toHaveLength(1);
    expect(completedSleep[0].id).toBe(2);
  });
});
