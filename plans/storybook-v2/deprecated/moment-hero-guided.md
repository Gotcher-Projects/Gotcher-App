# ❌ DROPPED — Moment-Hero in Guided Book + Gallery Pages   *(was sv2-s5; that number is now Family Tree)*

**Status: ❌ DROPPED (2026-06-27).** The guided book is now a **pre-designed fill-in book**, not an
auto-derived one (see `planning.md` 2026-06-27 direction update). We do **not** auto-generate a Firsts
chapter. Firsts instead appear as **a few user-picked moment-hero pages** in the fixed book arc
(the "pick" page type). Moment-Hero + Gallery already ship as manual scrapbook templates, so nothing is
lost. `sv2-s7` is dropped with this. Original plan preserved below for history.

---

**Original status: Not started**
**Depends on:** S13 (moment-hero shipped as **`MomentHeroCanvas.jsx`**, NOT `MomentHeroPage.jsx` — see
planning.md §0), sv2-s4 (multi-photo Firsts data available). NOT blocked on Payments — core v2 ships free (§8).
**Reference:** `planning.md` Q3 — moment-hero in both modes; `planning.md` §8 — AI model; `research.md`

---

**⭐ AI model (planning.md §8):** the book is **AI-free by default** and **there is NO batched AI note
generation**. Each First Time's note is the **parent's own `first_times.notes`** text. The optional,
paid-gated, per-field "✨ write this for me" assist (built once in `sv2-ai-assist`) can later reword a
single note — but this session does the data wiring only, using the user's existing notes. The old
batched-generation endpoint described in earlier drafts is **dropped** (consistent with deleting
`generatePages()` in `sv2-ai-retrofit`).

---

**⭐ Page-type pattern (DECIDED 2026-06-24 — see `planning.md` §0 + `sv2-s1`):** moment-hero **is the
reference pattern** — a `renderer: 'moment_hero'` template + `MomentHeroCanvas`, added as a layout page,
**not an `anchor_type` chapter**. Build `GalleryPage` the **same way**: a `renderer: 'gallery'` template in
`lib/storybookTemplates.js` + a `GalleryCanvas` dispatched in `ScrapbookBuilder` / `LayoutRenderer` /
`storybookPdf.js` (+ `TemplateSheet` thumb), reading photos from `first_time_photos`. The Firsts *chapter*
in the guided book is a sequence of these template pages in `layout_data` (or derived live) — **not** a new
chapter type. Do **not** introduce `anchor_type='firsts_chapter'` as a bespoke chapter; keep it a
layout-page sequence.

---

## Goal

Connect the moment-hero renderer (S13's `MomentHeroCanvas.jsx`) and `GalleryPage` component (built in sv2-s4) to the guided book's Firsts chapter. A Firsts chapter in the guided book derives a **hero + gallery pair** for each First Time entry: one moment-hero page showing the featured photo + the parent's note, followed by one gallery page showing the additional photos.

This is the wiring session — the renderers already exist; this session is about deriving the chapter from existing First Times data, the chapter data structure, and the guided book integration.

---

## Background

After S13 and sv2-s4:
- `MomentHeroCanvas.jsx` exists (S13) — renders a moment-hero layout. **Resolve first:** is it reusable
  as a fixed-layout book page, or does it need a thin `MomentHeroPage` wrapper? (planning.md §0)
- `GalleryPage.jsx` exists — takes photos array and renders a 2×2 grid
- `first_times` has `image_url` (hero photo) and `notes` (the parent's own note)
- `first_time_photos` has additional photos per first time

What's missing: a way for the guided book to derive a Firsts chapter from all First Times, as hero+gallery
pairs, using each First Time's existing photo + note (no AI generation).

---

## Scope

### 1. Firsts chapter type in guided book

The guided book (sv2-s6) will include a "Firsts" section. This session defines what that section contains:

- One `storybook_chapters` row of type `'firsts_chapter'` (or stored as part of the guided book's book-level data — TBD in sv2-s6)
- The chapter renders all First Times as sequential pairs: `[hero for First A] [gallery for First A] [hero for First B] ...`
- Sort order follows the First Times sort order (by `occurred_date` ASC)

### 2. Chapter derivation logic

When the Firsts chapter renders:
- Fetch all `first_times` for the baby (with their `notes` and `first_time_photos`)
- Build a sequential page list: `[{ type: 'moment_hero', firstId }, { type: 'gallery', firstId }]` pairs
- The moment-hero page uses the First Time's existing `notes` (the parent's own words) — no generation
- Store as chapter `layout_data` in a new format (or derive on the fly from a reference list — decide at session)

Derivation is data-driven; nothing to "generate." (A note that's blank simply renders empty / with a
placeholder; the optional per-field AI assist to help word it arrives with `sv2-ai-assist`.)

### 3. Notes — parent-written, no batch generation

Each moment-hero note is the First Time's `first_times.notes` value. **No batch generation endpoint** —
the old `generate-firsts-notes` idea is dropped per §8 (AI page/content generation removed). If a note
is empty and the user wants help wording it, the shared per-field assist (`sv2-ai-assist`) handles that
one field later, paid-gated.

### 4. Rendering in guided book

In the guided book view (sv2-s6), the Firsts section renders the sequential page list by mapping:
- `{ type: 'moment_hero', firstId }` → moment-hero renderer with `first={...}` and its own `notes`
- `{ type: 'gallery', firstId }` → `<GalleryPage photos={additionalPhotos} />`

If a First Time has no additional photos, the gallery page is skipped for that entry.

### 5. PDF export

`storybookPdf.js`: handle the Firsts chapter by iterating the page list and capturing each page type appropriately (already handled individually in S13 and sv2-s4; this session just chains them).

---

## Files to touch

| File | Change |
|---|---|
| `Frontend/src/components/storybook/GuidedBook.jsx` | Firsts section derivation + rendering from existing first_times (this is sv2-s6 territory — coordinate) |
| `Frontend/src/lib/storybookPdf.js` | Chain hero + gallery pages for Firsts chapter in PDF |

(No backend changes — there is no batch note generation. Notes come from `first_times.notes`.)

---

## Open questions (resolve at session start)

1. **Gallery pages for Firsts with no additional photos:** Skip entirely, or show a single-photo "gallery" page? Probably skip.
2. **Note source:** Confirm the moment-hero note reads `first_times.notes` directly. Since notes are
   parent-written and the chapter is derived live, edits to a First Time's note flow through automatically.
3. **New Firsts:** Because the chapter is derived from current `first_times` on render, new First Times
   appear automatically. Confirm no caching/snapshot that would need a manual refresh.
4. **Chapter data storage:** Derive on the fly from `first_times`, or snapshot a page list in
   `storybook_chapters.layout_data` / a `guided_book_sections` structure introduced in sv2-s6?

---

## Verification

1. Firsts chapter in guided book shows all First Times as hero+gallery pairs in date order.
2. First Times with no additional photos show only a hero page (no gallery).
3. Adding a new First Time makes it appear in the chapter (derived live, no regenerate step).
4. PDF export includes all hero+gallery pairs in sequence.
5. Each moment-hero shows the parent's own note (`first_times.notes`); blank notes render gracefully.
