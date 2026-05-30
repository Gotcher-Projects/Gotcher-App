# Storybook Feature — Context Primer

> **Purpose:** A single, accurate briefing on how the CradleHQ "Storybook" feature
> works end to end. Paste this into a new AI session before doing storybook work so
> the assistant has correct context without re-deriving it (and without the wrong
> assumptions that have bitten past sessions). Last mapped: 2026-05-30. Feature is
> at **S5.6 complete; S5.7 (book cover) next.**
>
> Companion docs in this folder: `storybook-text-layout-recommendations.html` (the
> text-fit + repetitive-opening analysis this primer was written alongside). At repo
> root: `storybook-layout-findings.html` (the S5.45 real-estate/cutoff diagnosis).

---

## 0. The five things that surprise people

1. **There is no `storybooks` table and no `Storybook` entity.** "The book" is simply
   *all `storybook_chapters` rows for a baby profile*, ordered by `sort_order` then
   `created_at`. One row = one chapter.
2. **A "chapter" is anchored to one of three things** (`anchor_type`): a `milestone`,
   a `first_time`, or a `period` (a time window). The period/wizard flow is the main one.
3. **There are THREE different AI generation paths with TWO different system prompts.**
   The "page per memory" complaint and the "every page starts with You" complaint both
   come from *one* of them — the paged path with `SINGLE_ENTRY_SYSTEM_PROMPT`.
4. **In "One Page Per Memory" mode each page is a separate, independent Claude call.**
   So pages can't vary their openings relative to each other — every call sees only its
   own memory and the same prompt. (The woven "One Story" mode is a single call.)
5. **Layout block coordinates are fractions (0–1) of a 600×800 virtual canvas**, not a
   grid. `fitText` is already a real pixel measurement (binary search), not a heuristic —
   but it only ever *shrinks* text, never grows it (this is central to the wasted-space issue).

---

## 1. Data model (PostgreSQL, JdbcTemplate — no ORM)

### `storybook_chapters` (V24, extended by V26–V32)
One row per chapter. Columns (see `StorybookService.CHAPTER_COLS`):

| Column | Meaning |
|--------|---------|
| `id`, `baby_profile_id` | PK + owner FK (ownership scoped on every query) |
| `anchor_type` | `milestone` \| `first_time` \| `period` |
| `anchor_key`, `anchor_label` | e.g. milestone key `8-2`, or a period key; label is the chapter title |
| `period_start_weeks`, `period_end_weeks` | for `period` chapters |
| `sort_order` | chapter ordering (nullable; `COALESCE(…,999999)`) |
| `body` | AI-generated prose. May contain inline `[PHOTO:journal:42]` / `[PHOTO:first_time:42]` markers |
| `status` | `unlocked` → `draft` → `published` |
| `image_url` | legacy single hero image (pre-wizard) |
| `wizard_journal_ids`, `wizard_first_time_ids` | CSV of selected source IDs (V28) |
| `supplementary_notes` | free-text extra memories from the parent (V28) |
| `photo_overrides` | JSONB map `"journal:42" → url` (V28) — photos used only in the book |
| `wizard_entry_notes` | JSONB map `"journal:42" → note` (V29) — per-entry parent memory |
| `layout_data` | JSONB layout (V30). NULL = render via legacy body renderer |
| `chapter_photos` | JSONB array of standalone uploaded photos `{key,url,label}` (V31) |
| `generated_at`, `published_at`, `created_at`, `updated_at` | timestamps |

### Other tables
- **`book_share_tokens`** (V25) — `baby_profile_id` + 64-char hex `token` for the public read-only book (`GET /book/public/{token}`).
- **`baby_profiles.book_theme`** VARCHAR(20) default `'classic'` (V32) — the book's theme preset.

> Mapped to **`ChapterResponse`** (note the field renames): `wizard_journal_ids → selectedJournalIds`, `wizard_first_time_ids → selectedFirstTimeIds`, `wizard_entry_notes → entryNotes`, `layout_data → layoutData`, `chapter_photos → chapterPhotos`.

