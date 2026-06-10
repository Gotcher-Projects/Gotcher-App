# Storybook V2 — Session Opening Prompts

Copy-paste the relevant block at the start of each session.

Research context: `plans/storybook-v2/research.md` (Precious Five analysis)
Planning decisions: `plans/storybook-v2/planning.md`
Architecture reference: memory `project_storybook_architecture.md`

**Prerequisites before any sv2 session:** S12 + all Deferred storybook items complete. LULU work complete (check Q8 in planning.md before starting AI generation sessions).

---

## SV2-S1 — Letter to Baby

```
Session SV2-S1 — Letter to Baby (extensible letter component).
Plan: plans/storybook-v2/sv2-s1-letter-to-baby.md
Depends on: S12 + Deferred storybook items complete.

Build the extensible letter component and ship the pre-birth letter type first.
Key design: LETTER_TYPES config array in lib/letterTypes.js — adding new letter types later
is additive (new config entry + prompt, no structural changes).

Resolve at session start:
- Letter input storage (raw user prompt — storybook_chapters.body before generation, or new column?)
- Re-edit flow: inline edit vs regenerate-only?
- One letter per type, or multiple?

Build in this order:
1. Frontend/src/lib/letterTypes.js — letter type config (id, displayName, promptTemplate, etc.)
2. Frontend/src/components/storybook/LetterPage.jsx — full-page fixed-layout renderer
   (script/italic font, multi-paragraph letter body, signed attribution, cream background)
3. StorybookTab.jsx — render LetterPage for anchor_type='letter' chapters; "Add a Letter" UI
4. Backend: letter generation endpoint (extend existing /storybook/generate or new endpoint)
5. storybookPdf.js — handle letter chapter type

Read StorybookTab.jsx, storybookPdf.js, bookThemes.js, and sv2-s1 plan before coding.
```

---

## SV2-S2 — Birth Stats Card

```
Session SV2-S2 — Birth Stats Card ("The Day We Met You" page).
Plan: plans/storybook-v2/sv2-s2-birth-stats-card.md
Depends on: Can run independently (no sv2-s1 dependency).

Full-stack. New birth_details table + backend + BirthDayPage component.

Resolve at session start:
- Birth photo: reuse cover photo, or add birth_photo_url to birth_details?
- Birth details form placement: Dashboard tab, or Book tab flow only?
- Units: follow existing growth tracking unit preference (kg/cm vs lbs/oz/in)?

Build in this order:
1. Backend migration — CREATE TABLE birth_details (id, baby_profile_id UNIQUE, birth_time,
   hospital, weight_kg, height_cm, head_cm, birth_type, birth_story, created_at, updated_at)
2. com.gotcherapp.api.birthdetails — BirthDetails record, BirthDetailsRequest, BirthDetailsService,
   BirthDetailsController (GET + PUT /birth-details). Add to SecurityConfig.
3. Birth details form in DashboardTab (or BirthDetailsForm.jsx component)
4. Frontend/src/components/storybook/BirthDayPage.jsx — fixed-layout renderer:
   section label, title, birth date + hospital subtitle, hero photo, stats card row
   (WEIGHT / LENGTH / HEAD / TIME), AI note card
5. StorybookTab.jsx — render BirthDayPage for anchor_type='birth_day' chapters
6. Birth day AI note generation endpoint
7. storybookPdf.js — handle birth_day chapter type

Read DashboardTab.jsx, storybookPdf.js, growth records backend before coding.
```

---

## SV2-S3 — Your People

