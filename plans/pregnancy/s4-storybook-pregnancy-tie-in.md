# S4 — Storybook Pregnancy Tie-in

**Status: Deferred → folded into Storybook V2** (`plans/storybook-v2/pregnancy-track.md`)
**Branch:** `pregnancy-updates`
**Depends on:** S3 complete (bump photos exist as source material) + S2 (pregnancy journal/first-time
entries already exist via the date-sourced features).

> **DEFERRAL (2026-06-18):** This session is **not being built against the current scrapbook
> model.** The pregnancy → storybook tie-in belongs in the v2 **Guided Book** (data-derived,
> fixed-layout page types), where it becomes a near-clone of the Firsts chapter rather than a risky
> retrofit of the wizard + L-Wrap render path. The work now lives in
> **`plans/storybook-v2/pregnancy-track.md`** and rides along with the v2 re-discussion.
> The pre-birth *data* it needs is produced by pregnancy **S5** (bump-diary-as-journal,
> phase-flagged, week-from-date). The analysis below is kept for reference but is written against the
> legacy model — read the v2 pregnancy-track file for the actual approach.

> **Split note (2026-06-17):** split out of the original S3. The bump diary (S3) is a self-contained
> new feature; this session is an **additive change to the existing storybook**, whose source/layout
> model is intricate and whose L-Wrap render path has **no automated coverage and has regressed
> silently before** (see `project_storybook_lwrap_followup`). It earns its own session so the risky
> work is isolated and verified independently.

---

## Context
Goal: the finished storybook runs **bump → baby**, not just birth onward. Pre-birth memories (bump
photos + pregnancy-dated journal / first-time entries) should be available as storybook source
material so the book is continuous.

## ⚠️ Session-start gate — do NOT skip
The storybook source/layout model is intricate (see `project_storybook_architecture`). **At session
start, read the current generation/source code and confirm the actual shape with Michael before
wiring anything.** Do not assume the model from this plan. Specifically establish, from current code:
1. How does a chapter get its source memories today? (`StorybookWizard` / `buildGeneratedPageBlocks`,
   `chapter.generatedContent[sourceKey]`, the `/storybook/generate` payload.)
2. Is sourcing **date-ranged** or explicit selection? (Determines whether pre-birth entries flow in
   for free or need an opt-in.)
3. Where would bump photos enter — as another photo source the builder/wizard can place?

Report findings back and confirm the integration shape **before** touching the builder.

---

## Intended integration (validate against current code first — treat as hypotheses)
- **Pre-birth journal / first-time entries already flow in** *if* the book sources memories by date.
  Confirm; if so, the only work is making sure pregnancy-dated entries aren't filtered out.
- **Bump photos** become available storybook source material — surfaced to the wizard/builder the
  same way photos are, with the size-pairing caption as default text (e.g. a ready-made L-Wrap page:
  bump photo + "Week 24 · as big as a cantaloupe").
- Consider a default **"Before You Arrived" / pregnancy chapter** grouping bump photos + pre-birth
  entries at the front of the book. Keep this minimal — a grouping/source hook, not a redesign of
  the builder.

Keep the change **additive and small**. The L-Wrap render path has no automated coverage and has
regressed silently before — **verify any builder/render change in-app and in a PDF export.**

---

## Testing checklist
- [ ] Pre-birth journal / first-time entries appear in the storybook (date-sourced) — confirmed end-to-end
- [ ] Bump photos appear as storybook source material; a bump page builds + renders
- [ ] PDF export of a bump page survives html2canvas (float + caption intact)
- [ ] L-Wrap render path still correct in both builder and published view (manual check — no coverage)
- [ ] After "mark as born," bump photos remain in the book (nothing orphaned)
- [ ] No regression to existing (baby-only) chapters' build/render/PDF

## Out of scope
- Social-card *image* generation/sharing — `plans/social-sharing/`.
