# Storybook V2 — Competitive Research: Precious Five

**Source:** https://parentinghub.com.au/precious-five  
**Screenshots:** `ScreenshotsForClaude/PreciousFive/P1–P18`  
**Date:** 2026-06-09

---

## What Precious Five Is

A **structured narrative baby memory book** (not a scrapbook builder, not a journal). The book covers a baby's **first five years** via a predetermined chapter arc. Parents don't build pages — they fill in guided "moments" and the app composes the book around them. AI writes the narrative copy. The output is a beautifully formatted digital book (likely printable) with a consistent, warm visual language throughout.

The key insight: the book's *structure exists before the user adds anything*. The user is guided through filling it in, not building it from scratch.

---

## Book Structure (observed P1–P18)

```
Cover (baby name + cover photo)
│
├── Chapter 1: About You
│   ├── Dedication — "A Note to You" (AI-written, signed "for [baby], with all our love")
│   ├── About Us — side-by-side parent profiles (photo + name + AI bio)
│   └── Family Tree — visual tree: 4 grandparents → 2 parents → baby
│
├── Chapter 2: Pregnancy
│   ├── Chapter intro page
│   ├── Bump Diary — First Trimester pt.1 / pt.2 (weekly bump photos, labeled by week + date)
│   ├── Bump Diary — Second Trimester pt.1 / pt.2
│   └── A Letter Before You Arrived (full-page AI letter from parents to unborn baby)
│
└── Chapter 3: Birth
    ├── Chapter intro page
    ├── The Day We Met You (birth date, hospital, stats card + birth photo + AI note)
    ├── More from The Big Day (4-photo gallery)
    ├── First Cuddle / Skin-to-Skin (hero + AI note + voice message)
    ├── More from First Cuddle (4-photo gallery)
    ├── First Feed (hero + AI note + voice message)
    ├── More from First Feed (4-photo gallery)
    └── First Few Hours / Together (hero + note, page 11)
```

Chapters 4+ (Year 1, Year 2, etc.) not visible in screenshots but implied by "first five years" framing.

---

## Recurring Page Patterns (three templates do most of the work)

### 1. Chapter Divider Page
- Centered layout, lots of whitespace
- Section number ("CHAPTER 2"), large title, italic subtitle
- Round icon badge with a thematic symbol (heart, sparkle, etc.)
- Floating decorative elements in corners (hearts, stars, confetti shapes in pink/gold)
- Page number in bottom corner

### 2. Moment Hero Page
- Small category label at top (caps, pink, e.g. "BUMP DIARY", "SKIN-TO-SKIN")
- Large bold title (e.g. "First Cuddle")
- Italic subtitle below (e.g. "Moments after birth · the first hello")
- Hero photo with white card frame/shadow, photo caption underneath in italics
- Note card below photo (cream/ivory rounded box):
  - "NOTE" label in small caps
  - AI-generated body text in italic script
  - Attribution "— Mom xx" at bottom right
- Small decorative heart floating in corner
- "A message for you" audio button in bottom-right corner (voice recording feature)

### 3. Gallery Page
- "More from [Moment Name]" heading
- Italic subtitle (e.g. "More from The Big Day")
- 2×2 photo grid, each photo with a caption underneath

### 4. Stats Card Page (Birth only)
- Full-width hero photo
- Horizontal stats bar: WEIGHT / LENGTH / HEAD / TIME — each with a value below
- Cream note card with AI text

### 5. Parent Profile Page
- Side-by-side layout: Mum card | Dad card
- Each: photo, name, subtitle (e.g. "Sarah"), AI-written paragraph bio
- Section title "About Us" with italic subtitle

### 6. Family Tree Page
- Visual org-chart style tree
- Tier 1 (top): 4 grandparents with initial avatar + name + role label
- Tier 2: 2 parents with same treatment
- Tier 3: baby at center bottom
- Connected by lines; labeled "Mother / Father / Mother of Mum / Father of Dad" etc.

### 7. Letter Page
- "A LETTER TO YOU" section label in small caps
- Large title: "A Letter Before You Arrived"
- Full-page letter body in italic script font — multiple paragraphs
- Signed "— With all our love, Mum & Dad xx"
- Warm cream/ivory background

### 8. Pregnancy Bump Diary Page
- Section badge at top ("BUMP DIARY")
- Italic subtitle (trimester + part number)
- Layout: hero photo full-width on top half, 2-col photo grid on bottom half
- Each photo labeled: "Week 6 - Starting to Show" + date below it

---

## Design Language

