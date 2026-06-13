# S14 — L-Wrap: True Float Layout

**Status: Complete**
**Branch:** journal-updates
**Depends on:** S12.1 complete (template overhaul)

> **Completed (2026-06-13, user-confirmed):** Single `type: 'l-wrap'` block implemented across
> `storybookTemplates.js`, `bookCanvas.jsx` (`LWrapBlock` + `renderBlocks` branch), and
> `ScrapbookBuilder.jsx`. **TC1 confirmed passing** — the CSS float renders correctly in the
> html2canvas PDF export, so the fallback plan was NOT needed. User confirmed the layout works.
>
> **Design decisions / deviations from the plan as written:**
> - **Single droppable, not two (§3a):** Used one droppable on the l-wrap block routing by
>   `data.kind`. dnd-kit collision with overlapping float rects is unreliable; the session
>   prompt's "accept both 'text' and 'photo' drags" framing was followed instead.
> - **Open Q1:** The builder renders the real `LWrapBlock` component for its display (single
>   source of truth) — gives fitted-font + crop parity with the published/PDF view. (Not
>   `RenderedText`, whose `overflow:hidden` BFC would block float wrapping.)
> - **Inline text editing un-deferred (vs Decision 5):** Clicking the text area opens a Tiptap
>   editor in new `flow` mode (no BFC) so the photo stays floated and text wraps while editing.
>   Photo sub-zone click opens the tray / re-frame.
> - **Crop kept for l-wrap photos:** photos run the standard crop-to-slot modal (3:4) and the
>   stored `crop` renders via a fixed-size `overflow:hidden` float box in `LWrapBlock`.
> - `storybookGrouping.js` left untouched — `pickTemplate` returns `classic` before `l-wrap`,
>   so l-wrap is manual-only and never hits the auto-generate path.

---

## Goal

Replace the current two-rectangular-block L-Wrap template with a single `l-wrap` block type that
uses a CSS float internally. The photo sits in the top-right of the block; the body text flows
continuously around it in a true L-shape. Text stays one cohesive column at one consistent font
size. Verify that the float layout renders correctly in the PDF export (html2canvas capture).

---

## Why This Approach

The original L-Wrap split text across two separate rectangular blocks and used `splitGroup` to
distribute the body text between them. The fatal flaw: `useFittedFontSize` runs independently
per block and finds different optimal font sizes for each one (the top-left block is smaller and
gets fewer characters → fits at a larger size; the bottom block is wider with more text → fits
smaller). The two blocks look visually disconnected — different sizes, different feel.

CSS float (text flowing around a floated image) is the standard mechanism for true L-wrap in
HTML. The text is ONE body in ONE container; font size is consistent throughout. html2canvas
re-implements CSS 2.1 float layout in JavaScript and generally renders floats correctly. This
needs to be verified with an actual PDF export as part of this session.

**If html2canvas float rendering is broken**, the fallback plan is documented at the end of this
file. Do not jump to the fallback without actually testing the PDF.

---

## Key Decisions (resolved before writing the plan)

1. **Sub-slot UX (builder):** Option B — two independent droppable sub-zones inside the block.
   The text sub-zone only accepts `kind === 'text'` drags. The photo sub-zone only accepts
   `kind === 'photo'` drags. Each sub-zone is a separate `useDroppable` with its own id, exactly
   mirroring how text blocks and photo blocks work today — no cross-zone drops.

2. **Font sizing:** `useFittedFontSize` as usual. The ref wraps the whole block (float + text).
   With `overflow: hidden` on the outer div, the parent contains the float, so scrollHeight
   correctly includes both float height and text height. This should converge correctly.

3. **Incomplete state (no photo placed yet):** The photo sub-zone shows a `<SlotPlaceholder
   kind="photo" />` in the float position so the user understands the shape.

4. **Template switch:** Clear on switch, same as all other block types. No preservation.

