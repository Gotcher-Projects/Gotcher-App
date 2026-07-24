# Pregnancy Phase — Planning (Discussion Stage)

**Status: Discussion only — NOT planned, NOT started.**

> ⚠️ This document is the **opening of a conversation**, not a finalized plan. Nothing here is
> decided. It captures initial suggestions and the shape of the problem so we have something to
> react to. Every section below needs further discussion before any sessions are specced or any
> code is written. Treat all "suggestions" as proposals to debate, not commitments.
>
> Per project convention, this stays at the discussion stage until we work through the open
> questions together; only then does it become `sN-*.md` session files + `session-prompts.md`.

**Related:** `plans/storybook-v2/planning.md` §5 (Pregnancy Track brief) + Group C — this folder
supersedes/expands that brief once we commit to it.

---

## 1. The idea

Let parents start using CradleHQ **before the baby arrives** — a pre-birth / pregnancy phase. Today
the app hard-assumes a baby already exists. A pregnancy phase would let an expecting parent begin at
day one of pregnancy, capture months of memories, and roll all of it straight into the memory book.

**Why it's worth discussing:** it meaningfully expands the addressable audience (start at conception,
not birth) and front-loads emotional content into the book before the baby is even here.

---

## 2. Initial suggestions (all up for debate)

### 2.1 The real work is app *state*, not features
The biggest lift is a **pre-baby mode**. Today the auth gate goes straight to the main app and
everything hangs off `baby_profiles` assuming a born baby.
- Add an `expecting` status (or treat a set `due_date` with no `birthdate` as "pregnancy mode").
- Onboarding asks "Expecting, or already arrived?" and routes accordingly.
- Track / Health / Memories tabs need an "expecting" variant or stay hidden until birth.

### 2.2 Model pregnancy as the *same profile*, pre-birth
Lean toward one continuous record rather than a separate entity: `baby_profiles` gains `due_date`,
and **birth is just the moment `birthdate` gets filled in.** This makes the birth transition trivial
— bump diary, pre-birth letter, and prenatal journal all stay attached and flow into the book.
*(Open question: does a not-yet-named baby break assumptions elsewhere? See §4.)*

### 2.3 Reuse existing surfaces instead of building new ones
- **Journal** → pregnancy journal via a `phase: pregnancy` flag (reuse entries + AI summarizer).
- **Appointments** → prenatal appts (scans, midwife) on the existing appointment system.
- **Growth** → flip to track *mum's* weight / a bump (fundal-height) measure.
- **Milestones** → week-by-week pregnancy milestones (heartbeat, first kick, viability, full-term)
  reusing the existing milestone-key pattern.

### 2.4 The one genuinely new feature: Bump Diary
Weekly photo uploads keyed by gestational week, grouped by trimester (the `pregnancy_photos` table
sketched in storybook-v2 §5). This is the emotional hook and feeds a **Bump Diary gallery chapter**
in the book — could reuse the new `GalleryPage` renderer.

### 2.5 Storybook V2 fit
A "Before You Arrived" chapter slots cleanly into the guided book arc (sv2-s6) ahead of the Birth
chapter: pre-birth letter → bump diary gallery → birth day. Most renderers already exist
(`LetterPage`, `GalleryPage`, `BirthDayPage`), so book integration may be lighter than expected.

### 2.6 Don't skip the hard one: loss & sensitivity
A pregnancy phase means the app can hold data for a pregnancy that does not end in a birth. This
needs a **deliberate, early decision**, not a retrofit:
- Graceful archive/delete; quiet, easy data export.
- No celebratory nudges/notifications on an archived or ended pregnancy.
- Careful, gentle copy throughout.
This is as much a product/ethics conversation as an engineering one.

---

## 3. Rough scope sketch (illustrative only — do not treat as a backlog)

Possible data additions (all from the storybook-v2 brief, repeated here for context):
```sql
ALTER TABLE baby_profiles ADD COLUMN due_date DATE;          -- or compute retroactively

CREATE TABLE pregnancy_photos (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  week_number     INT NOT NULL,            -- 8, 12, 20, 28, 36 ...
  taken_date      DATE,
  image_url       TEXT NOT NULL,
  caption         VARCHAR(200),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
Possible feature buckets (sequence TBD): pre-baby onboarding/mode · pregnancy journal flag ·
prenatal appointments · bump diary · pregnancy milestones · birth-transition flow · "Before You
Arrived" book chapter.

---

## 4. Open questions — resolve together before planning locks in

1. **Profile model:** Same `baby_profiles` record pre-birth, or a separate `pregnancies` entity that
   converts at birth? (Affects everything downstream.)
2. **Naming:** Baby often has no name yet during pregnancy — how do we refer to them across the UI,
   AI prompts, and the book? ("Baby", a nickname/"bump name", placeholder?)
3. **Onboarding split:** How invasive is the "expecting vs arrived" branch? Does it complicate the
   existing happy path for users who join post-birth?
4. **Which existing tabs reshape vs hide** during pregnancy mode?
5. **Birth transition UX:** What exactly happens the day the baby arrives — a guided "add birth
   details" moment? Auto-carry of all pregnancy data?
6. **Loss / sensitivity policy:** What's the product stance, and what flows/copy does it require?
   (Needs an explicit decision before build.)
7. **Scope vs the rest of the roadmap:** Is this before, after, or interleaved with storybook-v2 and
   the LULU/payments work? It's a large track.
8. **Retroactive use:** Support parents who join post-birth but want to fill in pregnancy
   retrospectively (no real-time due_date)?

---

## 5. Next step

**Discuss the open questions in §4 — especially #1 (profile model), #2 (naming), and #6
(loss/sensitivity), since those gate everything else.** Once we have direction, we break this into
`sN-*.md` sessions + a `session-prompts.md`, the same way storybook-v2 is structured.
