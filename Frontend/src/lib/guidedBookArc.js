// The LOCKED guided-book arcs (sv2-s7b). Two ordered page sequences — "Your First Year" and
// "Bump to One" — that a guided book materialises into one storybook_chapters row per entry at
// creation (Model A). See plans/storybook-v2/sv2-s7-plan-default-book.md (the locked arc) and
// sv2-s7b-guided-arc.md (mechanics). This file is the single source of truth for the arc; the
// backend stays a dumb transactional writer (do NOT mirror this into Java).
//
// Entry shape:
//   { id, section, templateId, kind, label, prompt, defaultBucket }
//     id         — stable, unique within an arc (used as the materialised row's key).
//     section    — the section this entry sits in (also the divider's own section).
//     templateId — a real TEMPLATES id from lib/storybookTemplates.js.
//     kind       — drives builder behaviour + progress (see KINDS below).
//     label      — the page's title / guidance heading. For a `divider`, the section title.
//     prompt     — fill/pick: guidance shown in the slot. auto/prefill: helper/status text.
//                  divider: the section subtitle.
//     defaultBucket — (sv2-s7.5a) the memory time-bucket the builder auto-expands for this page
//                  (a BUCKETS id from guidedBook.js). null on generic pages (open all-collapsed) and
//                  on auto/prefill/divider pages (no memory panel).
//
// Kinds:
//   fill     — empty designed slots; user drags photos / types text.
//   pick     — a moment_hero the user seeds by choosing a First (degrades to manual fill).
//   auto     — renders straight from data (birth_day, family_tree); read-only.
//   prefill  — seeded-but-editable from data (people, milestones).
//   divider  — a chapter_divider section opener; counted, "done" by default.
import { TEMPLATES } from "@/lib/storybookTemplates";
import { makePageId, emptyBlocksForTemplate } from "@/lib/storybookLayout";
import { toTiptapDoc } from "@/lib/tiptap";

export const KINDS = ['fill', 'pick', 'auto', 'prefill', 'divider'];

// Kinds that need no user input to count as "filled" for the progress indicator (work item D).
const DEFAULT_FILLED_KINDS = new Set(['auto', 'prefill', 'divider']);

/** True if a page of this kind counts as done without any user content. */
export function isFilledByDefault(kind) {
  return DEFAULT_FILLED_KINDS.has(kind);
}

const MOMENT_HERO = 'moment-hero-portrait'; // portrait is the book default orientation

const divider = (id, section, subtitle) => ({
  id, section, templateId: 'chapter_divider', kind: 'divider', label: section, prompt: subtitle,
  defaultBucket: null,
});

const page = (id, section, templateId, kind, label, prompt, defaultBucket = null) => ({
  id, section, templateId, kind, label, prompt, defaultBucket,
});

