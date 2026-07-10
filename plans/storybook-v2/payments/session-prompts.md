# Payments — Session Prompts

**Rewritten 2026-07-09.** The previous prompts told a session to build a $4.99/mo subscription:
`stripe_subscription_id`, `tier_expires_at`, the Billing Portal, "Manage Subscription", a Plus-vs-Pro
comparison modal, and a `PaidGate` component that no longer exists. **All of that is dead.** The old
prompts are preserved in `../deprecated/payments-s{0,1,2}-*.md`. Do not run them.

There is **no S0** — the planning session already happened; its decisions are locked in
`stripe-full-plan.md` §"Locked decisions".

---

## S1 — Stripe backend

```
Payments S1 — Stripe backend. One-time checkout + idempotent webhook.
Canonical plan: plans/storybook-v2/payments/stripe-full-plan.md
Read plans/storybook-v2/payments/stripe-primer.md FIRST — it's the why behind every trap below.
Branch: payments-stripe (cut from main)

Decisions are locked in the plan. Do not re-ask them. In particular there is NO SUBSCRIPTION:
do not create stripe_subscription_id, tier_expires_at, tier_grace_until, GET /billing/portal,
a monthly credit reset, or a Pro tier. `users.tier` is vestigial — nothing reads it.

⚠️ Migration is V47, not V46. sv2-grant took V46 (free_grant_at) on 2026-07-09.
   Run `ls Backend/db/migration/` and confirm before writing. This number has drifted three times.

Order of work:
1. V47 migration — users.stripe_customer_id · books.share_unlocked_at · stripe_events_applied ledger
2. stripe-java in build.gradle · six stripe.* keys in application.properties · .env.example · prod compose
3. com.gotcherapp.api.billing — BillingController, BillingService, CheckoutRequest, CheckoutResponse
4. POST /billing/checkout  (mode:'payment', sku + optional bookId, Idempotency-Key header)
5. POST /billing/webhook   (raw @RequestBody String, signature-verified)
6. /billing/webhook → SecurityConfig permitAll
7. Stripe Radar rule: block non-US card issuing countries

⚠️ THE WEBHOOK MUST BE IDEMPOTENT. Stripe retries until it gets a 2xx, and can redeliver even after
   one. INSERT the evt_ id first (ON CONFLICT DO NOTHING); grant ONLY if that insert won. One
   transaction. A double-grant hands out credits nobody paid for.
⚠️ Take the webhook body as `@RequestBody String`. Signature verification hashes the exact raw bytes —
   deserializing to a DTO breaks it in a way that looks like nothing at all.
⚠️ CATCH `Exception` IN THE CONTROLLER. An uncaught RuntimeException re-dispatches to /error
   unauthenticated → 401 (see CLAUDE.md) → Stripe retries for ~3 DAYS while the customer gets nothing.
   Return 200 once the event is recorded. Return 4xx ONLY for a genuine signature failure.
⚠️ IDOR: `books` has NO user_id. Ownership is books.baby_profile_id → baby_profiles.user_id — a two-hop
   join. Validate bookId belongs to the caller before creating a share checkout, or a user pays $10 to
   unlock a stranger's book.
⚠️ Fulfil on the WEBHOOK, never on the redirect. successUrl proves nothing.

Put `sku` + `credits` in each Stripe price's metadata; read the grant from the event, not a server map.
Verify the Radar rule syntax in the dashboard — do not trust recalled `:card_country:` syntax.
Also fix the stale "20 credits for $2" comment at AiAssistService.java:13 — that SKU was dropped.

Read SecurityConfig.java, application.properties, and build.gradle before touching them.
Test mode throughout. Live keys are a later, separate step (different price IDs — all six env vars).
```

---

## S2 — Frontend purchase flow

```
Payments S2 — purchase modal, checkout redirect, success screen, native gate.
Canonical plan: plans/storybook-v2/payments/stripe-full-plan.md (Session 2)
Branch: payments-stripe (continue from S1)
Depends on: S1 endpoints live and reachable.

⚠️ PaidGate.jsx DOES NOT EXIST — it was deleted as dead code in 2026-06-19's review-fixes pass. Build
   the modal FRESH. Any plan text telling you to "update PaidGate" is from the deprecated subscription
   plan. The real seam is the `onGetCredits` callback in Frontend/src/contexts/AiCreditsContext.jsx,
   left undefined on purpose by sv2-s10b.

⚠️ THE APP HAS NO ROUTER. No react-router in package.json; App.jsx is an auth gate. The post-checkout
   return URL needs one. DECIDE, don't check: add react-router (sv2-s13 needs /book/{token} too, so
   decide once for both), or branch on window.location.pathname before the gate.

⚠️ The success screen must NOT assume the purchase landed. The webhook is not ordered relative to the
   redirect. Show "Confirming your purchase…", poll GET /auth/me until the balance changes, degrade
   gracefully after a few seconds. Granting on the success page = free credits for anyone who visits it.

Order of work:
1. Purchase modal — the FOUR real SKUs ($5/50cr · $10/125cr · $15/150cr+share ⭐ · $10/share-only).
   No $4.99/mo card, no tier comparison. Share SKUs must NAME the book being unlocked.
2. POST /billing/checkout → window.location.href = data.url. Loading state on the button.
3. Handle the US-only Radar decline: "We currently only sell in the US", not a raw Stripe error.
4. Success screen (per the routing decision) → polls /auth/me → refreshes the user object.
5. Gate ALL purchase UI behind Capacitor.isNativePlatform(). On native, leave onGetCredits UNDEFINED
   so the out-of-credits state stays informational, never a call to action.

DO NOT BUILD: "Manage Subscription", grace-period banner, cancellation flow, downgrade-on-lapse.
The printed-book button is the opposite case — physical good, Apple REQUIRES non-IAP, ships in-app fine.
Mobile redirect for V1 is the plain web fallback. No universal links.
```

---

## S3 — Credit management (small)

```
Payments S3 — balance display + admin credit adjustment.
Canonical plan: plans/storybook-v2/payments/stripe-full-plan.md (Session 3)

NO monthly reset job. Credits are purchased, not allotted — nothing refills them on a schedule.
`credits_reset_at` (V23) stays unused. This is why S3 is small.

1. Balance display: "7 credits remaining" — no "/ 10", no "resets on…". At zero, "Get more credits"
   opens the S2 modal. credits already reach the UI via AiCreditsContext; no new backend for display.
2. POST /admin/users/{id}/credits  { "amount": 5 }

⚠️ /admin/** is already permitAll in SecurityConfig, gated only by an ADMIN_SECRET header. Decide
   deliberately whether that is enough for an endpoint that MINTS CREDITS. Don't just inherit it.
```

---

## Verification (before calling any of this Complete)

The end-to-end that matters, in Stripe **test** mode:

1. Signup → checkout with `4242 4242 4242 4242` → success screen polls → credits appear → ✨ spends one.
2. `4000 0025 0000 3155` — forces a 3-D Secure challenge, changes redirect timing. Exercise once.
3. `4000 0000 0000 9995` — decline. Should not grant, should not look like a crash.
4. **Replay a webhook** (`stripe trigger` twice, or resend from the dashboard). The ledger must block the
   second grant. **This is the test that matters** — everything else is a happy path.
5. A non-US test card → the Radar block → the human-readable message, not a raw Stripe error.

Local webhook forwarding prints a `whsec_` that is **different** from production's:
```sh
stripe listen --forward-to localhost:3001/billing/webhook
```
