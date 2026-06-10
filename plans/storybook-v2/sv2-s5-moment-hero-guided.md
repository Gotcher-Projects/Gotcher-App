# SV2-S5 — Moment-Hero in Guided Book + Gallery Pages

**Status: Not started**
**Depends on:** S13 (MomentHeroPage component built), sv2-s4 (multi-photo Firsts data available)
**Reference:** `planning.md` Q3 — moment-hero in both modes; `research.md` — Moment-Hero Technical Research

---

## Goal

Connect the `MomentHeroPage` component (built in S13) and `GalleryPage` component (built in sv2-s4) to the guided book's Firsts chapter. A Firsts chapter in the guided book auto-generates a **hero + gallery pair** for each First Time entry: one moment-hero page showing the featured photo + AI note, followed by one gallery page showing the additional photos.

This is the wiring session — the renderers already exist; this session is about auto-generation, the chapter data structure, and the guided book integration.

---

## Background

After S13 and sv2-s4:
- `MomentHeroPage.jsx` exists — takes a `first` object and renders a fixed hero layout
- `GalleryPage.jsx` exists — takes photos array and renders a 2×2 grid
- `first_times` has `image_url` (hero photo)
- `first_time_photos` has additional photos per first time

What's missing: a way for the guided book to say "auto-generate a Firsts chapter from all First Times, as hero+gallery pairs."

---

## Scope

### 1. Firsts chapter type in guided book

The guided book (sv2-s6) will include a "Firsts" section. This session defines what that section contains:

- One `storybook_chapters` row of type `'firsts_chapter'` (or stored as part of the guided book's book-level data — TBD in sv2-s6)
- The chapter renders all First Times as sequential pairs: `[hero for First A] [gallery for First A] [hero for First B] ...`
- Sort order follows the First Times sort order (by `occurred_date` ASC)

### 2. Auto-generation logic

When the Firsts chapter is "generated":
- Fetch all `first_times` for the baby
- For each: check if a `generatedNote` exists in chapter data; if not, call generate-hero-note endpoint
- Build a sequential page list: `[{ type: 'moment_hero', firstId }, { type: 'gallery', firstId }]` pairs
- Store as chapter `layout_data` in a new format (or as a reference list — decide at session)

Generation can be triggered manually ("Generate Firsts chapter") or lazily on first view.

### 3. Note generation for all Firsts

The `/storybook/generate-hero-note` endpoint (from S13) generates a note for a single First Time. This session may need a batch endpoint: `POST /storybook/generate-firsts-notes` — generates notes for all First Times that don't yet have one, returns `{ [firstTimeId]: note }`.

### 4. Rendering in guided book

In the guided book view (sv2-s6), the Firsts section renders the sequential page list by mapping:
- `{ type: 'moment_hero', firstId }` → `<MomentHeroPage first={...} generatedNote={...} />`
- `{ type: 'gallery', firstId }` → `<GalleryPage photos={additionalPhotos} />`

If a First Time has no additional photos, the gallery page is skipped for that entry.

### 5. PDF export

`storybookPdf.js`: handle the Firsts chapter by iterating the page list and capturing each page type appropriately (already handled individually in S13 and sv2-s4; this session just chains them).

---

## Files to touch

| File | Change |
|---|---|
| `Backend/.../storybook/StorybookController.java` | Add batch note generation endpoint |
| `Backend/.../storybook/StorybookService.java` | Batch generation logic |
| `Frontend/src/components/storybook/GuidedBook.jsx` | Firsts section rendering (this is sv2-s6 territory — coordinate) |
| `Frontend/src/lib/storybookPdf.js` | Chain hero + gallery pages for Firsts chapter in PDF |

---

## Open questions (resolve at session start)

1. **Gallery pages for Firsts with no additional photos:** Skip entirely, or show a single-photo "gallery" page? Probably skip.
2. **Note regeneration:** If a user edits a First Time's notes after generation, does the book note auto-update or require manual "Regenerate"?
3. **New Firsts added after chapter generation:** Does the Firsts chapter auto-include new First Times, or does the user need to "Regenerate chapter"?
4. **Chapter data storage:** Hero+gallery page list stored in `storybook_chapters.layout_data`, or a separate `guided_book_sections` structure introduced in sv2-s6?

---

## Verification

1. Firsts chapter in guided book shows all First Times as hero+gallery pairs in date order.
2. First Times with no additional photos show only a hero page (no gallery).
3. Adding a new First Time and regenerating updates the chapter.
4. PDF export includes all hero+gallery pairs in sequence.
5. AI notes are present for each First Time (generated on demand if missing).
