# Payments — Stripe One-Time Checkout (canonical plan)

**Status: Not started.**
**Rewritten from scratch 2026-07-09.** The previous version was written around a $4.99/mo "Plus"
subscription and had accumulated a MODEL CHANGE banner contradicting its own later sections and session
prompts. It has been replaced, not patched. The subscription-era files are in
`../deprecated/payments-s{0,1,2}-*.md` — **history only, do not build from them.**

**Read `stripe-primer.md` first.** It is the *why*: the object model, the fulfil-on-webhook rule, the
Spring webhook traps, tax, and the app-store analysis. This file is the *what*.

**Next migration: V47.** `V46__add_free_grant_at.sql` was taken by `sv2-grant` on 2026-07-09. Run
`ls Backend/db/migration/` before writing — this number has now drifted three times.

---

## What we sell

Four one-time SKUs (`mode: 'payment'`). No subscription, no tiers, nothing recurring. Prices may rise;
**nothing outside the Stripe price object hardcodes an amount.**

| SKU | Price | Grants | Scope |
|---|---|---|---|
| `credits_50` | $5 | 50 credits | account |
| `credits_125` | $10 | 125 credits | account |
| **`bundle_share_150`** ⭐ | **$15** | **150 credits + unlock 1 book** | account **+ book** |
| `share_only` | $10 | unlock 1 book | book |

The share unlock alone is $10, so the bundle's 150 credits effectively cost $5 (~3.3¢ each — the
cheapest rate). `share_only` stays as the honest option for someone who wants zero AI.

Printed books are a **separate, variable-amount** checkout built in `sv2-s12`, not part of this track.

### Two scopes in one purchase — the structural consequence

Credits live on `users.ai_credits_remaining` (**account-scoped**). The share unlock lives on **one book**
(`books.share_unlocked_at`). The bundle grants both. Therefore:

- `POST /billing/checkout` takes an **optional `bookId`** — *required* for `share_only` and
  `bundle_share_150`, *rejected* for the credit-only packs.
- The webhook applies the credit grant to the **user** and the unlock to that **specific book**.
- The idempotency ledger records **what was granted and to which book**, not just a credit count.
- The purchase UI must **name the book being unlocked.** A user with two books unlocking the wrong one
  is the refund request we'd be inventing for ourselves — and Stripe keeps its fee on a refund.

---

## Locked decisions — do not re-litigate in a build session

| Question | Decision |
|---|---|
| Processor | **Stripe** |
| Checkout flow | **Stripe-hosted** redirect. No Stripe.js, no `pk_...` key, no card data in our frontend. |
| What we sell | **Four one-time SKUs** (above). Revised 2026-07-09; was a $4.99/mo subscription. |
| Subscription / Plus / Pro tier | ❌ **Dropped** (2026-07-09) |
| Trial · lapse · grace · cancellation · Billing Portal | **N/A** — nothing recurring exists to cancel |
| Monthly credit reset | ❌ **None.** Credits are purchased, not allotted. They don't expire. |
| AI credit gating | **Balance only** (`ai_credits_remaining >= 1`), 1 credit/field. Never `tier`. Already shipped in `sv2-s10`. |
| Print gating | **None** — pay-per-order |
| Share gating | **$10 one-time, per book.** See `../sv2-s13-share-link.md`. |
| Geography | **US cards only** for v1 — Stripe Radar rule on card issuing country. Built in S1. |
| Mobile | **Web-only purchases, no IAP.** All purchase UI behind `Capacitor.isNativePlatform()`. |
| Lulu | We collect via Stripe; pay Lulu wholesale on a company card. Lulu checkout is external. |
| Pricing surface | **Modal**, triggered from the `onGetCredits` seam. A `/pricing` page needs a router (see below). |

**`users.tier` is vestigial.** Nothing reads it. Keep the column, build nothing on it.

---

## Ground truth — verified against the codebase 2026-07-09

Facts a build session would otherwise get wrong. Re-verify before trusting.

- ✅ `users.tier`, `users.ai_credits_remaining`, `users.credits_reset_at` all exist (V23, live in prod).
  `credits_reset_at` goes **unused** — there is no reset job. Leave it.
- ✅ `users.free_grant_at` exists as of **V46** (`sv2-grant`). The Stripe migration is **V47**.
- ❌ **`PaidGate.jsx` does not exist.** It was deleted as dead code by
  `plans/storybook-and-pregnancy-review-fixes/s1-frontend-dead-code.md` (2026-06-19); its prior
  implementation was preserved in what is now `../deprecated/payments-s2-upgrade-flow.md`. **S2 builds
  the purchase modal from scratch.** Do not try to extend a component that isn't there.
