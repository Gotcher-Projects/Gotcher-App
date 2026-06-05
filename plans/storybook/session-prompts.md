# Storybook — Session Opening Prompts

Copy-paste the relevant block at the start of each session.

---

## Session 0 — Planning & Decisions
**Status: Complete** — decisions recorded in plans/storybook/s0-planning.md

---

## Session 1 — Paid User Flag (tier system)

```
Session 1 of storybook. Branch: feature/storybook (create from main if it doesn't exist).
Plan: plans/storybook/s1-paid-flag.md

Full-stack. Latest migration is V22. Next is V23.

Key S0 decisions driving this session:
- Use tier VARCHAR(20) ('free'/'plus'/'pro'), NOT is_paid BOOLEAN
- Also add ai_credits_remaining INT and credits_reset_at TIMESTAMPTZ in the same migration
- Teaser gating: free users see the Book tab and chapter titles, just can't generate
- Actual DTO structure: UserDto.java (not MeResponse/LoginResponse/RegisterResponse — those don't exist)
- /auth/me currently returns a bare Map — update it to return a full UserDto with tier

Backend — 1 migration + UserDto + AuthService + AuthController:
1. Backend/db/migration/V23__add_tier_to_users.sql
   — ALTER TABLE users ADD COLUMN tier VARCHAR(20) NOT NULL DEFAULT 'free'
   — ALTER TABLE users ADD COLUMN ai_credits_remaining INT NOT NULL DEFAULT 0
   — ALTER TABLE users ADD COLUMN credits_reset_at TIMESTAMPTZ
2. Backend/src/main/java/com/gotcherapp/api/auth/dto/UserDto.java — add tier field with @JsonProperty("tier")
3. Backend/src/main/java/com/gotcherapp/api/auth/AuthService.java
   — login(): add tier to SELECT, pass to UserDto
   — register(): pass "free" directly to UserDto (no re-query needed)
   — refresh(): add tier to user SELECT, pass to UserDto
4. Backend/src/main/java/com/gotcherapp/api/auth/AuthController.java
   — /auth/me: query users table by principal userId, return full UserDto with tier

Frontend — 3 files:
5. Frontend/src/lib/auth.js — include tier in stored session user object
6. Frontend/src/components/CradleHq.jsx — use tier (not isPaid); pass where needed
7. Frontend/src/components/ui/PaidGate.jsx — new component; takes tier prop; teaser/upgrade prompt for free users

Read AuthService.java, UserDto.java, and AuthController.java before writing anything.
All decisions are in the plan file.
```

---

## Session 2 — Storybook Backend

```
Session 2 of storybook. Branch: feature/storybook.
Plan: plans/storybook/s2-backend.md
Design reference: plans/storybook/design-decisions.md — READ THIS FIRST for full context.

Full-stack backend. S1 must be done (V23 migration must exist with tier + credits columns).
Latest migration is V23. Next migrations: V24 (storybook_chapters), V25 (book_share_tokens).

Key S0 decisions:
- Generation gated by tier (must be plus or pro) AND credits (ai_credits_remaining > 0)
- Per-chapter credit cost — each generate call costs 1 credit, decrement before calling Claude
- Refund credit if Claude call fails
- Free users CAN have unlocked chapter rows — they just can't generate them
- Partial regeneration fully supported — individual chapters only

Key S2 planning decisions (2026-05-03):
- Two chapter types: 'milestone'|'first_time' (event-anchored) AND 'period' (time-period)
- V24 adds period_start_weeks, period_end_weeks, sort_order columns (see schema in plan)
- Both ANTHROPIC_API_KEY and ANTHROPIC_MODEL are env-var configurable (never hardcode the key)
- Share tokens: SecureRandom hex 64 chars (not UUID)
- Claude prompt is text-only — no image URLs passed to the API

Backend — new package com.gotcherapp.api.storybook:
1. Backend/db/migration/V24__create_storybook_chapters.sql — schema in plan
2. Backend/db/migration/V25__create_book_share_tokens.sql — schema in plan
3. Backend/src/main/resources/application.properties — add anthropic.api.key + anthropic.model
4. Backend/src/main/java/com/gotcherapp/api/storybook/StorybookChapter.java — record
5. Backend/src/main/java/com/gotcherapp/api/storybook/dto/ChapterResponse.java
6. Backend/src/main/java/com/gotcherapp/api/storybook/dto/UpdateChapterRequest.java
7. Backend/src/main/java/com/gotcherapp/api/storybook/dto/UnlockRequest.java
8. Backend/src/main/java/com/gotcherapp/api/storybook/ClaudeClient.java — RestTemplate wrapper
9. Backend/src/main/java/com/gotcherapp/api/storybook/StorybookService.java
10. Backend/src/main/java/com/gotcherapp/api/storybook/StorybookController.java
11. Backend/src/main/java/com/gotcherapp/api/config/SecurityConfig.java — add /book/public/** to permitAll()

Use RestTemplate (not Anthropic Java SDK). Model configurable via anthropic.model property.
All schemas, endpoint specs, credit logic, and prompt design are in the plan file.

Read AppointmentService.java and AppointmentController.java first — same JdbcTemplate +
ownership check pattern. Also read SecurityConfig.java before adding the permitAll rule.
```

