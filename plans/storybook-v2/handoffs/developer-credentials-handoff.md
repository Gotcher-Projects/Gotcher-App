# Developer Test / Sandbox Credentials

**Purpose:** how the developer gets the **test / sandbox** credentials to build and test against, once the
LLC-owned accounts exist. Live/production keys stay on the production server only. For **Stripe** you pull
both test- and live-mode values yourself once the owner invites you as a team member; for **Anthropic** and
**Lulu** the owner sends the live/prod secrets via a one-time link (see the owner hand-off docs).
**Audience:** the developer (Michael).

---

## Stripe — test mode (same account)

Stripe doesn't use a separate dev account — it has **Test mode** inside the same account, with its own keys.

1. In the Stripe dashboard, toggle to **Test mode** (or open a **Sandbox**).
2. From **Developers → API keys**, copy the **test keys**: `pk_test_...` and `sk_test_...`.
3. In test mode, create a **"Plus" product + $4.99/mo recurring price** (separate from the live one) and
   copy its test **price ID** (`price_...`).
4. For local webhooks, run the **Stripe CLI**:
   `stripe listen --forward-to localhost:3001/billing/webhook` — it prints a local signing secret
   (`whsec_...`) for your `.env`.
5. Test with Stripe's cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (decline).

**Live mode is also yours.** Because the owner invites you as a team member (Developer role), you set up the
**live** side too — create the live "Plus" $4.99/mo price, add the production webhook endpoint
(`https://cradlehq.app/billing/webhook`), and read the `sk_live_...` / `whsec_...` straight from the
dashboard. The owner does **not** send you any Stripe secret; there's nothing to hand back for Stripe.

See `../payments/stripe-full-plan.md` → "Testing Without a Live Stripe Account" for the full flow.

## Lulu — sandbox environment

Lulu has a **separate sandbox environment** with its own credentials and base URL.

1. In the Lulu developer portal, use the **sandbox** environment (base URL `https://api.sandbox.lulu.com`).
2. Use the **sandbox** client id + client secret (distinct from production).
3. Build and test all print-job calls here first; production credentials are only swapped in at deploy time.

## Anthropic — dev key

Anthropic has no test mode; just use a **separate key** so dev usage is isolated from production.

1. In the `cradlehq` org, optionally create a **dev workspace** with its own small spend limit.
2. Generate a key named **`cradlehq-dev`** and use it in your local `.env`.

## Which value goes where (env mapping)

| Env var | Local `.env` (dev) | Production `.env` (server) |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` (you pull, live mode) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from `stripe listen` | `whsec_...` from the prod webhook (you add) |
| `STRIPE_PRICE_PLUS_MONTHLY` | test `price_...` | live `price_...` (you create) |
| `LULU_API_BASE` | sandbox URL | production URL |
| `LULU_CLIENT_ID` / `LULU_CLIENT_SECRET` | sandbox creds | production creds (owner) |
| `ANTHROPIC_API_KEY` | `cradlehq-dev` | `cradlehq-prod` (owner) |

**Rule:** live/production keys never go in a local `.env` — they exist only on the production server.

## Receiving a secret via Onetime Secret

When the owner sends you a live secret, it arrives as a one-time link:

1. Open the link the owner emailed you.
2. Enter the **passphrase** they sent by text/call.
3. **Copy the secret** and place it directly into the production `.env` / deployment secrets.
4. The link is now destroyed — you can't reopen it. If it was already used when you opened it, tell the
   owner so they can regenerate and resend.
