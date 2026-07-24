# Print pr5.5 — PDF acceptance: 32-page minimum + transparency flatten

**Status:** ✅ **Complete** (implemented 2026-07-19; **confirmed 2026-07-21**). Code + unit tests green, and the
Lulu-sandbox tunnel run it was waiting on has since happened many times over — real 32-page books were
**ACCEPTED** by Lulu in pr7, pr9 (job 316095) and the s14 verification run (job 316100), so the page-count gate
is proven against the real vendor. Decisions locked with Michael
2026-07-19: (D1) print filled pages only; (D2) gate at 32, no padding; time-capsule = **fill-only** (does not
auto-count); First Year arc kept at **exactly 32** (no extra headroom). Scrapbook bounded **32–50**.
NOTE the compound consequence Michael accepted: guided chapters have **no add-page affordance**, so a First
Year book is orderable only when ~all 32 pages are filled — flip time-capsule to auto-count, or add a 33rd arc
page, if that proves too strict in practice (both are ~1-line changes).

**What shipped this session:**
- Part A — two new First-Year arc pages (`about-us` → PeopleCanvas seeded with parents via `defaultCategory`;
  `day-you-born` → PromptsCanvas time-capsule), both reusing existing renderers (PeopleCanvas + PromptsCanvas
  made config-driven, no new component). Arc 30 → 32; Bump 35 → 37.
- Part A — the 32-filled-page GATE as ONE backend source of truth: `PrintInteriorService` (MIN 32; freeform
  max 50 / guided max 800; FILL_MORE vs ADD_MORE reason). Print payload now renders **filtered** (filled-only)
  pages via `PublicBookService.getByBookIdFiltered` (shared filter with the share view). Owner endpoint
  `GET /books/{id}/print/orderability`; the lulu-test submit refuses un-orderable books. Freeform builder cap
  raised 30 → 50.
- Part B — Ghostscript transparency-flatten pass in the pdf-sidecar (`server.js` `flattenPdf`, keeps vector
  text + 300PPI images, degrades gracefully w/o `gs`), `ghostscript` added to the sidecar Dockerfile.
- ⚠ MIGRATION GAP: guided books are materialised at creation, so only NEW guided books get the 2 new pages /
  32-page arc. Existing test books stay at 30 — recreate them to verify.

**Original status:** Not started (thinking-through only — planning 2026-07-19, continue another day).
**Why it exists:** the pr5 tunnel e2e proved the Lulu client works, but a real 32-page submit was **REJECTED** by
Lulu's normalizer for **two independent reasons**. Both block ANY book from printing → **pr10 go-live blocker.**
**Depends on:** pr5 (done). **Blocks:** pr10 (and makes pr6–pr9 real, not dev-only).

Two parts, **independently shippable** (could split into pr5.5a / pr5.5b sessions):
- **Part A — Interior page-count compliance** (32-page minimum, across every book type). Includes **two new
  guided page types** (below).
- **Part B — Transparency flatten** (Chrome emits unflattened transparency Lulu rejects).

---

## Part A — Interior page count must be a valid Lulu count (32–800), for EVERY book type

### The finding
SKU `0850X1100FCPREPB080CW444GXX` requires an interior of **32–800 pages**. A 30-page submit was rejected
(*"We found 30 pages… book design requires [32]"*). **32 is the SKU's hard floor — there was never a "30"
minimum in our code**; 30 is what the guided arc happens to produce (see next).

### ⭐ Root of the guided gap — the arcs (`lib/guidedBookArc.js`)
- **"Your First Year" = 25 content + 5 dividers = 30 interior pages** — **2 short of 32 by design.** This is the
  real gap. (This is why book 5 was 30.)
- **"Bump to One" = 5 pregnancy + 1 divider + 29 = 35 pages** — already ≥32. ✓
- **Scrapbook (freeform)** = whatever the user made — can be anything (1 to many).

So each type reaches 32 differently:
| Type | Built by | Page math | 32-min problem |
|---|---|---|---|
| **Guided — First Year** | fixed arc | **30, fixed** | 2 short — fix by adding content (new page types below) |
| **Guided — Bump to One** | fixed arc | **35, fixed** | already fine |
| **Scrapbook (freeform)** | user, by hand | variable | a short scrapbook is < 32 |

