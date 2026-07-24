# SV2-S9.1 — Demo seed users for pre-verification (pregnancy + photos + books)

**Status: Complete (2026-07-03).** Confirmed in-app by Michael — both demo accounts seed cleanly, books
render and are editable, guided book is fully populated. Decisions locked in the "Finalized" block below;
earlier dated sections are working notes (Finalized block wins on conflict).

**pr5.5 update (2026-07-19): `--reset` mode + new arc pages.** The guided arc grew 30→32 (First Year) / 35→37
(Bump) — see `print/pr5.5-pdf-acceptance.md`. Because the seed is skip-if-exists, existing demo accounts won't
pick up the new arc on a plain re-run. Added **`RESET=1 npm run seed:demo`** (or `-- --reset`): for an
account that already exists, it logs in, **deletes its books, and rebuilds them on the CURRENT arc** (reusing
the existing profile/family/photos). Also: `day-you-born` added to `GUIDED_FILL` (the new time-capsule seeds
filled so it counts toward the 32-page print floor), and `fillGuidedBook` now fills pages **in place**
(`fillPageBlocks`) so injected `*-config` blocks (the time-capsule's custom labels) survive. **Windows:**
`$env:RESET='1'; npm run seed:demo`. Note `demo@gotcherapp.com` stays untouched (not in the seed's ACCOUNTS) —
its in-app book 5, if it exists, needs a manual recreate to get the new pages.

**Render gotchas found + fixed during verification (keep for reference):**
- Freeform/guided pages must be built with the app's OWN `emptyBlocksForTemplate` + text as **Tiptap docs**
  (not plain strings) and keep `contentSource`/`sourceKey` — else the read-only PDF renders but the
  interactive editor shows blank. `fillPage()`/`momentHeroPage()` do this.
- Seeded chapters default to `status='unlocked'`; the published view + PDF filter to `published`, so the seed
  now `publishChapters()` after creating each book (empty PDF otherwise).
- Guided books: only the 5 auto/prefill pages populate from live data; the ~24 fill/pick pages are empty by
  design, so the seed fills them from `GUIDED_FILL` (per-anchorKey text + seed-asset photos). Pregnancy
  account fills pre-birth pages only.

**As built (2026-07-02):**
- `Frontend/scripts/seed-demo-users.mjs` — Node seed for the two accounts (imports the real guided arc via
  `@/lib/guidedBookArc`; profiles · photos via real `/upload` · journals · firsts · growth · milestones ·
  birth-details · family (with `linked_member_id`) · bump-photos · guided book · Noah's freeform moment-hero
  pages). Idempotent (register 4xx → skip account).
- `seed-assets/` — 18 purpose-named Pexels images (downscaled to ≤1600px, 29→2.3 MB) + `NOTICE.md`.
- `Frontend/scripts/downscale-seed-assets.mjs` + devDeps `sharp`, `vite-node`; npm scripts `seed:demo`,
  `downscale:seed-assets`.
- **Run:** API up (`cd Backend && ./start-services.sh`), then `cd Frontend && npm run seed:demo`.
- **Ran clean against LOCAL 2026-07-02** — both accounts created, photos uploaded to Cloudinary, guided
  books (35 chapters) + Noah's freeform moment-hero pages, and family links verified via API (Nana→Chloe,
  Pop/Grandma→Ben, Margaret photoless). Remaining: eyeball the books in-app (that's the s9.5 pass).
- **Prod:** run remotely — `API=https://cradlehq.app/api npm run seed:demo`. Ops notes in
  `Frontend/scripts/README.md` + a "Seed Demo Accounts" section in `deployment-guide.html`.
**✅ Prereq done (2026-07-02):** `sv2-s9.0b` (family relationships) is **Complete** — `family_members` now has
`linked_member_id`, so this seed can set grandparent→parent links directly for a correct demo family tree.
(`sv2-s9.0a` multi-photo redesign was dropped — no data impact.)
**Why now:** `sv2-s9.5-verification.md` needs a **pregnancy profile** + **content with photos** + **books to
open**, but today's `seed-demo-user.sh` gives a single **baby-only, photo-less, book-less** profile. This
session upgrades the seed so S9.5 (and demos generally) start with rich, visual data across the pregnancy →
baby lifecycle. Sits **before `sv2-s9.5`** in the run order.
**Reference:** `seed-demo-user.sh` (current seed); `sv2-s9.5-verification.md` §Pre-flight; pregnancy data
layer (`plans/pregnancy/`, shipped: `phase`/`due_date` on `baby_profiles`, `bump_photos` table,
`GET/POST /bump-photos`, upload `context=bump_photos`).

---

## ✅ Finalized decisions (2026-07-02) — these supersede the stale bits below

- **Script = Node.** `seed-demo-users.mjs` (not bash). Imports the guided-arc generator directly (no separate
  stdout dance); handles profile creation, data, multipart photo uploads, and book creation.
- **Leave `demo@gotcherapp.com` (Sarah/Lily) UNTOUCHED.** All seed accounts are brand-new. (Supersedes the old
  "User 1 = reuse demo@ + add photos".)
- **TWO new accounts** (dropped the standalone rich-baby account — bump-to-baby already covers a photo'd baby):

  | Email | Parent | Baby | Phase | Books |
  |---|---|---|---|---|
  | `demo-pregnancy@demoapp.com` | Maya | — (due ~18wk out) | pregnancy | guided (pregnancy arc) |
  | `demo-bumptobaby@demoapp.com` | Chloe | Noah | baby (was pregnant) | guided "Bump to One" **+** small freeform |

  Password `DemoPass1` on both. Bump-to-baby exercises **S8 Q4** (pregnancy pages persist after "mark as born").
- **Freeform book SHRUNK.** The guided arc already instantiates **9 of 11 page types** (birth_day, bump,
  chapter_divider, family_tree, gallery, letter, milestones, people, prompts) from seeded data — so the guided
  book *is* the at-a-glance page-type smoke test. The freeform book only needs the templates the arc doesn't
  use: **moment-hero portrait + landscape** (+ optionally a manual gallery). This kills the "hand-shape every
  template" complexity flagged in the old Books section below.
- **Photos = the provided Pexels set** (18 shots in `plans/storybook-v2/Pictures/`) → copied + purpose-renamed
  into committed **`seed-assets/`** with a **`NOTICE.md`** (photographer + Pexels URL + license, from the
  filenames). Family tree **fully photo-populated** (mum / dad / 2 grandparents), but leave **one grandparent
  photoless** to exercise the initials-in-a-circle render. Only 2 face-free bump shots — reuse across weeks.

---

## Goal
A single **Node** script (`seed-demo-users.mjs`) that provisions **two** new demo accounts covering the
pregnancy → baby lifecycle, each with **photos from the get-go** and **pre-created books**, so the
Storybook/pregnancy flows can be verified without hand-entering data. (Existing `demo@` is left alone.)

## The three users (decided 2026-07-01)

| # | Account | Phase | Purpose |
|---|---|---|---|
| 1 | `demo@gotcherapp.com` (Sarah / Lily) | baby | Keep the current rich baby dataset; **add photos** (+ birth details + family) |
| 2 | `pregnancy@gotcherapp.com` | pregnancy | Due ~18wk out; **bump diary** (weeks + photos) + a couple pre-birth journals; no birthdate |
| 3 | `bumptobaby@gotcherapp.com` | baby (was pregnant) | **Full lifecycle**: bump photos across weeks **and** a birthdate + baby journals/firsts. Exercises **S8 Q4** (pregnancy pages persist after "mark as born") |

**Data each gets (matrix to finalize):** baby profile (name/birthdate/phase/dueDate) · journals · firsts ·
bump photos (users 2 & 3) · growth · feeding/sleep/diaper (users 1 & 3) · milestones · vaccines ·
appointments · **birth details** · **family members** · **books** (below). Users 2/3 also need the profile
`phase`/`due_date` set (via the baby-profile PUT if it accepts them, else a psql fallback).

## Photos — DECIDED (2026-07-01): bundled royalty-free set + real upload

**Legal bar: must be safe from likeness/copyright claims.** So:
- **Source: Pexels and/or Unsplash only** — both licenses grant free **commercial** use with **no
  attribution required** (the industry-standard "royalty-free"). **Do NOT use LoremFlickr** (mixed CC
  licenses — some require attribution / are non-commercial) or random web images.
- **Bias toward non-identifiable shots** — baby feet/hands, wrapped newborns, bump silhouettes,
  from-behind — which sidesteps right-of-publicity entirely (the only real lawsuit vector is an
  identifiable person's likeness used in *marketing*; a dev/demo seed isn't that, but this is belt-and-
  suspenders and looks good for a baby app).
- **Curate ~15 images** into **`seed-assets/`**, committed, with a **`seed-assets/NOTICE.md`** recording
  each image's **source URL + license** (attribution isn't required, but documenting provenance covers us).

**Attach via the real pipeline (option B):** the seed uploads each bundled file through `POST /upload?context=…`
→ stores the returned Cloudinary URL on the `journal_entries` / `first_times` / `bump_photos` (+ a few
`first_time_photos`). Legally clean **and** exercises the true upload/crop path (better for S9.5). Offline-
reliable (no hotlinking).

**Do not reuse these images in public marketing** without proper model-released stock — testing/demo only.

## Books — seed guided + freeform (decided: yes, both)

- **Guided book** (users 1 & 3): the arc is **materialized in frontend JS** (`guidedBookArc.js`
  `expandArcToChapterSeeds(arcFor(profile))`), so bash can't build it. ✅ **DECIDED (2026-07-01): a
  generator script emits the payload, reusing the real arc (single source of truth, can't drift).**
  - `Frontend/scripts/gen-guided-arc.mjs <baby|pregnancy>` imports `arcFor` + `expandArcToChapterSeeds`
    from `@/lib/guidedBookArc` and prints the `chapters` JSON to **stdout**.
  - Run it through tooling that resolves the Vite `@/` alias — **`vite-node`** (Vitest already runs this
    exact arc code in `guidedBookArc.test.js`, so the resolver + Node-safety are proven). Add `vite-node`
    as a devDep if it isn't already; expose an npm script `gen:guided-arc` for manual runs.
  - The seed captures that stdout and POSTs `POST /books {type:'guided', chapters:…}`.
  - The **auto/prefill pages (birth day, family tree, people, milestones) then render from the seeded
    profile data automatically** — so a seeded guided book already *looks* populated. User 3 gets the
    **"Bump to One"** arc (pregnancy front-insert); user 1 gets **"Your First Year."**
- **Freeform book** (user 1): `POST /books {type:'freeform'}` → backend auto-seeds one empty chapter (s8.5).
  ✅ **DECIDED (2026-07-01): pre-populate pages** so it opens with real content, not blank.
  ⭐ **REFINED (2026-07-02, from s9 wrap-up): the freeform demo book must contain EVERY page type**, one page
    per template, so the whole set can be eye-balled at a glance (screen + PDF) in the s9.5 sweep. This is the
    single quickest way to smoke-test all renderers + PDF export together.
  - Page types to cover (one each): `moment-hero` (portrait + landscape), `letter`, `gallery`, `birth_day`,
    `people`, `family_tree`, `chapter_divider`, `prompts`, `bump`, `milestones` — cross-check the live list
    in `storybookPdf.js` dispatch when building so none is missed as new types land.
  - After the photos are uploaded, **PATCH the freeform chapter's `layout_data`** to a v2 layout with one
    page per template, placing seeded journals/firsts + their photos (and the data-driven pages reading
    birth_details/family_members/milestones) into real template slots. Build the layout JSON in a small
    helper (extend the `gen-*.mjs` pattern, reusing `storybookLayout`/`storybookTemplates`) so block
    ids/shape match what the builder+renderer expect; substitute the uploaded Cloudinary URLs.
  - This is the **main added complexity** of the session (hand-shaped layout data) — but the coverage is
    worth it: it doubles as the standing regression fixture for PDF export.
- For the data-driven pages to be rich, the seed **must also add `birth_details` + `family_members`**
  (today's seed does neither, despite s9.5's note) — include these.

## Open questions to settle (this is the "talk it over" part)

1. ~~Photos: A vs B, picsum vs bundled?~~ ✅ **DECIDED** — bundled Pexels/Unsplash set in `seed-assets/`
   (non-identifiable, with `NOTICE.md`), uploaded via the real pipeline.
2. ~~Freeform content: empty or pre-populated?~~ ✅ **DECIDED** — pre-populate ~3 pages (via a
   `layout_data` PATCH built by a small helper).
3. ~~Guided emitter: add a script vs hardcode?~~ ✅ **DECIDED** — `Frontend/scripts/gen-guided-arc.mjs`
   run via `vite-node`, invoked by the seed. Reuses `guidedBookArc.js`; stays in sync.
4. ~~Idempotency/reset: wipe+reseed vs skip-if-exists?~~ ✅ **DECIDED** — **skip-if-exists**, but *properly*:
   if the account already exists, **skip that user's entire seed block** (don't re-POST). NB: today's
   `seed-demo-user.sh` falls back to login and then re-POSTs everything → **duplicates** on re-run; the new
   script must add a real "already seeded? → skip" guard per user (e.g. register succeeds vs 409, or check a
   marker like an existing profile/journal count before seeding).
5. ~~Scope of user 1: add a bump history too?~~ ✅ **DECIDED** — **keep user 1 the clean baby case**; user 3
   (`bumptobaby`) is the one that's both pregnancy + baby.
6. **Confirm** the baby-profile PUT accepts `phase`/`dueDate` (else psql fallback), and the exact
   `bump_photos` create shape (week/imageUrl/note/takenDate).

## Files (anticipated)
`seed-demo-users.sh` (new, or extend `seed-demo-user.sh`) · `Frontend/scripts/gen-guided-arc.mjs` (new,
guided payload emitter) · `Frontend/package.json` (`gen:guided-arc` script + maybe `vite-node` devDep) ·
`seed-assets/` (bundled royalty-free images + `NOTICE.md`) · README/run note.

## Out of scope
No app/feature code changes (seed + a helper script only). Not the S9.5 verification pass itself — this just
provisions its data. No real print/Lulu or payments.
