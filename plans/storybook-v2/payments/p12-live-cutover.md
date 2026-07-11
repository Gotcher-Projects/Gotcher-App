# Payments P12 — Live-mode cutover

**Status:** Not started
**Est:** ~1.5 hours · **Depends on:** everything above **+ LLC account activation** (owner's, multi-week) · **Blocks:** the first real dollar
**Launch prompt:** `session-prompts.md` → P12

Go live. Recreate the four Products in **live** mode, register the **live** webhook, swap **all six** env
vars on the VPS, re-apply the Radar rule, confirm the tax note was sent, and smoke-test with a real card.

> **⚠️ This is the FIRST time any payments code reaches production** (decided 2026-07-11, Michael). All
> prod-touching work for the whole feature was deferred here on purpose — `cradlehq.app` is live with real
> users, so nothing payments-related deployed while it was half-built. That means P12 also carries the
> **first-deploy** items that aren't strictly "live mode": confirming the Caddy `Stripe-Signature`
> passthrough, and (optionally) a **test-keys smoke on prod first** to isolate "does the infra/webhook path
> work?" from "flip to real money" before swapping in live keys.

---

## What you're actually doing, in one paragraph

Everything through P11 ran locally / in a sandbox with fake money, and **none of it was deployed** — this is
the payments feature's first contact with production. Two things happen at once here: the feature reaches
prod for the first time, and it flips to real money. The single biggest trap is that **test and live are
completely separate universes**: different keys, different webhook secret, and different price ids. It is
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

0. **First-deploy infra check (payments has never been on prod).** Deploy the branch to the VPS and confirm
   the app boots with the new billing beans. Confirm **Caddy passes `Stripe-Signature` + the raw body
   through** on `/api/billing/webhook` (default `reverse_proxy` behavior — likely no Caddyfile change, just
   verify). **Optional but recommended:** do this first with **TEST** keys + a **test-mode** prod webhook
   endpoint and confirm a real Stripe-sent webhook lands — isolating "infra works" from "real money" —
   *then* proceed to live below.
1. **Recreate the four Products/Prices in live mode**, same `sku` + `credits` metadata. (Consider handing
   the owner `stripe-add-products-guide.html` for this — it's the same four SKUs.)
2. **Register the live webhook endpoint** → a **new `whsec_`** (different from test and from the CLI).
3. **Swap all six env vars** on the VPS (secret key, webhook secret, four price ids). Redeploy.
4. **Re-apply the Radar US-only rule in live** — rules are per-mode. This is also our tax mitigation (P8).
5. **⛔ Confirm `handoffs/tax-note-for-owner.md` was SENT** to the owner (P0.5 #3 logged it as not-yet-sent).
   **Sent, not answered.** The tax obligation begins at the first live charge — which is the next step.
   Don't wait for a reply.
6. **Smoke test with a REAL card**, smallest SKU. **Refund yourself** afterward.
7. **Watch the first real webhook land** in the Stripe dashboard's event log and confirm the grant.

## Done when

- [ ] Four live Products/Prices exist with matching metadata; six live env vars deployed on the VPS.
- [ ] Live webhook registered; a real event verifies and grants via the ledger.
- [ ] Live Radar US-only rule re-applied.
- [ ] The tax note has **left our hands** to the owner.
- [ ] A real-card smoke purchase granted correctly and was refunded.

## 📌 Before starting print/share — slice them first

The formal re-slice checkpoint was **deferred** (Michael, 2026-07-11 — happy with payments slicing). But its
substantive part still stands: **before** starting print or share, slice them. `sv2-s12` L1 is currently a
single "session" estimated at **15–70 hours** (and hinges on the undecided print-renderer question —
headless-Chrome vs OpenPDF); `sv2-s13` is unsliced; `sv2-s14` has **no plan file at all**. Handle that when
those tracks begin — see `../sv2-reslice-checkpoint.md`. Not a payments concern.

## Not this session

Print checkout (`sv2-s12`) · share upsell (`sv2-s13`) · hardening (`sv2-s14`). Slice those when they start.

## Closing note

Record the actual duration. This is the last payments session — note anything about the live cutover that
the test-mode work didn't predict, for whoever runs the next live launch (print).
