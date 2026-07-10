# Storybook V2 — Planning

**Status: Living reference — core v2 SHIPPED, paid bundle remains.** Open questions in §4 decided;
LULU/print folded in (§6); deferred-session triage (§7); AI-separation model (§8).
**Where things stand (2026-07-09):** sv2-s1…s9.6 are **Complete** (core book verified 2026-07-03).
What's left is the **paid bundle**: `sv2-grant` (Needs Verification) → **Payments** (the trunk) →
`sv2-s13` share → `sv2-s12` print → `sv2-s14` hardening. See the run order in §3.
**Pricing model changed 2026-07-09:** no subscription, four one-time SKUs, `users.tier` vestigial.
Sections written before that date may still say "paid tier" — where they conflict,
`payments/stripe-full-plan.md` wins.  
**Depends on:** storybook review-fixes track **Complete** (s1–s11) + S13/S15 **Complete**. See §0.  
**Key model shift (§8):** core book is **AI-free by default** (built from your data + your own words);
AI is a **separate, opt-in, paid-gated per-field "write this for me" assist**. This **unblocks core v2
from Payments** — only the AI assist, print, and share sit behind the paid wall.  
**Reference:** `research.md` (Precious Five competitive analysis)  
**LULU / print-on-demand:** now an explicit v2 workstream — see §6 and the hand-off doc
`lulu-print-handoff.md`. **External dependency:** the Lulu account + API + spec confirmation is
setup work someone other than the implementing session must do first.

---

## ⭐ DIRECTION UPDATE (2026-06-27) — guided book is a PRE-DESIGNED FILL-IN book, not auto-generated

This supersedes the "automatic guided mode" framing in §1/§4/§8 and reshapes the remaining sessions.
Discussed + mocked 2026-06-27. **Mockups (page lists):** `mockups/s6-guided-first-year-book.html` (25 interior
pages) and `mockups/s6-guided-pregnancy-first-year-book.html` (30 interior pages).
**Mockups (in-app s7 — added 2026-06-27):** `mockups/s7-guided-book-in-app.html` (the guided book drawn in the
real Storybook-tab chrome — cover, theme swatches, Guided⇄Freeform toggle, progress + locked page-sequence),
`mockups/s7-book-library-and-chooser.html` (a shelf of books + the new-book Guided/Freeform chooser dialog),
`mockups/s7-guided-book-shell.html` (abstract wireframe of the same flow).

**The model.** The guided book is **a pre-designed keepsake the user fills in** — like a printed
"baby's first year" book with labeled pages. *We* choose the page sequence and each page's layout and
**lock it**; the user **drags their photos / types their words** into the slots (reusing the existing
ScrapbookBuilder fill mechanics). Three page kinds:
- **auto** — fills from data already entered (Your People, Birth Stats, Family Tree, the bump size tag).
- **fill** — an empty designed page the user drops photos/text into (most pages).
- **pick** — a designed slot where the user **chooses which First** to feature (a few moment-hero pages).
Pages are **locked** (no add/remove/reorder) for v1 — flexibility deferred to a future plan. Per-page
prompts/labels ("Your First Bath") are what make it feel guided. It is **NOT** auto-derived/variable-length.

