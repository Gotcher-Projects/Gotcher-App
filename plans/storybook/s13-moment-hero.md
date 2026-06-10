# S13 — Moment-Hero Chapter Type

**Status: Not started**
**Branch:** same as S7 (or new branch off main post-S12)
**Depends on:** S12 complete
**Roadmap:** V1 storybook; pulled forward from sv2-s5 as a self-contained addition
**Reference:** `plans/storybook-v2/research.md` — Moment-Hero Technical Research section

---

## Goal

Add a **Moment-Hero** chapter type to the existing scrapbook. When a user creates a new chapter, they can choose "From a First Time" — this creates a hero page for that specific First Time entry instead of the standard scrapbook canvas. The renderer is a purpose-built fixed-layout component (not the virtual canvas), which also forms the foundation for the guided book in sv2.

The moment-hero layout has three fixed zones:
1. Category badge + title + subtitle
2. Hero photo with white card frame
3. AI-generated note card (cream box, italic text, attribution)

---

## Background

First Times already store everything needed:
- `first_times.label` → title (e.g. "First Steps")
- `first_times.occurred_date` → subtitle (formatted date)
- `first_times.image_url` → hero photo
- `first_times.notes` → note card body (or AI-generated from label + date + notes)

The component is pure React HTML/CSS — no virtual canvas, no react-rnd, no fractional coordinates. Simpler to build, simpler to style precisely, and cleaner to extend for the guided book.

---

## Scope

### 1. `MomentHeroPage.jsx` component
New file: `Frontend/src/components/storybook/MomentHeroPage.jsx`

Fixed layout component. Props:
```js
{
  first: { label, occurred_date, image_url, notes },
  generatedNote: String,   // AI-generated note text (nullable — shows placeholder if null)
  theme: BookTheme,        // standard book theme object
  categoryLabel: String,   // e.g. "FIRST TIME" (default) or overrideable
}
```

Layout (top to bottom):
- Small caps category label (pink/accent color)
- Large bold title (`first.label`)
- Italic subtitle (formatted `occurred_date`)
- Hero photo — full-width, white card frame + drop shadow, caption below
- Note card — cream/ivory rounded box, "NOTE" label, italic body text, attribution "— [parent_name] xx"
- Small decorative heart in lower corner

No drag-and-drop. No editable regions in read mode. Static HTML/CSS only.

### 2. Chapter type support

**Option A (preferred):** Add a `chapter_type` column to `storybook_chapters`:
```sql
-- V35 migration (or next available)
ALTER TABLE storybook_chapters ADD COLUMN chapter_type VARCHAR(20) NOT NULL DEFAULT 'scrapbook';
-- existing chapters are 'scrapbook'; new moment-hero chapters are 'moment_hero'
```

Also add `source_first_time_id BIGINT REFERENCES first_times(id) ON DELETE SET NULL` — stores which First Time this chapter is based on.

**Option B (if we want to avoid a migration now):** Encode the type in `anchor_type` (e.g. `anchor_type = 'first_time'`). Less clean but zero schema change.

Decide at session start. Option A is preferred for long-term clarity.

### 3. Chapter creation wizard: "From a First Time" option

In `StorybookWizard.jsx` (or wherever the "New Chapter" flow lives), add a new entry point:
- "From a First Time" alongside existing options
- Shows a list of the user's First Times (label + date + thumbnail)
- Selecting one creates a moment-hero chapter linked to that First Time
- The chapter title = the First Time label

### 4. AI note generation

The note card body is AI-generated. Endpoint options:
- New endpoint: `POST /storybook/generate-hero-note` — takes `{ firstTimeId }`, returns `{ note: "..." }`
- Or reuse the existing generation pipeline with a hero-note-specific prompt

Prompt sketch: *"Write a warm, brief (2–3 sentence) note about [baby name]'s [label] on [date]. Tone: heartfelt, personal, written from the parent's perspective. End with a short attribution."*

Note is stored in `storybook_chapters.body` (reusing existing column).

### 5. Rendering in StorybookTab

In `StorybookTab.jsx`, when rendering a chapter with `chapter_type = 'moment_hero'`:
- Show `MomentHeroPage` instead of `LayoutRenderer`
- No "Edit layout" button (no canvas for this type)
- "Regenerate note" button (re-calls generate-hero-note endpoint)

### 6. PDF export

In `storybookPdf.js`, handle `chapter_type = 'moment_hero'`:
- Render `MomentHeroPage` off-screen at 600px wide (matching existing PDF capture approach)
- Capture with html2canvas
- Append to PDF as a full page

No pseudo-elements in `MomentHeroPage` (drop cap not needed here) — html2canvas should capture cleanly.

---

## Files to touch

| File | Change |
|---|---|
| `Backend/db/migration/V3x__...sql` | Add `chapter_type` + `source_first_time_id` to storybook_chapters |
| `Backend/.../storybook/StorybookChapter.java` | Add `chapterType`, `sourceFirstTimeId` fields |
| `Backend/.../storybook/StorybookService.java` | Handle moment_hero chapter creation + note generation |
| `Backend/.../storybook/StorybookController.java` | New endpoint for hero note generation |
| `Frontend/src/components/storybook/MomentHeroPage.jsx` | New — fixed-layout hero renderer |
| `Frontend/src/components/storybook/StorybookWizard.jsx` | Add "From a First Time" chapter creation option |
| `Frontend/src/components/tabs/StorybookTab.jsx` | Render MomentHeroPage for moment_hero chapter type |
| `Frontend/src/lib/storybookPdf.js` | Handle moment_hero in PDF export |

---

## Open questions (resolve at session start)

1. **Migration or anchor_type encoding?** Prefer migration (Option A) but decide based on risk appetite at the time.
2. **Edit mode?** Should the hero page have any editable fields (photo replace, note text edit), or is "Regenerate note" + First Times edit flow sufficient?
3. **Chapter status flow?** Does a moment-hero chapter go through the same unlocked→generating→published states, or does it skip straight to published once the note is generated?
4. **First Times not yet in the book vs already used indicator?** S11 added used-indicators for scrapbook pieces — does that need to extend to moment-hero chapters?

---

## Verification

1. Create a new chapter via "From a First Time" — it appears as a moment-hero card in the chapter list.
2. The hero page shows the First Time's photo, label, date, and AI-generated note.
3. "Regenerate note" produces a different note without changing the photo or title.
4. PDF export includes the moment-hero page at correct dimensions.
5. Existing scrapbook chapters are unaffected (`chapter_type = 'scrapbook'` by default).
6. If the linked First Time is deleted, the chapter still renders (source_first_time_id goes to NULL; falls back to stored data).
