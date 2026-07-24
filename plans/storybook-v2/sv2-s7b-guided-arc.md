# SV2-S7b — Guided arc instantiation + fill mechanics

**Status: Complete — confirmed 2026-07-02 (all sub-9 sessions finished). (2026-06-30) — work items A–D all built + unit-tested; full frontend suite
(318) + backend suite (315) green + clean Vite build. Awaiting a live in-app pass.**
> Implementation progress:
> - **A — `guidedBookArc.js`** ✅ FIRST_YEAR_ARC / BUMP_TO_ONE_ARC + `arcFor` + `expandArcToChapterSeeds`
>   + `arcEntryById`; `lib/storybookLayout.emptyBlocksForTemplate` extracted. Tested.
> - **B — instantiation** ✅ `CreateBookRequest.chapters` + `GuidedChapterSeed`; `BookService.create`
>   `@Transactional` bulk-insert (anchor_type='guided', metadata in layout_data, no migration);
>   frontend `handleCreateBook` sends `expandArcToChapterSeeds(arcFor({phase,dueDate}))`. Tested.
> - **C — fill mechanics** ✅ `GuidedBookView` (sectioned locked sequence, progress, prompts) replaces the
>   freeform view for `type='guided'`; `ScrapbookBuilder` gains `locked`/`promptText`/`eyebrow`
>   (hides layout-change/page-mgmt/memory-panel, "Done" instead of Publish); `FirstPicker` + seed-and-edit
>   (`lib/guidedBook.seedMomentHeroFromFirst`, first id tracked on the moment_hero photo block sourceKey);
>   pick degrades to manual when no Firsts. Tested (guidedBook + GuidedBookView).
> - **D — progress** ✅ guided header (`guidedProgress`, dividers excluded) **and** the YourBooksShelf
>   cards: StorybookTab fetches each guided book's chapters when the shelf opens and shows X/Y per card.
> - **Remaining before Complete:** a live in-app pass for both a baby-only (30pp) and a pregnancy (35pp)
>   profile (create → fill → pick → auto/prefill populate → shelf progress → PDF).

**Status (original): Not started — specced 2026-06-28 (S7 split into s7a + s7b).**
**Depends on:** **sv2-s7a** (the `books` container + `type='guided'` row + library/chooser) **and** all
page types (s1–s6.5). This is the last build before the guided book is real.
**Reference:** `sv2-s7-plan-default-book.md` (the LOCKED arc — page-by-page, kinds, divider rule);
`sv2-s7-guided-book-shell.md` (S7 index); mockups `mockups/s6-guided-first-year-book.html`,
`mockups/s6-guided-pregnancy-first-year-book.html`, `mockups/s7-guided-book-in-app.html`.

