# Payments — Session Prompts

**Re-sliced 2026-07-10 into ≤2-hour sessions.** The old S1/S2/S3 split was 8–14h, 6–12h, and 3–5h —
each of those is several sittings, and "Payments S1" as one prompt would have a session juggling a
migration, an SDK, a checkout endpoint, a webhook, an idempotency ledger, and a fraud rule at once. The
webhook alone deserves undivided attention: it is the one place a bug hands out credits nobody paid for.

**Canonical plan:** `stripe-full-plan.md`. **Read `stripe-primer.md` first** — it is the *why*.
**Account setup:** `p0-account-setup.md` (do this first; nothing else can start without it).

The old subscription-era prompts are in `../deprecated/payments-s{0,1,2}-*.md`. **Do not run them.**

---

## Run order & budget

| # | Session | Est. | Depends on |
|---|---|---|---|
| **P0** | Stripe account: first login & setup | 2h | nothing |
| **P0.5** | **Open questions & unowned work** (decisions, no code) | 1h | P0 |
| P1 ✅ | V47 migration + config plumbing | 1.5h | P0 |
| P2 ✅ | Checkout endpoint (`POST /billing/checkout`) | 2–3h | P1 |
| **P3 ✅** | **Webhook + idempotency ledger** ⚠️ | 2–4h | P2 |
| P4 ✅ | Webhook hardening (LOCAL only) | 1.5h | P3 |
| P5 | Routing decision (router vs pathname) | 1.5–4h | — (can run early) |
| P6 | Purchase modal (credits-only; share SKUs → s13) | 1.5–2h | P2 |
| P7 | Redirect + success screen | 2h | P3, P6 |
| P8 | Radar US-only rule + decline UX | 1.5h | P2, **P6/P7** (message needs the modal + return screen) |
| P9 | Native gate + polish | 1.5h | P6 |
| P10 | Balance display | 1h | P7 |
| P11 ⏸️ | Admin credit endpoint — **Deferred** (not needed for launch; revisit at higher volume) | 1.5h | P1 |
| P12 | Live-mode cutover | 1.5h | all + activation |

**Renumbered 2026-07-11 (Michael).** The Radar/decline session used to be P5; it's now **P8**, after the
routing/modal/success sessions. Reason: a Radar block surfaces as a generic decline on Stripe's hosted
page, so the "US-only" message has no in-app home until the **P6 modal** (pre-checkout geo hint) and **P7
return screen** exist — the whole session runs once, there. Old→new mapping: P6→P5, P7→P6, P8→P7, P5→P8;
P1–P4 and P9–P12 unchanged. The 🛑 re-slice checkpoint row was also **removed** — see below.

**Each session now has its own standalone plan file** (`p0-account-setup.md`, `p0.5-open-questions.md`,
`p1-migration-config.md`, `p2-checkout-endpoint.md`, `p3-webhook-idempotency.md`, `p4-webhook-hardening.md`,
`p5-routing-decision.md`, `p6-purchase-modal.md`, `p7-redirect-success.md`, `p8-radar-decline-ux.md`,
`p9-native-gate.md`, `p10-balance-display.md`, `p11-admin-credits.md`, `p12-live-cutover.md`) — each with
its own **Status** field. The prompt blocks below launch them; the files carry the detail and are the source
of truth for progress. Created 2026-07-10.

🛑 **The re-slice checkpoint is dropped as a payments gate** (Michael, 2026-07-11). It existed to slice
the oversized print/share tracks before they ran — but print has since been sliced into `../print/pr0–pr9`,
so its trigger is moot. `../sv2-reslice-checkpoint.md` is marked Deferred; the two live parts that remain
(the `sv2-s12` print-renderer decision, and `sv2-s14` having no plan file) are handled **when print/share
actually start**, not as a payments step. Nothing here blocks continuing payments.

**~21.5h if every session hits its cap — realistically 24–36h.** Those are *caps*, not estimates: sizing
each slice to fit a 2-hour box quietly discards the top of every range. P2, P3, P5 and P6 are the ones
most likely to spill; split them rather than rush them. P3 is the one to be rested for.