5. **Inline text editing:** Deferred. Click-to-place is supported; Tiptap inline edit is not
   (the float layout makes embedding a Tiptap editor complex). Text is editable via placing
   a memory. Note this in the builder slot as "tap to place text".

---

## Data Shape

The current l-wrap template has three blocks (`text`, `photo`, `text`). Replace with one:

```js
{
  id: 'b-xxx',
  type: 'l-wrap',
  x: 0.04,  y: 0.04,
  width: 0.92, height: 0.92,
  content: '',          // Tiptap JSON — same field as text blocks
  url: null,            // photo URL — same field as photo blocks
  label: '',            // photo label
  sourceKey: null,      // which memory provided the TEXT (for usedTextKeys tracking)
  photoSourceKey: null, // which memory/photo provided the PHOTO (for usedPhotoKeys tracking)
  suppressDropCap: true,
  fontFamily: null,     // optional override
  contentSource: { memoryIndex: 0, piece: 'body', photoIndex: 0 },
}
```

`photoSourceKey` is a new field, only used by l-wrap blocks. It separates photo source tracking
from text source tracking so both appear correctly in the "already placed" indicators.

---

## Float Dimensions

Photo occupies top-right within the block. Chosen proportions:
- Photo width: 47% of block width
- Photo height: 47% of block height
- Margin left (gap between photo and text): 3% of block width
- Margin bottom (gap between photo and text below): 3% of block height

At the 600×800 canvas, a block of width 0.92 × height 0.92 gives:
- Block: ~552px × ~736px
- Photo: ~259px × ~346px (roughly 3:4 portrait proportion — good fit)

These percentages are computed in CSS as `%` on the floated img element. They are percentages
of the parent block's dimensions.

---

## File Touch Points

| File | Change |
|---|---|
| `Frontend/src/lib/storybookTemplates.js` | Replace 3-block l-wrap with 1-block l-wrap |
| `Frontend/src/lib/bookCanvas.jsx` | Add `LWrapBlock` component; add l-wrap branch in `renderBlocks` |
| `Frontend/src/components/storybook/ScrapbookBuilder.jsx` | `Slot` handles `type === 'l-wrap'`; `placeIntoSlot` handles l-wrap; drag matching; usedPhotoKeys includes photoSourceKey; TemplateThumb l-wrap thumb |

No backend changes. No DB migration. No `storybookPdf.js` changes — the PDF pipeline already
renders through `LayoutRenderer → renderBlocks`. Adding l-wrap to `renderBlocks` is sufficient.

---

## Implementation Order

### 1. `storybookTemplates.js` — new l-wrap block definition

```js
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
```

### 2. `bookCanvas.jsx` — `LWrapBlock` component

Add to `bookCanvas.jsx` alongside `RenderedText`. This is the shared source of truth for both
the live view (via `renderBlocks`) and the PDF capture (via `LayoutRenderer → renderBlocks`).

```jsx
export function LWrapBlock({ block, fontClass, textColor }) {
  const ref = useRef(null);
  const rawHtml = useMemo(() => renderContentHTML(block.content), [block.content]);
  const html = useMemo(
    () => (!block.suppressDropCap && rawHtml ? injectDropCap(rawHtml) : rawHtml),
    [rawHtml, block.suppressDropCap]
  );
  const w = block.width * CANVAS_W;
  const h = block.height * CANVAS_H;
  // Photo dimensions as absolute px (used as inline style on the float)
  const photoW = Math.round(w * 0.47);
  const photoH = Math.round(h * 0.47);
  const marginL = Math.round(w * 0.03);
  const marginB = Math.round(h * 0.03);

  const fontSize = useFittedFontSize(ref, BASE_FONT, 8, [html, fontClass, w, h], BASE_FONT * 1.7);

  return (
    <div
      ref={ref}
      className={`book-rich--edit ${fontClass} w-full h-full p-3 overflow-hidden`}
      style={{ fontSize, lineHeight: 1.8, color: textColor || undefined, boxSizing: 'border-box' }}
    >
      {/* Float MUST come before text in DOM for wrapping to work */}
      {block.url && (
        <img
          src={block.url}
          alt={block.label || ''}
          style={{
            float: 'right',
            width: photoW,
            height: photoH,
            objectFit: 'cover',
            marginLeft: marginL,
            marginBottom: marginB,
            display: 'block',
          }}
        />
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
```

