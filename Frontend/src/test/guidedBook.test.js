import { describe, it, expect } from 'vitest';
import { contentToPlainText, toTiptapDoc } from '../lib/tiptap.js';
import { formatDate } from '../lib/formatting.js';
import { FIRST_YEAR_ARC, expandArcToChapterSeeds } from '../lib/guidedBookArc.js';
import {
  chapterKind,
  chapterHasContent,
  chapterStatus,
  guidedProgress,
  groupGuidedSections,
  featuredFirstTimeIds,
  seedMomentHeroFromFirst,
  bucketForMemory,
  buildGuidedMemories,
  groupMemoriesIntoBuckets,
  collectUsedKeys,
} from '../lib/guidedBook.js';

// expandArcToChapterSeeds returns { anchorKey, anchorLabel, sortOrder, layoutData } — the same shape
// guided chapters come back from the API (anchorKey + layoutData), so seeds double as test chapters.
const seeds = () => expandArcToChapterSeeds(FIRST_YEAR_ARC);
const seedFor = (key) => seeds().find((s) => s.anchorKey === key);

const withText = (chapter, blockId, text) => ({
  ...chapter,
  layoutData: {
    ...chapter.layoutData,
    pages: chapter.layoutData.pages.map((p, i) =>
      i === 0 ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, content: toTiptapDoc(text) } : b)) } : p
    ),
  },
});

const withPhoto = (chapter, blockId, url) => ({
  ...chapter,
  layoutData: {
    ...chapter.layoutData,
    pages: chapter.layoutData.pages.map((p, i) =>
      i === 0 ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, url } : b)) } : p
    ),
  },
});

describe('guidedBook — chapterKind', () => {
  it('derives the kind from the anchorKey', () => {
    expect(chapterKind({ anchorKey: 'letter-to-you' })).toBe('fill');
    expect(chapterKind({ anchorKey: 'day-we-met' })).toBe('auto');
    expect(chapterKind({ anchorKey: 'first-1' })).toBe('pick');
    expect(chapterKind({ anchorKey: 'div-beginning' })).toBe('divider');
  });
  it('defaults to fill for an unknown key', () => {
    expect(chapterKind({ anchorKey: 'nope' })).toBe('fill');
  });
});

describe('guidedBook — chapterHasContent', () => {
  it('is false for a freshly seeded fill page', () => {
    expect(chapterHasContent(seedFor('letter-to-you'))).toBe(false);
  });
  it('is true once a text block has content', () => {
    expect(chapterHasContent(withText(seedFor('letter-to-you'), 'body', 'Dear Lily'))).toBe(true);
  });
  it('is true once a photo block has a url', () => {
    const gallery = seedFor('welcome');
    const filled = {
      ...gallery,
      layoutData: {
        ...gallery.layoutData,
        pages: gallery.layoutData.pages.map((p, i) =>
          i === 0 ? { ...p, blocks: p.blocks.map((b) => (b.id === 'photo1' ? { ...b, url: 'p.jpg' } : b)) } : p
        ),
      },
    };
    expect(chapterHasContent(filled)).toBe(true);
  });
});

describe('guidedBook — chapterStatus', () => {
  it('treats auto / prefill / divider as done by default', () => {
    expect(chapterStatus(seedFor('day-we-met'))).toBe('done');   // auto
    expect(chapterStatus(seedFor('your-people'))).toBe('done');  // prefill
    expect(chapterStatus(seedFor('div-beginning'))).toBe('done'); // divider
  });
  it('treats an empty fill / pick page as empty', () => {
    expect(chapterStatus(seedFor('welcome'))).toBe('empty'); // fill (gallery)
    expect(chapterStatus(seedFor('first-1'))).toBe('empty'); // pick
  });
  it('is partial when some-but-not-all required slots are filled', () => {
    // gallery "welcome" requires all four photos; a caption is content but fills no required slot.
    expect(chapterStatus(withText(seedFor('welcome'), 'cap1', 'hi'))).toBe('partial');
    // one of four photos → still partial.
    expect(chapterStatus(withPhoto(seedFor('welcome'), 'photo1', 'p.jpg'))).toBe('partial');
  });
  it('is done only when every required slot is filled', () => {
    let g = seedFor('welcome');
    for (const id of ['photo1', 'photo2', 'photo3', 'photo4']) g = withPhoto(g, id, 'p.jpg');
    expect(chapterStatus(g)).toBe('done');
  });
  it('a letter is done on its body alone (title / signature optional)', () => {
    expect(chapterStatus(withText(seedFor('letter-to-you'), 'body', 'Dear Lily'))).toBe('done');
  });
  it('a pick page needs both its photo and its note', () => {
    const photoOnly = withPhoto(seedFor('first-1'), 'photo', 'p.jpg');
    expect(chapterStatus(photoOnly)).toBe('partial');
    expect(chapterStatus(withText(photoOnly, 'note', 'so cute'))).toBe('done');
  });
});

