# SV2-S14 — Print failure-path hardening (track overview)

**Status:** ✅ **PRE-LAUNCH WORK COMPLETE** — **s14a-1, s14a-2 and s14c all verified with Michael 2026-07-21**
(`sv2-s14-verification.md`). The one gap found during the run (`refund_id` never stored) was fixed and
re-verified the same day. **s14b + s14d stay deferred.** ▶ The pr10 failure-handling gate is now met — but read
the verification file's **"Carried out of this session"** section first: six open items remain, mostly ops/access.
**Depends on:** print pr5–pr9 (the happy path — **all Complete as of 2026-07-21**, so this track is unblocked)
**Blocks:** print **pr10** go-live must not ship real money without **s14a-1 + s14a-2** landed.

> This file is the **track overview** for the print failure surface. Pre-launch work lives in three session
> files: **`sv2-s14a-1-failure-detection.md`** → **`sv2-s14a-2-refund-and-notify.md`** → **`sv2-s14c-order-list.md`**,
> with **`sv2-s14a-rejection-refund.md`** as the a-track overview holding the **research record and locked
> decisions D1–D5** (read it before building either a-slice). s14b/s14d remain deferred candidates below.

The whole print track defers refunds, order cancellation, and print-job-rejection recovery here. pr5/pr7/pr9/pr10
all point at `sv2-s14` — this file is where that surface lives. The happy path (order → pay → render → submit →
confirm) is pr1–pr9; **this is everything that happens when a step fails.**

---

## Why this exists (the failure surface with no other home)
- **Print-job rejection** (pr5) — Lulu rejects the PDF (below min pages, bad file, spec violation) *after* the
  customer already paid us via Stripe. Money is in, no book is coming.
- **Render failure** — even with **pre-checkout render** (decided pr0.5, so most render failures happen *before*
  the charge), a render can still fail on retry or a late Lulu-side validation. Need a recovery/refund path.
- **Refunds** — physical-order refunds differ from the digital "move the share unlock" policy. Per Lulu's ToS
  §13, Lulu's liability to us is capped at the print cost; **we are merchant of record for the full retail
  price**, so a defective/lost/rejected book means we refund the customer and absorb the gap. Needs a real
  Stripe-refund path + a reserve mindset.
- **Order cancellation** — user asks to cancel; depends on whether Lulu has submitted/printed yet.
- **Estimate vs actual divergence** (pr0.5 gap #10) — if Lulu's charge to our card diverges from our quoted
  Stripe amount, the customer amount is already fixed. Define the tolerance we absorb vs. act on.

## Slices
- ✅ **s14a — Print-job rejection + refund path.** **PROMOTED → `sv2-s14a-rejection-refund.md`** (2026-07-17).
  Detect a Lulu rejection/failure on a paid order; refund the Stripe charge (or flag for manual refund); mark
  the `print_orders` row failed; notify the user. *This is the minimum bar before pr10 real money.*

✅ **s14a SPLIT IN TWO (2026-07-21)** after the Lulu/Stripe research — `sv2-s14a-rejection-refund.md` is now the
a-track overview + research record, with two real session files under it:
- **`sv2-s14a-1-failure-detection.md`** (~2h) — V52 migration (incl. the missing `stripe_payment_intent`), the
  signed Lulu webhook, the reconciliation sweep, mark `failed`/`shipped`, operator alert. **The pr10 gate.**
  ✅ **COMPLETE — verified 2026-07-21** (both detection paths proven on real Lulu rejections).
- **`sv2-s14a-2-refund-and-notify.md`** (~1.5h) — customer emails + recording a dashboard refund via a new
  Stripe `charge.refunded` branch + `refund.failed` alerting. ✅ **COMPLETE — verified 2026-07-21**; the
  `refund_id` gap found during the run was fixed + re-verified the same day.

✅ **Combined verification RUN 2026-07-21** → **`sv2-s14-verification.md`**. Batching worked exactly as intended:
a-1's forced rejection produced the very `failed` + `stripe_payment_intent` row that a-2's dashboard refund and
s14c's list both needed, so one harness covered all three. **Read that file's "Carried out of this session"
section before pr10** — it holds seven open items, most of them access/ops rather than code.

✅ **s14c PROMOTED to pre-launch (2026-07-21)** → `sv2-s14c-order-list.md` (~1h). Rationale (a-track D4): once
a-1 records `tracking_urls` we hold tracking data with nowhere to show it, "where's my book?" is the likeliest
support email, and a `failed` order otherwise has no in-app existence at all. ✅ **COMPLETE — verified
2026-07-21** (all four states confirmed on screen).

### Deferred candidates (turn into real files when scheduled, post-launch)
- **s14b — Order cancellation.** Still deferred (a-track D5). The API turned out to be trivial —
  `PATCH /print-jobs/{id}/status/`, allowed until `IN_PRODUCTION`, and Lulu holds jobs in `PRODUCTION_DELAYED`
  precisely so cancels can land — but the cost was never the endpoint; it's the customer-facing rules. Same
  endpoint remains available as a manual operator action.
- **s14e — Failed-order RECOVERY (re-render + re-submit).** Deferred by Michael 2026-07-21, and deliberately
  **not** a pr10 blocker: print ships **dormant** (`PRINT_ENABLED=false`) while he's away, so there are no real
  orders to recover. ⛔ **It IS the gate on flipping the switch ON.** Today a failed order has no fix but a
  refund, because:
  1. **A retry reuses the SAME stored PDFs** — `resubmitParked` never re-renders, so it can only fix a *fetch*
     failure (dead url, Lulu outage, misconfig), never a *content* rejection like pr5's transparency bug.
  2. **The PDFs are hard-DELETEd after 24h** (`app.print.pdf-ttl-hours`, swept hourly) and there is **no admin
     re-render** — the render endpoints are scoped to `principal.userId()`. A 2am rejection is unrecoverable by
     8am. The short TTL is deliberate privacy protection (infant photos in Postgres), so this is a real
     tradeoff, not an oversight — the likely fix is to **stop sweeping PDFs attached to `paid`/`failed` orders**
     and keep the aggressive TTL for everything else.
  3. **The customer is promised a refund the instant the order fails**, which forecloses a quiet retry.
     Decoupling that email from the `failed` transition would keep the option open.

  Manual stopgap that works TODAY for a fetch-type failure inside the TTL — re-arms the sweep's resume path:
  ```sql
  UPDATE print_orders SET status='paid', lulu_job_id=NULL, parked_reason='print_disabled',
         failure_reason=NULL, submit_attempts=0, last_checked_at=NULL WHERE id = <order>;
  ```
  (fix the root cause first; needs `pdf_expires_at` in the future and `PRINT_ENABLED=true`; then contact the
  customer by hand, because they are expecting a refund.)
- **s14d — Estimate/actual reconciliation + reserve policy.** Tolerance handling and the written refund/reserve
  policy (also a pr10 ToS go-live item). Now has a real number: a refunded $35 order still costs ~$1.32 in
  Stripe fees, which are **not** returned on a refund.

## Done when (track-level)
- [x] s14a turned into a real session file (`sv2-s14a-rejection-refund.md`, 2026-07-17), then **split into
      a-1 / a-2 with locked decisions (2026-07-21)**.
- [x] s14c turned into a real session file and promoted pre-launch (2026-07-21).
- [ ] s14b/d turned into real session files if/when scheduled post-launch.
- [x] **s14a-1 + s14a-2 landed AND verified** before print pr10 flips to live money (2026-07-21).

## Not this
The happy path (pr1–pr9) · go-live/deploy (pr10). Only the failure/recovery/refund surface.