---

## 2. Chapter lifecycle

```
unlocked ──generate──▶ draft ──publish──▶ published
   ▲                     │
   └── free users can have unlocked rows but cannot generate
       (gated on tier != 'free' AND users.ai_credits_remaining > 0)
```

Each generate call **decrements a credit before** calling Claude and **refunds it** if
the call throws (paged mode refunds per-page). Credits/tier live on the `users` table.

---

## 3. The three AI generation paths (READ THIS CAREFULLY)

All three live in `StorybookService` and call `ClaudeClient`. Model + temperature from
`application.properties`: **`anthropic.model` (currently `claude-haiku-4-5-20251001`)**,
`anthropic.temperature` (0.3).

| # | Endpoint → method | System prompt | Shape | Cost |
|---|---|---|---|---|
| 1 | `POST /storybook/generate/{id}` → `generate()` | `SYSTEM_PROMPT` (woven) | One chapter body from a milestone/first_time/period anchor. `buildPrompt()` gathers context: event window (±3 wks) for event anchors, or merged memories for period/wizard anchors. | 1 credit |
| 2 | `POST /storybook/wizard` → `wizard()` | `SYSTEM_PROMPT` (woven) | "One Story" — one woven period chapter from the user-selected journal/first-time IDs (`buildWizardPrompt()` → `appendMergedMemories`). `skipGeneration:true` just saves the row (used by paged mode). | 1 credit |
| 3 | `POST /storybook/generate-pages/{id}` → `generatePages()` | `SINGLE_ENTRY_SYSTEM_PROMPT` (page) | **"One Page Per Memory"** — loops over each selected entry and makes **one independent Claude call per memory** (`buildSingleJournalPrompt` / `buildSingleFirstTimePrompt`, `generateSingle`, 220 max tokens). Returns `[{sourceKey, body}]`. | 1 credit **per page** |

**Path 3 is the one behind both of the user's current complaints** (short pages waste
space; every page opens with "You…"). Because each page is its own call with the same
prompt, there's no cross-page awareness to vary openings or balance length.

