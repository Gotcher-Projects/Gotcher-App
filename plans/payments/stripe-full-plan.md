# Stripe — Full Implementation Plan

**Status: Not Started**
**Supersedes:** s0-planning.md, s1-stripe-backend.md, s2-upgrade-flow.md (keep those for reference)
**Next migration:** V31 (chapter_photos, S5.2) → **V32** (Stripe columns)

---

## Decisions (S0 resolved)

All open questions from s0-planning.md are answered here. Do not re-litigate these in implementation sessions.

| Question | Decision |
|---|---|
| Payment processor | **Stripe** |
| Checkout flow | **Stripe-hosted checkout** (redirect to Stripe, back on success/cancel) |
| Pricing | **Plus: $4.99/month** (matches "$5/month" copy in PaidGate) |
| Pro tier | **Deferred** — launch with Plus only; add Pro when print/Lulu is ready |
| Free trial | **No** — V1 ships without trial; revisit after first 100 paid users |
| Lapse behavior | **3-day grace period** on `invoice.payment_failed`; downgrade to `free` on 4th day or `customer.subscription.deleted` |
| Downgrade content | **Preserve everything** — generated chapters are never hidden or deleted on downgrade |
| AI credits (Plus) | **10 credits/month**, resets on billing anniversary |
| Cancellation UX | **Stripe Billing Portal** — zero custom cancel UI to build |
| Lulu physical print | **Lulu-hosted checkout** — no Stripe on our side for print orders |
| Pricing page | **Modal first** (triggered by PaidGate); add a dedicated `/pricing` page in a later session |

---

## What Already Exists

- `users.tier VARCHAR(20) DEFAULT 'free'` — V23 migration, live in prod
- `users.ai_credits_remaining INT` — V23, live
- `users.credits_reset_at TIMESTAMPTZ` — V23, live
- `Frontend/src/components/ui/PaidGate.jsx` — shows upgrade prompt for free users; button is disabled ("Coming Soon")
- StorybookTab uses `tier` and `credits` to gate chapter generation

---

## What Needs Building

### Session 1 — Backend (V32 + Stripe SDK + endpoints)
### Session 2 — Frontend (pricing modal, redirect flows, billing portal link)
### Session 3 — Credit management (reset job, admin tooling, display)

---

## Session 1 — Backend

### V32 Migration

```sql
-- Backend/db/migration/V32__add_stripe_to_users.sql
ALTER TABLE users
  ADD COLUMN stripe_customer_id  VARCHAR(100),
  ADD COLUMN stripe_subscription_id VARCHAR(100),
  ADD COLUMN tier_expires_at     TIMESTAMPTZ,
  ADD COLUMN tier_grace_until    TIMESTAMPTZ;
```

- `tier_expires_at` — null means active or free; set on `customer.subscription.deleted`
- `tier_grace_until` — set to NOW() + 3 days on `invoice.payment_failed`; if still set and past, downgrade

### Stripe Java SDK

In `Backend/build.gradle`:
```groovy
implementation 'com.stripe:stripe-java:25.+'
```

In `application.properties`:
```
stripe.secret.key=${STRIPE_SECRET_KEY}
stripe.webhook.secret=${STRIPE_WEBHOOK_SECRET}
stripe.price.plus.monthly=${STRIPE_PRICE_PLUS_MONTHLY}
```

