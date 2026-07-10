# Stripe — Account Setup Hand-off

**Purpose:** set up an **LLC-owned** Stripe account, activate it for live payments, and invite the developer
as a team member so they can wire up payments. No secrets change hands by email for Stripe.

> **Updated 2026-07-10.** This doc originally said "subscriptions" and a `$4.99/mo` recurring price.
> **There is no subscription.** CradleHQ sells four **one-time** SKUs (credit packs + a per-book share
> unlock). The owner-side steps below are unchanged — account, EIN, bank, activate, invite the developer.
> ✅ **Done:** the account exists and the developer has been invited (2026-07-10).
**Money flow:** Stripe is where **money comes IN** — customers pay CradleHQ through Stripe, and Stripe pays
out to the **LLC's bank account**. (This is the account that later also funds the print feature, where we
collect the customer's payment here and pay the printer separately.)
**Companion:** the payment *integration* is planned in `../payments/stripe-full-plan.md`. This doc covers
**account creation + credentials**.

---

## Before you start (have these ready)

- [ ] The **LLC's legal name + business address**.
- [ ] The LLC's **tax ID / EIN**.
- [ ] The **LLC's bank account details** (account + routing number) — this is where Stripe deposits the
      money customers pay.
- [ ] A **company representative's identity details** — Stripe legally requires a real person for the
      account: full name, date of birth, home address, and (US) the **last 4 of their SSN**.
- [ ] A **business email** for the account (an LLC address).

## Steps

1. Go to **stripe.com** and sign up with the **business email**.
2. In **Business settings**, set the account type to **Company / LLC** and enter the LLC legal name,
   address, and **EIN**.
3. Enter the **representative's identity details** (Stripe's identity check / KYC).
4. **Link the LLC bank account** for payouts.
5. **Activate the account** — Stripe reviews the details; once approved, live payments are enabled.
6. **⭐ Invite the developer as a team member.** Go to **Settings → Team**, invite the developer's email,
   and choose the **Developer** role. **This is the one technical step that matters** — it lets the
   developer create the subscription product, set up the webhook, and pull both the test- and live-mode keys
   themselves, so no secrets ever have to change hands by email.

That's the whole job. Everything below (product, price, webhook, keys) is done by the **developer** from
inside the account once the invite is accepted — it's listed here only so you know what's happening.

## What to hand back (the deliverable)

**Nothing secret.** Just confirm two things in a plain email:

1. The **developer's team invite was sent** (and, ideally, accepted).
2. The account is **activated** (or still under review — either is fine; the developer can work in test mode
   meanwhile).

## What the developer sets up (for reference — not your task)

Once invited, the developer configures these from inside the account and reads the values directly:

```
STRIPE_SECRET_KEY=sk_live_...              # live Secret key, from Developers → API keys
STRIPE_WEBHOOK_SECRET=whsec_...            # from the production webhook endpoint they add
STRIPE_PRICE_CREDITS_50=price_...          # $5  → 50 credits
STRIPE_PRICE_CREDITS_125=price_...         # $10 → 125 credits
STRIPE_PRICE_BUNDLE_SHARE_150=price_...    # $15 → 150 credits + unlock one book
STRIPE_PRICE_SHARE_ONLY=price_...          # $10 → unlock one book
```
All four are **one-time** prices, not recurring.

> **⚠️ One thing the owner may still need to do.** The **Developer** role grants API keys, webhooks, and
> logs. Whether it can create **Products/Prices** and edit **Radar rules** is not documented clearly. If
> the developer finds those greyed out at first login, the owner must raise the role to Administrator (or
> create the four Products themselves). It's a five-minute change that otherwise blocks all payment work.

## Notes / gotchas

- **The developer can start before activation** — Stripe's test mode works immediately, so build/testing
  isn't blocked while account review/bank verification completes (that can take a few days).
- **The team invite is the whole handoff** — because the developer has account access, there's no
  one-time-secret step for Stripe (unlike Anthropic and Lulu). If you ever remove the developer's access,
  they lose the ability to manage pricing and keys.
- **Never commit secrets** — the live secret key and webhook secret live only in the deployment's secrets,
  never in a document, email, or code.