**Critical DOM order note:** The float `<img>` must appear BEFORE the text `<div>` in the DOM.
Float wrapping only applies to content that comes AFTER the float in source order.

Then add the l-wrap branch in `renderBlocks`:

```js
export function renderBlocks(blocks, theme) {
  return blocks.map((block, i) => {
    const fontClass = FONT_MAP[block.fontFamily] ?? theme?.fontClass ?? 'font-serif';
    return (
      <div key={block.id || i} style={blockBoxStyle(block)}>
        {block.type === 'text' ? (
          <RenderedText block={block} fontClass={fontClass} textColor={theme?.textColor} />
        ) : block.type === 'l-wrap' ? (
          <LWrapBlock block={block} fontClass={fontClass} textColor={theme?.textColor} />
        ) : (
          block.url && (
            <img src={block.url} alt={block.label || ''} className="w-full h-full object-cover" />
          )
        )}
      </div>
    );
  });
}
```

### 3. `ScrapbookBuilder.jsx` — four changes

#### 3a. `LWrapSlot` — a new component replacing `Slot` for l-wrap blocks

Rather than cramming l-wrap into the existing `Slot` component (which has one `useDroppable`),
create a standalone `LWrapSlot` component with two independent droppables. This mirrors exactly
how text and photo blocks work today — each sub-zone has its own id, accepts only the matching
drag kind, and highlights only when that kind is being dragged.

The two droppable IDs are derived from the block id:
- Text sub-zone: `block.id + ':text'`
- Photo sub-zone: `block.id + ':photo'`

`handleDragEnd` in `ScrapbookBuilder` currently does:
```js
placeIntoSlot(over.id, data.kind, data.sourceKey);
```

Update it to strip the sub-zone suffix when present:
```js
const targetBlockId = (over.id).replace(/:text$|:photo$/, '');
placeIntoSlot(targetBlockId, data.kind, data.sourceKey);
```

The `LWrapSlot` component:

