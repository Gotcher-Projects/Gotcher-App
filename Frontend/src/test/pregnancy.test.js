import { describe, it, expect } from 'vitest';
import { profilePhase, weeksPregnant, daysUntilDue } from '../lib/pregnancy.js';

// ── profilePhase ─────────────────────────────────────────────────────────────

describe('profilePhase', () => {
  it("returns 'incomplete' for null profile (mid-onboarding, no saved row)", () => {
    expect(profilePhase(null)).toBe('incomplete');
  });

  it("returns 'incomplete' for undefined profile", () => {
    expect(profilePhase(undefined)).toBe('incomplete');
  });

  it("returns 'incomplete' when phase is missing on the object", () => {
    expect(profilePhase({ babyName: 'Lily' })).toBe('incomplete');
  });

  it("returns the stored phase 'pregnancy'", () => {
    expect(profilePhase({ phase: 'pregnancy' })).toBe('pregnancy');
  });

  it("returns the stored phase 'baby'", () => {
    expect(profilePhase({ phase: 'baby' })).toBe('baby');
  });
});

// ── weeksPregnant ────────────────────────────────────────────────────────────

describe('weeksPregnant', () => {
  it('returns 0 on the LMP day (due date - 280 days)', () => {
    // due 2026-10-01 → LMP 2025-12-25; on LMP day, 0 weeks
    expect(weeksPregnant('2026-10-01', new Date('2025-12-25T12:00:00Z'))).toBe(0);
  });

  it('returns 40 on the due date', () => {
    expect(weeksPregnant('2026-10-01', new Date('2026-10-01T12:00:00Z'))).toBe(40);
  });

  it('returns whole weeks elapsed since LMP', () => {
    // LMP 2025-12-25 + 70 days = 2026-03-05 → 10 weeks
    expect(weeksPregnant('2026-10-01', new Date('2026-03-05T12:00:00Z'))).toBe(10);
  });

  it('clamps to 0 before the LMP', () => {
    expect(weeksPregnant('2026-10-01', new Date('2025-11-01T12:00:00Z'))).toBe(0);
  });

  it('clamps to 42 well past the due date', () => {
    expect(weeksPregnant('2026-10-01', new Date('2027-01-01T12:00:00Z'))).toBe(42);
  });
});

// ── daysUntilDue ─────────────────────────────────────────────────────────────

describe('daysUntilDue', () => {
  it('returns 0 on the due date', () => {
    expect(daysUntilDue('2026-10-01', new Date('2026-10-01T00:00:00Z'))).toBe(0);
  });

  it('returns a positive count before the due date', () => {
    expect(daysUntilDue('2026-10-01', new Date('2026-09-21T00:00:00Z'))).toBe(10);
  });

  it('returns a negative count past the due date', () => {
    expect(daysUntilDue('2026-10-01', new Date('2026-10-06T00:00:00Z'))).toBe(-5);
  });
});
