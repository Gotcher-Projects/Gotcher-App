# Storybook V2 — Planning

**Status: Draft — open questions unresolved (see Section 4)**  
**Depends on:** S12 + Deferred items complete  
**Reference:** `research.md` (Precious Five competitive analysis)  
**LULU integration:** v2 builds on top of LULU work once that lands

---

## 1. Vision

CradleHQ Storybook V2 expands from a single "scrapbook builder" model to a richer memory book platform with two complementary modes:

- **Guided Book** — a predetermined narrative arc (like Precious Five) that walks parents through filling in structured moments. Less creative overhead; the book tells a complete story automatically.
- **Scrapbook** — the existing builder, continued and improved. Free-form chapters, drag-and-place layouts.

Both modes share the same underlying data (Firsts, journal entries, growth records, photos) and the same book canvas render pipeline. They represent different entry points into the same book.

The pregnancy chapter is a long-term track (separate user onboarding flow, significant data model expansion) — kept in view but not blocking v2 core.

---

## 2. Feature Map

### Group A — "Can build now" (no pregnancy, no new major systems)

| Feature | What it is | Data needed | Complexity |
|---|---|---|---|
| **Letter to Baby** | AI-generated letter from parents to baby. Full-page, script font, warm copy | Prompt input from user (a few sentences of hopes/wishes) | Low — new chapter type, existing AI pipeline |
| **About the Parents** | Side-by-side Mum + Dad profile pages with AI-written bios | New parent fields on baby_profiles or a parents table | Medium — schema + AI bio gen + photo upload |
| **Family Tree** | Visual 3-generation tree (4 grandparents → 2 parents → baby) | New `family_members` table | Medium — new data form + tree renderer |
| **Birth Stats Card** | Hero page: birth date, hospital, weight/length/head/time stats | `birth_time` + `birth_hospital` added to baby_profiles | Low — small migration + new page template |
| **Moment-Hero for Firsts** | Each First Time rendered as a hero page (photo + title + AI note) inside the book | Already in `first_times` — label, date, image_url, notes | Medium — new renderer component + integration point |

### Group B — Guided Book mode (builds on Group A)

| Feature | What it is | Depends on |
|---|---|---|
| **Guided Book shell** | A "Book Type" selector + predetermined chapter arc UI | Group A features |
| **Chapter divider pages** | Rich chapter title pages with floating decorative elements | Guided book shell |
| **Firsts chapter** | Auto-generated chapter that pulls all First Times as moment-hero pairs | Moment-Hero from Group A |
| **Gallery pages** | "More from [Moment]" 2×2 grids (needs multi-photo Firsts) | Moment-Hero + first_time_photos schema |

### Group C — Pregnancy track (long-term, separate planning)

| Feature | What it is | Notes |
|---|---|---|
| **Due date + pregnancy mode** | User registers expected due date; app shifts into "before baby" mode | Requires new onboarding consideration |
| **Bump diary** | Weekly photo uploads with week labels, organized by trimester | New `pregnancy_photos` table |
| **Pregnancy journal** | Notes/entries during pregnancy | Could reuse journal_entries with a flag |
| **Pre-birth letter** | Letter to unborn baby specifically — different AI prompt | Subset of Letter to Baby |

### Group D — Deferred

- Voice messages attached to moments
- Extended family tree (aunts, uncles, great-grandparents)

---

## 3. Proposed Session Breakdown (post-S12 + Deferred)

```
sv2-s1  Letter to Baby            ← extensible letter component, pre-birth type first
sv2-s2  Birth Stats Card           ← schema TBD (Q5), new page template
sv2-s3  Your People               ← family_members data model + About Your People pages
sv2-s4  Multi-photo Firsts         ← first_time_photos table + Firsts UI update
sv2-s5  Moment-Hero renderer       ← MomentHeroPage component + scrapbook chapter type
sv2-s6  Guided Book shell          ← book arc UI, chapter divider pages (in Book tab)
sv2-s7  Firsts chapter in book     ← auto-generated Firsts chapter + gallery pages
sv2-s8  Polish + PDF integration   ← all new page types export correctly
sv2-s9  Family Tree visualizer     ← DEFERRED — renders Your People data as a tree (substantial)
```

Pregnancy track gets its own planning file when ready: `plans/storybook-v2/pregnancy-track.md`

---

## 4. Open Questions — Resolve Before Coding

These need answers before any sessions are specced. Flagged here so the conversation happens before planning locks in.

---

### Q1 — Guided Book: separate product or alternate mode?

**DECIDED (2026-06-09):**

Long-term vision: move away from the chapter-by-chapter model entirely toward a unified book editor where parents design the whole book at once — one continuous experience rather than managing individual chapters separately.

For now:
- **Everything stays in the Book tab** (not a separate tab)
- **Guided Book launches as a distinct section within the Book tab** — separate from the existing scrapbook, since the structure is fundamentally different (no free-form chapters)
- As the guided book matures, it may eventually become the primary book mode, with the scrapbook either unified into it or deprecated

Implication for sv2-s6: Guided Book shell should be a new view within `StorybookTab.jsx` (similar to how `builderChapter` state already launches the `ScrapbookBuilder` full-screen). A "Guided Book" entry point appears in the Book tab alongside the existing chapter list initially.

---

### Q2 — Family members / "Your People" feature

**DECIDED (2026-06-09):**

