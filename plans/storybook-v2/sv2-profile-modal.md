# SV2 · Profile → Edit-Profile Modal (Dashboard refactor)

**Status: Complete (verified 2026-06-27).** See "As built" below.

## As built (2026-06-26)
Build decisions (the open questions, resolved with the user):
- **Birth-details tab — HIDDEN** until sv2-s2 ships. Modal has two tabs: `Basics` + `Parent & contact`.
  When S2 lands, add the third tab in `ProfileEditModal.jsx` (`TABS` array).
- **First-run — prominent CTA**, no auto-open. Empty profile (no name & no birthdate) shows a dashed
  "Set up profile" card; otherwise the summary card with "✎ Edit profile".
- **Avatar — reused the shared portrait crop in a circle** (no change to `imageUtils` crop modal).
- **Email** in the modal is read-only (account-level), with a note pointing to account settings.
- **Empty-state nudge** ("Add birth details to unlock …") is gated behind `SHOW_BIRTH_DETAILS_NUDGE`
  in `DashboardTab.jsx` — flip to `true` once S2's book page exists.

Files:
- `Backend/db/migration/V39__add_photo_to_baby_profiles.sql` — `photo_url` column.
- `BabyProfileService` / `Controller` / `BabyProfileResponse` — `photoUrl` in get/upsert + `POST
  /baby-profile/photo` upload (mirrors `/cover-photo`).
- `Frontend/src/components/ui/Avatar.jsx` (new) — circular photo/initial avatar.
- `Frontend/src/components/tabs/ProfileEditModal.jsx` (new) — tabbed modal, snapshot-on-open discard.
- `Frontend/src/components/tabs/DashboardTab.jsx` — form replaced with summary card + modal mount.
- `Frontend/src/components/CradleHq.jsx` — `photoUrl` state/load/save + `uploadProfilePhoto` handler.

Verify: backend migration applies; upload a photo; edit Basics / Parent & contact and Save reflects on
the card; Cancel discards text edits; new/empty profile shows the setup CTA.

---

**Original status: Not started**
**Depends on:** nothing (foundational dashboard refactor). **Blocks/feeds:** `sv2-s2-birth-stats-card.md`
— S2's Birth-details fields live inside the modal this plan builds.
**Reference:** mockup `mockups/s2-profile-modal.html` (Option A), discussion 2026-06-25.

> Kept inside `storybook-v2/` deliberately — it's a standalone dashboard refactor, but we're treating
> the folder as a connected sprint, so it rides along here rather than in its own top-level folder.
> Implementation is **deferred** (planned now, built another day); tonight is planning only.

---

## Decisions locked (2026-06-25)
- **Replace the always-open "Profile Setup" form** on the dashboard with a **compact profile summary
  card + an "Edit profile" button** (the "After" in the mockup).
- The button opens an **Edit Profile modal — Option A (tabbed):** `Basics` · `Birth details` · `Parent & contact`.
- **Add a baby photo** (avatar) shown on the summary card and editable in the modal — new field.
- Units in the modal follow the existing measurement preference (consistent with S2).

---

## Why
Today "Profile Setup" is a permanently-open edit form occupying the **entire left column** of the
dashboard (name, birthdate, sex, parent name, email, phone, Save) — set-once data sitting open forever
next to live milestone progress. Moving it into a modal reclaims ~half the dashboard and gives the
**detailed, rarely-edited info (birth details, photo) a natural home** instead of cluttering the page.

---

## Current state (verified 2026-06-25)
- `baby_profiles` columns: `baby_name, birthdate, parent_name, phone, sex, book_theme,
  cover_photo_url, cover_subtitle, due_date, phase`. **No baby avatar/profile photo** — `cover_photo_url`
  is the *book cover* (separate concern), with its own `POST /baby-profile/cover-photo` upload.
- The form's **"Email"** field is the **account email** (users table / auth), not a `baby_profiles`
  column — so the Parent & contact tab edits `parent_name` + `phone` here, and email is account-level
  (likely read-only or links to account settings — confirm).
- Frontend form lives in `Frontend/src/components/tabs/DashboardTab.jsx`; profile save goes through the
  existing `PUT/POST /baby-profile` (`BabyProfileController` / `BabyProfileService` / `BabyProfileRequest`).

---

## Scope

