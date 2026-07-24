# SV2-S2 — Birth Stats Card

**Status: Complete (verified 2026-06-27).** See "As built" below. (PUT text-block `RETURNING` bug +
the builder empty-state overlay glitch were fixed during verification.)

## As built (2026-06-26)
- **Units:** the app has **no metric/imperial toggle** — growth tracking is hardcoded imperial. So
  birth details use **lbs / inches** (`weight_lbs`, `height_in`, `head_in`), matching `growth_records`
  — a deliberate deviation from the kg/cm in the draft schema below.
- **Backend:** `V40__create_birth_details.sql` + `com.gotcherapp.api.birthdetails` package
  (`BirthDetails` record, `BirthDetailsRequest`, `BirthDetailsService`, `BirthDetailsController`).
  `GET /birth-details` (always returns a shape — empty record when none), `PUT /birth-details`
  (upsert). `birth_photo_url` included; no SecurityConfig change.
- **Data entry:** the **Birth details tab** in the Edit-Profile modal (`ProfileEditModal.jsx`) — time,
  hospital, weight/length/head, birth-type pills, birth story, birth photo (via `/upload?context=birth_details`).
  Saved alongside the profile on "Save profile". Dashboard nudge now opens this tab; the summary card
  shows birth Weight when present.
- **Book page:** `BirthDayCanvas.jsx` (data-driven, live-reads birth_details) + `birth_day` template
  + dispatch in ScrapbookBuilder / LayoutRenderer / storybookPdf + a TemplateSheet thumb. Hero photo
  falls back to the cover photo. Live-read data is threaded via a `pageData` prop from StorybookTab.

**Original status: Not started** (planning resolved 2026-06-25 — see Decisions locked)
**Depends on:** **`sv2-profile-modal.md`** (the birth-details form lives as a tab in the new Edit-Profile
modal — build that shell first, or build the tab standalone and slot it in). NOT blocked on Payments — core v2 ships free (§8).
**Reference:** `planning.md` Q5 — `birth_details` table; `planning.md` §8 — AI model; mockups
`mockups/s2-birth-stats.html` + `mockups/s2-profile-modal.html`

---

## ✅ Decisions locked (2026-06-25)

- **Where the data is entered:** the **Birth details tab of the Edit-Profile modal**
  (`sv2-profile-modal.md`) — **not** a Dashboard card or Health-tab section (the earlier "form placement"
  options are superseded). S2 delivers that tab's fields + saves; the modal shell is built by the
  profile-modal plan.
- **Data binding:** **live read** — the book page reflects current `birth_details`; editing the data
  updates the page (no snapshot-into-blocks).
- **Units:** **follow the existing measurement preference** (kg/cm vs lb/oz/in), consistent app-wide.
- **Book page design:** **Keepsake / Precious-Five** (centered, polaroid hero, WEIGHT·LENGTH·HEAD·TIME
  stat strip, warm note card) — matches the existing moment-hero & letter pages. Built as a
  **`BirthDayCanvas` renderer + `birth_day` template + dispatch in ScrapbookBuilder / LayoutRenderer /
  storybookPdf + a TemplateSheet thumb** — the template/renderer pattern (like letter & gallery), **NOT
  an `anchor_type` chapter** (see the §0 callout above).
- **Hero photo:** add **`birth_photo_url`** to `birth_details` (its own upload), **falling back to the
  book cover photo** when unset.
- **Birth type options:** **Natural · C-section · Induced · Other** (field optional / can be blank).
- **Note:** parent-written `birth_story` shown as-is by default; optional per-field AI assist layered on
  later via `sv2-ai-assist`. Build the manual path first.
- **Backend:** `GET/PUT /birth-details`; **no SecurityConfig change** (`anyRequest().authenticated()`).
  Photos reuse the existing `/upload` (no new multipart endpoint) — same simplifications confirmed in s4.

> Schema note: add `birth_photo_url TEXT` to the `birth_details` CREATE TABLE below.

---

**⭐ AI model (planning.md §8):** the book is **AI-free by default**. The birth note is **written by the
user** (or left blank). AI is a **separate, opt-in, paid-gated, per-field "✨ write this for me" assist**
— built once in `sv2-ai-assist` and wired into the note field later; it words the *one* note field, it
never generates the page. **Build the manual note path first.** Seed the field with the parent's own
birth-story text rather than a blank box. For free users the assist affordance is visible-but-inert (upsell).

---

**⭐ Page-type pattern (DECIDED 2026-06-24 — see `planning.md` §0 + `sv2-s1`):** `BirthDayPage` is a
**layout template + renderer in the book canvas** (the moment-hero pattern), **NOT an `anchor_type='birth_day'`
chapter.** Add a `renderer: 'birth_day'` template to `lib/storybookTemplates.js` + a `BirthDayCanvas`
renderer dispatched in `ScrapbookBuilder` / `LayoutRenderer` / `storybookPdf.js` (+ a `TemplateSheet`
thumb); it's added via the builder's template picker and stored in `layout_data`. The **data**
(`birth_details`) keeps its own table + `GET/PUT /birth-details` endpoint, but the **page itself** has
**no anchor_type, create endpoint, or chapter migration**. The "`anchor_type = 'birth_day'` … chapter
type" line in §6 below is **superseded** by this.

---

## Goal

Build the **"The Day We Met You"** page — a birth-day moment-hero page showing the birth date, hospital, weight/length/head/time stats card, a hero photo, and a short note written by the parent. Backed by a new `birth_details` table that consolidates all birth-day data in one place.

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
  birth_story     TEXT,           -- short free-text from parent; doubles as the note (and seed for optional AI assist)
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

The birth story text is the parent's own note — displayed on the page by default. (The optional
per-field AI assist, when wired later, can reword/expand it; it is not required to show the note.)

### 3. `BirthDayPage.jsx` component
New file: `Frontend/src/components/storybook/BirthDayPage.jsx`

Fixed layout. Props:
```js
{
  birthDetails: BirthDetails,
  birthdate: Date,
  babyName: String,
  note: String,            // parent-written (birth_story); optionally AI-assisted later
  theme: BookTheme,
}
```

Layout:
- "THE MOMENT OUR WORLD CHANGED FOREVER" — small caps label
- Large title: "The day we met you"
- Birth date + hospital as subtitle
- Hero photo (birth_details photo or cover photo fallback)
- Stats card row: WEIGHT · LENGTH · HEAD · TIME — each with value below
- Note card — the parent's written birth note (`birth_story`)
- Decorative elements

### 4. Birth photo

The birth stats card in Precious Five uses a specific birth-day photo (not the cover photo). Options:
- Reuse cover photo as fallback
- Add a `birth_photo_url` field to `birth_details`
- Allow any photo upload in the BirthDayPage component

Decide at session start. Simplest: `birth_photo_url` on `birth_details`.

### 5. Note (manual; optional AI assist later)

Default: the parent's `birth_story` text **is** the note, shown as-is. No generation step this session.
The optional shared per-field assist (`sv2-ai-assist`, paid-gated) can later reword/expand it — suggested
prompt: *"Write a warm, 2–3 sentence note about the day [baby name] arrived on [birthdate] at [hospital].
Use the parent's words as inspiration: [birth_story]."* — but that's opt-in garnish, not the default.

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
4. The parent's birth_story note displays on the page (no generation needed).
5. PDF export captures the stats card correctly (html2canvas renders the stats row cleanly).
6. Existing chapters unaffected.
