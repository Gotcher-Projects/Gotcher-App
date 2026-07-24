# SV2-S11 (AI-RETROFIT) — Decommission the old batched AI page-generation   *(renumbered 2026-06-27)*

**Status: Complete (confirmed by Michael 2026-07-08).** — batched AI page-gen fully removed (backend + frontend), tests
updated, `compileJava`/`compileTestJava` + storybook tests green, and the assist endpoint verified live so the
scrapbook is not left AI-less. ⚠️ The physical `generated_content` DROP is PARKED at
`Backend/db/manual/drop_generated_content.sql` (non-Flyway) — run only after confirming prod has no real data.
Confirm scrapbook build/PDF still work in-app to flip to Complete.
**Depends on:** `sv2-s10` (AI assist) shipped first (so the only AI left — per-field assist — exists before the
old bulk path is removed; avoids a window where the scrapbook has no AI at all). Otherwise self-contained.
**Reference:** `planning.md` §8 ("Two different AI things — only one survives"); review-fixes s3 (page-gen IDOR history).

> **Note (2026-06-27):** the **UI entry point** — the "Write a Period Chapter" AI card in the Storybook tab — is
> **already removed in sv2-s7** (the card is unmounted so the tab has no AI surface). This session is the deeper
> cleanup: deleting the now-orphaned wizard generate-first flow + the backend `generatePages()` / credit code.
> If s7 shipped first, the generate flow may already be unreachable from the UI — verify before deleting.

---

## ⚠️ This touches live, credit-charging code

The batched page-generation is **shipped and charging real users credits today**
(`StorybookService.generatePages()`, `StorybookService.java:174–224` debit/refund). This is a deliberate
**behavior change**, not a feature add. Treat it as its own careful session: unwind the credit logic
cleanly, keep the IDOR ownership checks (review-fixes s3) intact while removing the code around them, and
verify the scrapbook still works end-to-end with **manual** page building.

---

## Goal

**Delete the old "AI builds your book" path entirely** — it's the relic of v1 storybook we're moving away
from (planning.md §8). After this session:
- Scrapbook **pages are made manually**; page **text defaults to manual** (the user's own words).
- The **only** AI in the product is the new per-field assist from `sv2-ai-assist` — a *new* component,
  **not** the old code repurposed.
- No "generate my chapter/book" anywhere. No hidden bulk "fill all empty" power-user path.

---

## What gets removed

### Backend
- `StorybookService.generatePages()` (the batched method, ~line 131–224) including its **up-front credit
  debit + charge-then-refund-on-failure** block (174–224).
- `StorybookController` `POST /storybook/generate-pages/{id}` (line ~69–76).
- `ClaudeClient.generatePagesBatch()` (line ~63) — **unless** `sv2-ai-assist` reuses a shared low-level
  call; if so, keep only the generic single-shot call and delete the batch-specific wrapper.
- Related DTOs that only served batch generation (`GenerateGroupsRequest`, `GeneratedPageResponse`,
  per-page generated-content plumbing) — audit each; some may still back **already-stored**
  `generated_content` reads (see data note).

### Frontend (`StorybookWizard.jsx` + callers)
- The **"Generate first"** flow: `runGenerateFirst()`, `onWizardGenerate`, `onGeneratePages`, the
  generate step (step 6 / `generatedChapter`), and the "Upgrade to Plus to generate chapters" gating
  around it.
- The wizard becomes: create chapter → open the builder with an **empty layout** for manual placement.
  Both old paths (Quick Build "seed" + Scrapbook) collapse to the manual builder.
- Remove generate-related props threaded through `StorybookTab.jsx` → wizard.

---

## What stays

- The builder, `LayoutRenderer`, `Slot`, `MemoryPanel`, `PhotoTray`, themes, PDF export — all unchanged.
- `users.tier` + `users.ai_credits_remaining` columns — **kept**; they're now the metering mechanism for
  `sv2-ai-assist`, not page-gen.
- The IDOR ownership checks from review-fixes s3 — **kept** wherever chapter access remains.

---

## Data — CLEAN BREAK (revised 2026-06-28), no books to preserve

**s7 clears the dev `storybook_chapters` data (pre-prod, single dev book — see `sv2-s7-guided-book-shell.md`
"Existing books — CLEAN BREAK").** So there are **no existing books whose text must survive**, which makes
this session simpler than originally planned:

- **Fully delete the `generated_content` plumbing** — the column *and* its read DTOs — not just the
  write/generate path. No read-only zombie path to preserve (the old caveat is gone).
- Add a migration to **drop the `generated_content` column** if nothing else reads it (audit first).
- The seed/demo book is **re-created fresh** by the updated seed script against the new manual model.
- ⚠️ **Re-validate before deleting:** this only holds while the dev account is the only book. If anything
  shipped to real users between now and s11, fall back to preserving a read path instead.

---

## Files to touch

| File | Change |
|---|---|
| `Backend/.../storybook/StorybookService.java` | Delete `generatePages()` + its credit debit/refund; keep `generated_content` **read** path |
| `Backend/.../storybook/StorybookController.java` | Delete `POST /storybook/generate-pages/{id}` |
| `Backend/.../storybook/ClaudeClient.java` | Delete `generatePagesBatch()` (or reduce to the shared single-shot call) |
| `Backend/.../storybook/dto/` | Remove batch-only DTOs (audit `generated_content` reads first) |
| `Frontend/src/components/storybook/StorybookWizard.jsx` | Remove generate-first flow; manual builder only |
| `Frontend/src/components/tabs/StorybookTab.jsx` | Remove generate props/handlers (`onWizardGenerate`, `onGeneratePages`) |
| `Frontend/src/lib/api.js` | Remove generate-pages API helpers |
| Backend tests | Remove/adjust generatePages tests |

---

## Open questions (resolve at session start)

1. **Order vs `sv2-ai-assist`:** confirm assist ships first. If this runs first, the scrapbook is briefly
   fully AI-free — acceptable? (Recommended: assist first.)
2. ~~**`generated_content` reads:** keep the column + read DTOs, or drop?~~ **RESOLVED 2026-06-28 — clean
   break:** s7 clears the dev data, so fully delete the column + read DTOs (see "Data — CLEAN BREAK").
3. **`ClaudeClient`:** does `sv2-ai-assist` reuse a shared low-level call? If yes, refactor rather than
   delete the HTTP plumbing.
4. **Quick Build path:** the wizard's "Quick Build (seed)" auto-arranged generated content into pages.
   With generation gone, does Quick Build disappear entirely, or become a "starter layout" with empty
   slots? Decide the wizard's post-retrofit shape.

---

## Verification

1. No "generate" UI anywhere in the scrapbook/wizard; creating a chapter opens an empty manual builder.
2. `POST /storybook/generate-pages/{id}` no longer exists (404/410); no client calls it.
3. **No credits are ever debited** by the scrapbook path (only `sv2-ai-assist` spends credits now).
4. **Existing seeded/demo books still render** their previously generated text (read path intact).
5. Manual page building, layout save, theme switching, and PDF export all still work.
6. Backend tests pass; removed-feature tests cleaned up.
