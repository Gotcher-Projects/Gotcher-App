# SV2-S9.5 — Verification walkthrough (S7a · S7b · S8 · S8.5 · S9)

**Status: Complete (verified 2026-07-03).** Michael signed off — the guided + freeform books, pregnancy
flow, and all page types render/edit correctly against the seeded demo accounts (sv2-s9.1). This closes the
**core v2 book**: everything not behind the paid wall is done. Everything remaining is the **paid bundle**
(Payments/Stripe · s10 AI assist · s11 AI retrofit · s12 print/Lulu · s13 share), which is gated on the
vendor integrations + credentials coming back (see `plans/storybook-v2/handoffs/` + the s9.6 reconcile).

_Original intent below (a manual verification pass over S7a/S7b/S8/S8.5/S9) — carried out via the demo seed._

**Status (superseded): Not started — created 2026-06-28.** Runs **after `sv2-s9`** (so the full core book is built)
and **before the paid bundle** (`s10` AI assist / `s11` AI retrofit / `s12` print). This is a **manual,
guided verification pass** — Michael drives the app while Claude walks each checklist and fixes anything
that fails. **On sign-off, flip s7b/s8/s8.5/s9 → "Complete".** (s7a is **already Complete** — verified
2026-06-28; its Section 1 checklist below stays as a **regression** check, since s8.5 reworks the
freeform books/chapters s7a introduced.)

**Why a dedicated session:** these features are UX-heavy and interdependent (books → guided arc →
pregnancy chapter → freeform unify → PDF). Verifying them together against a clean DB catches
integration gaps that per-session checks miss, and gives one clear go/no-go before AI/print.

---

## Pre-flight setup

1. **Clean DB.** Start fresh so the s7a clean-break + s8.5 clean-break have actually run:
   `cd Backend && ./start-services.sh`. Confirm the backend log shows `V42` (books) — and whatever
   migration s8.5 adds — applied with no errors.
2. **Two profiles to exercise both arcs:**
   - **Baby-only profile** (no due date) → should get the **30-page "Your First Year"** guided arc
     (25 content + 5 dividers).
   - **Pregnancy profile** (has `due_date`/`phase=pregnancy`) → should get the **35-page "Bump to One"**
     arc (29 content + 6 dividers) + the Bump tab.
   The demo seed (`seed-demo-user.sh`) gives a baby-only profile with journal/firsts/milestones/birth
   details/family — good for most checks. Create a second pregnancy profile (or flip phase) for the
   pregnancy-specific items.
3. **Have content to place:** journal entries, first times, birth details, family members, milestones,
   and (pregnancy) bump photos — the seed covers the baby-only set.

> If a section can't be reached because an upstream session regressed, stop and fix before continuing —
> the checklists are ordered by dependency.

---

## 1 · S7a — Books container & library  *(regression — already Complete)*

- [ ] **Landing 0 books:** brand-new profile → Book tab opens the **new-book chooser** (Guided
      *Recommended* / Freeform).
- [ ] **Create freeform** → lands inside an empty book with the quiet **"… ▾" switcher**.
- [ ] **Landing 1 book:** leave + re-enter the Book tab → lands straight inside the one book (no shelf).
- [ ] **Create a 2nd book** → switcher now opens the **"Your Books" shelf**; both books show as
      cover-thumb cards with type/theme.
- [ ] **Switch books** from the shelf → the active book changes; reload → it **remembers** the last book.
- [ ] **Rename / Duplicate / Delete** from a card's `⋯` menu: rename sticks; duplicate copies the book
      **and its pages**; delete removes it (and, if it was active, lands you on another book or the
      chooser).
- [ ] **Per-book theme + cover:** change theme + cover photo/subtitle on one book; switch to another →
      its theme/cover is independent; reload → both persist (now stored on `books`, not the profile).
- [ ] **No AI surface anywhere** in the Book tab (no "Write a Period Chapter / generate" affordance).
- [ ] **Export:** a book with a published page offers **Download PDF** and it produces the file.

