import { describe, it, expect } from 'vitest';
import {
  MAX_MILESTONE_ROWS, milestoneName, buildAchievedMilestones, seededMilestoneDate,
} from '@/lib/milestonesPage';

describe('milestonesPage helpers (sv2-s6.5)', () => {
  it('resolves a milestone key to its dataset name', () => {
    // MILESTONES[36] = ["Crawls on hands/knees", "Pulls to stand", "Plays peek-a-boo"]
    expect(milestoneName('36-1')).toBe('Pulls to stand');
    expect(milestoneName('0-0')).toBe('Turns toward voices');
  });

  it('falls back to the raw key for an unknown milestone', () => {
    expect(milestoneName('999-9')).toBe('999-9');
    expect(milestoneName('')).toBe('');
  });

  it('builds achieved milestones sorted oldest-first with resolved names', () => {
    const out = buildAchievedMilestones([
      { key: '36-1', achievedAt: '2026-08-20' },
      { key: '0-0', achievedAt: '2026-03-02' },
    ]);
    expect(out.map(m => m.name)).toEqual(['Turns toward voices', 'Pulls to stand']);
    expect(out[0].achievedAt).toBe('2026-03-02');
  });

  it('ignores rows without a key and tolerates missing dates', () => {
    const out = buildAchievedMilestones([{ achievedAt: '2026-01-01' }, { key: '0-1' }]);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('0-1');
    expect(out[0].achievedAt).toBeNull();
  });

  it('seeds a year-less display date, empty when out of range', () => {
    const achieved = buildAchievedMilestones([{ key: '0-0', achievedAt: '2026-03-02' }]);
    expect(seededMilestoneDate(achieved, 0)).toBe('March 2');
    expect(seededMilestoneDate(achieved, 5)).toBe(''); // beyond the list
  });

  it('caps the page at seven rows', () => {
    expect(MAX_MILESTONE_ROWS).toBe(7);
  });
});
