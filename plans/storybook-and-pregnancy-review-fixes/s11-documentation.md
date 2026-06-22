# s11 — Documentation Refresh

**Status: Not started**
**Branch:** pregnancy-updates
**Depends on:** ideally last (so docs describe the post-refactor code)
**Source:** `branch-review.html` → Pass 4

---

## Goal
Replace the stale storybook primer, give the repo real onboarding context, and document the two
implicit contracts. Docs only — no code behaviour change.

## Scope
- **Rewrite `plans/storybook/storybook-context.md`** against current code. It currently describes the
  *replaced* architecture. Correct it to:
  - **One** generation path: `generatePages()` → a single batched `claudeClient.generatePagesBatch()`
    call (no 3-paths / 2-prompts / per-memory loop).
  - Current components: `ScrapbookBuilder`, `MomentHeroCanvas`, `BookCover`, `PhotoTray`,
    `FormatToolbar`, `FontPicker`, `RichTextEditor` (drop `LayoutEditor`/`BookChapterReview`/
    `LegacyChapterRenderer`).
  - Wizard: Scrapbook vs Quick Build, steps 1→2→3→6, generate-first.
  - New concepts: `l-wrap` block, the `moment_hero` renderer (role-id blocks), `generated_content`
    column. Remove stickers + the `/storybook/generate/{id}` endpoint + shrink-only fitText.
  - Add a "Last verified against commit <sha>" line.
- **Flesh out `CLAUDE.md`** (currently only the Plans rule): overview & stack; how to run
  (`Backend/start-services.sh`, `npm run test`, `./gradlew test`); gotchas (Spring 401 trap,
  TavernTales shared-port 5432); conventions (discuss-first, no `Co-Authored-By: Claude`,
  `plans/<name>/sN`, Needs Verification before Complete); pointers to the storybook primer + pregnancy plans.
- **Inline contract comments:**
  - `moment_hero` role-id coupling — note at both `storybookTemplates.js` (above the moment-hero
    templates) and `MomentHeroCanvas.jsx` (`blk('badge')` lookups).
  - `sourceKey` grammar (`journal:<id>` / `first_time:<id>` / `upload:…` / `slot:N`) and the separate
    `photoSourceKey` on l-wrap blocks — comment where keys are parsed.
  - Credit charge-then-refund intent in `generatePages`.
- **Optional:** `plans/pregnancy/pregnancy-context.md` primer (phase model, due-date→week math,
  Date→Week derivation, bump diary reachable from both modes).
- Note for Michael: the private memory `project_storybook_architecture.md` likely has the same drift —
  refresh it outside the repo in the same pass.

## Files
- `plans/storybook/storybook-context.md`
- `CLAUDE.md`
- `storybookTemplates.js`, `MomentHeroCanvas.jsx`, `StorybookService.java` (comments)
- `plans/pregnancy/pregnancy-context.md` (optional, new)

## Verification
1. Read the rewritten primer against the current code — every claim checks out.
2. Links/paths resolve.