### Deliberately NOT built (don't rediscover these mid-build)

- **`GET /billing/status`** — skipped. The balance already reaches the UI via `user.ai_credits_remaining`
  on `/auth/me`, which `AiCreditsContext` reads. Build it only if something needs an answer `/auth/me`
  can't give. Its old response was entirely subscription fields.
- **`GET /billing/portal`** — the Stripe Billing Portal manages subscriptions. There are none.
- **Monthly credit reset, grace periods, downgrade-on-lapse, "Manage Subscription".** Nothing recurring.

### In scope for Payments, but NOT in P0–P12

- **Print's checkout** is a *second*, variable-amount flow (copies × price + shipping, needs an address).
  The fixed-price digital SKUs hand it nothing reusable. Lives in `../print/print-full-plan.md` L1/L2.
- **Refunds, the share-purchase IDOR check, webhook retry replay, `email_verified` enforcement** →
  `sv2-s14` (not yet written).
- **The share upsell button** → `../sv2-s13-share-link.md`. Depends on P2.

### Block the *live* launch, not the build → **now owned by P0.5**

- [ ] **LLC Stripe activation** (EIN, bank, identity). Multi-week. Owner's job. Blocks **P12 only** — so
      the real risk is finishing the build and *then* waiting three weeks. Start it in parallel with P1.
- [ ] **Refund posture**, especially "I unlocked the wrong book."
- [x] ~~**An accountant on tax.**~~ ⛔ **NOT OURS** (decided 2026-07-10). The owner's problem. Forward
      `handoffs/tax-note-for-owner.md` and move on — don't wait for a reply. Blocks nothing we build;
      the obligation begins at the first **live** charge, so it just has to leave our hands before **P12**.
      Working assumption: the P8 US-cards-only Radar rule is the mitigation.

`p0.5-open-questions.md` gives the remaining two a name and a date.

---

## P0 — Stripe account setup

```
Payments P0 — first login to Stripe, create the four SKUs, get keys, install the CLI.
Plan: plans/storybook-v2/payments/p0-account-setup.md — follow it step by step.

Michael has NEVER used Stripe. Explain WHY before WHERE TO CLICK. He is a team member on an
LLC-owned account (Developer role), not the owner.

⚠️ FIRST TEN MINUTES: check whether his role can create Products/Prices and see Radar → Rules.
   Developer grants API keys + webhooks + logs; Products/Radar are NOT confirmed. If blocked, the
   owner must raise the role or create the SKUs. Finding this out late blocks the whole track.
⚠️ Stripe replaced the test-mode toggle with SANDBOXES (verified 2026-07-10). The dashboard will not
   match any older doc. Ask him what he sees; don't insist.
⚠️ Prices must be ONE-TIME. Stripe defaults to recurring. There is no subscription anywhere in this
   product. Each Price needs metadata: sku + credits.
⚠️ No pk_ key. We never load Stripe.js. Secret key is server-only, never committed.

No app code this session.
```

---

## P1 — V47 migration + config plumbing  (1.5h)

```
Payments P1 — schema and config only. No Stripe API calls yet.
Plan: plans/storybook-v2/payments/stripe-full-plan.md (Session 1 → migration + SDK/config)

⚠️ Migration is V47. sv2-grant took V46 (free_grant_at) on 2026-07-09. Run
   `ls Backend/db/migration/` and confirm — this number has drifted three times.

1. V47__add_stripe_billing.sql:
   - users.stripe_customer_id VARCHAR(100)
   - books.share_unlocked_at TIMESTAMPTZ   ← the entitlement, distinct from the revocable token
   - stripe_events_applied (event_id PK, user_id, sku, credits, unlocked_book_id, applied_at)
2. build.gradle: com.stripe:stripe-java:33.+   ← NOT 25.+ (latest is 33.0.0, verified 2026-07-10;
   25.x is an unmaintained major)
3. application.properties: six stripe.* keys. Mirror into .env.example + docker-compose.prod.yml.

DO NOT create stripe_subscription_id, tier_expires_at, or tier_grace_until. There is no subscription.
`users.tier` is vestigial — nothing reads it.

4. Housekeeping: AiAssistService.java:13 still comments "20 credits for $2". That SKU was DROPPED —
   at $2 Stripe's flat $0.30 makes the fee 17.9% of gross. Update it to the four real SKUs.

Done when: app boots, Flyway applies V47, `./gradlew test` green. No behavior change yet.
```

