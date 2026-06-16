# S3 — Bump Photo Diary + Storybook Tie-in

**Status: Not started**
**Branch:** TBD (continue `feature/pregnancy-mode`)
**Depends on:** S2 complete (pregnancy home + size dataset live).

---

## Context
The bump diary is the visual backbone of a pregnancy keepsake: a weekly belly photo, each one
**paired with the baby's size that week** ("Week 24 · bump + cantaloupe"). It reuses the existing
photo upload + crop pipeline. The second half of this session wires pregnancy memories (bump photos
+ pre-birth journal/first-time entries) into the **existing storybook** so the finished book runs
continuously from bump to baby.

## Decisions (confirmed 2026-06-16 — do not re-litigate)
- Bump diary is **kept** (one of the two trackers we want). Each photo is **paired with the weekly
  size** from `pregnancySizes.js`.
- Reuse the existing **photo upload + crop** flow (`openCropModal`, `/upload?context=...`). No new
  crop UI.

---

## Backend

### Migration — `V36__create_bump_photos.sql`
(Next free V-number.)
```sql
CREATE TABLE bump_photos (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  week            INT NOT NULL,            -- pregnancy week the photo represents
  image_url       TEXT NOT NULL,
  crop            JSONB,                   -- optional stored crop region (same shape as journal)
  note            TEXT,
  taken_date      DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bump_photos_baby ON bump_photos(baby_profile_id);
```

### New package `com.gotcherapp.api.bump`
Mirror `com.gotcherapp.api.firsttimes` exactly (record + repository + service + controller + DTOs):
| Method | Path | Description |
|---|---|---|
| GET | /bump-photos | List for current user's baby, ordered by `week` ASC |
| POST | /bump-photos | Create (week, image_url, crop?, note?, taken_date?) |
| PATCH | /bump-photos/{id} | Update note / crop / taken_date |
| DELETE | /bump-photos/{id} | Delete |

JWT-protected; ownership via `baby_profile_id`. Image upload reuses
`POST /upload?context=bump_photos`.

---

## Frontend — Bump Diary

New component under the pregnancy home (S2): `Frontend/src/components/pregnancy/BumpDiary.jsx`.

- **Add a bump photo:** defaults `week` to the current `weeksPregnant` (editable). Photo via the
  existing `openCropModal(file, onComplete, onCancel)` flow → `POST /upload?context=bump_photos` →
  store URL + crop. Optional note.
- **Timeline:** one card per entry sorted by week. Each card shows the cropped bump photo **with the
  paired size caption** from `sizeForWeek(week)`: "Week {week} · about the size of {label}". This
  size-pairing is the signature object — keep it visually tight; it is reused as a storybook page
  and (later) a social card.
- Edit note / replace photo / delete per card (reuse the journal card patterns).

> See `feedback_photo_utils_patterns` for the `openCropModal` signature and the `pickPhoto()` web
> fallback before wiring uploads.

---

## Storybook tie-in

Goal: the finished book runs **bump → baby**, not just birth onward.

> ⚠️ The storybook source/layout model is intricate (see `project_storybook_architecture`). **Confirm
> the current source model with Michael at session start** before wiring — do not assume the shape.

Intended integration (validate against current code first):
- **Pre-birth journal / first-time entries already flow in** if the book sources memories by date —
  confirm and, if so, no work needed beyond making sure pregnancy-dated entries aren't filtered out.
- **Bump photos** become available storybook source material — surfaced to the wizard/builder the
  same way photos are, with the size-pairing caption as default text (e.g. a ready-made l-wrap page:
  bump photo + "Week 24 · as big as a cantaloupe").
- Consider a default **"Before You Arrived" / pregnancy chapter** grouping bump photos + pre-birth
  entries at the front of the book. Keep this minimal — a grouping/source hook, not a redesign of
  the builder.

Keep the storybook change **additive and small**; the L-Wrap render path in particular has **no
automated coverage** and has regressed silently before (see `project_storybook_lwrap_followup`) —
verify any builder/render change in-app and in a PDF export.

---

## Testing checklist
- [ ] Migration applies; `/bump-photos` CRUD round-trips (incl. crop JSON + week)
- [ ] Ownership: user B cannot mutate user A's bump photo (403)
- [ ] Add bump photo defaults to current week; crop flow stores + renders the crop
- [ ] Card shows the correct paired size caption from `sizeForWeek`
- [ ] Pre-birth journal/first entries still appear in the storybook (date-sourced)
- [ ] Bump photos appear as storybook source material; a bump page builds + renders
- [ ] PDF export of a bump page survives html2canvas (float + caption intact)
- [ ] After "mark as born," bump photos remain on the profile and in the book (nothing orphaned)

## Out of scope
- Social-card *image* generation/sharing for the size/bump card — `plans/social-sharing/`.
- Kick counter / "first kick" first-time — possible later session.
