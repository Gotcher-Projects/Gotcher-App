import { describe, it, expect } from 'vitest';
import {
  buildMemoryList,
  extractPieceText,
  autoSuggestGroups,
  buildGroupedLayoutData,
} from '../lib/storybookGrouping.js';
import { contentToPlainText } from '../lib/tiptap.js';

// ── Fixtures ────────────────────────────────────────────────────────────────────

const journalEntries = [
  { id: 1, entry_date: '2026-02-01', title: 'First smile', story: 'She smiled today for the very first time.', image_url: 'https://img/smile.jpg' },
  { id: 2, entry_date: '2026-01-10', title: 'Coming home', story: 'We brought her home.', image_url: null },
];

const firsts = [
  { id: 5, occurredDate: '2026-03-01', label: 'First steps', notes: 'Two wobbly steps!', imageUrl: 'https://img/steps.jpg' },
];

// ── buildMemoryList ─────────────────────────────────────────────────────────────

describe('buildMemoryList', () => {
  it('builds journal and first-time memories with stable source keys', () => {
    const result = buildMemoryList({
      journalIds: [1],
      firstTimeIds: [5],
      journalEntries,
      firsts,
    });
    expect(result).toHaveLength(2);
    const journal = result.find(m => m.sourceKey === 'journal:1');
    const first = result.find(m => m.sourceKey === 'first_time:5');
    expect(journal.type).toBe('journal');
    expect(journal.label).toBe('First smile');
    expect(journal.hasPhoto).toBe(true);
    expect(journal.photoUrl).toBe('https://img/smile.jpg');
    expect(journal.wordCount).toBeGreaterThan(0);
    expect(first.type).toBe('first_time');
    expect(first.label).toBe('First steps');
  });

  it('prefers a photoOverride over the entry image', () => {
    const [m] = buildMemoryList({
      journalIds: [1],
      journalEntries,
      firsts,
      photoOverrides: { 'journal:1': 'https://override/new.jpg' },
    });
    expect(m.photoUrl).toBe('https://override/new.jpg');
  });

  it('marks entries with no photo as hasPhoto=false', () => {
    const [m] = buildMemoryList({ journalIds: [2], journalEntries, firsts });
    expect(m.hasPhoto).toBe(false);
    expect(m.photoUrl).toBeNull();
  });

  it('skips ids that do not resolve to an entry', () => {
    const result = buildMemoryList({ journalIds: [999], firstTimeIds: [888], journalEntries, firsts });
    expect(result).toHaveLength(0);
  });

  it('sorts memories by date ascending', () => {
    const result = buildMemoryList({
      journalIds: [1, 2],
      firstTimeIds: [5],
      journalEntries,
      firsts,
    });
    expect(result.map(m => m.sourceKey)).toEqual(['journal:2', 'journal:1', 'first_time:5']);
  });
});

// ── extractPieceText ────────────────────────────────────────────────────────────

describe('extractPieceText', () => {
  it('returns empty string for null content', () => {
    expect(extractPieceText(null, 'body')).toBe('');
    expect(extractPieceText(undefined)).toBe('');
  });

  it('strips [PHOTO:…] markers and collapses blank lines in the body', () => {
    const gc = { body: 'Line one\n[PHOTO:abc]\n\n\n\nLine two' };
    expect(extractPieceText(gc, 'body')).toBe('Line one\n\nLine two');
  });

  it('defaults to the body piece', () => {
    expect(extractPieceText({ body: 'Hello there' })).toBe('Hello there');
  });

  it('returns title / caption / pullQuote verbatim', () => {
    const gc = { title: 'T', caption: 'C', pullQuote: 'Q', body: 'B' };
    expect(extractPieceText(gc, 'title')).toBe('T');
    expect(extractPieceText(gc, 'caption')).toBe('C');
    expect(extractPieceText(gc, 'pullQuote')).toBe('Q');
  });

  it('returns empty string when the requested piece is missing', () => {
    expect(extractPieceText({ body: 'B' }, 'title')).toBe('');
    expect(extractPieceText({ body: 'B' }, 'pullQuote')).toBe('');
  });
});

