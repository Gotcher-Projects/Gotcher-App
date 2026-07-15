# Share s13e-2 — Content-based public visibility + "finished" flag (backend)

**Status:** Complete (verified 2026-07-14 — live: V49 applied; /books `finished` + PATCH toggle; Noah guided-full
showed 35/35, Lily guided-sparse showed 19/30 with empty slots dropped + data-driven pages kept by their data,
Noah freeform showed all pages; pageData correctly scoped. 10 unit tests + full backend suite green.)

_Implementation:_ V49 adds `books.finished_at`; Book DTO exposes derived
`finished`; `UpdateBookRequest.finished` handled in `BookService.update` (PATCH /books/{id}). `PublicBookService`
now content-based: freeform → all pages (empty book → chapters:[]); guided → filled pages via `pageIsFilled`
(blocks via a Tiptap `jsonHasText` walk + data-driven pages by their data + divider-section rule). Payload carries
`type` + `finished`; pageData scoped to shown pages. `PublicBookServiceTest` rewritten (10 cases); full suite green.
**Left to verify live** (needs backend restart for V49): freeform=all vs guided=filled-only against Noah(full)/Lily(sparse);
`/books` `finished`; PATCH toggles it.
**Est:** ~2h (the core of s13e) · **Depends on:** s13b ✅ · **Blocks:** s13e-3
**Scope:** BACKEND (`PublicBookService`, `BookService`/`Book` DTO, `UpdateBookRequest`, a migration). No frontend.

Replace the public link's **published-status** gate with a **content-based** model, and add the owner "finished"
flag that drives the WIP treatment (s13e-3). Grounded in mockup `mockups/s13e-finished-toggle-and-wip.html`.

---

## Decisions locked (Michael, 2026-07-14)

1. **Share is decoupled from `publish`.** `GET /book/public/{token}` no longer filters on `status='published'`.
   Publish still gates the in-app published view; the client PDF download is being removed (s13e-1). Visibility on
   the shared link is now **content-based**, by book type:
   - **freeform** (scrapbook) → **all** pages (built incrementally; every page is the book).
   - **guided** → only **filled** pages; empty template slots are skipped.
2. **Completeness = one explicit "Mark as finished" toggle** (Option A), same for both flows. New `books.finished_at`
   (timestamptz; derived boolean `finished`). It ONLY controls the WIP treatment (s13e-3) — never which pages appear.
3. **Filtering is server-side.** Never ship draft/empty pages to a public visitor and filter in the browser (leaks
   scope). The "is this page filled?" decision runs in `PublicBookService`.

## The "is this page filled?" rule (guided)

Port a `pageIsFilled(page, pageData)` helper — mirrors the frontend `chapterHasContent` (`lib/guidedBook.js`) but
per page AND aware of data-driven pages (which store no blocks):
- **Block pages** (`letter`, `gallery`, `moment-hero*`, `prompts`, `bump`, `spotlight`, `growth-spread`, `hands-feet`,
  freeform templates): filled if any block has content — `photo` with a url, `text` with non-blank plain text, or
  `l-wrap` with either. (Reuse the same three checks as `chapterHasContent`.)
- **Data-driven pages** (no blocks): `birth_day` filled iff birth details exist; `people`/`family_tree` filled iff
  `familyMembers` non-empty; `milestones` filled iff there are achieved milestones. (These reads already happen for
  `pageData` — do them first, then decide inclusion.)
- **`chapter_divider`**: a section header — include it only if its section has ≥1 filled page (i.e. at least one
  filled non-divider page before the next divider). Avoids orphan dividers on the public page.

Freeform books skip all of this — include every page of the freeform chapter.

## Payload changes (`PublicBookResponse`)

- Chapters are now selected by the content rule above (still v2-only, still chapter-nested, still in order).
- Add **`finished`** (boolean, from `books.finished_at`) so s13e-3 knows whether to show the WIP treatment.
- Add **`type`** (`freeform | guided`) and optionally **`pagesShown` / totalPages** for the badge/caption ("8 of 35").
- `pageData` scoping now keys off the **shown** pages' templateIds (recompute from the filtered set), not published ones.
- **Empty result** (no filled pages) still returns `chapters: []` → the frontend keeps today's "still being written"
  state. 404 stays for a bad/revoked token.

## The "finished" flag (owner-settable)

- **Migration V49**: `ALTER TABLE books ADD COLUMN finished_at TIMESTAMPTZ;` (confirm max is V48 first).
- **`Book` DTO + `BookService`**: add `finished_at` to `COLS`; map a derived boolean `finished` (like `shareUnlocked`).
  Confirm `duplicate()` returns `false` (new row omits the column).
- **Set it**: add a `finished` boolean to `UpdateBookRequest`, handled in `BookService.update` →
  `finished_at = NOW()` when true, `NULL` when false. (`PATCH /books/{id}` already exists; s13e-3 calls it.)

## Done when
- [ ] V49 applies; `/books` exposes `finished`; a duplicated book is `finished:false`.
- [ ] `PATCH /books/{id} {finished:true|false}` sets/clears `finished_at`.
- [ ] `GET /book/public/{token}` for a **freeform** book returns all its pages regardless of publish status.
- [ ] For a **guided** book it returns only filled pages (data-driven pages included per their data; no orphan dividers).
- [ ] Payload carries `finished` + `type`; `pageData` scoping matches the shown pages; no draft/empty page leaks.
- [ ] A book with nothing filled → `chapters: []` (empty state); bad token → 404.
- [ ] `PublicBookServiceTest` updated (content rule, finished flag) + full suite green.

## Not this session
The purchase confirmation / PDF removal (s13e-1) · the WIP gate + badge + `?` help + the toggle UI (s13e-3).
