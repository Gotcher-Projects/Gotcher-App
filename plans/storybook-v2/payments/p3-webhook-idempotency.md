# Payments P3 — Webhook + idempotency ledger ⚠️ THE ONE THAT MATTERS

**Status:** Needs Verification — implemented 2026-07-11. Signature verify, real-metadata grant, replay
no-op, book unlock, and unknown-type ignore all verified live. Awaiting Michael's sign-off.
**Est:** ~2–4 hours · **Depends on:** P2 · **Blocks:** P4, P8
**Launch prompt:** `session-prompts.md` → P3
**Read first:** `stripe-primer.md` §3–§4 **and** `stripe-full-plan.md` Session 1 → webhook. Both.

> **Build notes (2026-07-11):** `GrantService` (@Transactional, separate bean — dodges the self-invocation
> proxy trap), `BillingWebhookService` (verify + parse + `Session.retrieve(expand line_items.data.price)`
> to read `credits` from Price metadata, then delegate), `BillingWebhookController` (raw `@RequestBody
> String`). `/billing/webhook` added to SecurityConfig permitAll. Added `Backend/stripe-listen.sh` helper.
> Design decisions (from the chat): credits from Price metadata; `event_id` dedup; @Transactional grant
> bean; malformed metadata → log + record + 200 + grant 0.
>
> **Two judgment calls made during build (flag if you disagree):**
> 1. **Unexpected processing error → HTTP 500** (explicitly caught, not letting it become a 401), so a
>    transient failure gets retried (grants are idempotent). This is a slight deviation from the plan's
>    literal "4xx only for signature" — I judged silently 200-dropping a paid event to be worse.
> 2. **No `payment_status == "paid"` guard.** We're card-only (synchronous), so
>    `checkout.session.completed` ⇒ paid. If async payment methods are ever enabled, add the guard +
>    handle `checkout.session.async_payment_succeeded` (candidate for sv2-s14).
>
> **Verified live (demo user 2, baseline 802 credits; side-effects reverted after):** bad signature→400;
> credits_50 signed event→200, credits 802→852 (read from real Price metadata); **replay same evt_→200,
> 852→852 (no second grant)**; share_only+book5→200, book5.share_unlocked set + credits unchanged (0);
> unknown event type→200 ignore. Ledger held exactly the applied rows; CLI `whsec_` confirmed == `.env`.
> Verified by hand-signed events against real sessions created by our own /billing/checkout — a real-card
> browser payment through the hosted page is P4's job.

**This is the single most important correctness surface in the whole product.** A bug here either hands out
credits nobody paid for, or takes money and grants nothing. **Be rested before you start this one.** Don't
run it at the tail of a long day stacked behind P2.

---

## What you're actually doing, in one paragraph

Stripe phones our server to say "that checkout completed, they paid." That phone call — **not** the browser
landing on the success page — is the only thing we trust, because anyone can type the success URL. This
session builds the endpoint that answers that call: verify it's really Stripe, record the event id so a
retry can't double-grant, then add the credits and/or mark the book unlocked. Everything else in the track
is plumbing around this one method.

---

## The endpoint

```java
@PostMapping(value = "/webhook", consumes = "application/json")
public ResponseEntity<String> webhook(@RequestBody String payload,
                                      @RequestHeader("Stripe-Signature") String sigHeader) { ... }
```

Add `/billing/webhook` to the existing `permitAll` matcher in `SecurityConfig` (alongside `/health`,
`/auth/*`, `/admin/**`, `/book/public/**`). **Stripe sends no JWT — the signature verification *is* the
authentication.**

## The four landmines (each one has cost you an hour if ignored)

**⚠️ 1. Take the body as a raw `String`.** Signature verification hashes the **exact request bytes**. Let
Spring deserialize to a DTO and the re-serialized JSON won't match — verification fails for reasons that
look like *nothing at all*, no useful error.

**⚠️ 2. Idempotent or nothing.** Stripe retries until it gets a 2xx, and can redeliver the same event even
*after* a success. In **one transaction**:
1. `INSERT INTO stripe_events_applied (...) ON CONFLICT (event_id) DO NOTHING`
2. Apply grants **only if that insert affected 1 row**:
   - `UPDATE users SET ai_credits_remaining = ai_credits_remaining + :credits` when `credits > 0`
   - `UPDATE books SET share_unlocked_at = NOW() WHERE id = :bookId AND share_unlocked_at IS NULL`

   > Setting `tier='plus'` twice was harmless — that's why the old subscription plan skipped this.
   > **Incrementing a balance twice is not.** The `event_id` primary key is the whole defence.

**⚠️ 3. Catch `Exception`. Return 200 once the event is durably recorded.** An uncaught `RuntimeException`
→ `/error` → **401**, which Stripe reads as failure and **retries with backoff for ~3 days** while a paying
customer gets nothing. Log, reconcile out of band, return 200. Return **4xx only** for a genuine signature
failure.

**⚠️ 4. Fulfil here, NEVER on the redirect.** The `successUrl` proves nothing — anyone can visit it. If
credits are ever granted on the success page, anyone can mint them (this is P8's cardinal rule too).

## The one event that matters

**`checkout.session.completed`.** Resolve the user from `clientReferenceId`; read `sku` / `bookId` /
`credits` from metadata. Grant credits to the user; set `books.share_unlocked_at` for the named book.
**Ignore-and-200 every other event type** — no `customer.subscription.*`, no `invoice.*`; we never create
subscriptions, so Stripe won't send them, but ignore them gracefully regardless.

---

## Verify — the replay test IS the point of this session

1. `stripe listen --forward-to localhost:3001/billing/webhook` running (from P0).
2. `stripe trigger checkout.session.completed` → credits/unlock **granted**.
3. **Fire the SAME event twice** (trigger again, or "Resend" from the dashboard events log) → the **second
   must NOT grant.** If the balance moves twice, the ledger is wrong and nothing else matters.

## Done when

- [ ] Signature verification passes on a real CLI-forwarded event and fails on a tampered one.
- [ ] A first `checkout.session.completed` grants exactly once (credits and/or book unlock, per SKU).
- [ ] **A replayed event grants zero additional times.**
- [ ] Every non-2xx path is a genuine signature failure; everything else returns 200.
- [ ] `/billing/webhook` is `permitAll`; no JWT required.

## Not this session

Production endpoint registration / the prod `whsec_` (P4) · Caddy header passthrough (P4) · decline/3-DS
card exercises (P4) · the success screen (P8). Today is the local, CLI-forwarded happy path **plus the
replay test** — nothing production-facing.

## Closing note

Record the actual duration. If P3 spilled, that's the most important data point in the track — this is the
session everything else trusts. A rushed P3 is worse than a slow one.
