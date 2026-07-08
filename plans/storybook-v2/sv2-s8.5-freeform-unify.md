# SV2-S8.5 — Unify freeform: retire period chapters

**Status: Complete — confirmed 2026-07-02 (all sub-9 sessions finished). (implemented 2026-07-01).** Scheduled AFTER `sv2-s8` (pregnancy chapter),
BEFORE `sv2-s9` (polish/PDF). First concrete step toward the long-term unified-book-editor vision
(`planning.md` §4 Q1); Michael wants the move made **before public launch**.

## ✅ Implemented (2026-07-01)
- **Backend:** `BookService.create` now seeds one empty `anchor_type='freeform'` chapter per freeform book
  (`seedFreeformChapter` + `emptyFreeformLayout`, one v2 page), inside the same transaction as the book.
  New backend test `create_freeform_seedsOneChapter`.
- **Migration `V43__retire_period_chapters.sql`:** clean break (D4) — `DELETE` all `anchor_type='period'`
  chapters, then drop any now-empty freeform book shells. Guided untouched.
- **ScrapbookBuilder:** freeform `memories` + `availablePhotos` now read the WHOLE `journalEntries`/`firsts`
  pool (dropped the `chapter.selected*` pre-filter); **30-page soft cap** (`MAX_PAGES`) guards `addPage` +
  disables the "Add page" button with a "Max 30 pages" note.
- **StorybookTab:** freeform tab is now **cover + theme + "Edit book" + Download PDF** (no chapter cards,
  no wizard). Creating a freeform book opens the builder straight onto its single chapter. Removed the
  wizard mount/state, `SortableChapterCard`/`ChapterCard`, chapter-reorder DnD, and the period `sortChapters`.
  Download-PDF now exports the whole book for both modes (no per-period publish gate).
- **Deleted** `StorybookWizard.jsx` + `lib/storybookPeriods.js`; removed their imports; simplified builder
  `TYPE_LABELS` usage.
- **Left dead (per Michael, 2026-07-01):** the backend `POST /storybook/wizard` endpoint + its
  `StorybookService` period-create path + `WizardRequest` DTO remain but are unreachable — small follow-up
  cleanup, not done this pass.
- **Green:** frontend 337 tests + Vite build; backend `BookServiceTest` (incl. the new freeform test).

**Verify in-app** (then mark Complete): creating a freeform book drops straight into the editor; the memory
panel shows ALL journals + firsts; add pages up to 30 (button disables at 30); the freeform tab shows
cover + "Edit book" (no time-period step / chapter cards anywhere); Download-PDF works; and the **guided**
book is unchanged.

---
_Original plan below._
**Depends on:** `sv2-s7a` (books container — Needs Verification) + `sv2-s7b` (guided arc) so the
guided/freeform split is real before freeform is reworked.
**Reference:** `planning.md` §1 (two modes) + §4 Q1 (unified-editor vision); `sv2-s7-guided-book-shell.md`
(guided keeps Model A: one `storybook_chapters` row per page).

## ✅ Decisions locked (2026-06-28)
- **Flat page sequence.** A freeform book = **one continuous list of pages**, no period/section
  containers. Storage = **one `storybook_chapters` row per book** (D1 option b), all pages in its
  `layout_data.pages`. (Guided is unaffected — it keeps Model A, one row per page, because its pages each
  carry their own kind/prompt/lock; freeform pages are homogeneous.)
- **30-page soft cap** for now (future-changeable). Enforce in the builder's "Add page" (disable + note
  at 30).
