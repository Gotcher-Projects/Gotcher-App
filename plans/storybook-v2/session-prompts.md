# Storybook V2 — Session Opening Prompts

> **Scope: the CORE-BOOK sessions (`sv2-s1 … s9`), all now Complete.** Kept as historical AS-BUILT record.
> The active paid-bundle tracks have their **own** prompt files — **payments:** `payments/session-prompts.md`;
> **print:** `print/session-prompts.md`. For what's current across all of v2, see `planning.md` → "📍 Status
> map & canonical pointers".

Copy-paste the relevant block at the start of each session.

Research context: `plans/storybook-v2/research.md` (Precious Five analysis)
Planning decisions: `plans/storybook-v2/planning.md`
Architecture reference: memory `project_storybook_architecture.md`

**Prerequisites before any sv2 session:** the storybook review-fixes track (s1–s11) + S13 + S15 are
**Complete** (verified 2026-06-22 — see planning.md §0). "LULU work" = the Lulu print-on-demand session,
now folded in as `sv2-print` (planning.md §6) — it is the *last* workstream and does NOT block the page-type
sessions. **Heads-up on stale names:** S13 shipped as **`MomentHeroCanvas.jsx`**, not `MomentHeroPage.jsx`;
`bookCanvas` is `lib/bookCanvas.jsx`. See planning.md §0 "Naming mismatches".

**⭐ CROSS-CUTTING — AI is separate now (planning.md §8):** every page-type session (s1, s2, s3, s5, s6,
s8) builds the **manual text path as the default** — the book is AI-free by default. **There is
NO AI page generation in the new system** — pages come from the user (scrapbook) or the default guided
arc (guided book), never from AI; the old `generatePages()` flow is being deleted (`sv2-ai-retrofit`).
The only AI is a **separate, paid-gated, per-field "✨ write this for me" text assist**, built ONCE in
`sv2-ai-assist` and consumed everywhere — it helps word ONE existing field, it never makes pages. Where
a prompt below says "AI note/bio generation endpoint", read that as: *manual field now; wire the shared
per-field assist later.* Core v2 ships free with no Payments dependency.

**⭐ Before sv2-s7 (the shell):** `sv2-s7-plan-default-book.md` holds the **locked default book** (its
arc + which pages ship + page count — DECIDED 2026-06-27; see the two mockups), which the shell builds
into the page-sequence config.

---

## SV2-S1 — Letter to Baby