```jsx
function LWrapSlot({ block, theme, selectedSource, onActivate, onOpenTray }) {
  const fontClass = FONT_MAP[block.fontFamily] ?? theme?.fontClass ?? 'font-serif';
  const textColor = theme?.textColor;
  const hasText = contentToPlainText(block.content).trim().length > 0;
  const hasPhoto = !!block.url;

  // Independent droppables — each only accepts its matching kind
  const { setNodeRef: textRef, isOver: textOver, active: textActive } = useDroppable({
    id: block.id + ':text',
    data: { type: 'text', blockId: block.id },
  });
  const { setNodeRef: photoRef, isOver: photoOver, active: photoActive } = useDroppable({
    id: block.id + ':photo',
    data: { type: 'photo', blockId: block.id },
  });

  const draggingKind = textActive?.data?.current?.kind ?? photoActive?.data?.current?.kind;
  const textDragMatch = draggingKind === 'text';
  const photoDragMatch = draggingKind === 'photo';
  const textArmed = selectedSource?.kind === 'text';
  const photoArmed = selectedSource?.kind === 'photo';

  // Dimensions matching LWrapBlock
  const bw = block.width * CANVAS_W;
  const bh = block.height * CANVAS_H;
  const photoW = Math.round(bw * 0.47);
  const photoH = Math.round(bh * 0.47);
  const marginL = Math.round(bw * 0.03);
  const marginB = Math.round(bh * 0.03);

  return (
    <div
      style={blockBoxStyle(block)}
      className={`${fontClass} overflow-hidden p-3`}
      style={{ lineHeight: 1.8, color: textColor, boxSizing: 'border-box', fontSize: BASE_FONT }}
    >
      {/* Photo sub-zone — floated top-right, independent droppable */}
      <div
        ref={photoRef}
        style={{ float: 'right', width: photoW, height: photoH, marginLeft: marginL, marginBottom: marginB, position: 'relative' }}
        className={`${photoOver && photoDragMatch ? 'ring-2 ring-color-highlight ring-offset-1' : ''} rounded cursor-pointer`}
        onClick={(e) => { e.stopPropagation(); onActivate(block.id + ':photo'); }}
      >
        {hasPhoto ? (
          <>
            <img src={block.url} alt={block.label || ''} className="w-full h-full object-cover" />
            <button
              onClick={(e) => { e.stopPropagation(); onOpenTray(block.id); }}
              className="absolute top-1 left-1 z-20 p-1 rounded-full bg-white/80 shadow-sm hover:bg-white transition-colors"
            >
              <Camera className="w-3 h-3 text-foreground/70" />
            </button>
          </>
        ) : (
          <SlotPlaceholder kind="photo" armed={photoArmed} />
        )}
      </div>

      {/* Text sub-zone — flows around the float, independent droppable */}
      <div
        ref={textRef}
        className={`h-full overflow-hidden ${textOver && textDragMatch ? 'ring-2 ring-color-highlight ring-offset-1' : ''} rounded`}
        onClick={() => onActivate(block.id + ':text')}
        style={{ cursor: 'pointer' }}
      >
        {hasText
          ? <RenderedText block={block} fontClass={fontClass} textColor={textColor} />
          : <SlotPlaceholder kind="text" armed={textArmed} />
        }
      </div>
    </div>
  );
}
```

**`handleSlotActivate` changes:** The function currently receives a bare `blockId`. For l-wrap
sub-zones it will receive `blockId + ':text'` or `blockId + ':photo'`. Update to strip the
suffix and check the sub-zone kind when deciding whether to place:

```js
function handleSlotActivate(slotId) {
  const [blockId, subZone] = slotId.includes(':') ? slotId.split(':') : [slotId, null];
  if (!selectedSource) return;
  if (subZone === 'text' && selectedSource.kind === 'text') {
    placeIntoSlot(blockId, 'text', selectedSource.sourceKey);
    setSelectedSource(null);
  } else if (subZone === 'photo' && selectedSource.kind === 'photo') {
    placeIntoSlot(blockId, 'photo', selectedSource.sourceKey);
    setSelectedSource(null);
  } else if (!subZone) {
    // Existing text/photo block behavior unchanged
    if (selectedSource.kind === ...) { ... }
  }
}
```

**Note:** `RenderedText` in the text sub-zone refs only the text div, not the full block. Font
size may differ slightly from the published `LWrapBlock` (which refs the full container including
the float). This is acceptable — the builder is an approximation. If the discrepancy is
visually obvious, switch the builder to also render `LWrapBlock` from `bookCanvas.jsx`.

#### 3b. `handleDragEnd` — strip sub-zone suffix

```js
function handleDragEnd({ active, over }) {
  setActiveDrag(null);
  if (!over) return;
  const data = active.data.current;
  if (!data?.kind || !data?.sourceKey) return;
  // Strip ':text' / ':photo' suffix that l-wrap sub-zones append
  const targetBlockId = String(over.id).replace(/:text$|:photo$/, '');
  placeIntoSlot(targetBlockId, data.kind, data.sourceKey);
}
```

The rest of the drag pipeline is unchanged — `placeIntoSlot` still receives a clean block id.

#### 3c. `placeIntoSlot` — handle l-wrap block type

Add a branch after the existing `splitGroup` logic:

