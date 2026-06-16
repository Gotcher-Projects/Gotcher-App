import { describe, it, expect } from 'vitest';
import {
  FONT_SIZES,
  fontSizeKey,
  isTiptapDoc,
  stringToTiptapDoc,
  toTiptapDoc,
  renderContentHTML,
  contentToPlainText,
} from '../lib/tiptap.js';

// ── Fixtures ────────────────────────────────────────────────────────────────────

const doc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'World' }] },
  ],
};

// ── fontSizeKey ─────────────────────────────────────────────────────────────────

describe('fontSizeKey', () => {
  it('maps stored em values back to size keys', () => {
    expect(fontSizeKey(FONT_SIZES.small)).toBe('small');
    expect(fontSizeKey(FONT_SIZES.large)).toBe('large');
  });

  it('treats null/unset as normal', () => {
    expect(fontSizeKey(FONT_SIZES.normal)).toBe('normal');
    expect(fontSizeKey(null)).toBe('normal');
  });

  it('falls back to normal for unknown values', () => {
    expect(fontSizeKey('2em')).toBe('normal');
    expect(fontSizeKey(undefined)).toBe('normal');
  });
});

// ── isTiptapDoc ─────────────────────────────────────────────────────────────────

describe('isTiptapDoc', () => {
  it('recognizes a doc object', () => {
    expect(isTiptapDoc(doc)).toBe(true);
    expect(isTiptapDoc({ type: 'doc' })).toBe(true);
  });

  it('rejects non-docs', () => {
    expect(isTiptapDoc(null)).toBe(false);
    expect(isTiptapDoc(undefined)).toBe(false);
    expect(isTiptapDoc('hello')).toBe(false);
    expect(isTiptapDoc({ type: 'paragraph' })).toBe(false);
    expect(isTiptapDoc(42)).toBe(false);
  });
});

// ── stringToTiptapDoc ───────────────────────────────────────────────────────────

describe('stringToTiptapDoc', () => {
  it('returns a single empty paragraph for empty / nullish input', () => {
    expect(stringToTiptapDoc('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(stringToTiptapDoc(null)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(stringToTiptapDoc('   ')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('wraps a single line in one paragraph', () => {
    expect(stringToTiptapDoc('Hello')).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    });
  });

  it('splits on blank lines (2+ newlines) into separate paragraphs', () => {
    const result = stringToTiptapDoc('A\n\nB');
    expect(result.content).toHaveLength(2);
    expect(result.content[0].content[0].text).toBe('A');
    expect(result.content[1].content[0].text).toBe('B');
  });

  it('collapses runs of 3+ newlines into a single split', () => {
    const result = stringToTiptapDoc('A\n\n\n\nB');
    expect(result.content).toHaveLength(2);
  });

  it('emits an empty paragraph for a whitespace-only segment', () => {
    const result = stringToTiptapDoc('A\n\n   \n\nB');
    expect(result.content).toHaveLength(3);
    expect(result.content[1]).toEqual({ type: 'paragraph', content: [] });
  });
});

// ── toTiptapDoc ─────────────────────────────────────────────────────────────────

describe('toTiptapDoc', () => {
  it('returns the same doc reference when already a doc (idempotent)', () => {
    expect(toTiptapDoc(doc)).toBe(doc);
  });

  it('converts a legacy string to a doc', () => {
    expect(toTiptapDoc('Hi')).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }],
    });
  });
});

// ── renderContentHTML ───────────────────────────────────────────────────────────

describe('renderContentHTML', () => {
  it('renders a Tiptap doc to paragraph HTML', () => {
    const html = renderContentHTML(doc);
    expect(html).toContain('Hello');
    expect(html).toContain('World');
    expect(html).toMatch(/<p[ >]/);
  });

  it('renders bold marks as <strong>', () => {
    const bold = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bold', marks: [{ type: 'bold' }] }] }],
    };
    expect(renderContentHTML(bold)).toContain('<strong>Bold</strong>');
  });

  it('returns empty string for empty / nullish legacy content', () => {
    expect(renderContentHTML('')).toBe('');
    expect(renderContentHTML(null)).toBe('');
    expect(renderContentHTML('   ')).toBe('');
  });

  it('splits a legacy string on blank lines into <p> tags', () => {
    expect(renderContentHTML('A\n\nB')).toBe('<p>A</p><p>B</p>');
  });

  it('escapes HTML-special characters in legacy string content', () => {
    expect(renderContentHTML('a < b & c > d')).toBe('<p>a &lt; b &amp; c &gt; d</p>');
  });
});

// ── contentToPlainText ──────────────────────────────────────────────────────────

describe('contentToPlainText', () => {
  it('returns trimmed text for legacy string content', () => {
    expect(contentToPlainText('  hi  ')).toBe('hi');
    expect(contentToPlainText(null)).toBe('');
    expect(contentToPlainText(undefined)).toBe('');
  });

  it('flattens a doc to concatenated text nodes (no separators), trimmed', () => {
    expect(contentToPlainText(doc)).toBe('HelloWorld');
  });

  it('returns empty string for a doc with no text', () => {
    expect(contentToPlainText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('');
  });
});
