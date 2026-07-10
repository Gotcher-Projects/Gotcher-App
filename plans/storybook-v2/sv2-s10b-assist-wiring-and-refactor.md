# SV2-S10b — AI assist: finish field wiring + refactor pass

**Status: Complete (verified by Michael 2026-07-08).** Implemented + confirmed working in-app; builds green, FE 337 tests + BE AiAssistService tests pass.

## As built (2026-07-08)
- **Refactor:** new `Frontend/src/contexts/AiCreditsContext.jsx` (`AiCreditsProvider` + `useAiCredits()`),
  mounted in `App.jsx` wrapping `<CradleHq>`. Removed the `credits`/`onAssistSpend` prop-drilling from
  `CradleHq → MemoriesTab → FirstTimesTab`. `AiAssistField` now reads credits from context.
- **`AiAssistField` rewritten** to the agreed UX: Option A review-before-apply, adaptive label
  (Write → recede to "Polish this"), empty-state hint, your-note-vs-reworded compare, reshape chips (B),
  "Use & edit", AI-recedes (C). New `variant="toolbar"` for the letter (floats the review box below a
  compact toolbar button).
- **Backend** (`AiAssistService`): added `journal` promptType (`{babyName,title,seedText}`) + a
  server-whitelisted `RESHAPE` map (shorter/warmer/more_detail) appended to the user prompt when the
  reshape chips are used.
- **Fields wired** (all `AiAssistField`): first_note (re-pointed), journal add + edit (`MemoriesTab`),
  bio (`FamilyRosterPopup`), birth_note (`ProfileEditModal`), bump_note (`BumpDiary` add form), and
  letter (`FormatToolbar` toolbar ✨ ↔ `ScrapbookBuilder` `letterAssist`; live seedText from the editor,
  applied back via `toTiptapDoc`). Threaded `parentName` through `MemoriesTab → StorybookTab → pageData`
  for the letter prompt.