// ── autoSuggestGroups ───────────────────────────────────────────────────────────

describe('autoSuggestGroups', () => {
  const short = (key, type = 'first_time') => ({ sourceKey: key, type, wordCount: 10, hasPhoto: false });
  const long = (key) => ({ sourceKey: key, type: 'journal', wordCount: 200, hasPhoto: false });

  it('gives a long journal entry its own page', () => {
    const groups = autoSuggestGroups([long('journal:1')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].sourceKeys).toEqual(['journal:1']);
  });

  it('groups consecutive short memories up to a max of 3 per page', () => {
    const groups = autoSuggestGroups([
      short('first_time:1'), short('first_time:2'), short('first_time:3'), short('first_time:4'),
    ]);
    expect(groups[0].sourceKeys).toHaveLength(3);
    expect(groups[1].sourceKeys).toHaveLength(1);
  });

  it('breaks a short run when a long entry interrupts it', () => {
    const groups = autoSuggestGroups([short('first_time:1'), long('journal:2'), short('first_time:3')]);
    expect(groups).toHaveLength(3);
    expect(groups.map(g => g.sourceKeys)).toEqual([['first_time:1'], ['journal:2'], ['first_time:3']]);
  });

  it('assigns a template id to every group', () => {
    const groups = autoSuggestGroups([short('first_time:1'), long('journal:2')]);
    expect(groups.every(g => typeof g.templateId === 'string' && g.templateId.length > 0)).toBe(true);
  });
});

// ── buildGroupedLayoutData ──────────────────────────────────────────────────────

describe('buildGroupedLayoutData', () => {
  const generatedPages = [
    { sourceKey: 'journal:1', title: 'First smile', body: 'She smiled.\n[PHOTO:x]\n\nIt melted us.', caption: 'A smile', pullQuote: '' },
  ];

  it('produces a v2 layout with one page per group', () => {
    const groups = [{
      pageId: 'page-0',
      sourceKeys: ['journal:1'],
      templateId: 'classic',
      photoAssignments: { 'journal:1': ['https://img/smile.jpg'] },
    }];
    const layout = buildGroupedLayoutData(groups, generatedPages);
    expect(layout.version).toBe(2);
    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0].sourceKeys).toEqual(['journal:1']);
  });

  it('fills the text slot from the body piece with photo markers stripped', () => {
    const groups = [{
      pageId: 'page-0',
      sourceKeys: ['journal:1'],
      templateId: 'classic',
      photoAssignments: { 'journal:1': ['https://img/smile.jpg'] },
    }];
    const layout = buildGroupedLayoutData(groups, generatedPages);
    const textBlock = layout.pages[0].blocks.find(b => b.type === 'text');
    expect(contentToPlainText(textBlock.content)).toBe('She smiled.It melted us.');
    expect(textBlock.suppressDropCap).toBe(true);
  });

  it('assigns the photo URL to the photo slot', () => {
    const groups = [{
      pageId: 'page-0',
      sourceKeys: ['journal:1'],
      templateId: 'classic',
      photoAssignments: { 'journal:1': ['https://img/smile.jpg'] },
    }];
    const layout = buildGroupedLayoutData(groups, generatedPages);
    const photoBlock = layout.pages[0].blocks.find(b => b.type === 'photo');
    expect(photoBlock.url).toBe('https://img/smile.jpg');
    expect(photoBlock.sourceKey).toBe('journal:1');
  });

  it('leaves the photo slot empty when no assignment exists', () => {
    const groups = [{
      pageId: 'page-0',
      sourceKeys: ['journal:1'],
      templateId: 'classic',
      photoAssignments: {},
    }];
    const layout = buildGroupedLayoutData(groups, generatedPages);
    const photoBlock = layout.pages[0].blocks.find(b => b.type === 'photo');
    expect(photoBlock.url).toBeUndefined();
  });
});
