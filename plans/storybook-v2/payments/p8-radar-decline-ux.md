# Payments P8 — Radar US-only rule + decline UX

**Status:** Complete (2026-07-12) — Radar rule `:card_country: != 'US'` blocks a UK test card in the sandbox
(verified); static "Payments are currently US-only" notice added to `PurchaseModal`. See notes below.

> **Notes from the build (2026-07-12):**
> - Rule expression that works: **`Block if :card_country: != 'US'`** (the memory-guess was right).
> - Fraud Teams enabled on a **free trial** (billing starts ~Aug 11) — irrelevant to us: sandbox is free, and
>   live doesn't bill until real charges (P12+).
> - **Gotcha hit:** rules are **per-mode**. The rule was first added in **live** by mistake; had to re-add it
>   in the **sandbox** to make the test fire. Silver lining: **live already has the rule**, so P12 just
>   *verifies* it rather than creating it.
> - Confirmed the hosted-page decline is **not customizable** ("Your card was declined — try a debit card"
>   is Stripe's generic text, and actively misleading here). This is exactly why the fix is the upfront
>   modal notice, not a reactive message.
**Est:** ~1.5 hours · **Depends on:** P2 (a checkout to test against) **+ P6/P7** (see reorder note) · **Blocks:** nothing
**Launch prompt:** `session-prompts.md` → P8
**Read first:** `stripe-full-plan.md` §5 + `stripe-primer.md` §6, §9

> **Reordered to run after P7 (Michael, 2026-07-11).** The Radar rule is buildable any time, but a blocked
> card surfaces as a generic decline **on Stripe's hosted page**, which we can't customize — and our app
> only regains control on the cancel redirect, where Stripe doesn't pass the reason. So the "US-only"
> message has no honest in-app home until the **P6 purchase modal** exists — where we now show a **static
> US-only notice** (decided 2026-07-11, see below). Radar = the authoritative gate (card issuing country);
> the modal notice = the courtesy heads-up.
> This session was **P5** before the 2026-07-11 renumber; the re-slice checkpoint that once sat after it is
> **dropped** (see `session-prompts.md`).

Block payments from non-US cards, and make the block **legible** to the customer instead of a raw Stripe
error. This is both a fraud posture and — importantly — the partial mitigation the tax discussion leans on
(P0.5 #3). It restricts who can **pay**, not who can **use** the app.

---

## What you're actually doing, in one paragraph

We keep sales domestic for v1: it matches the US-only app-store posture and defers the EU/UK VAT question
rather than accruing a liability against it. A Radar rule blocks any card whose issuing country isn't US.
The catch is that a blocked card comes back as a generic *decline* the customer won't understand, so half
this session is turning that into an honest "we currently only sell in the US" message.

---

## ⚠️ Two things to confirm in the dashboard FIRST

1. **The rule surface / syntax.** The `:card_country:` syntax in our docs is **recalled from memory, not
   read from current docs.** Open Radar → Rules and confirm the actual expression language before writing.
2. **Your role can edit Radar rules at all.** Checked reachable in P0. Custom rules require **Radar for
   Fraud Teams** ($0.02/screened txn); it's **free to build and test in the sandbox**, so do all of this
   there. It only costs once live (P12), where the rule must be **re-created** (rules are per-mode).

## The rule

Block payments whose **card issuing country ≠ US**. Rationale in `stripe-primer.md` §6.

## The decline UX — decided: a static upfront notice (Michael, 2026-07-11)

**We can't reactively "make the decline legible."** With hosted Checkout, a Radar block shows a **generic
"card declined" on Stripe's page that we can't customize**, and a blocked attempt produces **no webhook and
no return signal** — so the app never learns it was a country block. Detect-and-message is not feasible.

**Instead:** show a small **static "Payments are currently US-only" line in the `PurchaseModal`** (P6), to
everyone, before they leave for Stripe. Deterministic, no geo detection, no false positives — it just sets
expectations so a non-US buyer isn't surprised by a bare decline. The **Radar rule is the actual
enforcement**; this line is only the courtesy. International **free** users are entirely unaffected; only
paying is gated.

Rejected: an IP geo-hint (needs a geo source; IP-country ≠ card-country → false positives; still only a hint).

## ⚠️ This does NOT solve tax

`cradlehq.app` is a public website. A US-cards-only rule narrows exposure but does **not** make us a
US-only storefront — an EU consumer can still load the site and attempt to pay (and simply be declined).
Digital-goods tax rules vary by US state too. See the "US storefront ≠ US customers" box in
`stripe-primer.md` §9. **An accountant answers the tax question, not this rule** — that's the owner's, per
P0.5 #3.

## Pre-flight — verify in the sandbox dashboard FIRST (gates the whole session)

- [ ] Developer role can open **Radar → Rules** (P0 left this unconfirmed — if blocked, it's an owner action).
- [ ] Can create a **custom rule** (Radar for Fraud Teams — free in sandbox).
- [ ] Read the **actual rule syntax** off the current editor (the `:card_country:` form was from memory).
- [ ] Grab a **non-US test card** number from Stripe's current docs (don't recall from memory).

## Done when

- [x] A non-US test card is **blocked** by the Radar rule in the sandbox (`4000 0082 6000 0000`, UK);
      `4242…` (US) still sails through.
- [x] A static **"Payments are currently US-only"** notice shows in the `PurchaseModal` (everyone, always).
- [x] Free international usage of the app is untouched (only paying is gated).
- [x] For P12: the live rule already exists (added by mistake during this session), so P12 **verifies** it
      rather than creating it; billing on it starts at the first live charge.

## Not this session

Live-mode Radar rule (P12) · anything about actual tax registration/remittance (owner's, not ours) · the
frontend purchase modal (P6 — though the decline message may share components; build the state here).

## Closing note

Record the actual duration. Note whether the Radar rule surface and the `:card_country:` syntax matched the
current docs (both were recalled from memory), and whether the Developer role could edit rules at all. The
re-slice checkpoint that once sat after this session is **dropped** — see `session-prompts.md`.
