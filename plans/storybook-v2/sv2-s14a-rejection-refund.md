# SV2-S14a — Print failure path (track overview + research)

**Status:** Split into two sessions 2026-07-21 after the research below — **this file is now the a-track
overview and the shared research record**; both children read it first.
- **`sv2-s14a-1-failure-detection.md`** — detection + truth (migration, signed Lulu webhook, reconciliation
  sweep, mark `failed`, alert the operator). **This is the real pr10 gate.**
- **`sv2-s14a-2-refund-and-notify.md`** — the money (customer notification, refund recording, `refund.failed`).

**Why split:** the research found s14a has to carry a migration the plan never anticipated (we cannot refund at
all today — no PaymentIntent stored) *and* a signed-webhook receiver. Detection and money are a natural seam:
after a-1 no paid order can fail silently, which is the property pr10 actually needs.

**Est:** ~2h + ~1.5h · **Depends on:** print pr5 (Lulu job submit), pr7 (`print_orders` + the Stripe charge),
pr9 (confirmation surface) · **Blocks:** print **pr10** (real money must not ship without at least a-1)
**Launch prompts:** `print/session-prompts.md` → s14a-1, s14a-2
**Read first:** `print/pr5-lulu-api.md`, `print/pr7-print-checkout.md`, `payments/p3-webhook-idempotency.md`,
`payments/p0.5-open-questions.md` (§2 refund posture)

The first real-money failure path. The happy path (pr1–pr9) charges the customer via Stripe **before** we
submit the paid Lulu job. So the dangerous window is: **money is in, and then Lulu rejects the job** (below
min page count, bad PDF, spec violation) or the submit fails. No book is coming and the customer is out the
money until we act. This session closes that gap. It is the **minimum bar before pr10 flips to live money** —
the rest of the sv2-s14 hardening surface (cancellation, order history, reconciliation) can follow post-launch.

---

## Why this is the pre-launch slice (and b/c/d are not)

We are **merchant of record for the full retail price**, but Lulu's ToS §13 caps *their* liability to us at the
print cost. A rejected/defective/lost book therefore means **we refund the customer and absorb the gap**. That
liability exists the moment pr10 goes live, so the detect-and-refund path must exist first. Cancellation (s14b),
the "my orders" list (s14c), and estimate/actual reconciliation (s14d) are all real, but none of them are load-
bearing for "don't strand a paying customer" — they're deferred.

## 🔬 Research findings (2026-07-21) — read before building

Lulu facts below were **probed live against our own sandbox account**, not taken from docs. Stripe facts are
from the current refund docs.

### Lulu — the rejection payload (verified on our own REJECTED jobs 314960 + 314931)
The job-level message is **useless for support**; the real reason is on the LINE ITEM:
```
job.status            = { name: "REJECTED", message: "One or more line-items were rejected.", changed: <ts> }
job.line_items[].status = { name: "REJECTED",
                            messages: { printable_normalization: { interior: [ "<real reason>", ... ] } } }
```
Real reasons we've already collected: *"Upload Error: We detected an error in your PDF…"* (the pr5 transparency
rejection) and *"Unexpected Http response for source url … Status code: 404"* (a dead source URL). **Store the
line-item messages array as the failure reason** — persisting `status.message` alone would tell us nothing.

### Lulu — status lifecycle + line-item statuses
- **Job:** `CREATED → UNPAID → PAYMENT_IN_PROGRESS → PRODUCTION_DELAYED → PRODUCTION_READY → IN_PRODUCTION →
  SHIPPED → DELIVERED`, plus terminal `REJECTED` and `CANCELED`.
- **Line item:** `CREATED, ACCEPTED, REJECTED, IN_PRODUCTION, ERROR, SHIPPED`.
- Sandbox jobs stop at `UNPAID` ("Print-job was accepted and needs to be paid") — normal, not a bug.

### Lulu — webhooks are REAL and signed (this changes the detection design)
- `POST /webhooks/` `{ topics: ["PRINT_JOB_STATUS_CHANGED"], url }`; also `GET /webhooks/`,
  `PATCH /webhooks/{id}/`, `POST /webhooks/{id}/test/` (fires dummy data — testable without a real order), and
  `GET /webhooks/{id}/submissions/` (last 30 days of deliveries = a built-in audit log).
- **Signed `Lulu-HMAC-SHA256`**, HMAC-SHA256 over the **raw** body keyed on the API secret — the same discipline
  as our Stripe webhook (`BillingWebhookController` already takes the body as a raw String for exactly this).
- ⚠ **Footgun: 5 consecutive failed deliveries auto-DEACTIVATES the webhook.** A VPS restart window or a bad
  deploy can silently switch off our only failure detector. This is the argument for keeping a reconciliation
  poller as a safety net even if the webhook is the primary signal.
- Verified: `GET /webhooks/` on our sandbox account → **HTTP 200, count 0** (endpoint available, none registered).

### Lulu — cancellation + tracking (feeds s14b / s14c)
- **Cancel = `PATCH /print-jobs/{id}/status/`**, allowed while the job is **not yet in production**. Lulu
  deliberately holds orders in `PRODUCTION_DELAYED` for a window precisely so cancellations can land.
