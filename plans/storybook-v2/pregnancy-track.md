# Storybook V2 — Pregnancy Track ("Before You Arrived")

**Status: Draft — needs re-discussion (rides along with the v2 re-talk)**
**Depends on:** sv2-s6 (guided book shell) + sv2-s1 (Letter component). Reuses the Firsts-chapter
derivation pattern (sv2-s5 / sv2-s7).
**Reference:** `planning.md` §5 + Group C; `plans/pregnancy/` (shipped data layer);
memory `project_pregnancy_feature`, `project_storybook_architecture`.

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

## The model shift (why this is no longer the old S4)

| | Legacy scrapbook (old S4 assumption) | Guided Book (v2 — this track) |
|---|---|---|
| Chapter source | AI wizard, period window by birthdate-relative week | **Derived from data** via `GUIDED_BOOK_ARC` + fixed-layout renderers |
| Render path | `buildGroupedLayoutData` → L-Wrap (no test coverage, has regressed) | Dedicated page-type components (LetterPage / MomentHeroPage / …) |
| Cost | 1 AI credit per page | Free (derived); AI only for optional prose (e.g. the letter) |
| Pre-birth entries | Fall outside every period; week-namespace collision | Selected by **phase flag**, not week math |

The Firsts chapter (sv2-s5 → sv2-s7) is the template: take `first_times` → emit
`[moment_hero, gallery]` page pairs. The pregnancy chapter is the same move on `bump_photos`.

---

## Proposed shape — the "Before You Arrived" guided chapter

A new chapter in `GUIDED_BOOK_ARC`, near the **front of the book** (it's the opening of the story),
auto-derived, mirroring the Firsts chapter:

1. **Opening letter** — "*A letter before you arrived*" is already **sv2-s1's v1 letter type**.
   It opens the chapter (reuse `LetterPage`, no new work).
2. **Bump pages** — derived from `bump_photos`, fixed-layout, one page per entry (or trimester-grouped
   — open question). Renderer = a **600×800 page wrapper around `BumpCard`** (photo + size caption +
   date + note). Text-only entries (from S5's bump-as-journal) render the no-photo card variant.
3. **Pre-birth journal entries** — phase-flagged entries flow in as derived pages (see below).
4. **Optional trimester dividers** — `ChapterDividerPage` (sv2-s6) if we group by trimester.

---

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

- **After** sv2-s6 (guided book shell + `ChapterDividerPage`) and sv2-s1 (Letter component).
- **Pattern-after** sv2-s5 / sv2-s7 (Firsts chapter derivation) — build once those are proven.
- Pregnancy **data layer already done**, so scope ≈ derivation + a `BumpPage` wrapper + arc entry.
- Sits at the **front of the arc** (before the birth-day / about-you chapters) as the book's opening.

---

## Open questions (resolve when v2 is re-talked)

1. **Page granularity** — one page per bump photo, or trimester-grouped gallery pages (reuse
   `GalleryPage` from sv2-s4)?
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