```
Session SV2-S1 — Letter to Baby (extensible letter component).
Plan: plans/storybook-v2/sv2-s1-letter-to-baby.md
Status: IMPLEMENTED 2026-06-24 (Needs Verification). The notes below are AS BUILT.

The letter is a LAYOUT TEMPLATE + RENDERER in the book canvas (the moment-hero pattern), NOT an
anchor_type chapter. (First attempt built it as a bespoke anchor_type='letter' chapter + create
endpoint + standalone card — fully reverted. See planning.md §0 page-type pattern.) Built:
1. lib/storybookTemplates.js — `letter` template (renderer: 'letter', role blocks title/body/signature).
2. components/storybook/LetterCanvas.jsx — renderer (warm cream palette, section label + heart divider
   chrome, in-place Tiptap editing), following MomentHeroCanvas.
3. Dispatched in ScrapbookBuilder + LayoutRenderer + storybookPdf.js; LetterThumb in TemplateSheet.
4. lib/letterTypes.js — additive letter-type registry (id → title) for guided book + later AI assist.
5. NO backend/DB changes — the letter rides inside a chapter's layout_data, saved via PATCH /storybook/{id}.

Added via the builder's template picker like any layout. AI assist not wired (sv2-ai-assist later).
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
4. PAGE-TYPE PATTERN (planning.md §0 + sv2-s1): build the birth-day page as a LAYOUT TEMPLATE +
   RENDERER (the moment-hero pattern), NOT an anchor_type chapter.
   a. Add a `renderer: 'birth_day'` template to lib/storybookTemplates.js (role blocks).
   b. BirthDayCanvas.jsx renderer (section label, title, birth date + hospital subtitle, hero photo,
      stats card row WEIGHT/LENGTH/HEAD/TIME, note card = parent-written birth_story).
   c. Dispatch it in ScrapbookBuilder + LayoutRenderer + storybookPdf.js (+ TemplateSheet thumb),
      exactly like moment-hero. Page stored in layout_data; the birth_details TABLE holds the data.
(AI model §8: the note is the parent's birth_story shown as-is — no generation endpoint this session.)

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
AI model (§8): bios are USER-WRITTEN by default. No bio-generation endpoint this session — the optional
per-field assist comes via sv2-ai-assist.

1. Backend migration — CREATE TABLE family_members (id, baby_profile_id, name, role,
   role_category, photo_url, bio_input, bio, sort_order, created_at, updated_at)
   (bio = displayed, user-written; bio_input = optional seed/notes — see plan open Q5)
2. com.gotcherapp.api.family — FamilyMember record, FamilyMemberRequest, FamilyMemberService,
   FamilyMemberController (GET/POST /family-members, PATCH/DELETE /family-members/{id},
   POST /family-members/{id}/photo). Add to SecurityConfig.
3. Family members management UI in DashboardTab (list + add/edit/delete form + photo upload +
   "a few words about [name]" textarea = the bio)
4. PAGE-TYPE PATTERN (planning.md §0 + sv2-s1): build the people page as a LAYOUT TEMPLATE + RENDERER
   (the moment-hero pattern), NOT an anchor_type chapter.
   a. Add a `renderer: 'people'` template to lib/storybookTemplates.js (role blocks).
   b. PeopleCanvas.jsx renderer — 2-column layout: photo + name + role + bio paragraph per person (2/page).
   c. Dispatch it in ScrapbookBuilder + LayoutRenderer + storybookPdf.js (+ TemplateSheet thumb), like
      moment-hero. Page stored in layout_data; the family_members TABLE holds the data.

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

> ❌ **Old SV2-S5 (auto Firsts chapter) + SV2-S7 (firsts integration) are DROPPED (2026-06-27).** Firsts
> are now user-picked moment-hero pages in the fixed book. The s5/s7 numbers are reused below.

## SV2-S5 — Family Tree (book page)  ← build before the shell

```
Session SV2-S5 — Family Tree as a default-book page (renumbered 2026-06-27, was sv2-s9).
Plan: plans/storybook-v2/sv2-s5-family-tree.md
Depends on: sv2-s3 (family_members data — shipped). Build BEFORE the shell (sv2-s7).

Build the family tree as a book page type (the People section of the guided book), reading
family_members + role_category. Follow the data-driven page-renderer pattern (live-read via pageData,
like BirthDayCanvas/PeopleCanvas). Inline SVG for connecting lines (avoid foreignObject — html2canvas).
3-tier: grandparents → parents → baby; each node = circular avatar + name + role.

Read FamilyMember data model, the existing page renderers, feedback_html2canvas_limitations.md first.
```

---

## SV2-S6 — Fill-in Page Types  ← build before the shell

```
Session SV2-S6 — the new fill-in page types the default book needs (renumbered 2026-06-27).
Plan: plans/storybook-v2/sv2-s6-fill-in-page-types.md
Depends on: page renderers (s1/s2/s3) + sv2-s5 Family Tree.

Build, as templates+renderers in the book canvas (like Letter/BirthDay/People):
- ChapterDividerPage (html2canvas-safe decoratives), a "Month-by-Month" growth spread (may reuse a
  photo-grid template + captions), simple prompt/fill pages ("All About You", "Hands & Feet"), and a
  Bump page (600×800 wrapper around a bump photo + auto week→size tag from the shipped size dataset).

Read sv2-s6-fill-in-page-types.md, storybookTemplates.js, the existing canvases first.
```

---

## SV2-S7 — Guided fill-in book shell  (REFRAMED 2026-06-27, was sv2-s6)

```
Session SV2-S7 — Guided fill-in book shell (pre-designed locked page sequence the user fills).
Plan: plans/storybook-v2/sv2-s7-guided-book-shell.md  +  sv2-s7-plan-default-book.md (locked arcs)
Mockups (page lists): mockups/s6-guided-first-year-book.html (25pp) +
  mockups/s6-guided-pregnancy-first-year-book.html (30pp).
Mockups (in-app, 2026-06-27): mockups/s7-guided-book-in-app.html (guided book in the real tab chrome) +
  mockups/s7-book-library-and-chooser.html (book shelf + Guided/Freeform chooser dialog).