### Fix (2026-07-08) — refusals were charged + acceptable
Bug: an empty letter body (and occasionally other empty fields) made the model return a refusal ("I can't
write this for a parent without a note"), which (a) still charged a credit and (b) was acceptable via
"Use & edit". Fixes:
- **Server safety net** (`AiAssistService`): after a 200, if the text is empty or matches a conservative
  refusal detector (`looksLikeRefusal`, start-anchored; "i can't wait" deliberately NOT matched), **refund
  the credit** and throw `AssistUnavailableException` → controller maps to **422**; frontend shows the
  message and offers nothing to accept. Tests added (refusal/empty refund + valid-opening pass).
- **Letter requires a seed** (Michael's call): `AiAssistField` gained `requireSeed` (≥ `MIN_SEED_CHARS`=12);
  the letter (`ScrapbookBuilder` letterAssist → `FormatToolbar`) sets it, so ✨ is disabled until the body
  has a line or two ("Jot a line or two first, then ✨ can help"). Other fields still draft from scratch.

_Verify in-app: each field drafts, spends 1 credit (counter drops), review→Use&edit applies, reshape chips
re-draft, out-of-credits inert state, the letter ✨ is disabled until you type a line (and no credit is spent
/ nothing is acceptable if the model ever refuses), and the letter round-trips cleanly in the builder._

_Earlier: In Progress (2026-07-08 — design/decisions)._

## Decisions locked (2026-07-08) — ALL DESIGN DECISIONS FINAL; execution deferred by Michael ("I'll do the execution later, need to run")
- **Refactor first: YES.** Add a `useAiCredits()` context/hook that reads `ai_credits_remaining` off the
  user object and owns spend-sync + the out-of-credits/"get more" hook, killing the CradleHq→tab→editor
  prop-drilling. Re-point the existing First Times field at it (parity, no behavior change) BEFORE wiring
  the rest.
- **Accept UX: Option A — review before apply.** Draft appears in a review box (field untouched until
  accept). NOT the undo-toast option. Accept button copy: **"Use & edit"** (frames output as a starting point).
- **Blended write/generate framing (all three agreed):**
  - **Adaptive label** — ✨ reads "Write this for me" on an empty field, "Polish my note" once there's text
    (the field's current text is the `seedText` seed).
  - **Empty-state hint** — "Write your own, or ✨ let AI help" under blank fields; keep each field's existing
    placeholder (some are already good prompts, e.g. bump note "How are you feeling? What happened this week?").
  - **Review-box compare** — for the polish case, show "Your note" vs "✨ Reworded" side by side.
- **Extra patterns — KEEP B and C, DROP A:**
  - ✅ **B — reshape chips** (Shorter / Warmer / More detail) under a draft → cheap regenerate-with-modifier.
  - ✅ **C — AI recedes once you've written** → ✨ shrinks to a quiet "✨ polish this" link so it never nags.
  - ❌ **A — empty-state "how do you want to start?" split** → NOT wanted.
- **Letter (Tiptap) ✨ placement: IN THE FORMAT TOOLBAR** (`FormatToolbar.jsx`, alongside B/I/align/S-M-L),
  NOT an inline pill. Letter empty state extends to "Tap to write your letter… — or ✨ let AI draft it".
  Round-trip: `contentToPlainText(body)` → seedText out; `toTiptapDoc(result)` → apply back in.
- **Mockup (final, reflects all above):** `plans/storybook-v2/mockups/s10b-ai-assist.html`.
- **Placeholders inventory (real empty-state text per field):** journal `Today was special...`
  (`MemoriesTab.jsx:177`) / journal edit `Story` (`:243`); bump `How are you feeling? What happened this week?`
  (`BumpDiary.jsx:109`); bio `What makes them special…` (`FamilyRosterPopup.jsx:299`); birth note
  `The morning you arrived it was raining, and your dad…` (`ProfileEditModal.jsx:269`); letter
  `Tap to write your letter…` (`LetterCanvas.jsx:161`, Tiptap — not a placeholder attr).

_Prior status: Not started (deferred 2026-07-07 by Michael: "don't want to do this tonight… I also want to
refactor how we do things then")._
**Depends on:** sv2-s10 backend (DONE + verified live) and the First Times wiring (DONE) below.
**Reference:** [[project-ai-assist-credit-gating]], `sv2-s10-ai-assist.md`, `sv2-s11-ai-retrofit.md`.

---

## ‼️ PLAN & DESIGN FIRST — then wire, all in the same session
This session covers **both** the planning/design **and** the wiring — just in that order. Do **not** jump
straight into wiring; start with planning + mockups, lock a design with Michael, then implement the remaining
fields in the same session. As part of the design work Michael wants **UI mockups**: the current
`AiAssistField` affordance (a ✨ pill + inline credit hint, replace-in-place) is **OK but can definitely be
improved**. Sequence:
1. **Plan the approach together** (the refactor items below).
2. **Mock up a few options** for the assist UI (button placement/style, the accept/review/undo flow, the
   out-of-credits / "get more credits" state, and how it reads inside the book builder's rich-text editor).
   Put them in `plans/storybook-v2/mockups/` as standalone HTML, like the other s6/s7 mockups.
3. **Get Michael's pick**, then **wire the remaining fields** to the chosen design (the "What REMAINS" list below).

---

## ⭐ Start here: the REFACTOR the user wants FIRST
Michael wants to **"refactor how we do things"** before wiring the remaining fields. So do NOT just
replicate the First Times pattern blindly — **open the session by discussing the approach**, then wire.
Things to (re)consider:
- **Accept UX.** Today `AiAssistField` **replaces the field in place, no confirm/undo** (Michael said the
  button "works for now" but flagged wanting a refactor). Revisit: review-before-apply? undo? diff view?
- **Component API / credit threading.** Currently `credits` + `onAssistSpend` are hand-threaded
  CradleHq → MemoriesTab → FirstTimesTab. Threading this through 4–5 more editors is repetitive — consider
  a **context/hook** (e.g. `useAiCredits()` reading the user object) so each field just drops in
  `<AiAssistField promptType=… context=…/>` without prop drilling.
- **Where the ✨ lives**, especially inside the book builder (Tiptap) — inline near the field vs. in the
  RichTextEditor toolbar.
- Whether journal + book text reuse existing prompt types or get their own.

---

## What's already DONE (this session, 2026-07-07)
- **Backend s10 — COMPLETE + VERIFIED LIVE** (demo user, credits 813→811 across calls; bad promptType→400):
  - `AiAssistController` `POST /storybook/assist-field`; `AiAssistService` (credit-only gate — NO tier —
    atomic 1-credit charge-then-refund; server-owned prompt registry); `ClaudeClient.generateText`
    (single-shot); DTOs `AssistFieldRequest`/`AssistFieldResponse`; `AiAssistServiceTest`.
  - Prompt registry types: **`letter`, `birth_note`, `bio`, `first_note`, `bump_note`** (no `journal` yet).
  - **Gating is CREDITS-only, not subscription tier** — see [[project-ai-assist-credit-gating]] (future:
    one-time "~20 credits for ~$2" packs).
- **Backend s11 — DONE** (batched AI page-gen decommissioned): removed `generatePages()`, the
  `/generate-pages/{id}` endpoint, `generatePagesBatch()`, 3 DTOs, and all `generated_content` read
  plumbing; also removed the `[CLAUDE-DEBUG]` content logging. Tests updated; compiles + storybook tests green.
  - ⚠️ **Parked column drop:** `Backend/db/manual/drop_generated_content.sql` (NOT in Flyway). Run it only
    after confirming prod has no real `generated_content` (query is in the file).
- **Frontend s11 — DONE:** `ScrapbookBuilder` no longer reads `chapter.generatedContent` (falls back to the
  memory's own raw text).
- **Frontend s10 — component + ONE field:** `Frontend/src/components/storybook/AiAssistField.jsx` built and
  **wired into First Times notes** (`MemoriesTab` → `FirstTimesTab`, `promptType:'first_note'`). Credits
  threaded `CradleHq → MemoriesTab → FirstTimesTab`; spend updates the user via `onUserUpdate`. Frontend builds;
  Michael confirmed it works.

## What REMAINS (this s10b session)
Wire `AiAssistField` into the rest (after the refactor decision above):
- **Person bio** → `FamilyRosterPopup.jsx` — `promptType:'bio'`, context `{name, role, seedText}`.
- **Birth note** → `ProfileEditModal.jsx` (birth-details tab) — `promptType:'birth_note'`, `{babyName, seedText}`.
- **Bump note** → bump diary editor (`BumpDiary`/`BumpCard`) — `promptType:'bump_note'`, `{seedText}`.
- **Letter body** → the book builder's `RichTextEditor` (Tiptap) — `promptType:'letter'`, `{babyName, parentName,
  seedText}`. **The one rich-text case:** convert Tiptap doc → plain `seedText` out, and apply the returned
  plain string back into a Tiptap doc.
- **Journal entries** (Michael asked for these): needs a **NEW backend `journal` promptType** (was added then
  reverted this session — re-add to `AiAssistService` PROMPTS) + wire the `story` field in `JournalTab` add
  (`MemoriesTab.jsx` ~line 177) and edit (~line 241) forms. Context `{babyName, title, seedText}`.
- **Memory book text generally** — decide whether beyond the letter, generic book text blocks in the builder
  get the assist too (Tiptap), and where the affordance sits.

## Verification for s10b
Per-field, in the running app: ✨ drafts into the field, 1 credit spent (counter drops), editable result;
out-of-credits shows the inert state; rich-text (letter) round-trips cleanly.
