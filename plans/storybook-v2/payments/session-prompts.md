# Payments — Session Prompts

---

## S0 — Planning & Decisions
Session 0 of payments. No branch needed — planning only, no code.
Plan: plans/payments/s0-planning.md

Decisions session. Goals:
1. Confirm payment processor (Stripe)
2. Choose checkout flow (hosted vs. embedded)
3. Decide pricing page design (modal, page, or both)
4. Decide lapse/grace period behavior and what happens to generated content
5. Decide trial period (yes/no)
6. Confirm Lulu purchase model (Lulu-hosted checkout, no Stripe on our side)
7. Decide cancellation UX (Stripe billing portal vs. manual)

Read plans/payments/s0-planning.md fully before starting. Do not write any code this session.

---

## S1 — Stripe Backend Integration
Branch: payments-s1
Plan: plans/payments/s1-stripe-backend.md

Backend only. Goals:
1. DB migration: add tier, stripe_customer_id, stripe_subscription_id, tier_expires_at to users
2. Add Stripe Java SDK to build.gradle
3. Implement POST /billing/create-checkout-session
4. Implement POST /billing/webhook (public endpoint, signature verified)
5. Implement GET /billing/portal
6. Implement GET /billing/status
7. Update GET /auth/me to return tier field
8. Update SecurityConfig to allow /billing/webhook without JWT

Read plans/payments/s1-stripe-backend.md fully before starting.

---

## S2 — Upgrade Flow (Frontend)
Branch: payments-s2
Plan: plans/payments/s2-upgrade-flow.md

Frontend only. Goals:
1. Build PaidGate component (teaser UI + upgrade prompt)
2. Build pricing modal (Plus vs. Pro comparison, upgrade button)
3. Handle Stripe success/cancel redirect routes
4. Add "Manage Subscription" link in account settings (Stripe portal redirect)
5. Expose user.tier from useAuth() / user context

Read plans/payments/s2-upgrade-flow.md fully before starting.
