# Print pr7 — Variable-amount Stripe checkout + shipping address

**Status:** Not started — **scope locked with Michael 2026-07-19** (see "Decisions locked" below).
**Est:** ~2–3 hours (spill-prone — **split into two commits, below**) · **Depends on:** Payments P1–P3, pr5, pr6 (both DONE + Lulu-verified) · **Blocks:** pr8, pr9
**Launch prompt:** `session-prompts.md` → pr7
**Read first:** `../payments/p2-checkout-endpoint.md`, `../payments/p3-webhook-idempotency.md`, `com.gotcherapp.api.billing.BillingService` (the reuse model)

Print needs its **own** Stripe checkout — **variable amount** (copies × per-copy price) with a **shipping
address**. The fixed-price digital SKUs (credit packs / share unlock) hand it nothing reusable except the
patterns (`Session.create` shape, webhook idempotency, `ensureCustomer`, the IDOR check).

---

## Decisions locked (2026-07-19, with Michael)

- **① Shipping address = collected by Stripe Checkout** (`shipping_address_collection`, **US-only**), NOT a
  pre-checkout form. ⭐ **Why this got simpler:** pr6's price is now a **flat, all-in (MAIL) table** keyed on
  page count — so the amount is **address-independent**. The address is only needed for the Lulu *submit*
  (where to ship), so we let Stripe collect it and read `session.shipping_details` in the webhook. This
  **supersedes** the pr0.5 "address needed for pricing" assumption below.
- **② pr7 is SELF-CONTAINED + testable.** Its session-create endpoint does the whole pre-checkout flow:
  gate → recompute price (server-side) → render + persist interior/cover PDFs (pr3/pr4) → insert
  `print_orders` row (`pending`) → open the Stripe session. The webhook finishes it. **pr8 later just wraps a
  UI** around this endpoint (and consumes pr5.5 `orderability` + pr6 `price`); pr7 does not depend on pr8.
- **③ Land in TWO commits** (spill control): **(a) checkout** = session-create + `print_orders` + variable
  amount + amount-recompute + kill-switch + Stripe address collection; **(b) webhook → Lulu submit** =
  idempotent fulfilment. Each verifiable on its own.
- **Amount shape:** inline `price_data` (no pre-created Stripe Price), `unit_amount` = pr6 **per-copy** price
  cents (`PrintPricingService.unitPriceCents`), `quantity` = copies — so `unit × qty` = pr6 total and the
  receipt reads "N × $X".
- **Verify end-to-end** with a `4242` test-card run + local webhook (same as Payments P3), against the Lulu
  **sandbox** submit (kill switch on). Reuse today's tunnel method so the paid webhook's Lulu fetch is public.

---

## What you're building

