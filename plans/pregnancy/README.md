# Pregnancy Mode — Plan Overview

## Goal
Extend CradleHQ backwards in time so the app covers the **whole journey from bump to baby**, not
just from birth onward. A user signs up while expecting, lives in the app for ~9 months, then
transitions seamlessly into the existing baby-tracking experience on the **same profile** — with
every pregnancy memory (bump photos, "we found out," first kick) flowing into the **same storybook**.

## Strategy — keepsake-first
Every pregnancy app does week-by-week tracking and a kick counter. Almost none turn the pregnancy
into a beautiful artifact. Our moat is the **storybook keepsake**, so pregnancy mode is built as a
*memory engine*, not a clinical tracker. Decisions confirmed with Michael (2026-06-16):

- **Core role:** keepsake-first. Trackers are secondary and deliberately minimal.
- **The hero feature** is the **weekly "size of your baby" card** ("Week 24 — as big as a
  cantaloupe") with **simple illustrations**. It is the most-loved feature in pregnancy apps and is
  really a *static dataset*, not a tracker — low effort, high delight, no medical liability.
- **Trackers we keep:** bump photo diary + prenatal appointments (the latter reuses the existing
  appointment feature almost verbatim).
- **Trackers we drop (for now):** contraction timer, weight gain tracker, symptom tracking, full
  kick counter. (A "first kick" *first-time* moment may come later — it is a memory, not a tracker.)
- **Structure:** one profile, two phases. `baby_profiles` gains a `due_date` and an explicit,
  **user-controlled `phase`** field — the user swaps between pregnancy and baby mode themselves; the
  birthdate is *data*, not an automatic switch (handles late/early births and looking back at the
  bump diary after birth). Onboarding asks new users **"expecting"** or **"already have your baby."**

## The size dataset (why it's the cheap win)
One ~37-row table (weeks 4 → 40) is the spine of the whole mode. Each row carries the comparison
object + illustration, approximate length/weight, and a one-line "what's developing." That single
dataset powers **both** the size comparison **and** the week-by-week development content. We author
our own copy + illustrations (the fruit-size data is widely published and roughly consistent, but we
do not lift anyone's verbatim).

## The keepsake payoff
The weekly size card is not a standalone info screen — it is a **keepsake object**. Paired with the
user's bump photo for that week it becomes (a) a shareable social card, (b) a journal/first-time
entry, and (c) a storybook page that drops straight into the book we already built. Social-card
*image* sharing is its own cross-cutting effort — see `plans/social-sharing/`.

## Phase — user-controlled, not auto-derived
The active phase is a **stored field the user sets/toggles**, not something inferred from dates:
- Onboarding sets the initial `phase` from the user's "expecting / have baby" choice.
- A **swap control** lets the user move between pregnancy and baby mode at any time.
- "Mark as born" records `birthdate` **and** swaps `phase` to baby — but it is reversible, so a late
  or early birth (or wanting to revisit the bump diary post-birth) never traps the user in the wrong
  mode.
- Legacy profiles with no stored `phase` fall back to a derived guess (`birthdate` → baby,
  else `due_date` → pregnancy) so existing baby-mode users are unaffected.

Current pregnancy week is pure date math from `due_date` (due date = LMP + 280 days, so
`weeksPregnant = floor((today − (due_date − 280d)) / 7)`). Nothing is ever orphaned — both dates and
all memories live on the one profile regardless of the active phase.

## Sessions
| Session | Scope | Status |
|---------|-------|--------|
| S1 | Data model (`due_date` + user-controlled `phase`) + onboarding phase choice + phase swap + "mark as born" | Complete |
| S2 | Pregnancy home: countdown + weekly size/development card + the size dataset + prenatal appointments reuse | Complete |
| S3 | Bump photo diary (weekly photo paired with size) | Complete |
| S4 | Storybook pregnancy tie-in (bump photos + pre-birth entries flow into the book) | **Deferred → Storybook V2** (`plans/storybook-v2/pregnancy-track.md`) |
| S5 | Pregnancy tabbed shell (Home · Appointments · Bump) + bump-diary-as-journal (photo optional) + UI parity + derive week from date | Not started |

> **S4 deferred (2026-06-18):** the storybook tie-in is built against the v2 **Guided Book**, not the
> current scrapbook wizard — see `plans/storybook-v2/pregnancy-track.md`. S5 still ships here: it
> produces the phase-flagged, date-driven pre-birth journal data that the v2 chapter consumes.

## Out of scope (this plan)
- Social-card image generation / sharing — see `plans/social-sharing/`.
- Contraction timer, weight tracker, symptom tracking, full statistical kick counter.
- Community / "birth club" forums, 3D fetal models, expert content library.