Depends on: page types s1/s2/s3 ✅ + s5 Family Tree ✅ + s6 fill-in page types ✅ (growth, prompts,
hands&feet, bump, chapter divider). ALL BUILT — this session just sequences + shells them. NOT old sv2-s5 (dropped).

⚠️ This is the 2026-06-27 REFRAMED model: NOT auto-generated. It's a pre-designed, LOCKED page
sequence (no add/remove/reorder in v1) the user fills via the existing ScrapbookBuilder mechanics.
Page kinds: auto (fills from data) / fill (empty designed page) / pick (user chooses which First).

NOTE: ChapterDividerCanvas + ALL fill-in renderers already exist (shipped in s6). Don't rebuild them —
the shell just places them. The new code is the arc config + the shell view + the entry/chooser.

Resolve at session start:
- Page-sequence config shape: a fixed ordered list of {template, prompt, kind}. First Year baseline;
  pregnancy chapter front-inserts when phase=pregnancy (the s8 pages — gate that arc until s8 ships).
- Mode = a Guided⇄Freeform toggle in the Book tab (Guided "Recommended"); mirror builderChapter full-screen.
- Book library/switcher (MULTI-BOOK IS IN v1): 0 books → chooser dialog → book; 1 book → land in it +
  quiet "▾" switcher; 2+ → "Your Books" shelf (cover cards + ⋯ menu). Needs a NEW `books` table
  (baby owns many books; migrate existing chapters into a default book + add book_id FK). See plan item #5.
- REMOVE the AI "Write a Period Chapter" card from StorybookTab (unmount wizard entry; keep code for s11).
  Freeform = layouts/photos/text only — no AI surface in s7.
- PDF: reuse storybookPdf (pass the guided page sequence) vs a parallel path.

Build in this order:
1. lib/guidedBookArc.js — the fixed page-sequence config (per the mockups).
2. components/storybook/GuidedBook.jsx — full-screen shell that instantiates the locked sequence and
   reuses ScrapbookBuilder fill mechanics; auto/pick pages render from data. (ChapterDivider already exists.)
3. StorybookTab.jsx — Guided⇄Freeform toggle + book library/switcher, guidedBookOpen state,
   AND remove the Period-Chapter AI card.

Read sv2-s7-plan-default-book.md, all four mockups (2 page-lists + 2 in-app), StorybookTab.jsx,
ScrapbookBuilder.jsx, the existing page renderers, feedback_html2canvas_limitations.md before coding.
```

---

## ❌ DROPPED (old SV2-S7) — Firsts chapter integration

Went with the dropped moment-hero plan — no auto Firsts chapter. (The s7 number is now the Guided
shell, above.) See `planning.md` 2026-06-27 direction update.

---

## SV2-S3.5 — People page polish + circular crop  (folds in the old S6.6)

```
Session SV2-S3.5 — Make People pages fill the page + add an opt-in circular crop (folds in S6.6).
Plan: plans/storybook-v2/sv2-s3.5-people-polish-and-circular-crop.md
Depends on: sv2-s3 (People page) + sv2-profile-modal (baby avatar), both shipped.

Frontend only. Two parts:
1. PeopleCanvas.jsx — vertically balance/enlarge content so two-up + spotlight fill the 600×800 canvas
   (screenshots showed content crammed in the top third). Robust for 1 vs 2 people, short vs long bios.
2. Opt-in 1:1 / circular crop, scoped ONLY to: Your People member photos (FamilyRosterPopup) + the
   baby profile avatar (ProfileEditModal Basics). Everything else (journal, firsts, memory book, bump,
   cover, S2 birth hero) keeps portrait/landscape — DO NOT change those.

Resolve at session start:
- Per-call option `openCropModal(file, onComplete, onCancel, { shape: 'circle' })`; square-only in
  circle mode (no orientation pills); output a square JPEG + CSS circle (current Avatar/PeopleCanvas).
- People page: vertically centre vs space-between; spotlight avatar target size; bottom flourish or not.

Build in this order:
1. lib/imageUtils.jsx — opt-in 1:1 + circular preview overlay; DEFAULT behaviour unchanged.
2. ui/PhotoPickerButton.jsx — forward a `shape` option.
3. FamilyRosterPopup.jsx + ProfileEditModal.jsx (avatar only) — request the circle.
4. PeopleCanvas.jsx — page-fit sizing.

