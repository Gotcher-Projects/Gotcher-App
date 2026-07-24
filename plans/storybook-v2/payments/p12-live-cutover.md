# Payments P12 — Live-mode cutover

**Status:** Not started
**Est:** ~1.5 hours · **Depends on:** **`../sv2-deploy-0-first-prod-deploy.md` (run it FIRST)** + everything above **+ LLC account activation** (owner's, multi-week) · **Blocks:** the first real dollar
**Launch prompt:** `session-prompts.md` → P12

Go live. Recreate the four Products in **live** mode, register the **live** webhook, swap **all six** env
vars on the VPS, re-apply the Radar rule, confirm the tax note was sent, and smoke-test with a real card.

> **⚠️ RESCOPED 2026-07-22 — the first-deploy half moved out.** This originally carried both "payments reaches
> production for the first time" *and* "flip to real money," because all prod-touching work was deferred here
> (decided 2026-07-11). That's now split: **`../sv2-deploy-0-first-prod-deploy.md`** does the deploy, the 31
> migrations, SMTP, the Caddy passthrough and a test-key purchase in prod. **P12 is now only the live flip.**
> If something breaks here, it's the money layer — which is the whole point of separating them.

---

## What you're actually doing, in one paragraph

By the time you're here, the code is already deployed and running in production against **test** keys, and a
test-key purchase has already granted credits through the real webhook path (DEPLOY-0). So exactly one thing
changes in this session: **fake money becomes real money.** The single biggest trap is that **test and live are
completely separate universes** — different keys, different webhook secret, and different price ids. It is
*not* a matter of swapping one secret key; all six env values change, and the four Products don't exist in
live mode until you create them there.

---

## ⚠️ Test and live are separate universes

Different API keys, a different webhook signing secret, and **different price ids**. All four Products must
be created **again** in live mode. **All six env vars change, not just the secret key.** This is the most
common source of "it worked yesterday."

## Blocked on activation

Live payments need the LLC account **activated** — business details, EIN, bank account, owner identity
verification. That's the **owner's** job and can take weeks (P0.5 #1). Per P0.5, it appears already
activated; **confirm the definitive yes with the owner before running this session.**

## Steps

0. **✅ First-deploy infra — OWNED BY `../sv2-deploy-0-first-prod-deploy.md`. Do not repeat it here.**
   By the time you run P12, DEPLOY-0 has already: deployed the branch, applied **all 31 migrations (V23→V53)**
   after a rehearsal on restored prod data, proven **SMTP delivers**, proven **Caddy passes the raw body +
   `Stripe-Signature`**, and completed a **test-key purchase in production**.

   So this session **does not deploy, does not migrate, and does not touch the schema.** It is purely
   "swap six env values and prove real money works." If DEPLOY-0 hasn't been run and verified green, **stop and
   run it first** — otherwise you are back to carrying first-deploy risk and money risk in one session.

   Confirm before starting: prod is on `payments-v1`, Flyway reports **v53**, and the test-key purchase from
   DEPLOY-0 step 8 granted credits.
1. **Recreate the four Products/Prices in live mode**, same `sku` + `credits` metadata. (Consider handing
   the owner `stripe-add-products-guide.html` for this — it's the same four SKUs.)
2. **Register the live webhook endpoint** → a **new `whsec_`** (different from test and from the CLI).
3. **Swap all six env vars** on the VPS (secret key, webhook secret, four price ids). Redeploy.
4. **Verify the Radar US-only rule in live** — `Block if :card_country: != 'US'`. It was **already added
   in live** during P8 (2026-07-12), so this is a *confirm it's active*, not a create. Rules are per-mode;
   this is also our tax mitigation (P8).
5. **✅ Tax note — SENT 2026-07-21.** Michael emailed the LLC owner (Kevin) with the five accountant questions
   plus the refund economics. **Sent, not answered** — the obligation begins at the first live charge (the next
   step); don't wait for a reply. Confirm it went, then move on.
6. **Smoke test with a REAL card**, smallest SKU. **Refund yourself** afterward.
7. **Watch the first real webhook land** in the Stripe dashboard's event log and confirm the grant.
8. **⚠ Print checkout rides these same live keys.** pr7's print checkout is a variable-amount session built with
   `price_data`, so it needs **no live Price object** — but it will start using the live secret key the moment
   these vars are swapped. That is safe only because **`PRINT_ENABLED=false`** keeps checkout refusing with 409.
   **Confirm print is still dormant after the redeploy** (`/auth/me` → `print_enabled: false`).
9. **Re-check the refund path against live data.** Refunding yourself in step 6 exercises `charge.refunded` and
   `refund.created` for a *digital* purchase — confirm it is ignored cleanly (no print order matches the
   PaymentIntent), which is the s14a-2 guard doing its job in production for the first time.

## Done when

- [ ] Four live Products/Prices exist with matching metadata; six live env vars deployed on the VPS.
- [ ] Live webhook registered; a real event verifies and grants via the ledger.
- [ ] Live Radar US-only rule re-applied.
- [ ] The tax note has **left our hands** to the owner.
- [ ] A real-card smoke purchase granted correctly and was refunded.
- [ ] Print is still dormant after the live redeploy (`print_enabled: false`, checkout 409).
- [ ] The digital refund was ignored by the print refund path (no false match).

## Not this session

Deploying or migrating (**DEPLOY-0** owns both) · Lulu prod credentials and flipping print on (**pr10**) ·
the ToS/privacy update (**pr10**).

> ~~"Before starting print/share — slice them first"~~ — obsolete, removed 2026-07-22. All three tracks are
> long since sliced, built and verified: share s13a–e, print pr0–pr9, and s14a-1/a-2/s14c.

## Closing note

Record the actual duration. This is the last payments session — note anything about the live cutover that
the test-mode work didn't predict, for whoever runs the next live launch (print).
