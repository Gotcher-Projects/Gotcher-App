# SV2-S14a-2 — Refund recording + customer notification

**Status:** ✅ **COMPLETE** — built + **verified end-to-end with Michael 2026-07-21** (`../sv2-s14-verification.md`).
A real dashboard refund recorded and notified once; a redelivered event changed nothing and sent no second email;
the asynchronous `refund.failed` (card `4000000000005126`) correctly **undid** the recording. One gap found
during the run — `refund_id` was never stored — was **fixed and re-verified the same day** (see below).
423 backend tests green.
**Est:** ~1.5 hours · **Depends on:** `sv2-s14a-1` (the row must carry the truth + the PaymentIntent first)
**Blocks:** print **pr10** (a paying customer must not be stranded)
**Launch prompt:** `print/session-prompts.md` → s14a-2
**Read first:** `sv2-s14a-rejection-refund.md` (a-track overview — **research findings + decisions D1–D5**),
`payments/p3-webhook-idempotency.md` (the Stripe webhook + event-dedup pattern), `Backend/.../billing/
BillingWebhookService.java` (where the new event branch goes)

a-1 makes a failed order *known*. This session makes it *handled*: the customer hears from us, and the refund
Michael issues is recorded against the order automatically.

---

## The shape (D2 — no unattended auto-refund)

**Michael refunds from the Stripe dashboard; the app learns about it via webhook.** This is deliberately
inverted from "the app issues refunds":

- Nothing new can move money, so there is no auto-refund loop to get wrong — the research is blunt about the
  risk: refunds can **fail** (`refund.failed`: expired/lost card, insufficient balance) and Stripe's
  **processing fee is never returned** (~$1.32 on a refunded $35 order, real money out).
- We already run a signed Stripe webhook, so recording a dashboard refund costs one new event branch.
- A one-button operator refund endpoint stays available as a later add — but only after the recording path has
  proven itself, because that path is what makes an auto-refund auditable.

## What you're building

