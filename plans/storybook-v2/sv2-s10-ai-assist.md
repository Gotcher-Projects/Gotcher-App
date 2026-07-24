# SV2-S10 (AI-ASSIST) — Per-field "✨ write this for me" assist (shared)   *(renumbered 2026-06-27)*

**Status: Complete — superseded by `sv2-s10b` (confirmed by Michael 2026-07-08).** Backend complete +
verified live; the frontend component shipped here wired into one field (First Times notes), and the
remaining field wiring + refactor pass was finished in `sv2-s10b-assist-wiring-and-refactor.md`, which
Michael verified in-app. Nothing in this file is outstanding. *(Was "In Progress (2026-07-07)" —
stale, corrected 2026-07-09.)*
**Gating changed to CREDITS-only, not tier** — see [[project-ai-assist-credit-gating]] (supersedes the
"paid-tier only / free = inert" spec below). `users.tier` is vestigial; nothing reads it.
**Depends on:** at least one consuming page-type field exists (sv2-s1/s2/s3 ship the manual fields).
Best built after the core page types so the shared component has real consumers. NOT a hard blocker for
those sessions — they ship the manual path and this wires in afterward.
**Reference:** `planning.md` §8 (AI as a separate, opt-in, paid feature); `session-prompts.md` cross-cutting note.

---

## Goal

Build **one** reusable AI affordance — a **"✨ write this for me" per-field assist** — plus a **single
backend endpoint** that drafts text for **one field at a time**. Wire the paid-gate, credit spend, and
free-user upsell **once**, then consume it from every text field in the book (letter body, birth note,
person bio, moment-hero note, bump note).

**This is the ONLY AI surface in v2.** It never creates pages, page content, or book structure — it only
helps the user **word a single field they already have** (planning.md §8, "Two different AI things"). The
old batched page-generation (`generatePages()`) is removed separately in `sv2-ai-retrofit`.

---

## Principles (from planning.md §8 — already decided)

- **Garnish, not engine.** Default book is AI-free; this is opt-in, one field at a time. No bulk "fill
  all empty," no whole-book generate.
- **Paid-gated + credit-metered.** Paid tier only; **1 credit per field** (same unit as today's
  per-page charge). Uses the existing `users.tier` + `users.ai_credits_remaining` machinery.
- **Free users: visible-but-inert.** Show the ✨ affordance to free users for discoverability; clicking
  opens an upsell, no generation. So value is visible before Payments lands.

---

## Scope

### 1. Shared frontend component — `AiAssistField`
New file: `Frontend/src/components/storybook/AiAssistField.jsx` (name TBD).

A small affordance attached to an existing text field (textarea / RichTextEditor). Responsibilities:
- Render the **✨ "write this for me"** button next to/inside the field.
- Read auth tier (paid vs free). **Free → inert:** clicking opens the upsell dialog, no call.
- **Paid →** call the assist endpoint with the field's prompt context, show a loading state, then drop
  the result into the field for the user to **accept / edit / discard** (never silently overwrite).
- Surface credit cost ("1 credit") and remaining balance; handle the "out of credits" case.
- Seed/accept pattern: the field already holds the user's own raw text by default — assist *rewords or
  expands* it, it doesn't start from nothing.

