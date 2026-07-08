# SV2-S7 — Guided Book Shell  (INDEX — split into s7a + s7b on 2026-06-28)

**Status: SPLIT — this file is now the S7 overview. The buildable specs are:**
- **`sv2-s7a-books-and-library.md`** — the book container: `books` table + backend CRUD + library /
  switcher / new-book chooser + per-book theme/cover + remove the AI card.
- **`sv2-s7b-guided-arc.md`** — the guided content: `guidedBookArc.js` config + **Model A** instantiation
  + fill mechanics (pick / locked sequence / auto / prefill) + progress + per-page prompt copy.

**Build order:** s6.5 → **s7a → s7b** → s8. s7b depends on s7a (a guided book is a `books` row).
**Depends on (both):** the page types (s1–s6.5). **No new page types in S7** — every renderer exists.
**Reference:** `sv2-s7-plan-default-book.md` (the LOCKED page-by-page arc); `planning.md` 2026-06-27
direction update; mockups `mockups/s6-guided-*.html`, `mockups/s7-*.html`.

---

## What S7 is (the model)
The guided book is **a pre-designed FILL-IN book, not an auto-derived page-flow.** *We* lock the page
sequence and each page's layout; the user **drags photos / types text** into the slots (reusing the
ScrapbookBuilder fill mechanics). Page kinds: **auto** (renders from data), **prefill** (seeded but
editable), **fill** (empty designed page), **pick** (user chooses which First). Pages are **locked** (no
add/remove/reorder) in v1. The freeform scrapbook coexists as the advanced mode.

This **supersedes** the original 2026-06-22 auto-derivation / "generate" / completion-state-machine plan
and the dropped `firsts_chapter` (old moment-hero/firsts plans). That draft is in git history.

## Cross-cutting decisions (apply to both s7a + s7b)
- **Model A** (decided 2026-06-28): a book's pages are real `storybook_chapters` rows; a guided book
  **materializes** one row per arc page at creation (detail in s7b). "Locked" = builder hides
  add/remove/reorder for `type='guided'`.
- **Multi-book in v1** via the `books` table; low-friction landing (shelf only at 2+ books) — detail in s7a.
- **Guided = default/recommended** in the chooser; **no AI surface in S7** (the "Write a Period Chapter"
  card is removed; s10/s11 reintroduce AI as the opt-in per-field assist).

### Existing books — CLEAN BREAK, no migration (DECIDED 2026-06-28) — *canonical reference*
**Pre-prod, only the dev account has a book**, so a lossless migration buys nothing. We wipe the dev data
and build fresh. Supersedes the earlier "reparent existing chapters losslessly" plan.
- **No reparenting / backfill.** Plain schema change: create `books`, add **`book_id` NOT NULL** FK to
  `storybook_chapters` (table cleared first), cover/theme columns onto `books`. (Executed in **s7a**.)
- **Cover/theme** move cleanly onto `books` (nothing to copy from `baby_profiles`); drop the old columns if
  unused (audit).
- **s11 simplifies too:** with no books to preserve, **fully delete** the `generated_content` plumbing
  (column + read DTOs), not a read-only path — see the updated `sv2-s11`.
- **Seed/demo** is rebuilt fresh by the updated seed script; no demo book to migrate.
- **Re-validate before running:** only holds while the dev account is the *only* book. If anything ships to
  real users before s7a/s11 run, revert to a real migration.

> Net: no migration code, no lossless guarantees, no zombie read paths — a fresh `books`-backed model + a
> re-created dev/demo book.
