# SV2-S8 — Pregnancy Chapter ("Before You Arrived")   *(was pregnancy-track; renumbered 2026-06-27)*

**Status: Draft — REFRAMED 2026-06-27 (read the reframe note first).**
**Depends on:** sv2-s7 (guided fill-in shell) + sv2-s1 (Letter component). **No longer a Firsts-chapter
clone** (the old moment-hero/firsts plans are dropped).
**Reference:** `planning.md` 2026-06-27 direction update; mockup
`mockups/s6-guided-pregnancy-first-year-book.html`; `plans/pregnancy/` (shipped data layer).

---

## ⭐ REFRAME (2026-06-27)

The pregnancy chapter is **NOT auto-derived** (it was modelled as a Firsts-chapter clone — that approach
is dropped). It is the **6-page fixed fill-in chapter** that front-inserts into the guided book when the
profile has pregnancy data:

1. **A Letter Before You Arrived** — `fill` (reuses sv2-s1 Letter, pre-birth type)
2. **The Day We Found Out** — `fill` (announcement)
3. **Your First Photo** — `fill` (ultrasound)
4. **The Bump — Early Days** — `fill` (bump photos)
5. **The Bump — Full Bloom** — `fill` (bump photos)
6. **Getting Ready for You** — `fill` (nursery)

The **week→size comparison is a small AUTO tag layered on the bump photos** ("how big were you here"),
using the shipped 37-row size dataset — **not** a standalone "Size of You" page. Only a bump photo that
has an associated week shows the tag.

The original "auto-derive bump pages, mirror the Firsts chapter" content below is **superseded** — keep
it only for the size-dataset / journal-by-phase background. The new pregnancy pages are designed fill-in
slots like the rest of the book.

---

> This file is the home for the pregnancy → storybook tie-in. It was **deferred out of the
> standalone pregnancy plan** (`plans/pregnancy/s4-storybook-pregnancy-tie-in.md`) once we realised
> the right model is the v2 **Guided Book** (data-derived, fixed-layout page types), not the legacy
> scrapbook wizard (period windows + AI grouping + L-Wrap). Built against the old model it was a
> risky retrofit; built against the guided book it's a near-clone of the Firsts chapter.

---

## What's already built (pregnancy plan S1–S3, shipped ~2026-06-17)

The data + capture layer that v2 `planning.md` §5 / Group C listed as *future* work is **done**.
This **supersedes the schema sketch in §5** (we built it differently — see notes):

- `baby_profiles.due_date` (nullable) + a user-controlled `phase` (`'pregnancy' | 'baby'`, NOT NULL,
  CHECK) — migration **V35**. (§5 proposed only `due_date`; phase is the real switch.)
- `bump_photos` table — migration **V36**: `week`, `image_url`, `note`, `taken_date`,
  `image_orientation`. (This *is* §5's `pregnancy_photos` — already real; column names differ.)
- Backend `com.gotcherapp.api.bump` (mirrors `firsttimes`): `GET/POST/PATCH/DELETE /bump-photos`;
  upload via `POST /upload?context=bump_photos`.
- Frontend:
  - `components/pregnancy/BumpCard.jsx` — **reusable, photo-forward keepsake card** (photo +
    "Week N · <size> 🍈" + date + note). Already the 90%-there bump page renderer.
  - `BumpDiary.jsx`, `lib/bumpDiary.js`, `lib/pregnancy.js`
    (`weeksPregnant(dueDate, refDate)`, `profilePhase`, …), `lib/pregnancySizes.js`
    (the 37-row weeks-4→40 size dataset), `PregnancyHome.jsx`.
- **Pregnancy S5 (next/in progress)** makes the bump diary *double as the pregnancy journal* — photo
  becomes optional, text-only entries allowed, and the entry **week is derived from its date**. That
  turns pre-birth memories into dated, phase-flagged, journal-like data — exactly the source this
  chapter consumes.

**Net:** the data layer is done. What's missing is purely the **guided-book derivation layer** +
a thin fixed-layout page wrapper. Cheaper than v2's §5 assumed.

---

> *(The original "model shift" table + auto-derived "Proposed shape" — bump pages emitted from
> `bump_photos`, mirroring the dropped Firsts chapter — were trimmed 2026-06-27. The actual pregnancy
> pages are the fixed fill-in list in the REFRAME note above. Kept below: the journal-by-phase idea +
> what's shipped. Old draft in git history.)*

## The journal reframing (the key idea)

In the legacy model, pre-birth entries collide in the birthdate-relative **week** namespace
(pregnancy "week 20" vs baby "week 20") and fall outside every period — they never flow in.

In the v2 model, the guided book treats `journal_entries` (and bump-as-journal entries) as a
**data source selected by phase flag, not by week math**. Pre-birth = phase `pregnancy`; the chapter
pulls exactly those. This dissolves the collision *and* lines up with pregnancy **S5** (bump diary
becomes the pregnancy journal). The journal stops being "windowed by week + fed to an AI" and
becomes "phase-tagged data the guided book routes into the right chapter."

---

## Dependencies / placement in the arc

- **After** sv2-s7 (guided fill-in shell + `ChapterDividerPage`), sv2-s6 (the Bump page type), and
  sv2-s1 (Letter component).
- Pregnancy **data layer already done**, so scope ≈ the 6 fixed fill-in pages + the auto bump size tag.
- Sits at the **front of the arc** (it front-inserts when the profile has pregnancy data).

---

## Open questions (resolve when v2 is re-talked)

1. **Page granularity** — ✅ **RESOLVED (2026-06-27):** the two bump pages use the sv2-s6 **2-up bump
   template** (2 photos + note + per-photo auto week→size tag), once as "The Bump — Early Days" and once as
   "The Bump — Full Bloom" → **~4 bump photos/book**. Not one-page-per-photo, not a trimester gallery.
2. **Chapter opening** — pre-birth letter first, a chapter divider, or straight into the first bump
   photo?
3. **Pre-birth entry tagging** — does this come only from `bump_photos`-as-journal (S5 makes bump the
   journal, so maybe sufficient), or do we also add a `phase` column to `journal_entries` for
   baby-mode-authored "looking back" pre-birth entries?
4. **Mark-as-born persistence** — confirm bump pages stay in the book after the phase swaps (data is
   on the same profile; should be automatic — verify nothing filters by current phase).
5. **PDF** — bump pages through `storybookPdf.js`: verify `BumpCard` survives html2canvas (the size
   emoji is a **bundled Twemoji `<img>`**, which is fine — but confirm; native-glyph fallback exists).

---

## Out of scope

- Social-card *image* generation / sharing — `plans/social-sharing/`.
- The legacy scrapbook period-chapter tie-in — abandoned; do not retrofit the wizard.
