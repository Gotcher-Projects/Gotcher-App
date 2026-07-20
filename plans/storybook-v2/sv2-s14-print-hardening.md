# SV2-S14 — Print failure-path hardening (track overview)

**Status:** In progress — **s14a promoted to a real session file (`sv2-s14a-rejection-refund.md`) 2026-07-17;
s14b/c/d remain deferred candidates below.** Stub created 2026-07-16 in the print pr0.5 gap audit.
**Depends on:** print pr5–pr9 (the happy path must exist before there's a failure path to harden)
**Blocks:** print **pr10** go-live should not ship real money without at least **s14a** landed.

> This file is the **track overview** for the print failure surface. The one pre-launch slice — **s14a
> (print-job rejection + refund)** — now lives in its own file: **`sv2-s14a-rejection-refund.md`**. The other
> three slices below are deliberately deferred to post-launch and stay as candidates until scheduled.

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

### Deferred candidates (≤2h each — turn into real files when scheduled, post-launch)
- **s14b — Order cancellation.** User-initiated cancel, gated on Lulu order state (can we still cancel with
  Lulu?); refund accordingly.
- **s14c — Order-history / "my orders" UI + support view.** Reads the `print_orders` table (defined in pr7).
  pr9 only shows a single post-checkout confirmation; this is the persistent list + a support-lookup surface.
- **s14d — Estimate/actual reconciliation + reserve policy.** Tolerance handling and the written refund/reserve
  policy (also a pr10 ToS go-live item).

## Done when (track-level)
- [x] s14a turned into a real session file (`sv2-s14a-rejection-refund.md`, 2026-07-17).
- [ ] s14b/c/d turned into real ≤2h session files if/when scheduled post-launch.
- [ ] At minimum **s14a** is landed before print pr10 flips to live money.

## Not this
The happy path (pr1–pr9) · go-live/deploy (pr10). Only the failure/recovery/refund surface.
