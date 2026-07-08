// Page templates for the memory-book builder. Each template is a fixed set of
// normalized (0–1) block boxes with a `contentSource` describing which memory
// piece / photo fills it. Shared by ScrapbookBuilder and storybookGrouping.
//
// S12.1: 15-template set (was 16). Cuts: gallery, memory-gallery, three-short,
// two-up-both. Adds: photo-first, spotlight, l-wrap. Redesigns: staggered
// (replaces two-up-both), story-snapshot (replaces two-up-photo), timeline
// (replaces three-short-photos), photo-pair (replaces photo-two).
export const TEMPLATES = [

  // ── Single Memory — Text + Photo ────────────────────────────────────────────

  {
    id: 'classic',
    label: 'Classic',
    description: 'Text above, photo below',
    memoryCount: 1, minPhotos: 0, maxPhotos: 1,
    blocks: [
      { type: 'text',  x: 0.05, y: 0.04, width: 0.90, height: 0.36, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'photo', x: 0.05, y: 0.44, width: 0.90, height: 0.52, contentSource: { memoryIndex: 0, photoIndex: 0 } },
    ],
  },

  {
    id: 'photo-first',
    label: 'Photo First',
    description: 'Large photo leads, text anchors below',
    memoryCount: 1, minPhotos: 1, maxPhotos: 1,
    blocks: [
      { type: 'photo', x: 0.05, y: 0.04, width: 0.90, height: 0.52, contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { type: 'text',  x: 0.05, y: 0.60, width: 0.90, height: 0.36, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
    ],
  },

  {
    id: 'side-by-side',
    label: 'Side by Side',
    description: 'Text left, photo right',
    memoryCount: 1, minPhotos: 0, maxPhotos: 1,
    blocks: [
      { type: 'text',  x: 0.04, y: 0.06, width: 0.44, height: 0.88, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'photo', x: 0.52, y: 0.06, width: 0.44, height: 0.88, contentSource: { memoryIndex: 0, photoIndex: 0 } },
    ],
  },

  {
    id: 'spotlight',
    label: 'Spotlight',
    description: 'Photo centered with whitespace, caption below',
    memoryCount: 1, minPhotos: 1, maxPhotos: 1,
    blocks: [
      { type: 'photo', x: 0.10, y: 0.06, width: 0.80, height: 0.60, contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { type: 'text',  x: 0.12, y: 0.70, width: 0.76, height: 0.22, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
    ],
  },

  // ── Single Memory — Special ──────────────────────────────────────────────────

  {
    id: 'hero',
    label: 'Hero Photo',
    description: 'Full-page photo, caption overlay',
    memoryCount: 1, minPhotos: 1, maxPhotos: 1,
    blocks: [
      { type: 'photo', x: 0.0,  y: 0.0,  width: 1.0,  height: 1.0,  contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { type: 'text',  x: 0.04, y: 0.78, width: 0.92, height: 0.18, content: '', contentSource: { memoryIndex: 0, piece: 'caption' }, overlay: true },
    ],
  },

  {
    id: 'text-only',
    label: 'Text Only',
    description: 'Full-page text',
    memoryCount: 1, minPhotos: 0, maxPhotos: 0,
    blocks: [
      { type: 'text', x: 0.06, y: 0.06, width: 0.88, height: 0.88, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
    ],
  },

  {
    id: 'l-wrap',
    label: 'L-Wrap',
    description: 'Text flows around a top-right photo in an L-shape',
    memoryCount: 1, minPhotos: 1, maxPhotos: 1,
    blocks: [
      {
        type: 'l-wrap',
        x: 0.04, y: 0.04, width: 0.92, height: 0.92,
        content: '',
        url: null,
        label: '',
        sourceKey: null,
        photoSourceKey: null,
        suppressDropCap: true,
        contentSource: { memoryIndex: 0, piece: 'body', photoIndex: 0 },
      },
    ],
  },

  // ── Moment Hero ─────────────────────────────────────────────────────────────
  // CONTRACT: the moment_hero renderer (MomentHeroCanvas) looks blocks up by these
  // exact role `id`s — `badge`, `title`, `date`, `photo`, `note`, `attrib` — via
  // blk('badge') etc., NOT by position/order. Renaming/removing an id silently drops
  // that zone from the page. Keep these ids in sync with MomentHeroCanvas.

  {
    id: 'moment-hero-portrait',
    label: 'Moment Hero',
    description: 'Polaroid portrait photo with note card — scrapbook hero page',
    renderer: 'moment_hero',
    memoryCount: 1, minPhotos: 1, maxPhotos: 1,
    blocks: [
      { id: 'badge',  type: 'text',  x: 0.22, y: 0.03, width: 0.56, height: 0.05, content: '' },
      { id: 'title',  type: 'text',  x: 0.08, y: 0.09, width: 0.84, height: 0.10, content: '' },
      { id: 'date',   type: 'text',  x: 0.15, y: 0.20, width: 0.70, height: 0.05, content: '' },
      { id: 'photo',  type: 'photo', x: 0.20, y: 0.26, width: 0.60, height: 0.60, slotAR: 3 / 4, contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { id: 'note',   type: 'text',  x: 0.06, y: 0.88, width: 0.88, height: 0.08, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { id: 'attrib', type: 'text',  x: 0.06, y: 0.94, width: 0.88, height: 0.04, content: '' },
    ],
  },

  {
    id: 'moment-hero-landscape',
    label: 'Moment Hero',
    description: 'Polaroid landscape photo with note card — scrapbook hero page',
    renderer: 'moment_hero',
    memoryCount: 1, minPhotos: 1, maxPhotos: 1,
    blocks: [
      { id: 'badge',  type: 'text',  x: 0.22, y: 0.03, width: 0.56, height: 0.05, content: '' },
      { id: 'title',  type: 'text',  x: 0.08, y: 0.09, width: 0.84, height: 0.10, content: '' },
      { id: 'date',   type: 'text',  x: 0.15, y: 0.20, width: 0.70, height: 0.05, content: '' },
      { id: 'photo',  type: 'photo', x: 0.10, y: 0.26, width: 0.80, height: 0.45, slotAR: 4 / 3, contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { id: 'note',   type: 'text',  x: 0.06, y: 0.74, width: 0.88, height: 0.16, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { id: 'attrib', type: 'text',  x: 0.06, y: 0.92, width: 0.88, height: 0.05, content: '' },
    ],
  },

  // ── Letter ──────────────────────────────────────────────────────────────────
  // CONTRACT: the `letter` renderer (LetterCanvas) looks blocks up by these exact
  // role `id`s — `title`, `body`, `signature` — via blk('title') etc., NOT by
  // position/order. Renaming/removing an id silently drops that zone. Keep in sync
  // with LetterCanvas. Like moment_hero, the renderer ignores block x/y and lays out
  // its own fixed design; positions below are nominal. No photos, no memory binding —
  // a fully hand-written page.

  {
    id: 'letter',
    label: 'Letter',
    description: 'Full-page hand-written letter — title, body, signed',
    renderer: 'letter',
    memoryCount: 0, minPhotos: 0, maxPhotos: 0,
    blocks: [
      { id: 'title',     type: 'text', x: 0.10, y: 0.10, width: 0.80, height: 0.10, content: '' },
      { id: 'body',      type: 'text', x: 0.12, y: 0.26, width: 0.76, height: 0.52, content: '' },
      { id: 'signature', type: 'text', x: 0.12, y: 0.82, width: 0.76, height: 0.10, content: '' },
    ],
  },

  // ── Gallery ───────────────────────────────────────────────────────────────────
  // CONTRACT: the `gallery` renderer (GalleryCanvas) looks blocks up by these exact role
  // `id`s — `title`, `subtitle`, `photo1`..`photo4`, `cap1`..`cap4` — via blk('title') etc.,
  // NOT by position/order. Renaming/removing an id silently drops that zone. Like moment_hero,
  // the renderer ignores block x/y and lays out its own fixed design; positions below are nominal.
  // Photos fill from the photo tray today; sv2-s5/s7 wires it to first_time_photos data.

  {
    id: 'gallery',
    label: 'Gallery',
    description: '"More from…" — up to four captioned photos in a grid',
    renderer: 'gallery',
    memoryCount: 0, minPhotos: 1, maxPhotos: 4,
    blocks: [
      { id: 'title',    type: 'text',  x: 0.10, y: 0.06, width: 0.80, height: 0.06, content: '' },
      { id: 'subtitle', type: 'text',  x: 0.10, y: 0.13, width: 0.80, height: 0.04, content: '' },
      { id: 'photo1',   type: 'photo', x: 0.06, y: 0.24, width: 0.42, height: 0.32, contentSource: { photoIndex: 0 } },
      { id: 'cap1',     type: 'text',  x: 0.06, y: 0.56, width: 0.42, height: 0.03, content: '' },
      { id: 'photo2',   type: 'photo', x: 0.52, y: 0.24, width: 0.42, height: 0.32, contentSource: { photoIndex: 1 } },
      { id: 'cap2',     type: 'text',  x: 0.52, y: 0.56, width: 0.42, height: 0.03, content: '' },
      { id: 'photo3',   type: 'photo', x: 0.06, y: 0.62, width: 0.42, height: 0.32, contentSource: { photoIndex: 2 } },
      { id: 'cap3',     type: 'text',  x: 0.06, y: 0.94, width: 0.42, height: 0.03, content: '' },
      { id: 'photo4',   type: 'photo', x: 0.52, y: 0.62, width: 0.42, height: 0.32, contentSource: { photoIndex: 3 } },
      { id: 'cap4',     type: 'text',  x: 0.52, y: 0.94, width: 0.42, height: 0.03, content: '' },
    ],
  },

  // ── Birth Day (sv2-s2) ────────────────────────────────────────────────────────
  // Data-driven page: the `birth_day` renderer (BirthDayCanvas) ignores blocks entirely and
  // live-reads birth_details (+ babyName/birthdate/coverPhotoUrl) threaded through the render
  // pipeline. No editable zones — data is entered in the Edit-Profile modal's Birth details tab.

  {
    id: 'birth_day',
    label: 'The Day We Met You',
    description: 'Birth-day keepsake — reads your saved birth details',
    renderer: 'birth_day',
    memoryCount: 0, minPhotos: 0, maxPhotos: 0,
    blocks: [],
  },

  // ── Your People (sv2-s3) ────────────────────────────────────────────────────────
  // Data-driven: the `people` renderer (PeopleCanvas) live-reads family_members. The config block
  // stores which members appear on this page + the variant; edited via the FamilyRosterPopup
  // launched when this template is picked in the builder.

  {
    id: 'people',
    label: 'Your People',
    description: 'Family profile cards — photo, name, role, a few words',
    renderer: 'people',
    memoryCount: 0, minPhotos: 0, maxPhotos: 0,
    blocks: [
      { id: 'config', type: 'people-config', selectedMemberIds: [], variant: 'two-up' },
    ],
  },

  // ── Family Tree (sv2-s5) ────────────────────────────────────────────────────────
  // Data-driven: the `family_tree` renderer (FamilyTreeCanvas) live-reads family_members (placed by
  // roleCategory) + the baby (babyName/coverPhotoUrl) threaded through the pipeline. No editable
  // zones — people are managed in "Your People"; this page just visualises them.

  {
    id: 'family_tree',
    label: 'Family Tree',
    description: 'A connected tree — grandparents, parents, you',
    renderer: 'family_tree',
    memoryCount: 0, minPhotos: 0, maxPhotos: 0,
    blocks: [],
  },

  // ── Chapter Divider (sv2-s6) ────────────────────────────────────────────────────
  // CONTRACT: the `chapter_divider` renderer (ChapterDividerCanvas) looks blocks up by ids
  // `label`, `title`, `subtitle` via blk(...). Renderer ignores x/y; positions below are nominal.

  {
    id: 'chapter_divider',
    label: 'Chapter Divider',
    description: 'Opens a section — chapter label, title, subtitle',
    renderer: 'chapter_divider',
    memoryCount: 0, minPhotos: 0, maxPhotos: 0,
    blocks: [
      { id: 'label',    type: 'text', x: 0.10, y: 0.30, width: 0.80, height: 0.05, content: '' },
      { id: 'title',    type: 'text', x: 0.10, y: 0.40, width: 0.80, height: 0.14, content: '' },
      { id: 'subtitle', type: 'text', x: 0.12, y: 0.58, width: 0.76, height: 0.08, content: '' },
    ],
  },

  // ── Prompt page "All About You" (sv2-s6) ────────────────────────────────────────
  // CONTRACT: the `prompts` renderer (PromptsCanvas) has FIXED preset labels (PROMPT_LABELS) and
  // pulls each answer by id `val0`..`val4`. Keep the block count in sync with PROMPT_LABELS.

  {
    id: 'prompts',
    label: 'All About You',
    description: 'Preset prompts you fill in — nickname, favourites…',
    renderer: 'prompts',
    memoryCount: 0, minPhotos: 0, maxPhotos: 0,
    blocks: [
      { id: 'val0', type: 'text', x: 0.12, y: 0.34, width: 0.76, height: 0.06, content: '' },
      { id: 'val1', type: 'text', x: 0.12, y: 0.46, width: 0.76, height: 0.06, content: '' },
      { id: 'val2', type: 'text', x: 0.12, y: 0.58, width: 0.76, height: 0.06, content: '' },
      { id: 'val3', type: 'text', x: 0.12, y: 0.70, width: 0.76, height: 0.06, content: '' },
      { id: 'val4', type: 'text', x: 0.12, y: 0.82, width: 0.76, height: 0.06, content: '' },
    ],
  },

  // ── Bump page (sv2-s6) ──────────────────────────────────────────────────────────
  // CONTRACT: the `bump` renderer (BumpCanvas) looks blocks up by ids `title`, `photo1`, `week1`,
  // `photo2`, `week2`, `note`. Each photo gets an auto week→size tag when its week field parses.

  {
    id: 'bump',
    label: 'Bump Page',
    description: 'Two bump photos with an auto week → size tag + a note',
    renderer: 'bump',
    memoryCount: 0, minPhotos: 0, maxPhotos: 2,
    blocks: [
      { id: 'title',  type: 'text',  x: 0.10, y: 0.06, width: 0.80, height: 0.06, content: '' },
      { id: 'photo1', type: 'photo', x: 0.06, y: 0.22, width: 0.42, height: 0.50, contentSource: { photoIndex: 0 } },
      { id: 'week1',  type: 'text',  x: 0.06, y: 0.74, width: 0.42, height: 0.04, content: '' },
      { id: 'photo2', type: 'photo', x: 0.52, y: 0.22, width: 0.42, height: 0.50, contentSource: { photoIndex: 1 } },
      { id: 'week2',  type: 'text',  x: 0.52, y: 0.74, width: 0.42, height: 0.04, content: '' },
      { id: 'note',   type: 'text',  x: 0.06, y: 0.86, width: 0.88, height: 0.10, content: '' },
    ],
  },

  // ── Milestones "How You Grew" (sv2-s6.5) ────────────────────────────────────────
  // HYBRID prefill + fill. The `milestones` renderer (MilestonesCanvas) draws its own fixed Panel-F
  // design (list down the left, two tilted polaroids in the right corners) and IGNORES block x/y.
  // - NAMES are data-driven: read live from the baby's achieved milestones via pageData (no blocks).
  // - DATES are prefill: blk('date0'..'date4') override if edited, else seed-on-display from the
  //   achieved date (see lib/milestonesPage.js). "Refresh from data" re-seeds them.
  // - PHOTOS are fill: blk('photo1'|'photo2') + optional script caption blk('cap1'|'cap2'); empty
  //   slots show a drop frame in the builder and are hidden in the read/PDF view.
  // Title/eyebrow are hardcoded in the renderer (like PromptsCanvas), so there is no title block.

  {
    id: 'milestones',
    label: 'How You Grew',
    description: 'Your milestones + a couple of polaroids',
    renderer: 'milestones',
    memoryCount: 0, minPhotos: 0, maxPhotos: 2,
    blocks: [
      // slotAR 1.2 == the polaroid photo slot aspect in MilestonesCanvas (POLAROID_AR) — the crop modal
      // crops to slotAR, so the slot must render at the same ratio or the stored crop is mis-fit (top clipped).
      { id: 'photo1', type: 'photo', x: 0.60, y: 0.16, width: 0.34, height: 0.24, slotAR: 1.2, contentSource: { photoIndex: 0 } },
      { id: 'cap1',   type: 'text',  x: 0.60, y: 0.41, width: 0.34, height: 0.05, content: '' },
      { id: 'photo2', type: 'photo', x: 0.58, y: 0.62, width: 0.36, height: 0.26, slotAR: 1.2, contentSource: { photoIndex: 1 } },
      { id: 'cap2',   type: 'text',  x: 0.58, y: 0.89, width: 0.36, height: 0.05, content: '' },
      { id: 'date0',  type: 'text',  x: 0.06, y: 0.26, width: 0.46, height: 0.05, content: '' },
      { id: 'date1',  type: 'text',  x: 0.06, y: 0.35, width: 0.46, height: 0.05, content: '' },
      { id: 'date2',  type: 'text',  x: 0.06, y: 0.44, width: 0.46, height: 0.05, content: '' },
      { id: 'date3',  type: 'text',  x: 0.06, y: 0.53, width: 0.46, height: 0.05, content: '' },
      { id: 'date4',  type: 'text',  x: 0.06, y: 0.62, width: 0.46, height: 0.05, content: '' },
      { id: 'date5',  type: 'text',  x: 0.06, y: 0.71, width: 0.46, height: 0.05, content: '' },
      { id: 'date6',  type: 'text',  x: 0.06, y: 0.80, width: 0.46, height: 0.05, content: '' },
    ],
  },

  // ── Trio + Note (sv2-s6) ────────────────────────────────────────────────────────
  // Generic reusable layout (no custom renderer): title + 1 large + 2 small photos + a note. The
  // guided book uses it as the "Months 0–3…" growth spread, but in the scrapbook picker it's just a
  // neutral layout. suppressDropCap on the text blocks — these are short title/note fields, not body
  // paragraphs, so the journal drop-cap would render a giant first letter ("T" + "EST").

  {
    id: 'growth-spread',
    label: 'Trio + Note',
    description: 'One large + two small photos, with a title & note',
    memoryCount: 0, minPhotos: 1, maxPhotos: 3,
    blocks: [
      { type: 'text',  x: 0.06, y: 0.05, width: 0.88, height: 0.10, content: '', suppressDropCap: true },
      { type: 'photo', x: 0.06, y: 0.18, width: 0.55, height: 0.46, contentSource: { photoIndex: 0 } },
      { type: 'photo', x: 0.64, y: 0.18, width: 0.30, height: 0.22, contentSource: { photoIndex: 1 } },
      { type: 'photo', x: 0.64, y: 0.42, width: 0.30, height: 0.22, contentSource: { photoIndex: 2 } },
      { type: 'text',  x: 0.06, y: 0.68, width: 0.88, height: 0.27, content: '', suppressDropCap: true },
    ],
  },

  // ── Pair + Caption (sv2-s6) ─────────────────────────────────────────────────────
  // Generic reusable layout: title + two photo slots + a caption. The guided book uses it as the
  // "Hands & Feet" page, but it's a neutral two-photo layout in the picker. suppressDropCap as above.

  {
    id: 'hands-feet',
    label: 'Pair + Caption',
    description: 'Two photos with a title & caption',
    memoryCount: 0, minPhotos: 1, maxPhotos: 2,
    blocks: [
      { type: 'text',  x: 0.06, y: 0.06, width: 0.88, height: 0.10, content: '', suppressDropCap: true },
      { type: 'photo', x: 0.06, y: 0.20, width: 0.43, height: 0.56, contentSource: { photoIndex: 0 } },
      { type: 'photo', x: 0.51, y: 0.20, width: 0.43, height: 0.56, contentSource: { photoIndex: 1 } },
      { type: 'text',  x: 0.06, y: 0.80, width: 0.88, height: 0.14, content: '', suppressDropCap: true },
    ],
  },

  // ── Two Memories ─────────────────────────────────────────────────────────────

  {
    id: 'two-up',
    label: 'Two Memories',
    description: 'Two memories, text only',
    memoryCount: 2, minPhotos: 0, maxPhotos: 0,
    blocks: [
      { type: 'text', x: 0.04, y: 0.05, width: 0.92, height: 0.42, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'text', x: 0.04, y: 0.52, width: 0.92, height: 0.42, content: '', contentSource: { memoryIndex: 1, piece: 'body' } },
    ],
  },

  {
    id: 'story-snapshot',
    label: 'Story + Snapshot',
    description: 'Memory 1: side-by-side. Memory 2: full-width below.',
    memoryCount: 2, minPhotos: 1, maxPhotos: 1,
    blocks: [
      { type: 'text',  x: 0.04, y: 0.04, width: 0.44, height: 0.44, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'photo', x: 0.52, y: 0.04, width: 0.44, height: 0.44, contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { type: 'text',  x: 0.04, y: 0.52, width: 0.92, height: 0.43, content: '', contentSource: { memoryIndex: 1, piece: 'body' } },
    ],
  },

  {
    id: 'staggered',
    label: 'Staggered',
    description: 'Two memories in opposing columns',
    memoryCount: 2, minPhotos: 2, maxPhotos: 2,
    blocks: [
      { type: 'photo', x: 0.04, y: 0.04, width: 0.44, height: 0.44, contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { type: 'text',  x: 0.04, y: 0.52, width: 0.44, height: 0.44, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'text',  x: 0.52, y: 0.04, width: 0.44, height: 0.44, content: '', contentSource: { memoryIndex: 1, piece: 'body' } },
      { type: 'photo', x: 0.52, y: 0.52, width: 0.44, height: 0.44, contentSource: { memoryIndex: 1, photoIndex: 0 } },
    ],
  },

  // ── Three Memories ───────────────────────────────────────────────────────────

  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Three entries — thumbnail photo + text per row',
    memoryCount: 3, minPhotos: 0, maxPhotos: 3,
    blocks: [
      { type: 'photo', x: 0.04, y: 0.04, width: 0.28, height: 0.28, contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { type: 'text',  x: 0.36, y: 0.04, width: 0.60, height: 0.28, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'photo', x: 0.04, y: 0.36, width: 0.28, height: 0.28, contentSource: { memoryIndex: 1, photoIndex: 0 } },
      { type: 'text',  x: 0.36, y: 0.36, width: 0.60, height: 0.28, content: '', contentSource: { memoryIndex: 1, piece: 'body' } },
      { type: 'photo', x: 0.04, y: 0.68, width: 0.28, height: 0.28, contentSource: { memoryIndex: 2, photoIndex: 0 } },
      { type: 'text',  x: 0.36, y: 0.68, width: 0.60, height: 0.28, content: '', contentSource: { memoryIndex: 2, piece: 'body' } },
    ],
  },

  // ── Photo Only ───────────────────────────────────────────────────────────────

  {
    id: 'photo-full',
    label: 'Full Photo',
    description: 'Single full-bleed photo',
    memoryCount: 0, minPhotos: 1, maxPhotos: 1,
    blocks: [
      { type: 'photo', x: 0, y: 0, width: 1, height: 1, contentSource: { photoIndex: 0 } },
    ],
  },

  {
    id: 'photo-pair',
    label: 'Photo Pair',
    description: 'Two tall photos side by side',
    memoryCount: 0, minPhotos: 2, maxPhotos: 2,
    blocks: [
      { type: 'photo', x: 0.02, y: 0.04, width: 0.46, height: 0.92, contentSource: { photoIndex: 0 } },
      { type: 'photo', x: 0.52, y: 0.04, width: 0.46, height: 0.92, contentSource: { photoIndex: 1 } },
    ],
  },

  {
    id: 'photo-three',
    label: 'Photo Three',
    description: '1 large + 2 smaller photos',
    memoryCount: 0, minPhotos: 3, maxPhotos: 3,
    blocks: [
      { type: 'photo', x: 0.02, y: 0.04, width: 0.96, height: 0.52, contentSource: { photoIndex: 0 } },
      { type: 'photo', x: 0.02, y: 0.58, width: 0.46, height: 0.38, contentSource: { photoIndex: 1 } },
      { type: 'photo', x: 0.52, y: 0.58, width: 0.46, height: 0.38, contentSource: { photoIndex: 2 } },
    ],
  },

  {
    id: 'photo-grid',
    label: 'Photo Grid',
    description: '2×2 photo grid',
    memoryCount: 0, minPhotos: 4, maxPhotos: 4,
    blocks: [
      { type: 'photo', x: 0.02, y: 0.04, width: 0.46, height: 0.44, contentSource: { photoIndex: 0 } },
      { type: 'photo', x: 0.52, y: 0.04, width: 0.46, height: 0.44, contentSource: { photoIndex: 1 } },
      { type: 'photo', x: 0.02, y: 0.52, width: 0.46, height: 0.44, contentSource: { photoIndex: 2 } },
      { type: 'photo', x: 0.52, y: 0.52, width: 0.46, height: 0.44, contentSource: { photoIndex: 3 } },
    ],
  },
];