Each consuming field passes a small **prompt descriptor**, not free-form prompts from the client:
```js
<AiAssistField
  promptType="letter"            // 'letter' | 'birth_note' | 'bio' | 'first_note' | 'bump_note'
  context={{ babyName, parentName, role, seedText }}  // server builds the actual prompt
  value={value} onChange={setValue}
/>
```
**Security:** the client sends a `promptType` + structured context only. The **server owns the prompt
templates** (don't let the client send arbitrary prompts to Claude). Prompt templates can live alongside
each page type (e.g. `letterTypes.js` `promptTemplate`) but are resolved server-side.

### 2. Backend — single-field assist endpoint
New endpoint (extend `StorybookController` or a small `AiAssistController`):
`POST /storybook/assist-field` — body `{ promptType, context }`, returns `{ text }`.

- **Gate:** reject non-paid tiers with a mapped `ApiError` (mirror the existing
  `ForbiddenException("Upgrade to Plus …")` used by `generatePages`). Catch `Exception` and map (the
  Spring 401-on-RuntimeException trap — see CLAUDE.md / `StorybookService.generatePages`).
- **Credit spend:** debit **1 credit** atomically up-front with the **charge-then-refund-on-failure**
  pattern already proven in `StorybookService.java:174–224` (single `UPDATE … WHERE ai_credits_remaining
  >= ?` for TOCTOU safety; refund on any failure path).
- **Prompt:** resolve `promptType` → server-side template, fill from `context`, call
  `claudeClient` with a **per-field** call (a new small method, or reuse a single-shot variant — NOT
  `generatePagesBatch`).
- Returns the drafted text only; **does not persist** — the field's normal save path stores it (so an
  assisted value is indistinguishable from a typed one downstream).

### 3. Wire into the existing fields
Add `AiAssistField` to each page type's text field built in the manual-first sessions:
- Letter body (sv2-s1) — `promptType: 'letter'`
- Birth note / `birth_story` (sv2-s2) — `promptType: 'birth_note'`
- Person bio (sv2-s3) — `promptType: 'bio'`
- Moment-hero note → `first_times.notes` (sv2-s5/s7) — `promptType: 'first_note'`
- Bump note (sv2-sP) — `promptType: 'bump_note'`

Each is a small change: import the component, pass the descriptor + value/onChange. No new storage.

---

## Files to touch

| File | Change |
|---|---|
| `Frontend/src/components/storybook/AiAssistField.jsx` | New — shared ✨ field affordance + upsell/inert logic |
| `Frontend/src/lib/api.js` | `assistField(promptType, context)` helper |
| `Backend/.../storybook/StorybookController.java` (or new `AiAssistController`) | New `POST /storybook/assist-field` |
| `Backend/.../storybook/StorybookService.java` | Single-field assist + credit debit/refund (reuse §174–224 pattern) |
| `Backend/.../storybook/ClaudeClient.java` | Per-field single-shot call (not batched) |
| `Backend/.../config/SecurityConfig.java` | Allow the new endpoint |
| LetterPage / BirthDay form / People form / moment-hero note / BumpPage | Drop in `AiAssistField` |

---

## Open questions (resolve at session start)

1. **Endpoint home:** extend `StorybookController` or a dedicated `AiAssistController`? (Lean: dedicated,
   since it's cross-feature, not chapter-specific.)
2. **Prompt template location:** co-locate per page type (frontend config, resolved server-side) vs a
   single backend prompt registry keyed by `promptType`. Server must own the final prompt either way.
3. **Accept UX:** replace-in-place with undo, or a "suggestion" panel the user copies from? Replace +
   undo is simplest and matches "seed then edit."
4. **Out-of-credits UX:** same upsell dialog as free users, or a distinct "top up credits" path? (Ties
   to Payments — currently `Not started`.)
5. **Rich text:** the letter uses `RichTextEditor`; others are plain textareas. Confirm `AiAssistField`
   handles both (plain string + Tiptap content).

---

## Dependency / gating note

- **Payments (`plans/storybook-v2/payments/`) is `Not started`.** Until it lands there's **no upgrade path**, so the
  assist ships **visible-but-inert for everyone except already-paid/seeded accounts**. The `tier` +
  `ai_credits_remaining` columns exist, so the gating *code* is real now; only the buy flow is missing.
- This session + `sv2-ai-retrofit` + print + share are the **paid bundle** lit up once Payments ships.

---

## Verification

1. Free user sees the ✨ affordance; clicking opens the upsell, makes **no** Claude call, spends **no** credit.
2. Paid user with credits: ✨ drafts text into the field; **1 credit** debited; result is editable before save.
3. Failed Claude call refunds the credit (balance unchanged).
4. Paid user with 0 credits gets the out-of-credits path, no debit.
5. The same component works on the letter, birth note, bio, first-note, and bump-note fields.
6. An assisted value, once saved, is stored/rendered identically to a typed value.
