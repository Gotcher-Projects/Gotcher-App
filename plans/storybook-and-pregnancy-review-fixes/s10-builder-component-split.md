# s10 — ScrapbookBuilder: Component Split + Low-Priority Dedup

**Status: Complete**
**Branch:** pregnancy-updates
**Depends on:** s9 (helpers extracted), s7 (`useCanvasScale`)
**Source:** `branch-review.html` → Pass 5 (P2 maintainability) + Pass 2 (LOW)

---

## Goal
Break the 1,304-line `ScrapbookBuilder.jsx` into focused modules with **zero behaviour change**, and
fold in the low-priority dedup. Highest-risk plan → heaviest manual verification.

## Scope
- Split `ScrapbookBuilder.jsx` into a shell + extracted pieces (suggested):
  - `MemoryPanel` (the left memory list + `DraggablePiece` / `MemoryCard`).
  - `TemplateSheet` (template picker + thumbs).
  - `Slot` (the droppable/editable slot renderer).
  - Placement/page logic as hooks (e.g. `usePageState`, `usePlacement`) where it reads cleanly.
  - Use `useCanvasScale` from s7 in place of the inline ResizeObserver.
- LOW dedup (Pass 2):
  - `<SlotImage url crop label/>` for the `crop ? cropStyle : object-cover` ternary (used in
    ScrapbookBuilder, bookCanvas, MomentHeroCanvas).
  - `mountModal(render)→close` helper in `imageUtils.jsx`; collapse `openCropModal`/`openSlotCropModal`.
  - Optional: `<ConfirmDeleteButton onConfirm/>` (spans pre-existing code — only if low-friction).

## Guardrails
- Pure refactor: no functional/UI change. Diff should be moves + wiring, not logic edits.
- Keep `lib/storybookLayout.js` (s9) as the home for pure helpers.

## Files
- `Frontend/src/components/storybook/ScrapbookBuilder.jsx` (shrink)
- new files under `Frontend/src/components/storybook/` (MemoryPanel, TemplateSheet, Slot, SlotImage, hooks)
- `Frontend/src/lib/imageUtils.jsx` (mountModal)

## Verification
1. `npm run test` green.
2. Full manual pass of the builder: drag-place + click-to-place text/photo; l-wrap (photo float,
   text-only escape, re-crop); moment-hero pages; per-page background; add/remove/reorder pages;
   debounced autosave; publish. Compare a rendered page to `LayoutRenderer` side by side.
