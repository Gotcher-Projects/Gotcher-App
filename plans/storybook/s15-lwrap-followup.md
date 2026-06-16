# S15 — L-Wrap Follow-up: Text-First Wrap

**Status: Complete** (implemented + confirmed in-app by Michael 2026-06-16 — Approach A always-render float + L-shaped empty-state hint + convert-to-text-only)
**Branch:** journal-updates
**Depends on:** S14 complete (single `l-wrap` float block shipped and user-confirmed 2026-06-13)

> This plan promotes work that previously lived only in the auto-memory note
> `storybook-lwrap-followup`. It covers the **text-first L-Wrap fix** — place text before a photo
> and still get the L-shape.
>
> **Not in scope:** relanding the reverted 2026-06-14 code-review fixes. That effort was a dumpster
> fire and Michael has decided to **restart it from scratch** rather than resurrect the reverted
> diff — it is not part of this plan. (The reverted code still sits in `git stash` on
> `journal-updates` and the backup branch `journal-updates-backup-20260614` if any reference is
> ever wanted, but the intent is a clean re-review, not a reland.)

---

## Background

After S14 shipped the single-block `l-wrap` float layout, research on **2026-06-14** surfaced a real
UX gap: an l-wrap page that has **text placed but no photo yet** renders with no float, so the text
fills the whole rectangle and there is no L-shape. Adding a photo later reflows the text and re-fits
the font (jarring).

---

## ⚠️ Hard constraint — no automated coverage on the L-Wrap render path

The builder L-Wrap render (the `l-wrap` branch of `Slot` in `ScrapbookBuilder.jsx`, ~line 361) and
`LWrapBlock` in `bookCanvas.jsx` (line 72) have **NO automated test coverage.** A previous refactor
on this exact path regressed silently (the bottom full-width text below the floated photo
disappeared) despite a behavior-identical-looking diff. So any change here MUST be verified in-app:

1. Edit an l-wrap page and confirm the **bottom full-width text below the floated photo still
   renders.**
2. Export a **PDF** of an l-wrap page and confirm the float survives html2canvas.

Do not trust a "behavior-identical" diff on this path.

---

## The problem

The L-shape is produced by ONE CSS float. The floated photo box is gated on `block.url` in both
`LWrapBlock` (`bookCanvas.jsx:102`) and the builder edit path (`ScrapbookBuilder.jsx:376`). So if
text is placed first (no photo), there is no float → text fills the whole rectangle, no L-shape. The
builder's photo interaction zone is an `absolute` overlay (out of flow), so it can't push/wrap text.
Adding the photo later reflows the text AND re-fits the font.

---

## The fix — Approach A (always render the float box)

**Always render the float `<div>`** (fixed `photoW × photoH` + margins — a REAL in-flow DOM element),
and render the `<img>` inside it only when `block.url` exists. The text then wraps into the L
immediately, photo or not. A constant-size reserved box also means adding/removing a photo no longer
reflows the text or re-fits the font.

Apply to **all** render paths for consistency:
- `LWrapBlock` in `bookCanvas.jsx` (powers published view + PDF + the builder's display render).
- The builder edit branch in `ScrapbookBuilder.jsx` (~line 376, inside `isEditing`).

Concretely: change `{block.url && ( <div float...> <img/> </div> )}` to always render the floated
`<div>` with the same dimensions, and put `{block.url ? <img/> : <placeholder/>}` inside it.

### Design decisions (confirmed by Michael, 2026-06-14)

1. **Empty published corner:** NO visible frame — the reserved space is transparent in the published
   view and the PDF. Use a faint frame ONLY if a truly-blank reserved float turns out not to be
   technically achievable.
2. **Builder affordance:** a dashed **"Add a photo"** placeholder INSIDE the reserved box
   (builder-only; transparent in published/PDF).
3. **Genuinely photo-less l-wrap:** rather than permanently reserving an empty corner, steer the user
   to **convert it to the text-only template** — offer a one-click convert. This makes decision 1 a
   rare edge case.

### Rejected approaches (do not reach for these)

- **`::before` pseudo-element float spacer** — html2canvas can't render pseudo-elements, so the wrap
  would work in the builder but BREAK in the exported PDF. (See `feedback_html2canvas_limitations`.)
- **CSS Grid / multi-column** — a single continuous text stream can't flow across two
  differently-shaped regions; the only tech that did (CSS Regions) is dead. Splitting into two text
  blocks reintroduces the divergent-font-size problem S14's unified l-wrap was built to fix.
- **Reserve-only-while-editing / collapse-when-empty** — makes the builder and published view
  disagree (fitText divergence) and keeps the reflow jank.

---

## File touch points

| File | Change |
|---|---|
| `Frontend/src/lib/bookCanvas.jsx` | Always-render the float box in `LWrapBlock` (`<img>` only when `block.url`) |
| `Frontend/src/components/storybook/ScrapbookBuilder.jsx` | Always-render the float box + dashed "Add a photo" placeholder in the l-wrap edit branch (~line 376); convert-to-text-only action |

No backend changes. No DB migration.

---

## Verification (no automated coverage on this path)

1. Edit an l-wrap page **text-first** (no photo) → confirm the L-shape holds (text wraps around the
   reserved corner, does not fill the full rectangle).
2. Add a photo afterward → confirm the text does NOT reflow or re-fit (constant-size box).
3. Export a **PDF of a text-only l-wrap page** → confirm the wrap survives html2canvas and the empty
   corner is transparent (decision 1).
4. Confirm the "Add a photo" dashed placeholder is builder-only and absent from the PDF.
5. Exercise the one-click convert-to-text-only path.
6. Regression check: edit an l-wrap page **with** a photo → confirm bottom full-width text still
   renders (the path that broke before).

Recommend confirming current state with Michael before writing code (see
`feedback_discuss_before_coding`). After implementation, mark this plan **Needs Verification**, not
Complete, until Michael confirms in-app (see `feedback_plan_verification`).

---

## Verification checklist

- [x] Text-first l-wrap holds the L-shape (builder)
- [x] Adding a photo after text does not reflow / re-fit
- [x] PDF of text-only l-wrap wraps correctly; empty corner transparent
- [x] "Add a photo" placeholder is builder-only (absent in PDF)
- [x] Convert-to-text-only path works
- [x] Regression: edited l-wrap with a photo still renders bottom full-width text
- [x] No regression on other template types

## Implementation notes (2026-06-16)

- `Frontend/src/lib/bookCanvas.jsx` — `LWrapBlock` always renders the fixed-size float box; `<img>` only when `block.url`. Empty box is transparent (no frame) in published view + PDF.
- `Frontend/src/components/storybook/ScrapbookBuilder.jsx`:
  - Edit branch: always-reserved float box with a dashed "Add a photo" hint inside when photo-less (builder-only, `pointerEvents: none`).
  - Display branch: empty-state text hint is now `LWrapTextPlaceholder` — a dashed **L outline** (SVG path tracing the block minus the top-right photo notch), not a flat rectangle.
  - `convertLWrapToTextOnly(blockId)` re-shapes the single l-wrap block into the full-page text-only layout (preserves content/font/sourceKey, drops the photo float); surfaced as a builder-only "Use text-only instead" link in the empty photo corner.
