import { describe, it, expect } from 'vitest';
import {
  makeId,
  makePageId,
  splitTextParts,
  migrateBlock,
  initPages,
  buildLayoutData,
} from '../lib/storybookLayout.js';
import { isTiptapDoc, contentToPlainText, toTiptapDoc } from '../lib/tiptap.js';

// ── makeId / makePageId ───────────────────────────────────────────────────────

describe('makeId / makePageId', () => {
  it('produce prefixed, unique-ish ids', () => {
    expect(makeId()).toMatch(/^b-/);
    expect(makePageId()).toMatch(/^p-/);
    expect(makeId()).not.toBe(makeId());
  });
});

// ── splitTextParts ────────────────────────────────────────────────────────────

describe('splitTextParts', () => {
  it('returns the whole text as one part when n <= 1', () => {
    expect(splitTextParts('hello world', 1)).toEqual(['hello world']);
    expect(splitTextParts('hello world', 0)).toEqual(['hello world']);
  });

  it('splits on paragraph boundaries when there are enough paragraphs', () => {
    const text = 'one\n\ntwo\n\nthree\n\nfour';
    const [a, b] = splitTextParts(text, 2);
    expect(a).toBe('one\n\ntwo');
    expect(b).toBe('three\n\nfour');
  });

  it('falls back to the first sentence boundary at/after the midpoint', () => {
    // mid = 12; the ". " at index 18 is the first sentence break at/after it.
    const text = 'Hello there friend. Bye.';
    const [a, b] = splitTextParts(text, 2);
    expect(a).toBe('Hello there friend.');
    expect(b).toBe('Bye.');
  });

  it('falls back to a word boundary when there is no usable sentence break', () => {
    const text = 'alpha bravo charlie delta echo foxtrot';
    const [a, b] = splitTextParts(text, 2);
    // Split happens at the first space at/after the midpoint; rejoining restores the text.
    expect(`${a} ${b}`).toBe(text);
    expect(a).not.toBe('');
    expect(b).not.toBe('');
  });

  it('degrades to [text, ""] when there are no spaces to split on', () => {
    expect(splitTextParts('singleword', 2)).toEqual(['singleword', '']);
  });
});

// ── migrateBlock ──────────────────────────────────────────────────────────────

describe('migrateBlock', () => {
  it('backfills a missing id', () => {
    const out = migrateBlock({ type: 'photo' });
    expect(out.id).toMatch(/^b-/);
  });

  it('preserves an existing id', () => {
    const out = migrateBlock({ id: 'keep-me', type: 'photo' });
    expect(out.id).toBe('keep-me');
  });

  it('converts a legacy string text block to a Tiptap doc', () => {
    const out = migrateBlock({ id: 'x', type: 'text', content: 'Hello there' });
    expect(isTiptapDoc(out.content)).toBe(true);
    expect(contentToPlainText(out.content)).toBe('Hello there');
  });

  it('converts l-wrap content to a Tiptap doc too', () => {
    const out = migrateBlock({ id: 'x', type: 'l-wrap', content: 'Wrapped' });
    expect(isTiptapDoc(out.content)).toBe(true);
  });

  it('leaves an already-Tiptap doc as an equivalent doc', () => {
    const doc = toTiptapDoc('Already a doc');
    const out = migrateBlock({ id: 'x', type: 'text', content: doc });
    expect(out.content).toBe(doc);
  });

  it('does not add content to non-text blocks', () => {
    const out = migrateBlock({ id: 'x', type: 'photo' });
    expect(out.content).toBeUndefined();
  });
});

// ── initPages ─────────────────────────────────────────────────────────────────

