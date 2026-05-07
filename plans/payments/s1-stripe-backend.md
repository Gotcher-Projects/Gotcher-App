# Payments S1 — Stripe Backend Integration
**Status:** Not started
**Branch:** `payments-s1`
**Depends on:** Payments S0 (decisions locked)

## Goal
Wire up Stripe on the backend: subscription checkout, webhook handling, and tier updates.
No frontend work this session.

---

## Tasks

### 1. DB migration
- Add `tier VARCHAR(20) DEFAULT 'free'` to users
- Add `stripe_customer_id`, `stripe_subscription_id`, `tier_expires_at`
- Migration file: `V__add_tier_and_stripe.sql` (number TBD)

### 2. Stripe SDK dependency
- Add Stripe Java SDK to `build.gradle`
- Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `application.properties` + `.env.example`

### 3. Endpoints

#### POST /billing/create-checkout-session
- Creates or retrieves Stripe customer for the user
- Creates a Stripe Checkout Session for the chosen plan (plus/pro)
- Returns `{ url }` — frontend redirects user to Stripe hosted checkout
- Success URL: `{app}/upgrade-success?session_id={CHECKOUT_SESSION_ID}`
- Cancel URL: `{app}/upgrade` (back to pricing page)

#### POST /billing/webhook (public — no JWT)
- Verifies Stripe signature (`Stripe-Signature` header)
- Handles events:
  - `checkout.session.completed` → set tier, store subscription ID
  - `customer.subscription.deleted` → downgrade to free
  - `invoice.payment_failed` → flag for grace period (if applicable)

#### GET /billing/portal
- Creates a Stripe Billing Portal session for the user
- Returns `{ url }` — frontend redirects user to Stripe portal for cancel/update

#### GET /billing/status (JWT protected)
- Returns current tier, subscription status, next billing date

### 4. BillingService
- `createCheckoutSession(userId, plan)` → Stripe API call
- `handleWebhookEvent(payload, signature)` → event routing
- `createPortalSession(userId)` → Stripe API call
- `getStatus(userId)` → reads from DB

### 5. SecurityConfig update
- Add `/billing/webhook` to public endpoints (no JWT required)
- All other `/billing/**` remain JWT-protected

---

## Stripe Events to Handle

| Event | Action |
|---|---|
| `checkout.session.completed` | Set `users.tier`, store `stripe_customer_id` + `stripe_subscription_id` |
| `customer.subscription.updated` | Update tier if plan changed |
| `customer.subscription.deleted` | Set tier back to `free`, clear subscription ID |
| `invoice.payment_failed` | TBD based on S0 grace period decision |

---

## Notes
- Use `Stripe-Signature` verification — never trust webhook payload without it
- Stripe customer ID should be stored once and reused (don't create duplicate customers)
- All Stripe calls should be wrapped in try/catch — Stripe exceptions must not dispatch to /error
  (see Spring Security / Error Dispatch Pattern in MEMORY.md)
