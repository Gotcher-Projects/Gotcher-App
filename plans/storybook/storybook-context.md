# Storybook Feature — Context Primer

> **Purpose:** A single, accurate briefing on how the CradleHQ "Storybook" (memory-book)
> feature works end to end. Paste this into a new AI session before doing storybook work so
> the assistant has correct context without re-deriving it.
>
> **Last verified against commit `4dc23e9`** (branch `pregnancy-updates`, 2026-06-21).
> This rewrite replaces the pre-rewrite primer that described the old multi-path AI
> generator, `LayoutEditor`, stickers, and the sharing endpoints — all since removed.

---

## 0. The things that surprise people

1. **There is no `storybooks` table and no `Storybook` entity.** "The book" is simply
   *all `storybook_chapters` rows for a baby profile*, ordered by `sort_order` then
   `created_at`. One row = one chapter.
2. **There is exactly ONE AI generation path now.** `POST /storybook/generate-pages/{id}`
   → `generatePages()` → a single **batched** `claudeClient.generatePagesBatch()` call that
   returns every page in one shot. (The old 3-paths / 2-prompts / per-memory-loop design and
   the `POST /storybook/generate/{id}` endpoint are gone.)
3. **Generation and layout are decoupled.** The AI only produces *text* (`generated_content`,
   a per-memory map of `{body, pullQuote, title, caption}`). Arranging that text + photos onto
   pages is done entirely client-side in the **builder** (`ScrapbookBuilder`).
4. **Chapters are created only by the wizard, as `anchor_type = 'period'`.** The old
   `/storybook/unlock` endpoint (which created `milestone` / `first_time` rows) was removed.
   The `anchor_type` column still allows all three values for legacy rows, but the live flow
   only writes `period`.
5. **Layout block coordinates are fractions (0–1) of a 600×800 virtual canvas**, not a grid.
   `fitText` is a real pixel measurement (binary search) that **both shrinks and grows** text
   to fill its fixed box (up to a per-caller ceiling, default = no growth).

---

## 1. Data model (PostgreSQL, JdbcTemplate — no ORM)

### `storybook_chapters` (V24, extended by V26–V34)
One row per chapter. Columns (see `StorybookService.CHAPTER_COLS`):

| Column | Meaning |
|--------|---------|
| `id`, `baby_profile_id` | PK + owner FK (ownership scoped on every query) |
| `anchor_type` | `milestone` \| `first_time` \| `period` — **live flow only writes `period`** |
| `anchor_key`, `anchor_label` | period key + the chapter title/label |
| `period_start_weeks`, `period_end_weeks` | the period window |
| `sort_order` | chapter ordering (nullable; `COALESCE(…,999999)`) |
| `body` | legacy AI prose (pre-builder). May contain inline `[PHOTO:journal:42]` markers. Not produced by the current flow |
| `status` | `unlocked` → (`draft`) → `published` (see §2) |
| `image_url` | legacy single hero image |
| `wizard_journal_ids`, `wizard_first_time_ids` | CSV of selected source IDs (V28) |
| `supplementary_notes` | free-text extra memories from the parent (V28) |
| `photo_overrides` | JSONB map `"journal:42" → url` (V28) — photos used only in the book |
| `wizard_entry_notes` | JSONB map `"journal:42" → note` (V29) — per-entry parent memory |
| `layout_data` | JSONB layout (V30). NULL = no layout yet |
| `chapter_photos` | JSONB array of standalone uploaded photos `{key,url,label}` (V31) |
| `generated_content` | **JSONB map `sourceKey → {body, pullQuote, title, caption}`** (V34) — the AI output the builder draws from |
| `generated_at`, `published_at`, `created_at`, `updated_at` | timestamps |

### Other tables
- **`book_share_tokens`** (V25) — retained in the DB but **unused**: the sharing feature and
  its endpoints were removed (see `plans/storybook-and-pregnancy-review-fixes/s2`).
- **`baby_profiles.book_theme`** VARCHAR(20) default `'classic'` (V32) — the book's theme preset.

> Mapped to **`ChapterResponse`** (field renames): `wizard_journal_ids → selectedJournalIds`,
> `wizard_first_time_ids → selectedFirstTimeIds`, `wizard_entry_notes → entryNotes`,
> `layout_data → layoutData`, `chapter_photos → chapterPhotos`, `generated_content → generatedContent`.

---

## 2. Chapter lifecycle

