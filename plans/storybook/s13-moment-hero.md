# S13 — Moment-Hero Chapter Type

**Status: Complete**
**Branch:** same as S7 (or new branch off main post-S12)
**Depends on:** S12 complete
**Roadmap:** V1 storybook; pulled forward from sv2-s5 as a self-contained addition
**Reference:** `plans/storybook-v2/research.md` — Moment-Hero Technical Research section

---

## Goal

Add **Moment-Hero** as a template type in the scrapbook builder. It appears in the template picker alongside the existing 15 templates and uses the same drag-and-drop builder — no special wizard, no AI, no new DB columns. The user picks the template, drags a photo into the polaroid slot and text into the note card, and edits the title/date inline.

Two variants live in `storybookTemplates.js`: `moment-hero-portrait` and `moment-hero-landscape`. The renderer (`MomentHeroCanvas.jsx`) applies a purpose-built scrapbook aesthetic to the blocks rather than the generic `renderBlocks` path.

The moment-hero layout has four fixed slots:
1. Badge text (pre-filled "FIRST TIME", editable)
2. Title text + date text
3. Hero photo in a polaroid frame (portrait or landscape)
4. Note card (cream box, italic, attribution line)

---

## Background

Originally scoped as a special First-Times-linked chapter type with AI note generation. Both of those were cut in the design session (2026-06-11):

- **No AI** — the note card is a text slot the user fills by dragging a memory piece in and editing inline, same as any text block.
- **No First Times integration** — the left panel stays as-is (memories only). First Times as drag sources is deferred; see Tech Debt.
- **No DB migration** — `layout_data.templateId` already tells the renderer which component to use. No new columns needed.

The Moment-Hero renderer is pure React HTML/CSS, not the virtual canvas. It applies the scrapbook aesthetic (polaroid frame, cream note card, Playfair Display, Dancing Script) to the stored block data.

---

## Scope

### 1. Template definitions — `storybookTemplates.js`

Add two new entries with a `renderer: 'moment_hero'` flag so the builder knows to use the custom canvas:

```js
{
  id: 'moment-hero-portrait',
  name: 'Moment Hero',
  renderer: 'moment_hero',
  orientation: 'portrait',   // photo slot is 3:4
  memoryCount: 1,
  minPhotos: 1, maxPhotos: 1,
  blocks: [
    { id: 'badge',    type: 'text',  ... },  // small caps badge
    { id: 'title',    type: 'text',  ... },  // large serif title
    { id: 'date',     type: 'text',  ... },  // italic subtitle
    { id: 'photo',    type: 'photo', ... },  // portrait polaroid slot
    { id: 'note',     type: 'text',  ... },  // note card body
    { id: 'attrib',   type: 'text',  ... },  // attribution line
  ]
}
// moment-hero-landscape: same structure, photo slot is 4:3
```

Block positions/sizes to be nailed at implementation time, matching the mockup proportions.

### 2. `MomentHeroCanvas.jsx` — purpose-built renderer

New file: `Frontend/src/components/storybook/MomentHeroCanvas.jsx`

Props: `{ blocks, orientation, theme }` — same shape that `LayoutRenderer` receives, but renders the scrapbook-specific aesthetic instead of generic `renderBlocks`.

Layout matches the mockup (see `plans/storybook/moment-hero-mockup.html`):
- Pink pill badge (small caps)
- Playfair Display title + italic date
- Polaroid frame — white card, drop shadow, tilt, Dancing Script caption
- Photo crop applied via `cropStyle` from `bookCanvas.jsx` (same as S12.3 slots)
- Cream note card (`#FFF8E8`, `#E5CB8A` border, italic Lato body)
- Dancing Script attribution
- Pink `♥` in lower-right corner

### 3. Builder wiring

**Template picker** — the two Moment-Hero templates appear as regular cards in the existing grid with `memoryCount: 1`. No new pill or category — they show up under "All" and "1 Memory" naturally.

**Canvas routing in `ScrapbookBuilder.jsx`** — when `template.renderer === 'moment_hero'`, render `MomentHeroCanvas` instead of the standard slot grid. The drag-and-drop source panel and slot-fill mechanics remain identical.

**Photo crop** — the photo slot uses the same `openSlotCropModal` flow from S12.3. Slot AR = portrait (3:4) or landscape (4:3) depending on the template variant.

### 4. Published view — `StorybookTab.jsx` / `LayoutRenderer.jsx`

When a saved chapter's `layoutData.templateId` starts with `moment-hero`, render `MomentHeroCanvas` instead of `LayoutRenderer`. No other tab changes needed.

### 5. PDF export — `storybookPdf.js`

Same html2canvas capture pattern. Render `MomentHeroCanvas` off-screen at 600px wide, capture, append as a page. No pseudo-elements in the hero canvas so html2canvas captures cleanly.

---

## Files to touch

| File | Change |
|---|---|
| `Frontend/src/lib/storybookTemplates.js` | Add `moment-hero-portrait` + `moment-hero-landscape` template definitions |
| `Frontend/src/components/storybook/MomentHeroCanvas.jsx` | **New** — scrapbook-aesthetic renderer for moment-hero blocks |
| `Frontend/src/components/storybook/ScrapbookBuilder.jsx` | Route `renderer === 'moment_hero'` to `MomentHeroCanvas`; add filter pill |
| `Frontend/src/components/tabs/StorybookTab.jsx` | Route saved moment-hero chapters to `MomentHeroCanvas` in published view |
| `Frontend/src/lib/storybookPdf.js` | Capture `MomentHeroCanvas` off-screen for PDF pages |

No backend changes. No DB migration.

---

## Decisions (2026-06-11)

1. **No AI** — note card is a user-filled text slot, same as any text block in the builder.
2. **No First Times integration yet** — left panel stays as memories only. Deferred; see Tech Debt.
3. **No DB migration** — `layoutData.templateId` already persisted in `layout_data` JSON; frontend detects renderer from that.
4. **Style** — scrapbook (warm parchment, polaroid, cream note card). See `plans/storybook/moment-hero-mockup.html`.
5. **Photo crop** — same `openSlotCropModal` flow from S12.3, slot AR = portrait (3:4) or landscape (4:3).

---

## Tech Debt

- **First Times as drag sources** — when a Moment-Hero template is active, the left panel should switch to show the user's First Times list (photo piece, title piece, notes piece per entry) so they can drag directly from a First Time rather than typing manually. Deferred until First Times usage of Moment-Hero is validated.

---

## Verification

1. Moment-Hero Portrait and Landscape templates appear in the template picker.
2. Selecting one opens the builder with the correct fixed slots.
3. Dragging a photo into the polaroid slot opens the crop modal at the correct AR.
4. Filling in title, date, note, attribution slots and saving persists correctly.
5. Published view renders the scrapbook aesthetic (polaroid, cream note card, pink heart).
6. PDF export captures the hero page at correct dimensions.
7. Existing scrapbook chapters are unaffected.
