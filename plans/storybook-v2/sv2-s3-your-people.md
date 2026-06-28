# SV2-S3 — Your People

**Status: Complete (verified 2026-06-27).** See "As built" below. Page polish + circular crop moved to
`sv2-s3.5-people-polish-and-circular-crop.md` (also Complete). (POST `RETURNING` text-block bug fixed
during verification.)

## As built (2026-06-26)
- **Backend:** `V41__create_family_members.sql` + `com.gotcherapp.api.family` package
  (`FamilyMember`, `FamilyMemberRequest`, `ReorderFamilyRequest`, service, controller).
  `GET/POST /family-members`, `PATCH/DELETE /family-members/{id}`, `PUT /family-members/order`.
  No SecurityConfig change. Photos via existing `/upload?context=family`.
- **Entry model (popup at add-page time):** picking the **Your People** template in the builder opens
  `FamilyRosterPopup.jsx` — manages the global roster (add/edit/delete people; name, role + preset
  chips, square photo, optional bio) and selects which members appear on the page + the variant.
  `role_category` is auto-inferred from the role (frontend `inferCategory`). Reopen via "Edit people".
- **Book page:** `PeopleCanvas.jsx` (data-driven, live-reads family_members) + `people` template
  with a `people-config` block storing `{ selectedMemberIds, variant }`. Variants: **two-up** (2) and
  **spotlight** (1). Dispatched in ScrapbookBuilder / LayoutRenderer / storybookPdf + a TemplateSheet
  thumb. Family data threaded via `pageData`; the builder keeps a local roster copy so edits live-render.
- **Note:** a brand-new People page with no selection falls back to showing the first 1–2 roster members.

**Original status: Not started** (planning resolved 2026-06-25 — see Decisions locked)
**Depends on:** the scrapbook builder's add-page flow (the entry UI is a popup launched when adding the
People page). NOT blocked on Payments — core v2 ships free (§8).
**Reference:** `planning.md` Q2 — flexible family members; `planning.md` §8 — AI model; mockup
`mockups/s3-your-people.html`

---

## ✅ Decisions locked (2026-06-25)

