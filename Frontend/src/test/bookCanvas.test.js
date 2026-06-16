import { describe, it, expect } from 'vitest';
import {
  injectDropCap,
  cropStyle,
  blockBoxStyle,
  CANVAS_W,
  CANVAS_H,
} from '../lib/bookCanvas.jsx';

// ── injectDropCap ───────────────────────────────────────────────────────────────

describe('injectDropCap', () => {
  it('wraps the first ASCII letter in a drop-cap span', () => {
    expect(injectDropCap('<p>Hello</p>')).toBe(
      '<p><span class="book-drop-cap">H</span>ello</p>'
    );
  });

  it('preserves leading whitespace between the tag and the letter', () => {
    expect(injectDropCap('<p> Hello</p>')).toBe(
      '<p> <span class="book-drop-cap">H</span>ello</p>'
    );
  });

  it('only wraps the first letter across multiple paragraphs', () => {
    const out = injectDropCap('<p>Hello</p><p>World</p>');
    expect(out).toBe('<p><span class="book-drop-cap">H</span>ello</p><p>World</p>');
    expect(out.match(/book-drop-cap/g)).toHaveLength(1);
  });

  // P1-4: known limitation — drop cap only fires for ASCII A–Z/a–z.
  it('leaves accented first letters untouched (ASCII-only limitation)', () => {
    expect(injectDropCap('<p>Éxample</p>')).toBe('<p>Éxample</p>');
  });

  it('leaves a paragraph starting with a number or quote untouched', () => {
    expect(injectDropCap('<p>5 days old</p>')).toBe('<p>5 days old</p>');
    expect(injectDropCap('<p>&ldquo;Hi&rdquo;</p>')).toBe('<p>&ldquo;Hi&rdquo;</p>');
  });
});

// ── cropStyle ───────────────────────────────────────────────────────────────────

describe('cropStyle', () => {
  it('computes absolute offsets that show only the crop region', () => {
    const style = cropStyle({ x: 0.1, y: 0.2, width: 0.5, height: 0.5 });
    expect(style.position).toBe('absolute');
    expect(style.left).toBe('-20%');
    expect(style.top).toBe('-40%');
    expect(style.width).toBe('200%');
    expect(style.height).toBe('auto');
    expect(style.maxWidth).toBe('none');
  });

  it('renders an identity crop at the origin with no negative-zero', () => {
    const style = cropStyle({ x: 0, y: 0, width: 1, height: 1 });
    expect(style.left).toBe('0%');
    expect(style.top).toBe('0%');
    expect(style.width).toBe('100%');
  });
});

// ── blockBoxStyle ───────────────────────────────────────────────────────────────

describe('blockBoxStyle', () => {
  it('scales normalized coordinates to the virtual canvas', () => {
    const style = blockBoxStyle({ x: 0.1, y: 0.2, width: 0.5, height: 0.25 });
    expect(style).toMatchObject({
      position: 'absolute',
      overflow: 'hidden',
      left: 0.1 * CANVAS_W,
      top: 0.2 * CANVAS_H,
      width: 0.5 * CANVAS_W,
      height: 0.25 * CANVAS_H,
    });
  });

  it('renders a full-bleed block at the full canvas size', () => {
    const style = blockBoxStyle({ x: 0, y: 0, width: 1, height: 1 });
    expect(style.left).toBe(0);
    expect(style.top).toBe(0);
    expect(style.width).toBe(CANVAS_W);
    expect(style.height).toBe(CANVAS_H);
  });
});
