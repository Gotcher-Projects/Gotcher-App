import { describe, it, expect } from 'vitest';
import { formatDate, formatMonthYear, formatEntryDate, formatDuration, fmtDuration } from '../lib/formatting.js';

describe('formatDate', () => {
  it('formats a date-only string with the long style + year by default', () => {
    expect(formatDate('2026-04-01')).toBe('April 1, 2026');
  });

  it('supports the short month style', () => {
    expect(formatDate('2026-04-01', { style: 'short' })).toBe('Apr 1, 2026');
  });

  it('omits the year when withYear is false', () => {
    expect(formatDate('2026-04-01', { style: 'long', withYear: false })).toBe('April 1');
    expect(formatDate('2026-04-01', { style: 'short', withYear: false })).toBe('Apr 1');
  });

  it('anchors date-only strings to local noon (no UTC-parse off-by-one)', () => {
    // A bare `new Date('2026-04-01')` is UTC midnight → renders as Mar 31 in any UTC-negative zone.
    // The noon anchor must yield the same calendar date as a locally-constructed Apr 1, in any TZ.
    const localApr1 = new Date(2026, 3, 1, 12, 0, 0);
    expect(formatDate('2026-04-01')).toBe(formatDate(localApr1));
    expect(formatDate('2026-04-01')).toBe('April 1, 2026');
  });

  it('passes through full ISO timestamps and Date objects', () => {
    expect(formatDate('2026-12-25T08:30:00')).toBe('December 25, 2026');
    expect(formatDate(new Date(2026, 11, 25, 9, 0, 0))).toBe('December 25, 2026');
  });

  it('returns empty string for empty/invalid input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });
});

describe('formatMonthYear', () => {
  it('formats as "Month Year"', () => {
    expect(formatMonthYear('2026-04-01')).toBe('April 2026');
  });
  it('anchors date-only strings so the month does not roll back', () => {
    expect(formatMonthYear('2026-01-01')).toBe('January 2026');
  });
  it('returns empty string for empty/invalid input', () => {
    expect(formatMonthYear(null)).toBe('');
    expect(formatMonthYear('nope')).toBe('');
  });
});

describe('formatEntryDate (alias)', () => {
  it('delegates to formatDate (long, with year) and fixes the TZ off-by-one', () => {
    expect(formatEntryDate('2026-04-01')).toBe('April 1, 2026');
    expect(formatEntryDate('')).toBe('');
  });
});

describe('duration helpers (unchanged)', () => {
  it('formatDuration → m:ss', () => {
    expect(formatDuration(83)).toBe('1:23');
  });
  it('fmtDuration → "Xh Ym"', () => {
    expect(fmtDuration(3 * 3600 + 25 * 60)).toBe('3h 25m');
    expect(fmtDuration(25 * 60)).toBe('25m');
  });
});