- ❌ **StorybookTab no longer reads `tier` or credits.** Nothing in it is gated.
- ✅ **The integration seam is `Frontend/src/contexts/AiCreditsContext.jsx`** (`sv2-s10b`). It exposes
  `credits`, `setCredits`, and an **`onGetCredits` callback deliberately left `undefined`** until
  Payments ships. Wiring it is S2's actual job. Today the out-of-credits state is informational.
- ✅ `AiAssistService` already **refunds a credit on a failed Claude call** (`AiAssistService.java:88`).
- ⚠️ **`books` has no `user_id`.** Ownership is `books.baby_profile_id → baby_profiles.user_id`. The
  `bookId` authorization check is a **two-hop join**, not a column compare. Existing scoping queries key
  on `baby_profile_id` (`BookService.java`, `StorybookService.java:215`).
- ⚠️ **V25 `book_share_tokens` is unusable as-is.** It keys `baby_profile_id ... UNIQUE` — one token per
  *baby*, written before `books` existed (V42). It cannot express a per-book unlock. `sv2-s13` decides
  whether to reshape or replace it; **this track only adds the `books.share_unlocked_at` entitlement.**
- ⚠️ **There is no router.** No `react-router` in `Frontend/package.json`; `App.jsx` is an auth gate.
  The post-checkout return URL needs a decision — see S2.
- ⚠️ **`/admin/**` is already `permitAll`** in `SecurityConfig` (gated by an `ADMIN_SECRET` header, not
  JWT). S3's credit-adjustment endpoint would inherit that posture. Look at it deliberately — it mints
  credits.
- 🧹 `AiAssistService.java:13` still comments "20 credits for $2". That SKU was dropped (at $2 Stripe's
  cut is 17.9%). Fix the comment when S1 lands.

---

## The rule that governs the whole track

> **Fulfil on the webhook. Never on the redirect.**

`successUrl` is just where the browser lands; arriving there proves nothing. If the success page grants
credits, anyone who visits it grants themselves credits. Credits and unlocks are granted in **exactly
one place** — the `checkout.session.completed` handler, behind the idempotency ledger.

Consequence for the UI: the success page **must not assume the grant has landed.** The webhook is not
ordered relative to the redirect. Show "Confirming your purchase…", poll `GET /auth/me` until the
balance changes, degrade gracefully after a few seconds.

Full reasoning, plus the Spring-specific webhook traps, in `stripe-primer.md` §3–§4.

---

## Session 1 — Backend

### 1. Migration `V47__add_stripe_billing.sql`

```sql
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(100);

-- Entitlement: "this book is paid for." Distinct from the revocable share TOKEN —
-- regenerating a link must NOT re-charge, so the unlock outlives any single token.
ALTER TABLE books ADD COLUMN share_unlocked_at TIMESTAMPTZ;

-- Idempotency ledger: one row per successfully-applied Stripe event.
-- The webhook grants ONLY if the INSERT wins (ON CONFLICT DO NOTHING → 0 rows → skip).
-- A bundle grants BOTH: credits > 0 AND unlocked_book_id IS NOT NULL.
CREATE TABLE stripe_events_applied (
  event_id         VARCHAR(100) PRIMARY KEY,   -- Stripe's evt_... id
  user_id          BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sku              VARCHAR(40) NOT NULL,       -- credits_50 | credits_125 | bundle_share_150 | share_only
  credits          INT         NOT NULL DEFAULT 0,
  unlocked_book_id BIGINT      REFERENCES books(id) ON DELETE SET NULL,  -- null for credit packs
  applied_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Do NOT add** `stripe_subscription_id`, `tier_expires_at`, or `tier_grace_until`. There is no
subscription. This is the single most common way this plan gets built wrong.

### 2. Stripe SDK + config

`Backend/build.gradle`: `implementation 'com.stripe:stripe-java:25.+'`

`application.properties` — one price per SKU, no subscription price:
```
stripe.secret.key=${STRIPE_SECRET_KEY}
stripe.webhook.secret=${STRIPE_WEBHOOK_SECRET}
stripe.price.credits50=${STRIPE_PRICE_CREDITS_50}
stripe.price.credits125=${STRIPE_PRICE_CREDITS_125}
stripe.price.bundleShare150=${STRIPE_PRICE_BUNDLE_SHARE_150}
stripe.price.shareOnly=${STRIPE_PRICE_SHARE_ONLY}
```
Mirror into `.env.example` (`sk_test_…`, `whsec_…`, four `price_…`) and `docker-compose.prod.yml`.

Put `sku` and `credits` in **each Stripe price's metadata** so the webhook reads the grant from the
event rather than a hardcoded server map that silently drifts from the dashboard.

### 3. `com.gotcherapp.api.billing`

`BillingController` · `BillingService` · `dto/CheckoutRequest` · `dto/CheckoutResponse`

#### `POST /billing/checkout` — JWT-protected

Request `{ "sku": "bundle_share_150", "bookId": 42 }`.

1. Reject an unknown `sku`.
2. `bookId` **required** for `share_only` / `bundle_share_150`, **rejected** for credit packs.
3. **Validate the book belongs to the caller** — join through `baby_profiles.user_id`. Skip this and a
   user pays $10 to unlock a stranger's book. This is an IDOR, not an edge case.
4. If `users.stripe_customer_id` is null, `Customer.create()` and store it.
5. `Session.create()` with `mode: 'payment'`, the price ID for the SKU, `clientReferenceId = userId`,
   `metadata = { sku, bookId }`, a `successUrl` carrying `{CHECKOUT_SESSION_ID}`, and a `cancelUrl`.
6. Send an `Idempotency-Key` so a double-clicked Buy button can't create two sessions.

Response `{ "url": "https://checkout.stripe.com/..." }`.

#### `POST /billing/webhook` — public, signature-verified

```java
@PostMapping(value = "/webhook", consumes = "application/json")
public ResponseEntity<String> webhook(@RequestBody String payload,
                                      @RequestHeader("Stripe-Signature") String sigHeader) { ... }
