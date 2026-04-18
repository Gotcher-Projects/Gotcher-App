import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWeek, formatBabyAge } from '../lib/babyAge.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── getWeek ────────────────────────────────────────────────────────────────────

describe('getWeek', () => {
  it('returns 0 for null birthdate', () => {
    expect(getWeek(null)).toBe(0);
  });

  it('returns 0 for empty string birthdate', () => {
    expect(getWeek('')).toBe(0);
  });

  it('returns 0 when birthdate is today', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    expect(getWeek('2026-04-16')).toBe(0);
  });

  it('returns 0 for a future birthdate (clamps to 0)', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    expect(getWeek('2026-04-23')).toBe(0);
  });

  it('returns correct week count for a known past date', () => {
    // Pin time to 2026-04-16 noon UTC and birthdate to 2025-11-02
    // 2025-11-02 → 2026-04-16 = 165 days = 23 full weeks
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    const weeks = getWeek('2025-11-02');
    expect(weeks).toBe(23);
  });

  it('returns 4 for a baby exactly 4 weeks old', () => {
    // 4 weeks before 2026-04-16 = 2026-03-19
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    expect(getWeek('2026-03-19')).toBe(4);
  });

  it('returns 1 for a baby exactly 7 days old', () => {
    // 7 days before 2026-04-16 = 2026-04-09
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    expect(getWeek('2026-04-09')).toBe(1);
  });
});

// ── formatBabyAge ──────────────────────────────────────────────────────────────

describe('formatBabyAge', () => {
  it('returns null for null birthdate', () => {
    expect(formatBabyAge(null)).toBeNull();
  });

  it('returns null for empty string birthdate', () => {
    expect(formatBabyAge('')).toBeNull();
  });

  it('shows weeks and days for babies under 13 weeks', () => {
    // 2026-04-16 - 73 days = 2026-02-02 (10 weeks + 3 days)
    vi.setSystemTime(new Date('2026-04-16T12:00:00'));
    const result = formatBabyAge('2026-02-02');
    expect(result).toContain('week');
    expect(result).toContain('day');
    expect(result).toContain('old');
  });

  it('shows exactly N weeks when days remainder is 0', () => {
    // 2025-12-25 + 56 days = 2026-02-19 (exactly 8 weeks). Both in standard time — no DST crossing.
    vi.setSystemTime(new Date('2026-02-19T12:00:00Z'));
    const result = formatBabyAge('2025-12-25');
    expect(result).toBe('8 weeks old');
  });

  it('returns "1 week and 1 day old" for 8 days', () => {
    // 2026-04-08 + 8 days = 2026-04-16
    vi.setSystemTime(new Date('2026-04-16T12:00:00'));
    const result = formatBabyAge('2026-04-08');
    expect(result).toBe('1 week and 1 day old');
  });

  it('shows months for babies 13+ weeks old', () => {
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    // Lily: born 2025-11-02, ~5 months old
    const result = formatBabyAge('2025-11-02');
    expect(result).toContain('month');
    expect(result).toContain('old');
    expect(result).not.toContain('week');
  });

  it('shows exactly N months when on the monthly anniversary', () => {
    // Born 2025-11-02 — exactly 5 months before 2026-04-02. 151 days >> 91 (13 weeks threshold).
    vi.setSystemTime(new Date('2026-04-02T12:00:00Z'));
    const result = formatBabyAge('2025-11-02');
    expect(result).toBe('5 months old');
  });

  it('shows months for a 15-week-old (clearly above 13-week boundary)', () => {
    // 2026-04-16 - 105 days = 2026-01-01 (15 weeks; well above DST-crossing edge)
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    const result = formatBabyAge('2026-01-01');
    expect(result).toContain('month');
    expect(result).not.toContain('week');
  });

  it('still shows weeks at 12 weeks (84 days, clearly below 13-week boundary)', () => {
    // 2026-04-16 - 84 days = 2026-01-22 (exactly 12 weeks; below threshold)
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
    const result = formatBabyAge('2026-01-22');
    expect(result).toContain('week');
    expect(result).not.toContain('month');
  });
});