Read sv2-s3.5-…md, PeopleCanvas.jsx, lib/imageUtils.jsx, ui/Avatar.jsx, FamilyRosterPopup.jsx,
ProfileEditModal.jsx first. Verify cover/firsts/journal/bump/birth-hero crops are untouched.
```

---

## SV2-S9.0a — Rethink Multi-Photo First Times UX  (was sv2-s4.5)  ❌ DROPPED 2026-07-02

> DROPPED — decided against. The s4 in-card editor was already removed; the data layer stays dormant. Reopen only if revived.

```
Session SV2-S9.0a — redesign multi-photo First Times (was sv2-s4.5).
Plan: plans/storybook-v2/sv2-s9.0a-multi-photo-firsts-ux.md
Run BEFORE sv2-s9.1 demo seed — it changes how first_time_photos is used, which the seed writes.
Depends on: sv2-s4 (data layer + Gallery page shipped). The disliked in-card editor was already REMOVED.

⚠️ DESIGN DISCUSSION FIRST — the redesign is not decided. Work through the plan's open questions before
any code: where multi-photo lives (edit form vs a "manage photos" view vs album mental model), the
hero-vs-gallery split, the add/manage interaction (multi-select, reorder, captions), what the card shows,
the Gallery-page data binding (auto-populate vs independent — the key integration Q), and the scope-creep
check (is this "multi-photo per First" or a broader "albums/moments" concept?).

Backend data layer (first_time_photos V38 + /first-times/{id}/photos endpoints) is KEPT dormant — reuse it,
don't re-migrate. Keep GalleryCanvas + the gallery template + its dispatch points untouched.

Build order once decisions land:
1. Verify the s4 in-card editor removal is clean (already removed — check no dangling props/handlers).
2. Build the redesigned add/manage interaction.
3. Wire the Gallery-page data binding decided above.

Read sv2-s9.0a-…md, MemoriesTab.jsx (FirstTimesTab/FirstTimeCard), CradleHq.jsx first-photo handlers,
first_time_photos backend, imageUtils.jsx before coding.
```

---

## SV2-S9.0b — Family relationships & editable titles  (was sv2-s5.5)  ✅ COMPLETE 2026-07-02

```
Session SV2-S9.0b — real family-relationship model + editable titles (was sv2-s5.5).
Plan: plans/storybook-v2/sv2-s9.0b-family-relationships.md
Run BEFORE sv2-s9.1 demo seed — it changes the family_members schema the seed writes.
Depends on: sv2-s5 (Family Tree) + sv2-s3 (family_members data).

⚠️ DESIGN DISCUSSION FIRST. Resolve: the relationship model (structured enum vs linked-member edges vs
hybrid — plan leans linked-parent for grandparents), step/blended-family support + how many parent-tier
people to allow + how steps render, and migration/backfill from existing role/role_category.

Full-stack, once decisions land:
1. Migration: add display_title + relationship/linked_member_id + is_step to family_members; backfill from role.
2. Backend com.gotcherapp.api.family — DTO + service columns; keep or derive roleCategory.
3. FamilyRosterPopup — split role into display title + relationship; grandparent "whose parent?" picker; step toggle.
4. FamilyTreeCanvas — place grandparents by linked parent (not roster-slot order); handle >2 parents / steps / overflow.
5. PeopleCanvas — show the display title.

Read sv2-s9.0b-…md, FamilyRosterPopup.jsx (inferCategory), FamilyTreeCanvas.jsx, FamilyMember.java,
V41__create_family_members.sql, PeopleCanvas.jsx before coding.
```

---

## SV2-S9 — Polish + PDF Integration  (was sv2-s8)

```
Session SV2-S8 — Polish all v2 page types and fix PDF export for the guided book.
Plan: plans/storybook-v2/sv2-s9-polish-pdf.md
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

## SV2-S8 — "Before You Arrived" Pregnancy Chapter  (was sv2-sP)