**Two default books (adaptive).** Baseline **"Your First Year" = 25 content + 5 dividers = 30 interior
pages** (birth → 1st birthday). When the profile has **pregnancy data**, a **5-page pregnancy chapter
front-inserts** (+ its own divider) → **"Bump to One" = 29 content + 6 dividers = 35 interior pages**.
Cover + back cover wrap *around* the interior count. Counts **locked at 30 / 35 interior** (2026-06-30;
assumed to fit Lulu's page rules — revisit only if Lulu later rejects them).

**DROPPED: the old sv2-s5 (moment-hero) + sv2-s7 (firsts chapter)** — the auto-derived Firsts chapter.
(Those numbers are now reused: s5 = Family Tree, s7 = Guided shell.) Firsts now appear as **a few user-picked
moment-hero pages** inside the fixed book — no mass page generation. Moment-Hero + Gallery remain manual
scrapbook templates (already shipped). See those plans for the drop notes.

**Pregnancy chapter (now sv2-s8) reframed.** No longer an auto firsts-clone. It is **fixed fill-in pages**:
A Letter Before You Arrived · The Day We Found Out · Your First Photo (ultrasound) · The Bump ×2
(Getting Ready for You dropped 2026-06-30). The **week→size comparison is a small AUTO TAG layered on bump photos** ("how big
were you here"), **not** a standalone page. Uses the shipped 37-row size dataset.

**Page types the default book needs (build before the shell, sv2-s7):**
- ✅ exist: Cover (BookCover), Letter (s1), Birth Stats (s2), Your People (s3), Gallery + Moment-Hero.
- ✅ **sv2-s5 Family Tree** — *default-book page* in the People section. **Built 2026-06-27 (Needs Verification).**
- ✅ **sv2-s6 Fill-in Page Types** — Chapter-divider, growth spread (→ "Trio + Note"), prompt pages
  ("All About You"), hands & feet (→ "Pair + Caption"), Bump page (size comparison = caption under photo, not
  an overlay pill). **Built 2026-06-27 (Needs Verification).**

**Build order (renumbered 2026-06-27 — see §3 for the full map):** page types s1–s4 ✅ done →
**s5 Family Tree ✅** → **s6 Fill-in page types ✅** → **s6.5 prefill + milestones renderer ✅** (Complete
2026-06-28) → **s7a Books + library** ← NEXT
(books table + backend CRUD + library/switcher/chooser + remove AI card) → **s7b Guided arc** (Model A
instantiation + fill mechanics + prompt copy) → **s8 Pregnancy chapter** → **s9 Polish/PDF** →
s10 ai-assist / s11 ai-retrofit / s12 print. **S7 was split into s7a/s7b on 2026-06-28** (storage = Model A).
**Old s5 (moment-hero) + s7 (firsts) removed.**

**Default-book arc LOCKED (2026-06-28; divider count + page totals locked 2026-06-30):** the full
page-by-page sequence for both books is resolved in `sv2-s7-plan-default-book.md` — auto/prefill/fill/pick
kind per page, template per page, **5 dividers (First Year) / 6 dividers (Bump)**, and the pregnancy
front-insert rule (replaces the opening letter: 25 − 1 + 5 = 29 content). Interior totals **30 / 35**.
S7 adds **no new page types**.

**s7 decisions reached in the in-app mockup pass (2026-06-27):**
- **Mode = a Guided⇄Freeform toggle** in the Book tab (Guided = "Recommended"); not a separate tab. Mirrors the
  existing `builderChapter` full-screen pattern (§0).
- **Books become a (light) library — multi-book is IN v1 (decided 2026-06-27).** Most users have **one** book;
  some want more. The shelf is **NOT the landing page** — **0 books** → new-book chooser dialog → book; **1 book**
  → land *inside* it with a quiet "Lily's First Year ▾" switcher; **2+ books** → the switcher opens a "Your Books"
  shelf (cover-thumb cards + type/theme/progress + a `⋯` rename/duplicate/delete/export menu + "Start a new book"
  tile). **Needs a new `books` table** (baby owns many books). **CLEAN BREAK (decided 2026-06-28, pre-prod):**
  the dev book data is cleared, not migrated — plain schema add, no reparenting. Supersedes the earlier
  "no new table" note AND the earlier "reparent existing chapters" plan. See sv2-s7 plan item #5 + its
  "Existing books — CLEAN BREAK" section.
- **Remove the AI "Write a Period Chapter" card** from the tab. AI page-gen is deferred (core ships free, no AI);
  the only AI is the separate opt-in paid per-field assist (**s10/s11**). Freeform = layouts/photos/text only —
  no AI surface anywhere in s7. Wizard code stays in the repo, just unmounted.

---

## 0. Current State — what's actually built (verified against code 2026-06-22)

This section grounds the rest of the plan in the real codebase so sessions don't re-assume stale
shapes. Paths verified this date.

### Storybook (scrapbook) — shipped and live
- **Entry point:** `Frontend/src/components/tabs/StorybookTab.jsx` — renders the chapter list and
  launches the builder full-screen via `builderChapter` state (`StorybookTab.jsx:30`, `:126`,
  `onEditLayout` at `:267`). **This is the pattern the Guided Book shell (sv2-s7) mirrors** — add a
  parallel `guidedBookOpen` state + entry point, don't invent a new tab (matches Q1 decision).
- **Builder components** (`Frontend/src/components/storybook/`): `ScrapbookBuilder.jsx`,
  `StorybookWizard.jsx`, `LayoutRenderer.jsx`, `Slot.jsx`, `MemoryPanel.jsx`, `PhotoTray.jsx`,
  `TemplateSheet.jsx`, `BookCover.jsx`, `RichTextEditor.jsx` + `FontPicker.jsx` + `FormatToolbar.jsx`,
  and **`MomentHeroCanvas.jsx`**.
- **Libs** (`Frontend/src/lib/`): `bookThemes.js` (theme tokens), **`bookCanvas.jsx`** (`CANVAS_W` /
  `CANVAS_H` page dims — this is the "bookCanvas" the session prompts say to read), `storybookLayout.js`,
  `storybookPdf.js` (html2canvas → jsPDF export), `storybookTemplates.js`, `storybookText.js`,
  `storybookGrouping.js`, `storybookPeriods.js`.
- **Backend** (`Backend/.../api/storybook/`): `StorybookController`, `StorybookService`,
  `ClaudeClient`, dto records. Page content is generated **batched, one page per memory** via
  `generatePages()`; each page costs **1 AI credit**, debited atomically up-front with a
  charge-then-refund-on-failure pattern (`StorybookService.java:174–224`).

### ⚠️ Naming mismatches to fix in the sessions (plans assume names that don't exist)
- **S13 shipped as `MomentHeroCanvas.jsx`, NOT `MomentHeroPage.jsx`.** sv2-s5 / sv2-s7 / sv2-s8 all
  reference `MomentHeroPage.jsx`. Before sv2-s5, **read `MomentHeroCanvas.jsx` and decide**: is it
  reusable as a fixed-layout book page, or is it builder-canvas-coupled and needs a thin
  `MomentHeroPage` wrapper? This is the first thing sv2-s5 must resolve.
- `bookCanvas` is `lib/bookCanvas.jsx` (not a component) — session prompts that say "read
  bookCanvas.jsx" are correct, just note it's a lib.

### ⭐ Page-type implementation pattern (DECIDED 2026-06-24) — applies to every v2 page type
Every new page type (Letter, Birth-Stats, People, Moment-Hero, Gallery, Chapter-Divider) is a
**layout template + renderer inside the existing book canvas** — the **moment-hero pattern** — **NOT its
own `anchor_type` chapter**. Concretely, a page type:
1. adds a template to `lib/storybookTemplates.js` with `renderer: '<name>'` + role-id blocks (the
   renderer ignores block x/y and lays out its own fixed design, reading content via `blk('role')`;
   theme-independent palette, like `MomentHeroCanvas`);
2. adds a renderer component dispatched at **three points** — `ScrapbookBuilder` (builder edit),
   `LayoutRenderer` (read view), `storybookPdf.js` (PDF) — plus a `TemplateSheet` thumbnail;
3. is **added via the builder's template picker** and stored as a page in a chapter's `layout_data`,
   saved through the existing `PATCH /storybook/{id}` — **no new anchor_type, create endpoint, column, or
   migration for the page itself**.

Page-type **data** that needs its own table (e.g. `birth_details`, `family_members`, `first_time_photos`)
lives in its own endpoint/table; only the **page** is a layout template that reads that data.

> **Why this is called out:** sv2-s1 first built the letter the wrong way (a bespoke
> `anchor_type='letter'` chapter + a generic `POST /storybook/chapters` endpoint + standalone card) and it
> was **fully reverted** to the template/renderer pattern. **Do not reintroduce the chapter-type paradigm**
> in sv2-s2/s3/s4/s5. The per-session plans' older "anchor_type = '…'" / "is a chapter type" lines are
> **superseded** by this pattern.

### Tiers & credits — partially real
- `users` has **`tier`** and **`ai_credits_remaining`** columns (`UserDto.java:10–11`); AI generation
  is genuinely credit-gated today.
- **BUT the Payments/Stripe track is `Not started`** (canonical plan:
  `payments/stripe-full-plan.md`; the old `s0`/`s1`/`s2` files were **deprecated 2026-07-09** — they
  described a subscription that no longer exists). The credit column exists and is read for gating, but
  there is **no purchase flow** to put credits in it yet. There are no `plus`/`pro` tiers to move a user
  to. **Per §8 the paid wall gates only three things — AI per-field assist, print, share — and core v2 is
  unblocked from Payments.** Meanwhile the AI affordance ships visible-but-inert (the `onGetCredits` seam
  in `AiCreditsContext` is deliberately `undefined`), and `sv2-grant` gives the first N signups 5 credits
  so it can be *tried* before Payments lands. **Flag this dependency** (now scoped, not blanket).
- **Gating is on CREDITS, not tier** (decided 2026-07-07, built in `sv2-s10`/`sv2-s10b`). AI per-field
  assist checks `ai_credits_remaining > 0` and spends **1 credit per field**; it does not branch on
  `tier`.
  > **CORRECTED 2026-07-09.** This bullet used to end: *"`tier` remains the thing Payments sets, and the
  > thing that refills credits. Print and share still gate on `tier`."* **All three claims are now false.**
  > `users.tier` is **vestigial — nothing reads it, nothing sets it.** Nothing *refills* credits: they are
  > bought as one-time packs and never expire (no reset job). **Print gates on nothing** (pay-per-order)
  > and **share gates on the book's own `books.share_unlocked_at`**, not on the account.
  Single source of truth: §8 and `payments/stripe-full-plan.md`.

### Pregnancy data layer — shipped (see §5 + `sv2-s8-pregnancy-chapter.md`)
- `baby_profiles.due_date` + `phase` (V35), `bump_photos` (V36), `BumpCard.jsx`/`BumpDiary.jsx`,
  37-row size dataset, `com.gotcherapp.api.bump`. Only the guided-book derivation layer remains.

### Predecessor tracks — done
- **Storybook & Pregnancy review-fixes** (`plans/storybook-and-pregnancy-review-fixes/`): s1–s11
  **Complete**; s12 polish deferred to `plans/tech-debt/storybook-pregnancy-polish.md`.
- **S13 Moment-Hero** and **S15 L-Wrap follow-up**: both **Complete** (confirmed in-app).
- This **supersedes the old "Depends on: S12 + Deferred items complete" prerequisite** — S12 work and
  its review fixes are done. The remaining "deferred" items are triaged in §7.

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

### Group C — Pregnancy track (data layer SHIPPED; guided chapter remains → `sv2-s8-pregnancy-chapter.md`)

| Feature | What it is | Status |
|---|---|---|
| **Due date + pregnancy mode** | User registers due date; app shifts into "before baby" mode | ✅ Shipped (pregnancy S1–S2: `due_date` + `phase`, V35) |
| **Bump diary** | Weekly photo uploads paired with size, week labels | ✅ Shipped (pregnancy S3: `bump_photos` V36, `BumpCard`/`BumpDiary`) |
| **Pregnancy journal** | Notes/entries during pregnancy | 🟡 Pregnancy S5 — bump diary *becomes* the journal (phase-flagged, photo optional) |
| **Pre-birth letter** | "A letter before you arrived" | ↪ Already **sv2-s1** v1 letter type |
| **"Before You Arrived" guided chapter** | Fixed fill-in pregnancy pages in the guided book | ⬜ Remaining v2 work — `sv2-s8-pregnancy-chapter.md` (depends on sv2-s7) |

### Group D — Deferred

- Voice messages attached to moments
- Extended family tree (aunts, uncles, great-grandparents)

---

## 3. Proposed Session Breakdown (post-S12 + Deferred)

> **RENUMBERED 2026-06-27** to match the build order. List below is current. Mapping at the end of §3.

```
═══ SHIPPED (kept as historical record) ═══
sv2-profile-modal  Dashboard refactor    ← ✅ Complete. Edit-Profile modal + baby photo.
sv2-s1  Letter to Baby                    ← ✅ Complete. Letter renderer/template.
sv2-s2  Birth Stats Card                  ← ✅ Complete. birth_details + BirthDayCanvas.
sv2-s3  Your People                       ← ✅ Complete. family_members + PeopleCanvas.
sv2-s3.5  People polish + circular crop   ← ✅ Complete. Page-fit + opt-in circular crop.
sv2-s4  Multi-photo Firsts                ← ✅ Needs Verification. first_time_photos + GalleryCanvas.
sv2-s9.0a  Multi-photo Firsts UX (redesign) ← ❌ DROPPED 2026-07-02 (was sv2-s4.5): decided against; s4
                                            in-card editor already removed. → sv2-s9.0a-multi-photo-firsts-ux.md  [Dropped]

═══ REMAINING — guided book build, in order ═══
sv2-s5  Family Tree                       ← family tree as a default-book page (People section).
                                            → sv2-s5-family-tree.md  [Needs Verification]
sv2-s9.0b  Family relationships (refine)   ← ✅ Complete 2026-07-02 (was sv2-s5.5): linked-parent tree fix +
                                            title/relationship split (steps dropped). → sv2-s9.0b-family-relationships.md  [Complete]
sv2-s6  Fill-in Page Types                ← chapter-divider, growth ("Trio+Note"), prompts, hands&feet
                                            ("Pair+Caption"), bump page. → sv2-s6-fill-in-page-types.md
                                            [Complete — confirmed 2026-07-02]
sv2-s6.5  Prefilled pages                  ← ✅ Complete (2026-06-28). prefill kind (seed-on-display +
                                            refresh) + the new Milestones renderer (polaroid scatter, 7 rows,
                                            editable dates). → sv2-s6.5-prefilled-pages.md  [Complete]
sv2-s7  Guided fill-in book shell         ← SPLIT 2026-06-28 into s7a + s7b. Index: sv2-s7-guided-book-shell.md
       (+ sv2-s7-plan default book)         Default arc LOCKED → sv2-s7-plan-default-book.md
                                            In-app mockups: s7-guided-book-in-app / s7-book-library-and-chooser
sv2-s7a  Books + library                   ← books table + backend CRUD + library/switcher/chooser +
                                            per-book theme/cover + REMOVE the AI card. → sv2-s7a-books-and-library.md
                                            [Complete — verified 2026-06-28]
sv2-s7b  Guided arc                        ← Model A instantiate + fill mechanics (pick/locked/auto/prefill) +
                                            progress + per-page prompt copy. Depends on s7a.
                                            → sv2-s7b-guided-arc.md  [Complete — confirmed 2026-07-02]
sv2-s8  Pregnancy chapter                 ← "Before You Arrived" fixed fill-in pages; size = auto bump tag.
                                            → sv2-s8-pregnancy-chapter.md  [Complete — confirmed 2026-07-02]
sv2-s8.5  Unify freeform (retire periods)  ← move freeform off period chapters toward the unified
                                            page-list editor (§4 Q1); converge with guided's Model A.
                                            → sv2-s8.5-freeform-unify.md  [Complete — confirmed 2026-07-02]
sv2-s9  Polish + PDF integration          ← all page types export cleanly; chain the fixed page sequence.
                                            → sv2-s9-polish-pdf.md  [Complete 2026-07-02]
sv2-s9.5  Verification walkthrough         ← guided manual pass over s7a/s7b/s8/s8.5/s9 against a clean DB;
                                            sign-off flips them all to Complete. → sv2-s9.5-verification.md
                                            [Complete — verified 2026-07-03]
sv2-s9.6  Paid-bundle plan reconcile       ← planning/tidy pass over the moved paid-bundle docs; no app code.
                                            → sv2-s9.6-paid-bundle-plan-reconcile.md  [Complete 2026-07-09]

─── PAID BUNDLE (run order below; Payments is the trunk) ───────────────────────
sv2-grant  Free signup credits (capped)    ← first N signups get 5 credits so ✨ can be tried before buying.
                                            V46 + AuthService. Run BEFORE Payments S2.
                                            → sv2-grant-free-credits.md  [Needs Verification 2026-07-09]
payments/  Stripe track (P0–P12, ≤2h each) ← re-sliced 2026-07-10; the old 3-session split hid 8–14h
                                            sessions. P0 account setup · P0.5 open questions ·
                                            P1 V47 · P2 checkout · P3 webhook+ledger ⚠️ · P4 hardening ·
                                            P5 Radar · P6–P9 frontend · P10–P11 · P12 live cutover.
                                            Run order: payments/session-prompts.md
                                            Canonical spec: payments/stripe-full-plan.md  [Not started]
                                            ⚠️ s0/s1/s2 files are DEPRECATED (subscription era) — see
                                            deprecated/payments-s*.md. Do not build from them.
🛑 RE-SLICE CHECKPOINT (after P5)          ← STOP AND TALK. Calibrate against 6 measured sessions, decide
                                            the print renderer (swings ~30h), then slice s13/s12/s14 —
                                            none of which are sliced, and s12 L1 is a 15–70h "session".
                                            → sv2-reslice-checkpoint.md  [Not started]
sv2-s10  Per-field AI assist              ← shared "✨ write this for me" field + single-field endpoint.
                                            → sv2-s10-ai-assist.md  [Backend Complete; FE via s10b]
sv2-s10b  Assist wiring + refactor         ← AiAssistField wired into all long-text fields + AiCreditsContext.
                                            → sv2-s10b-assist-wiring-and-refactor.md  [Complete — verified 2026-07-08]
sv2-s11  Decommission old batched AI      ← DELETE generatePages() + wizard generate step.
                                            → sv2-s11-ai-retrofit.md  [Complete — confirmed 2026-07-08]
sv2-s12  Print-on-demand (Lulu)           ← print PDF + Lulu order flow; BLOCKED on external Lulu setup.
                                            → lulu-print-handoff.md + sv2-s12-print.md  [Not started]
sv2-s13  Public share link                 ← fresh build (old sharing backend was removed). In scope per
                                            user decision 2026-07-02. → sv2-s13-share-link.md  [Not started]
sv2-hygiene  Remove [CLAUDE-DEBUG] logs    ← ✅ OBSOLETE: s11 deleted every call site (verified 2026-07-09).
                                            → sv2-hygiene-remove-claude-logging.md  [Complete — by deletion]
sv2-s14  Paid-bundle hardening             ← webhook idempotency/retries, declined payments, REFUNDS (esp.
                                            share unlocked on the wrong book), Lulu min-page rejection,
                                            book-ownership authz on the share purchase (IDOR), and
                                            enforcing email_verified (read but NEVER enforced — makes the
                                            sv2-grant cap a promotion, not an abuse control).
                                            NOT "cancel→downgrade" — there is no subscription to cancel.
                                            Credit refund on a failed Claude call is ALREADY DONE
                                            (AiAssistService.java:88) — don't re-litigate.
                                            → NOT YET WRITTEN  [Not started]

═══ DROPPED / SUPERSEDED → moved to deprecated/ (see deprecated/README.md) ═══
deprecated/moment-hero-guided.md          ← ❌ old s5: auto Firsts chapter (firsts now = user-picked pages).
deprecated/firsts-chapter.md              ← ❌ old s7: went with the above.
deprecated/circular-avatar-crop.md        ← old s6.6: folded into sv2-s3.5.
```

**Rename map (old → new):** s9→**s5** (Family Tree) · *(new)*→**s6** (Fill-in types) · s6→**s7** (shell) ·
s6-plan→**s7-plan** · pregnancy-track→**s8** · s8→**s9** (Polish) · ai-assist→**s10** · ai-retrofit→**s11** ·
print→**s12** · s6.5→**s4.5** · old s5/s7/s6.6 → **`deprecated/`** (moment-hero, firsts-chapter, circular-avatar-crop).
*(Deep-body mentions of old numbers in individual plans should be read through this map.)*

**Sequencing note (§8 model):** core page-type sessions (sv2-s1…s8) build the **manual text path
first** and ship **free, no Payments dependency**. `sv2-ai-assist` + `sv2-ai-retrofit` + print + share
are the paid bundle, lit up once Payments lands; until then the AI affordance ships visible-but-inert.

**Build order for the S2/S3 sprint (planned 2026-06-25, implementation deferred):**
1. **`sv2-profile-modal`** — dashboard refactor (summary card + tabbed Edit-Profile modal + baby photo).
   Prerequisite: it hosts S2's birth-details form tab.
2. **`sv2-s2`** — birth_details table/endpoint + Birth-details tab content + `BirthDayCanvas` book page.
   Depends on (1).
3. **`sv2-s3`** — independent of (1)/(2); can run in parallel or after. family_members + add-page popup +
   `PeopleCanvas`.
Mockups for all three live in `mockups/` (`index.html`). All decisions are locked in each plan's
"Decisions locked" block; these three are **planned, not yet implemented**.

**Deferred storybook sessions** were moved into this folder on 2026-07-02 and are triaged in §7 — short
version: print is promoted into v2 as **`sv2-s12-print.md`** (§6); share-link is **in scope** as
**`sv2-s13-share-link.md`** (user decision 2026-07-02, no longer optional);
**`sv2-hygiene-remove-claude-logging.md`** is **already satisfied** — `sv2-s11` deleted the batch
`ClaudeClient` path and with it every `[CLAUDE-DEBUG]` call site (verified 2026-07-09).

Pregnancy track now has its planning file: `plans/storybook-v2/sv2-s8-pregnancy-chapter.md` (data layer
shipped via `plans/pregnancy/` S1–S3; the remaining guided-book chapter rides along with the v2
re-discussion).

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

**RECONCILED (2026-06-22):** "LULU" = **Lulu.com print-on-demand**. There is no separate "LULU work"
landing independently — it **is** the deferred print session (`sv2-s12-print.md`),
now promoted into v2 as the `sv2-print` workstream. See **§6** for the folded-in plan and
`lulu-print-handoff.md` for the external setup that must happen first. The original framing of
"v2 builds on top of LULU once it lands" was backwards: print builds **on top of** the v2 page types,
not the other way around.

Resolved sub-questions:
- **Render pipeline:** v2's fixed-layout page components (LetterPage, BirthDayPage, MomentHero, etc.)
  feed print — but print needs **server-side, print-resolution PDF assembly (OpenPDF)**, not the
  current client-side html2canvas→jsPDF path (screen-DPI, not print-quality). The screen page
  components remain the *design source of truth*; the print renderer re-implements them at 300 DPI.
  **Design each new v2 page type with a print equivalent in mind** (no html2canvas-only tricks that
  can't be reproduced server-side).
- **AI copy:** unchanged — print reuses whatever narrative copy the book already has; no new prompts.

*Print is gated behind external Lulu setup + Payments — keep it the LAST v2 workstream.*

---

## 5. Pregnancy Track — Brief

> **UPDATE (2026-06-18): the data layer described below has SHIPPED — full plan now in
> `plans/storybook-v2/sv2-s8-pregnancy-chapter.md`.** The pregnancy mode (S1–S3 of `plans/pregnancy/`) was
> built *after* this planning doc, so the schema sketch here is **superseded**:
> - `baby_profiles.due_date` **and** a user-controlled `phase` column already exist (migration V35) —
>   not just `due_date`.
> - `pregnancy_photos` already exists as **`bump_photos`** (migration V36): `week`, `image_url`,
>   `note`, `taken_date`, `image_orientation`. Backend `com.gotcherapp.api.bump`,
>   `GET/POST/PATCH/DELETE /bump-photos`.
> - Reusable `BumpCard.jsx` (photo + size caption + date + note), `BumpDiary`, the 37-row size
>   dataset, and `PregnancyHome` are all built.
> - Pregnancy **S5** (next) turns the bump diary into the pregnancy journal (photo optional,
>   phase-flagged, week-derived-from-date) — producing the pre-birth journal data the guided chapter
>   consumes.
>
> **What remains is only the guided-book layer:** a front-of-book "Before You Arrived" chapter that
> derives bump pages (reuse `BumpCard`) + the pre-birth letter (already sv2-s1) + phase-flagged
> journal entries — mirroring the Firsts chapter. Depends on sv2-s6. See sv2-s8-pregnancy-chapter.md for the
> approach, the journal-reframing rationale, and open questions.

Original brief (kept for context — schema is superseded above):

Pregnancy is a bigger UX commitment than any of the above because it requires:
1. A pre-baby user state (app currently assumes baby has already arrived)
2. New data collection (due_date, weekly photo uploads, pregnancy notes)
3. A new "Pregnancy" chapter in the guided book that can be filled in retroactively

**User value:** Parents who are currently pregnant could use CradleHQ from day 1 (before birth), significantly expanding the addressable audience. Worth planning for but scoped as a separate track.

---

## 6. Print-on-Demand (Lulu) — folded into v2 as `sv2-print`

> **This is the "LULU work."** It already had a deferred plan: `sv2-s12-print.md`
> (decisions from Storybook S0 + S2 planning). That file stays as the detailed spec; this section
> places it inside v2 and records what changed. **Companion doc: `lulu-print-handoff.md`** — the
> external setup write-up to pass to whoever owns the Lulu account.

### What it is
Paid users order a physical printed copy of their book. Lulu (lulu.com) handles **printing and shipping**;
the **customer pays through our own Stripe checkout** and we submit a **paid** print job to Lulu (Lulu
auto-charges a company card for print + ship). We assemble the print-quality PDF and submit the order.

### Decisions already locked (from the old sDeferred-print.md — still valid)
- **Vendor:** Lulu print-on-demand (no inventory).
- **Gating:** `plus` / `pro` users only; multi-copy ordering supported (grandparents).
- **Checkout:** ~~redirect to Lulu hosted checkout — no Stripe charge on our side~~ **→ CORRECTED
  (2026-07-01): Lulu's Print API checkout is *external* — we collect the customer's payment via our own
  Stripe checkout, then POST a *paid* print job (Lulu auto-charges a company card). Print therefore
  DEPENDS ON Payments/Stripe.** (See `plans/storybook-v2/handoffs/` + `lulu-print-handoff.md` Q4.)
- **Print is separate from AI credits** — ordering doesn't consume credits.
- **PDF library:** **OpenPDF** (server-side, Apache-licensed) — replaces client-side jsPDF for print.
- **Images:** fetch raw Cloudinary upload URLs server-side (phone uploads are 3000px+, enough for
  300 DPI); **do not** use Cloudinary transformations (free-tier credit limits).

### What changed by folding into v2
- **Page set is bigger.** The print renderer must reproduce **all v2 page types** (Letter, BirthDay,
  People, MomentHero, Gallery, ChapterDivider, Bump) at 300 DPI server-side — not just the legacy
  scrapbook layouts the original print plan assumed. This is the main scope increase.
- **Two book modes to print.** Guided Book and Scrapbook both need to flow into the same print
  assembler. Decide whether a print = one mode or the user picks (mirrors the sv2-s8 PDF question).
- **Sequencing:** print is the **last** v2 workstream — it should consume finished, stable page types,
  not chase them while they change.

### Dependencies & blockers
- ⛔ **External Lulu setup (someone else):** account, API credentials, confirmed trim size / bleed /
  color-profile / min-page-count from Lulu's spec catalog, white-label check. → `lulu-print-handoff.md`.
- ⚠️ **Payments S1** (`payments/stripe-full-plan.md`) is **Not started** — print needs it because *we* are
  merchant of record (we collect via Stripe, then pay Lulu on a company card). **Not** for tier gating:
  print is pay-per-order and gates on nothing. Note print needs its **own** variable-amount checkout with
  a shipping address — the fixed-price digital SKUs don't hand it a reusable flow.
- ✅ **v2 page types** (sv2-s1…s8) — print should follow these.

### Sessions (unchanged, renamed under v2)
- **sv2-print-plan** — resolve Lulu API open questions *after* the hand-off setup returns answers
  (trim size, auth model, redirect-vs-POST checkout, white-label, min pages).
- **sv2-print-s1** — Backend: OpenPDF print assembly (all v2 page types) + Lulu API order submission.
- **sv2-print-s2** — Frontend: "Order a Printed Book" UI, quantity picker, redirect, confirmation.

---

## 7. Deferred storybook sessions — triage (which do we actually need?)

The three formerly-`sDeferred-*` files, **moved into this folder 2026-07-02** and re-triaged for v2.
Verdicts refreshed during `sv2-s9.6` (2026-07-09):

| Session (new name) | Verdict for v2 | Why |
|---|---|---|
| **`sv2-s12-print.md`** (Lulu print) | ✅ **In scope** (§6) | This *is* the LULU work. Highest-value of the three; blocked only on external setup + Payments. |
| **`sv2-s13-share-link.md`** (public `/book/{token}` share) | ✅ **In scope** — user decision 2026-07-02 (was "optional") | Grandparents read without an app. **Fresh build, not a resume:** the old sharing backend was removed (V25 `book_share_tokens` migration kept, code gone) and its plan still describes serving legacy chapter `body` — the book is now `layout_data` v2 pages, so the public renderer must go through `LayoutRenderer` + every `*Canvas`. **Also: the app has no router at all** (no `react-router` dependency; `App.jsx` is an auth gate, not a route table) — `/book/:token` needs a routing decision, not a "check first." Paid-gated → Payments caveat as print. |
| **`sv2-hygiene-remove-claude-logging.md`** (strip `[CLAUDE-DEBUG]` logs) | ✅ **Already done — by deletion** | `sv2-s11` deleted `generatePages()` and the batch `ClaudeClient` path, taking every `[CLAUDE-DEBUG]` call site with it. Verified 2026-07-09: `grep -rn "CLAUDE-DEBUG" Backend/src` returns nothing. No session needed. |

**Recommendation:** promote print (§6); do the logging cleanup as a standalone hygiene task soon;
keep share-link deferred until there's product pull for it (and budget it as a fresh build, since the
old sharing code was removed).

---

## 8. AI as a separate, opt-in feature (DECIDED 2026-06-22)

**The core book is AI-free by default. AI is pulled out into a separate, opt-in, paid-gated
per-field assist.** This is the biggest model change in the re-discussion and it reshapes every page
type plus the dependency graph.

### ⚠️ Two different "AI" things — only one survives (clarified 2026-06-22)
The new system draws a hard line:
- **AI page _generation_ — REMOVED ENTIRELY. A relic of the old storybook we are moving away from.**
  AI never creates pages, page content, or book structure. The old `generatePages()` batched
  page-generation flow is **deleted, not retired-or-hidden, not repurposed.** No "AI builds your book"
  anywhere in v2.
- **AI per-field text _assist_ — survives** as the separate, opt-in, paid feature. It does **not**
  generate pages; it only helps you **word a single text field you already have** (a note/letter/bio
  slot inside a page you already made, manually or via the guided structure). "Write this for me" on
  one field — never "make me pages."

If a future reader is unsure: pages and structure come from **the user (scrapbook)** or **the default
guided arc (guided book)** — *never* from AI. AI's only job is helping phrase text the user opted to
get help with.

### The principle
- The **default** way to build a book — guided **and** scrapbook — uses **only data the user already
  has + text the user writes themselves**. No AI in the normal path.
- **AI is a garnish, not the engine.** It's a separate feature, **normally not used**, that a user
  can opt into to help word a single piece of text — it never produces pages.

### The two book modes (clarified 2026-06-22)
- **Scrapbook** — the user **manually makes pages** (existing free-form builder, continued).
- **Guided Book** — a **default book with a default set of pages** (a predetermined arc + default page
  count) that the user fills in. We need to **design/"set" that default book** — its chapter arc,
  which pages ship by default, and the default page count. **This needs its own planning pass**
  (`sv2-s7-plan`, see §3) *before* the shell session (sv2-s7) builds the page-sequence config.

### Decisions
- **Scope: Forward + retroactive.** Both modes are AI-free by default. The **existing scrapbook AI
  generation** (`StorybookService.generatePages()`, batched, 1 credit/page — live today) is **reframed
  as part of this same separate AI feature**, not the default generation path. One consistent model
  across guided book and scrapbook.
- **Shape: per-field assist only.** AI surfaces as a **"✨ write this for me" affordance on each
  individual text field** (a Moment-Hero note, a Letter body, a People bio, a Birth-day note).
  User-directed, one field at a time. **No whole-book bulk generate, and no AI page generation at all**
  — the batched `generatePages()` path is **removed, not hidden** (see retrofit note + the "Two
  different AI things" callout above).
- **Gating & metering:** per-field assist is **paid-tier only** and **spends AI credits** (the existing
  `tier` + `ai_credits_remaining` machinery stays as the metering mechanism). For free users the
  affordance is **visible but inert** (an upsell), so the value is discoverable before Payments lands.

### What this means for each v2 page type
Every page type now needs a **manual text path as its default**, with an **optional per-field AI
assist** layered on:

| Page type | Default (free, no AI) | Optional AI assist (paid) |
|---|---|---|
| Letter (sv2-s1) | User writes the letter | "Write this for me" from a few prompt words |
| Birth Stats (sv2-s2) | User writes the birth note (or leaves blank) | Generate the note from the stats |
| People (sv2-s3) | User writes each bio | Generate a bio from `bio_input` |
| Moment-Hero (sv2-s5/s7) | User writes each first's note | Generate a note per first |
| Bump / pregnancy (sv2-s8) | Existing notes | (optional) tidy/expand a note |

The sessions for these page types should **build the manual path first**; the AI assist hook is a
**shared component** (see below), not re-implemented per page.

### New / changed work this creates
- **`sv2-ai-assist` (new shared session):** build one reusable **"AI write-for-me" field component +
  backend single-field endpoint** (reuse `ClaudeClient`; per-field prompt instead of batched). Wire
  the paid-gate + credit spend + free-user upsell state once, consume everywhere.
- **`sv2-ai-retrofit` (new, retroactive — "decommission old AI page-gen"):** change the **shipped
  scrapbook** so pages are **made manually** and text **defaults to manual**; **delete the batched
  AI page-generation system** (`generatePages()` and its wizard "generate" step) — it's the relic we're
  moving away from, removed not hidden. The only AI left is the new per-field assist (`sv2-ai-assist`),
  which is a *new* component, not the old code repurposed. ⚠️ This is a **behavior change to live,
  credit-charging code** — treat as its own careful session: unwind the batched up-front credit
  debit/refund logic (`StorybookService.java:174–224`) cleanly, mind the page-gen IDOR history
  (review-fixes s3). **CLEAN BREAK (decided 2026-06-28, pre-prod):** s7 clears the dev book data, so there
  are no books to preserve — fully delete the `generated_content` plumbing (column + read DTOs), not a
  read-only path. (Supersedes the earlier "keep generated text" note.) See sv2-s11 "Data — CLEAN BREAK".

### Dependency impact (the upside)
- ✅ **Core v2 (sv2-s1 … sv2-s8) NO LONGER depends on Payments.** The whole book — guided + scrapbook,
  all page types — ships **free and AI-free**. This removes the Payments hard-blocker from the bulk of
  v2.
- 🔒 **Payments now gates only three things:** the **AI per-field assist**, **print** (§6), and
  **share** (§7). Those become a clean "premium" bundle to light up once Payments
  (`payments/stripe-full-plan.md`, currently *Not started*) lands. Until then the AI affordance ships
  **visible-but-inert** (`onGetCredits` left `undefined` by `sv2-s10b`).
  > **Precision, 2026-07-09.** "Gated by Payments" means *needs a way to be paid for* — **not** gated on
  > `tier`, which nothing reads. Assist gates on the **credit balance**; share gates on that **book's**
  > `share_unlocked_at`; print gates on **nothing** (pay-per-order). And `sv2-grant` puts 5 credits in the
  > first N accounts, so the assist is genuinely usable before Payments exists.
- This **supersedes** the earlier note (in §0 / §6) that paid-tier features broadly block on Payments —
  now precisely scoped to the three above; core book is unblocked.

### Resolved (2026-06-22)
- **Free-user AI affordance:** ✅ **visible-but-inert upsell** — show the "✨ write this for me"
  affordance to free users (discoverability), inert until they're on a paid tier.
- **Credit cost:** ✅ **1 credit per field** (same unit as today's per-page charge).
- **Onboarding/pitch:** ✅ **no change planned.** Pitch stays centred on the keepsake + guided
  structure, not on AI authorship. **One caveat to watch:** the first-run "wow" moment (see note
  below) — that's the only place the change is actually felt.
- **Share + print gating:** ✅ **cut from the free tier entirely** (paid-only, not just limited).
  Same paid bundle as AI assist.

### Resolved — no hidden bulk path (2026-06-22)
- **No bulk "fill all empty" / no AI page generation of any kind.** Per the "Two different AI things"
  callout: AI page generation is removed entirely. Per-field assist is the *only* AI surface. The
  batched path is deleted, not preserved as a hidden power-user option.

### First-run "wow" caveat (the one onboarding risk)
Today a brand-new user can hit "generate" and instantly see polished prose — an impressive aha moment.
AI-free-by-default replaces that with **empty fields to fill in**, which is less immediately wow.
Mitigate by **seeding each field with the user's own raw text** (the journal entry / first-time note
they already wrote) instead of a blank box — so the default still feels populated and personal, just
not AI-authored. Track activation here if we're worried.
