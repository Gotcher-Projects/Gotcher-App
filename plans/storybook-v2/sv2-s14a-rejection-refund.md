# SV2-S14a — Print-job rejection + refund path

**Status:** Not started
**Est:** ~2 hours · **Depends on:** print pr5 (Lulu job submit + rejection surfacing), pr7 (`print_orders`
table + Stripe charge), pr9 (confirmation/status surface) · **Blocks:** print **pr10** (real money must not
ship without this)
**Launch prompt:** `print/session-prompts.md` → s14a *(add when this runs)*
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

## What you're building

1. **Detect the failure.** pr5 already surfaces a Lulu rejection/submit failure as a handled error rather than a
   crash. Catch it at the point where the pr7 webhook submits the paid job, and treat a `submitted` attempt that
   comes back rejected as a terminal failure for that order.
2. **Mark the order.** Flip the `print_orders` row to **`failed`** (the status enum from pr7 already includes
   it: `pending → paid → submitted → shipped / failed`). Record the Lulu error reason on the row for support
   lookup.
3. **Refund the Stripe charge.** Issue a Stripe **refund** against the order's PaymentIntent/charge (stored on
   the `print_orders` row). Idempotent — never double-refund; guard on the row already being `failed`/refunded.
   If an automatic refund isn't safe to fire unattended, **flag the order for manual refund** and alert the
   operator instead (Michael is sole operator — an email/log alert is acceptable for v1).
4. **Notify the customer.** Tell them the order couldn't be printed and the charge was refunded. Reuse the
   existing notification path; no new user-authored surface.

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

## Done when

- [ ] A sandbox Lulu rejection on a *paid* order flips the `print_orders` row to `failed` with the reason
      recorded.
- [ ] The customer's Stripe charge is refunded (or the order is flagged for manual refund + operator alerted),
      idempotently — a webhook replay does not double-refund.
- [ ] The customer is notified that the order failed and was refunded.
- [ ] Verified end-to-end against a forced sandbox rejection (e.g. a deliberately under-min-page PDF).

## Not this session (→ the rest of sv2-s14, deferred post-launch)

- **s14b** — user-initiated order cancellation, gated on Lulu order state.
- **s14c** — persistent "my orders" history + support-lookup view over `print_orders`.
- **s14d** — estimate/actual divergence tolerance + written refund/reserve policy (also a pr10 ToS item).