```
Session SV2-SP — pregnancy guided chapter ("Before You Arrived").
Plan: plans/storybook-v2/sv2-s8-pregnancy-chapter.md
Depends on: sv2-s6 (guided book shell + ChapterDividerPage), sv2-s1 (Letter component).
Pattern-after: sv2-s5 / sv2-s7 (Firsts chapter derivation).

⚠️ Re-discuss as part of the v2 re-talk before speccing — open questions in sv2-s8-pregnancy-chapter.md.

The pregnancy DATA layer is already shipped (plans/pregnancy/ S1–S3 + S5): due_date + phase (V35),
bump_photos (V36), BumpCard/BumpDiary, 37-row size dataset, and (S5) bump-as-journal that makes
pre-birth entries phase-flagged and date-driven. So this session is derivation + a thin page wrapper,
NOT new schema.

Build (validate against current code first):
1. A front-of-book "Before You Arrived" chapter in GUIDED_BOOK_ARC.
2. A fixed-layout 600×800 BumpPage wrapper around the existing BumpCard (photo + size caption +
   date + note; text-only variant for photo-less S5 entries).
3. Open the chapter with the pre-birth letter (reuse sv2-s1 LetterPage) ± a ChapterDividerPage.
4. Route phase-flagged pre-birth journal entries in by FLAG, not birthdate-relative week.
5. storybookPdf.js: bump pages export (verify BumpCard's Twemoji <img> survives html2canvas).

Read sv2-s8-pregnancy-chapter.md, GuidedBook.jsx, BumpCard.jsx, the Firsts-chapter wiring before coding.
```

---

## SV2-S12 — Print-on-Demand (Lulu)  ⛔ BLOCKED until external setup returns  (was sv2-print)

```
Session SV2-PRINT — physical book ordering via Lulu print-on-demand.
Plan: planning.md §6 + plans/storybook-v2/print/print-full-plan.md (detailed spec).
External blocker: plans/storybook-v2/print/lulu-spec-handoff.md MUST be filled in first
  (Lulu account, API creds, confirmed trim size / bleed / color profile / min pages,
  redirect-vs-POST checkout, white-label, ToS). Someone with Lulu access owns that.
Also gated on: Payments (Stripe merchant-of-record) — currently Not started.
Sequence: LAST v2 workstream — run only after sv2-s1…s8 page types are stable.

⚠️ REVISED 2026-07-09: print is PAY-PER-ORDER, gated on NOTHING. No plus/pro check — there is no
   subscription and users.tier is vestigial. Print needs its OWN Stripe checkout (variable amount =
   copies × unit + shipping, plus a shipping address) — the fixed-price credit/share flow does not
   cover it. Budget a second mode:'payment' flow.

Do NOT start the engineering sessions until the hand-off doc has answers for at least
Q4 (checkout flow) and Q8 (trim size) — those are hard blockers. The doc contradicts itself on trim
(6×9 in one place, 8×10 in another): BOTH are guesses. Do not hardcode either.

Sub-sessions:
1. sv2-print-plan — with hand-off answers in hand, lock the Lulu API open questions.
2. sv2-print-s1 — Backend: OpenPDF print assembly + Lulu order submission.
   ⚠️ THE BIG LIFT: reproduce EVERY page type at 300 DPI server-side — 10 named templates + the
   freeform LayoutRenderer fallback + the cover (built as raw DOM). Read the dispatch in
   storybookPdf.js and match it; the page-type lists in the plan docs have drifted twice. The
   data-driven pages (birth-day, people, family-tree, milestones) need live pageData. The Lulu API
   call at the end is trivial by comparison — scope accordingly.
3. sv2-print-s2 — Frontend: "Order a Printed Book" UI (ANY user), quantity picker, shipping address,
   Stripe checkout, order confirmation.

Read print/print-full-plan.md, print/lulu-spec-handoff.md, storybookPdf.js, bookCanvas.jsx before coding.
```

---

## SV2-S10 — Per-field "✨ write this for me" assist (shared)  (was sv2-ai-assist)

