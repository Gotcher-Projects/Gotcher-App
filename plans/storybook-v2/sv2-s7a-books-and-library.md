# SV2-S7a — Books table + Library / Switcher / Chooser

**Status: Complete — verified in-app 2026-06-28.** Backend (V42 `books` + clean break, `BookService`/
`BookController`, book-scoped storybook endpoints, cover/theme moved off `baby_profiles`) + frontend
(`StorybookTab` owns books/chapters with 0/1/2+ landing, `NewBookChooser`/`BookSwitcher`/`YourBooksShelf`,
de-AI'd wizard, per-book theme/cover) all built; backend + frontend test suites green (one pre-existing,
unrelated `FirstTimeServiceTest` failure). Migration applied to the dev DB and the book
create/switch/manage + per-book theme flow confirmed working by Michael.
**Depends on:** sv2-s6.5 (all page types built). Backend-led; independent of the guided arc itself.
**Blocks:** sv2-s7b (a guided book is a `books` row, so the container must exist first).
**Reference:** `sv2-s7-guided-book-shell.md` (S7 index + cross-cutting decisions); `planning.md` §0;
mockups `mockups/s7-book-library-and-chooser.html`, `mockups/s7-guided-book-in-app.html`.

This session builds the **book container layer** only: the data model that lets a baby own >1 book, the
backend CRUD, and the library/switcher/chooser UI. It does **not** build the guided arc or fill mechanics
(that's s7b). After s7a, the app has multiple freeform books working end-to-end; "guided" is just a
`type` value with no special behaviour yet.

---

## ✅ Decisions locked
- **Model A** (decided 2026-06-28): a book's pages are real `storybook_chapters` rows. s7a establishes the
  `books`↔`storybook_chapters` parent/child; s7b materializes guided pages into it.
- **CLEAN BREAK, no migration** (decided 2026-06-28, pre-prod): clear the dev `storybook_chapters` data;
  `book_id` is **NOT NULL** with no backfill. See the shell index's "Existing books — CLEAN BREAK".
- **Guided is the default/recommended** option in the new-book chooser; freeform is the advanced option.
- **Multi-book is in v1**, kept low-friction via the 0/1/2+ landing logic (shelf only at 2+).

---

## Backend

### Migration (`V__create_books.sql`)
- Create `books(id BIGSERIAL PK, baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE
  CASCADE, type VARCHAR(16) NOT NULL DEFAULT 'freeform' CHECK (type IN ('guided','freeform')), title
  VARCHAR(200), theme VARCHAR(64), cover_photo_url TEXT, cover_subtitle VARCHAR(200), sort_order INT NOT
  NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ)`.
- **Clear dev data**: `TRUNCATE storybook_chapters` (or `DELETE`) — pre-prod, see clean-break decision.
- Add `book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE` to `storybook_chapters`.
- Move cover/theme onto `books` (already columns above); **audit `baby_profiles`** for the existing
  cover/theme columns and drop them if nothing else reads them (StorybookTab reads `coverPhotoUrl`,
  `coverSubtitle`, theme today — repoint those to the active book).

### Java (raw `JdbcTemplate`, no ORM — match conventions)
- `Book` record + RowMapper. ⚠️ Mind the **text-block `RETURNING` gotcha** (`reference_java_textblock_returning_gotcha`)
  — end the block, then `+ "RETURNING " + COLS`.
- `BookService`: `list(babyProfileId)` (ordered by sort_order), `create(babyProfileId, type, title, theme)`,
  `rename`, `updateCover`, `duplicate(id)` (copy the book row + all its `storybook_chapters`), `delete(id)`
  (cascade), `reorder`. All ownership-scoped by `baby_profile_id`.
- `BookController`: `GET /books`, `POST /books`, `PATCH /books/{id}`, `DELETE /books/{id}`,
  `POST /books/{id}/duplicate`. JWT-protected; **IDOR ownership checks** like `first-times`. Catch
  `Exception` and return mapped `ApiError` (the 401-not-500 trap).
- Thread `book_id` through the existing storybook chapter endpoints (chapters are fetched/created **within
  a book**); `GET /storybook` becomes book-scoped.

---

## Frontend (`StorybookTab.jsx` + new components)

### Landing logic (the core of s7a)
On entering the Book tab, fetch `GET /books`:
- **0 books** → open the **new-book chooser** dialog immediately → on choice, `POST /books` → land inside.
- **1 book** → land **inside that book** with a quiet switcher control (`"Lily's First Year ▾"`).
- **2+ books** → the switcher opens the **"Your Books" shelf**.

### Components
- **`NewBookChooser`** (dialog) — Guided *(Recommended badge)* vs Freeform cards → creates the book. For
  a guided pick, s7b's instantiation runs (s7a just creates the `type='guided'` row; wire the call in s7b).
- **`BookSwitcher`** (header control) — current book title + `▾`; opens the shelf at 2+ books.
- **`YourBooksShelf`** — cover-thumb cards (type badge, theme, **progress** — placeholder until s7b
  defines "filled"), a `⋯` menu (rename / duplicate / delete / export), and a "Start a new book" tile.
- `⋯` actions wire to the endpoints: rename (inline/dialog), duplicate (`POST /books/{id}/duplicate`),
  delete (confirm dialog), **export** = the existing PDF path, scoped to the book.
- **Per-book theme/cover**: the active book's `theme`/cover drive the render pipeline (repoint the current
  `baby_profiles`-based reads). Cover/back-cover *rendering* itself is unchanged (rework deferred).

### Remove the AI card
Remove the **"Write a Period Chapter"** AI card from the tab (planning §8: core ships AI-free). Unmount the
wizard's generate entry only — leave the wizard code in the repo (s11 does the deep removal).

---

## Testing & verification
- **Backend (`./gradlew test`):** `BookService`/`BookController` — create/list/rename/duplicate/delete,
  ownership (IDOR) rejection, sort_order.
- **Frontend (`npm run test`):** landing-logic branching (0/1/2+), chooser creates a book.
- **Manual:** create freeform books, switch between them, rename/duplicate/delete/export, theme is
  per-book, no AI card anywhere, demo/seed rebuilds into a default book.

## Out of scope (→ s7b)
- The guided arc config, Model-A page materialization, pick/locked-sequence/fill mechanics, the real
  progress definition, per-page prompt copy. s7a leaves a `type='guided'` book that behaves like a freeform
  one until s7b lands.
- Cover/back-cover rework (deferred); AI of any kind (s10/s11).

## When done
Mark **Needs Verification**; **Complete** only after the user confirms multi-book create/switch/manage +
per-book theme work in-app. Then s7b can materialize the guided arc into a `type='guided'` book.