---

## P2 — POST /billing/checkout  (2h)

```
Payments P2 — create a Stripe Checkout Session. JWT-protected.
Plan: stripe-full-plan.md (Session 1 → billing package, POST /billing/checkout)

Build com.gotcherapp.api.billing: BillingController, BillingService, CheckoutRequest, CheckoutResponse.

Request: { sku, bookId? }
1. Reject unknown sku.
2. bookId REQUIRED for share_only + bundle_share_150; REJECTED for the credit packs.
3. ⚠️ IDOR — VALIDATE THE BOOK BELONGS TO THE CALLER. `books` has NO user_id: ownership is
   books.baby_profile_id → baby_profiles.user_id, a two-hop join. Skip this and a user pays $10 to
   unlock a stranger's book. See BookService.java / StorybookService.java:215 for the existing pattern.
4. If users.stripe_customer_id is null → Customer.create() and store it.
5. Session.create(): mode='payment', the price id for the sku, clientReferenceId=userId,
   metadata={sku, bookId}, successUrl with {CHECKOUT_SESSION_ID}, cancelUrl.
6. Send an Idempotency-Key so a double-clicked Buy button can't create two sessions.

⚠️ Catch Exception in the controller, not RuntimeException. An uncaught one re-dispatches to /error
   unauthenticated and surfaces as 401, not 500 (CLAUDE.md).

Verify by hand: curl the endpoint, open the returned URL, see the Stripe page with the right amount
and the right book name. Do NOT pay yet — nothing handles the result.
```

---

## P3 — Webhook + idempotency ledger  ⚠️ THE ONE THAT MATTERS  (2h)

```
Payments P3 — POST /billing/webhook. Public, signature-verified, idempotent.
Plan: stripe-full-plan.md (Session 1 → webhook) + stripe-primer.md §3-§4. READ BOTH.

This is the single most important correctness surface in the whole product. A bug here either hands
out credits nobody paid for, or takes money and grants nothing. Be rested.

⚠️ Take the body as `@RequestBody String payload`. Signature verification hashes the EXACT raw bytes.
   Let Spring deserialize to a DTO and the re-serialized JSON won't match — verification fails for
   reasons that look like nothing at all.
⚠️ IDEMPOTENT OR NOTHING. Stripe retries until it gets a 2xx, and can redeliver even AFTER one.
   In ONE transaction: INSERT the evt_ id into stripe_events_applied ON CONFLICT DO NOTHING, and
   grant ONLY if that insert affected 1 row. Incrementing a balance twice is not harmless.
⚠️ CATCH Exception. Return 200 once the event is durably recorded. An uncaught RuntimeException →
   /error → 401 → Stripe retries with backoff FOR ~3 DAYS while a paying customer gets nothing.
   Return 4xx ONLY for a genuine signature failure.
⚠️ Fulfil here, NEVER on the redirect. successUrl proves nothing — anyone can visit it.

One event: checkout.session.completed. Resolve user from clientReferenceId, sku/bookId/credits from
metadata. Grant credits to the user; set books.share_unlocked_at for the named book. Ignore-and-200
every other event type.

Add /billing/webhook to SecurityConfig permitAll — Stripe sends no JWT. The signature IS the auth.

Verify: `stripe trigger checkout.session.completed` → granted. Trigger the SAME event twice (or
resend from the dashboard) → the second must NOT grant. That replay test is the point of this session.
```

---

## P4 — Webhook hardening + deploy surface  (1.5h)

