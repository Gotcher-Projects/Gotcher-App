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
