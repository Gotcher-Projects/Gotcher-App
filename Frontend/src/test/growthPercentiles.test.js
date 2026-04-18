import { describe, it, expect } from 'vitest';
import {
  toImperial,
  getPercentileData,
  WEIGHT_BOYS,
  WEIGHT_GIRLS,
  LENGTH_BOYS,
  HEAD_BOYS,
} from '../lib/growthPercentiles.js';

// ── toImperial ─────────────────────────────────────────────────────────────

describe('toImperial', () => {
  it('converts kg to lbs (×2.20462, 2 decimal places)', () => {
    const result = toImperial([[0, 2.4, 3.3, 4.4]], 'kg');
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe(0);
    expect(result[0].p5).toBeCloseTo(2.4 * 2.20462, 2);
    expect(result[0].p50).toBeCloseTo(3.3 * 2.20462, 2);
    expect(result[0].p95).toBeCloseTo(4.4 * 2.20462, 2);
  });

  it('converts cm to inches (×0.393701, 2 decimal places)', () => {
    const result = toImperial([[6, 63.3, 67.6, 71.9]], 'cm');
    expect(result[0].p5).toBeCloseTo(63.3 * 0.393701, 2);
    expect(result[0].p50).toBeCloseTo(67.6 * 0.393701, 2);
  });

  it('preserves month index unchanged', () => {
    const result = toImperial([[12, 6.9, 9.6, 11.9]], 'kg');
    expect(result[0].month).toBe(12);
  });

  it('returns an array the same length as the input table', () => {
    expect(toImperial(WEIGHT_BOYS, 'kg')).toHaveLength(WEIGHT_BOYS.length);
  });

  it('rounds to exactly 2 decimal places', () => {
    const result = toImperial([[0, 2.4, 3.3, 4.4]], 'kg');
    const decimals = String(result[0].p5).split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});

// ── getPercentileData ──────────────────────────────────────────────────────

describe('getPercentileData', () => {
  it('returns weight data for male in lbs', () => {
    const data = getPercentileData('weight', 'male');
    expect(data).toHaveLength(WEIGHT_BOYS.length);
    // 0-month boy: p50 ≈ 3.3 kg × 2.20462 ≈ 7.28 lbs
    expect(data[0].p50).toBeCloseTo(3.3 * 2.20462, 1);
  });

  it('returns different values for female vs male weight', () => {
    const boys  = getPercentileData('weight', 'male');
    const girls = getPercentileData('weight', 'female');
    expect(boys[0].p50).not.toBe(girls[0].p50);
  });

  it('returns length data in inches', () => {
    const data = getPercentileData('length', 'male');
    expect(data).toHaveLength(LENGTH_BOYS.length);
    // 0-month boy: p50 ≈ 49.9 cm × 0.393701 ≈ 19.65 in
    expect(data[0].p50).toBeCloseTo(49.9 * 0.393701, 1);
  });

  it('returns head circumference data in inches', () => {
    const data = getPercentileData('head', 'male');
    expect(data).toHaveLength(HEAD_BOYS.length);
  });

  it('falls back to boys data for unknown sex', () => {
    const unknown = getPercentileData('weight', null);
    const boys    = getPercentileData('weight', 'male');
    expect(unknown).toEqual(boys);
  });

  it('falls back to boys data for undefined sex', () => {
    const undef = getPercentileData('weight', undefined);
    const boys  = getPercentileData('weight', 'male');
    expect(undef).toEqual(boys);
  });

  it('returns empty array for unknown metric', () => {
    expect(getPercentileData('bmi', 'male')).toEqual([]);
  });
});
