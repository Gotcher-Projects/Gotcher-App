import { describe, it, expect } from 'vitest';
import { firstEmptyWeek, groupByWeek } from '../lib/bumpDiary.js';

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