```
Session SV2-AI-ASSIST — the ONE reusable per-field AI assist (planning.md §8).
Plan: plans/storybook-v2/sv2-s10-ai-assist.md
Depends on: at least one manual text field exists (sv2-s1/s2/s3). Best after the core page types.
Not a blocker for those sessions — they ship the manual path; this wires in afterward.

This is the ONLY AI surface in v2. It words ONE existing field — it never makes pages.
Paid-gated, 1 credit per field, free users see it visible-but-inert (upsell).

Build in this order:
1. Backend POST /storybook/assist-field { promptType, context } → { text }. Gate non-paid
   (mapped ApiError, catch Exception — 401 trap). Debit 1 credit with the charge-then-refund
   pattern from StorybookService.java:174-224. Server owns the prompt templates (client sends
   promptType + structured context only). Per-field Claude call — NOT generatePagesBatch.
2. Frontend AiAssistField.jsx — ✨ button next to a field; free=inert+upsell, paid=draft into
   field for accept/edit/discard; shows credit cost + balance + out-of-credits path.
3. api.js assistField() helper; SecurityConfig allow the endpoint.
4. Drop AiAssistField into: letter body, birth note, person bio, moment-hero note, bump note.

Read planning.md §8, StorybookService.java (generatePages credit pattern), ClaudeClient.java,
api.js before coding.
```

---

## SV2-S11 — Decommission old batched AI page-generation  ⚠️ live credit-charging code  (was sv2-ai-retrofit)

```
Session SV2-AI-RETROFIT — DELETE the old "AI builds your book" path (planning.md §8 relic).
Plan: plans/storybook-v2/sv2-s11-ai-retrofit.md
Depends on: sv2-ai-assist shipped first (so per-field assist exists before bulk path is removed).

⚠️ Behavior change to LIVE credit-charging code. Unwind carefully; keep IDOR checks (review-fixes s3)
and the generated_content READ path (old books must still render). No data migration.

Remove:
- Backend: StorybookService.generatePages() (~131-224) + its credit debit/refund;
  StorybookController POST /storybook/generate-pages/{id}; ClaudeClient.generatePagesBatch();
  batch-only DTOs (audit generated_content reads first).
- Frontend: StorybookWizard.jsx generate-first flow (runGenerateFirst, onWizardGenerate,
  onGeneratePages, step-6 generatedChapter, "Upgrade to Plus to generate" gating). Wizard
  becomes create-chapter → empty manual builder. Remove generate props from StorybookTab.jsx.

Keep: users.tier + ai_credits_remaining (now meter sv2-ai-assist), the whole builder + PDF.

Read sv2-s11-ai-retrofit.md, StorybookService.java, StorybookController.java, StorybookWizard.jsx
before touching anything.
```

---

# ═══ PAID BUNDLE ═══
Run order + status reconciled in `sv2-s9.6` (2026-07-09). Payments is the **trunk** — share and print
both gate on its one-time checkout. Model: **no subscription.** Credits and the share unlock are
one-time purchases; print is pay-per-order. `users.tier` is vestigial — never gate on it.

---

## SV2-S9.6 — Paid-bundle plan reconcile  ✅ COMPLETE 2026-07-09  (docs only, no app code)

```
Session SV2-S9.6 — reconcile the paid-bundle plans against reality before any of them are built.
Plan: plans/storybook-v2/sv2-s9.6-paid-bundle-plan-reconcile.md
NO APP CODE. Plan edits + reference fixes only.

Decisions locked this session (Michael):
- Credits = one-time packs, NOT a subscription. Gate on balance, never on tier.
- Print = pay-per-order, no tier gate. Pro tier dropped.
- Share = one-time $10, PER BOOK (not per account).
- SKUs: $5/50cr · $10/125cr · $15/150cr+share (recommended) · $10/share-only.

Findings already recorded: next migration is V46 (not V32/V44); credits_reset_at exists (V23) and
goes unused; [CLAUDE-DEBUG] already gone (s11); PaidGate.jsx does not exist; there is NO react-router
in the project; AiAssistService already refunds a credit on a failed Claude call.
```

> **Superseded since:** V46 was taken by `sv2-grant` (free_grant_at) later the same day — the Stripe
> migration is **V47**. Everything else above still holds.

---

## SV2-GRANT — Free signup credits, capped at first N users  (small; run BEFORE Payments S2)

