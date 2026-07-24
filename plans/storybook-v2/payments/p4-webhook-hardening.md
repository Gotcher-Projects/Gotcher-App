# Payments P4 — Webhook hardening (LOCAL ONLY)

**Status:** ✅ **Complete** — Bucket A (11 automated tests, green) + Bucket B (all real-card flows run
& observed live, 2026-07-11) both done. Awaiting Michael's sign-off to mark Complete.
**Est:** ~1.5 hours · **Depends on:** P3 · **Blocks:** nothing
**Launch prompt:** `session-prompts.md` → P4
**Read first:** `stripe-primer.md` §4, §8

P3 proved the webhook against hand-signed events. P4 hardens it two ways that stay **entirely local**:
automated regression tests, and **real cards paid through Stripe's hosted page** in the sandbox.

> **⚠️ No production in this session — deferred to P12 (decided 2026-07-11, Michael).** All prod-touching
> work (registering the prod webhook endpoint, VPS env, deploy, Caddy confirm) moves to **P12**, because
> `cradlehq.app` is **live with real users**: shipping a half-built payments feature risks a real person
> stumbling onto a broken/confusing checkout. The whole payments feature deploys **once, when it's done.**

---

## What you're actually doing, in one paragraph

Two kinds of hardening, both on your laptop. First, turn the manual P3 checks into **automated tests** so a
future change can't silently break the grant/idempotency guarantees. Second, drive a **real card through the
hosted Stripe checkout page** (which the hand-signed P3 tests skipped) and confirm the money actually flows
to a grant via the webhook — plus the decline and 3-D Secure paths, which behave differently.

---

## Bucket A — Automated tests (regressions for P3)

- Replay: the same `evt_` id grants once; a second delivery is a no-op.
- Unknown event type → 200, no grant.
- Malformed / invalid signature → 400.
- (Optional) credit-pack vs share vs bundle grant shapes.

These lock in the exact behaviors verified by hand in P3 so they can't regress.

## Bucket B — Real-card flows via the hosted page (local `stripe listen`)

Run `Backend/stripe-listen.sh` in its own terminal, then pay real test cards through the Checkout URLs our
`/billing/checkout` returns:

1. **`4242 4242 4242 4242`** → success → credits land **via the webhook**, not the redirect. Watch the
   event in `stripe listen` and confirm the balance moved.
2. **`4000 0000 0000 9995`** → decline → no grant, no crash, sane logging.
3. **`4000 0025 0000 3155`** → 3-D Secure challenge → **changes redirect timing**; exercise once so P7's
   polling assumptions are grounded.

Someone has to complete the hosted page — decide at run time: **click through manually** (~5 min) or
**drive it with a headless browser** (repeatable, adds a dependency). Any future expiry / CVC / ZIP.

## Done when

- [x] Automated tests cover replay, unknown type, and bad signature (all green). — `GrantServiceTest`
      (replay + 3 grant shapes), `BillingWebhookServiceTest` (unknown type no-op, bad-sig aborts,
      metadata/credits parsing), `BillingWebhookControllerTest` (200/400/500 mapping). 11 tests, 2026-07-11.
- [x] `4242` paid through the hosted page grants via the **webhook**, end to end, locally. — demo user
      802→852 (+50) on `checkout.session.completed`; the surrounding `charge.*`/`payment_intent.*` events
      all returned 200 and granted nothing. Ledger row recorded; a `stripe events resend` of the same event
      returned 200 with **no** second grant (balance held at 852). 2026-07-11.
- [x] Decline and 3-D Secure paths both behave (no grant / correct grant, no crash). — `4000…9995` declined
      on the hosted page (insufficient funds); `charge.failed`/`payment_intent.payment_failed` → 200, no
      grant, balance held, no errors in the API log. `4000…0025…3155` (3DS) presented the challenge, and on
      completion granted +50 (852→902); the `checkout.session.completed` webhook still landed ~1s after
      completion — the 3DS challenge is user-facing only, it does **not** delay the webhook (note for P7). 2026-07-11.
- [x] **Nothing was deployed to prod.** — all work stayed on `payments-v1` against the local Docker DB.

## Not this session — all moved to P12

Registering the production webhook endpoint · the prod `whsec_` · Caddy `Stripe-Signature` passthrough
confirmation · putting `STRIPE_*` env vars on the VPS · any deploy. **All of it is P12**, the single point
where the finished, gated payments feature first reaches production.

## Closing note

Record the actual duration. Note whether the real-card flows surprised you vs. the hand-signed P3 tests —
especially the 3-D Secure redirect timing, which P7 depends on.
