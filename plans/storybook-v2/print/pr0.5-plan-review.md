# Print pr0.5 — Plan review / gap audit

**Status:** ✅ **Complete** — audit completed 2026-07-16; all 11 gaps resolved/assigned/deferred (see
Resolution log at the bottom). Every HIGH item has an owning file; `sv2-s14` stub created.
**Est:** ~1–1.5 hours (review + decisions; may spawn small plan files) · **Depends on:** pr0 · **Blocks:** nothing hard,
but best done before pr1 build starts
**Launch prompt:** `session-prompts.md` → pr0.5
**Analogue:** payments had a P0.5 setup/checklist pass; this is print's equivalent gap audit.

Before building, walk the whole print track (pr1–pr10 + `print-full-plan.md` + `lulu-spec-handoff.md`) and
resolve or assign each gap below. Adding **pr10** (live cutover) already came out of this kind of pass — this
session formalizes it so nothing else slips.

---

## Candidate gaps found on the 2026-07-16 read (resolve or explicitly defer each)

### HIGH — structural, no session currently owns them
1. **How does Lulu actually receive the PDF?** Lulu's Print API fetches interior/cover from a **public
   `source_url`** — it does not take a binary upload in the create-job call. pr3/pr4 *produce* PDFs; pr5 leaves
   delivery as "URL it fetches, or upload, per current API." **We need a temporary public host** for generated
   PDFs (Cloudinary raw? a signed backend endpoint? S3?). Plus **privacy**: these are baby-photo PDFs at a
   fetchable URL — needs unguessable path + short TTL. Spans pr3/pr5; owned by neither. **Decide the host.**
2. **Sales tax on a PHYSICAL good.** Payments' tax work was digital-goods + a Radar US-only rule. Physical books
   shipped to addresses trigger **destination-based sales-tax / economic-nexus** obligations that differ from
   digital. Nothing in print covers this. Owner/tax item, analogous to `../handoffs/tax-note-for-owner.md` but
   NOT covered by it. **Flag to owner; decide Stripe Tax vs manual.**
3. **`sv2-s14` hardening has no plan file.** pr5/pr7/pr9 all defer refunds, order cancellation, and print-job
   rejection recovery to `sv2-s14` — which doesn't exist yet. That's the whole failure-path surface with no
   home. **Slice it into its own sessions.**

### MEDIUM — under-specified within/across sessions
4. **Async render timing.** A full-book Chrome render may take many seconds; pr7's Stripe **webhook must return
   fast** and can't block on it. Decide **when** the PDF is generated (pre-checkout vs post-webhook async job)
   — affects pr3, pr7, pr8 loading states. pr3 flags it open; make the call.
5. **Order data model + history.** No `print_orders` table is specified (needed for confirmation, support,
   refunds, webhook-retry dedup, and a user "my orders" view). pr7 says "extend the ledger or add a table as
   fits" — left open. Decide the schema; decide if an order-history UI is in scope.
6. **Shipping level.** Lulu offers multiple levels (MAIL / GROUND / EXPEDITED / EXPRESS) at different
   cost+speed. pr6 says "shipping" singular. Does the user choose, or do we pick one? Affects estimate,
   checkout, and the delivery promise.
7. **International vs US-only.** Payments went US-only (Radar rule, tax). Does print ship internationally? If
   US-only, pr8's address form must enforce it; if global, tax/customs/shipping complexity grows. **Explicit
   decision needed.**

### LOW — note and move on
8. **PDF preview before a $30–45 purchase** — users may expect to preview the book pre-order (they already have
   the in-app view + digital export). In scope for pr8, or not?
9. **Max page count (800)** — pr8 gates on *min* only; a >800-page book would be Lulu-rejected.
10. **Estimate vs actual reconciliation** — if Lulu's charge diverges from our quoted estimate at submit time,
    the Stripe amount is already fixed. Edge case; note the tolerance.
11. **Back-cover / spine-text content** — pr4 reuses the `storybookPdf.js` front-cover DOM; back cover + spine
    text source are unaddressed.

## Method
For each item: **resolve now** (record the decision in the relevant pr file), **assign to an existing session**
(add it to that pr's scope), or **defer with a reason**. Anything needing its own work (e.g. `sv2-s14`) gets a
plan file. Update `session-prompts.md` if the run order changes.

## Done when
- [x] Every HIGH item is resolved or has an owning session/plan file.
- [x] MEDIUM items are each decided or explicitly deferred with a note in the right pr file.
- [x] `sv2-s14` exists as at least a sliced stub → `../sv2-s14-print-hardening.md`.
- [x] Owner-facing items (sales tax, PDF-host privacy) are written where the owner will see them.

---

## Resolution log (2026-07-16)

**Business calls confirmed with owner this session:** US-only shipping · fixed **GROUND** level · **pre-checkout**
PDF render (render+validate before charging).

| # | Sev | Resolution | Recorded in |
|---|-----|-----------|-------------|
| 1 | HIGH | **PDF host = signed backend endpoint** at an unguessable token path, no auth (Lulu fetches server-side), short TTL. Not Cloudinary/S3. | pr3 (mints+persists), pr5 (passes `source_url`) |
| 2 | HIGH | **Physical-goods sales tax → owner.** US destination-based, separate from digital. Not a build blocker; gate before first live charge. | `handoffs/tax-note-for-owner.md` (new section), pr10 |
| 3 | HIGH | **`sv2-s14` created** as a sliced stub (s14a rejection→refund, s14b cancel, s14c order-history UI, s14d reconciliation/reserve). | `../sv2-s14-print-hardening.md` |
| 4 | MED | **Pre-checkout render** — PDFs made at order-placement (pr8 loading state), before charge; webhook only submits to Lulu (stays fast). | pr3, pr7, pr8 |
| 5 | MED | **New `print_orders` table** (address, qty, cost, PDF token+TTL, Lulu job id, status), not the credit ledger. Order-history UI = s14c, not v1. | pr7 |
| 6 | MED | **Fixed GROUND shipping**, no selector. | pr6, pr8 |
| 7 | MED | **US-only** — pr8 enforces US address; matches payments. | pr6, pr8, tax note |
| 8 | LOW | **No pre-purchase PDF preview** for v1 (in-app view + digital export already exist). Note only. | pr8 |
| 9 | LOW | **Max-page gate (800)** added alongside the min-page (32) gate. | pr8 |
| 10 | LOW | **Absorb** small estimate/actual divergence; tolerance+reserve in s14d. Low risk (page count known pre-charge). | pr6, pr7, s14d |
| 11 | LOW | **Back cover** = simple branded/solid (no editor); **spine text** = book title above Lulu threshold. | pr4 |

**Run order unchanged** — no session added/reordered; `sv2-s14` was already referenced by pr5/pr9/pr10, this
session just gave it a file. `session-prompts.md` needs no reslice.
