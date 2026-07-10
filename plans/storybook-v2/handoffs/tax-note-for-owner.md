# Sales tax / VAT — Note for the LLC owner

**Purpose:** hand the tax question to the person who owns it. **Nothing in the build waits on this.**
**Who this is for:** the LLC owner, to take to an accountant.
**Send by:** before we switch Stripe to **live** mode — not before launch, before *real cards*.
**Companion:** `stripe-account-handoff.md` (account setup), `../payments/stripe-primer.md` §6 (detail).

> Written 2026-07-10. Michael (developer) is not equipped to answer any of this and is not blocked by it.
> Everything we build runs against Stripe's **sandbox** — fake money, no obligations — until the final
> cutover session. This note simply needs to have left our hands before that session.

---

## What CradleHQ is about to start selling

Four **one-time** digital purchases through Stripe on `cradlehq.app`. No subscription.

| Item | Price | Kind |
|---|---|---|
| 50 AI credits | $5 | digital |
| 125 AI credits | $10 | digital |
| 150 credits + share unlock | $15 | digital |
| Share unlock (one book) | $10 | digital |

Later, a **printed book** (pay-per-order, ~$30–45). That one is a **physical good** — different tax
treatment, and it's not live yet.

The LLC is the **merchant of record**: customers pay us, Stripe deposits to the LLC's bank account.

## The three questions for an accountant

1. **US state sales tax.** Digital goods are taxable in many states, and economic-nexus rules vary by
   state. Where, if anywhere, does the LLC need to register and remit?

2. **EU / UK VAT.** On digital services sold to consumers, VAT generally applies **from the first sale,
   with no minimum threshold**. Does the LLC intend to sell there at all?

3. **Stripe Tax.** Stripe will *calculate and collect* tax for roughly 0.5% per transaction.
   ⚠️ **Collecting is not registering, and it is not remitting.** Those obligations stay with the LLC.
   Is turning it on worth it, and where would we need to register first?

## What we've already done to limit the exposure

We're adding a **Stripe Radar rule that blocks any card whose issuing country is not the US.**

- It keeps sales domestic and defers the EU/UK VAT question rather than accumulating a liability
  against it.
- It is **reversible in the Stripe dashboard in minutes**, the moment an accountant tells us where to
  register.
- It restricts who can **pay**, not who can **use** the app. International users keep using CradleHQ free.

**⚠️ Two things it does not do.** It does not settle **US state** obligations. And it does not make us a
US-only storefront — `cradlehq.app` is a public website, so the mobile apps being US-only says nothing
about who can reach the web store. The Radar rule is the mechanism doing the work here, not the app-store
availability setting.

## What we need back

**Ideally: nothing, before we go live.** We proceed US-cards-only on the assumption that's a reasonable
starting posture for a business at this scale.

**When there's time:**
- [ ] Confirm whether the LLC has a sales-tax registration obligation in any US state today.
- [ ] Decide whether to enable Stripe Tax, and where to register first.
- [ ] Tell us if the US-only card restriction should come off, and for which countries.

## Timing, plainly

| | |
|---|---|
| Blocks writing the code | ❌ No |
| Blocks testing payments | ❌ No — sandbox, fake money |
| Blocks shipping to the App Store | ❌ No |
| **Blocks taking the first real payment** | ✅ **Yes, in the sense that the obligation begins there** |

We are not asking anyone to solve this before we ship. We're asking that it be **in the owner's hands
before the first live charge**, so nobody is surprised later.

---

*Neither Michael nor any AI tool is qualified to give tax advice. The specifics above are stated so a
professional can be pointed at the exact question — they are not a legal or accounting opinion.*