```

**Take the body as a raw `String`.** Signature verification hashes the exact request bytes; if Spring
deserializes to a DTO, the re-serialized JSON won't match and verification fails for reasons that look
like nothing at all.

One event matters: **`checkout.session.completed`.** Resolve the user from `clientReferenceId` and the
SKU/`bookId` from metadata, then in **one transaction**:

1. `INSERT INTO stripe_events_applied (...) ON CONFLICT (event_id) DO NOTHING`
2. **Only if that insert affected 1 row**, apply the grants:
   - `UPDATE users SET ai_credits_remaining = ai_credits_remaining + :credits` when `credits > 0`
   - `UPDATE books SET share_unlocked_at = NOW() WHERE id = :bookId AND share_unlocked_at IS NULL`

Ignore-and-200 every other event type. No `customer.subscription.*`, no `invoice.*` — we never create
subscriptions, so Stripe won't send them.

> **Why the ledger.** Stripe retries until it gets a 2xx and can deliver the same event more than once
> even *after* one. Without the `event_id` primary key, a retry silently grants a second pack of credits
> nobody paid for. The old subscription plan got away without this because setting `tier='plus'` twice is
> harmless. **Incrementing a balance twice is not.** This is the most important correctness detail in
> the track.

**⚠️ The 401 trap costs real money here.** Per `CLAUDE.md`, an uncaught `RuntimeException` in a
controller re-dispatches to `/error` unauthenticated and surfaces as **401, not 500**. Stripe reads any
non-2xx as failure and retries with backoff **for up to ~3 days**. One stray NPE becomes: 401 → retry →
NPE → retry, for days, while a paying customer receives nothing.

> Catch `Exception`. Log it. Return **200** once the event is durably recorded. Reconcile out of band.
> Return 4xx **only** for a genuine signature failure.

#### ❌ Do not build `GET /billing/portal`

The Stripe Billing Portal manages subscriptions. There are none.

#### `GET /billing/status` — optional, probably skip

Its old response was entirely subscription fields (`tier`, `subscriptionId`, `gracePeriodUntil`). The
credit balance already reaches the frontend via `user.ai_credits_remaining` on `/auth/me`, which
`AiCreditsContext` already reads. **Build this only if something needs it that `/auth/me` can't answer.**

### 4. `SecurityConfig`

Add `/billing/webhook` to the existing `permitAll` matcher list (currently `/health`, `/auth/*`,
`/admin/**`, `/book/public/**`). Stripe doesn't send our JWT — **the signature verification *is* the
authentication.**

### 5. US-cards-only Radar rule

Block payments whose card issuing country is not `US`. Rationale in `stripe-primer.md` §6.

- **Verify the rule surface in the dashboard first.** The `:card_country:` syntax is recalled from
  memory, not read from current docs.
- **A blocked card surfaces as a decline the customer won't understand.** Detect it and show "We
  currently only sell in the US", not a raw Stripe error. This is a real user-facing state.
- Restricts who can **pay**, not who can **use** the app.

### 6. Deploy surface

Caddy must proxy `/billing/webhook` to `:3001` with the **`Stripe-Signature` header intact**. A proxy
that rewrites or drops headers produces the same silent verification failure as body-parsing.

---

## Session 2 — Frontend

### 1. Purchase modal — built from scratch

`PaidGate.jsx` does not exist. Build a new modal showing the **four real SKUs**, triggered from the
`onGetCredits` callback in `AiCreditsContext` (fired when a user clicks ✨ at zero credits).

- No "$4.99/month" plan card. No comparison table. No tiers.
- The share SKUs must **name the book being unlocked**.
- Button → `POST /billing/checkout` → `window.location.href = data.url`. Loading state while in flight.
- Handle the US-only decline with a human message.

### 2. Return-from-checkout — **decide the routing first**

There is **no router**. `App.jsx` is an auth gate; `react-router` is not a dependency. Two options, and
this is a decision, not a check:

- **Add `react-router`** — cleaner, and `sv2-s13` needs `/book/{token}` anyway. Decide once, together.
- **Branch on `window.location.pathname`** before the auth gate — no dependency, but a second ad-hoc
  route later gets ugly.

Whatever the route, the success screen **polls `GET /auth/me` until the balance changes** rather than
trusting the redirect (see the rule above). Then refresh the user object so the app sees the credits.

### 3. Native gate

Wrap **all** purchase UI in `Capacitor.isNativePlatform()`. On native, leave
`AiCreditsContext.onGetCredits` **undefined** — exactly as `sv2-s10b` built it — so the out-of-credits
state stays informational, never a call to action. One seam, both platforms.

The **printed book button is the opposite case** and may ship in the app on day one: it's a physical
good, and Apple's 3.1.3(e) *requires* it be sold outside IAP. See `stripe-primer.md` §9.

### 4. Mobile redirect

V1: web fallback. Stripe checkout opens in the system browser; the user pays and returns to the app;
credits appear on next refresh. No universal links until mobile is a real conversion path.

### ❌ Do not build

"Manage Subscription", grace-period banners, downgrade-on-lapse, a cancellation flow. Nothing recurring
exists.

---

## Session 3 — Credit management (small)

**No reset job.** Credits are purchased, not allotted; nothing refills them on a schedule.

- **Balance display:** `"7 credits remaining"` — no `/ 10`, no "resets on…". At zero: `"0 credits
  remaining"` + "Get more credits" → the modal. `credits` already reaches the UI via `AiCreditsContext`;
  no new backend work for display.
- **Admin adjustment** for support requests: `POST /admin/users/{id}/credits  { "amount": 5 }`.
  ⚠️ `/admin/**` is `permitAll` and relies on the `ADMIN_SECRET` header. Decide deliberately whether
  that is sufficient for an endpoint that **mints credits**.

---

## Out-of-code prerequisites

These are the real schedule risk. Nothing here blocks the **build** — every SKU is sold on the web and
S1/S2 are fully buildable in test mode.

**Blocks the live launch — start now (multi-week):**
- [ ] LLC Stripe account activation: business details, EIN, bank account, owner identity verification.
- [ ] A refund posture, especially "I unlocked the wrong book." Stripe keeps its fee on refunds; a
      chargeback costs ~$15 *on top of* the lost sale. Making the book name unmissable at checkout is
      cheaper than any refund flow.
- [ ] **Ask an accountant about tax.** Digital goods are taxable in many US states; EU/UK VAT on digital
      services applies from the first sale with no threshold. Stripe Tax *collects* but does not
      *register or remit* — that lands on the LLC. No model is qualified to advise here. The Radar rule
      narrows this; **it does not close it** (see `stripe-primer.md` §9's US-storefront ≠ US-customers box).

**Blocks S1's first line of code:**
- [ ] Four Products/Prices created **in test mode**, each with `sku` + `credits` in price metadata.

**Blocks app submission, not the build:**
- [ ] Enroll in Google Play's US external-offers/linking program (required, not automatic).
- [ ] iOS is separately gated: per `project_apple_developer`, Michael is not the Apple account owner and
      cannot create Distribution certificates.

---

## Rollout order

1. **S1 backend in test mode** — deploy to prod with **test** keys, verify webhooks land.
2. **S2 frontend** — modal, redirect, success screen, native gate.
3. **End-to-end in test:** signup → checkout (`4242…`) → success screen polls → credits appear → ✨
   spends one. Exercise the 3-D Secure card (`4000 0025 0000 3155`) once; it changes redirect timing.
   Exercise a decline (`4000 0000 0000 9995`).
4. **Replay a webhook** (`stripe trigger` twice, or resend from the dashboard) and confirm the ledger
   blocks the second grant. **This is the test that matters.**
5. **Switch to live keys** on the VPS. Test and live have **different price IDs** — all six env vars
   change, not just the secret key.
6. Hardening pass: `sv2-s14`.

---

## Session prompts

Live in `session-prompts.md` alongside this file. The prompts in
`../deprecated/payments-s{0,1,2}-*.md` describe the dead subscription — **do not run them.**
