# Payments P3 — Webhook + idempotency ledger ⚠️ THE ONE THAT MATTERS

**Status:** Not started
**Est:** ~2–4 hours · **Depends on:** P2 · **Blocks:** P4, P8
**Launch prompt:** `session-prompts.md` → P3
**Read first:** `stripe-primer.md` §3–§4 **and** `stripe-full-plan.md` Session 1 → webhook. Both.

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