---

## Session 2.1 — Storybook Backend Verification

```
Session 2.1 of storybook. Branch: feature/storybook.
Plan: plans/storybook/s2.1-verification.md

Verification only — no new code. S2 must be complete (all backend files written).

Steps:
1. Start Docker Desktop + services
2. Run seed-demo-user.sh (now upgrades demo user to plus + 20 credits via psql at the end)
3. Follow the curl verification steps in the plan file
4. Tick off each item in the checklist
5. If anything fails, fix it before marking S2 Complete

When all checklist items pass: update s2-backend.md Status to Complete, then report back.
```

---

## Session 3.5 — AI Prompt & Algorithm Tuning

```
Session 3.5 of storybook. Branch: feature/storybook.
Plan: plans/storybook/s3.5-prompt-tuning.md

Backend only — no schema changes. Tuning the Claude prompt and generation pipeline.
S2 must be complete and verified.

Key issue: Claude makes assumptions about family structure (two parents, "your dad")
and invents emotional reactions not grounded in the journal data. Goal is tighter,
more factual output that works for any family structure.

Files to change:
- Backend/src/main/java/com/gotcherapp/api/storybook/StorybookService.java — buildPrompt()
- Backend/src/main/java/com/gotcherapp/api/storybook/ClaudeClient.java — add temperature
- Backend/src/main/resources/application.properties — add anthropic.temperature binding

Read the current buildPrompt() and SYSTEM_PROMPT in ClaudeClient before making changes.
Try variants systematically — keep old prompt commented out during experimentation.
```

---

## Session 3 — In-App Storybook View

```
Session 3 of storybook. Branch: feature/storybook.
Plan: plans/storybook/s3-in-app-view.md

Frontend only. S2 must be done (backend endpoints must be live and tested).

Key S0 decisions:
- Teaser gating: Book tab always visible; free users see chapter titles with locked Generate
- No full-tab PaidGate wrapper — show upgrade prompt inline per chapter card
- Free users also get unlock rows (chapter titles appear for them too)
- Paid users with 0 credits see disabled Generate with credit message

Files:
1. Frontend/src/components/tabs/MemoriesTab.jsx — add 'Book' option to PillNav; render StorybookTab
2. Frontend/src/components/tabs/StorybookTab.jsx — new file, full storybook view with teaser logic
3. Frontend/src/components/CradleHq.jsx — add chapters state + fetch, wire unlock calls into
   milestone toggle and first-times save handlers

Read MemoriesTab.jsx, CradleHq.jsx, and PaidGate.jsx before writing anything.
The four chapter states (unlocked/generating/draft/published) and teaser gating behavior
are all specified in the plan file.
```

---

## Session 4 — Layout Editor Planning
**Status: Complete** — decisions recorded in `plans/storybook/s4-layout-editor.md`

---

## Session 5 — Layout Editor Implementation

