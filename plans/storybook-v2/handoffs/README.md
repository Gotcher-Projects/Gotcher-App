# plans/storybook-v2/handoffs — Vendor Account Setup & Credentials

Hand-off docs for setting up CradleHQ's **LLC-owned** vendor accounts and getting credentials to the
developer. Human-readable **PDFs** of each doc are in [`pdf/`](./pdf/); the markdown here is the source.

## Money-flow map

- **Stripe** = money **IN** — customers pay CradleHQ; Stripe pays out to the **LLC bank account**.
- **Lulu** = money **OUT** — we pay Lulu for print + shipping via a **company card on file**.
- **Anthropic** = usage billing — **company card**, no bank account.

## The docs

| Doc | Audience | Purpose |
|---|---|---|
| [`owner-setup-runbook.md`](./owner-setup-runbook.md) | Owner's Claude | Self-contained runbook for all three accounts, in order — paste into a fresh Claude |
| [`anthropic-api-key-handoff.md`](./anthropic-api-key-handoff.md) | Owner | Create the LLC Anthropic account + API key |
| [`stripe-account-handoff.md`](./stripe-account-handoff.md) | Owner | Create + activate the LLC Stripe account (bank, tax) and invite the developer as a team member |
| [`lulu-account-handoff.md`](./lulu-account-handoff.md) | Owner | Create the LLC Lulu account + Print API credentials |
| [`developer-credentials-handoff.md`](./developer-credentials-handoff.md) | Developer | Get test/sandbox credentials to build against |

## Recommended order

**Anthropic** (quick) → **Stripe** (longest — business + bank verification) → **Lulu**.

## Secret hand-back

**Stripe** needs no secret hand-back — the owner invites the developer as a team member and the developer
pulls the keys and configures the product/webhook directly. For **Anthropic** and **Lulu**, live/prod
secrets are delivered via a **Onetime Secret** one-time link + a passphrase sent on a separate channel
(text/call). Full step-by-step is embedded in every doc. Secrets never go in plain email/chat, the repo, or
git.

## Related engineering plans (the code side)

- Stripe integration: `../payments/stripe-full-plan.md`
- Lulu print spec (trim/bleed/color/min-pages): `../lulu-print-handoff.md`
