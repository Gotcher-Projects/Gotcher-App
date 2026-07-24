# Anthropic (Claude) API Key — Account Setup Hand-off

**Purpose:** set up an **LLC-owned** Anthropic account and generate the API key CradleHQ uses for its AI
features, then hand the key back to the developer securely.
**Money flow:** Anthropic is a **vendor you pay** — usage is billed to a **company card**. No bank account
or payout is involved.

---

## Before you start (have these ready)

- [ ] The **LLC's legal name + business address** (for the billing / tax profile).
- [ ] A **company payment card** (Anthropic API billing is usage-based — you pre-buy credits or set
      auto-reload against the card).
- [ ] A **business email** for the account (an LLC address, e.g. an @cradlehq.app mailbox), with access to
      receive a verification email.
- [ ] The LLC's **tax ID / EIN** (in case Anthropic asks for a tax profile).

## Steps

1. Go to **console.anthropic.com** and sign up with the **business email**. Create an **Organization** for
   the LLC (use the LLC legal name).
2. **Billing:** add the company card and fill in the business/tax details. Add an initial credit amount
   (start small).
3. **Set a monthly spend limit + a low-balance alert** so usage can never produce a surprise bill. Pick a
   modest cap to start.
4. Create a **Workspace** named `cradlehq` so this app's usage and limit are isolated.
5. In that workspace, generate an **API key**. Name it **`cradlehq-prod`**. **Copy it immediately — the
   full key is shown only once.**

## What to hand back (the deliverable)

1. The **`cradlehq-prod` API key**, delivered via Onetime Secret (steps below).
2. A one-line confirmation that **billing is set up** and **what monthly spend limit** you chose.

## Send it securely (Onetime Secret — step by step)

Never paste the key into an email or chat message. Instead:

1. Open **onetimesecret.com** in your browser.
2. Paste the **API key** into the box.
3. Click **"Privacy Options"** and set a **passphrase** (make one up — it protects the secret). Optionally
   set a lifetime (e.g. 7 days).
4. Click **"Create a secret link"** and **copy the link**.
5. **Email the link** to the developer (the company Gmail is fine — the link is useless after one view).
6. **Send the passphrase separately** — a text or quick call, **not** in the same email.
7. Done. The link self-destructs the moment the developer opens it. If they report it was already used,
   it may have been intercepted → regenerate the key in step 5 above and repeat.

## Notes / gotchas

- **Cost is low** — CradleHQ uses a lightweight model, and the spend limit is the safety net.
- **Never commit the key** — it lives only in the deployment's secrets, never in a document, email, or code.