### 1. Stripe webhook branch — record the refund
In `BillingWebhookService`, alongside the existing `checkout.session.completed` routing, handle
**`charge.refunded`** (and/or `refund.created`):
- Read the refund's `payment_intent` → find the `print_orders` row by `stripe_payment_intent` (the column a-1
  added). No match → ignore quietly (it's a digital/credit refund, not ours).
- Stamp `refund_id`, `refunded_at`, `refunded_amount_cents` (partial refunds are real — don't assume full).
- **Idempotent on the Stripe event id**, same discipline as P3 — a redelivery must not re-notify.
- Migration `V53` for the three refund columns (or fold into a-1's V52 if a-1 hasn't shipped yet — prefer
  folding, one migration is cleaner than two).

### 2. `refund.failed` → operator alert
The refund did not reach the customer and Stripe will not retry it for us. Alert the operator with the order id,
the failure reason, and the amount. Leave the row marked failed-and-unrefunded so it stays visible.

### 3. Customer notification
Two emails via `EmailService`, plain and honest — no marketing tone, this is money:
- **On `failed`** (fires from a-1's transition, wired here): *we couldn't print your book, you're not being
  charged for a book you won't receive, a refund is on its way, reply to this email with questions.* Include the
  order number. **Never promise a delivery date we can't hit.**
- **On refund recorded:** *your refund of $X is on its way back to your card, typically 5–10 business days.*
- Guard both with a `*_notified_at` column (or reuse the transition guard) so a webhook replay can't re-send.

### 4. Copy that matches the policy
Physical-order refunds are **not** the digital "move the share unlock" policy from
`payments/p0.5-open-questions.md` §2 — a failed print is a genuine cash refund. Don't reuse that copy. Keep the
wording consistent with whatever pr10's ToS refund section ends up saying (s14d owns the written policy).

## ⚠️ Notes
- **Confirmation ≠ fulfilment, and notification ≠ refund.** Telling the customer a refund is coming is a promise
  Michael has to keep manually — so the operator alert from a-1 must be reliable *before* this session ships the
  customer email. Don't ship the customer promise without the operator signal working.
- If SMTP isn't configured the `EmailService` no-ops silently. That's fine for dev, but it means **pr10 must
  verify mail actually sends in prod** — add it to pr10's checklist.

## Done when
- [ ] A refund issued from the Stripe dashboard against a failed print order lands on the row (`refund_id`,
      `refunded_at`, amount) within a webhook delivery.
- [ ] The customer gets exactly one "couldn't print it" email and exactly one "refund on its way" email, no
      matter how many times the events redeliver.
- [ ] A `refund.failed` event alerts the operator and leaves the order visibly unrefunded.
- [ ] A refund for a *digital* purchase (credits/share) does not touch any print order.

---

## As built (2026-07-21)

**Migration `V53__print_orders_refunds.sql`** — `refund_id`, `refunded_at`, `refunded_amount_cents`,
`refund_event_id`, `failure_notified_at`, `refund_notified_at`, plus an index on `stripe_payment_intent`
(Stripe hands us a PaymentIntent, never our order id). **NOT folded into V52** as the plan suggested: V52 had
already been applied, and editing an applied migration changes its checksum and stops the app booting.

**New classes** (`com.gotcherapp.api.print`):
- `PrintRefundService` — `recordRefund(eventId, Charge)` and `refundFailed(Refund)`. Nothing here calls
  `Refund.create`; it only records what a human already did (D2).
- `PrintCustomerEmail` — the two customer emails, each claimed by a conditional UPDATE on its own
  `*_notified_at` column so a redelivery cannot re-send.

**Changed:** `BillingWebhookService` routes `charge.refunded` → record and `refund.failed` → operator alert
alongside the existing `checkout.session.completed` (the object-deserialisation fallback is now a shared
`readObject`). `PrintOrderStatusService` fires the "we couldn't print your book" email on the `failed`
transition — **after** the operator alert, deliberately: that email promises a refund a human then has to
issue, so the signal to that human goes out first.

### Judgment calls the plan left open
1. **`charge.refunded` records, `refund.failed` alerts.** The Charge carries **cumulative** `amount_refunded`,
   which stays honest when a partial refund is topped up later; a single Refund object's `amount` would not.
   `refund_id` is best-effort — the `refunds` list isn't always expanded on a webhook payload, and a missing id
   isn't worth failing the recording over.
2. **Idempotency lives on the order row (`refund_event_id`), not `stripe_events_applied`.** That ledger's
   `user_id` and `sku` are `NOT NULL` and mean nothing for a refund — a refund row in the credit ledger would
   be a lie. Same conditional-update, act-only-if-a-row-changed discipline as a-1.
3. **⚠ Card refunds are ASYNCHRONOUS, and that changed the design.** Looking up how to force a `refund.failed`
   in test mode ([Stripe testing docs](https://docs.stripe.com/testing)) turned up card **`4000000000005126`**:
   the charge succeeds, the refund's status starts as **`succeeded`**, and only *later* flips to `failed`. So
   `charge.refunded` arrives FIRST — we stamp the row as refunded and email the customer "your refund is on its
   way" — and the failure lands after. The first cut of `refundFailed` only alerted, on the wrong assumption
   that the row would still read unrefunded. It now **undoes the recording**: clears `refunded_at` /
   `refunded_amount_cents` (the one question this table gets asked is "does the customer have their money
   back?", and the answer is no) and **resets `refund_notified_at`**, so a retry that finally works re-notifies
   instead of landing in silence. `refund_id` + the new `refund_failed_at` / `refund_failure_reason` keep the
   audit trail. **This is live behaviour, not just a test artefact** — real card refunds fail this way.
   (Sibling card `4000000000007726` does pending → `succeeded` via `refund.updated`; we don't handle
   `refund.updated`, which is fine — `charge.refunded` still fires on success.)
4. **⚠ A failed send still burns the one-shot guard.** `PrintCustomerEmail` claims the guard, then sends; if
   SMTP throws, the claim stands and the email is never retried. That is the deliberate trade — never
   double-send beats always-send when the subject is somebody's money — and it is *why* pr10 must prove
   outbound mail works before real orders flow. Observed live: a `failed` transition set
   `failure_notified_at` while the send threw `MailAuthenticationException`.

### Verified locally 2026-07-21
- V53 applied by Flyway at boot; app started in 4.6s — no injection cycle across the new beans.
- A signed Lulu `REJECTED` for a real order → `failed` + line-item reason + `failure_notified_at` stamped +
  the customer send attempted (threw on local SMTP, swallowed by design). **A second identical delivery
  changed nothing and attempted no second email.**
- Unit-covered: refund recorded + customer told once; redelivered refund event → no second email; a refund
  whose PaymentIntent matches no print order is ignored; `refund.failed` alerts the operator and records
  nothing; the failure email leaks no Lulu text and promises no delivery date.

### ✅ FIXED — `refund_id` was never stored (found in the verification run, fixed + re-verified 2026-07-21)

**The bug.** `latestRefundId(charge)` reads `charge.refunds`, which **is not expanded on the webhook payload**,
so it was always null. Confirmed live on *both* a failed refund (#9) and a successful one (#11) — every refund
landed with `refund_id = NULL`, and the log read `(refund null, …)`. The plan's own "Done when" requires the
refund id on the row, and it's the key support would search Stripe by.

**The fix.**
1. New **`refund.created`** branch → `PrintRefundService.recordRefundId(Refund)`. That is the only event that
   reliably carries the id. It writes the **id and nothing else** — no status, no `refunded_at`, no email —
   which is what makes its ordering against `charge.refunded` irrelevant.
2. `refundFailed` now persists `refund.getId()` too (a failed refund is exactly when support needs it).
3. ⚠ **`charge.refunded` writes `refund_id = COALESCE(?, refund_id)`, not a plain assignment.** `refund.created`
   fires **first**, so by the time `charge.refunded` lands the id is already stored and the charge's own is
   null — a plain assignment would wipe it. This is the subtle half of the fix.

**Re-verified live 2026-07-21** by resending the real Stripe events (no new charge needed):
- `refund.created` resent for #11 → `re_3Tvqw8Ac9G3kJl6y0IpgjAPb` stored, nothing else touched.
- `refund.created` + `refund.failed` resent for #9 → id stored **and** the failure state preserved
  (`refunded_at` still null, `refund_failed_at` set).
- **The COALESCE regression specifically:** cleared #11's `refund_event_id` so the update would actually run,
  resent `charge.refunded`, and confirmed the log showed it executing with `refund null` while `refund_id` came
  out **unchanged**. The customer-email guard also held (*"already emailed … not sending again"*).
- 423 backend tests green, including one asserting the SQL contains `refund_id = COALESCE(?, refund_id)`.

### Still to verify (→ `../sv2-s14-verification.md`, order B)
- A **real dashboard refund** landing on the row via `charge.refunded`, and the "refund on its way" email.
- Redelivering that event from the Stripe CLI and seeing nothing change.
- **`refund.failed` — solved: pay with card `4000000000005126`.** The charge succeeds; refund it from the
  dashboard and Stripe reports success first, then flips to failed a moment later. Watch for: `refunded_at`
  cleared, `refund_failed_at` + reason set, `refund_notified_at` reset, one operator alert. Then refund again
  (on a normal 4242 order) and confirm the customer is re-notified.