```
Session SV2-S3 — Your People (flexible family members feature).
Plan: plans/storybook-v2/sv2-s3-your-people.md
Depends on: Can run independently (no sv2-s1 or sv2-s2 dependency).

Full-stack. New family_members table + CRUD + PeoplePage component.
Design principle: roles are user-labeled (flexible) with a role_category field for tree placement.

Resolve at session start:
- Role presets list (Mum, Dad, Nana, Pop, Grandad, Grandma, Brother, Sister, Carer, Other — additions?)
- role_category: auto-infer from role text, or always user-set?
- Photo crop: square (for profile cards) or free?

Build in this order:
1. Backend migration — CREATE TABLE family_members (id, baby_profile_id, name, role,
   role_category, photo_url, bio_input, bio_generated, sort_order, created_at, updated_at)
2. com.gotcherapp.api.family — FamilyMember record, FamilyMemberRequest, FamilyMemberService,
   FamilyMemberController (GET/POST /family-members, PATCH/DELETE /family-members/{id},
   POST /family-members/{id}/photo). Add to SecurityConfig.
3. Family members management UI in DashboardTab (list + add/edit/delete form + photo upload)
4. AI bio generation endpoint for a single family member
5. Frontend/src/components/storybook/PeoplePage.jsx — fixed 2-column layout: photo + name +
   role + bio paragraph per person (2 per page)
6. StorybookTab.jsx — render PeoplePage for anchor_type='people' chapters

Read DashboardTab.jsx, existing photo upload patterns (journal, firsts) before coding.
```

---

## SV2-S4 — Multi-Photo First Times

```
Session SV2-S4 — Multi-photo First Times + Gallery Page renderer.
Plan: plans/storybook-v2/sv2-s4-multi-photo-firsts.md
Depends on: Can run independently (no sv2-s1/s2/s3 dependency).

Full-stack. New first_time_photos join table + Firsts UI update + GalleryPage component.
The existing first_times.image_url stays as the hero photo; additional photos go in the new table.

Resolve at session start:
- Empty gallery cells (< 4 photos): placeholder or only show what exists?
- Caption required or optional?
- Hero photo included in gallery, or gallery = additional photos only?
- Max photos per First Time?

Build in this order:
1. Backend migration — CREATE TABLE first_time_photos (id, first_time_id FK, image_url,
   caption, sort_order, created_at)
2. Update FirstTime record to include List<FirstTimePhoto> additionalPhotos
3. New endpoints: POST /first-times/{id}/photos, DELETE /first-times/{id}/photos/{photoId},
   PATCH /first-times/{id}/photos/order
4. FirstTimesTab UI update: photo strip on cards, "Add another photo" in edit flow
5. Frontend/src/components/storybook/GalleryPage.jsx — "More from [X]" header + 2×2 photo grid

Read MemoriesTab.jsx (FirstTimesTab section), first_times backend, imageUtils.jsx before coding.
```

---

## SV2-S5 — Moment-Hero in Guided Book + Gallery Wiring

```
Session SV2-S5 — Wire moment-hero + gallery pages into the guided book Firsts chapter.
Plan: plans/storybook-v2/sv2-s5-moment-hero-guided.md
Depends on: S13 (MomentHeroPage exists), sv2-s4 (GalleryPage + first_time_photos exist).

This is a wiring session — components already built. Focus: auto-generation, chapter data
structure, and guided book integration.

Resolve at session start:
- Chapter data storage: hero+gallery page list in storybook_chapters.layout_data, or in a
  guided_book_sections structure introduced in sv2-s6?
- Generation cost: do Firsts notes count against AI credits?
- New Firsts added after generation: auto-include or require manual regenerate?

Build in this order:
1. Backend: POST /storybook/generate-firsts-notes — batch note generation for all First Times
   that don't yet have a note. Returns { [firstTimeId]: note }.
2. Frontend: Firsts chapter page sequence builder — takes first_times + generated notes, returns
   [ {type:'moment_hero', first}, {type:'gallery', first} ] pairs. Skip gallery if no additional
   photos.
3. Wire into guided book Firsts section rendering (coordinate with sv2-s6 shell structure)
4. storybookPdf.js: chain hero + gallery pages for Firsts chapter

Read MomentHeroPage.jsx (from S13), GalleryPage.jsx (from sv2-s4), StorybookTab.jsx before coding.
```

---

## SV2-S6 — Guided Book Shell

