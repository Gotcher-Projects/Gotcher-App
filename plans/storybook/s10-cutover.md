# S10 — Cut Over: Generate-First Wizard + Remove Legacy Paths

**Status: Needs Verification** (frontend cut-over landed; destructive cleanup split to S10.1)
**Branch:** same as S7
**Depends on:** S7–S9 complete and verified
**Roadmap:** builder-rewrite roadmap; decisions in `s6.4-improvements.md`

> **Split (2026-06-03):** as the plan anticipated, this was too large for one pass. S10 now covers
> the **wizard rewire + builder cut-over + legacy frontend deletion** (all reversible). The
> **destructive cleanup** — backend single-narrative removal, the DB migration that deletes old
> chapters, and `StorybookTab`'s legacy body-rendering removal — moved to **`s10.1-cleanup.md`**
> (they're coupled: the legacy render paths must stay until old chapters are deleted).

### Done in S10 (this session)
- Generate-first wizard: step 3 is now a two-option picker (**Scrapbook**, **Quick Build**),
  One Story removed. **Both paths generate the AI text first**, then open the `ScrapbookBuilder`:
  - **Scrapbook (build-it-yourself):** no auto-arrangement — the builder opens with **blank pages**
    and all selected memories (AI text + photos) in the panel; the user adds pages, picks layouts,
    and places everything manually.
  - **Quick Build:** auto-arranges the generated content (`autoSuggestGroups` +
    `buildGroupedLayoutData`), saves it, and opens the builder **pre-filled** to tweak + publish.
- `TEMPLATES` extracted to `lib/storybookTemplates.js` (decouples the builder + grouping from the
  deleted editor).
- Deleted `LayoutEditor.jsx`, `PageGroupingStep.jsx`, `BookChapterReview.jsx`; removed the
  `react-rnd` dependency.

> Note: an earlier draft of this session routed Quick Build through a separate `QuickBuildPreview`
> screen; per product feedback the two paths were re-shaped to the above (Scrapbook = manual blank
> pages, Quick Build = pre-filled builder) and that preview component was removed.

### Deferred to S10.1 (see `s10.1-cleanup.md`)
- Backend: remove `POST /storybook/generate`, the non-skip wizard body generation, and
  `ClaudeClient.SYSTEM_PROMPT` / `generateChapter`.
- `StorybookTab`: remove classic body editing + `renderDraftBody`/`renderPublishedBody` +
  `LegacyChapterRenderer` inline-marker path + "Use classic style" actions.
- DB cleanup migration to delete pre-rewrite chapters; update `seed-demo-user.sh`.

---

## Goal

Wire the builder into the wizard with generate-first ordering, converge both entry paths on the
builder, and delete everything the builder replaces. After this session the builder is the only
editor and the page model is the only model.

---

## Scope

### Generate-first wizard
After memory selection, generate the AI text, then route by path:
- **Scrapbook (guided):** open the builder seeded with the auto-suggested arrangement
  (`autoSuggestGroups`). Suggestion line reads **"We suggest this grouping"** (not "AI suggested").
- **Quick Build (auto):** generate → auto-arrange → **preview screen** (the `s6.4-grouping-mockup.html`
  design) → **"modify" opens the full builder** with the auto arrangement pre-loaded.

### Remove "One Story" + single-narrative machinery
- Wizard: the mode-picker "One Story" option, supplementary-notes step (4), `BookChapterReview`
  (step 5), `handleGenerate`.
- Backend: `POST /storybook/generate` endpoint, the non-skip `/storybook/wizard` body generation,
  `ClaudeClient.SYSTEM_PROMPT` + `generateChapter` (keep `BATCH_PAGES_SYSTEM_PROMPT` /
  `generatePagesBatch`).
- Rendering: legacy inline-marker body rendering in `StorybookTab.jsx` and
  `LegacyChapterRenderer`.

### Remove the old editor + grouping step
- Delete `components/storybook/LayoutEditor.jsx` and the `react-rnd` dependency (confirm no other
  usage before removing the package).
- Delete `components/storybook/PageGroupingStep.jsx` (the builder replaces it).
- Grep for dangling imports of all removed components/functions.

### Delete old chapters (no back-compat)
- A migration or one-off cleanup removes pre-rewrite chapters.
- Update `seed-demo-user.sh` if needed so the demo account produces builder-compatible chapters.

---

## Files (touch / delete)
- `Frontend/src/components/storybook/StorybookWizard.jsx` — generate-first; remove One Story steps;
  route guided + quick paths into the builder
- `Frontend/src/components/tabs/StorybookTab.jsx` — make builder the only edit path; remove legacy
  body rendering
- `Frontend/src/components/storybook/LayoutEditor.jsx` — **delete**
- `Frontend/src/components/storybook/PageGroupingStep.jsx` — **delete**
- `Frontend/src/components/storybook/LegacyChapterRenderer.jsx` — remove inline-marker path
- `Frontend/src/components/storybook/BookChapterReview.jsx` — **delete** (One Story review)
- `Backend/.../storybook/StorybookController.java` + `StorybookService.java` — remove `generate`
  endpoint + single-narrative generation
- `Backend/.../storybook/ClaudeClient.java` — remove `SYSTEM_PROMPT` + `generateChapter`
- `Frontend/package.json` — drop `react-rnd`
- DB: cleanup migration to delete old chapters; `seed-demo-user.sh` if needed

---

## Verification (end-to-end)
1. **Guided:** select memories → generate → builder opens with "We suggest this grouping" →
   arrange/edit → publish.
2. **Quick Build:** select memories → generate → auto preview → "modify" opens builder pre-loaded.
3. "One Story" is gone from the wizard; no dead UI.
4. `grep` finds no imports of `LayoutEditor`, `PageGroupingStep`, `BookChapterReview`,
   `generateChapter`, or the `generate` endpoint.
5. `react-rnd` removed; app builds clean.
6. Old chapters cleared from the DB; demo seed produces builder-compatible chapters.
7. Publish + PDF export still work on a freshly built chapter.
