# SV2-S14a-2 — Refund recording + customer notification

**Status:** Not started
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