```
Session SV2-S6 — Guided Book shell (container, arc, chapter divider pages).
Plan: plans/storybook-v2/sv2-s6-guided-book-shell.md
Depends on: sv2-s1 through sv2-s5 complete (all page types must exist).

Frontend only. No new backend. The guided book is derived from existing data (birth_details,
family_members, first_times, storybook_chapters).

Resolve at session start:
- Floating decoratives on ChapterDividerPage: absolutely-positioned spans with Unicode/emoji
  (html2canvas-safe) vs SVG? Avoid CSS pseudo-elements.
- Placeholder pages: show "fill in this section" card, or skip empty sections entirely?
- Navigation: prev/next arrows (book feel) or scrollable vertical flow?
- PDF: guided book gets its own Download button, or reuses existing StorybookTab export?

Build in this order:
1. Frontend/src/lib/guidedBookArc.js — GUIDED_BOOK_ARC config array (cover, about_you, birth,
   firsts chapters + sections)
2. Frontend/src/components/storybook/ChapterDividerPage.jsx — chapter number, icon badge,
   title, italic subtitle, floating decorative elements (html2canvas-safe approach)
3. Frontend/src/components/storybook/GuidedBook.jsx — full-screen shell: left panel (outline +
   completion indicators), right panel (page viewer with prev/next), page sequence builder
4. StorybookTab.jsx — "Guided Book" entry point, guidedBookOpen state

Read StorybookTab.jsx, ScrapbookBuilder.jsx (for full-screen pattern), bookCanvas.jsx,
feedback_html2canvas_limitations.md, all existing page components before coding.
```

---

## SV2-S7 — Firsts Chapter Integration

```
Session SV2-S7 — Wire Firsts chapter fully into guided book (generation, sync, completion).
Plan: plans/storybook-v2/sv2-s7-firsts-chapter.md
Depends on: sv2-s5, sv2-s6 both complete.

Short integration session. Focus: generation trigger UI, completion state, sync when First
Times are added/edited/deleted after generation.

Resolve at session start:
- Empty state: what does the Firsts section show when no First Times exist yet?
- Sort order: occurred_date ASC — confirmed?

Build in this order:
1. GuidedBook.jsx — wire Firsts section: fetch first_times + notes, show placeholder with
   "Generate" CTA if notes missing, render page sequence once generated
2. Completion indicator logic for Firsts section in left panel
3. Individual note regeneration affordance on each hero page (visible on hover)
4. Sync behavior: new/deleted First Times update sequence on next render

Read GuidedBook.jsx, sv2-s5 wiring code before touching anything.
```

---

## SV2-S8 — Polish + PDF Integration

```
Session SV2-S8 — Polish all v2 page types and fix PDF export for the guided book.
Plan: plans/storybook-v2/sv2-s8-polish-pdf.md
Depends on: sv2-s6 + sv2-s7 complete and visually verified.

Resolve at session start:
- Guided book PDF: separate Download button in GuidedBook.jsx, or unified with existing
  StorybookTab PDF export?
- If both scrapbook and guided book exist: PDF includes both or user chooses?

Audit each new page type against html2canvas constraints (feedback_html2canvas_limitations.md):
LetterPage (script font loaded? CSS vars set?), BirthDayPage (stats row at 600px),
PeoplePage (photos loaded before capture?), ChapterDividerPage (floating decoratives render?),
GalleryPage (2×2 grid proportions correct?).

Then extend storybookPdf.js to handle the guided book page sequence. Verify all themes
produce correctly themed PDFs for all new page types.

Read storybookPdf.js, bookCanvas.jsx, feedback_html2canvas_limitations.md first.
```

---

## SV2-S9 — Family Tree Visualizer (DEFERRED)

```
Session SV2-S9 — Family Tree visualizer (DEFERRED — do not start until sv2-s6 through sv2-s8
are verified working).
Plan: plans/storybook-v2/sv2-s9-family-tree.md
Depends on: sv2-s3 (family_members data), sv2-s6 (guided book shell).

Substantial standalone build. Resolve rendering approach at session start:
- HTML/CSS flexbox tree (simple, symmetric only) vs inline SVG (flexible, recommended)
- Avoid SVG foreignObject (not supported by html2canvas)

Build FamilyTreePage.jsx: 3-tier tree (grandparents → parents → baby). Each node: circular
avatar (photo or initial circle), name, role label. SVG connecting lines.
Wire into GUIDED_BOOK_ARC under 'about_you' chapter.
Show only if family_members has at least 2 parents/grandparents.

Read FamilyMember data model, GuidedBook.jsx, feedback_html2canvas_limitations.md first.
```
