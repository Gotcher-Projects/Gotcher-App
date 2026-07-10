# Payments P12 — Live-mode cutover

**Status:** Not started
**Est:** ~1.5 hours · **Depends on:** everything above **+ LLC account activation** (owner's, multi-week) · **Blocks:** the first real dollar
**Launch prompt:** `session-prompts.md` → P12

Go live. Recreate the four Products in **live** mode, register the **live** webhook, swap **all six** env
vars on the VPS, re-apply the Radar rule, confirm the tax note was sent, and smoke-test with a real card.

---

## What you're actually doing, in one paragraph

Everything through P11 ran in a sandbox with fake money. This session flips to real money — and the single
biggest trap is that **test and live are completely separate universes**: different keys, different webhook
secret, and different price ids. It is *not* a matter of swapping one secret key; all six env values change,
and the four Products don't exist in live mode until you create them there.

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

1. **Recreate the four Products/Prices in live mode**, same `sku` + `credits` metadata. (Consider handing
   the owner `stripe-add-products-guide.html` for this — it's the same four SKUs.)
2. **Register the live webhook endpoint** → a **new `whsec_`** (different from test and from the CLI).
3. **Swap all six env vars** on the VPS (secret key, webhook secret, four price ids). Redeploy.
4. **Re-apply the Radar US-only rule in live** — rules are per-mode. This is also our tax mitigation (P5).
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

## 📌 Before moving on — re-slice check (Michael, 2026-07-10)

Talk about slicing the remaining work **before** starting print or share. `sv2-s12` L1 is currently a
single "session" estimated at **15–70 hours** — a project wearing a session's name; `sv2-s13` is unsliced;
`sv2-s14` has **no plan file at all**. This was supposed to happen at **`../sv2-reslice-checkpoint.md`
(after P5)**. If it did — good, skip this. **If it slipped, do it now.** Do not start print/share with the
plans in their current shape. Then: **`sv2-s14` hardening** (write the plan first — it doesn't exist).

## Not this session

Print checkout (`sv2-s12`) · share upsell (`sv2-s13`) · hardening (`sv2-s14`). Those are gated behind the
re-slice checkpoint, not P12.

## Closing note

Record the actual duration. This is the last payments session — note anything about the live cutover that
the test-mode work didn't predict, for whoever runs the next live launch (print).