// ── "Your First Year" — 25 content + 5 dividers = 30 interior pages ──────────────────
export const FIRST_YEAR_ARC = [
  // ▸ The Beginning
  divider('div-beginning', 'The Beginning', 'How your story started'),
  page('letter-to-you',  'The Beginning', 'letter',    'fill',
    'A Letter to You',
    'Write a few words to your child — what you felt the day they arrived, what you hope for them.',
    'm0-3'),
  page('day-we-met',     'The Beginning', 'birth_day', 'auto',
    'The Day We Met You',
    'Fills from your saved birth details — date, weight, length, hospital.'),
  page('welcome',        'The Beginning', 'gallery',   'fill',
    'Welcome to the World',
    'Your first photos together — the very first hours.',
    'm0-3'),
  page('coming-home',    'The Beginning', 'spotlight', 'fill',
    'Coming Home',
    'The day you came home — who carried you in, where you slept that first night.',
    'm0-3'),
  page('tiny-new',       'The Beginning', 'spotlight', 'fill',
    'Tiny & New',
    'How small you were — tiny hands, sleepy faces, those newborn days.',
    'm0-3'),

  // ▸ Your People
  divider('div-people', 'Your People', 'The ones who love you'),
  page('your-people',   'Your People', 'people',      'prefill',
    'Your People',
    'Seeded from Your People. Edit or rearrange.'),
  page('wider-circle',  'Your People', 'people',      'prefill',
    'The Wider Circle',
    'The rest of your people. Edit or rearrange.'),
  page('family-tree',   'Your People', 'family_tree', 'auto',
    'Your Family Tree',
    'Drawn from your family members.'),

  // ▸ Your Firsts
  divider('div-firsts', 'Your Firsts', "Moments we'll never forget"),
  page('first-1', 'Your Firsts', MOMENT_HERO, 'pick',
    "A First We'll Never Forget",
    'Choose a First to feature — add a photo and a few words about it.'),
  page('first-2', 'Your Firsts', MOMENT_HERO, 'pick',
    "A First We'll Never Forget",
    'Choose a First to feature — add a photo and a few words about it.'),
  page('first-3', 'Your Firsts', MOMENT_HERO, 'pick',
    "A First We'll Never Forget",
    'Choose a First to feature — add a photo and a few words about it.'),
  page('first-4', 'Your Firsts', MOMENT_HERO, 'pick',
    "A First We'll Never Forget",
    'Choose a First to feature — add a photo and a few words about it.'),
  page('little-moments', 'Your Firsts', 'gallery', 'fill',
    'Little Moments',
    'The small everyday firsts — bath time, giggles, mess and all.'),

  // ▸ Watch You Grow
  // Each window uses a DISTINCT layout so the four growth pages don't read as one repeated template
  // (sv2-s7.5d), and the labels are the bucket windows (0–3 / 4–6 / 7–9 / 10–12) so each page maps
  // 1:1 to its memory bucket. NB: the entry IDs stay 'months-3-6/6-9/9-12' (they key already-created
  // guided-book rows) even though the labels now read 4–6 / 7–9 / 10–12 — do not rename them.
  divider('div-grow', 'Watch You Grow', 'Season by season'),
  page('months-0-3',  'Watch You Grow', 'growth-spread', 'fill',
    'Months 0–3',
    'Those first three months — how you changed week to week.',
    'm0-3'),
  page('months-3-6',  'Watch You Grow', 'story-snapshot', 'fill',
    'Months 4–6',
    'Months four to six — new sounds, new faces, finding your hands.',
    'm4-6'),
  page('months-6-9',  'Watch You Grow', 'staggered', 'fill',
    'Months 7–9',
    'Months seven to nine — sitting up and getting curious.',
    'm7-9'),
  page('months-9-12', 'Watch You Grow', 'photo-first', 'fill',
    'Months 10–12',
    'Months ten to twelve — almost one, on the move.',
    'm10-12'),
  page('how-you-grew', 'Watch You Grow', 'milestones', 'prefill',
    'How You Grew',
    'Your tracked milestones. Tidy the wording or add your own.'),

  // ▸ You at One
  divider('div-one', 'You at One', 'Happy first birthday'),
  page('out-about',     'You at One', 'gallery',    'fill',
    'Out & About',
    'Your adventures — walks, trips, your favorite places.'),
  page('all-about-you', 'You at One', 'prompts',    'fill',
    'All About You',
    'Your favorites right now — foods, toys, songs, the things that make you, you.'),
  page('hands-feet',    'You at One', 'hands-feet', 'fill',
    'Your Hands & Feet',
    'Trace or photograph those little hands and feet before they grow.'),
  page('happy-birthday', 'You at One', MOMENT_HERO, 'fill',
    'Happy First Birthday',
    'Your first birthday — the cake, the candle, that face.',
    'y1plus'),
  page('the-party',     'You at One', 'gallery',    'fill',
    'The Party',
    'The celebration — everyone who came to celebrate you.'),
  page('one-year',      'You at One', 'letter',     'fill',
    'One Year of You',
    'A letter on turning one — how this year felt, what you want to remember.',
    'y1plus'),
  page('story-continues', 'You at One', 'spotlight', 'fill',
    'Your Story Continues…',
    'A last photo and a few words to close your first year.',
    'y1plus'),
];