```
Session 5 of storybook — Layout Editor Implementation.
Plan: plans/storybook/s5-layout-editor-impl.md
Design decisions: plans/storybook/s4-layout-editor.md

All design decisions are in s4-layout-editor.md. This session is implementation only.

Order of work (follow the plan exactly):
1. V30 migration + backend DTO/service/controller (layout_data read/write)
2. npm install react-rnd in Frontend
3. Extract LegacyChapterRenderer.jsx from StorybookTab.jsx
4. Build LayoutEditor.jsx (template picker → free-form canvas with react-rnd)
5. Add step 5 to StorybookWizard.jsx
6. Build LayoutRenderer.jsx + branch in StorybookTab.jsx

Read s4-layout-editor.md and s5-layout-editor-impl.md before writing any code.
Read ChapterResponse.java, StorybookService.java, StorybookController.java, and
StorybookWizard.jsx before touching those files.
```

---

## Session 5.1 — Layout Editor Polish & Multi-Page Chapters

```
Session 5.1 of storybook — Layout Editor Polish & Multi-Page Chapters.
Plan: plans/storybook/s5.1-layout-editor-polish.md
Branch: journal-updates

Two phases — do Phase A (quick fixes) before touching Phase B.

Phase A — three small fixes in LayoutEditor.jsx:
1. Classic paragraph formatting in text block display mode (split on \n\n, font-serif paragraphs)
2. Photo drag/click conflict — remove onClick from photo block, add corner Camera button
3. Strip [PHOTO:...] markers from text content when initializing blocks from chapter.body

Phase B — multi-page chapters (bigger lift):
1. Layout data v2 format: { version: 2, pages: [{ id, sourceKey, blocks }] }
2. LayoutRenderer: detect version === 2, render page-flip carousel with prev/next + swipe
3. LayoutEditor: page tabs + page navigation bar + "Add page" button
4. StorybookWizard: mode picker after entry selection ("One Story" vs "One Page Per Memory")
5. Backend: new generate-pages endpoint (StorybookController + StorybookService + ClaudeClient)

No DB migration needed for Phase B — format change is within existing layout_data TEXT column.
Existing v1 layouts and chapters without layout_data must continue to work unchanged.

Read s5.1-layout-editor-polish.md fully before writing any code.
Read LayoutEditor.jsx, LayoutRenderer.jsx, StorybookWizard.jsx before touching those files.
```

---

## Session 5.2 — Layout Editor v2: Page Reordering, Edit Mode & Standalone Photos

```
Session 5.2 of storybook — Layout Editor v2.
Plan: plans/storybook/s5.2-layout-editor-v2.md
Branch: TBD (cut from journal-updates or main after S5.1 merges)
Depends on: S5.1 complete and verified.

Implement in order:
1. Edit mode for published layout chapters (Feature 2) — route the Edit button to the layout editor
   for hasLayout chapters; add editMode + initialChapter props to StorybookWizard
2. Page reordering (Feature 1) — Move Left / Move Right buttons in LayoutEditor page nav
3. Standalone photo uploads (Feature 3) — upload button in PhotoTray, V31 migration + backend endpoint

Read s5.2-layout-editor-v2.md fully before writing any code.
Read LayoutEditor.jsx, StorybookWizard.jsx, StorybookTab.jsx, MemoriesTab.jsx before touching them.
```

---

## Session 5.3 — Standalone Photo Uploads

```
Session 5.3 of storybook — Standalone Photo Uploads.
Plan: plans/storybook/s5.3-standalone-photos.md
Branch: journal-updates
Depends on: S5.2 complete and verified.

Full-stack. Latest migration is V30. Next is V31.

Backend first, then frontend:
1. V31__chapter_photos.sql — ALTER TABLE chapters ADD COLUMN chapter_photos JSONB
2. ChapterResponse.java — add chapterPhotos field
3. StorybookService.java — read/write chapter_photos; uploadChapterPhoto() method
4. StorybookController.java — POST /storybook/{id}/chapter-photos (multipart)
5. LayoutEditor.jsx — upload button in PhotoTray; include chapterPhotos in availablePhotos memo

Read ChapterResponse.java, StorybookService.java, StorybookController.java, and LayoutEditor.jsx
before writing any code.
```

