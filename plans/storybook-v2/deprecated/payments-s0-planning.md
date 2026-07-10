# Payments S0 — Planning & Decisions
> ⚠️ **SUPERSEDED — ARCHIVAL ONLY.** `stripe-full-plan.md` is canonical. This file predates the
> **2026-07-09 model change**: there is no subscription, no `plus`/`pro` tier, and no tier-based
> gating anywhere. Credits and the share unlock are one-time purchases; print is pay-per-order.
> Do not implement from this file.

**Status:** Not started
**Branch:** none (planning only — no code)
**Depends on:** Storybook S0 decisions (tier names, pricing)

## Goal
Nail down the full payment/subscription architecture before any implementation begins.
This session produces decisions, not code.

---

## Context (from Storybook S0)

- Tiers: `free`, `plus`, `pro`
- Plus: $5/month
- Pro: pricing TBD
- Storybook (digital + physical print) gated to `plus` and `pro`
- AI credits are per-chapter, monthly allowance, resets on billing date
- Free users get zero AI credits

---

## Decisions to Make This Session

### 1. Payment processor
Stripe is the obvious choice — hosted checkout, subscription management, webhooks,
well-documented. No strong reason to evaluate alternatives unless there's a specific concern.

**Confirm:** Use Stripe. Yes/No?

### 2. Subscription checkout flow
Two options for getting a user into a paid plan:
- **Stripe-hosted checkout** — redirect user to Stripe's hosted page, redirect back on success/cancel.
  Simpler, PCI-compliant out of the box, no card UI to build.
- **Stripe Elements (embedded)** — card form lives in our app, we call Stripe APIs directly.
  More control, more work, more PCI scope.

Recommendation: **Stripe-hosted checkout** for V1. Switch to Elements later if UX demands it.

### 3. Pricing page design
Where does the user see upgrade options?
- In-app modal (triggered by PaidGate when a locked feature is tapped)
- Dedicated `/pricing` or `/upgrade` route
- Both (modal teases, full page has details)

### 4. What happens when a subscription lapses?
- Immediate downgrade to `free` on failed payment?
- Grace period (e.g., 3 days) before tier drops?
- What happens to chapters already generated — are they hidden or preserved?

### 5. Trial period?
Free trial (e.g., 7 days) before first charge could improve conversion.
Stripe supports this natively. Do we want it?

### 6. Lulu one-time purchases
~~Physical book orders go through Lulu's own checkout (user redirected to Lulu). No Stripe charge on our
side — Lulu handles payment.~~ **CORRECTED (2026-07-01): Lulu's Print API checkout is *external* — we
collect the customer's payment via our own **Stripe** checkout, then POST a paid print job (Lulu auto-charges
a company card). Print depends on Payments/Stripe. See `plans/storybook-v2/handoffs/`.**

### 7. Subscription cancellation UX
- Self-serve cancel in app (Stripe billing portal)?
- Manual cancel (email us)?
- Stripe's hosted billing portal handles this with zero backend work.

---

## Data Model Changes (for S1 to implement)

```sql
-- Add to users table
ALTER TABLE users ADD COLUMN tier VARCHAR(20) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(100);
ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(100);
ALTER TABLE users ADD COLUMN tier_expires_at TIMESTAMPTZ; -- null = active or free
```

No separate subscriptions table for V1 — tier is the source of truth.
Stripe is the system of record for billing state; webhooks keep our DB in sync.

---

## Sessions

- **S0** — This planning session
- **S1** — Backend: Stripe SDK, checkout session endpoint, webhook handler, tier updates
- **S2** — Frontend: upgrade modal/page, Stripe redirect, success/cancel handling, billing portal link

---

## Output of This Session
- [ ] Payment processor confirmed
- [ ] Checkout flow (hosted vs. embedded) decided
- [ ] Pricing page design decided
- [ ] Lapse/grace period behavior decided
- [ ] Trial period decision
- [x] Lulu purchase model confirmed — **Print API checkout is external; we collect via Stripe, pay Lulu via a company card (2026-07-01). See `plans/storybook-v2/handoffs/`.**
- [ ] Cancellation UX decided