```
(wizard creates row) ──▶ unlocked ──build + Publish──▶ published
```

- The **wizard** inserts the period row with `status = 'unlocked'` (`StorybookService.wizard`).
- `generatePages()` writes `generated_content` but does **not** change status.
- The **builder** autosaves `layout_data` via `PATCH /storybook/{id}` (status unchanged), and
  **Publish** sets `status = 'published'` + `published_at`.
- `draft` is part of the status vocabulary but the current wizard→builder flow goes
  `unlocked → published`; the UI groups any non-`published` chapter as "Draft / unlocked"
  (`StorybookTab.ChapterCard`).

**Credits:** `generatePages` **charges `N` credits up front** (N = number of selected memories)
in a single atomic conditional `UPDATE` (gates + decrements together — TOCTOU-safe), and
**refunds all N** if the Claude call or the JSON parse throws. Free tier is rejected before any
charge. Credits/tier live on the `users` table.

---

## 3. The AI generation path

`POST /storybook/generate-pages/{id}` → `StorybookService.generatePages()`:

1. Gate on tier (`free` → 403) and load the chapter's selected journal/first-time IDs.
2. Build a **single** user prompt listing every selected memory in date order, each tagged with
   its `sourceKey` (`buildBatchPagesPrompt`). Memories that share a printed page are tagged
   `[GROUP]` so the model writes a shorter body for them.
3. Charge credits, then **one** call: `claudeClient.generatePagesBatch(prompt, maxTokens)`
   (`maxTokens = min(800 + N*320, 8000)`).
4. Parse the JSON `{ "pages": [ { sourceKey, body, pullQuote, title, caption } ] }`
   (`extractJson` tolerates prose/fences), persist it to `generated_content`, and return the list.

Model + temperature from `application.properties`: **`anthropic.model`
(`claude-haiku-4-5-20251001` default)**, `anthropic.temperature` (0.3).

The system prompt is **`BATCH_PAGES_SYSTEM_PROMPT`** in `ClaudeClient.java` (verbatim): one page
per memory; warm 2nd-person voice; **every page must open differently** (never "You…" / the
baby's name); 90–160 words (40–70 for `[GROUP]`); strict no-inference rules (never invent
people/relationships/genders — use "the people who love you" when unsure); also emits
`pullQuote` / `title` / `caption` per page. JSON only.

> **Note:** `ClaudeClient.callClaude` still has a temporary `[CLAUDE-DEBUG]` logger that prints
> full prompts + responses (personal journal content). Removal is tracked in
> `plans/storybook/sDeferred-remove-claude-logging.md` — out of scope for the docs pass.

---

## 4. The wizard UI flow (`StorybookWizard.jsx`)

State machine `step`; the live path is **1 → 2 → 3 → 6** (steps 4/5 of the old design are gone
along with `BookChapterReview`):

1. **Period** — pick a time window (`STORYBOOK_PERIODS` in `lib/storybookPeriods.js`); auto-selects
   entries in range.
2. **Curate** — check which journal entries / first times to include (max 20); per-entry "Add
   photo" (crops + uploads → `photoOverrides`) and "Add a memory" note (→ `entryNotes`).
3. **Mode picker — both paths generate first, then open the builder (step 6):**
   - **Scrapbook** (`handleStartPath('scrapbook')`, `seed:false`) — generates content, opens the
     builder with **one blank page**; the freshly generated content is attached so the memory
     panel can place it manually.
   - **Quick Build** (`handleStartPath('quick')`, `seed:true`) — generates content, then
     **auto-arranges** it into pages via `autoSuggestGroups` + `buildGroupedLayoutData`, saves the
     `layout_data`, and opens the builder pre-filled.
6. **Builder** (`ScrapbookBuilder`) — arrange/edit/publish (see §6). Also reached via the chapter
   "Edit" action in `StorybookTab`.

`runGenerateFirst(seed)` orchestrates: `wizard` (save row) → `generate-pages` → optional
`buildGroupedLayoutData` → `PATCH layoutData`.

---

## 5. Layout schema (`layout_data` JSONB) + the render model

