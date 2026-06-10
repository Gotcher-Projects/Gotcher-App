# SV2-S1 — Letter to Baby

**Status: Not started**
**Depends on:** S12 + Deferred + LULU complete; sv2 planning finalized
**Reference:** `planning.md` Q7 — extensible letter component, pre-birth type first

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
  body: String,         // AI-generated letter text (multi-paragraph)
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

No interactive regions in read mode. Editable only via "Regenerate" flow.

### 3. Letter creation UI

In the Book tab (or guided book shell when that lands in sv2-s6):
- "Add a Letter" button — shows letter type picker
- For `pre_birth`: a short prompt form asking the user for input ("Share a few thoughts — your hopes, what you were feeling, what you dreamed about for your baby")
- Input is stored as `letter_input` (in `storybook_chapters.body` temporarily, or a new column — decide at session)
- AI generates the full letter from the input + baby name + parent name

### 4. AI generation

Prompt produces a multi-paragraph letter (3–5 paragraphs). Warm, personal, first-person from parent to baby. Uses existing `/storybook/generate` pipeline or a new `/storybook/generate-letter` endpoint.

Letter body stored in `storybook_chapters.body` (or `generated_content`).

### 5. Rendering in StorybookTab

Chapters with `anchor_type = 'letter'` render `LetterPage` instead of `LayoutRenderer`. "Regenerate letter" button available. No layout editor for letter pages.

### 6. PDF export

`storybookPdf.js` handles letter chapters: render `LetterPage` off-screen, capture with html2canvas, append as full page. Script font must be loaded before capture (same pattern as existing font handling).

---

## Files to touch

| File | Change |
|---|---|
| `Frontend/src/lib/letterTypes.js` | New — letter type config array |
| `Frontend/src/components/storybook/LetterPage.jsx` | New — fixed-layout letter renderer |
| `Frontend/src/components/tabs/StorybookTab.jsx` | Render LetterPage for letter chapters; add "Add a Letter" UI |
| `Frontend/src/components/storybook/StorybookWizard.jsx` | Add letter creation option |
| `Backend/.../storybook/StorybookController.java` | New letter generation endpoint (or extend existing) |
| `Frontend/src/lib/storybookPdf.js` | Handle letter chapter type in PDF export |

---

## Open questions (resolve at session start)

1. **Letter input storage:** Where is the user's raw input (their prompt/notes) stored? In `storybook_chapters.body` before generation, or a separate column?
2. **Re-edit flow:** After letter is generated, can the user edit the letter text directly (inline), or only via "Regenerate with new input"?
3. **Multiple letters:** Can a user have multiple letters of the same type (e.g. two pre-birth letters), or one per type?
4. **`pre_birth` requires `due_date`?** Do we gate this letter type on having a due_date set, or allow it any time (retroactive)?

---

## Verification

1. "Add a Letter" → "A Letter Before You Arrived" → enter prompt text → AI generates full letter.
2. LetterPage renders correctly in the Book tab read view.
3. PDF export includes the letter page at correct dimensions.
4. "Regenerate" with new input produces a different letter.
5. Existing chapter types are unaffected.
