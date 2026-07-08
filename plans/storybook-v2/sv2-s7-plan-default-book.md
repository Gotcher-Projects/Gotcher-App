# SV2-S7-PLAN — Design the Default Guided Book   *(was sv2-s6-plan; renumbered 2026-06-27)*

**Status: LOCKED (2026-06-30) — full page-by-page arc + divider placement resolved below. Supersedes the
earlier "the full page lists are the two mockups" punt.** Locked at **5 dividers (First Year) / 6 dividers
(Bump to One)**: First Year = 25 content + 5 dividers = **30 interior**; Bump to One = 29 content + 6
dividers = **35 interior**.
**Runs before:** `sv2-s6.5` (builds the missing/prefill page types) → `sv2-s7-guided-book-shell.md`
(wires the arc config + locked sequence). **S7 itself adds NO new page types — pure wiring.**
**Reference:** `planning.md` 2026-06-27 direction update; mockups `mockups/s6-guided-first-year-book.html`
+ `mockups/s6-guided-pregnancy-first-year-book.html`.

---

## ✅ Decisions locked (2026-06-27)

- **Model = pre-designed fill-in book** (not auto-derived). Fixed, **locked** page sequence (no
  add/remove/reorder in v1); the user **drags photos / types text** into designed slots (reusing
  ScrapbookBuilder fill mechanics). Page kinds: **auto** (locked, renders straight from data),
  **prefill** (seeded from data but editable in the builder — *new kind, decided 2026-06-28*),
  **fill** (empty designed page), **pick** (user chooses which First for a moment-hero slot).
  Per-page prompts make it "guided."