```jsonc
// v2 (multi-page — the only shape the builder produces)
{
  "version": 2,
  "pages": [
    {
      "id": "p-…",
      "sourceKeys": ["journal:42", …],   // memories this page came from
      "templateId": "classic" | null,    // the chosen template (or null)
      "backgroundColor": "#fff" | null,  // per-page bg override (else theme bg)
      "blocks": [ /* see below */ ]
    }
  ]
}
// v1 (single page) — { "version": 1, "blocks": [...] }. NULL layout_data = page has no layout yet.
// initPages() folds v1/empty into a single v2 page on load (lib/storybookLayout.js).

// block — x/y/width/height are FRACTIONS (0..1) of the page, NOT a grid
{ "type": "text",   "x":0.05,"y":0.04,"width":0.90,"height":0.36,
  "content": { /* Tiptap doc */ }, "fontFamily": "serif"?, "suppressDropCap": true?,
  "sourceKey": "journal:42"? }
{ "type": "photo",  "x":0.05,"y":0.44,"width":0.90,"height":0.52,
  "url":"…", "sourceKey":"journal:42", "label":"…", "crop": {x,y,width,height}? }
{ "type": "l-wrap", "x":0.04,"y":0.04,"width":0.92,"height":0.92,
  "content": { /* Tiptap doc */ }, "url":"…"?, "crop":…?,
  "sourceKey": "journal:42"?,        // owns the TEXT provenance
  "photoSourceKey": "journal:42"? }  // owns the PHOTO provenance (separate key!)
```

- **`l-wrap`** is a single cohesive text block that flows around a photo floated into its
  top-right ~47% corner, producing a true L-shape (one container, one fitted font size). It
  tracks text vs photo provenance on **two separate keys** (`sourceKey` / `photoSourceKey`).
- **`moment_hero`** (templates with `renderer: 'moment_hero'`) is a bespoke polaroid "hero page"
  rendered by `MomentHeroCanvas`, **not** by the generic block renderer. Its blocks carry fixed
  **role ids** (`badge`/`title`/`date`/`photo`/`note`/`attrib`) that the canvas looks up by id —
  see the contract comments in `storybookTemplates.js` and `MomentHeroCanvas.jsx`.
- **Virtual canvas: 600×800 (3:4 portrait).** Both the builder and `LayoutRenderer` render at this
  size and CSS-`transform: scale()` to fit (`useCanvasScale`), so editor and published view match.
  Base font = `CANVAS_W * 0.025` = 15px; `useFittedFontSize` fits each block to its box.

---

## 6. Frontend components & libs

### `Frontend/src/components/storybook/`
| File | Role |
|------|------|
| `StorybookWizard.jsx` | The 1→2→3→6 wizard (§4). Owns selection/photo/note state; generate-first for both paths. |
| `ScrapbookBuilder.jsx` | **The builder.** Shell: page/placement state, drag + click-to-place, autosave, publish. Renders a `MemoryPanel`, the canvas (`Slot`s or `MomentHeroCanvas`), `TemplateSheet`, `PhotoTray`. |
| `MemoryPanel.jsx` | Left panel: the chapter's memory pieces (`DraggablePiece` / `MemoryCard`), draggable + tap-to-select. |
| `Slot.jsx` | One droppable/editable block slot (text → `RichTextEditor`; photo → tray/re-crop; `l-wrap`). Plus `SlotPlaceholder` / `LWrapTextPlaceholder`. |
| `TemplateSheet.jsx` | Template picker bottom-sheet + thumbnails (`TemplateThumb` / `MomentHeroThumb`). |
| `MomentHeroCanvas.jsx` | Renders the `moment_hero` polaroid layout (role-id blocks); used in the builder (interactive) and read-only (published/PDF). |
| `LayoutRenderer.jsx` | Read-only render of `layout_data` for published chapters + PDF (via `bookCanvas` helpers). |
| `BookCover.jsx` | The book cover (title/subtitle + cover photo). |
| `PhotoTray.jsx` | Bottom-sheet photo chooser/uploader for a slot. |
| `RichTextEditor.jsx`, `FormatToolbar.jsx`, `FontPicker.jsx` | Tiptap inline editor + its format toolbar + per-block font picker. |