```
Payments P4 — make the webhook survive production.
Plan: stripe-full-plan.md + stripe-primer.md §4, §8

1. Real end-to-end in the sandbox: 4242 card → success → credits land via the webhook (not the redirect).
2. Decline card (4000 0000 0000 9995): no grant, no crash, sane logging.
3. 3-D Secure card (4000 0025 0000 3155): changes redirect timing. Exercise once.
4. Caddy must proxy /billing/webhook to :3001 with the Stripe-Signature header INTACT. A proxy that
   rewrites or drops headers produces the same silent verification failure as body-parsing.
5. Register the production endpoint in the Dashboard — it gets a DIFFERENT whsec_ than the CLI's.
6. Tests around the ledger: replay, unknown event type, malformed signature.

Deploy to prod with TEST keys and confirm a real webhook lands.
```

---

## P5 — Routing decision  (1.5h)

```
Payments P5 — decide how non-app URLs are served. A DECISION, not a check.

⚠️ THE APP HAS NO ROUTER. No react-router in Frontend/package.json. App.jsx is an auth gate that
   renders <CradleHq />. Any plan text saying "check App.jsx to confirm React Router" is wrong.

Two consumers need routes:
  - /upgrade-success   (Payments P7)
  - /book/{token}      (sv2-s13, public, OUTSIDE the auth gate)

Options: (a) add react-router — cleaner, and s13 needs it anyway, so decide once for both;
         (b) branch on window.location.pathname before the auth gate — one file, no dependency,
             gets ugly at the third route.

Recommend (a) given s13 is in scope. Confirm with Michael, then implement the shell only.
Also verify Caddy/Vite SPA fallback so a direct load of a deep URL doesn't 404 at the server.
```

---

## P6 — Purchase modal  (2h)

```
Payments P6 — the buy-CREDITS UI. RE-SCOPED credits-only (Michael 2026-07-11) — read the decision box
in p6-purchase-modal.md first.
Plan: stripe-full-plan.md (Session 2 → purchase modal) + p6-purchase-modal.md

⚠️ PaidGate.jsx DOES NOT EXIST — deleted as dead code 2026-06-19. Build fresh. The real seam is the
   `onGetCredits` callback in Frontend/src/contexts/AiCreditsContext.jsx, left undefined on purpose
   by sv2-s10b. Wiring it is this session's job. It fires with NO book (and from journal/pregnancy/
   profile too), so this is a buy-credits flow — NOT a share flow.

Two credit packs only: $5/50cr · $10/125cr. NO $4.99/mo card. NO tier comparison. Nothing recurring.
The share/bundle SKUs ($10 share-only, $15 bundle) need a specific book → they move to sv2-s13.
Build the modal to accept an optional bookId + extended SKU list (unused now) so s13 plugs them in.

Button → POST /billing/checkout { sku } → window.location.href = data.url. Loading state while in flight.
```

---

## P7 — Redirect return + success screen  (2h)

```
Payments P7 — come back from Stripe without lying to the user.
Plan: stripe-full-plan.md (Session 2) + stripe-primer.md §3

⚠️ THE SUCCESS PAGE MUST NOT GRANT ANYTHING. If it does, anyone who visits /upgrade-success grants
   themselves credits. Fulfilment happens only in the P3 webhook.
⚠️ The webhook is NOT ordered relative to the redirect. It usually lands within milliseconds, but
   it is not guaranteed. So: show "Confirming your purchase…", poll GET /auth/me until the balance
   changes, and degrade gracefully after a few seconds ("it's on its way").

Then refresh the user object so the whole app sees the new balance.
Route per the P5 decision. Mobile V1: plain web fallback, no universal links.
```

---

## P8 — Radar US-only rule + decline UX  (1.5h)