- **Two adaptive default books:**
  - **"Your First Year" = 25 content + 5 dividers = 30 interior pages** (birth → 1st birthday) — the baseline.
  - **"Bump to One" = 29 content + 6 dividers = 35 interior pages** — adds a 5-page pregnancy chapter
    front-inserted **and drops the standalone opening "A Letter to You"** (replaced by "A Letter Before
    You Arrived"): 25 − 1 + 5 = 29 content. Used automatically when the profile has pregnancy data.
  - Cover + back cover wrap *around* the interior count. Counts **locked at 30 / 35 interior**.
- **Firsts = 4 user-picked moment-hero pages** (no auto Firsts chapter; old moment-hero/firsts plans dropped).
- **Growth = quarterly spreads** (Months 0–3 / 3–6 / 6–9 / 9–12) — *not* one cramped 12-photo grid.
- **Size comparison = a small AUTO tag on bump photos** ("how big were you here"), not its own page.
- **Family tree is in the default book** (People section) → built in `sv2-s5`.
- **Guided book is the default/recommended mode** (small "Recommended" badge in the chooser); the
  freeform scrapbook coexists as the advanced option.

### Auto / prefill split (decided 2026-06-28)
The locked-auto set is intentionally small — only **computed or precision-aligned** pages stay
locked. Everything data-backed but layout-flexible becomes **prefill** (seeded, editable):
- **AUTO (locked):** Birth Stats (`birth_day` — aligned numeric stats card), Family Tree
  (`family_tree` — a computed visualization with no meaningful editable form).
- **PREFILL (seeded + editable):** Your People & The Wider Circle (`people`), How You Grew
  (`milestones`). Built in **sv2-s6.5**; each gets a "refresh from data" affordance (the tradeoff of
  editability is drift from the source table).
- **Cover / Back cover** = *configured* (title/theme/photo), outside the fill model. A future rework of
  the cover/back-cover mechanism is anticipated but **explicitly deferred** — not part of S7.

---

## 🔒 LOCKED ARC — "Your First Year" (25 content + 5 dividers = 30 interior pages)

5 dividers (down from 7, locked 2026-06-30): the old single-page **"Closing"** is folded into **"You at
One,"** and **"How You Grew"** (milestones) moves into the growth section so the data summary sits with
the growth spreads.

| # | Section / Page | Template | Kind | Build status |
|---|---|---|---|---|
| — | Front Cover | cover | configured | exists (rework deferred) |
| ▸ | **The Beginning** — "How your story started" | `chapter_divider` | divider | ✅ exists |
| 1 | A Letter to You | `letter` | fill | ✅ exists |
| 2 | The Day We Met You | `birth_day` | **auto** | ✅ exists |
| 3 | Welcome to the World | `gallery` | fill | ✅ exists |
| 4 | Coming Home | `spotlight` (Photo + caption) | fill | ✅ reuse |
| 5 | Tiny & New | `spotlight` (Photo + caption) | fill | ✅ reuse |
| ▸ | **Your People** — "The ones who love you" | `chapter_divider` | divider | ✅ exists |
| 6 | Your People | `people` | **prefill** | ✅ s6.5 |
| 7 | The Wider Circle | `people` | **prefill** | ✅ s6.5 |
| 8 | Your Family Tree | `family_tree` | **auto** | ✅ exists |
| ▸ | **Your Firsts** — "Moments we'll never forget" | `chapter_divider` | divider | ✅ exists |
| 9–12 | A First We'll Never Forget ×4 | `moment_hero` | **pick** | ✅ exists |
| 13 | Little Moments | `gallery` | fill | ✅ exists |
| ▸ | **Watch You Grow** — "Season by season" | `chapter_divider` | divider | ✅ exists |
| 14 | Months 0–3 | `growth-spread` | fill | ✅ exists |
| 15 | Months 4–6 | `story-snapshot` | fill | ✅ exists |
| 16 | Months 7–9 | `staggered` | fill | ✅ exists |
| 17 | Months 10–12 | `photo-first` | fill | ✅ exists |
| 18 | How You Grew | `milestones` | **prefill** | ✅ s6.5 |
| ▸ | **You at One** — "Happy first birthday" | `chapter_divider` | divider | ✅ exists |
| 19 | Out & About | `gallery` | fill | ✅ exists |
| 20 | All About You | `prompts` | fill | ✅ exists |
| 21 | Your Hands & Feet | `hands-feet` | fill | ✅ exists |
| 22 | Happy First Birthday | `moment_hero` | fill | ✅ reuse (badge blank) |
| 23 | The Party | `gallery` | fill | ✅ exists |
| 24 | One Year of You | `letter` | fill | ✅ exists |
| 25 | Your Story Continues… | `spotlight` (Photo + caption) | fill | ✅ reuse (final photo + note) |
| — | Back Cover | back | configured | exists (rework deferred) |

## 🔒 LOCKED ARC — "Bump to One" (29 content + 6 dividers = 35 interior pages)

Front-inserts the pregnancy chapter (its own divider) **and replaces** the opening "A Letter to You" with
"A Letter Before You Arrived." Content pages 6–29 are the First-Year arc above from "The Day We Met You"
onward, unchanged — including its 5 dividers. The old **"Getting Ready for You"** page was dropped
(2026-06-30) to land at 35 interior; its nursery/first-night beat is already covered by "Coming Home."

| # | Section / Page | Template | Kind | Build status |
|---|---|---|---|---|
| — | Front Cover | cover | configured | exists |
| ▸ | **Before You Arrived** — "While we waited for you" | `chapter_divider` | divider | ✅ exists |
| 1 | A Letter Before You Arrived | `letter` | fill | ✅ exists |
| 2 | The Day We Found Out | `spotlight` (Photo + caption) | fill | ✅ reuse |
| 3 | Your First Photo (ultrasound) | `spotlight` (Photo + caption) | fill | ✅ reuse |
| 4 | The Bump — Early Days | `bump` | fill | ✅ exists |
| 5 | The Bump — Full Bloom | `bump` | fill | ✅ exists |
| 6–29 | First-Year arc from "The Day We Met You" → "Your Story Continues…" (incl. its 5 dividers) | — | — | as above |

> The 5 pregnancy pages are **built in sv2-s8**, but the arc that *places* them is this config. With the
> reuse decisions above, s8 adds **no new renderers** — only the pregnancy-specific prompts/labels and the
> bump size auto-tag (already shipped data layer).

---

## 🔨 BUILD BEFORE S7 — sv2-s6.5 (so S7 is pure wiring)

With the 2026-06-28 reuse decisions, the pre-S7 build collapsed to a small, well-bounded set:

1. **Prefill page kind** — a render mode that seeds a page from a structured table but leaves it
   editable in the builder, plus a **"refresh from data"** affordance. Wire it for **People** and
   **Milestones**.
2. **`milestones` renderer** ("How You Grew") — the **only genuinely new renderer**. Prefilled from the
   `milestones` table (name + date rows, like the mockup's checklist). *Evaluate reusing the `prompts`
   renderer (vertical labeled list) vs a thin dedicated variant during s6.5.*
3. **Verify the reuses at book scale** (no new code, arc-config mappings only): `spotlight` (Photo + caption) as
   photocap/closing, `moment_hero` (badge blank) as the birthday page. Confirm they look right inside
   the locked book before S7 wires them.

**Everything else the arc references already exists** (`letter`, `birth_day`, `gallery`, `people`,
`family_tree`, `moment_hero`, `growth-spread`, `hands-feet`, `prompts`, `bump`, `chapter_divider`).

## S7 SCOPE (after s6.5) — wiring only

`guidedBookArc.js` (the two tables above as ordered config: template + kind + per-page prompt/label) →
instantiate + lock the sequence → reuse ScrapbookBuilder fill mechanics → Guided⇄Freeform toggle →
book library/switcher (`books` table) → remove the AI "Write a Period Chapter" card. **No new page types.**

### Chapter dividers — LOCKED (2026-06-30): real pages, counted, placement fixed
Section headers become real `chapter_divider` pages (template shipped in s6), interleaved at the **start
of each section**, and they **count toward the interior total**. Divider count is now **locked**:
**First Year = 5** (The Beginning · Your People · Your Firsts · Watch You Grow · You at One) and
**Bump to One = 6** (the above + **Before You Arrived** for the pregnancy chapter). Reconciled totals:
First Year **25 content + 5 dividers = 30 interior**; Bump **29 content + 6 dividers = 35 interior**.
Re-check against Lulu's page rules at print time (sv2-s12).

### Still TODO for a fully buildable S7 (not a blocker for locking the arc)
- **Per-page prompt/label copy** — author the actual guiding strings for all content + divider pages (the
  "guided" payload). Draft alongside the `guidedBookArc.js` config in S7.

---

*(The original 2026-06-22 design-pass draft — candidate ~9-page arc + open questions — was trimmed
2026-06-27; the "page lists = the mockups" punt was replaced 2026-06-28 by the locked tables above.
Both are in git history if ever needed.)*