> **Removed (don't look for them):** `LayoutEditor`, `BookChapterReview`, `LegacyChapterRenderer`,
> and `lib/stickers.js` / all sticker UI.

### `Frontend/src/lib/`
| File | Role |
|------|------|
| `bookCanvas.jsx` | **The single render model.** `CANVAS_W/H`, `BASE_FONT`, `FONT_MAP`/`FONT_OPTIONS`/`REVERSE_FONT_MAP`, `RenderedText`, `LWrapBlock`, `SlotImage`, `blockBoxStyle`, `cropStyle`, `renderBlocks`, `useCanvasScale`. |
| `storybookLayout.js` | Pure builder helpers: `splitTextParts`, `migrateBlock`, `initPages` (v1/empty → v2 fold), `buildLayoutData`, `makeId`/`makePageId`. Unit-tested (`test/storybookLayout.test.js`). |
| `storybookGrouping.js` | `buildMemoryList`, `autoSuggestGroups`, `buildGroupedLayoutData`, `extractPieceText`. The Quick-Build auto-arrange + the memory list the builder shows. |
| `storybookTemplates.js` | `TEMPLATES` — 15 fixed templates (normalized block boxes + `contentSource`). Includes `l-wrap` + the two `moment_hero` role-id templates. |
| `storybookText.js` | `cleanBodyText(s)` — strips `[PHOTO:…]` markers + collapses blank lines. One copy, used everywhere. |
| `tiptap.js` | `tiptapExtensions`, `FONT_SIZES`, `toTiptapDoc`, `renderContentHTML`, `contentToPlainText`, `isTiptapDoc`, `fontSizeKey`. |
| `fitText.js` | `useFittedFontSize(ref, base, min, deps, max)` — binary-search fit; shrinks long text (≥ min) and grows short text up to `max` (default `max === base` = shrink-only). |
| `bookThemes.js` | `BOOK_THEMES` (classic, coral, midnight, meadow) + `getTheme(key)`. |
| `storybookPeriods.js` | `STORYBOOK_PERIODS` — age windows for the step-1 picker. |
| `storybookPdf.js` | `generateStorybookPdf` — html2canvas + jsPDF export of published chapters (`captureElement`). |

### `Frontend/src/components/tabs/StorybookTab.jsx`
Tab shell (mounted by `MemoriesTab` when `view === 'book'`): book-theme picker (PATCH
`/baby-profile/book-theme`), the wizard entry, PDF export of published chapters, and a
`ChapterCard` per chapter. `ChapterCard` switches on status: `published` (themed card via
`LayoutRenderer`) vs draft/unlocked (Edit → builder, Publish, Delete).

---

## 7. REST endpoints (`StorybookController`)

| Method + path | Purpose |
|---|---|
| `GET /storybook` | All chapters for the baby (the whole book) |
| `PUT /storybook/order` | Reorder chapters (`{orderedIds:[…]}`) |
| `POST /storybook/wizard` | Create/update the period chapter row from the wizard selection |
| `POST /storybook/generate-pages/{id}` | The AI generation path — batched page content (§3) |
| `PATCH /storybook/{id}` | Update `body` / `status` / `sortOrder` / `layoutData` (or `clearLayoutData`) |
| `POST /storybook/{id}/chapter-photos` | Multipart standalone photo upload (→ `chapter_photos`; key `upload:<uuid>`) |
| `DELETE /storybook/{id}` | Delete chapter |

> **Removed:** `/storybook/unlock`, `/storybook/generate/{id}`, `/storybook/share`,
> `/book/public/{token}` (sharing + the old single-chapter generator).

> **Spring error gotcha (project-wide):** an uncaught `RuntimeException` re-dispatches to
> `/error` unauthenticated → surfaces as **401, not 500**. External-service calls are wrapped in
> try/catch; controllers map errors via `ApiError` (and `ApiExceptionHandler`).

---

## 8. Security & ownership

Every query is scoped by `baby_profile_id`. The wizard additionally **rejects** selections that
reference another tenant's journal/first-time IDs (`assertSelectionsOwned`), and
`buildBatchPagesPrompt` re-scopes its reads by `baby_profile_id` as defense-in-depth (the s3 IDOR
fix). Upload endpoints validate content-type + size (`ImageUploadService.imageValidationError`).

---

## 9. Conventions (from project memory / CLAUDE.md)
- Discuss options & tradeoffs **before** writing code; never invent unrequested scope.
- Multi-session work uses `plans/<name>/sN` + `session-prompts.md`.
- Implement → mark plan **Needs Verification**; only **Complete** after the user confirms.
- **Never** add `Co-Authored-By: Claude` to commits.
- Frontend = Vite + React JSX (no TypeScript); backend = Spring Boot + raw JdbcTemplate SQL.
- When updating the Claude model/API, use the `/claude-api` skill.