- **Book tab = Cover + "Edit book".** The freeform tab shows the cover + theme + a single **Edit book**
  button that opens the builder on all pages (replacing today's period chapter-card list). Keep the
  Download-PDF affordance.
- **The builder is reused as-is** — it is *already* a whole-book multi-page editor (`pages` array, add/
  remove/reorder, per-page template picker). No new editor.
- **Memory panel shows ALL memories** (D3): point `MemoryPanel`/`availablePhotos` at the full
  `journalEntries`/`firsts` (already passed to the builder), dropping the `chapter.selected*` pre-filter.
- **Clean break** (D4): wipe existing period chapters, no convert (pre-prod; re-validate at build time).
- **Retire the period machinery entirely:** delete `StorybookWizard.jsx` + `lib/storybookPeriods.js`,
  the `anchor_type='period'` creation path, and period labels — nothing else creates freeform chapters.

---

## Why

In s7a we kept the period wizard as the freeform chapter-creation path (de-AI'd). But the long-term
direction (§4 Q1) is to **move away from the chapter-by-chapter / time-period model** toward "design
the whole book at once" — a continuous sequence of **pages**, not period-scoped chapters. Right now a
freeform book still makes the user pick a **time window** ("Weeks 8–12") before adding content, which is
the relic we want gone. This session removes the period concept from freeform and makes freeform a
**blank book you add pages to directly**.

It also **converges freeform with guided**: after s7b, a guided book is an ordered list of page rows
(Model A). Freeform should become the same shape — an ordered list of pages — just **user-added instead
of arc-materialized**. That convergence is the real prize: one page-list model, two entry points.

## Current state (after s7a, verified 2026-06-28)

- A freeform book = `books` row + N `storybook_chapters` rows. Each chapter is created by
  `StorybookWizard` (`anchor_type='period'`, `period_start/end_weeks`, `anchor_key` a period key) and
  holds its pages in `layout_data.pages` (v2 layout).
- Period machinery: `lib/storybookPeriods.js` (`STORYBOOK_PERIODS`), used by `StorybookWizard.jsx`
  (step 1 period select + step 2 period-windowed memory pre-selection) and read in `StorybookTab.jsx`
  / `ScrapbookBuilder.jsx` (`anchorType` display labels).
- Memory attachment today happens **in the wizard** (period-windowed checkboxes), then the builder
  opens. The builder *also* has a `MemoryPanel` / `PhotoTray` that can place memories directly.

### Key realization (verified in `ScrapbookBuilder.jsx`, 2026-06-28)
**The builder is already a whole-book, multi-page editor**, and memory attachment already lives inside
it. It owns a `pages` array with `addPage` / `removeCurrentPage` / `movePageLeft/Right` / page nav / a
per-page `TemplateSheet` picker, and the left `MemoryPanel` drag-places memories. So a "period" only
does two things: (1) it's a **chapter wrapper** around a set of pages, and (2) the wizard's selection
**pre-filters** which memories the panel shows (`memories`/`availablePhotos` read `chapter.selected*`,
not all memories). That makes this session **mostly subtraction**, not a new editor — which is why the
decisions above land where they do.

## Target

- **No time-period step.** Creating a freeform book makes one empty chapter and drops you into the
  builder; you add pages (pick a layout) and fill them. Capped at 30 pages for now.
- **Memory panel = all memories.** The builder's `MemoryPanel`/`availablePhotos` read the full
  `journalEntries`/`firsts` instead of a per-chapter selection. No pre-selection wizard.
- **Book tab = cover + Edit book.** No chapter-card list for freeform.
- **Guided unaffected.** Guided keeps Model A; the two modes already converge where it matters (same
  builder, renderers, PDF path).

---

## Open decisions — RESOLVED (2026-06-28)

All five are answered in **✅ Decisions locked** above. For the record: D1 → **(b)** one chapter per book
(flat pages); D2 → reuse the builder's existing add-page (no wizard); D3 → panel shows **all** memories;
D4 → **clean break**; D5 → **cover + Edit book** tab (no page-strip for v1 — revisit later).

---

## Work items (build — likely one session, split if it grows)

1. **Freeform creation → builder.** On creating a `type='freeform'` book (s7a's chooser), auto-create one
   empty `storybook_chapters` row for it and open the builder on it. (Backend: a freeform branch on
   `POST /books`, or create-on-first-open; mirror s7b's instantiation plumbing.)
2. **All-memories panel.** Build the builder's `memories`/`availablePhotos` from full
   `journalEntries`/`firsts` (drop the `chapter.selected*` pre-filter). Verify drag/place, photo tray,
   uploads, and used-indicators still work against the full set.
3. **30-page cap.** Disable "Add page" + show a note at 30 pages.
4. **StorybookTab freeform view.** Replace the add-chapter card + chapter-card list with **cover + theme +
   Edit book + Download PDF**. Branch on `book.type` (guided → s7b view; freeform → this).
5. **Retire periods.** Delete `StorybookWizard.jsx` + `lib/storybookPeriods.js`, the `anchor_type='period'`
   creation path, and period labels (`TYPE_LABELS`, etc.) in `ScrapbookBuilder`/`StorybookTab`.
6. **Clean break.** Migration/seed step to clear existing period chapters (re-validate dev-only first).
7. **Tests.** Builder reads all memories; 30-page cap; freeform tab shows Edit-book not chapter cards;
   creation makes exactly one chapter.

**No new AI, print, or share work here** — purely the freeform structure change. Carries no new page
types or renderers.

## Dependencies & sequencing

- **After `sv2-s8`** (so the pregnancy chapter ships on the current, stable freeform/guided split and
  isn't destabilized mid-flight).
- **Before `sv2-s9` (polish/PDF)** — s9 should chain a *stable* page model into the PDF, so the freeform
  rework must land first or s9 re-does work.
- **Touches the PDF + render pipeline** indirectly: `LayoutRenderer`, `storybookPdf.js`, `storybookPdf`
  read `layoutData.pages`; if D1 changes how pages are stored, those readers change too.

## Risks

- **Memory curation parity.** The wizard did photo overrides + per-entry notes on top of period
  windowing. The all-memories panel + builder PhotoTray/uploads should cover this, but confirm nothing is
  lost (e.g. swapping an entry's photo just for the book → now an in-builder upload).
- **Publish/draft granularity.** With one chapter per book, "publish" is now whole-book, not per-period.
  Confirm the draft→published flow + Download-PDF still read sensibly (likely simpler, not harder).
- **`book.type` branching in StorybookTab.** Freeform → cover+Edit-book; guided → s7b's guided view. Keep
  the two branches cleanly separated so s8.5 doesn't disturb the guided path.
- **Builder coupling to `chapter.anchorType`.** Some builder/tab copy keys off `anchorType` labels
  (`TYPE_LABELS`); sweep for period assumptions when removing them.

## When done

Mark **Needs Verification**; **Complete** only after Michael confirms freeform creates/edits/reorders
pages with no time-period step anywhere and the guided book is unaffected.