---

## Session 5.4 — Book Theming

```
Session 5.4 of storybook — Book Theming.
Plan: plans/storybook/s5.4-book-theming.md
Branch: journal-updates
Depends on: S5.3 complete.

Full-stack. Latest migration is V31. Next is V32.

Two features: book-level theme preset (stored on baby_profiles) +
per-page background color override (stored in layout_data).

Backend first, then frontend:
1. V32__book_theme.sql — add book_theme VARCHAR(20) to baby_profiles
2. BabyProfile DTO + service + controller — add bookTheme read/write + PATCH endpoint
3. bookThemes.js — BOOK_THEMES constant + getTheme() helper
4. StorybookTab.jsx — theme picker swatch row, PATCH on select
5. LayoutRenderer.jsx — apply theme bg + per-page backgroundColor override
6. LayoutEditor.jsx — canvas reflects theme, per-page color swatches in page nav

Finalize theme preset names/colors/fonts at implementation time (4–5 presets).
Read the plan fully before writing any code.
```

---

## Session 5.5 — Stickers & Decorative Elements

```
Session 5.5 of storybook — Stickers & Decorative Elements.
Plan: plans/storybook/s5.5-stickers.md
Branch: journal-updates
Depends on: S5.3 or S5.4 complete.

Frontend only. No backend changes. No DB migration.

1. Create Frontend/public/stickers/ — add SVG files for initial sticker set (~16)
2. Frontend/src/lib/stickers.js — STICKERS constant
3. LayoutEditor.jsx — "Add Sticker" toolbar button + StickerPicker bottom sheet + StickerBlock render
4. LayoutRenderer.jsx — handle sticker block type

Finalize exact sticker set at implementation time.
Read LayoutEditor.jsx and LayoutRenderer.jsx before writing any code.
```

---

## Session 5.6 — Rich Text (Tiptap)

```
Session 5.6 of storybook — Rich Text (Tiptap).
Plan: plans/storybook/s5.6-rich-text.md
Branch: journal-updates
Depends on: S5.3+ complete and layout editor stable.

Frontend only. No backend changes. No DB migration needed.

1. npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-text-align
2. LayoutEditor.jsx — replace textarea in TextBlock with Tiptap EditorContent + formatting toolbar
3. LayoutRenderer.jsx — detect string vs Tiptap JSON content, render accordingly

Resolve open questions (toolbar placement, font size mapping) before writing code.
Read LayoutEditor.jsx and LayoutRenderer.jsx fully before touching them.
```

---

## Session 5.7 — Book Cover Page

```
Session 5.7 of storybook — Book Cover Page.
Plan: plans/storybook/s5.7-book-cover.md
Branch: journal-updates
Depends on: S5.4 (theming) complete.

Full-stack. Latest migration is V32. Next is V33.

1. V33__book_cover.sql — add cover_photo_url + cover_subtitle to baby_profiles
2. BabyProfile DTO + service — add cover fields to read/write
3. PATCH /baby-profile — extend to accept coverPhotoUrl + coverSubtitle
4. POST /baby-profile/cover-photo — multipart Cloudinary upload
5. Frontend/src/components/storybook/BookCover.jsx — new component
6. StorybookTab.jsx — render BookCover above chapter list + edit actions

Read BabyProfileService, BabyProfileController, and StorybookTab.jsx before writing code.
```

---

## Session 5.8 — Chapter Reordering

```
Session 5.8 of storybook — Chapter Reordering.
Plan: plans/storybook/s5.8-chapter-reordering.md
Branch: journal-updates
Depends on: S5.3+ complete.

Full-stack. Latest migration is V33 (or whatever the current last is). Next is V34.

1. V34__chapter_order_index.sql — add order_index INT to chapters
2. StorybookService.java — sort by order_index, add reorderChapters()
3. StorybookController.java — PUT /storybook/order endpoint
4. npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities (if not already present)
5. StorybookTab.jsx — drag-to-reorder with @dnd-kit, optimistic update, PUT on drop

Read StorybookService.java, StorybookController.java, and StorybookTab.jsx before writing code.
```