### The two system prompts (verbatim location: `ClaudeClient.java`)
- **`SINGLE_ENTRY_SYSTEM_PROMPT`** (paths 3): *one page, second person "You did…/You were…", 1–2 short paragraphs ~60–100 words, strict no-inference rules (don't invent people/relationships/genders, use "the people who love you" if unclear), no title, no photo markers, no closing line.*
- **`SYSTEM_PROMPT`** (paths 1 & 2): *woven chapter, second person, paragraph count scales with richness (max 25), same strict no-inference rules, **emits `[PHOTO:…]` markers** when a "Photos available:" line is present, opens "by grounding the reader in a specific moment or sensory detail from the earliest entry," closes with a brief forward-looking line.*

The exact current prompt text and proposed rewrites are in
`storybook-text-layout-recommendations.html`.

---

## 4. The wizard UI flow (`StorybookWizard.jsx`)

Steps (state machine `step` 1–6):
1. **Period** — pick a time window (`STORYBOOK_PERIODS` in `lib/storybookPeriods.js`); auto-selects entries in range.
2. **Curate** — check which journal entries / first times to include (max 20); per-entry "Add photo" (crops + uploads → `photoOverrides`) and "Add a memory" note (→ `entryNotes`).
3. **Mode picker:**
   - **One Story** → `handleGenerate()` → path 2 (`wizard`) → review (step 5).
   - **One Page Per Memory** → `handleGeneratePages()` → path 2 with `skipGeneration` to save the row, then path 3 (`generate-pages`), then **builds v2 `layout_data` client-side** (one page per returned memory) → layout editor (step 6).
4. **Supplementary notes** (One Story only) → Generate.
5. **Review** (`BookChapterReview.jsx`) — publish / regenerate / "Design" (→ editor).
6. **Layout editor** (`LayoutEditor.jsx`) — both modes; also reached via `editMode`.

The page-per-memory layout it builds: text block `x0.04 y0.04 w0.92 h(0.34 if photo else 0.92)`; photo block `x0.04 y0.40 w0.92 h0.56`.

---

## 5. Layout schema (`layout_data` JSONB)

```jsonc
// v2 (multi-page — produced by paged mode and the editor)
{
  "version": 2,
  "pages": [
    {
      "id": "p-…",
      "sourceKey": "journal:42",        // which memory this page came from (or null)
      "backgroundColor": "#fff" | null, // per-page bg override (else theme bg)
      "blocks": [ /* see below */ ]
    }
  ]
}

// v1 (single page) — { "version": 1, "blocks": [...] }   (NULL = legacy body renderer)

// block — x/y/width/height are FRACTIONS (0..1) of the page, NOT a grid
{ "type": "text",    "x":0.04,"y":0.04,"width":0.92,"height":0.34,
  "content": { /* Tiptap doc */ } | "legacy string", "fontFamily": "serif"? }
{ "type": "photo",   "x":0.04,"y":0.40,"width":0.92,"height":0.56,
  "url":"…", "sourceKey":"journal:42", "label":"…" }   // object-fit: cover
{ "type": "sticker", "x":0.40,"y":0.42,"width":0.20,"height":0.15,
  "stickerKey":"heart", "color":"#9b7e5a" }            // SVG in /public/stickers/, CSS-mask tinted
```

- **Virtual canvas: 600×800 (3:4 portrait).** Both `LayoutRenderer` and `LayoutEditor`
  render at this size and CSS-`transform: scale()` to fit the container, so the editor and
  the published view match exactly. Base font = `CANVAS_W * 0.025` = 15px.

---

## 6. Frontend components & libs

### `Frontend/src/components/storybook/`
| File | Role |
|------|------|
| `StorybookWizard.jsx` | The 6-step wizard above; also `editMode`. Owns selection/photo/note state. |
| `BookChapterReview.jsx` | Step-5 review of a generated One-Story chapter (publish / regenerate / design). |
| `LayoutEditor.jsx` | Drag/resize editor (`react-rnd`). Templates (`classic`, `side-by-side`, `hero`, `gallery`, `text-only`); **Tiptap** rich text + `FormatToolbar`; sticker picker; per-page background; per-block font picker; multi-page (add/reorder); **debounced autosave** → `onSave(layoutData)` → `PATCH /storybook/{id}`. |
| `LayoutRenderer.jsx` | Renders `layout_data` (v2 carousel or v1). `RenderedText` uses `useFittedFontSize` to shrink-to-fit; renders Tiptap via `renderContentHTML` + `dangerouslySetInnerHTML`; stickers via `stickerMaskStyle`. |
| `LegacyChapterRenderer.jsx` | For chapters with **no** `layout_data`: parses `body` `[PHOTO:…]` markers (`parseBodySegments`) and renders prose + paired photos (`renderPublishedBody` / `renderDraftBody`). |

### `Frontend/src/components/tabs/StorybookTab.jsx`
The tab shell (mounted by `MemoriesTab` when `view === 'book'`). Renders the book-theme
picker (PATCH `/baby-profile/book-theme`), the "Write a Period Chapter" wizard entry, and a
`ChapterCard` per chapter. `ChapterCard` switches on status: `unlocked` (Generate),
`draft` (review/publish/edit/regenerate), `published` (themed card; `LayoutRenderer` if
`hasLayout` else `LegacyChapterRenderer`). `hasLayout = layoutData.version===2 || layoutData.blocks?.length>0`.

### `Frontend/src/lib/`
| File | Role |
|------|------|
| `fitText.js` | `useFittedFontSize(ref, baseSize, minSize, deps)` — **binary-searches the largest font (≤ baseSize, ≥ minSize=8) that fits the block's real pixel height.** Measurement-based (S5.45). **Only shrinks — never enlarges beyond `baseSize`.** |
| `tiptap.js` | `tiptapExtensions` (StarterKit minus block stuff + TextStyle + FontSize + TextAlign), `FONT_SIZES` (small/normal/large as em), `renderContentHTML`, `toTiptapDoc`, `contentToPlainText`, `isTiptapDoc`, `fontSizeKey`. |
| `bookThemes.js` | `BOOK_THEMES` = **classic, coral, midnight (dark), meadow**. Each: `bg`, `accent`, `fontClass`, `dividerChar`, `palette[5]`, optional `textColor`/`isDark`. `getTheme(key)`. |
| `stickers.js` | `STICKERS` (16 keys → `/public/stickers/<key>.svg`), `stickerMaskStyle(key,color)` (paints SVG via CSS mask), `stickerColors(theme)`. |
| `storybookPeriods.js` | `STORYBOOK_PERIODS` — fixed list of age windows `{key,label,startWeeks,endWeeks}` for the step-1 picker. |

---

## 7. REST endpoints (`StorybookController`)

| Method + path | Purpose |
|---|---|
| `GET /storybook` | All chapters for the baby (the whole book) |
| `POST /storybook/unlock` | Create an `unlocked` milestone/first_time/period chapter row |
| `POST /storybook/wizard` | Path 2 — One Story (or save row w/ `skipGeneration`) |
| `POST /storybook/generate/{id}` | Path 1 — (re)generate a chapter body |
| `POST /storybook/generate-pages/{id}` | Path 3 — One Page Per Memory |
| `PATCH /storybook/{id}` | Update `body` / `status` / `sortOrder` / `layoutData` (or `clearLayoutData`) |
| `POST /storybook/{id}/chapter-photos` | Multipart standalone photo upload (→ `chapter_photos`) |
| `DELETE /storybook/{id}` | Delete chapter |
| `GET/DELETE /storybook/share` | Create/revoke share token (plus tier only) |
| `GET /book/public/{token}` | Public read-only book (no auth) |

> **Spring error gotcha (project-wide):** an uncaught `RuntimeException` re-dispatches to
> `/error` unauthenticated → surfaces as **401, not 500**. External-service calls are wrapped
> in try/catch and mapped via `ApiError` in the controller.

---

## 8. Plan roadmap & status (`plans/storybook/`)

**Complete:** S0–S5 foundation; S5.1 (editor polish/multi-page), S5.2 (v2/reorder/edit
mode), S5.5 (stickers), S5.6 (rich text). **Needs Verification:** S5.3 (standalone photos),
S5.4 + S5.41 (theming), S5.42 (per-block fonts), S5.44 (theme polish + virtual canvas),
**S5.45 (layout real-estate & text-cutoff)**. **Not started:** S5.43 (verify theming/fonts),
**S5.7 book cover (NEXT)**, S5.8 chapter reordering, S5.9 PDF export, S7 share link UI, S8 print.

Living docs: `tech-debt.md`, `session-prompts.md` (copy-paste opening prompts per session).

> Per **CLAUDE.md**: always check a plan's **Status** first — `Complete` → stop & ask;
> `Needs Verification`/`In Progress` → confirm state with the user before coding;
> `Not started` → proceed.

---

## 9. Conventions (from project memory / CLAUDE.md)
- Discuss options & tradeoffs **before** writing code.
- Multi-session work uses `plans/<name>/sN` + `session-prompts.md`.
- Implement → mark plan **Needs Verification**; only **Complete** after the user confirms.
- **Never** add `Co-Authored-By: Claude` to commits.
- Frontend = Vite + React JSX (no TypeScript); backend = Spring Boot + raw JdbcTemplate SQL.
- When updating the Claude model/API, use the `/claude-api` skill.
```