- **Entry model — popup at add-page time.** Adding the **"About Your People"** page in the builder opens
  a popup that (a) manages the **global** `family_members` roster and (b) **selects which members appear
  on this page**. People are stored globally (reused across pages + the future family tree); the page
  **block stores the selected member ids + the layout variant**; `PeopleCanvas` **live-reads** those
  members. This popup is the **primary (and for v1, only) entry point** — no separate persistent manager
  for now. (Mirrors S2's "data is global, entry is contextual" model.)
- **List UI inside the popup — roster grid.** Avatar cards + an "Add a person" form, with a small drag
  handle per card to reorder (`sort_order`).
- **Photos — square crop**, uploaded via the existing **`/upload`** → URL then saved (no per-entity
  multipart endpoint; **no SecurityConfig change** — `anyRequest().authenticated()`). Same simplifications
  confirmed in s4.
- **Book page — one `PeopleCanvas` renderer with a `variant` flag:** **two-up** (2 people/page, the
  default the guided book paginates) **+ spotlight** (1 person, bigger). **Bio optional** — no bio =
  photo + name + role. Template/renderer pattern (`people` template + dispatch in ScrapbookBuilder /
  LayoutRenderer / storybookPdf + TemplateSheet thumb), **NOT an `anchor_type` chapter**.
- **Bio — a single `bio` field** (parent-written). **`bio_input` is dropped** (schema below updated). A
  later optional AI assist (`sv2-ai-assist`) works off `bio` / an in-the-moment prompt; add a seed column
  then only if its design needs it.
- **Roles — free text + preset chips:** Mum, Dad, Nana, Pop, Grandad, Grandma, Grandpa, Brother, Sister,
  Step-Dad, Step-Mum, Carer, Other. **`role_category`** (parent / sibling / grandparent / other)
  **auto-inferred from the role with override** — used by the future family-tree renderer (sv2-s9, still
  deferred).
- **Binding — live read.** Backend: `GET/POST/PATCH/DELETE /family-members`.

---

**⭐ AI model (planning.md §8):** the book is **AI-free by default**. Each person's bio is **written by
the user**. AI is a **separate, opt-in, paid-gated, per-field "✨ write this for me" assist** — built
once in `sv2-ai-assist` and wired into the bio field later; it words the *one* bio field, it never
generates the page. **Build the manual bio path first.** Seed the bio field with the user's own
`bio_input` words rather than a blank box. For free users the assist affordance is visible-but-inert (upsell).

---

**⭐ Page-type pattern (DECIDED 2026-06-24 — see `planning.md` §0 + `sv2-s1`):** `PeoplePage` is a
**layout template + renderer in the book canvas** (the moment-hero pattern), **NOT an `anchor_type='people'`
chapter.** Add a `renderer: 'people'` template to `lib/storybookTemplates.js` + a `PeopleCanvas` renderer
dispatched in `ScrapbookBuilder` / `LayoutRenderer` / `storybookPdf.js` (+ a `TemplateSheet` thumb); it's
added via the builder's template picker and stored in `layout_data`. The **data** (`family_members`) keeps
its own table + `GET/POST/PATCH/DELETE /family-members` endpoints, but the **page itself** has **no
anchor_type, create endpoint, or chapter migration**. The "`PeoplePage` is a chapter type
(`anchor_type = 'people'`)" line below is **superseded** by this.

---

## Goal

Build the **"Your People"** feature: a flexible data model for the baby's family members (parents, siblings, grandparents, others) with user-written bios (optional AI assist later). This data powers two eventual book pages:

1. **About Your People** — profile cards for key family members (photo + name + role + bio)
2. **Family Tree** — visual tree renderer (sv2-s9, deferred — needs the data first)

The design principle: roles are flexible and user-labeled, not hardcoded. Supports single parents, same-sex parents, blended families, grandparent-led households, etc.

---

## Schema

### New migration: `Vxx__create_family_members.sql`
```sql
CREATE TABLE family_members (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  role            VARCHAR(100) NOT NULL,   -- user-typed or from preset: 'Mum', 'Dad', 'Sibling', 'Nana', etc.
  role_category   VARCHAR(20),             -- 'parent' | 'sibling' | 'grandparent' | 'other' — for tree placement
  photo_url       TEXT,
  bio             TEXT,                    -- the displayed bio paragraph — parent-written (single field; bio_input dropped 2026-06-25)
  sort_order      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_members_baby ON family_members(baby_profile_id);
```

`role` is free text (user types "Nana" or "Step-Dad" etc.) but the app offers preset suggestions. `role_category` is a structured enum used by the family tree renderer to know where to place the node — not shown to the user directly.

---

## Scope

### 1. Backend

**New package:** `com.gotcherapp.api.family`
- `FamilyMember` record
- `FamilyMemberRequest` DTO
- `FamilyMemberService` — list, create, update, delete (by baby_profile_id)
- `FamilyMemberController` — `GET/POST /family-members`, `PATCH/DELETE /family-members/{id}`
- Photo upload: `POST /family-members/{id}/photo` (multipart — same pattern as journal/firsts photo upload)

### 2. Frontend — Family Members management UI

New section accessible from the Dashboard tab (or Profile section). Shows:
- List of current family members with photo thumbnails, name, role
- "Add a person" button — opens a form:
  - Name (required)
  - Role (text input with suggestions: Mum, Dad, Nana, Pop, Grandad, Grandma, Brother, Sister, Other)
  - Role category (auto-inferred from role, user can override)
  - Photo (optional, cropped square)
  - "A few words about [name]" (textarea — **this is the bio**, written by the parent; stored in `bio`)
- Drag-to-reorder (sort_order)
- Edit / delete per member

### 3. Bio (manual; optional AI assist later)

The bio is **written by the parent** in the textarea above and shown on the page as-is. No generation
step this session. The optional shared per-field assist (`sv2-ai-assist`, paid-gated) can later draft a
bio from the parent's seed notes — suggested prompt: *"Write a warm, 2–3 sentence description of [name],
who is [baby name]'s [role]. Use these words as a guide: [bio_input]."* — but that's opt-in garnish, not
the default. Result of an assist would populate the same `bio` field.

### 4. `PeoplePage.jsx` component
New file: `Frontend/src/components/storybook/PeoplePage.jsx`

Fixed layout. Props:
```js
{
  members: FamilyMember[],  // filtered to 2 at a time for side-by-side layout
  sectionTitle: String,     // e.g. "Your People", "About Mum & Dad"
  theme: BookTheme,
}
```

Layout (for a 2-member page):
- Section label at top
- 2-column layout: each column has photo, name, role label, bio paragraph
- Decorative divider

A book with 4+ family members generates multiple PeoplePages (2 per page). Handled by the guided book shell (sv2-s6).

### 5. Chapter type

`PeoplePage` is a chapter type (`anchor_type = 'people'`). Created by the guided book, or added manually.

---

## Files to touch

| File | Change |
|---|---|
| `Backend/db/migration/Vxx__create_family_members.sql` | New table |
| `Backend/.../family/` | New package — record, DTO, service, controller |
| `Backend/.../config/SecurityConfig.java` | Allow `/family-members` endpoints |
| `Frontend/src/components/storybook/PeoplePage.jsx` | New — fixed-layout people profile renderer |
| `Frontend/src/components/tabs/DashboardTab.jsx` | Add family members management section |
| `Frontend/src/components/tabs/StorybookTab.jsx` | Render PeoplePage for 'people' chapter type |
| `Frontend/src/lib/api.js` | Add family member CRUD helpers |

---

## Open questions (resolve at session start)

1. **Role presets list:** Confirm the suggested roles to surface (Mum, Dad, Nana, Pop, Grandad, Grandma, Grandpa, Brother, Sister, Step-Dad, Step-Mum, Carer — others?).
2. **role_category inference:** Should this be auto-inferred from the role text, or always user-set? Auto-inference with override seems right.
3. **Bio is optional:** If the parent writes no bio, the PeoplePage shows just name + role + photo. Confirm this is acceptable.
4. **Photo crop:** Square crop (for profile cards) or allow free crop? Square is cleaner for the grid layout.
5. **Bio columns:** This plan renames the old `bio_generated` column to `bio` (user-written by default;
   `bio_input` kept as optional seed for the later AI assist). Confirm — or collapse to a single `bio`
   column and drop `bio_input` if the seed/notes split isn't worth it.

---

## Verification

1. Add family members via management UI — persists correctly.
2. Photo upload, crop, and display all work.
3. A parent-written bio displays on the page (no generation needed).
4. PeoplePage renders correctly with 1 or 2 members (handles odd numbers gracefully).
5. Editing/deleting a family member updates the book page on next render.