A second `mode: 'payment'` checkout flow. **Commit (a) — checkout:** the session-create endpoint (self-contained, ②):
0. **Gate** on `app.print.enabled` (refuse first if off — no session, no charge).
1. **Re-check orderability + recompute amount** server-side from `bookId` + `qty` via `PrintInteriorService.orderability`
   (≥32, ≤ type max) + `PrintPricingService` — **never trust a client-sent amount** (it could be tampered). This
   is the security-critical bit (the variable-amount analogue of P2's IDOR check).
2. **Render + persist** the interior (pr3) + cover (pr4) PDFs behind their signed token URLs (pr0.5 pre-checkout
   render) and insert a `print_orders` row in `pending` holding qty, amount, the PDF tokens + TTL, and the
   Stripe session id.
3. **Open the session** — inline `price_data` (`unit_amount` = per-copy cents, `quantity` = copies),
   `shipping_address_collection` restricted to **US** (①), `client_reference_id` = userId,
   metadata `{ type: 'print_order', printOrderId }` so the webhook routes it. Return the hosted URL.

**Commit (b) — webhook → Lulu submit:** on `checkout.session.completed` where `metadata.type == 'print_order'`
(idempotent on `event_id`, same discipline as P3): flip the `print_orders` row to `paid`, read
`session.shipping_details` for the address (①), submit the **paid Lulu job** (`LuluClient.createPrintJob`,
`external_id` = `print_orders.id` for Lulu-side dedup) with the already-rendered interior/cover + qty + address,
store `lulu_job_id`, flip to `submitted`. The webhook **never renders** (PDFs already exist) → returns fast.
The credit/share branch of the existing webhook is untouched — this is a new `type` branch.

## Decisions from pr0.5 (2026-07-16)
- **Order data model = new `print_orders` table (gap #5), NOT the credit ledger.** A print order carries data
  the digital ledger has no shape for: shipping address, quantity, per-copy + shipping cost, the persisted
  interior/cover **PDF token + TTL** (from pr3), the Lulu job id, and an order **status**
  (`pending → paid → submitted → shipped / failed`). Add the table here. It's the backbone for confirmation
  (pr9), the failure/refund paths (`../sv2-s14-print-hardening.md`), webhook-retry dedup, and a later "my
  orders" view. **Order-history UI is out of scope for pr7/v1** — pr9 shows a single confirmation; the
  persistent list is **s14c**.
- **Flow is pre-checkout render (gap #4):** the PDFs are rendered + persisted and the `print_orders` row created
  in `pending` **at session-create (owned by pr7 now, ② — not pr8)**; the Stripe session charges the pr6 total;
  the **signed webhook** flips the row to `paid` and submits the Lulu job (idempotent on `event_id`). The webhook
  never renders. **pr8 later** just calls this same endpoint from a UI + shows the pr5.5 gate / pr6 price first.

## Kill switch — `app.print.enabled` (gate the money path)
The feature flag is defined in **pr5**. pr7 adds the **checkout-entry gate**: when `app.print.enabled=false`,
**refuse to create the Stripe session** (return a handled error) so no customer is ever charged for a print
order while print is off. Belt-and-suspenders with pr5's Lulu-client backstop and pr8's hidden UI: no charge
here, and even if a charge slipped through, the webhook's Lulu submit still refuses at the pr5 client.
- Guard the checkout-session-create endpoint on the flag (the first thing it checks).
- The webhook handler inherits the pr5 backstop automatically (its Lulu submit refuses when off) — but a book
  that was paid-for **before** the flag flipped needs a decision: leave the `print_orders` row `paid` and let
  s14a's refund/retry path own it. Don't silently drop a paid order. Note it, don't build recovery here.

## ⚠️ Notes
- **Reuse, don't duplicate blindly** — the webhook/ledger/idempotency machinery from Payments P3 is the model.
  A print order is a distinct fulfilment (submit a Lulu job) but the *shape* (signed webhook → idempotent
  action) is identical. **Use a dedicated `print_orders` table** (decided above), not the credit ledger.
- **Amount integrity** — because it's variable, server-side recomputation is the security-critical bit here
  (the analogue of P2's IDOR check). Recompute the pr6 total from qty + destination at session-create; never
  trust a client amount.
- **Estimate vs actual reconciliation (gap #10)** — the customer's Stripe amount is fixed at checkout. If
  Lulu's charge to our card later diverges slightly from our quote, we **absorb** small differences (define the
  tolerance + reserve posture in `../sv2-s14-print-hardening.md` → s14d). Pre-checkout render makes this rare:
  page count — the main cost driver — is already known when we price.
- **Order value ~$30–45** → Stripe's cut ~3.5–4%, much lower % than the $5 credit pack.

## Done when
**Commit (a) — checkout:**
- [ ] A variable-amount checkout charges the correct server-computed total (qty × per-copy price; shipping baked in).
- [ ] A tampered client amount is ignored (server recomputes from bookId + qty via pr5.5/pr6).
- [ ] `print_orders` row created in `pending` with qty, amount, PDF tokens, session id.
- [ ] Stripe collects a **US** shipping address (`shipping_address_collection`).
- [ ] With `app.print.enabled=false`, session-create is refused — no customer is charged.

**Commit (b) — webhook → Lulu submit:**
- [ ] Webhook success (idempotent on `event_id`) flips the row to `paid`, reads the Stripe-collected address, and
      submits a sandbox Lulu print job with the right files/qty/address; stores `lulu_job_id`; row → `submitted`.
- [ ] The credit/share webhook branch still works (new `type` branch, nothing regressed).
- [ ] The throwaway `lulu-test` triggers (PrintController + `LuluPrintService.submitTestJob`) are deleted.

## Not this session
The order UI (pr8) · confirmation/status (pr9) · live cutover (later, with P12-style deploy discipline).

## Closing note
This is the spill-prone one — **the split is the plan, not a fallback** (③): land commit (a) checkout, verify it
(order row + Stripe session + address form), then commit (b) webhook→Lulu-submit and verify the full paid→print
loop via the tunnel. Don't try to land both in one pass.