---

## Deferred — Shareable Book Link

```
Deferred storybook session — Shareable Book Link. Branch: feature/storybook.
Plan: plans/storybook/sDeferred-share-link.md

Frontend only. Depends on the scrapbook builder rewrite (S7–S10). Backend public
endpoint already built in S2.

Key decisions:
- Share section visible to plus and pro users only (check tier !== 'free')
- Free users do not see the share section
- Public page renders chapters via LayoutRenderer if layout_data present, else legacy renderer

Files:
1. Frontend/src/components/tabs/StorybookTab.jsx — add Share section at the bottom
2. Frontend/src/App.jsx — add /book/:token route outside the auth gate
3. Frontend/src/components/PublicBookPage.jsx — new file, read-only public renderer

Read App.jsx first to understand the current routing structure and auth gate placement.
Read share.js to reuse the clipboard fallback pattern.
Check deployment-guide.html to confirm Caddy catch-all is configured for SPA routing.
All layout, privacy, and routing decisions are in the plan file.
```

---

## Session 5.46 — Prose Variety, Page Fill & Batched Page Generation

```
Session 5.46 of storybook — Prose Variety, Page Fill & Batched Page Generation.
Plan: plans/storybook/s5.46-prose-variety-and-fill.md
Context primer: plans/storybook/storybook-context.md  (READ FIRST)
Rationale: plans/storybook/storybook-text-layout-recommendations.html
Branch: journal-updates
Depends on: S5.45.

Do Phase A first (resolves both complaints); Phase B is staged polish.

Phase A:
1. ClaudeClient.java — add BATCH_PAGES_SYSTEM_PROMPT + generatePagesBatch(); remove
   SINGLE_ENTRY_SYSTEM_PROMPT/generateSingle. Add [CLAUDE-DEBUG] SLF4J logging of system
   prompt, user prompt, and response (temporary — removed in S9).
2. StorybookService.generatePages() — one batched call instead of N calls; KEEP per-page
   credit charge (totalEntries); refund all on failure.
3. GeneratedPageResponse — add pullQuote.
4. fitText.js — add maxSize (grow-to-fill); LayoutRenderer + LayoutEditor pass the same
   ceiling; vertically center short text.

Confirm the batched-call model decision (keep haiku + raise max_tokens, vs. bump model)
after a first test run. Read ClaudeClient.java, StorybookService.java, StorybookWizard.jsx,
LayoutRenderer.jsx, LayoutEditor.jsx, fitText.js before writing code.
```

---

## Session 6.1 — Scrapbooking Foundation

```
Session 6.1 of storybook — Scrapbooking Foundation: Content Storage + Template Contracts.
Plan: plans/storybook/s6.1-foundation.md
Branch: TBD (cut from journal-updates after S5.9 verified)
Depends on: S5.9 complete and verified.

Full-stack. Check the current latest migration and use the next number.

Backend first, then frontend:
1. VXX__chapter_generated_content.sql — ALTER TABLE storybook_chapters ADD COLUMN generated_content JSONB
2. GeneratedPageContent.java — new DTO record (body, pullQuote, title, caption)
3. GeneratedPageResponse.java — add title + caption fields
4. ClaudeClient.java — update BATCH_PAGES_SYSTEM_PROMPT to produce title + caption; update JSON format line
5. StorybookService.java — generatePages() saves generated_content keyed by sourceKey; add to CHAPTER_COLS
6. ChapterResponse.java — add generatedContent field (Map<String, GeneratedPageContent>)
7. LayoutEditor.jsx — add memoryCount/minPhotos/maxPhotos to all existing templates; add contentSource
   to all block definitions; add 10 new templates (see plan for all layouts and coordinates)

Read ClaudeClient.java, StorybookService.java, GeneratedPageResponse.java, ChapterResponse.java,
and LayoutEditor.jsx before writing any code.
All template coordinates and slot contract definitions are in the plan file.
```

---

## Session 6.2 — Wizard Grouping Step