```js
if (target.type === 'l-wrap') {
  const gc = chapter.generatedContent?.[sourceKey];
  if (kind === 'text') {
    const piece = target.contentSource?.piece || 'body';
    let fullText = extractPieceText(gc, piece);
    if (!fullText) {
      const mem = memories.find(m => m.sourceKey === sourceKey);
      fullText = piece === 'title' ? (mem?.label || '') : cleanBody(mem?.rawText || '');
    }
    return blocks.map(b =>
      b.id === blockId
        ? { ...b, content: toTiptapDoc(fullText), sourceKey, suppressDropCap: true }
        : b
    );
  }
  if (kind === 'photo') {
    const mem = memories.find(m => m.sourceKey === sourceKey);
    return blocks.map(b =>
      b.id === blockId
        ? { ...b, url: mem?.photoUrl || null, photoSourceKey: sourceKey, label: mem?.label || '' }
        : b
    );
  }
  return blocks;
}
```

#### 3d. `usedTextKeys` / `usedPhotoKeys` — include l-wrap

Update the two `useMemo` computations that track which memories are already placed:

```js
// usedTextKeys — include l-wrap blocks' sourceKey
for (const b of currentBlocks) {
  if ((b.type === 'text' || b.type === 'l-wrap') && b.sourceKey) s.add(b.sourceKey);
}

// usedPhotoKeys — photo blocks use sourceKey; l-wrap blocks use photoSourceKey
for (const b of currentBlocks) {
  if (b.type === 'photo' && b.sourceKey) photoKeys.add(b.sourceKey);
  if (b.type === 'l-wrap' && b.photoSourceKey) photoKeys.add(b.photoSourceKey);
}
```

Also update `clearBlock` (the reset logic on template switch) to clear `photoSourceKey` when
present:
```js
url: b.type === 'photo' || b.type === 'l-wrap' ? null : undefined,
photoSourceKey: b.type === 'l-wrap' ? null : undefined,
```

#### 3e. `TemplateThumb` — l-wrap visual

The thumbnail for l-wrap should visually suggest the layout. Since we now have one block of
`type: 'l-wrap'` (not three rectangles), the existing thumb-rendering logic would show nothing
useful. Add a special case in `TemplateThumb`:

```jsx
// Inside TemplateThumb, before the block.map:
if (template.blocks.length === 1 && template.blocks[0].type === 'l-wrap') {
  const b = template.blocks[0];
  const bx = b.x * TW, by = b.y * TH, bw = b.width * TW, bh = b.height * TH;
  const pw = bw * 0.47, ph = bh * 0.47;
  return (
    <div className="relative w-full" style={{ aspectRatio: `${TW}/${TH}`, background: bg }}>
      {/* Photo — top-right */}
      <div style={{ position: 'absolute', right: bx, top: by, width: pw, height: ph, background: accent + '99', borderRadius: 1 }} />
      {/* Text bars — top-left */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{ position: 'absolute', left: bx, top: by + i * (ph / 3.5), width: bw * 0.44, height: 2, background: textCol + '40', borderRadius: 1 }} />
      ))}
      {/* Text bars — full-width bottom */}
      {[0, 1, 2].map(i => (
        <div key={i + 3} style={{ position: 'absolute', left: bx, top: by + ph + bh * 0.04 + i * (bh * 0.1), width: bw, height: 2, background: textCol + '40', borderRadius: 1 }} />
      ))}
    </div>
  );
}
```

---

## PDF Testing Procedure

This is mandatory before marking S14 complete. Test each case and record the result.

### Setup
1. Ensure services are running (`cd Backend && ./start-services.sh`)
2. Log in with demo@gotcherapp.com / DemoPass1 (baby Lily, seeded entries)

### Test Cases

**TC1 — Float renders in PDF**
1. Open the storybook builder for any chapter
2. Apply the L-Wrap template
3. Drag a memory onto the text sub-zone → text places
4. Open photo tray, upload or select a photo → photo places top-right
5. Publish the chapter
6. Click Download PDF in StorybookTab
7. Open the PDF: **PASS** if the photo is top-right and text wraps around it in an L-shape

