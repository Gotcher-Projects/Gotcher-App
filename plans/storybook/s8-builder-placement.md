# S8 — Scrapbook Builder II: Place Content + Photos

**Status: Complete**
**Branch:** same as S7
**Depends on:** S7 complete and verified
**Roadmap:** builder-rewrite roadmap; decisions in `s6.4-improvements.md`

---

## Goal

Make the builder interactive: place memory content and photos into the fixed template slots, with
both drag-and-drop and click-to-place. Autosave the arrangement as a draft.

---

## Scope

### Placement — drag + click
- Reuse `@dnd-kit` (already a dependency; used in S6.2 `PageGroupingStep` and chapter reordering).
- Drag a memory's **text** onto a text slot; drag a **photo** onto a photo slot.
- **Click-to-place** as the mobile-friendly fallback: tap a memory/photo item → tap a slot.
- A slot only accepts the matching content type (text vs photo).

### Slot filling
- Text slots pull the correct piece from `chapter.generatedContent[sourceKey]` per the slot's
  `contentSource.piece` (`body` / `title` / `caption` / `pullQuote`). Convert with `toTiptapDoc`,
  strip `[PHOTO:…]` markers, collapse extra newlines (same cleanup as `buildGroupedLayoutData`).
- Photo slots take the assigned URL. Reuse `PhotoTray` (lift from `LayoutEditor.jsx`) for choosing
  from available photos or uploading a new one (`apiUpload` to `/storybook/{id}/chapter-photos`).
- Track which `sourceKey` owns each placed block so re-renders and edits stay consistent.

### Empty-slot affordances
- Empty text slot: "drag a memory here" / labeled by what it expects.
- Empty photo slot: "add a photo" with the `PhotoBlock` placeholder.

### Autosave
- Debounced PATCH `/storybook/{id}` with `{ layoutData }` (v2 pages), `status` stays `draft`.
- Mirror the existing autosave/status pattern from `LayoutEditor` (Saving… / Saved indicator).

---

## Reuse
- `lib/storybookGrouping.js` — `buildGroupedLayoutData` logic for the body cleanup + Tiptap
  conversion (reuse or factor a shared helper)
- `components/storybook/LayoutEditor.jsx` — lift `PhotoTray`, `PhotoBlock`
- `lib/api.js` — `apiUpload`, `apiRequest` for autosave PATCH

---

## Files
- `Frontend/src/components/storybook/ScrapbookBuilder.jsx` — placement + autosave
- (maybe) `Frontend/src/components/storybook/PhotoTray.jsx` — extracted from LayoutEditor
- (maybe) shared slot-fill helper in `lib/storybookGrouping.js` or a new module

---

## Verification
1. Drag a memory's text onto a text slot → renders the right piece; drag a photo onto a photo slot.
2. Click-to-place works on a touch device / narrow viewport.
3. Upload a new photo via the tray → it fills the slot.
4. Edits autosave; reload the chapter → arrangement persists.
5. Wrong-type drops are rejected (text can't land in a photo slot, vice versa).