```
Payments P8 — block non-US cards; make the block legible.
Plan: stripe-full-plan.md §5 + stripe-primer.md §6

⚠️ VERIFY THE RADAR RULE SURFACE IN THE DASHBOARD FIRST. The `:card_country:` syntax in our docs is
   recalled from memory, not read from current docs. Also confirm the Developer role can edit Radar
   rules at all (checked in P0).

Block payments whose card issuing country != US. Rationale: it matches the US-only app-store posture
and defers the EU/UK VAT question rather than accruing a liability against it.

⚠️ A blocked card surfaces as a DECLINE the customer won't understand. Detect it and show
   "We currently only sell in the US" — not a raw Stripe error. This is a real user-facing state.
   The message needs the P6 modal (pre-checkout geo hint) + P7 return screen (cancel path) to render.

Restricts who can PAY, not who can USE the app. International free users are unaffected.
⚠️ This does NOT solve tax. cradlehq.app is a public website; see the "US storefront ≠ US customers"
   box in stripe-primer.md §9. An accountant, not a model, answers that one.
```

---

## P9 — Native gate + polish  (1.5h)

```
Payments P9 — no purchase UI in the native builds.
Plan: stripe-full-plan.md (Session 2 → native gate) + stripe-primer.md §9

Gate ALL purchase UI behind Capacitor.isNativePlatform(). On native, leave
AiCreditsContext.onGetCredits UNDEFINED — exactly as sv2-s10b already built it — so the
out-of-credits state stays informational and never becomes a call to action.

Why: Apple 3.1.1 requires IAP for in-app digital purchases; the exemption we rely on (3.1.3(f), free
companion app) is conditioned on there being NO purchase UI and NO call to action in the app. v1 ships
with neither and claims nothing contested. See stripe-primer.md §9 for the staged-submission plan.

The PRINTED BOOK is the opposite case: a physical good, which Apple 3.1.3(e) REQUIRES be sold outside
IAP. That button can ship in the app on day one. Don't gate it by mistake.

Also handle the P8 US-only decline message here if it isn't done.
```

---

## P10 — Balance display  (1h)

```
Payments P10 — show the credit balance.
"7 credits remaining" — no "/ 10", no "resets on…". There is no allotment and no reset job.
At zero: "0 credits remaining" + "Get more credits" → the P6 modal.
credits already reach the UI via AiCreditsContext (sv2-s10b). No new backend work.
```

---

## P11 — Admin credit adjustment  (1.5h)

```
Payments P11 — POST /admin/users/{id}/credits { "amount": 5 } for support requests.

⚠️ /admin/** is ALREADY permitAll in SecurityConfig, gated only by an ADMIN_SECRET header — not JWT.
   This endpoint MINTS CREDITS. Decide deliberately whether that posture is sufficient; don't just
   inherit it because the matcher is already there.

No reset job. Credits are purchased, not allotted — nothing refills them on a schedule.
credits_reset_at (V23) stays unused. This is why Session 3 shrank to almost nothing.
```

---

## P12 — Live-mode cutover  (1.5h)

```
Payments P12 — go live. Blocked on LLC account activation (EIN, bank, identity — multi-week, owner's job).

⚠️ TEST AND LIVE ARE SEPARATE UNIVERSES. Different API keys, different webhook signing secret, and
   DIFFERENT PRICE IDS. All four Products must be created AGAIN in live mode. All six env vars change,
   not just the secret key. This is the most common source of "it worked yesterday."

1. Recreate the four Products/Prices in live mode, same sku + credits metadata.
2. Register the live webhook endpoint → new whsec_.
3. Swap all six env vars on the VPS. Redeploy.
4. Re-apply the Radar US-only rule in live (rules are per-mode). This is also our tax mitigation.
5. ⛔ Confirm `handoffs/tax-note-for-owner.md` was SENT to the owner. Not answered — sent. The tax
   obligation begins at the first live charge, which is the next step. Don't wait for a reply.
6. Smoke test with a REAL card, smallest SKU. Refund yourself.
7. Watch the first real webhook land in the Stripe dashboard's event log.

📌 The formal RE-SLICE CHECKPOINT is DROPPED (Michael, 2026-07-11) — print has since been sliced into
   ../print/pr0–pr9, so its trigger is moot. Two loose ends still get handled WHEN print/share start
   (not here): sv2-s13 is unsliced, and sv2-s14 has no plan file at all.

Then: sv2-s14 hardening (write the plan first — it doesn't exist).
```
