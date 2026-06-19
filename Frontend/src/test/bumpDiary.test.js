import { describe, it, expect } from 'vitest';
import { firstEmptyWeek, groupByWeek, deriveWeek } from '../lib/bumpDiary.js';

// UTC-based so the offsets are timezone-stable regardless of the test machine.
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('firstEmptyWeek', () => {
  it('returns 4 when there are no photos', () => {
    expect(firstEmptyWeek([])).toBe(4);
  });

  it('returns the first gap in the used weeks', () => {
    expect(firstEmptyWeek([{ week: 4 }, { week: 5 }, { week: 7 }])).toBe(6);
  });

  it('skips past leading used weeks', () => {
    expect(firstEmptyWeek([{ week: 4 }, { week: 5 }, { week: 6 }])).toBe(7);
  });

  it('falls back to 40 when every week 4–40 is used', () => {
    const all = Array.from({ length: 37 }, (_, i) => ({ week: i + 4 }));
    expect(firstEmptyWeek(all)).toBe(40);
  });
});

describe('groupByWeek', () => {
  it('groups multiple photos in the same week into one section', () => {
    const groups = groupByWeek([
      { id: 1, week: 24, takenDate: '2026-06-14' },
      { id: 2, week: 24, takenDate: '2026-06-12' },
      { id: 3, week: 8,  takenDate: '2026-04-03' },
    ]);
    expect(groups.map(g => g.week)).toEqual([8, 24]);
    expect(groups[1].items).toHaveLength(2);
  });

  it('sorts ascending by week, then by taken date within a week', () => {
    const groups = groupByWeek([
      { id: 1, week: 24, takenDate: '2026-06-14' },
      { id: 2, week: 24, takenDate: '2026-06-12' },
    ]);
    expect(groups[0].items.map(p => p.id)).toEqual([2, 1]);
  });

  it('does not mutate the input array', () => {
    const input = [{ id: 1, week: 20 }, { id: 2, week: 8 }];
    groupByWeek(input);
    expect(input.map(p => p.id)).toEqual([1, 2]);
  });

  it('returns an empty array for no photos', () => {
    expect(groupByWeek([])).toEqual([]);
  });
});

describe('deriveWeek', () => {
  const due = '2026-12-01';

  it('returns null without a reference date', () => {
    expect(deriveWeek(null, '2026-06-01')).toBeNull();
    expect(deriveWeek(undefined, '2026-06-01')).toBeNull();
  });

  it('returns null without a valid date', () => {
    expect(deriveWeek(due, '')).toBeNull();
    expect(deriveWeek(due, null)).toBeNull();
    expect(deriveWeek(due, 'not-a-date')).toBeNull();
  });

  it('derives the gestational week from a mid-pregnancy date', () => {
    // 137 days before the due date = 143 gestational days ≈ 20.4 weeks → week 20
    // (off a 7-day boundary, so the result is stable).
    expect(deriveWeek(due, addDays(due, -137))).toBe(20);
  });

  it('clamps very early dates to 0', () => {
    expect(deriveWeek(due, addDays(due, -400))).toBe(0);
  });

  it('clamps past-term dates to 42', () => {
    expect(deriveWeek(due, addDays(due, 30))).toBe(42);
  });

  it('falls back to the birthdate as reference (≈ due date)', () => {
    // Baby mode has no dueDate; birthdate stands in. A date 137 days before birth → week 20.
    const birthdate = '2026-12-01';
    expect(deriveWeek(birthdate, addDays(birthdate, -137))).toBe(20);
  });
});