- Production time is **3–5 days for orders under 100 units**; the cancel window is inside that.
- Shipped line items carry **`tracking_id`, `tracking_urls[]`, `carrier_name`** — so a shipped notification and
  a real tracking link are nearly free ONCE the status feed exists (pr9's "optional half" falls out of s14a).

### ⚠ Stripe — we cannot currently issue a refund at all
`print_orders` (V51) stores `stripe_session_id`, `stripe_event_id`, `lulu_job_id` and **no PaymentIntent or
charge id**. `Refund.create` needs one of those. Recoverable (retrieve the Session by id → read
`payment_intent`), but the fix is to persist it in the webhook claim where the `Session` is already in hand:
add `stripe_payment_intent` to the atomic `pending→paid` UPDATE in `PrintOrderFulfilmentService`.
**This is a migration s14a must carry (V52)** — the plan below did not anticipate it.

### Stripe — refund mechanics that change the policy
- `Refund.create({ payment_intent })`, full or partial by `amount`; make it idempotent with an
  **Idempotency-Key** (e.g. `print_refund_{orderId}`) exactly like pr7 keys `Session.create`.
- **Stripe's processing fee is NOT returned on a refund.** A fully refunded $35 order still costs us ~**$1.32**
  (2.9% + 30¢) in real money, before any Lulu cost already incurred. This is the concrete number behind
  "we absorb the gap" — it belongs in the s14d reserve policy and the pr10 ToS refund copy.
- **Refunds can FAIL** (`refund.failed`: `expired_or_canceled_card`, `lost_or_stolen_card`,
  `insufficient_funds`, `declined`). So a refund is not fire-and-forget even when automated — an auto-refund
  path would itself need a failure branch and an operator alert, which is most of the work of just alerting.
- If our Stripe balance can't cover it, card refunds sit **pending** until it can.

## Decisions locked 2026-07-21 (with Michael, after the research)

- **D1 — Detection = signed Lulu webhook PRIMARY + a reconciliation sweep as a SAFETY NET.** The original plan
  ("catch it where the webhook submits") only ever catches *submit-time* failures; the dangerous case is a job
  Lulu accepts and rejects minutes later during normalization, which nothing currently looks at. The webhook is
  the fast path and it hands us `SHIPPED` + tracking for free. But a webhook that **auto-deactivates after 5
  failed deliveries** cannot be the only detector when the failure mode is "customer paid, got nothing" — so a
  slow sweep re-reads any order stuck in a non-terminal state. Both feed ONE status mapper.
- **D2 — No unattended auto-refund. Flag + alert the operator.** Reinforced by the research: `refund.failed` is
  real, so an automated path needs its own failure branch and operator alert anyway — that's most of the work of
  just alerting. Michael refunds from the Stripe dashboard; the app *learns* about it (a-2) rather than driving it.
- **D3 — A parked order is NOT a failed order.** Kill-switch parking (print disabled mid-flight) means the book
  is fine and we simply weren't accepting jobs → **resume when re-enabled**, never refund. A Lulu rejection is
  terminal → refund. Today both land at `paid` and are indistinguishable; a-1 records which is which. This
  matters concretely because pr10 deploys with `PRINT_ENABLED=false` and Michael is away right after launch.
- **D4 — s14c (minimal order list) is promoted to pre-launch** (`sv2-s14c-order-list.md`). Once a-1 is feeding
  status in we hold `tracking_urls` for every shipped order with nowhere to show them, and "where's my book?"
  is the likeliest support email. It also gives a `failed` order a visible home instead of depending on an email.
- **D5 — s14b (cancellation) stays deferred.** The API is trivial (`PATCH /print-jobs/{id}/status/` until
  `IN_PRODUCTION`); the cost is the customer-facing rules — who may cancel, what the UI promises once the window
  closes, what happens to a part-produced order. "Email us" is honest at launch volume, and the same endpoint is
  available as a manual operator action if it's ever urgent.

## ⚠️ Notes

- **Same webhook discipline as Payments P3** — the failure handling hangs off the signed webhook flow, so it
  must be **idempotent on the Stripe `event_id` / the order row**. A webhook retry must not refund twice or
  re-notify.
- **Refund posture is already decided** — `payments/p0.5-open-questions.md` §2 is the digital "move the share
  unlock" policy; **physical orders are different** — a failed print is a genuine cash refund, not a credit
  move. Don't reuse the digital refund copy verbatim.
- **Don't build cancellation here.** User-initiated cancel (gated on Lulu's order state) is **s14b**. This
  session only handles the *system-detected* rejection/failure of an order we already tried to fulfil.
- **Manual-refund escape hatch is fine for v1.** If the safe move is "flag + alert the operator" rather than an
  unattended `stripe.Refund.create`, take it — a stranded charge with an alert is recoverable; a buggy auto-
  refund loop is not.

## Done when (the a-track as a whole — per-session checklists live in the children)

- [ ] **a-1** A forced sandbox rejection on a *paid* order flips the row to `failed` with the real line-item
      reason recorded, and alerts the operator — with no webhook registered at all (sweep path) and with one
      (webhook path).
- [ ] **a-1** A kill-switch-parked order resumes when print is re-enabled instead of being treated as failed.
- [ ] **a-2** The customer is told their order failed, and a dashboard refund lands back on the row.
- [ ] Neither path double-alerts or double-acts on a redelivery.

## The forced-rejection fixture (how to test this at all)

Point `BACKEND_URL` at a host Lulu can't fetch, then place an order: Lulu accepts the POST, then rejects with
*"Unexpected Http response for source url … Status code: 404"* — exactly our job 314931. Repeatable, needs no
bad PDF, and exercises the full paid → submitted → REJECTED path. (`POST /webhooks/{id}/test/` fires a dummy
payload for testing the receiver's plumbing, but only a real order exercises the mapper end to end.)

## Not this track (deferred post-launch)

- **s14b** — user-initiated order cancellation (D5 above).
- **s14d** — estimate/actual divergence tolerance + written refund/reserve policy (also a pr10 ToS item). The
  research gives it a real number: a refunded $35 order still costs us ~$1.32 in unreturned Stripe fees.