describe('guidedBook — guidedProgress', () => {
  it('excludes dividers, counts only fully-done pages, and reports partial + auto-filled', () => {
    const p = guidedProgress(seeds());
    // First Year (pr5.5): 27 non-divider pages; auto(2) + prefill(4, incl. "About Us") = 6 done-by-default.
    expect(p.total).toBe(27);
    expect(p.done).toBe(6);
    expect(p.partial).toBe(0);
    expect(p.autoFilled).toBe(6);
  });
  it('counts a partially-filled page as partial, not done', () => {
    const all = seeds().map((c) => (c.anchorKey === 'welcome' ? withText(c, 'cap1', 'x') : c));
    const p = guidedProgress(all);
    expect(p.done).toBe(6);
    expect(p.partial).toBe(1);
  });
  it('counts a fully-filled fill page toward done', () => {
    const all = seeds().map((c) => (c.anchorKey === 'letter-to-you' ? withText(c, 'body', 'Dear Lily') : c));
    expect(guidedProgress(all).done).toBe(7);
  });
});

describe('guidedBook — groupGuidedSections', () => {
  it('opens a section per divider with the following pages as its rows', () => {
    const sections = groupGuidedSections(seeds());
    expect(sections).toHaveLength(5);
    expect(sections[0].section).toBe('The Beginning');
    expect(sections[0].subtitle).toBe('How your story started');
    expect(sections[0].rows.map((r) => r.anchorKey)).toEqual([
      'letter-to-you', 'day-we-met', 'day-you-born', 'welcome', 'coming-home', 'tiny-new',
    ]);
    // no divider ever appears as a row
    const rowKeys = sections.flatMap((s) => s.rows.map((r) => r.anchorKey));
    expect(rowKeys.some((k) => k.startsWith('div-'))).toBe(false);
  });
});

describe('guidedBook — seedMomentHeroFromFirst + featuredFirstTimeIds', () => {
  const first = { id: 42, label: 'First smile', occurredDate: '2026-04-01', notes: 'So cute!', imageUrl: 'http://x/p.jpg' };

  it('fills title / date / note / photo and tags the photo with the first id', () => {
    const pick = seedFor('first-1');
    const layout = seedMomentHeroFromFirst(pick, first);
    const blocks = layout.pages[0].blocks;
    const byId = (id) => blocks.find((b) => b.id === id);

    expect(contentToPlainText(byId('title').content)).toBe('First smile');
    expect(contentToPlainText(byId('date').content)).toBe(formatDate('2026-04-01'));
    expect(contentToPlainText(byId('note').content)).toBe('So cute!');
    expect(byId('photo').url).toBe('http://x/p.jpg');
    expect(byId('photo').sourceKey).toBe('first_time:42');
  });

  it('does not mutate the original chapter', () => {
    const pick = seedFor('first-1');
    const before = JSON.stringify(pick.layoutData);
    seedMomentHeroFromFirst(pick, first);
    expect(JSON.stringify(pick.layoutData)).toBe(before);
  });

  it('featuredFirstTimeIds finds the seeded first across pick pages only', () => {
    const pick = seedFor('first-1');
    const seeded = { ...pick, layoutData: seedMomentHeroFromFirst(pick, first) };
    const ids = featuredFirstTimeIds([seeded, seedFor('letter-to-you')]);
    expect(ids.has(42)).toBe(true);
    expect(ids.size).toBe(1);
  });

  it('tags the first even when it has no photo (so dedup still works)', () => {
    const pick = seedFor('first-2');
    const layout = seedMomentHeroFromFirst(pick, { id: 7, label: 'First steps', occurredDate: '', notes: '', imageUrl: null });
    const photo = layout.pages[0].blocks.find((b) => b.id === 'photo');
    expect(photo.url).toBeNull();
    expect(photo.sourceKey).toBe('first_time:7');
  });
});

// ── sv2-s7.5a — time-bucket memory routing ──────────────────────────────────
const BD = '2026-01-01'; // birthdate for age math

describe('guidedBook — bucketForMemory', () => {
  it('routes bump photos to Pregnancy regardless of date', () => {
    expect(bucketForMemory({ type: 'bump', date: '2027-06-01' }, BD)).toBe('pregnancy');
  });
  it('routes by age into clean quarter windows', () => {
    expect(bucketForMemory({ type: 'journal', date: '2026-02-15' }, BD)).toBe('m0-3');  // ~1.5mo
    expect(bucketForMemory({ type: 'journal', date: '2026-05-01' }, BD)).toBe('m4-6');  // ~4mo
    expect(bucketForMemory({ type: 'first_time', date: '2026-08-01' }, BD)).toBe('m7-9');  // ~7mo
    expect(bucketForMemory({ type: 'journal', date: '2026-11-15' }, BD)).toBe('m10-12'); // ~10.5mo
  });
  it('sends anything at/after 12 months to 1 year+', () => {
    expect(bucketForMemory({ type: 'journal', date: '2027-02-01' }, BD)).toBe('y1plus'); // ~13mo
  });
  it('routes pre-birth dated memories to Pregnancy', () => {
    expect(bucketForMemory({ type: 'journal', date: '2025-11-01' }, BD)).toBe('pregnancy');
  });
  it('falls back to Months 0–3 when the date or birthdate is missing', () => {
    expect(bucketForMemory({ type: 'journal', date: '' }, BD)).toBe('m0-3');
    expect(bucketForMemory({ type: 'journal', date: '2026-06-01' }, null)).toBe('m0-3');
  });
});

