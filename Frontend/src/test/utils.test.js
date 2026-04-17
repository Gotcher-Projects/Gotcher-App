import { describe, it, expect } from 'vitest';
import { cn } from '../lib/utils.js';

describe('cn', () => {
  it('returns a single class unchanged', () => {
    expect(cn('text-sm')).toBe('text-sm');
  });

  it('merges multiple classes', () => {
    expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold');
  });

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    // tailwind-merge: px-2 then px-4 → px-4
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles conditional classes — falsy values are excluded', () => {
    expect(cn('text-sm', false && 'font-bold', null, undefined)).toBe('text-sm');
  });

  it('handles object syntax from clsx', () => {
    expect(cn({ 'font-bold': true, 'text-red-500': false })).toBe('font-bold');
  });

  it('handles array syntax from clsx', () => {
    expect(cn(['text-sm', 'font-bold'])).toBe('text-sm font-bold');
  });

  it('returns empty string for all falsy inputs', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('merges conflicting text-color classes correctly', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});