```
Session SV2-GRANT — give the first N signups 5 free AI credits so they can try ✨ before buying.
Plan: plans/storybook-v2/sv2-grant-free-credits.md
Origin of the decision: sv2-s9.6-paid-bundle-plan-reconcile.md → "Free signup grant"

Why: new users currently start at 0 credits (V23 DEFAULT 0; AuthService.java:48 inserts only
email/hash/display_name). They see ✨ everywhere, click, and are told they have none — having never
seen it work. Nobody buys a consumable they haven't tried.

Build:
- Migration: ALTER TABLE users ADD COLUMN free_grant_at TIMESTAMPTZ;  (null = never granted)
- Config: FREE_GRANT_LIMIT (default 500) + FREE_GRANT_SIZE (default 5). Env-driven, NOT hardcoded —
  tuning N must never require a migration.
- AuthService: after the signup INSERT, attempt the grant.

⚠️ TRAP 1 — do NOT count `ai_credits_remaining > 0` to decide if the cap is reached. That drops a user
   the moment they spend their last credit, so grant #501 fires as soon as user #3 runs dry. Count
   free_grant_at IS NOT NULL.
⚠️ TRAP 2 — read-count-then-insert is a TOCTOU race; two concurrent signups both read 499 and both
   grant. Do it in ONE conditional UPDATE guarded by `free_grant_at IS NULL AND (subquery) < :limit`.
   Zero rows affected = cap reached or already granted. Not an error.

Ship before Payments S2 so you can measure how fast real users burn 5 credits before locking pack sizes.

NOT in scope (recorded in s9.6, folded into sv2-s14): email_verified is never enforced, so this cap is
a launch promotion, not an abuse control — a script with throwaway emails can drain all 500 grants.
```

---

## PAYMENTS — Stripe one-time checkout  (3 sessions: S1 backend · S2 frontend · S3 credit mgmt)

```
Session PAYMENTS — one-time Stripe checkout. THE TRUNK: share + print both depend on it.
Canonical plan: plans/storybook-v2/payments/stripe-full-plan.md  ← read the MODEL CHANGE banner first.

There is NO subscription. Do not build: tier_expires_at, tier_grace_until, grace-period UI,
downgrade-on-lapse, Billing Portal, "Manage Subscription", monthly credit reset, Pro tier.

S1 backend: V47 migration (stripe_customer_id + books.share_unlocked_at + stripe_events_applied
  ledger — V46 was taken by sv2-grant) · Stripe SDK · POST /billing/checkout (mode:'payment', takes
  sku + optional bookId — VALIDATE OWNERSHIP: books has no user_id, join via baby_profiles.user_id)
  · POST /billing/webhook.
  ⚠️ The webhook MUST be idempotent. Stripe retries; a double-grant hands out credits nobody paid
  for. Insert the evt_ id first, grant only if that insert won. One transaction.
S2 frontend: credit-pack + share purchase modal. PaidGate.jsx DOES NOT EXIST — build fresh. The real
  seam is the onGetCredits callback in Frontend/src/contexts/AiCreditsContext.jsx (left undefined
  on purpose in s10b). Success screen needs a route — the app has no router (see s13).
S3 credit mgmt: admin credit adjustment + balance display. NO reset job (nothing to reset).

Also: fix the stale "20 credits for $2" comment in AiAssistService.java:13 to match the real SKUs.

Geography (decided 2026-07-09): Stripe Radar rule blocking non-US card countries — build in S1. Verify
the rule syntax in the dashboard first. A blocked card is a DECLINE: surface "We currently only sell in
the US", not a raw Stripe error. Restricts who can PAY, not who can USE the app.

Mobile (decided 2026-07-09): app stores are already US-only. Digital SKUs are Stripe/web ONLY — no IAP.
In S2, gate ALL purchase UI behind Capacitor.isNativePlatform(). On native, leave
AiCreditsContext.onGetCredits UNDEFINED (exactly as s10b built it) so the out-of-credits state stays
informational. See stripe-primer.md §9 for the App Store clauses and the staged-submission plan.
```

---

## SV2-S13 — Public share link  (fresh build; $10 per book)

```
Session SV2-S13 — public /book/{token} share link. FRESH BUILD, not a resume.
Plan: plans/storybook-v2/sv2-s13-share-link.md  ← read the RECONCILED header first.
Depends on: Payments (the $10 purchase).

⚠️ THE APP HAS NO ROUTER. No react-router dependency; App.jsx is an auth gate. Decide: add a router,
   or branch on window.location.pathname before the gate. This is a decision, not a check.
⚠️ The old sharing backend was REMOVED (V25 book_share_tokens migration kept, code gone). That table
   predates multi-book — confirm its shape before reusing it.
⚠️ Separate the ENTITLEMENT (books.share_unlocked_at — paid once) from the TOKEN (revocable secret).
   Regenerating a link must NOT re-charge.
⚠️ The public renderer goes through LayoutRenderer + EVERY *Canvas — same dispatch set as
   Frontend/src/lib/storybookPdf.js (10 templates + freeform fallback + cover). Read that file; do
   not trust any page-type list in a plan doc. Data-driven pages need pageData, PII-filtered.

Gate on the book's unlock state, NOT on tier.
```

