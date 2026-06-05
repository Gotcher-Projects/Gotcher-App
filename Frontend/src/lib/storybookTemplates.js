// Page templates for the memory-book builder. Each template is a fixed set of
// normalized (0–1) block boxes with a `contentSource` describing which memory
// piece / photo fills it. Shared by ScrapbookBuilder and storybookGrouping.
export const TEMPLATES = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Text above, photo below',
    memoryCount: 1, minPhotos: 0, maxPhotos: 1,
    blocks: [
      { type: 'text',  x: 0.04, y: 0.04, width: 0.92, height: 0.38, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'photo', x: 0.04, y: 0.46, width: 0.92, height: 0.50, contentSource: { memoryIndex: 0, photoIndex: 0 } },
    ],
  },
  {
    id: 'side-by-side',
    label: 'Side by Side',
    description: 'Text left, photo right',
    memoryCount: 1, minPhotos: 0, maxPhotos: 1,
    blocks: [
      { type: 'text',  x: 0.04, y: 0.04, width: 0.44, height: 0.92, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'photo', x: 0.52, y: 0.04, width: 0.44, height: 0.92, contentSource: { memoryIndex: 0, photoIndex: 0 } },
    ],
  },
  {
    id: 'hero',
    label: 'Hero Photo',
    description: 'Full-page photo, caption overlay',
    memoryCount: 1, minPhotos: 1, maxPhotos: 1,
    blocks: [
      { type: 'photo', x: 0.0,  y: 0.0,  width: 1.0,  height: 1.0,  contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { type: 'text',  x: 0.04, y: 0.76, width: 0.92, height: 0.20, content: '', contentSource: { memoryIndex: 0, piece: 'caption' } },
    ],
  },
  {
    id: 'gallery',
    label: 'Gallery',
    description: 'Two photos, text below',
    memoryCount: 1, minPhotos: 2, maxPhotos: 2,
    blocks: [
      { type: 'photo', x: 0.04, y: 0.04, width: 0.44, height: 0.44, contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { type: 'photo', x: 0.52, y: 0.04, width: 0.44, height: 0.44, contentSource: { memoryIndex: 0, photoIndex: 1 } },
      { type: 'text',  x: 0.04, y: 0.52, width: 0.92, height: 0.44, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
    ],
  },
  {
    id: 'text-only',
    label: 'Text Only',
    description: 'Full-page text',
    memoryCount: 1, minPhotos: 0, maxPhotos: 0,
    blocks: [
      { type: 'text', x: 0.04, y: 0.04, width: 0.92, height: 0.92, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
    ],
  },
  {
    id: 'memory-gallery',
    label: 'Memory Gallery',
    description: 'Story with 2–3 photos below',
    memoryCount: 1, minPhotos: 2, maxPhotos: 3,
    blocks: [
      { type: 'text',  x: 0.04, y: 0.04, width: 0.92, height: 0.30, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'photo', x: 0.04, y: 0.38, width: 0.44, height: 0.28, contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { type: 'photo', x: 0.52, y: 0.38, width: 0.44, height: 0.28, contentSource: { memoryIndex: 0, photoIndex: 1 } },
      { type: 'photo', x: 0.04, y: 0.70, width: 0.92, height: 0.26, contentSource: { memoryIndex: 0, photoIndex: 2 } },
    ],
  },
  {
    id: 'two-up',
    label: 'Two Memories',
    description: 'Two memories, text only',
    memoryCount: 2, minPhotos: 0, maxPhotos: 0,
    blocks: [
      { type: 'text', x: 0.04, y: 0.04, width: 0.92, height: 0.44, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'text', x: 0.04, y: 0.52, width: 0.92, height: 0.44, content: '', contentSource: { memoryIndex: 1, piece: 'body' } },
    ],
  },
  {
    id: 'two-up-photo',
    label: 'Two + Photo',
    description: 'Two memories, one photo',
    memoryCount: 2, minPhotos: 1, maxPhotos: 1,
    blocks: [
      { type: 'text',  x: 0.04, y: 0.04, width: 0.44, height: 0.44, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'photo', x: 0.52, y: 0.04, width: 0.44, height: 0.44, contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { type: 'text',  x: 0.04, y: 0.52, width: 0.92, height: 0.44, content: '', contentSource: { memoryIndex: 1, piece: 'body' } },
    ],
  },
  {
    id: 'two-up-both',
    label: 'Two + Both Photos',
    description: 'Two memories, each with photo',
    memoryCount: 2, minPhotos: 2, maxPhotos: 2,
    blocks: [
      { type: 'text',  x: 0.04, y: 0.04, width: 0.44, height: 0.28, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'photo', x: 0.04, y: 0.36, width: 0.44, height: 0.28, contentSource: { memoryIndex: 0, photoIndex: 0 } },
      { type: 'text',  x: 0.52, y: 0.04, width: 0.44, height: 0.28, content: '', contentSource: { memoryIndex: 1, piece: 'body' } },
      { type: 'photo', x: 0.52, y: 0.36, width: 0.44, height: 0.28, contentSource: { memoryIndex: 1, photoIndex: 0 } },
    ],
  },
  {
    id: 'three-short',
    label: 'Three Memories',
    description: 'Three short memories, text only',
    memoryCount: 3, minPhotos: 0, maxPhotos: 0,
    blocks: [
      { type: 'text', x: 0.04, y: 0.04, width: 0.92, height: 0.28, content: '', contentSource: { memoryIndex: 0, piece: 'body' } },
      { type: 'text', x: 0.04, y: 0.36, width: 0.92, height: 0.28, content: '', contentSource: { memoryIndex: 1, piece: 'body' } },
      { type: 'text', x: 0.04, y: 0.68, width: 0.92, height: 0.28, content: '', contentSource: { memoryIndex: 2, piece: 'body' } },
    ],
  },
  {
    id: 'three-short-photos',
    label: 'Three + Photos',
    description: 'Three memories with optional photos',
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
    id: 'photo-two',
    label: 'Two Photos',
    description: 'Two photos side by side',
    memoryCount: 0, minPhotos: 2, maxPhotos: 2,
    blocks: [
      { type: 'photo', x: 0.02, y: 0.04, width: 0.46, height: 0.92, contentSource: { photoIndex: 0 } },
      { type: 'photo', x: 0.52, y: 0.04, width: 0.46, height: 0.92, contentSource: { photoIndex: 1 } },
    ],
  },
  {
    id: 'photo-three',
    label: 'Three Photos',
    description: '1 large + 2 small photos',
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
