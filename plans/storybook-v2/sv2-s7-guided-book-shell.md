# SV2-S7 — Guided Book Shell   *(was sv2-s6; renumbered 2026-06-27)*

**Status: Not started — REFRAMED 2026-06-27 (read the reframe note first).**
**Depends on:** the page types (s1 Letter, s2 Birth, s3 People, **s5 Family Tree**) + the **s6 fill-in
page types** (growth spread, prompt pages, bump page, chapter divider). NOT the dropped moment-hero/firsts plans.
**Reference:** `planning.md` 2026-06-27 direction update; `sv2-s7-plan-default-book.md` (locked arcs);
mockups `mockups/s6-guided-first-year-book.html` + `mockups/s6-guided-pregnancy-first-year-book.html`.

---

## ⭐ REFRAME (2026-06-27) — read before the original plan below

The guided book is **a pre-designed FILL-IN book, not an auto-derived page-flow.** This changes the
shell's job and **removes** the original plan's auto-derivation / "generate" / completion-state-machine
framing (and the `firsts_chapter` auto section — the old moment-hero/firsts plans are dropped). As-now scope:

1. **Page-sequence config** (`guidedBookArc.js`) — a **fixed, ordered list of specific page templates**
   (the 25-page "First Year" arc; the 30-page "Bump to One" arc front-inserts its pregnancy pages when
   the profile has pregnancy data). Each entry = a concrete template + a **prompt/label** + its kind
   (**auto** / **fill** / **pick**). The two mockups are the authoritative page lists.
2. **Instantiate + fill** — opening the guided book seeds a locked page sequence; the user fills each
   **fill** page by **reusing the existing ScrapbookBuilder** drag-photo/type-text mechanics. **auto**
   pages render from data (Birth Stats, Your People, Family Tree, bump size tag); **pick** pages let the
   user choose which First for a moment-hero slot. **Pages are locked** (no add/remove/reorder) in v1.
3. **`ChapterDividerPage.jsx`** — still needed (see §2 below).
4. **Entry point + mode chooser** in StorybookTab — guided book is the **default/recommended** option
   (small "Recommended" badge); the freeform scrapbook stays as the advanced option.
5. **Multi-book IS in v1 (decided 2026-06-27).** This **needs a new `books` table** (supersedes the earlier
   "no new table" assumption). Shape ≈ `books(id, baby_profile_id FK, type 'guided'|'freeform', title, theme,
   cover_photo_url, cover_subtitle, sort_order, created_at)`. Existing `storybook_chapters` get a **`book_id` FK**;
   a migration creates **one default book per baby** and reparents current chapters into it (lossless — no user
   sees a change). Guided book = the same row with `type='guided'` + the locked page sequence; the cover/theme
   fields that live on `baby_profiles` today move onto (or are read per-book from) `books`. Pages/arc config +
   the user's data still drive page *content*; the table just lets a baby own **more than one** book.
6. **Remove the AI "Write a Period Chapter" card** from the Storybook tab. AI page-gen is deferred (V2
   direction: core ships free, no AI); the only AI is the separate **opt-in paid per-field assist (s10/s11)**.
   So Freeform = layouts / photos / text only — **no AI surface anywhere in s7**. (Decided 2026-06-27.)
   The existing wizard code stays in the repo, just unmounted from the tab; s10/s11 re-introduces AI on its own terms.

### Book library / new-book chooser (mocked 2026-06-27)
- **Most users have ONE book**; some may want more. So **don't make a book shelf the landing page.**
  - **0 books** → go straight to the **new-book chooser** dialog (Guided *Recommended* vs Freeform) → into the book.
  - **1 book** → land **inside that book** (cover + guided/freeform view), with a quiet book-switcher (e.g. a
    "Lily's First Year ▾" header control) — no mandatory shelf.
  - **2+ books** → the switcher opens a **"Your Books" shelf**: cover-thumb cards (type badge, theme, progress) +
    a `⋯` menu (rename / duplicate / delete / export) + a "Start a new book" tile.
- **Multiple books per baby — IN v1 (decided 2026-06-27).** Kept low-friction for the common single-book case
  via the landing logic above (the shelf only appears at 2+ books). Backed by the new `books` table (item #5).
- **Mockups:** `mockups/s7-guided-book-in-app.html` (in-tab guided view), `mockups/s7-book-library-and-chooser.html`
  (shelf + chooser), `mockups/s7-guided-book-shell.html` (abstract flow).

Build **sv2-s5** (Family Tree) and **sv2-s6** (fill-in page types) before this. `ChapterDividerPage`
+ the page-sequence config are the core new pieces; the page renderers already exist.

---

*(The original 2026-06-22 plan — auto-derivation, completion-state machine, the old GUIDED_BOOK_ARC
with a firsts_chapter — was trimmed 2026-06-27 when the model became a pre-designed fill-in book.
It's in git history if needed.)*