### How the printed interior is counted today
Print interior = **every v2 chapter's FULL pages array**, UNFILTERED (`getByBookIdUnfiltered`), mirrored by
`PrintCoverPage.jsx`'s `Σ chapter.pages` (spine). ⚠ Unfiltered **includes UNFILLED guided pages** — unlike the
share/public view, which filters to *filled* pages. So today a guided book would print blank prompt pages.

### ⭐ Two new page types — ✅ LOCKED (Michael, 2026-07-19)
We GATE at 32 (D2), so we add real arc pages to lift `FIRST_YEAR_ARC` 30 → 32. **Hard constraint: NO new
renderer/component** (Michael) — both must **reuse an existing canvas**; the only code is parameterizing a
hardcoded header/label. All new pages stay **solid-themed / low opacity+soft-mask** (don't reintroduce Part B).

**① About Us — parents page** — **reuses `PeopleCanvas` (`people` template).** PeopleCanvas is already
data-driven from `familyMembers` (in the pipeline) and picks who to show via a `people-config` block
(`selectedMemberIds` + `variant`). So this is a new `guidedBookArc.js` entry seeded with the **parent** member
ids — filled-by-default. The one edit: PeopleCanvas hardcodes its header ("Your People" / "The people who love
you") — parameterize it so this page reads "About Us / Your parents". *(section: Your People.)*

**② The Day You Were Born — time-capsule page** — **reuses `PromptsCanvas` (`prompts` template).** PromptsCanvas
is a labeled fill-in page, but `PROMPT_LABELS` + header are hardcoded to "All About You". The one edit: make
labels + header **config-driven** (sv2-s6 flagged this as deferred, not new work). Then a new arc entry supplies
time-capsule labels — *#1 song · a headline · the weather · what a coffee cost · who was president* — with the
birth **date** shown from `birthdate`. `fill` kind. *(section: The Beginning, after "The Day We Met You".)* The
same edit later unlocks "A Day in Your Life", "When You Grow Up", etc. from `prompts` (backlog).

*Placement:* add both to **First Year** (essential, → 32); offer in **Bump to One** too for parity (already ≥32).

**Backlog (mined from earlier storybook-v2 plans — NOT this session; several need a new component):**
- **Firsts checklist** (prefill from `first_times`) — cut here: needs a NEW renderer (clone of `MilestonesCanvas`)
  + `first_times` added to the render `pageData` pipeline. Good later, violates the no-new-component rule now.
- **Dedication** ("A Note to You") — reuses `letter`; the arc's cut "Closing" beat. Cheap future add.
- **Getting Ready for You / Nursery** — cut from the arc 2026-06-30; good Bump-to-One page (reuse `gallery`/`spotlight`).
- **"More from…" gallery**, **Wishes for You**, **Year Two+ chapter** — research.md (Precious Five spans 5 yrs; we built Yr 1).

### Decisions
- **D1 — ✅ DECIDED: print FILLED pages only** (Michael, 2026-07-19). Empty guided template pages do NOT print;
  matches the share view. Consequence: the two new page types must be **filled-by-default** (auto/prefill) so they
  reliably count, and — because filled-only means a *sparsely-filled* guided book is also short — the D2 gate
  applies to **every** under-filled book, not just scrapbooks. (Revisit why pr2/pr3 chose unfiltered.)
- **D2 — ✅ DECIDED: GATE, no padding** (Michael, 2026-07-19). A book cannot be ordered until it has **≥32
  filled interior pages** of real content; show "Add N more pages to order a printed book." No auto-inserted
  filler. So the way to help users clear the gate is **more real page types they can add** (D3 below), not blanks.
- **D3 — ✅ REFRAMED (was "filler pages" — moot under the gate): content page types users can ADD to reach 32.**
  Since we gate, we want a rich menu of genuinely good pages. See "Candidate new page types" below — sourced from
  earlier storybook-v2 plans (ideas we sketched but cut). Two ship in pr5.5 (to lift the arc 30→32); the rest are
  a backlog that also lets motivated users go well past 32.
- **D4 — Even-count / multiple constraint? (MUST VERIFY)** Perfect-bound POD often needs an **even** interior
  count (or multiple of 2/4). We only tested 30 & 32 (both even). **Test an odd count (e.g. 33) in sandbox** — if
  even is required, the gate rounds the requirement up to even, and enforce on the 800 max too.
- **D5 — Single source of truth.** The count + gate rule lives in ONE backend place (a print-interior assembler /
  extend `LuluPrintService`), so the pr6 estimate, pr8 gate, spine calc, and submit all agree.
  `PrintCoverPage.jsx` spine reads the SAME final count.

### Relationship to pr8 (reconcile)
pr0.5 parked a "not enough content yet" gate + max-800 in **pr8**. pr5.5 now **owns the page-count → 32
mechanism** (count semantics + pad/gate + the new page types); **pr8 becomes the UI surface** (message, "add N
pages" affordance, block). Update pr8 to consume pr5.5's rule, not invent its own.

---

## Part B — Interior PDF rejected on transparency (flatten it)

### The finding
The 32-page submit (job 314960) cleared page count but Lulu REJECTED the interior on normalization: *"Upload
Error… Pages of Different sizes • Fonts need to be embedded • Corrupted Images… can't automatically repair."*
Inspecting the rendered PDF:
- Page sizes — **RULED OUT** (all 32 pages `/MediaBox [0 0 630 810]` = 8.75×11.25in trim+bleed). ✓
- Fonts — **RULED OUT** (6 embedded `FontFile` streams). ✓
- Color — fine (`DeviceRGB`/`DeviceGray`/`ICCBased`, zero CMYK, sRGB).
- **⇒ Transparency — THE CULPRIT.** **157 `/Transparency` groups + 51 `/SMask` soft masks**, producer
  `Skia/PDF` (Chrome `page.pdf()`). Lulu's spec requires **"Flatten transparency"** (`lulu-spec-handoff.md`).
  Chrome doesn't — CSS opacity / masked images / shadows / rounded corners become transparency + soft masks.

### Fix direction (own sub-session)
1. **Ghostscript flatten pass in the pr1 sidecar** after `page.pdf()`: `gs -sDEVICE=pdfwrite
   -dCompatibilityLevel=1.4 -o out.pdf in.pdf` flattens to a print-safe PDF-1.4. Reintroduces a Ghostscript dep
   the color decision had dropped — fine, it's for transparency not CMYK. Add `ghostscript` to the sidecar's
   Debian image (already `node:20-bookworm-slim`); folds into pr10's prod image.
2. Reducing transparency in the **print CSS** alone is fragile (Skia still emits groups) — not sufficient.
3. mutool/qpdf don't flatten transparency; only Ghostscript / a raster fallback do.

⚠ **Preserve vector text + 300PPI images** — don't rasterize whole pages (defeats pr1's whole point). Ghostscript
`pdfwrite` keeps vectors; **re-inspect after flattening** (vector text, image res, embedded fonts) and confirm it
passes Lulu.

---

## How to verify (both parts) — the pr5 tunnel harness
Reuse the pr5 e2e: `cloudflared tunnel --url http://localhost:3001` (standalone exe, no account) + set
`BACKEND_URL=<tunnel>` so `/print/pdf/{token}` is public, then `POST /books/{id}/print/lulu-test` and poll
`.../lulu-test/{jobId}`. **Done = a real book of each type reaches a NON-ERROR Lulu status** (valid page count
AND normalization passes).

## Done when
- [ ] Two new page types added to the First Year arc (30 → 32), **reusing existing renderers, no new component**:
      **About Us — parents** (`PeopleCanvas`, seeded with parents) + **The Day You Were Born** (`PromptsCanvas`,
      time-capsule labels). Only code = making PeopleCanvas header + PromptsCanvas labels/header config-driven.
- [ ] The **32-filled-page GATE** (D2) enforced for every book type (scrapbook / guided / bump-to-baby) from ONE
      backend source of truth (D5); books < 32 filled pages can't be ordered ("add N more"). Max-800 too.
- [ ] Interior + cover PDFs pass Lulu **normalization** (transparency flattened; vector text + image res kept).
- [ ] A 32+page book of each type reaches a **non-error** sandbox status via the tunnel harness.
- [ ] pr8 updated to consume pr5.5's page-count rule; `PrintCoverPage.jsx` spine reads the final count.

## Not this
Shipping level / retail markup (pr6) · checkout (pr7) · order UI (pr8) · pr10 cutover. pr5.5 is strictly "make an
interior + cover PDF Lulu will ACCEPT, for every kind of book."
