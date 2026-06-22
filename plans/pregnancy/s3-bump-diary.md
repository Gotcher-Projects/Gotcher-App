# S3 — Bump Photo Diary

**Status: Complete** (implemented + confirmed working by Michael 2026-06-17)

> **Follow-ups deferred to S5** (`s5-pregnancy-flow-alignment.md`): bringing the pregnancy home /
> bump diary visually in line with the baby flow, and deriving the week from the entry's date.
**Branch:** `pregnancy-updates`
**Depends on:** S2 complete (pregnancy home + size dataset live).

> **Split note (2026-06-17):** the original S3 covered both the bump diary *and* the storybook
> tie-in. Those are two different kinds of work — a self-contained new CRUD feature vs. an
> additive change to the intricate, fragile storybook builder — so they were split. This file is
> the bump diary (self-contained, low risk). The storybook tie-in is **S4**
> (`s4-storybook-pregnancy-tie-in.md`).

---

## Context
The bump diary is the visual backbone of a pregnancy keepsake: a weekly belly photo, each one
**paired with the baby's size that week** ("Week 24 · bump + cantaloupe"). It reuses the existing
photo upload + crop pipeline. It is a self-contained CRUD feature — new table, new package mirroring
`firsttimes`, one new editable component mounted in two places.

## Decisions (confirmed 2026-06-16 — do not re-litigate)
- Bump diary is **kept** (one of the two trackers we want). Each photo is **paired with the weekly
  size** from `pregnancySizes.js`.
- Reuse the existing **photo upload + crop** flow (`openCropModal`, `/upload?context=...`). No new
  crop UI.

## Decisions (confirmed 2026-06-17 — do not re-litigate)
- **No `crop` column — store `image_orientation` only.** The original plan specced a `crop JSONB`
  column "same shape as journal," but neither journal nor first_times stores a crop region: the crop
  is baked into the uploaded image client-side by `openCropModal` before upload, and only
  `image_orientation` is persisted. Bump photos follow the same pattern so they render identically to
  every other photo in the app. (No re-crop of an existing photo exists anywhere today; not adding
  one here.)
- **Many photos per week allowed — NO unique constraint.** A user can add multiple entries to the
  same week (supports treating it as a richer pregnancy journal, not just one canonical weekly shot).
  The timeline is **grouped by week with "Week N" divider rules** (mirrors `JournalTab`'s
  `groupByMonth` month-divider pattern in `MemoriesTab.jsx`) so several same-week entries read as one
  section, not disconnected repeats. Sorted **week ASC** (scrolling = watching the bump grow).
- **Each entry has a `taken_date`** (the date field), shown in the add form (next to Week) and on the
  card. Week stays the grouping/size-pairing axis; date is the human "when."
- **Default week:** current `weeksPregnant` in pregnancy mode; in baby mode (backfilling old photos,
  where `weeksPregnant` is meaningless) default to the **first empty week**, always editable.
- **Portrait OR landscape, like Journal/Firsts.** Orientation comes from the crop step
  (`openCropModal` returns it). Card keeps the same caption-below layout in both; only the photo
  aspect changes (3:4 portrait vs 3:2 landscape).
