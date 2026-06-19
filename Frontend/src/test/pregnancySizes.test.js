import { describe, it, expect } from 'vitest';
import { PREGNANCY_SIZES, sizeForWeek, formatLength, formatWeight } from '../lib/pregnancySizes.js';
import { trimester } from '../lib/pregnancy.js';

// ── dataset integrity ────────────────────────────────────────────────────────

describe('PREGNANCY_SIZES', () => {
  it('covers every week 4–40 with no gaps', () => {
    const weeks = PREGNANCY_SIZES.map(s => s.week);
    expect(weeks[0]).toBe(4);
    expect(weeks.at(-1)).toBe(40);
    for (let w = 4; w <= 40; w++) {
      expect(weeks).toContain(w);
    }
  });

  it('every row has the required fields', () => {
    for (const s of PREGNANCY_SIZES) {
      expect(s.label).toBeTruthy();
      expect(s.emoji).toBeTruthy();
      expect(s.art).toBeTruthy();
      expect(s.blurb).toBeTruthy();
      expect(s.detail).toBeTruthy();
      expect(typeof s.lengthCm).toBe('number');
      expect(typeof s.weightG).toBe('number');
    }
  });
});

// ── sizeForWeek ──────────────────────────────────────────────────────────────

describe('sizeForWeek', () => {
  it('returns the exact row for a defined week', () => {
    expect(sizeForWeek(20).label).toBe('a banana');
    expect(sizeForWeek(8).label).toBe('a raspberry');
  });

  it('clamps below week 4 to the first row', () => {
    expect(sizeForWeek(0)).toBe(PREGNANCY_SIZES[0]);
    expect(sizeForWeek(3)).toBe(PREGNANCY_SIZES[0]);
  });

  it('clamps at/above week 40 to the last row', () => {
    expect(sizeForWeek(40).week).toBe(40);
    expect(sizeForWeek(42).week).toBe(40);
  });
});

// ── trimester ────────────────────────────────────────────────────────────────

describe('trimester', () => {
  it('1st trimester through week 13', () => {
    expect(trimester(1)).toBe(1);
    expect(trimester(13)).toBe(1);
  });
  it('2nd trimester weeks 14–27', () => {
    expect(trimester(14)).toBe(2);
    expect(trimester(27)).toBe(2);
  });
  it('3rd trimester week 28 and beyond', () => {
    expect(trimester(28)).toBe(3);
    expect(trimester(40)).toBe(3);
  });
});

// ── formatLength / formatWeight ──────────────────────────────────────────────

describe('formatLength', () => {
  it('converts cm to inches (imperial) and keeps metric', () => {
    expect(formatLength(30)).toEqual({ imperial: '11.8 in', metric: '30 cm' });
  });
});

describe('formatWeight', () => {
  it('shows <1 oz for very light weights', () => {
    expect(formatWeight(1).imperial).toBe('<1 oz');
  });
  it('shows ounces under a pound', () => {
    expect(formatWeight(300).imperial).toBe('10.6 oz');
  });
  it('shows pounds and ounces over a pound', () => {
    expect(formatWeight(3462).imperial).toBe('7 lb 10 oz');
  });
  it('switches metric to kg at/over 1000 g', () => {
    expect(formatWeight(3462).metric).toBe('3.46 kg');
    expect(formatWeight(600).metric).toBe('600 g');
  });
});