**TC2 — Text-only l-wrap renders in PDF**
1. Same as TC1 but don't place a photo (empty photo zone)
2. Publish and export PDF
3. **PASS** if text renders full-width (no float when photo is absent) and is not blank

**TC3 — Font consistency**
1. Place a memory with a long body text (100+ words) in l-wrap
2. Publish and export PDF
3. **PASS** if font size is visually consistent throughout — not larger in one section vs another

**TC4 — useFittedFontSize convergence**
1. Place a very SHORT body text (1–2 sentences) in l-wrap
2. In the builder, observe that the text fills the box at a large font
3. Export PDF
4. **PASS** if PDF shows the large font without overflow or clipping

**TC5 — Theme consistency**
1. Switch the book theme (e.g. to a dark or serif theme)
2. Export PDF
3. **PASS** if the l-wrap page matches the theme's font class and text color

**TC6 — Multi-page chapter with l-wrap**
1. Add a second page to a chapter, apply l-wrap on one page and classic on another
2. Export PDF
3. **PASS** if both pages appear in the PDF in the correct order with correct content

---

## useFittedFontSize Risk and Mitigation

The hook measures `ref.current.scrollHeight <= ref.current.clientHeight`. For `LWrapBlock`, the
ref is the outer container which has `overflow: hidden`. When `overflow: hidden` is set, the
browser includes float children in the container's layout box, so scrollHeight should correctly
reflect when the float + text exceeds clientHeight.

**Potential issue:** If the float image is taller than the text content, scrollHeight may only
reflect the text height (not the image height) because the image is a float removed from normal
flow. In that case the hook would compute a font size that's too large, and the text would
visually overlap the photo.

**Mitigation:** After implementing, test with short text (1–2 sentences where the float is
definitely taller than the text). If the font grows too large and the text overlaps the photo,
add a `min-height` equal to the photo height on the text container div (forces it to account for
the float's height when measuring), OR switch to fixed `BASE_FONT` for l-wrap blocks only.

---

## Fallback Plan (if html2canvas breaks floats)

If TC1 fails (float does not render in PDF — text appears full-width or photo is missing), the
fallback is the **shared font size via two-pass rendering** approach:

1. Revert to two rectangular blocks (text-top-left + photo-top-right + text-bottom)
2. Each block reports its computed font size via a callback ref
3. ScrapbookBuilder collects the min across the splitGroup and passes `forcedFontSize` back down
4. Both blocks render at the same size, producing the "same size, two blocks" result (not true
   L-shape, but at least visually cohesive)

This fallback is less ideal but eliminates the font-size mismatch that prompted this session.

---

## Open Questions (resolve at session start)

1. **`RenderedText` in the builder's text sub-zone** — the builder uses `RenderedText` (Tiptap)
   while the published view uses `LWrapBlock` (dangerouslySetInnerHTML). If this causes a visible
   font size discrepancy between builder and published view, switch the builder to also use
   `LWrapBlock` for its text rendering (import it from bookCanvas.jsx). Decide after seeing it.

2. **Drag drop zone strict typing** — each sub-zone only highlights and accepts its matching
   kind. Confirm `active.data.current.kind` is correctly set on memory card drag items before
   implementing the highlight logic in `LWrapSlot`.

---

## Verification Checklist

- [ ] L-Wrap template appears in template picker with correct thumbnail
- [ ] Dragging text memory onto l-wrap slot → text places in text area
- [ ] Dragging photo onto l-wrap slot → photo places in top-right float zone
- [ ] Photo sub-zone click → photo tray opens
- [ ] Camera re-crop button visible on placed photo
- [ ] "Already placed" indicators correctly show text and photo as used
- [ ] Switching away from l-wrap template clears block (no state leak)
- [ ] Switching back to l-wrap template starts fresh
- [ ] Published view (LayoutRenderer) renders l-wrap correctly (float visible)
- [ ] TC1 through TC6 PDF tests all pass
- [ ] useFittedFontSize convergence confirmed (short + long text cases)
- [ ] No regression on other template types
