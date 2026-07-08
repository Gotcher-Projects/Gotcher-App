import { describe, it, expect } from 'vitest';
import { TEMPLATES } from '../lib/storybookTemplates.js';
import { contentToPlainText } from '../lib/tiptap.js';
import {
  FIRST_YEAR_ARC,
  BUMP_TO_ONE_ARC,
  KINDS,
  arcFor,
  arcEntryById,
  hasPregnancyData,
  isFilledByDefault,
  expandArcToChapterSeeds,
} from '../lib/guidedBookArc.js';

const TEMPLATE_IDS = new Set(TEMPLATES.map(t => t.id));
const VALID_KINDS = new Set(KINDS);
const ARCS = { FIRST_YEAR_ARC, BUMP_TO_ONE_ARC };

const countKind = (arc, kind) => arc.filter(e => e.kind === kind).length;
const dividers = arc => arc.filter(e => e.kind === 'divider');
const content = arc => arc.filter(e => e.kind !== 'divider');

describe('guidedBookArc — entry shape', () => {
  for (const [name, arc] of Object.entries(ARCS)) {
    describe(name, () => {
      it('every entry maps to a real template id', () => {
        for (const e of arc) {
          expect(TEMPLATE_IDS.has(e.templateId), `${e.id} → ${e.templateId}`).toBe(true);
        }
      });

      it('every entry has a valid kind', () => {
        for (const e of arc) {
          expect(VALID_KINDS.has(e.kind), `${e.id} kind=${e.kind}`).toBe(true);
        }
      });

      it('every entry has the full field set', () => {
        for (const e of arc) {
          for (const field of ['id', 'section', 'templateId', 'kind', 'label', 'prompt']) {
            expect(typeof e[field], `${e.id}.${field}`).toBe('string');
            expect(e[field].length, `${e.id}.${field}`).toBeGreaterThan(0);
          }
        }
      });

      it('has unique entry ids', () => {
        const ids = arc.map(e => e.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('every divider uses the chapter_divider template', () => {
        for (const d of dividers(arc)) expect(d.templateId).toBe('chapter_divider');
      });

      it('only pick pages use the moment_hero template (plus the birthday fill page)', () => {
        // moment_hero is only reused for `pick` and the single `happy-birthday` fill page.
        for (const e of arc) {
          if (e.templateId === 'moment-hero-portrait') {
            expect(['pick', 'fill']).toContain(e.kind);
          }
        }
      });
    });
  }
});

describe('guidedBookArc — locked page counts', () => {
  it('First Year = 25 content + 5 dividers = 30 interior', () => {
    expect(content(FIRST_YEAR_ARC).length).toBe(25);
    expect(dividers(FIRST_YEAR_ARC).length).toBe(5);
    expect(FIRST_YEAR_ARC.length).toBe(30);
  });

  it('Bump to One = 29 content + 6 dividers = 35 interior', () => {
    expect(content(BUMP_TO_ONE_ARC).length).toBe(29);
    expect(dividers(BUMP_TO_ONE_ARC).length).toBe(6);
    expect(BUMP_TO_ONE_ARC.length).toBe(35);
  });

  it('First Year has exactly 4 pick pages; Bump keeps them', () => {
    expect(countKind(FIRST_YEAR_ARC, 'pick')).toBe(4);
    expect(countKind(BUMP_TO_ONE_ARC, 'pick')).toBe(4);
  });

  it('Bump front-inserts the pregnancy chapter and drops the standalone letter', () => {
    expect(BUMP_TO_ONE_ARC[0].id).toBe('div-before');
    expect(BUMP_TO_ONE_ARC.some(e => e.id === 'letter-before')).toBe(true);
    expect(BUMP_TO_ONE_ARC.some(e => e.id === 'letter-to-you')).toBe(false);
    // First Year still opens with the standalone letter under The Beginning.
    expect(FIRST_YEAR_ARC.some(e => e.id === 'letter-to-you')).toBe(true);
  });

  it('Bump = pregnancy block (6) + First Year minus the letter (29)', () => {
    expect(BUMP_TO_ONE_ARC.length).toBe(6 + (FIRST_YEAR_ARC.length - 1));
  });
});

describe('guidedBookArc — defaultBucket (sv2-s7.5a)', () => {
  it('windowed pages carry the matching bucket; growth spreads map 1:1', () => {
    expect(arcEntryById('welcome').defaultBucket).toBe('m0-3');
    expect(arcEntryById('months-0-3').defaultBucket).toBe('m0-3');
    expect(arcEntryById('months-3-6').defaultBucket).toBe('m4-6');
    expect(arcEntryById('months-6-9').defaultBucket).toBe('m7-9');
    expect(arcEntryById('months-9-12').defaultBucket).toBe('m10-12');
    expect(arcEntryById('one-year').defaultBucket).toBe('y1plus');
    expect(arcEntryById('bump-early').defaultBucket).toBe('pregnancy');
  });
  it('generic and auto/prefill/divider pages have no default bucket', () => {
    expect(arcEntryById('out-about').defaultBucket).toBeNull();   // generic fill
    expect(arcEntryById('day-we-met').defaultBucket).toBeNull();  // auto
    expect(arcEntryById('your-people').defaultBucket).toBeNull(); // prefill
    expect(arcEntryById('div-beginning').defaultBucket).toBeNull(); // divider
  });
});

describe('guidedBookArc — growth layout variety (sv2-s7.5d)', () => {
  const g = (id) => arcEntryById(id);

  it('each growth window uses a distinct layout, in order', () => {
    expect([
      g('months-0-3').templateId,
      g('months-3-6').templateId,
      g('months-6-9').templateId,
      g('months-9-12').templateId,
    ]).toEqual(['growth-spread', 'story-snapshot', 'staggered', 'photo-first']);
  });

  it('labels read the bucket windows 0–3 / 4–6 / 7–9 / 10–12', () => {
    expect([
      g('months-0-3').label,
      g('months-3-6').label,
      g('months-6-9').label,
      g('months-9-12').label,
    ]).toEqual(['Months 0–3', 'Months 4–6', 'Months 7–9', 'Months 10–12']);
  });
});

describe('guidedBookArc — arcFor', () => {
  it('picks First Year for a baby-only profile', () => {
    expect(arcFor({ phase: 'baby', dueDate: '' })).toBe(FIRST_YEAR_ARC);
  });

  it('picks Bump to One when phase is pregnancy', () => {
    expect(arcFor({ phase: 'pregnancy' })).toBe(BUMP_TO_ONE_ARC);
  });

  it('picks Bump to One when a due date is recorded (post-birth keepsake)', () => {
    expect(arcFor({ phase: 'baby', dueDate: '2026-01-01' })).toBe(BUMP_TO_ONE_ARC);
  });

  it('defaults to First Year for a missing/empty profile', () => {
    expect(arcFor(null)).toBe(FIRST_YEAR_ARC);
    expect(arcFor(undefined)).toBe(FIRST_YEAR_ARC);
    expect(arcFor({})).toBe(FIRST_YEAR_ARC);
  });
});

describe('guidedBookArc — arcEntryById', () => {
  it('resolves first-year and pregnancy entries by id', () => {
    expect(arcEntryById('letter-to-you').kind).toBe('fill');
    expect(arcEntryById('day-we-met').kind).toBe('auto');
    expect(arcEntryById('first-1').kind).toBe('pick');
    expect(arcEntryById('div-before').kind).toBe('divider');
    expect(arcEntryById('letter-before').section).toBe('Before You Arrived');
  });

  it('returns null for an unknown id', () => {
    expect(arcEntryById('not-a-page')).toBeNull();
  });

  it('covers every entry id in both arcs', () => {
    for (const e of [...FIRST_YEAR_ARC, ...BUMP_TO_ONE_ARC]) {
      expect(arcEntryById(e.id)).toBe(e);
    }
  });
});

describe('guidedBookArc — expandArcToChapterSeeds', () => {
  it('produces one ordered seed per entry with the right anchor + layout shape', () => {
    const seeds = expandArcToChapterSeeds(FIRST_YEAR_ARC);
    expect(seeds).toHaveLength(FIRST_YEAR_ARC.length);

    seeds.forEach((seed, i) => {
      const entry = FIRST_YEAR_ARC[i];
      expect(seed.anchorKey).toBe(entry.id);
      expect(seed.anchorLabel).toBe(entry.label);
      expect(seed.sortOrder).toBe(i);
      expect(seed.layoutData.version).toBe(2);
      expect(seed.layoutData.pages).toHaveLength(1);
      const page = seed.layoutData.pages[0];
      expect(page.templateId).toBe(entry.templateId);
      expect(page.sourceKeys).toEqual([]);
      expect(page.backgroundColor).toBeNull();
      expect(typeof page.id).toBe('string');
    });
  });

  it('pre-seeds divider title + subtitle from the entry; leaves the eyebrow blank', () => {
    const seeds = expandArcToChapterSeeds(FIRST_YEAR_ARC);
    const dividerEntry = FIRST_YEAR_ARC.find(e => e.kind === 'divider');
    const dividerSeed = seeds.find(s => s.anchorKey === dividerEntry.id);
    const blocks = dividerSeed.layoutData.pages[0].blocks;

    const title = blocks.find(b => b.id === 'title');
    const subtitle = blocks.find(b => b.id === 'subtitle');
    const label = blocks.find(b => b.id === 'label');
    expect(contentToPlainText(title.content)).toBe(dividerEntry.label);
    expect(contentToPlainText(subtitle.content)).toBe(dividerEntry.prompt);
    expect(contentToPlainText(label.content)).toBe('');
  });

  it('leaves fill pages blank (empty text, no photo fill)', () => {
    const seeds = expandArcToChapterSeeds(FIRST_YEAR_ARC);
    const letter = seeds.find(s => s.anchorKey === 'letter-to-you');
    for (const b of letter.layoutData.pages[0].blocks) {
      if (b.type === 'text') expect(contentToPlainText(b.content)).toBe('');
    }
    // gallery "welcome" — photo slots start unfilled
    const welcome = seeds.find(s => s.anchorKey === 'welcome');
    for (const b of welcome.layoutData.pages[0].blocks) {
      if (b.type === 'photo') expect(b.url).toBeNull();
    }
  });

  it('data-driven auto pages (birth_day) seed an empty block list', () => {
    const seeds = expandArcToChapterSeeds(FIRST_YEAR_ARC);
    const birth = seeds.find(s => s.anchorKey === 'day-we-met');
    expect(birth.layoutData.pages[0].templateId).toBe('birth_day');
    expect(birth.layoutData.pages[0].blocks).toEqual([]);
  });
});

describe('guidedBookArc — hasPregnancyData / isFilledByDefault', () => {
  it('hasPregnancyData reflects phase or due date', () => {
    expect(hasPregnancyData({ phase: 'pregnancy' })).toBe(true);
    expect(hasPregnancyData({ dueDate: '2026-01-01' })).toBe(true);
    expect(hasPregnancyData({ phase: 'baby' })).toBe(false);
    expect(hasPregnancyData(null)).toBe(false);
  });

  it('auto/prefill/divider count as filled by default; fill/pick do not', () => {
    expect(isFilledByDefault('auto')).toBe(true);
    expect(isFilledByDefault('prefill')).toBe(true);
    expect(isFilledByDefault('divider')).toBe(true);
    expect(isFilledByDefault('fill')).toBe(false);
    expect(isFilledByDefault('pick')).toBe(false);
  });
});
