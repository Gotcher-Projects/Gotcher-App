import { describe, it, expect } from 'vitest';
import { cleanBodyText } from '../lib/storybookText.js';

describe('cleanBodyText', () => {
  it('strips [PHOTO:…] placeholder markers', () => {
    expect(cleanBodyText('Before[PHOTO:abc-123]after')).toBe('Beforeafter');
  });

  it('collapses runs of 3+ newlines down to a single blank line', () => {
    expect(cleanBodyText('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('leaves a single blank line (two newlines) untouched', () => {
    expect(cleanBodyText('a\n\nb')).toBe('a\n\nb');
  });

  it('trims leading and trailing whitespace', () => {
    expect(cleanBodyText('  \n hello \n  ')).toBe('hello');
  });

  it('returns an empty string for null/undefined/empty input', () => {
    expect(cleanBodyText(null)).toBe('');
    expect(cleanBodyText(undefined)).toBe('');
    expect(cleanBodyText('')).toBe('');
  });
});