## 2 · S7b — Guided book

- [ ] **Create guided** (baby-only profile) → a **locked sequence of ~25 designed pages** materializes
      with per-page **prompts/labels** ("A Letter to You", "The Day We Met You", …).
- [ ] **Locked structure:** the builder shows **no add / remove / reorder** controls for a guided book.
- [ ] **Page kinds behave:**
  - **auto** (Birth Stats, Family Tree) render straight from data, read-only.
  - **prefill** (Your People, How You Grew) seed from data but stay **editable**; "Refresh from data"
    re-seeds.
  - **fill** pages take dragged photos / typed text into their slots, with the prompt shown as guidance.
  - **pick** pages let you **choose which First** to feature; the chosen First renders in the moment-hero.
- [ ] **Progress** shows `X / Y` and updates as pages get content; the shelf card reflects it.
- [ ] **Adaptive arc:** the **pregnancy profile** gets the **35-page "Bump to One"** arc — the 5
      pregnancy pages front-insert and the standalone "A Letter to You" is replaced by "A Letter Before
      You Arrived".
- [ ] **PDF** chains the full locked sequence in order.

## 3 · S8 — Pregnancy chapter ("Before You Arrived")

- [ ] On a pregnancy profile, the guided book includes the **fixed fill-in pregnancy pages** (Letter
      Before You Arrived · Day We Found Out · First Photo/scan · Bump ×2) — 5 pages, no "Getting Ready".
- [ ] The **week→size comparison renders as a small AUTO tag layered on bump photos** ("how big were you
      here") — **not** a standalone page.
- [ ] Baby-only profiles **do not** get the pregnancy pages.

## 4 · S8.5 — Unified freeform (periods gone)

- [ ] **No time-period step** anywhere — creating/adding to a freeform book never asks for a "Weeks X–Y"
      window.
- [ ] **Freeform = flat pages:** the Book tab shows **cover + theme + Edit book + Download PDF** (no
      chapter-card list). "Edit book" opens the builder on the whole page sequence.
- [ ] **Memory panel shows ALL memories** (every journal entry + first time), draggable onto any page —
      not a pre-filtered subset.
- [ ] **30-page cap:** "Add page" disables with a note at 30 pages.
- [ ] **Periods fully retired:** no `StorybookWizard`, no period labels; existing period chapters were
      cleared by the clean break.
- [ ] **Guided unaffected** by the freeform changes (re-run a couple of Section 2 checks).

## 5 · S9 — Polish & PDF

- [ ] **Every page type exports cleanly** at print/screen parity — Letter, Birth Stats, People, Family
      Tree, Moment-Hero, Gallery, Chapter-Divider, Bump, Milestones, Prompts, and freeform layouts.
- [ ] **Full-book PDF** for both a **guided** book (locked sequence) and a **freeform** book (flat pages)
      — correct page order, no clipped/blank pages, cover included.
- [ ] **Pregnancy guided PDF** includes the bump pages + size tags.
- [ ] No html2canvas-only artifacts (pseudo-elements / mask bleed) — spot-check a couple of pages against
      `feedback_html2canvas_limitations`.

---

## Automated backstop (run before the manual pass)

- [ ] `cd Backend && ./gradlew test` — green (note: one **pre-existing, unrelated**
      `FirstTimeServiceTest.findAll_returnsMappedList` failure is known; everything else must pass).
- [ ] `cd Frontend && npm run test` — green.
- [ ] `cd Frontend && npm run build` — clean.

## Sign-off

When every box above is checked and any failures fixed:
- [ ] Mark **s7b, s8, s8.5, s9 → Complete** (update each plan's Status + `planning.md` §3). *(s7a already
      Complete; Section 1 was a regression check.)*
- [ ] Confirm the branch is ready to commit (commits were deferred until after S9 / this pass).
- [ ] Hand off to the **paid bundle**: s10 (AI assist) → s11 (AI retrofit) → s12 (print).
