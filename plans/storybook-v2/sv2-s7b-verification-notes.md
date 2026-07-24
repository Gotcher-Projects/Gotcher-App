# SV2-S7b — In-app verification notes

Live testing of the guided book (sv2-s7b), 2026-06-30. Captures issues / observations Michael calls
out during the in-app pass, to triage into fixes afterward. Status legend: 🔴 bug · 🟡 polish/UX ·
🟢 works / confirmed · ❓ needs follow-up.

## Triage → follow-up plans (created 2026-06-30)
- **sv2-s7.5a — Guided memory routing** ← 🔴 Journals/Firsts not draggable on fill pages (the blocker).
  ✅ IMPLEMENTED 2026-06-30 (Needs Verification): collapsible time-bucket panel with all journals +
  firsts (hero + V38 extras) + bump photos; book-wide used-dimming; generic pages all-collapsed.
- **sv2-s7.5b — Builder & canvas fixes** ← Moment Hero page-fit · double-crop · remove Page bg · Letter
  eyebrow (4 small fixes bundled).
- **sv2-s7.5c — Tri-state page progress** ← Not started / In progress / Done.
- **sv2-s7.5e — Dark-theme editable text contrast** ← Midnight edit-mode text renders near-black on the
  dark page (found during s7.5b verification 2026-07-01; RichTextEditor `textColor` never passed).
- **sv2-s7.5d — Growth-spread layout variety** ← 4× Trio+Note (coordinate with s7.5a).
- **Deferred (tech debt):** chronological reorder. **Expected (s8.5):** freeform time periods.

## Run A — Baby-only (First Year, 30pp / "of 25")

- 🔴 **BLOCKER / design — guided fill pages don't surface Journals/Firsts for drag-and-drop.** Only the
  Firsts *pick* pages connect to memories; every other fill page (gallery, spotlight, growth-spread,
  hands-feet, prompts…) has no memory panel, so you can't drag your journal entries / firsts (text +
  photos) in. This was a defining part of what makes the guided book special and it's currently lost.
  **Causes:** (1) I hid `MemoryPanel` in locked mode; (2) more fundamentally, guided chapters have no
  `selectedJournalIds`/`selectedFirstTimeIds`, and the builder derives the panel's `memories` +
  `availablePhotos` from that selection — so even un-hidden the panel would be empty.
  **Needs a design talk before building:** how to route the different pools (journal entries, firsts +
  their additional photos, bump photos, profile/growth photos) to the right pages — e.g. by age/date
  window per section (newborn → The Beginning; month ranges → growth spreads), by type (firsts →
  firsts/pick), with a "show all memories" escape hatch. Options drafted in chat. **This gates
  Complete.** See the design discussion to settle the split, then implement.

- 🟡 **Firsts pick pages — Moment Hero doesn't resize to fill the page well.** The moment_hero
  (polaroid + note card) doesn't scale to the total page size cleanly — likely a slight sizing change
  needed. Component: `MomentHeroCanvas.jsx` (uses fixed px photoW/photoH + flex column on the 600×800
  virtual canvas). Follow-up fix candidate. _(Affects pick pages + the "Happy First Birthday" fill page,
  which also uses moment_hero.)_

- 🟡 **Remove the per-page "Page bg" color picker** (builder, below the canvas). Confirmed it's a no-op
  for most pages: every custom canvas (letter, moment_hero, gallery, chapter_divider, bump, people,
  family_tree, milestones, birth_day) paints its own `theme.bg`, so the picker only affects the generic
  Slot-based templates (classic / spotlight / growth-spread / hands-feet / photo-*). Lean: remove it
  entirely. Location: `ScrapbookBuilder.jsx` "Page bg" block (~731–753), `setCurrentPageBg`, and
  `page.backgroundColor` usage. _(Michael: not a fan either way.)_

- 🔴 **Letter pages — hardcoded "A LETTER TO YOU" eyebrow on every letter page.** ✅ Confirmed by Michael
  on **"One Year of You"** (applies to both that and the pregnancy "A Letter Before You Arrived"). In
  `LetterCanvas.jsx:102` the top eyebrow is hardcoded. Fix: drive it from the page's label/section (pass
  it in like the divider does) rather than a fixed string. _(Also: the canvas forces `background:
  theme.bg ?? CREAM`, overriding the Page bg picker — folds into the "remove Page bg" note.)_

- 🔴 **Double crop when uploading into a fixed-aspect slot (e.g. Trio+Note "Months 6–9" square slot).**
  Uploading a new photo into a slot runs the orientation crop (`openCropModal`, landscape/portrait
  toggle) in `PhotoTray.handleFileChange`, then `assignPhotoToSlot` runs `openSlotCropModal(url, slotAR)`
  again to crop to the slot shape — so the user picks an orientation that's then overridden by a square
  slot crop. **Confirmed cause:** `PhotoTray.jsx:19` always calls `openCropModal`. Fix options: (a) upload
  the raw file from the tray and let the single slot crop handle it, or (b) pass the slot's `slotAR` into
  PhotoTray so it crops once to the slot shape (no orientation step). Lean (a).

- ⏸️ **TECH DEBT (deferred 2026-06-30, Michael's call: leave as-is for now).** Chronological structure —
  interleave Firsts + growth by time (each quarter = growth spread + a First from that span) instead of
  one Firsts block, for a timeline / sense of progress. **Decision: keep the current theme-grouped arc;
  current structure is probably fine. Revisit later.** Feasibility if/when we do it: (1) static
  chronological reorder = EASY (rewrite `guidedBookArc.js` order + sections; revises the locked 30/35
  arc — "Your Firsts" dissolves into quarters, ≈7 dividers); (2) age-scoped pick pages (picker filtered
  to that window via `firstInWindow(first, birthdate, window)`) = folds into the memory-routing window
  logic; (3) "unlocks as baby grows" reveal = MEDIUM, frontend-only; (4) dynamic date-driven insertion =
  HARD, breaks locked Model A — avoid. (Recommend 1+2 with the routing pass if revisited.)

## Run B — Pregnancy (Bump to One, 35pp / "of 29")

_(notes below)_

## Cross-cutting / other

- 🟡 **Growth spreads need variety.** ✅ Confirmed: the **Watch You Grow** section is 4× `growth-spread`
  (Trio + Note) back-to-back (Months 0–3 / 3–6 / 6–9 / 9–12) — too repetitive. Give each month range a
  different layout for variety. Easy lever: swap `templateId` per entry in `guidedBookArc.js` (unused
  layouts available: story-snapshot, staggered, timeline, photo-first, side-by-side, spotlight,
  photo-pair/three, l-wrap…). Pick a distinct, good-looking layout per growth page. _(Coordinate with the
  memory-routing pass, since layout = slot count = how many memories a page pulls.)_

- 🟡 **Want a tri-state page status: Not started / In progress / Done** (instead of today's binary
  done = has-any-content). A page with just one photo or a bit of text should read **"In progress"**, not
  "Done". Needs a definition of "complete" per template — candidate: **done** = every photo slot has a
  url AND every (non-optional) text slot has text; **in progress** = some-but-not-all; **not started** =
  empty. Touches `guidedBook.js` (`isChapterDone` → a 3-state `chapterStatus`), `guidedProgress`
  (count only fully-done?), and the `GuidedBookView` row badges (add an "In progress" state). Open Q:
  which slots are required vs optional (captions are often optional) — decide before building.

- 🟢 **Freeform books still use time periods (wizard).** Expected — retiring periods is **sv2-s8.5**
  (Status: Not started), which replaces the period chapter-card list with a flat "Edit book" page
  sequence. Out of scope for s7b. **Ignore for now.**
