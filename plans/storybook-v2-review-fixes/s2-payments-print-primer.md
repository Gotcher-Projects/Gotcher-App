# s2 — Payments/print architecture primer (F11)

**Status:** ✅ **Done 2026-07-22.** Primer written at `plans/storybook-v2/payments-print-context.md` (combined
payments + print). `CLAUDE.md` updated: pdf-sidecar added to Stack, both tracks + the primer added to Pointers.
**F10's start-path fix was done here too** (`CLAUDE.md` now says `./start-services.sh` from the repo root + the
port-3001 stop fallback) — so **s7 can skip the F10 item**. Not verified by the user yet.
· **Tier:** 1 (sooner) · **When:** now, while it's in working memory · **Independent:** yes
**Finding:** `plans/storybook-v2-review/findings.md` → **F11** (also touches F10's CLAUDE.md edit — see note)

Two of the largest subsystems on this branch have **no entry-point doc**. `CLAUDE.md`'s stack section never
mentions Stripe, Lulu, or the headless-Chrome PDF sidecar — which is a *fourth runtime process* (port 4000)
the print feature can't work without. The print track alone is 11 plan files plus s14; payments is P1–P12.
A cold session landing on a print bug has to reverse-engineer the runtime from eleven plan files.

Precedent to match: `plans/storybook/storybook-context.md` (the "read before working here" primer).

## The change
1. **Write `plans/storybook-v2/print/print-context.md`** (or a combined `payments-print-context.md`), shaped
   like `storybook-context.md`. Cover:
   - The end-to-end print runtime path: backend → `PrintSidecarClient` → sidecar (Chrome) loads
     `/print/book/{token}` → `PrintPdfStore` (token'd bytes) → Lulu fetches `source_url` server-side.
   - The **kill switch** (`app.print.enabled`, default OFF; `LuluClient` hard-refuses paid submits when off).
   - The **token types**: render JWT (`purpose=print-render`) vs opaque PDF token vs share token.
   - **Where money is decided**: `PrintController.checkout` → `PrintOrderService.createCheckout`
     (server-side recompute, per-order Stripe idempotency key) → webhook → atomic `pending→paid` claim.
   - The **two status feeds** through `LuluJobStatusMapper` (signed webhook + `reconcile()` sweep).
   - The **ops scripts**: `lulu-webhooks.sh`, `lulu-verify.sh`, `lulu-pr5-verify.sh`, `stripe-listen.sh`,
     `run-migrations.sh` (none is mentioned in CLAUDE.md today).
2. **Update `CLAUDE.md`:** add the pdf-sidecar (port 4000) to the Stack list; add the payments and print tracks
   to the Pointers section.

> **Overlap with F10 (s7):** s7 fixes `CLAUDE.md`'s wrong `start-services.sh` path. Since this session already
> edits `CLAUDE.md`, if s7 hasn't run yet, fix that line here too (`./start-services.sh` from the repo **root**,
> not `cd Backend`) and note it in s7 as done.

## Done when
- [ ] Primer exists and walks the full print runtime + payments money path.
- [ ] `CLAUDE.md` names the sidecar and both tracks.

## Not this session
Rewriting the plan files · `deployment-guide.html` (that's F12/s7) · writing any code.
