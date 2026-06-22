import { describe, it, expect } from 'vitest';
import { twemojiCode, twemojiSrc } from '../lib/twemoji.js';

describe('twemojiCode', () => {
  it('maps a single-codepoint emoji to its lowercase hex code', () => {
    expect(twemojiCode('🍌')).toBe('1f34c');
  });

  it('strips the U+FE0F variation selector', () => {
    // '❤️' is U+2764 U+FE0F — the variation selector is dropped, matching Twemoji filenames.
    expect(twemojiCode('❤️')).toBe('2764');
  });

  it('hyphen-joins a multi-codepoint sequence (skin-tone modifier)', () => {
    // '👍🏽' is U+1F44D U+1F3FD.
    expect(twemojiCode('👍🏽')).toBe('1f44d-1f3fd');
  });

  it('hyphen-joins a ZWJ sequence, keeping the U+200D joiner', () => {
    // '👩‍🍳' is U+1F469 U+200D U+1F373.
    expect(twemojiCode('👩‍🍳')).toBe('1f469-200d-1f373');
  });
});

describe('twemojiSrc', () => {
  it('builds the bundled SVG path from the emoji code', () => {
    expect(twemojiSrc('🍌')).toBe('/images/twemoji/1f34c.svg');
  });
});
