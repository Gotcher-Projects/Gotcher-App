# SV2-S1 — Letter to Baby

**Status: Complete — confirmed 2026-07-02 (all sub-9 sessions finished).** (implemented 2026-06-24 — verify in-app, then mark Complete)

## ✅ Implementation approach (2026-06-24) — letter is a LAYOUT PAGE TYPE

**Decision (corrects this plan's original storage section):** the letter is **not** its own chapter
type. It is a **page template + renderer inside the existing layout system**, exactly like the shipped
**moment-hero** page type. This keeps all v2 page types (letter, birth-stats, people, multi-photo
firsts, moment-hero) as **one consistent thing** — renderers/templates in the same book canvas — which
is how they were always intended (consistent design language, no per-page-type structural divergence).

How it works (mirrors `moment-hero`):
- **`letter` template** in `Frontend/src/lib/storybookTemplates.js` — `renderer: 'letter'`, role-id
  blocks `title` / `body` / `signature` (no photos, no memory binding). Like moment-hero, the renderer
  ignores block x/y and lays out its own fixed design.
- **`LetterCanvas.jsx`** renderer — theme-independent warm palette, section label + heart divider as
  chrome, role blocks for the text. Dispatched on `renderer === 'letter'` / `templateId === 'letter'`
  in `ScrapbookBuilder` (builder), `LayoutRenderer` (read view), and `storybookPdf` (PDF) — the same
  three dispatch points moment-hero uses.
- **Added like any layout:** open a scrapbook chapter's builder → template picker (`TemplateSheet`,
  with a `LetterThumb`) → **"Letter"**. Body/signature are edited in-place (Tiptap), saved via the
  existing `PATCH /storybook/{id}` `layoutData`. The guided book (sv2-s6) references `renderer: 'letter'`
  in its arc — same renderer, predetermined position.
- **`lib/letterTypes.js`** stays as the additive letter-type registry (id → title); consumed by the
  guided book to seed the title block, and later by the per-field AI assist (`promptTemplate`).

**No backend / DB / storage changes** — the letter rides inside a chapter's `layout_data`, like every
other layout page.

### ⚠️ Note for future page-type sessions (sv2-s2/s3/s5) — learn from the first attempt here
This plan's original spec stored the letter as a dedicated `anchor_type='letter'` chapter with a bespoke
create endpoint and a standalone "Write a Letter" card. **That was built first, then reverted** — it
diverged from the moment-hero pattern (a separate paradigm: new chapter type + `POST /storybook/chapters`
generic endpoint + `supplementary_notes` signature column reuse + standalone entry card). The page types
are meant to be **layouts in the shared system**, not standalone chapter types. **Build birth-stats /
people / moment-hero the same template+renderer way** — their *data* (birth_details, family_members) lives
in their own tables/endpoints, but the *page* is a layout template, added through the builder, not a
bespoke chapter type. (The old `anchor_type='letter'` storage paragraph below is superseded by this.)

## Session resolutions (2026-06-24)
- **Open Q1 (input storage):** letter text lives in the chapter's `layout_data` blocks (`body` /
  `signature` / `title`), like any layout page — **no new column, no migration**.
- **Open Q2 (re-edit UX):** in-place block editing in the builder (Tiptap), saved on builder save —
  consistent with every other layout page (supersedes the earlier "explicit Save button on a card").
- **Open Q3 (multiple letters):** a letter is just a page — you can add as many letter pages as you like
  (a guided book would place one of a given type). No unique constraint needed.
- **Open Q4 (due_date gate):** **not gated** — write any time (retroactive).
- **First-run seeding:** body starts empty with a placeholder. Seeding from related pre-birth raw text
  deferred (revisit with the pregnancy guided chapter / `sv2-sP`).

---