describe('initPages', () => {
  it('folds a v1 (blocks-only) chapter into a single page', () => {
    const chapter = {
      layoutData: {
        blocks: [
          { type: 'text', content: 'Once upon a time' },
          { type: 'photo', url: 'pic.jpg' },
        ],
      },
    };
    const pages = initPages(chapter);
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toMatch(/^p-/);
    expect(pages[0].templateId).toBeNull();
    expect(pages[0].backgroundColor).toBeNull();
    expect(pages[0].sourceKeys).toEqual([]);
    expect(pages[0].blocks).toHaveLength(2);
    expect(isTiptapDoc(pages[0].blocks[0].content)).toBe(true);
  });

  it('folds an empty / missing layout into one empty page', () => {
    expect(initPages({}).length).toBe(1);
    expect(initPages({}).at(0).blocks).toEqual([]);
    expect(initPages({ layoutData: {} }).length).toBe(1);
  });

  it('maps v2 pages, backfilling ids and migrating blocks', () => {
    const chapter = {
      layoutData: {
        version: 2,
        pages: [
          {
            templateId: 'text-only',
            backgroundColor: '#fff',
            blocks: [{ type: 'text', content: 'A' }],
          },
        ],
      },
    };
    const pages = initPages(chapter);
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toMatch(/^p-/);
    expect(pages[0].templateId).toBe('text-only');
    expect(pages[0].backgroundColor).toBe('#fff');
    expect(isTiptapDoc(pages[0].blocks[0].content)).toBe(true);
  });

  it('preserves explicit v2 page ids and derives sourceKeys from legacy sourceKey', () => {
    const chapter = {
      layoutData: {
        version: 2,
        pages: [{ id: 'page-1', sourceKey: 'journal:7', blocks: [] }],
      },
    };
    const [page] = initPages(chapter);
    expect(page.id).toBe('page-1');
    expect(page.sourceKeys).toEqual(['journal:7']);
  });
});

// ── buildLayoutData ───────────────────────────────────────────────────────────

describe('buildLayoutData', () => {
  it('emits a version-2 payload with normalized page fields', () => {
    const pages = [
      { id: 'p1', templateId: 't', backgroundColor: '#abc', sourceKeys: ['journal:1'], blocks: [] },
      { id: 'p2', blocks: [{ id: 'b1', type: 'photo' }] },
    ];
    const out = buildLayoutData(pages);
    expect(out.version).toBe(2);
    expect(out.pages).toHaveLength(2);
    expect(out.pages[0]).toEqual({
      id: 'p1', sourceKeys: ['journal:1'], templateId: 't', backgroundColor: '#abc', blocks: [],
    });
    // Missing optional fields are normalized.
    expect(out.pages[1].sourceKeys).toEqual([]);
    expect(out.pages[1].templateId).toBeNull();
    expect(out.pages[1].backgroundColor).toBeNull();
  });
});

// ── initPages ↔ buildLayoutData round-trip ────────────────────────────────────

describe('initPages ↔ buildLayoutData round-trip', () => {
  it('preserves pages and blocks across a v2 round-trip', () => {
    const chapter = {
      layoutData: {
        version: 2,
        pages: [
          {
            id: 'p1', templateId: 'classic', backgroundColor: '#eee', sourceKeys: ['journal:1'],
            blocks: [{ id: 'b1', type: 'text', content: 'Story text' }],
          },
          {
            id: 'p2', templateId: null, backgroundColor: null, sourceKeys: [],
            blocks: [{ id: 'b2', type: 'photo', url: 'p.jpg' }],
          },
        ],
      },
    };
    const rebuilt = buildLayoutData(initPages(chapter));
    expect(rebuilt.version).toBe(2);
    expect(rebuilt.pages.map(p => p.id)).toEqual(['p1', 'p2']);
    expect(rebuilt.pages[0].templateId).toBe('classic');
    expect(rebuilt.pages[0].backgroundColor).toBe('#eee');
    expect(rebuilt.pages[0].sourceKeys).toEqual(['journal:1']);
    expect(rebuilt.pages[0].blocks[0].id).toBe('b1');
    expect(contentToPlainText(rebuilt.pages[0].blocks[0].content)).toBe('Story text');
    expect(rebuilt.pages[1].blocks[0].url).toBe('p.jpg');
  });

  it('folds a v1 chapter into a single page that survives the round-trip', () => {
    const chapter = { layoutData: { blocks: [{ type: 'text', content: 'Hi' }] } };
    const rebuilt = buildLayoutData(initPages(chapter));
    expect(rebuilt.version).toBe(2);
    expect(rebuilt.pages).toHaveLength(1);
    expect(contentToPlainText(rebuilt.pages[0].blocks[0].content)).toBe('Hi');
  });
});