- **Background:** warm cream/ivory (#f8f4ef range)
- **Accent:** soft pink (section labels, hearts, icon fills, note borders)
- **Secondary accent:** warm gold/amber (floating decorative shapes)
- **Typography:** bold sans-serif for titles, script/italic for subtitles, notes, captions
- **Photos:** white card frame with subtle drop shadow
- **Whitespace:** generous — especially on chapter dividers
- **Decoratives:** floating hearts, stars, sparkles scattered in corners of key pages — never cluttered
- **No user-customizable layouts** — all pages follow fixed templates

---

## Feature Inventory with CradleHQ Gap Analysis

| Feature | Precious Five | CradleHQ today | Gap |
|---|---|---|---|
| Cover page | Baby name + photo | ✅ BookCover.jsx | None |
| Scrapbook builder | ❌ Fixed structure only | ✅ ScrapbookBuilder | CradleHQ leads here |
| Guided book mode | ✅ Core model | ❌ None | **Big gap** |
| Chapter divider pages | ✅ Rich, decorative | Partial (basic) | Style gap |
| Moment hero pages | ✅ Core template | ❌ None | **Missing** |
| Gallery pages | ✅ 2×2 photo grid | ❌ None | Missing |
| Parent profiles (About Mum/Dad) | ✅ Side-by-side with AI bio | ❌ None | Data + UI gap |
| Family tree | ✅ 3-generation visual | ❌ None | **New feature** |
| Pregnancy chapter | ✅ Trimester bump diary | ❌ None | **Big lift** |
| Letter to baby | ✅ AI pre-birth letter | ❌ None | **New feature** |
| Birth stats card | ✅ Weight/length/head/time | Partial (growth_records has weight/length/head — no time/hospital) | Small data gap |
| Birth day hero moment | ✅ Full birth day moment page | ❌ None | New template |
| Firsts as moment-hero pages | ✅ (First Cuddle, First Feed, etc.) | ❌ Firsts exist but no hero rendering | **Promising bridge** |
| Voice messages on moments | ✅ "A message to you" audio | ❌ None | Big lift, deferred |
| Book themes | ❌ Single style | ✅ 4 themes | CradleHQ leads |
| PDF export | ❌ Not observed | ✅ | CradleHQ leads |

---

## Data Model Audit — What We Have vs. What We'd Need

### Currently in `baby_profiles`
```sql
id, user_id, baby_name, birthdate, parent_name (singular text), phone,
sex, book_theme, cover_photo_url, cover_subtitle
```

### Currently in `first_times`
```sql
id, baby_profile_id, label, occurred_date, image_url, notes
```

### Currently in `growth_records`
```sql
id, baby_profile_id, recorded_date, weight_kg, height_cm, head_cm, notes
```

### What's missing for v2 features

**For parent profiles (About Mum/Dad):**
- Currently `parent_name` is a single text field — no concept of two parents
- Need: `parent_profiles` table or structured fields on baby_profiles
  - `mum_name`, `mum_photo_url`, `mum_bio_input` (user-written prompt), `mum_bio_generated`
  - `dad_name`, `dad_photo_url`, `dad_bio_input`, `dad_bio_generated`
  - Or a more flexible `parents` table (id, baby_profile_id, role, name, photo_url, bio_input, bio_generated)

**For family tree:**
- No grandparent data exists at all
- Need: `family_members` table (id, baby_profile_id, name, role, photo_url, initials)
  - Roles: maternal_grandmother, maternal_grandfather, paternal_grandmother, paternal_grandfather, mum, dad
  - Extended optional: other (aunt, uncle, etc.) — probably out of scope for v1

**For birth details (stats card):**
- `birthdate` exists on baby_profiles ✅
- Birth weight/length/head are in `growth_records` (earliest entry) — accessible but not labeled as "birth record"
- **Missing:** birth time, hospital name
- Need: `birth_time TIME` and `birth_hospital VARCHAR(100)` on baby_profiles (or separate birth_details record)

**For pregnancy chapter:**
- Nothing exists — no due_date, no bump photos, no trimester data
- Need: `due_date DATE` on baby_profiles (can be retroactively filled)
- Need: `pregnancy_photos` table (id, baby_profile_id, week_number INT, taken_date DATE, image_url, caption)
- This is a significant data collection + UX investment

**For letter to baby:**
- Nothing exists — purely AI output
- Could store as a special `storybook_chapters` row (`anchor_type: 'letter'`)
- Or a dedicated `letters` table for more flexibility
- Minimal new schema: just one new chapter type + a prompt input form

**For moment-hero pages from Firsts:**
- `first_times` has: label, occurred_date, image_url, notes — **maps perfectly to hero page**
- Gap: only 1 photo per first time currently — gallery page needs multiple photos
- Could extend with a `first_time_photos` join table, or accept that v1 hero pages show 1 photo only

---

## Moment-Hero Technical Research

This is the feature that could bridge Firsts + Storybook most naturally.

### What a moment-hero page actually is
A **fixed-layout template** — not a free canvas. Three hardcoded zones:
1. Hero photo (top ~55% of page, full-width, white-framed card)
2. Title section (category badge + title + subtitle)
3. Note card (cream box, italic text, attribution)

This is far simpler than the current `ScrapbookBuilder` canvas. No drag-and-drop, no fractional positions, no react-rnd.

### How it maps to First Times data
```
first_time.label          →  title ("First Steps")
first_time.occurred_date  →  subtitle formatted date ("April 14, 2026")
first_time.image_url      →  hero photo
first_time.notes          →  note card body (or AI-generate from label + date + notes)
"FIRST TIME"              →  category badge (hardcoded for firsts)
```

The data is already there. The only gap is **gallery photos** — we only store one photo per first time.

### Implementation approaches

**Option A: React component, no canvas**
A new `MomentHeroPage.jsx` that renders the fixed layout as standard HTML/CSS. No virtual canvas, no fractional coordinates. Would render well on screen and capture well with html2canvas (no pseudo-elements to worry about). Simplest to build.

**Option B: Fixed-slot template in the existing canvas system**
Add a `moment_hero` template to `storybookTemplates.js` with predefined block positions that mirror the fixed layout. Reuses the canvas render pipeline. More consistent with the existing architecture, but adds complexity for something that's inherently fixed.

**Recommendation: Option A.** The moment-hero layout is rigid enough that the full canvas machinery is overkill. A purpose-built component will be simpler to build, easier to style precisely, and cleaner to extend for the guided book mode.

### Where it surfaces in the app
Three candidate locations (open question for planning — see below):
1. **In the guided book** — each First Time becomes a pair of pages (hero + gallery) inside a "Firsts" chapter
2. **As a chapter type in the scrapbook** — user can create a chapter from a specific First Time
3. **Standalone "Firsts Book" view** — a separate read-only book that renders all Firsts as moment-hero pages

### Gallery page consideration
Precious Five shows "More from [Moment]" with 4 photos. Currently we support 1 photo per First Time. To support a gallery page we'd either:
- Allow multiple photos on a First Time (new `first_time_photos` table — clean but new schema)
- Accept that the gallery page shows the 1 photo in different crops/sizes (not ideal)
- Skip gallery pages initially and just do hero pages

---

## Voice Messages (Deferred)

The "A message to you" audio button in P12, P14, P16 is genuinely distinctive. It plays a voice recording from the parent, attached to a specific moment.

**What it would take:**
- Audio recording via browser `MediaRecorder` API (works on desktop Chrome/Firefox, iOS Safari needs polyfill)
- Audio storage: upload to Cloudinary (already used for photos) or S3 — just a different resource type
- Backend: `moment_voice_memos` table (id, moment_type, moment_id, audio_url, duration_seconds)
- Playback: HTML `<audio>` element or a custom waveform player

**Assessment:** Feasible but non-trivial. Not required for v1 of guided book. Deferred until core book structure is validated.

---

## What to Build vs. Defer

### Can build now (no pregnancy data dependency)
- **Letter to Baby** — minimal schema change, uses existing AI generation pipeline
- **Family Tree** — new `family_members` table + tree renderer
- **Moment-Hero pages for Firsts** — First Times data maps cleanly today
- **Birth Stats Card** — add `birth_time` + `birth_hospital` to baby_profiles (small migration)
- **About the Parents pages** — add parent profile fields + AI bio generation

### Medium lift, no pregnancy dependency
- **Guided Book mode** — full chapter arc UI with structured "fill in this moment" slots
- **Chapter Divider pages** with decorative floating elements
- **Gallery pages** (needs `first_time_photos` schema extension)

### Big lift, requires pregnancy data model
- **Pregnancy chapter** (bump diary) — needs: due_date, trimester tracking, weekly photo uploads, pregnancy notes. New data collection flow before baby arrives. Consider as a separate planning track.

### Deferred
- **Voice messages** — high value but high effort. Post-v1 guided book.
- **Extended family tree** (beyond grandparents) — nice-to-have
