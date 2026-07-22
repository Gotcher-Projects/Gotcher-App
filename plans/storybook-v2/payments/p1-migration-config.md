# Payments P1 — V47 migration + config plumbing

**Status:** ✅ **Complete** — implemented 2026-07-10. Flyway applied V47 (log: "now at version v47"),
app booted, `./gradlew test` green, schema objects confirmed via psql. Awaiting Michael's sign-off.
**Est:** ~1.5 hours · **Depends on:** P0 (SKUs + keys exist in a sandbox) · **Blocks:** P2
**Launch prompt:** `session-prompts.md` → P1

> **Build note (2026-07-10):** pinned `com.stripe:stripe-java:33.1.0` (exact stable) rather than the plan's
> `33.+` — Maven Central lists 33.2.0 only as alpha/beta and even tags a beta as `<release>`, so a dynamic
> range could pull a pre-release. Mirrored the six `stripe.*` env vars into `application.properties`,
> `.env.example` (already from P0), and `docker-compose.prod.yml`. Migration also carries an
> `idx_stripe_events_user` index (not in the plan's DDL — cheap, and the webhook/admin will query by user).

**Schema and config only — no Stripe API calls yet.** By the end the app boots, Flyway applies a new
migration, tests are green, and nothing about the running behaviour has changed. This is the boring,
load-bearing session that lets every later one assume the columns and keys already exist.

---

## What you're actually doing, in one paragraph

We're carving out the three pieces of durable state the payment flow needs — a Stripe customer id per
user, a "this book is paid for" mark per book, and a ledger of which Stripe events we've already acted on
— plus wiring the six env values from P0 into Spring so later sessions can read them. No endpoints, no
webhook, no charging. If you find yourself calling the Stripe SDK this session, you've drifted into P2.

---

## ⚠️ The migration number is V47 — confirm it

`sv2-grant` took **V46** (`V46__add_free_grant_at.sql`) on 2026-07-09. This number has drifted three
times. **Before writing anything**, run:

```sh
ls Backend/db/migration/
```

and confirm the next free number really is 47. If someone landed another migration since, use the real
next number and tell me.

---

## Part 1 — `V47__add_stripe_billing.sql`

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

**⚠️ Do NOT add** `stripe_subscription_id`, `tier_expires_at`, or `tier_grace_until`. There is no
subscription — this is the single most common way this plan gets built wrong. `share_unlocked_at` being
separate from the share *token* is deliberate: P3 sets the entitlement; the token (sv2-s13) is a separate,
revocable, regenerable thing, and regenerating a link must never re-charge.

---

## Part 2 — Stripe SDK + config

**`Backend/build.gradle`:**

```
implementation 'com.stripe:stripe-java:33.+'
```

**⚠️ Version 33, not 25.** In Gradle `25.+` resolves *within* major 25 — an unmaintained major. Latest is
**33.0.0** (pins API version `2026-04-22.dahlia`). `sv2-onboarding-explainers.md` says 32.x and is also
stale. **Check Maven Central before writing** — pin the current major.

**`application.properties`** — one price per SKU, no subscription price:

```
stripe.secret.key=${STRIPE_SECRET_KEY}
stripe.webhook.secret=${STRIPE_WEBHOOK_SECRET}
stripe.price.credits50=${STRIPE_PRICE_CREDITS_50}
stripe.price.credits125=${STRIPE_PRICE_CREDITS_125}
stripe.price.bundleShare150=${STRIPE_PRICE_BUNDLE_SHARE_150}
stripe.price.shareOnly=${STRIPE_PRICE_SHARE_ONLY}
```

Mirror the six keys into **`.env.example`** (placeholders only — `sk_test_…`, `whsec_…`, four `price_…`;
P0 already did this, confirm it's current) and into **`docker-compose.prod.yml`** so production can inject
them later.

> **Why metadata over a server map:** the `sku` + `credits` metadata already lives on each Stripe price
> (P0). The webhook (P3) reads the grant amount *from the event*, not from a hardcoded Java lookup that
> silently drifts the day someone edits a price in the dashboard. Nothing to build here — just don't
> introduce a competing source of truth in config.

---

## Part 3 — Housekeeping (small, but do it now)

`AiAssistService.java:13` still carries a stale comment referencing "20 credits for $2". **That SKU was
dropped** — at $2 Stripe's flat $0.30 makes the fee ~17.9% of gross. Update the comment to reflect the
four real SKUs so the next reader isn't misled.

---

## Done when

- [ ] `ls Backend/db/migration/` confirmed the number; `V47__add_stripe_billing.sql` written.
- [ ] App boots; **Flyway applies V47** cleanly against a fresh and an existing DB.
- [ ] `cd Backend && ./gradlew test` is **green**.
- [ ] The six `stripe.*` keys resolve from env (app starts with them blank — no NPE at boot).
- [ ] **No behaviour change** — no new endpoint, no Stripe call, nothing user-visible.

## Not this session

Any Stripe SDK call · the checkout endpoint (P2) · the webhook (P3) · `SecurityConfig` changes for
`/billing/webhook` (P3) · the Radar rule (P8). If you're touching the network, you've gone too far.

## Closing note

Record the **actual** time this took (per the re-slice checkpoint's habit fix). If a 1.5h "schema + config"
session ran long, that's a signal the cap is optimistic and every downstream estimate needs the same factor.