```
Session 6.2 of storybook — Scrapbooking: Wizard Grouping Step.
Plan: plans/storybook/s6.2-wizard-grouping.md
Branch: TBD (same branch as S6.1 or cut after S6.1 merges)
Depends on: S6.1 complete and verified.

Frontend-heavy, with backend changes to generate-pages endpoint.

Order of work:
1. StorybookController.java + StorybookService.java — update POST /storybook/generate-pages/{id}
   to accept optional groups body; build layout_data from groups + template definitions
2. ClaudeClient.java — adjust prompt for multi-memory groups (shorter body per memory)
3. StorybookWizard.jsx — update Step 3 label; add Step 3.5 PageGroupingStep
4. PageGroupingStep.jsx (new) — two-panel grouping UI; auto-suggest on mount; drag-to-group;
   template picker per page; photo slot assignment
5. storybookGrouping.js (new) — auto-suggest algorithm (extracted for reuse in S6.3)

Check if @dnd-kit is installed (added in S5.8 for chapter reordering); install if not.

Read StorybookService.java, StorybookController.java, ClaudeClient.java, and StorybookWizard.jsx
before writing any code. Full UI spec and endpoint changes are in the plan file.
```

---

## Session 6.3 — Auto-Gen Mode + Polish

```
Session 6.3 of storybook — Scrapbooking: Auto-Gen Mode + Polish.
Plan: plans/storybook/s6.3-autogen.md
Branch: TBD (same branch as S6.2 or cut after S6.2 merges)
Depends on: S6.2 complete and verified.

Frontend only. No backend changes or migrations.

1. StorybookWizard.jsx — add "Memory Pages — Auto" option to Step 3; auto-gen flow builds
   pageGroups via storybookGrouping.js and calls generate-pages without showing Step 3.5
2. LayoutEditor.jsx — content preservation in applyTemplate(): read from chapter.generatedContent
   keyed by sourceKey instead of always using chapter.body; fallback to cleanBody(chapter.body)
3. LayoutRenderer.jsx — backward compat: read sourceKeys?.[0] ?? sourceKey on pages
4. Polish + edge cases listed in the plan

Read LayoutEditor.jsx, LayoutRenderer.jsx, and StorybookWizard.jsx before writing any code.
```

---

## Scrapbook Builder Rewrite (S7–S10)

Direction & decisions: `plans/storybook/s6.4-improvements.md`. Quick Build preview reference:
`plans/storybook/s6.4-grouping-mockup.html`. Replaces LayoutEditor with a fixed-slot builder;
generate-first ordering; removes the One Story path; no back-compat (old chapters deleted).

### Session 7 — Builder Shell
```
Session 7 of storybook — Scrapbook Builder I: Shell, Memory Panel, Fixed-Slot Canvas.
Plan: plans/storybook/s7-builder-shell.md
Depends on: S6.1–S6.3 verified.

New ScrapbookBuilder.jsx: two-panel full-screen. Left = memory cards (AI title/body + photo
thumb, grouped per entry). Right = fixed-slot page canvas reusing the LayoutRenderer model.
Visual template picker (thumbnails). Add/remove/reorder pages. Read-only render only — no
placement or editing yet. Route the chapter Edit action at the new builder for verification.
Read LayoutEditor.jsx, LayoutRenderer.jsx, storybookGrouping.js, StorybookTab.jsx first.
```

### Session 8 — Place Content + Photos
```
Session 8 of storybook — Scrapbook Builder II: Place Content + Photos.
Plan: plans/storybook/s8-builder-placement.md
Depends on: S7 verified.

Drag-and-drop + click-to-place memories/photos into slots (@dnd-kit). Text slots fill from
generatedContent per contentSource.piece; photo slots via PhotoTray + upload. Empty-slot
affordances. Debounced autosave of layout_data as draft. Read ScrapbookBuilder.jsx,
storybookGrouping.js, LayoutEditor.jsx (PhotoTray/PhotoBlock) first.
```