// ── "Bump to One" — the pregnancy chapter, then the First-Year arc minus the standalone letter ──
// Front-inserts 5 pregnancy pages + their divider and drops "A Letter to You" (replaced by
// "A Letter Before You Arrived"). 5 + 1 divider + (30 − 1) = 35 interior pages.
const PREGNANCY_BLOCK = [
  divider('div-before', 'Before You Arrived', 'While we waited for you'),
  page('letter-before', 'Before You Arrived', 'letter',    'fill',
    'A Letter Before You Arrived',
    "Write to your baby before they're born — what these months have felt like.",
    'pregnancy'),
  page('found-out',     'Before You Arrived', 'spotlight', 'fill',
    'The Day We Found Out',
    'The moment you knew — how you felt, who you told first.',
    'pregnancy'),
  page('first-photo',   'Before You Arrived', 'spotlight', 'fill',
    'Your First Photo',
    'Your first scan — the very first picture of you.',
    'pregnancy'),
  page('bump-early',    'Before You Arrived', 'bump',      'fill',
    'The Bump — Early Days',
    'Early bump photos — the beginning shows.',
    'pregnancy'),
  page('bump-bloom',    'Before You Arrived', 'bump',      'fill',
    'The Bump — Full Bloom',
    'The full bloom — those last big weeks.',
    'pregnancy'),
];

export const BUMP_TO_ONE_ARC = [
  ...PREGNANCY_BLOCK,
  ...FIRST_YEAR_ARC.filter(e => e.id !== 'letter-to-you'),
];

/** True when the profile has pregnancy data worth a "Bump to One" chapter. */
export function hasPregnancyData(profile) {
  if (!profile) return false;
  return profile.phase === 'pregnancy' || !!profile.dueDate;
}

/** Pick the guided arc for a profile, chosen once at book creation. */
export function arcFor(profile) {
  return hasPregnancyData(profile) ? BUMP_TO_ONE_ARC : FIRST_YEAR_ARC;
}

// ── Arc-entry lookup ─────────────────────────────────────────────────────────
// A guided chapter stores its arc entry id as its anchor_key; the guided metadata (kind, prompt,
// label, section) is NOT persisted — it's re-derived here from the arc config so the builder, the
// progress indicator (work item D), and locked-sequence logic stay drift-free. Ids are unique across
// the union of both arcs (the pregnancy ids are distinct from the first-year ids; shared entries are
// the same object).
const ENTRY_BY_ID = new Map();
for (const e of [...FIRST_YEAR_ARC, ...BUMP_TO_ONE_ARC]) {
  if (!ENTRY_BY_ID.has(e.id)) ENTRY_BY_ID.set(e.id, e);
}

/** The arc entry for a guided chapter's anchorKey, or null if it isn't a known guided page. */
export function arcEntryById(id) {
  return ENTRY_BY_ID.get(id) ?? null;
}

// ── Instantiation (sv2-s7b work item B, frontend side) ───────────────────────
// Build the empty page blocks for one arc entry. Dividers have no builder step, so their title /
// subtitle are pre-seeded (section name + tagline) — every other kind starts blank and is filled in
// the builder (fill/pick) or rendered from data (auto/prefill).
function seedBlocks(entry, tpl) {
  const blocks = emptyBlocksForTemplate(tpl);
  if (entry.kind !== 'divider') return blocks;
  return blocks.map(b => {
    if (b.id === 'title')    return { ...b, content: toTiptapDoc(entry.label) };
    if (b.id === 'subtitle') return { ...b, content: toTiptapDoc(entry.prompt) };
    return b;
  });
}

/**
 * Expand a guided arc into the `chapters` payload for POST /books — one seed per entry, in order.
 * Each seed carries the layout_data the builder/renderer expect (version 2, a single page with the
 * entry's templateId + empty blocks). anchorKey = entry id; the backend fixes anchor_type='guided'.
 */
export function expandArcToChapterSeeds(arc) {
  return arc.map((entry, index) => {
    const tpl = TEMPLATES.find(t => t.id === entry.templateId) ?? null;
    return {
      anchorKey: entry.id,
      anchorLabel: entry.label,
      sortOrder: index,
      layoutData: {
        version: 2,
        pages: [{
          id: makePageId(),
          sourceKeys: [],
          templateId: entry.templateId,
          backgroundColor: null,
          blocks: seedBlocks(entry, tpl),
        }],
      },
    };
  });
}