This session turns a `type='guided'` book (created by s7a's chooser) into the **pre-designed fill-in
book**: it materializes the locked page sequence, lets the user fill it, and enforces the locked structure.
**No new page types** — every renderer already exists (s1–s6.5).

---

## ✅ Decisions locked
- **Model A — materialize on creation.** Creating a guided book writes **one `storybook_chapters` row per
  arc page** (ordered), each carrying its `templateId`, the page's kind, and its prompt/label, with empty
  `layout_data`. The user then fills each page with the existing builder. "Locked" = the builder hides
  add/remove/reorder for `type='guided'` books. (Tradeoff accepted: a later arc change won't reach
  already-created books — fine for v1.)
- **Locked sequence in v1** (no add/remove/reorder); flexibility deferred.
- **Dividers are real, counted pages** (`chapter_divider`), interleaved at section starts. **Locked
  2026-06-30 at 5 dividers (First Year) / 6 dividers (Bump to One)** — see arc plan for placement.
- **Adaptive variant at creation time:** if the profile has pregnancy data, instantiate the **35-page
  "Bump to One"** arc (prepend the 5 pregnancy pages + their divider, **drop the standalone opening
  "A Letter to You"**); otherwise the **30-page "Your First Year"** arc. Chosen once, at creation.
  (Interior totals incl. dividers: First Year 25 content + 5 = 30; Bump 29 content + 6 = 35.)

---

## Work item A — `guidedBookArc.js` (the config)
The two LOCKED arcs from `sv2-s7-plan-default-book.md` as ordered arrays. Entry shape:
```js
{ id, section, templateId, kind: 'auto'|'prefill'|'fill'|'pick', label, prompt }
```
- `templateId` → an existing template (incl. the reuses: photocap→`spotlight`, birthday→`moment_hero`,
  closing→`spotlight`). Divider entries use `chapter_divider` with the section title.
- `kind` drives builder behaviour (below).
- Two exports: `FIRST_YEAR_ARC`, `BUMP_TO_ONE_ARC` (the latter = pregnancy block + first-year-from-p2).
- A selector `arcFor(profile)` → picks the arc by pregnancy data.

### ✅ Build-time decisions (settled 2026-06-30, grounded in the s7a code)
- **Instantiation = extend `POST /books` (NOT a separate `/instantiate-arc`).** The combined create is
  atomic; a separate endpoint opens a window where a guided book exists with zero pages if the 2nd call
  fails, and duplicates ownership/transaction handling.
- **Frontend-authoritative arc.** The arc copy, templates, kinds, and prompt strings already live in JS
  (`guidedBookArc.js` + `storybookTemplates.js`). The frontend calls `arcFor(profile)`, expands the arc
  into chapter seeds, and sends them **with** the book. The backend stays a dumb transactional writer +
  ownership guard (do NOT mirror the arc into Java — drift hazard). Optional cheap guard: validate
  `templateId`s against an allowlist. Trade-off accepted: it's the user's own fully-editable book, so a
  crafted payload crosses no privilege boundary.
- **No new migration.** Guided metadata (`templateId`, `kind`, `prompt`, `label`, `section`) lives **inside
  `layout_data`** at page level (the builder already stores `layout_data = { pages:[{ templateId, blocks,
  … }] }`). Progress calc + locked-builder suppression are frontend concerns reading that JSON. V42's
  `books` table is all the schema we need.
- **Pick = seed-and-edit, not a live binding.** `MomentHeroCanvas` is a fully manual template (badge/
  title/date/photo/note blocks) and the read-only/PDF paths have NO first_times resolver. So picking a
  First **seeds** those blocks (title←name, date←`formatDate(occurred_at)`, note←description, photo←its
  image) and leaves them editable; store the chosen `first_time_id` in the page's `layout_data`. Keeps
  LayoutRenderer/storybookPdf untouched.
- **Pick edge cases:** <4 (or 0) Firsts → the 4 pick pages **always exist** and degrade to a plain manual
  moment_hero (never block/hide; keeps the page count constant). Empty picker copy: *"No Firsts logged yet
  — fill this in by hand, or add one in First Times."* Same First on two pages → allow, with a soft
  "Already featured" hint; no hard block.

## Work item B — Instantiation (Model A)
- On guided-book creation (called from s7a's `NewBookChooser`): the frontend expands `arcFor(profile)` into
  one chapter seed per arc entry — `book_id`, an order index, and `layout_data` carrying `templateId`, the
  kind, the prompt/label/section, and empty blocks — and sends the list **in the `POST /books` body**.
- Backend: extend `CreateBookRequest` with an optional `chapters` list; make `BookService.create`
  `@Transactional` so a `type='guided'` create inserts the book then bulk-inserts the chapter rows in one
  transaction (reuse the `storybook_chapters` insert columns from `duplicate()`). Ownership via
  `requireProfileId`.
- Idempotency: instantiate **once** at creation; re-opening loads the stored rows
  (`GET /storybook?bookId`) — never re-materializes.

## Work item C — Fill mechanics (per kind)
Reuse `ScrapbookBuilder` for each page; behaviour by kind:
- **fill** — drag photos / type text into the template's slots (existing mechanics). The page's **prompt**
  shows as guidance ("Your first bath…").
- **pick** — a designed `moment_hero` page; the user **chooses which First** to feature from a picker
  (lists the baby's `first_times`). Picking **seeds** the moment_hero blocks (see build-time decision
  above) and stores `first_time_id`; everything stays editable. Degrades to a manual moment_hero when no
  Firsts exist. This is the one genuinely new interaction.
- **auto** — renders straight from data (`birth_day`, `family_tree`); read-only, no slots.
- **prefill** — seeded-but-editable (`people`, `milestones` from s6.5); seed-on-display + "Refresh from
  data".
- **Locked sequence:** in the builder, suppress add/remove/reorder controls when the book `type==='guided'`.

## Work item D — Progress indicator
Define "filled": a **fill**/**pick** page counts as done when it has content (≥1 photo or non-empty text /
a chosen First); **auto**/**prefill**/**divider** pages count as done by default. Surface `X / Y` in the
guided view and feed the shelf card progress (the placeholder s7a left).

## Work item E — Per-page prompt/label copy
The guiding strings shown on each page — the "guided" payload. **Tone: warm, addressed to the baby;
US spelling.** Drafted + approved 2026-06-28; refine wording during implementation. Land in
`guidedBookArc.js` as `label` + `prompt` per entry. For **auto/prefill/pick** pages the "prompt" is
helper/status text (those pages have no empty slot to fill).

### "Your First Year"

**▸ The Beginning** *(divider — "How your story started")*
| # | Label | Prompt |
|---|---|---|
| 1 | A Letter to You | "Write a few words to your child — what you felt the day they arrived, what you hope for them." |
| 2 | The Day We Met You | *auto — fills from your saved birth details (date, weight, length, hospital).* |
| 3 | Welcome to the World | "Your first photos together — the very first hours." |
| 4 | Coming Home | "The day you came home — who carried you in, where you slept that first night." |
| 5 | Tiny & New | "How small you were — tiny hands, sleepy faces, those newborn days." |

**▸ Your People** *(divider — "The ones who love you")*
| # | Label | Prompt |
|---|---|---|
| 6 | Your People | *prefill — your family members, seeded from "Your People." Edit or rearrange.* |
| 7 | The Wider Circle | *prefill — the rest of your people. Edit or rearrange.* |
| 8 | Your Family Tree | *auto — drawn from your family members.* |

**▸ Your Firsts** *(divider — "Moments we'll never forget")*
| # | Label | Prompt |
|---|---|---|
| 9–12 | A First We'll Never Forget | *pick — choose a First to feature; add a photo and a few words about it.* |
| 13 | Little Moments | "The small everyday firsts — bath time, giggles, mess and all." |

**▸ Watch You Grow** *(divider — "Season by season")*
| # | Label | Prompt |
|---|---|---|
| 14 | Months 0–3 | "Those first three months — how you changed week to week." |
| 15 | Months 4–6 | "Months four to six — new sounds, new faces, finding your hands." |
| 16 | Months 7–9 | "Months seven to nine — sitting up and getting curious." |
| 17 | Months 10–12 | "Months ten to twelve — almost one, on the move." |
| 18 | How You Grew | *prefill — your tracked milestones. Tidy the wording or add your own.* |

**▸ You at One** *(divider — "Happy first birthday")*
| # | Label | Prompt |
|---|---|---|
| 19 | Out & About | "Your adventures — walks, trips, your favorite places." |
| 20 | All About You | "Your favorites right now — foods, toys, songs, the things that make you, you." |
| 21 | Your Hands & Feet | "Trace or photograph those little hands and feet before they grow." |
| 22 | Happy First Birthday | "Your first birthday — the cake, the candle, that face." |
| 23 | The Party | "The celebration — everyone who came to celebrate you." |
| 24 | One Year of You | "A letter on turning one — how this year felt, what you want to remember." |
| 25 | Your Story Continues… | "A last photo and a few words to close your first year." |

### "Bump to One" — the 5 pregnancy pages (replace page 1)

**▸ Before You Arrived** *(divider — "While we waited for you")*
| # | Label | Prompt |
|---|---|---|
| 1 | A Letter Before You Arrived | "Write to your baby before they're born — what these months have felt like." |
| 2 | The Day We Found Out | "The moment you knew — how you felt, who you told first." |
| 3 | Your First Photo | "Your first scan — the very first picture of you." |
| 4 | The Bump — Early Days | "Early bump photos — the beginning shows." |
| 5 | The Bump — Full Bloom | "The full bloom — those last big weeks." |

*(The old "Getting Ready for You" page was dropped 2026-06-30 to land at 35 interior — its nursery/prep
beat is already covered by "Coming Home.")* Divider placement is now locked (see "Decisions locked");
pages 6–29 are the First-Year arc from "The Day We Met You" onward, including its 5 dividers.

---

## Testing & verification
- **Frontend (`npm run test`):** `guidedBookArc` shape (every entry maps to a real `templateId`; kinds
  valid); `arcFor()` picks the right arc by pregnancy data; "filled" progress calc.
- **Backend (`./gradlew test`):** guided instantiation writes the right ordered rows in one transaction;
  ownership respected.
- **Manual:** create a guided book → locked sequence of designed pages with prompts; fill a `fill` page,
  pick a First on a `pick` page, `auto`/`prefill` pages populate; progress updates; add/remove/reorder are
  absent; PDF export chains the full sequence; pregnancy profile gets the 35-page arc.

## Out of scope
- New page types (all exist). Cover/back-cover rework (deferred). AI (s10/s11). Unlocking the sequence
  (future plan).

## When done
Mark **Needs Verification**; **Complete** only after the user confirms a full guided book instantiates,
fills, locks, and exports correctly for both the first-year and pregnancy profiles.