describe('guidedBook — buildGuidedMemories', () => {
  const pools = {
    journalEntries: [
      { id: 1, title: 'Bath', story: 'Splashy fun', entry_date: '2026-03-01', image_url: 'j1.jpg' },
      { id: 2, title: 'Nap', story: '', entry_date: '2026-02-01', image_url: null },
    ],
    firsts: [
      { id: 5, label: 'First smile', notes: 'So cute', occurredDate: '2026-04-01', imageUrl: 'f5.jpg',
        additionalPhotos: [{ id: 90, imageUrl: 'f5b.jpg', caption: 'grin' }, { id: 91, imageUrl: 'f5c.jpg' }] },
    ],
    bumpPhotos: [
      { id: 3, week: 20, imageUrl: 'b3.jpg', note: 'showing', takenDate: '2025-10-01' },
      { id: 4, week: 22, imageUrl: null, note: 'no photo', takenDate: '2025-11-01' }, // skipped (no image)
    ],
  };

  it('includes journals, firsts (hero + V38 extras), and bump photos with unique photo keys', () => {
    const mems = buildGuidedMemories(pools);
    const byKey = (k) => mems.find((m) => m.sourceKey === k);

    // A first exposes its hero + each additional photo as separate draggable pieces.
    const first = byKey('first_time:5');
    expect(first.photos.map((p) => p.sourceKey)).toEqual([
      'first_time:5', 'first_time_photo:90', 'first_time_photo:91',
    ]);
    expect(first.hasText).toBe(true);

    // Journal with no story → no draggable text; journal with a photo exposes it on its own key.
    expect(byKey('journal:2').hasText).toBe(false);
    expect(byKey('journal:1').photos).toEqual([{ sourceKey: 'journal:1', url: 'j1.jpg', label: 'Bath' }]);

    // Bump photos are photo-only; the note-only bump (no image) is dropped.
    const bump = byKey('bump:3');
    expect(bump.type).toBe('bump');
    expect(bump.hasText).toBe(false);
    expect(bump.photos[0].sourceKey).toBe('bump:3');
    expect(byKey('bump:4')).toBeUndefined();
  });

  it('sorts memories by date ascending', () => {
    const dates = buildGuidedMemories(pools).map((m) => m.date);
    expect(dates).toEqual([...dates].sort((a, b) => a.localeCompare(b)));
  });
});

describe('guidedBook — groupMemoriesIntoBuckets', () => {
  it('groups into ordered buckets and drops empty ones', () => {
    const mems = buildGuidedMemories({
      journalEntries: [{ id: 1, title: 'a', story: 'x', entry_date: '2026-02-15', image_url: null }],
      firsts: [{ id: 5, label: 'smile', notes: 'y', occurredDate: '2027-02-01', imageUrl: null }],
      bumpPhotos: [{ id: 3, week: 20, imageUrl: 'b.jpg', takenDate: '2025-10-01' }],
    });
    const buckets = groupMemoriesIntoBuckets(mems, BD);
    expect(buckets.map((b) => b.id)).toEqual(['pregnancy', 'm0-3', 'y1plus']);
    expect(buckets.find((b) => b.id === 'm0-3').memories).toHaveLength(1);
  });
  it('returns nothing for an empty pool', () => {
    expect(groupMemoriesIntoBuckets([], BD)).toEqual([]);
  });
});

describe('guidedBook — collectUsedKeys', () => {
  const chapter = (blocks) => ({ layoutData: { pages: [{ blocks }] } });
  it('collects text keys with content and photo keys with a url across chapters', () => {
    const { text, photo } = collectUsedKeys([
      chapter([
        { type: 'text', sourceKey: 'journal:1', content: toTiptapDoc('hi') },
        { type: 'text', sourceKey: 'journal:2', content: toTiptapDoc('') },   // empty → not used
        { type: 'photo', sourceKey: 'first_time:5', url: 'p.jpg' },
        { type: 'photo', sourceKey: 'first_time_photo:9', url: null },        // no url → not used
      ]),
      chapter([{ type: 'l-wrap', sourceKey: 'journal:3', photoSourceKey: 'bump:4', content: toTiptapDoc('lw'), url: 'x.jpg' }]),
    ]);
    expect([...text].sort()).toEqual(['journal:1', 'journal:3']);
    expect([...photo].sort()).toEqual(['bump:4', 'first_time:5']);
  });
  it('is empty for no chapters', () => {
    const { text, photo } = collectUsedKeys([]);
    expect(text.size).toBe(0);
    expect(photo.size).toBe(0);
  });
});
