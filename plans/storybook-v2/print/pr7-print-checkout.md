# Print pr7 — Variable-amount Stripe checkout + shipping address

**Status:** Not started
**Est:** ~2–3 hours (spill-prone — split rather than rush) · **Depends on:** Payments P1–P3, pr5, pr6 · **Blocks:** pr8, pr9
**Launch prompt:** `session-prompts.md` → pr7
**Read first:** `../payments/p2-checkout-endpoint.md`, `../payments/p3-webhook-idempotency.md`

Print needs its **own** Stripe checkout — **variable amount** (copies × price + shipping) with a **shipping
address**. The fixed-price digital SKUs (credit packs / share unlock) hand it nothing reusable except the
patterns.

---

## What you're building

A second `mode: 'payment'` checkout flow:
1. **Amount** = the pr6 estimate (copies × unit + shipping), computed server-side — **never trust a
   client-sent amount** (the client could tamper it). Recompute from qty + destination at session-create.
2. **Collect a shipping address** — Stripe Checkout supports `shipping_address_collection`; use it (or collect
   in our UI and pass through). The digital SKUs never needed this.
3. **On webhook success** → submit the **paid Lulu print job** (pr5) with the interior (pr3) + cover (pr4) +
   qty + address. Same "fulfil only on the signed webhook, idempotent on `event_id`" discipline as Payments P3.

## ⚠️ Notes
- **Reuse, don't duplicate blindly** — the webhook/ledger/idempotency machinery from Payments P3 is the model.
  A print order is a distinct fulfilment (submit a Lulu job) but the *shape* (signed webhook → idempotent
  action) is identical. Extend the ledger or add a print-order table as fits.
- **Amount integrity** — because it's variable, server-side recomputation is the security-critical bit here
  (the analogue of P2's IDOR check).
- **Order value ~$30–45** → Stripe's cut ~3.5–4%, much lower % than the $5 credit pack.

## Done when
- [ ] A variable-amount checkout charges the correct server-computed total for qty × price + shipping.
- [ ] A shipping address is captured.
- [ ] Webhook success (idempotent) triggers a sandbox Lulu print job with the right files/qty/address.
- [ ] A tampered client amount is ignored (server recomputes).

## Not this session
The order UI (pr8) · confirmation/status (pr9) · live cutover (later, with P12-style deploy discipline).

## Closing note
This is the spill-prone one. If it grows past ~3h, split the *checkout* from the *webhook→Lulu-submit* and
land them separately.
