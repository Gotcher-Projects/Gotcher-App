# SV2-S2 — Birth Stats Card

**Status: Not started**
**Depends on:** sv2-s1 complete (or can run independently — no shared dependencies)
**Reference:** `planning.md` Q5 — `birth_details` table decided

---

## Goal

Build the **"The Day We Met You"** page — a birth-day moment-hero page showing the birth date, hospital, weight/length/head/time stats card, a hero photo, and an AI-generated note. Backed by a new `birth_details` table that consolidates all birth-day data in one place.

This is the most data-rich page type in the v2 book. It's also a meaningful standalone improvement — parents want to record birth details somewhere in the app regardless of the book feature.

---

## Schema

### New migration: `Vxx__create_birth_details.sql`
```sql
CREATE TABLE birth_details (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE UNIQUE,
  birth_time      TIME,
  hospital        VARCHAR(200),
  weight_kg       NUMERIC(5,3),
  height_cm       NUMERIC(5,1),
  head_cm         NUMERIC(5,1),
  birth_type      VARCHAR(50),    -- 'natural', 'c-section', 'induced', 'other'
  birth_story     TEXT,           -- short free-text from parent; feeds AI note
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`birthdate` stays on `baby_profiles` — it's used app-wide (age calculations, milestone weeks, etc.).

`weight_kg / height_cm / head_cm` on `birth_details` are the birth-day measurements. `growth_records` continues to serve as the ongoing tracking table. They overlap intentionally — different purposes (birth snapshot vs recurring health tracking). Users can fill in both independently.

---

## Scope

### 1. Backend

**New package:** `com.gotcherapp.api.birthdetails`
- `BirthDetails` record
- `BirthDetailsRequest` DTO (all fields optional — PATCH semantics)
- `BirthDetailsService` — get/upsert by baby_profile_id
- `BirthDetailsController` — `GET /birth-details`, `PUT /birth-details`

### 2. Frontend — Birth Details Form

A form accessible from the Dashboard tab (under baby profile section) or the Book tab. Fields:
- Time of birth (time picker or text input)
- Hospital / birth location
- Weight (kg or lbs — respect existing unit preference)
- Length / height (cm or inches)
- Head circumference
- Birth type (dropdown: Natural, C-section, Induced, Other)
- Birth story (textarea — "Tell us about the moment you met [baby name]")

The birth story text is the user's input for AI note generation — not displayed as-is.

### 3. `BirthDayPage.jsx` component
New file: `Frontend/src/components/storybook/BirthDayPage.jsx`

Fixed layout. Props:
```js
{
  birthDetails: BirthDetails,
  birthdate: Date,
  babyName: String,
  generatedNote: String,
  theme: BookTheme,
}
```

Layout:
- "THE MOMENT OUR WORLD CHANGED FOREVER" — small caps label
- Large title: "The day we met you"
- Birth date + hospital as subtitle
- Hero photo (birth_details photo or cover photo fallback)
- Stats card row: WEIGHT · LENGTH · HEAD · TIME — each with value below
- Note card — AI-generated from birth story input
- Decorative elements

### 4. Birth photo

The birth stats card in Precious Five uses a specific birth-day photo (not the cover photo). Options:
- Reuse cover photo as fallback
- Add a `birth_photo_url` field to `birth_details`
- Allow any photo upload in the BirthDayPage component

Decide at session start. Simplest: `birth_photo_url` on `birth_details`.

### 5. AI note generation

Prompt: *"Write a warm, 2–3 sentence note about the day [baby name] arrived on [birthdate] at [hospital]. Use the parent's words as inspiration: [birth_story]. Tone: deeply personal, emotional, joyful."*

### 6. Chapter type

`BirthDayPage` is a chapter type (`anchor_type = 'birth_day'`, `anchor_key = 'birth'`). One per book. Created via "Add Birth Day page" in the Book tab or auto-created by the guided book shell (sv2-s6).

### 7. PDF export

Add to `storybookPdf.js` — off-screen render + html2canvas capture.

---

## Files to touch

| File | Change |
|---|---|
| `Backend/db/migration/Vxx__create_birth_details.sql` | New table |
| `Backend/.../birthdetails/` | New package — record, DTO, service, controller |
| `Backend/.../config/SecurityConfig.java` | Allow `/birth-details` endpoints |
| `Frontend/src/components/storybook/BirthDayPage.jsx` | New — fixed-layout birth day renderer |
| `Frontend/src/components/tabs/DashboardTab.jsx` | Add birth details form (or new BirthDetailsForm component) |
| `Frontend/src/components/tabs/StorybookTab.jsx` | Render BirthDayPage for birth_day chapters |
| `Frontend/src/lib/api.js` | Add getBirthDetails / saveBirthDetails helpers |
| `Frontend/src/lib/storybookPdf.js` | Handle birth_day chapter type |

---

## Open questions (resolve at session start)

1. **Birth photo:** Reuse cover photo, or add `birth_photo_url` to birth_details?
2. **Form placement:** Dashboard tab alongside baby profile, or exclusively in the Book tab flow?
3. **Unit display on stats card:** kg/cm or lbs/oz/in? Follow existing unit preference from growth tracking.
4. **Birth type values:** Confirm the list (Natural / C-section / Induced / Other) — user may want additions.

---

## Verification

1. Fill in birth details form → data persists via PUT /birth-details.
2. BirthDayPage shows correct stats (weight/length/head/time) pulled from birth_details.
3. Stats display correctly regardless of whether some fields are empty (graceful nulls).
4. AI note generates from birth_story input.
5. PDF export captures the stats card correctly (html2canvas renders the stats row cleanly).
6. Existing chapters unaffected.