**Status (original): Not started**
**Depends on:** review-fixes track (s1–s11) + S13 + S15 complete (see `planning.md` §0). NOT blocked on
LULU/print (that's the last v2 workstream) and NOT blocked on Payments (core v2 ships free — §8).
**Reference:** `planning.md` Q7 — extensible letter component, pre-birth type first; `planning.md` §8 — AI model

---

**⭐ AI model (planning.md §8):** the book is **AI-free by default**. The letter is **written by the
user** in their own words. AI is a **separate, opt-in, paid-gated, per-field "✨ write this for me"
assist** — built once in `sv2-ai-assist` and wired into this field later; it helps word the *one* letter
field, it never generates the page. **Build the manual letter path first.** Seed the field with any raw
text the user already has (e.g. a related journal note) rather than a blank box — first-run "wow"
mitigation. For free users the assist affordance is visible-but-inert (upsell).

---

## Goal

Build an **extensible Letter component** and ship the first letter type: **"A Letter Before You Arrived"** (pre-birth letter from parents to their unborn/newborn baby). The component is designed from the start to support multiple letter types — adding a new type later is purely additive (new config entry + prompt template, no structural changes).

This is one of the highest emotional-value features in the v2 plan. The page output is a full-page letter in a script/italic font — warm, personal, signed by the parents.

---

## Letter Types System

Each letter type is a config object:

```js
// Frontend/src/lib/letterTypes.js
export const LETTER_TYPES = [
  {
    id: 'pre_birth',
    displayName: 'A Letter Before You Arrived',
    description: 'Written before or just after birth — your hopes and dreams',
    anchorType: 'letter',
    anchorKey: 'pre_birth',
    promptTemplate: (baby, parent, input) =>
      `Write a heartfelt letter from ${parent} to their baby ${baby}, who has not yet arrived (or just arrived). ...`,
    suggestedTiming: 'Any time — can be written retroactively',
  },
  // Future types added here without touching renderer or storage
];
```

Future types (not built this session):
- `six_months` — "A letter to you at 6 months"
- `first_birthday` — "A letter on your first birthday"
- `for_when_youre_older` — no specific age, stored as a keepsake

---

## Scope

### 1. Storage

Letters are stored as `storybook_chapters` rows with `anchor_type = 'letter'` and `anchor_key = letter_type_id` (e.g. `'pre_birth'`). This reuses the existing chapter infrastructure (status, sort_order, PDF export pipeline).

No new migration needed if `chapter_type` column is added in S13. If S13 hasn't landed yet, letters can be differentiated via `anchor_type = 'letter'`.

### 2. `LetterPage.jsx` component
New file: `Frontend/src/components/storybook/LetterPage.jsx`

Fixed layout. Props:
```js
{
  letterType: LetterTypeConfig,
  body: String,         // user-written letter text (multi-paragraph; optionally AI-assisted per field)
  parentName: String,
  babyName: String,
  theme: BookTheme,
}
```

Layout:
- Small caps section label at top ("A LETTER TO YOU")
- Large bold title (letter type's `displayName`)
- Full-page letter body — italic/script font, generous line height, centered or narrow column
- Signed "— With all our love, [parentName] xx"
- Warm cream background, decorative heart accent
- Page number in corner

No interactive regions in read mode. Editable via inline text edit (the default, manual path); the
optional per-field AI assist is layered on later via `sv2-ai-assist`.

### 3. Letter creation UI

In the Book tab (or guided book shell when that lands in sv2-s6):
- "Add a Letter" button — shows letter type picker
- For `pre_birth`: a writing surface (textarea) where the parent **writes the letter themselves**,
  with a prompt to help them start ("Share a few thoughts — your hopes, what you were feeling, what you
  dreamed about for your baby")
- Optionally seed the textarea with any related raw text the user already has, so it's not a blank box
- The letter body is the user's own words; saved to `storybook_chapters.body`

### 4. AI assist (optional, NOT built this session)

The letter field carries the shared **"✨ write this for me" per-field assist** (built once in
`sv2-ai-assist`, paid-gated, credit-metered). Given a few prompt words it can draft/expand the letter
body for the user to accept/edit — but it's opt-in garnish, not the default. **This session ships only
the manual writing path**; the assist hook is wired in when `sv2-ai-assist` lands. No batched
`/storybook/generate` page-generation (that path is being removed in `sv2-ai-retrofit`).

Letter body stored in `storybook_chapters.body` (or `generated_content`) regardless of how it was written.

### 5. Rendering in StorybookTab

Chapters with `anchor_type = 'letter'` render `LetterPage` instead of `LayoutRenderer`. "Regenerate letter" button available. No layout editor for letter pages.

### 6. PDF export

`storybookPdf.js` handles letter chapters: render `LetterPage` off-screen, capture with html2canvas, append as full page. Script font must be loaded before capture (same pattern as existing font handling).

---

## Files to touch (AS BUILT — template/renderer approach)

| File | Change |
|---|---|
| `Frontend/src/lib/storybookTemplates.js` | New `letter` template (`renderer: 'letter'`, role blocks title/body/signature) |
| `Frontend/src/components/storybook/LetterCanvas.jsx` | New — letter renderer (blocks-based, like MomentHeroCanvas) |
| `Frontend/src/components/storybook/ScrapbookBuilder.jsx` | Dispatch `renderer === 'letter'` → LetterCanvas (builder edit) |
| `Frontend/src/components/storybook/LayoutRenderer.jsx` | Dispatch `templateId === 'letter'` → LetterCanvas (read view) |
| `Frontend/src/components/storybook/TemplateSheet.jsx` | `LetterThumb` + keep letter out of "Photo Only" filter |
| `Frontend/src/lib/storybookPdf.js` | Dispatch `templateId === 'letter'` → LetterCanvas (PDF capture) |
| `Frontend/src/lib/letterTypes.js` | Letter-type registry (id → title), consumed by guided book (sv2-s6) + AI assist later |
| **Backend** | **None** — letter is a layout page inside `layout_data`; no schema/endpoint changes |

**Superseded (built then reverted):** `LetterPage.jsx`, `CreateChapterRequest`, `POST /storybook/chapters`,
the `supplementary_notes` signature reuse, and the standalone "Write a Letter" card — see the note at the
top of this file.

---

## Open questions (resolve at session start)

1. **Letter input storage:** Where is the user's raw input (their prompt/notes) stored? In `storybook_chapters.body` before generation, or a separate column?
2. **Re-edit flow:** Inline text editing is the default (manual model). Confirm the inline-edit UX
   (autosave vs explicit save). The optional AI assist re-draft arrives with `sv2-ai-assist`.
3. **Multiple letters:** Can a user have multiple letters of the same type (e.g. two pre-birth letters), or one per type?
4. **`pre_birth` requires `due_date`?** Do we gate this letter type on having a due_date set, or allow it any time (retroactive)?

---

## Verification

1. Add a **Letter** layout page in the scrapbook builder → fill title/body/signature → builder save persists it.
2. `LetterCanvas` renders correctly in both the builder and the Book read view (`LayoutRenderer`).
3. PDF export includes the letter page at correct dimensions.
4. Re-edit of the letter blocks persists (in-place builder editing).
5. Existing layouts (moment-hero, period chapters) are unaffected.

### Manual test steps (in-app — run once Docker/env is back)
The letter is a layout page added through the scrapbook builder (same path as a moment-hero page).
1. Log in → **Memories → Book**.
2. Open a scrapbook chapter's builder (create/edit a chapter → **Edit** layout). Add a page →
   **Choose a layout** → in the template picker pick **"Letter"** (it shows the letter thumbnail).
3. The page renders the letter design (cream bg, "A LETTER TO YOU" label, heart divider, title / body /
   signature zones). Tap **title** → type the letter title; tap **body** → write the letter; tap
   **signature** → type the sign-off. Confirm placeholders show when a zone is empty.
4. Save the builder → reopen the chapter: confirm the letter page persisted with your text.
5. Publish the chapter → in the Book read view the letter renders correctly.
6. Click **Download PDF** → confirm the letter exports as its own full page at the right dimensions, and
   existing layouts / moment-hero / period chapters still export unchanged.
7. Confirm no standalone "Write a Letter" card exists on the Book tab and no `anchor_type='letter'`
   chapters are created (letter is a page inside a normal chapter).