---

## SV2-HYGIENE — Remove [CLAUDE-DEBUG] logging  ✅ COMPLETE BY DELETION (2026-07-09)

```
NO SESSION NEEDED. sv2-s11 deleted the batch ClaudeClient path and every [CLAUDE-DEBUG] call site.
Verify: grep -rn "CLAUDE-DEBUG" Backend/src   → returns nothing.
```

---

## SV2-S14 — Paid-bundle hardening + verification  (NOT YET WRITTEN)

```
Session SV2-S14 — one focused pass over the money/vendor paths before they sit on prod untouched.
Plan file does not exist yet — write it first.

Cover: webhook idempotency + retry replay · declined/failed payments · refunds (esp. share unlocked
on the wrong book) · Lulu order rejection below min page count · low-balance alert on the Anthropic
card · book-ownership authz on the share purchase (IDOR).

⚠️ email_verified is READ but NEVER ENFORCED (AuthService, verified 2026-07-09) — an unverified
   account can log in and hit the API. That makes the free-grant cap (sv2-grant) a promotion, not an
   abuse control: throwaway emails can drain all N grants. Fix: enforce verification at login, and/or
   move the grant from signup to the verify endpoint.

ALREADY DONE, don't re-litigate: AiAssistService refunds the credit on a failed Claude call
(AiAssistService.java:88).
```

## DEPLOY-0 — First production deploy, dormant (~1.5-2h) — **run BEFORE P12 and pr10**

```
sv2 DEPLOY-0 — get payments-v1 onto prod with NOTHING turned on. Plan: sv2-deploy-0-first-prod-deploy.md
The branch is ~36 commits ahead of main and carries three features that have NEVER been in production
(payments, share, print). Stripe stays on TEST keys; PRINT_ENABLED=false; Lulu stays sandbox.
Prove the boring infrastructure, in this order: back up the DB -> deploy -> Flyway reaches v53 and the new
print beans construct -> SMTP ACTUALLY DELIVERS (the quietest failure mode we have: EmailService silently
no-ops when unconfigured, and a failed send still burns the one-shot notify guards) -> Caddy passes the raw
body + Stripe-Signature -> headless Chrome renders a PDF ON THE VPS -> share links work in prod (never yet
exercised there) -> one 4242 test purchase grants credits -> print is provably dormant (409, no session).
Do NOT touch: live Stripe keys/products/webhook, Lulu prod creds, PRINT_ENABLED, ToS. Those are P12 and pr10.
```

## REVIEW-0 — 5-pass branch code review (~3-4h + fixes) — **the ship gate, run BEFORE DEPLOY-0**

```
sv2 REVIEW-0 — the standing 5-pass pre-ship review. Plan: sv2-review-0-branch-review.md
Passes, in order (documentation LAST so it describes final code): dead code, duplication, test coverage,
documentation, general improvements.
SCOPE = 6ab07b0..HEAD (189 files / 16.5k insertions), NOT main..HEAD. Everything up to PR #26 (2026-06-21)
already had this exact treatment - branch-review.html + storybook-and-pregnancy-review-fixes/ s1-s11, all
Complete. Don't re-review it.
Pass 5 is the high-value one here (first real-money code): audit every route under the SecurityConfig
permitAll namespaces (/print/**, /admin/**, /book/public/**, /billing/webhook) for self-authorization - we
hit that trap twice; IDOR user_id in WHERE not just a pre-check; the Spring 401 catch(Exception) rule;
no secrets in logs; webhook idempotency on every branch; migrations V37-V53 additive-only.
TRIAGE every finding as SHIP-BLOCKER (fix before DEPLOY-0) or DEFERRED (log, slice later). Do NOT let dead
code/duplication findings turn into a pre-ship refactor.
Output branch-review-storybook-v2.html at repo root - do NOT overwrite branch-review.html (June's record).
```
