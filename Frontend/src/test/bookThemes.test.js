import { describe, it, expect } from 'vitest';
import { getTheme, BOOK_THEMES } from '../lib/bookThemes.js';

describe('getTheme', () => {
  it('returns the matching theme by key', () => {
    expect(getTheme('coral').key).toBe('coral');
    expect(getTheme('midnight').key).toBe('midnight');
  });

  it('falls back to classic for an unknown key', () => {
    expect(getTheme('does-not-exist').key).toBe('classic');
  });

  it('falls back to classic for a null/undefined/empty key', () => {
    expect(getTheme(null).key).toBe('classic');
    expect(getTheme(undefined).key).toBe('classic');
    expect(getTheme('').key).toBe('classic');
  });

  it('returns the first theme as the classic fallback', () => {
    expect(getTheme('does-not-exist')).toBe(BOOK_THEMES[0]);
  });
});