In `.env.example`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PLUS_MONTHLY=price_...
```

### New Package: `com.gotcherapp.api.billing`

**Files to create:**
- `BillingController.java`
- `BillingService.java`
- `dto/CheckoutRequest.java`
- `dto/CheckoutResponse.java`
- `dto/BillingStatusResponse.java`

### Endpoints

#### POST /billing/checkout
JWT-protected. Creates a Stripe Checkout Session for Plus.

Request: `{ "plan": "plus" }` (only valid value for now)

Response: `{ "url": "https://checkout.stripe.com/..." }`

Logic in `BillingService.createCheckoutSession(userId)`:
1. Look up user. If `stripe_customer_id` is null, call `Customer.create()` with user's email and store the ID.
2. Call `Session.create()` with:
   - `customer`: the stored customer ID
   - `mode`: `subscription`
   - `lineItems`: the Plus price ID
   - `successUrl`: `${APP_BASE_URL}/upgrade-success?session_id={CHECKOUT_SESSION_ID}`
   - `cancelUrl`: `${APP_BASE_URL}/book` (or wherever the user came from)
   - `clientReferenceId`: userId (for webhook cross-reference)
3. Return the session URL.

#### POST /billing/webhook (NO JWT — public endpoint)
Stripe sends events here. Must verify `Stripe-Signature` header.

```java
@PostMapping(value = "/webhook", consumes = "application/json")
public ResponseEntity<String> webhook(
    @RequestBody String payload,
    @RequestHeader("Stripe-Signature") String sigHeader
) { ... }
```

Handle these events:

| Stripe Event | Action |
|---|---|
| `checkout.session.completed` | Set `tier='plus'`, store `stripe_customer_id` + `stripe_subscription_id`, set `ai_credits_remaining=10`, set `credits_reset_at=NOW()+30d`, clear `tier_expires_at` + `tier_grace_until` |
| `customer.subscription.updated` | If plan changed: update tier accordingly |
| `customer.subscription.deleted` | Set `tier='free'`, clear `stripe_subscription_id`, set `tier_expires_at=NOW()` |
| `invoice.payment_failed` | Set `tier_grace_until=NOW()+3d` (don't downgrade yet) |
| `invoice.payment_succeeded` | Clear `tier_grace_until` |

Always return `200 OK` to Stripe even if the event is unrecognized — returning non-2xx causes Stripe to retry.

#### GET /billing/portal
JWT-protected. Creates a Stripe Billing Portal session.

Response: `{ "url": "https://billing.stripe.com/..." }`

Logic: call `com.stripe.model.billingportal.Session.create()` with the user's `stripe_customer_id` and a `returnUrl` of `${APP_BASE_URL}/book`.

#### GET /billing/status
JWT-protected. Returns billing state for display in account settings.

Response:
```json
{
  "tier": "plus",
  "creditsRemaining": 7,
  "creditsResetAt": "2026-06-23T00:00:00Z",
  "subscriptionId": "sub_...",
  "gracePeriodUntil": null
}
```

### SecurityConfig update

Add `/billing/webhook` to the public endpoint list (alongside `/auth/**`):
```java
.requestMatchers("/billing/webhook").permitAll()
```

### Error handling

All Stripe API calls throw `StripeException`. Catch it in the service, wrap in a descriptive `RuntimeException`, and catch `Exception` (not `RuntimeException`) in the controller — per the Spring Security error dispatch pattern already documented in MEMORY.md.

---

## Session 2 — Frontend

### 1. Pricing modal

**File:** `Frontend/src/components/ui/UpgradeModal.jsx` (new)

Triggered from `PaidGate` when the "Upgrade" button is clicked. A simple dialog with:

- Plus plan card: $4.99/month, feature list (10 AI credits/month, storybook chapters, digital book, future print)
- "Upgrade to Plus" button → calls `POST /billing/checkout` → redirects `window.location.href = data.url`
- Loading state on the button while the API call completes
- Close button

Keep it simple — one plan, no comparison table for V1.

**Update `PaidGate.jsx`:**
- Replace the disabled "Coming Soon" button with an "Upgrade to Plus" button that opens `UpgradeModal`
- `UpgradeModal` needs `onClose` and `apiRequest` (or use the global `apiRequest` from `api.js`)

### 2. Upgrade success page

**File:** `Frontend/src/components/UpgradeSuccess.jsx` (new)

Route: `/upgrade-success?session_id=...`

On mount:
1. Call `GET /billing/status` to confirm the tier updated
2. Refresh the user object (`GET /auth/me`) so the rest of the app immediately sees `tier: 'plus'`
3. Show a confirmation message: "You're on Plus! 🎉 Your 10 monthly credits are ready."
4. Link back to Memories → Book

**Wire it up in `App.jsx` / router:**
- If using path-based routing: add a route for `/upgrade-success`
- If the app is fully SPA (single-page, no router): check `window.location.pathname` on mount and render `UpgradeSuccess` instead of the main app

### 3. Cancel / manage subscription

In account settings or profile (wherever the current user menu lives):
- Show current plan: "Plus · 7 credits remaining"
- "Manage Subscription" button → calls `GET /billing/portal` → `window.location.href = data.url`
- Only show this button if `user.tier !== 'free'`

### 4. Mobile / Capacitor redirect handling

Stripe redirects back to `APP_BASE_URL/upgrade-success`. On native mobile (iOS/Android via Capacitor), the `successUrl` must be a URL the app can intercept.

Options:
- **Universal links / App Links** — configure `cradlehq.app` as the associated domain; Stripe redirects to the web URL and iOS/Android opens the app. Requires Apple/Android app association files (`apple-app-site-association`, `assetlinks.json`).
- **Web fallback** — for V1, the Stripe checkout opens in a browser (not in-app WebView). The user upgrades in Safari/Chrome, then returns to the app. No special linking needed. Credits will be available on next app refresh.

**Recommendation for V1:** Web fallback. Don't add universal link complexity until mobile subscriptions are a meaningful conversion path. Add a note in the success UI: "Return to the CradleHQ app to start using your credits."

### 5. Grace period UI

If `user.tier === 'plus'` but `gracePeriodUntil` is set (from `/billing/status`), show a dismissible banner:
> "Your payment failed — please update your payment method to keep Plus access."
> [Update Payment Method] → billing portal

---

## Session 3 — Credit Management

### Monthly credit reset

AI credits reset on the billing anniversary. Two approaches:

**Option A — Webhook-driven reset (recommended):**
On `invoice.payment_succeeded` (fires on every successful monthly charge): set `ai_credits_remaining = 10`, update `credits_reset_at = NOW() + 30d`.

No cron job needed. Stripe drives the reset. Simple and accurate.

**Option B — Server-side cron:**
Check `credits_reset_at` on every API call that costs credits. If past, reset before processing.

Recommendation: Option A (webhook-driven). Already in the webhook handler table above.

### Credit display in UI

In the StorybookTab toolbar area (or the account/settings panel):
- Show: `"7 / 10 credits · resets Jun 23"`
- If 0 credits: `"0 credits remaining · resets Jun 23"` with a link to upgrade (for free users) or a note that it resets soon (for Plus users)

Currently `credits` is passed down from `CradleHq.jsx` via `user.ai_credits_remaining`. That field is already in `UserDto` and returned by `/auth/me` — no new backend work for display.

### Admin tooling (manual credit adjustments)

For handling support requests, add a protected admin endpoint:

```
POST /admin/users/{id}/credits
{ "amount": 5 }  // adds 5 credits
```

Gate with a role check (e.g., a hardcoded admin email list or an `is_admin` column) rather than a full RBAC system. Not needed for launch — defer to Session 3.

---

## Testing Without a Live Stripe Account

1. Create a free Stripe account at stripe.com — test mode is always available, no approval needed
2. Use Stripe's test card numbers: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (decline)
3. For webhooks locally: use the Stripe CLI (`stripe listen --forward-to localhost:3001/billing/webhook`) — this creates a local webhook tunnel and prints `STRIPE_WEBHOOK_SECRET`
4. Add test Stripe keys to `.env` — test keys start with `sk_test_` and `pk_test_`, safe to use freely
5. Create a Plus product + recurring price in the Stripe dashboard (test mode), copy the `price_...` ID to `STRIPE_PRICE_PLUS_MONTHLY`

---

## Files to Create / Modify

| File | Change |
|---|---|
| `Backend/db/migration/V32__add_stripe_to_users.sql` | New — stripe_customer_id, stripe_subscription_id, tier_expires_at, tier_grace_until |
| `Backend/build.gradle` | Add stripe-java dependency |
| `Backend/src/.../billing/BillingController.java` | New — 4 endpoints |
| `Backend/src/.../billing/BillingService.java` | New — Stripe API calls + DB updates |
| `Backend/src/.../billing/dto/CheckoutRequest.java` | New |
| `Backend/src/.../billing/dto/CheckoutResponse.java` | New |
| `Backend/src/.../billing/dto/BillingStatusResponse.java` | New |
| `Backend/src/.../config/SecurityConfig.java` | Add /billing/webhook to public endpoints |
| `Backend/src/main/resources/application.properties` | Add stripe.* config keys |
| `Backend/.env.example` | Add STRIPE_* env vars |
| `Frontend/src/components/ui/PaidGate.jsx` | Wire up UpgradeModal instead of disabled button |
| `Frontend/src/components/ui/UpgradeModal.jsx` | New — pricing dialog + checkout redirect |
| `Frontend/src/components/UpgradeSuccess.jsx` | New — post-checkout confirmation page |
| `Frontend/src/App.jsx` | Handle /upgrade-success route or path check |
| `Frontend/src/components/CradleHq.jsx` | Add "Manage Subscription" link; grace period banner |

---

## Rollout Order

1. **Backend (S1) in test mode** — deploy to prod with Stripe test keys, verify webhooks work
2. **Frontend (S2)** — pricing modal, success page, billing portal link
3. **End-to-end test** — full signup → checkout → upgrade success → generate chapter → credit deducted
4. **Switch to live Stripe keys** — update env vars on VPS, set `STRIPE_SECRET_KEY=sk_live_...`
5. **Announce** — remove "Coming Soon" label from any remaining surfaces

---

## Session Prompts

### S1 — Backend

```
Payments S1 — Stripe backend integration.
Plan: plans/payments/stripe-full-plan.md (Session 1 section)
Branch: payments-stripe (cut from main)

Decisions are locked in the plan — do not re-ask them.

Next migration is V32 (V31 is reserved for S5.2 chapter photos).
The tier column already exists from V23. Only add the new Stripe columns.

Order of work:
1. V32 migration (stripe_customer_id, stripe_subscription_id, tier_expires_at, tier_grace_until)
2. Add stripe-java to build.gradle + application.properties + .env.example
3. Create com.gotcherapp.api.billing package with BillingController + BillingService + 3 DTOs
4. Implement POST /billing/checkout
5. Implement POST /billing/webhook (handle 5 event types per the plan table)
6. Implement GET /billing/portal
7. Implement GET /billing/status
8. Add /billing/webhook to SecurityConfig public endpoints

Read stripe-full-plan.md fully before writing code.
Read SecurityConfig.java, application.properties, and build.gradle before touching them.
All Stripe calls must catch Exception (not RuntimeException) in the controller.
```

### S2 — Frontend

```
Payments S2 — Stripe frontend integration.
Plan: plans/payments/stripe-full-plan.md (Session 2 section)
Branch: payments-stripe (continue from S1 or cut from main after S1 merges)
Depends on: S1 backend endpoints live and reachable

Order of work:
1. UpgradeModal.jsx — pricing dialog, calls POST /billing/checkout, redirects on success
2. Update PaidGate.jsx — wire up UpgradeModal instead of disabled button
3. UpgradeSuccess.jsx — confirmation page, refreshes user object via GET /auth/me
4. App.jsx — handle /upgrade-success route
5. CradleHq.jsx — "Manage Subscription" button (GET /billing/portal redirect), grace period banner

Read stripe-full-plan.md fully before writing code.
Read PaidGate.jsx, CradleHq.jsx, App.jsx before touching them.
V1 mobile approach: web browser fallback (no universal links yet).
```