Not just Mum + Dad — a flexible **"Your People"** feature covering:
- Parents (Mum, Dad, or other configurations)
- Siblings
- Grandparents
- Other family members (user-labeled roles)

Work out the exact schema and UI during sv2-s3. Key design principle: roles should be flexible / user-labeled, not hardcoded — supports single parents, same-sex parents, blended families, etc.

This single feature feeds both the **About Your People** pages and the **Family Tree** visualization. Same data, two views.

---

### Q3 — Moment-Hero for Firsts: where does it live?

**DECIDED (2026-06-09):**

**Both** — moment-hero is a chapter type in the existing scrapbook AND the guided book auto-generates a Firsts chapter from all First Times.

**⚠️ V1 pull-forward candidate:** The scrapbook chapter type (option B) may be worth shipping as part of the current S12/polish work — it's self-contained (new renderer component + new chapter type), doesn't require the full guided book, and adds immediate value to the existing scrapbook. Evaluate during S12 planning whether it fits the scope or becomes the first sv2 session.

---

### Q4 — Gallery pages for Firsts (multiple photos)

**DECIDED (2026-06-09):**

Add multi-photo support to First Times — a `first_time_photos` table allowing multiple photos per first-time event. This is a good improvement independent of the book (different use case from the current single-photo design, not just a book feature). Enables gallery pages in moment-hero, but also makes the Firsts feature richer on its own.

Schema direction:
```sql
CREATE TABLE first_time_photos (
  id              BIGSERIAL PRIMARY KEY,
  first_time_id   BIGINT NOT NULL REFERENCES first_times(id) ON DELETE CASCADE,
  image_url       TEXT NOT NULL,
  caption         VARCHAR(200),
  sort_order      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
The existing `image_url` on `first_times` becomes the "hero" photo; additional photos go in this table.

---

### Q5 — Birth Stats Card data

**DECIDED (2026-06-09):**

New `birth_details` table — all birth-day data in one place, clean separation from the ongoing `growth_records` tracking table, and room to grow (birth type, birth story, etc.) without widening `baby_profiles` further.

```sql
CREATE TABLE birth_details (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE UNIQUE,
  birth_time      TIME,
  hospital        VARCHAR(200),
  weight_kg       NUMERIC(5,3),
  height_cm       NUMERIC(5,1),
  head_cm         NUMERIC(5,1),
  birth_type      VARCHAR(50),    -- 'natural', 'c-section', 'induced', etc.
  birth_story     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`growth_records` stays as the recurring measurement tracking table. The birth_details weight/length/head overlap intentionally — they serve different purposes (birth snapshot vs. ongoing tracking). Both can be filled independently.

Birth date stays on `baby_profiles.birthdate` — it's used app-wide (age calculations, milestone weeks, etc.).

---

### Q6 — Family tree visualization

**DECIDED (2026-06-09):**

The full family tree visualizer (the SVG/HTML tree component) is a substantial build — treat as **tech debt / backlog**, not a near-term session. Don't start it until the core guided book structure is proven.

The **"Your People" data model** (from Q2) is still worth building as part of sv2-s3 — you need the data anyway for the About Your People pages. The tree visualization is just one way to render that data; it can be added later.

Revised sv2-s4 becomes: "Your People pages in the guided book" (using the data without a full tree renderer). The tree renderer is a separate future session.

---

### Q7 — Letter to Baby

**DECIDED (2026-06-09):**

Start with **pre-birth** as the first letter type. Design it as an **extensible letter component** from the start — similar to how book themes or chapter types are structured — so adding new letter types later is additive, not a rewrite. Examples of future types:
- "A letter before you arrived" (pre-birth) — **v1**
- "A letter at 6 months"
- "A letter on your first birthday"
- "A letter for when you're older"

Each letter type has: a `type` key, a display name, an AI prompt template, and a suggested trigger/context. The renderer and storage are shared across all types.

Requires `due_date` on `baby_profiles` (or use birthdate as a proxy — letter can be written retroactively). Pre-birth letter is the most emotionally distinct and doesn't strictly require knowing the due_date if written retrospectively.

---

### Q8 — LULU integration points

When LULU lands, what specifically does v2 inherit from it?
- Does LULU change the book canvas render pipeline in ways that affect moment-hero pages?
- Does LULU affect how AI narrative copy is generated (different prompts, different models)?

*Flag for re-evaluation once LULU work is visible.*

---

## 5. Pregnancy Track — Brief (full plan in separate file)

Pregnancy is a bigger UX commitment than any of the above because it requires:
1. A pre-baby user state (app currently assumes baby has already arrived)
2. New data collection (due_date, weekly photo uploads, pregnancy notes)
3. A new "Pregnancy" chapter in the guided book that can be filled in retroactively

**Minimum schema additions:**
```sql
ALTER TABLE baby_profiles ADD COLUMN due_date DATE;
-- or if retroactive only, due_date can be computed from birthdate + 40 weeks (approximate)

CREATE TABLE pregnancy_photos (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  week_number     INT NOT NULL,           -- e.g. 8, 12, 20, 28, 36
  taken_date      DATE,
  image_url       TEXT NOT NULL,
  caption         VARCHAR(200),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**User value:** Parents who are currently pregnant could use CradleHQ from day 1 (before birth), significantly expanding the addressable audience. Worth planning for but scoped as a separate track.
