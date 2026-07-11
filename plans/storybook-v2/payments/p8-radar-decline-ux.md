# Payments P5 — Radar US-only rule + decline UX

**Status:** Not started
**Est:** ~1.5 hours · **Depends on:** P2 (a real checkout to test against) · **Blocks:** the re-slice checkpoint runs after this
**Launch prompt:** `session-prompts.md` → P5
**Read first:** `stripe-full-plan.md` §5 + `stripe-primer.md` §6, §9

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

## The decline UX (the half that's easy to skip)

**⚠️ A blocked card surfaces as a decline the customer won't understand.** Detect this specific case and
show **"We currently only sell in the US"** — not a raw Stripe error string. This is a real user-facing
state, not a log line. International **free** users are entirely unaffected; only paying is gated.

## ⚠️ This does NOT solve tax

`cradlehq.app` is a public website. A US-cards-only rule narrows exposure but does **not** make us a
US-only storefront — an EU consumer can still load the site and attempt to pay (and simply be declined).
Digital-goods tax rules vary by US state too. See the "US storefront ≠ US customers" box in
`stripe-primer.md` §9. **An accountant answers the tax question, not this rule** — that's the owner's, per
P0.5 #3.

## Done when

- [ ] A non-US test card is blocked by the Radar rule in the sandbox.
- [ ] The block renders as a human "US-only" message, not a raw decline.
- [ ] A US test card (`4242…`) still sails through unaffected.
- [ ] Free international usage of the app is untouched.
- [ ] Noted for P12: this rule must be **re-created in live mode**.

## Not this session

Live-mode Radar rule (P12) · anything about actual tax registration/remittance (owner's, not ours) · the
frontend purchase modal (P7 — though the decline message may share components; build the state here).

## Closing note

Record the actual duration — this is the **sixth** measured session (P0, P0.5, P1–P5 minus the checkpoint),
and **`../sv2-reslice-checkpoint.md` runs immediately after P5.** That checkpoint uses P0–P5's real
durations to re-slice sv2-s13 / s12 / s14. So writing down this number honestly is the whole reason the
checkpoint sits here.