### Session 9 — Inline Editing + Stickers + Publish
```
Session 9 of storybook — Scrapbook Builder III: Inline Editing, Stickers, Publish.
Plan: plans/storybook/s9-builder-editing.md
Depends on: S8 verified.

Extract + reuse RichTextEditor + FormatToolbar (font, size S/M/L, align, bold, italic, edit
content). Extract the font-picker overlay. Stickers (StickerBlock + picker). Per-page bg.
Publish via PATCH status. Read LayoutEditor.jsx, tiptap.js, stickers.js, fitText.js first.
```

### Session 10 — Cut Over + Remove Legacy (frontend) — DONE, needs verification
```
Session 10 of storybook — Cut Over: Generate-First Wizard + Remove Legacy Paths.
Plan: plans/storybook/s10-cutover.md
Depends on: S7–S9 verified.

Generate-first wizard. Step 3 = two paths (Guided → ScrapbookBuilder seeded; Quick Build →
QuickBuildPreview → Modify opens builder, Publish sets status). One Story removed. TEMPLATES
extracted to lib/storybookTemplates.js. Deleted LayoutEditor.jsx, PageGroupingStep.jsx,
BookChapterReview.jsx + react-rnd. New QuickBuildPreview.jsx.
(Destructive backend/DB + StorybookTab legacy-render removal split to S10.1.)
```

### Session 10.1 — Cut-Over Cleanup (destructive)
```
Session 10.1 of storybook — Remove legacy backend + old chapters.
Plan: plans/storybook/s10.1-cleanup.md
Depends on: S10 verified.

Remove StorybookTab classic body rendering/editing + LegacyChapterRenderer. Backend: remove
POST /storybook/generate, single-narrative generation, ClaudeClient.SYSTEM_PROMPT/generateChapter
(keep batch). Migration V35 to delete pre-rewrite (non-v2) chapters; update seed. Grep for dead
imports. Destructive — confirm before running the migration.
Read StorybookTab.jsx, the storybook backend, LegacyChapterRenderer.jsx first.
```

### Session 11 — "Already in the Book" Indicators
```
Session 11 of storybook — Builder: "Already in the Book" indicators.
Plan: plans/storybook/s11-used-indicators.md
Depends on: S8 verified.

Show in the left Memories panel which pieces are already placed in the chapter. Derive used-state
from pages (text/photo block.sourceKey) — no backend. Per-piece badges on the text row + photo
thumb; optional card roll-up and "X of Y placed" count. Present 2–3 design options before coding;
keep used pieces still placeable. Read ScrapbookBuilder.jsx first.
```

### Session 12 — Templates, Photo Cropping & Polish (discuss first)
```
Session 12 of storybook — Templates, photo cropping & general polish.
Plan: plans/storybook/s12-templates-photos-polish.md
Depends on: S8–S10 verified.

DISCUSSION-FIRST session — decide before coding (feedback_discuss_before_coding). Three areas:
(1) template adjustments (add/remove/re-proportion in lib/storybookTemplates.js);
(2) photo picker + cropping — today the wizard crops to a fixed aspect, PhotoTray uploads with no
crop, and placed photos are object-cover with no per-slot control; decide crop-to-slot vs focal
point vs unify upload cropping; (3) Michael's general changes (TBD). Capture decisions in the plan,
then scope tasks (S12.1+). Likely the last Phase 1 session before Phase 2.
Read lib/storybookTemplates.js, PhotoTray.jsx, lib/imageUtils.jsx, lib/bookCanvas.jsx first.
```

---

## Deferred — Print-on-Demand
**Note:** Needs its own planning session before implementation — see `plans/storybook/sDeferred-print.md` for open questions that must be resolved first.

---

## Deferred — Remove Temporary Claude Logging

```
Deferred storybook session — Remove temporary Claude logging.
Plan: plans/storybook/sDeferred-remove-claude-logging.md
Branch: journal-updates
Depends on: S5.46 verified and batched generation trusted.

Remove the [CLAUDE-DEBUG] logging added in S5.46 from ClaudeClient.java (and anywhere else
grep finds it). Confirm no prompt/response bodies are logged anymore. Read ClaudeClient.java
first.
```
