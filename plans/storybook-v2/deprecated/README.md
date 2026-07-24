# Deprecated Storybook V2 plans

Sessions that were dropped or folded elsewhere during the 2026-06-27 direction change (the guided book
became a **pre-designed fill-in book**, not auto-generated — see `../planning.md` direction update).
Kept for history; **not part of the active build order.**

| File | Was | Why deprecated |
|---|---|---|
| `moment-hero-guided.md` | sv2-s5 | Auto-derived Firsts chapter — dropped. Firsts are now user-picked moment-hero pages in the fixed book. |
| `firsts-chapter.md` | sv2-s7 | The guided-book half of the same auto-Firsts feature — dropped with the above. |
| `circular-avatar-crop.md` | sv2-s6.6 | Folded into `../sv2-s3.5-people-polish-and-circular-crop.md` (shipped). |

The old s5 / s7 / s6.6 numbers are now **reused** by active sessions (s5 = Family Tree, s7 = Guided
shell). See the rename map in `../planning.md` §3.

---

## Payments — the subscription era (deprecated 2026-07-09)

These three were written around a **$4.99/mo "Plus" subscription** with a Pro tier above it. On
2026-07-09 Michael replaced that model with **four one-time SKUs** (credit packs + a per-book share
unlock), and print became pay-per-order. The files described — and their session prompts instructed a
session to *build* — `stripe_subscription_id`, `tier_expires_at`, `tier_grace_until`, the Stripe Billing
Portal, "Manage Subscription", grace-period UI, a monthly credit reset, and a Plus-vs-Pro pricing modal.
**None of that exists or should be built.**

| File | Was | Why deprecated |
|---|---|---|
| `payments-s0-planning.md` | Payments S0 | Decision session; its questions (trial? grace? cancellation UX?) are all N/A without a subscription. Answers now locked in `../payments/stripe-full-plan.md`. |
| `payments-s1-stripe-backend.md` | Payments S1 | Subscription columns + `GET /billing/portal` + 5 webhook event types. Replaced by one-time checkout and a single idempotent `checkout.session.completed`. |
| `payments-s2-upgrade-flow.md` | Payments S2 | Plus/Pro comparison modal + "Manage Subscription". **Worth keeping:** it preserves the original `PaidGate.jsx` implementation, deleted as dead code on 2026-06-19 by `plans/storybook-and-pregnancy-review-fixes/s1-frontend-dead-code.md`. The new modal is built fresh, but this is the reference. |

**Active payments plan:** `../payments/stripe-full-plan.md` (canonical) + `../payments/stripe-primer.md`
(orientation) + `../payments/session-prompts.md`. `users.tier` survives as a vestigial column that
nothing reads.