- **Shared, reusable `<BumpCard>` presentational component.** The "photo + size-pairing caption"
  unit is reused as an **S4 storybook page** and (later) a **social card**, so it is extracted as its
  own component from the start (NOT inlined like the other tabs' cards). Photo-forward: photo on top,
  caption below = size pairing (hero) + date + optional note, then edit/delete.
- **Visual reference:** `plans/pregnancy/bump-diary-demo.html` (static mock, approved 2026-06-17 —
  CradleHQ palette, real dataset sizes, both orientations, the many-per-week case, week dividers).

---

## Backend

### Migration — `V36__create_bump_photos.sql`
```sql
CREATE TABLE bump_photos (
  id                BIGSERIAL PRIMARY KEY,
  baby_profile_id   BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  week              INT NOT NULL,                 -- pregnancy week the photo represents
  image_url         TEXT NOT NULL,
  note              TEXT,
  taken_date        DATE,
  image_orientation VARCHAR(16) NOT NULL DEFAULT 'portrait',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bump_photos_baby ON bump_photos(baby_profile_id);
```

### New package `com.gotcherapp.api.bump`
Mirror `com.gotcherapp.api.firsttimes` exactly (record + service + controller + DTOs):
| Method | Path | Description |
|---|---|---|
| GET | /bump-photos | List for current user's baby, ordered by `week` ASC |
| POST | /bump-photos | Create (week, image_url, note?, taken_date?, image_orientation?) |
| PATCH | /bump-photos/{id} | Update week / note / taken_date / image_url / image_orientation |
| DELETE | /bump-photos/{id} | Delete |

JWT-protected; ownership via `baby_profile_id`. Image upload reuses
`POST /upload?context=bump_photos` — **confirm `UploadController` whitelists/accepts that context**
(it `switch`es on `context` for the Cloudinary folder; add a `bump_photos` arm if needed).

---

## Frontend — Bump Diary

Two new files:
- `Frontend/src/components/pregnancy/BumpCard.jsx` — **shared presentational card** (photo + size
  caption + date + note + edit/delete). Photo-forward, caption below, portrait/landscape via
  `image_orientation`. Reused by the diary now and by S4 (storybook) / social-sharing later. Renders
  the size via `sizeForWeek(week)` + the bundled Twemoji icon (`twemojiSrc`), matching `PregnancyHome`.
- `Frontend/src/components/pregnancy/BumpDiary.jsx` — the add form + week-grouped timeline of
  `<BumpCard>`s.

> Build the diary as **one editable component mounted in both modes** — not read-only after birth. In
> pregnancy mode it lives on the pregnancy home; in baby mode it's mounted as a **"Bump"/"Pregnancy"
> pill in the Memories tab** (`MemoriesTab` + `PillNav`), data-gated on the profile having pregnancy
> data (decided in S2). Per S1, viewing/editing pregnancy content does NOT require swapping phase
> back. Same component, two mount points — keep it phase-agnostic.

- **Add form:** fields = **Week** (defaults per the rule above, editable) · **Date** (`taken_date`) ·
  **Photo** (required) · **Note** (optional). Photo via the existing
  `openCropModal(file, onComplete, onCancel)` flow → `POST /upload?context=bump_photos` → store URL +
  orientation. Match the sticky-left-card / list-right layout the other Memories tabs use.
- **Timeline:** grouped by week with **"Week N" divider rules** (the `groupByMonth` pattern, by week),
  sorted week ASC. Within a week, one or more `<BumpCard>`s flow in a responsive grid (single column on
  mobile). Each card shows the photo + paired size caption from `sizeForWeek(week)`:
  "Week {week} · {label}" + date + optional note.
- Edit note / replace photo (re-crop via `openCropModal`) / delete per card — reuse the
  journal/first-times card edit patterns.

> See `feedback_photo_utils_patterns` for the `openCropModal` signature and the `pickPhoto()` web
> fallback before wiring uploads. See `plans/pregnancy/bump-diary-demo.html` for the approved visual.

### Wiring (`CradleHq.jsx`)
- Add `bumpPhotos` state + `addBumpPhoto / updateBumpPhoto / deleteBumpPhoto` handlers, mirroring the
  `firsts` plumbing. **Fetch bump photos whenever the profile has a `due_date` (in BOTH phases)** —
  the diary is reachable in pregnancy mode and baby mode, so the load is data-gated, not phase-gated.
- Pregnancy mode: mount `<BumpDiary>` in `PregnancyHome.jsx` (its own section).
- Baby mode: pass `bumpPhotos` + handlers + `dueDate` into `MemoriesTab`; render a **"Bump" pill**
  (4th pill after Journal/Firsts/Book) **only when `data.profile.dueDate` is set**, mounting the same
  `<BumpDiary>`.

---

## Testing checklist
- [ ] Migration applies; `/bump-photos` CRUD round-trips (incl. week + `taken_date` + orientation)
- [ ] Ownership: user B cannot mutate user A's bump photo (404/403)
- [ ] `POST /upload?context=bump_photos` returns a usable URL (folder routing correct)
- [ ] Add: defaults to current week in pregnancy mode; first empty week in baby mode; week editable
- [ ] Date field saves + displays on the card
- [ ] Crop flow stores + renders the cropped image; **portrait AND landscape** both render correctly
- [ ] `<BumpCard>` shows the correct paired size caption + Twemoji icon from `sizeForWeek`
- [ ] **Many-per-week:** two entries in the same week both show, grouped under one "Week N" divider
- [ ] Timeline sorted week ASC; week dividers render
- [ ] Diary renders in pregnancy mode (PregnancyHome) AND baby mode (Memories "Bump" pill)
- [ ] Memories "Bump" pill is hidden when the profile has no `due_date`; shown when it does
- [ ] After "mark as born," bump photos remain and the Memories pill still shows them
- [ ] Edit note / replace photo (re-crop) / delete each round-trip

## Out of scope
- Storybook tie-in (pregnancy entries + bump photos into the book) — **S4**.
- Social-card *image* generation/sharing for the size/bump card — `plans/social-sharing/`.
- Kick counter / "first kick" first-time — possible later session.
