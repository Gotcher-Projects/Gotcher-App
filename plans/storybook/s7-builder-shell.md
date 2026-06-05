# S7 — Scrapbook Builder I: Shell, Memory Panel, Fixed-Slot Canvas

**Status: Complete**
**Branch:** journal-updates
**Depends on:** S6.1–S6.3 complete and verified
**Roadmap:** `~/.claude/plans/` builder-rewrite roadmap; decisions in `s6.4-improvements.md`

---

## Goal

Stand up the new `ScrapbookBuilder.jsx` as a full-screen component that establishes the visual
system. **No content placement or editing yet** — this session is the scaffolding: the two-panel
layout, fixed-slot page rendering, the visual template picker, and page management.

This is the tool that will replace `LayoutEditor` (removed in S10). Fixed template slots, no free
resize.

---

## Scope

### Left panel — memories
- Cards grouped per entry. Each card shows the AI `title`/`body` preview (from
  `chapter.generatedContent[sourceKey]`) plus a photo thumbnail when one exists.
- Text and photo are visually grouped as one entry but represented as individually draggable
  items. (Actual drag/placement is wired in S8 — here they are just rendered as draggable-looking
  items.)

### Right — page canvas (fixed slots)
- Render a v2 layout's pages using the **fixed template slot** model. Reuse the normalized 0–1
  positioning on the `CANVAS_W=600 × CANVAS_H=800` canvas so the builder and `LayoutRenderer`
  stay pixel-identical.
- Reuse `RenderedText` (or lift it into a shared module) and `PhotoBlock` for rendering filled
  slots; render empty slots as placeholders.
- Read-only at this stage (no editing interactions).

### Visual template picker
- Thumbnails, not a dropdown — model on `s6.4-grouping-mockup.html`. Selecting a template lays
  out that template's empty slots on the current page.
- Source of templates: `TEMPLATES` from `lib/storybookGrouping.js` / `LayoutEditor.jsx` (16
  templates with `memoryCount/minPhotos/maxPhotos` + per-block `contentSource`).

### Page management
- Add page, remove page, reorder pages.

### Reachability for verification
- Point the existing chapter "Edit" action (`editingChapter` flow in
  `components/tabs/StorybookTab.jsx`) at `ScrapbookBuilder` so it is testable now. `LayoutEditor`
  remains in the tree, unused by this path, until S10.

---

## Reuse (lift as-is, none coupled to Rnd)
- `lib/tiptap.js` — `renderContentHTML`, `toTiptapDoc`, `contentToPlainText`
- `lib/fitText.js` — `useFittedFontSize`
- `components/storybook/LayoutRenderer.jsx` — `RenderedText`, `injectDropCap`, canvas constants
- `lib/storybookGrouping.js` — `TEMPLATES`, `buildMemoryList`
- Consider extracting `RenderedText` + canvas constants into a shared `lib/bookCanvas.js` so the
  builder and `LayoutRenderer` share one source (optional; decide during the session).

---

## Files
- `Frontend/src/components/storybook/ScrapbookBuilder.jsx` — new
- `Frontend/src/components/tabs/StorybookTab.jsx` — route the Edit action to the new builder
- (maybe) `Frontend/src/lib/bookCanvas.js` — shared render model extraction

---

## Verification
1. Open an existing v2 chapter via Edit → builder opens full-screen with memory panel + pages.
2. Memory cards show AI title/body preview + photo thumbnail where present.
3. Switch a page's template in the picker → empty slots re-lay-out to match.
4. Add / remove / reorder pages works.
5. Filled slots render identically to `LayoutRenderer` (compare side by side).
