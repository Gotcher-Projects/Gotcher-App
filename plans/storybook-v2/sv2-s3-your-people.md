# SV2-S3 — Your People

**Status: Not started**
**Depends on:** sv2-s1 or sv2-s2 complete (no hard dependency — can run after either)
**Reference:** `planning.md` Q2 — flexible family members, not hardcoded Mum/Dad

---

## Goal

Build the **"Your People"** feature: a flexible data model for the baby's family members (parents, siblings, grandparents, others) with optional AI-generated bios. This data powers two eventual book pages:

1. **About Your People** — profile cards for key family members (photo + name + role + AI bio)
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
  bio_input       TEXT,                    -- user's own words about this person (AI prompt source)
  bio_generated   TEXT,                    -- AI-generated bio paragraph
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
  - "A few words about [name]" (textarea — used as AI prompt input)
- Drag-to-reorder (sort_order)
- Edit / delete per member

### 3. AI bio generation

Optional. After adding a member:
- "Generate a bio" button — calls backend endpoint with `{ memberId }`
- Prompt: *"Write a warm, 2–3 sentence description of [name], who is [baby name]'s [role]. Use these words as a guide: [bio_input]. Tone: loving, personal, the kind of thing a parent would write about someone important to their child."*
- Result stored in `bio_generated`

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
3. **Bio is optional:** If no bio is generated, the PeoplePage shows just name + role + photo. Confirm this is acceptable.
4. **Photo crop:** Square crop (for profile cards) or allow free crop? Square is cleaner for the grid layout.

---

## Verification

1. Add family members via management UI — persists correctly.
2. Photo upload, crop, and display all work.
3. "Generate bio" produces a warm AI paragraph.
4. PeoplePage renders correctly with 1 or 2 members (handles odd numbers gracefully).
5. Editing/deleting a family member updates the book page on next render.