### 1. Dashboard summary card (replaces the form)
`DashboardTab.jsx` left column becomes a **Profile card**:
- Baby **photo/avatar** + name + age (derived) + sex.
- A small **stat row** (e.g. Born · Weight · Parent) — Weight/Born pull from birth details once S2 lands;
  before then, show what exists and omit the rest gracefully.
- **"✎ Edit profile"** button → opens the modal.
- A subtle **nudge** when birth details are empty: *"Add birth details to unlock 'The Day We Met You'
  book page →"* (only meaningful once S2 ships; can ship inert/hidden until then).
- **First-run / empty profile:** a clear "Set up profile" CTA (modal can auto-open for a brand-new
  profile). Confirm behaviour.

### 2. Edit Profile modal — Option A (tabbed)
A modal dialog with three tabs:
- **Basics** — baby name, birthdate, sex, **baby photo** (this plan).
- **Birth details** — time, hospital, weight/length/head, birth type, birth story. **Built by `sv2-s2`**
  (fields + `birth_details` table/endpoint + the book page). **This plan builds the modal tab-ready**
  (the tab exists; S2 fills it). Until S2, the tab can be hidden or show a "coming soon"/disabled state —
  decide at build.
- **Parent & contact** — parent name, phone. **Email is account-level (NOT a `baby_profiles` column)**
  — shown read-only / as a link to account settings, never edited as a profile field. (Decided 2026-06-25.)

Save writes through the existing `/baby-profile` endpoint (extended for the photo); Birth-details save is
S2's separate `/birth-details` endpoint. Cancel/close discards. Reuse the app's existing modal primitive.

### 3. Baby photo (avatar) — new field
- Add **`photo_url`** to `baby_profiles` (new migration). (Alternative considered: reuse
  `cover_photo_url` — rejected: the cover is a book artifact and wants a different crop; the avatar wants
  a **square** portrait.)
- Upload: mirror the existing **cover-photo** pattern — either a dedicated
  `POST /baby-profile/photo` (like `/cover-photo`) or the generic `/upload` → URL then save. Square crop.
- Surface on the summary card and in the Basics tab.

---

## Relationship to sv2-s2
| This plan (profile modal) | sv2-s2 (birth stats) |
|---|---|
| Summary card + Edit button | — |
| Modal shell + Basics + Parent & contact tabs | **Birth details tab content** |
| Baby photo field | `birth_details` table + `GET/PUT /birth-details` |
| — | `BirthDayCanvas` book page (live-read) |

Build order: **profile modal first** (refactor + photo + tab-ready shell), then S2 fills the Birth-details
tab and ships the book page. Each is independently verifiable.

---

## Files to touch (anticipated)
| File | Change |
|---|---|
| `Backend/db/migration/Vxx__add_photo_to_baby_profiles.sql` | New `photo_url` column |
| `Backend/.../baby/BabyProfileController.java` / `BabyProfileService.java` | Photo upload + include `photo_url` in get/save |
| `Backend/.../baby/dto/BabyProfileRequest.java` / `BabyProfileResponse.java` | Add `photoUrl` |
| `Frontend/src/components/tabs/DashboardTab.jsx` | Replace form with summary card; mount modal |
| `Frontend/src/components/.../ProfileEditModal.jsx` (new) | Tabbed Basics / Birth details / Parent & contact |
| `Frontend/src/components/CradleHq.jsx` | Wire profile photo upload handler |

---

## Open questions (resolve at build)
1. **Birth-details tab before S2 lands:** hidden, or visible-but-disabled ("coming soon")?
2. ~~Account email in the modal~~ — **DECIDED (2026-06-25):** email is **account-level**, shown
   read-only / link to account settings; not a profile field, not a `baby_profiles` column.
3. **First-run:** auto-open the modal for a new/empty profile, or just a prominent CTA?
4. **Summary stat row contents** before birth details exist (which 2–3 stats to show).
5. ~~Photo source~~ — leaning new `photo_url` (square avatar); confirm at build.

---

## Verification
1. Dashboard shows the summary card (photo, name, age, sex) instead of the open form; layout reclaims the space.
2. "Edit profile" opens the tabbed modal; editing Basics / Parent & contact saves and reflects on the card.
3. Baby photo upload (square crop) persists and shows on the card.
4. New/empty profile has a clear setup path.
5. Frontend build + tests green; existing profile save still works.
