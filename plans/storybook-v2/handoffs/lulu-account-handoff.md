# Lulu — Account + Print API Credentials Setup Hand-off

**Purpose:** set up an **LLC-owned** Lulu account and generate the **Print API** credentials CradleHQ's
print feature uses, then hand them back to the developer securely.
**Money flow:** CradleHQ uses Lulu's **Print API to fulfil orders** — the customer pays through **our own
checkout**, and Lulu charges a **company card on file** for printing + shipping. So Lulu needs a **company
card, not a payout bank account.** (Lulu also has a separate *Bookstore/retail* product where Lulu sells the
book and pays you royalties to a bank account — we are **not** using that, so don't link a bank account.)
**Companion:** the print **spec** questions (trim size, bleed, color profile, min pages) live in
`../print/lulu-spec-handoff.md`. This doc covers the **account + credentials**.

---

## ⚠️ OPEN — confirm with owner (noted 2026-07-07)

We received a Lulu **Client Key + Secret** from the owner. Almost everything else is developer-derivable
(base URLs are public constants; POD package ID + trim size are our own choice from Lulu's catalog; bleed/
color/spine/min-page specs come from Lulu's docs + the sandbox API once authenticated). **The one thing to
confirm with the owner:**

- **Is the Client Key + Secret we got the SANDBOX pair or the PRODUCTION pair?** We build against sandbox
  first, so we need the sandbox credentials. Also confirm a **separate production pair exists** for later
  (the setup steps asked for creds in *both* environments).

*(Not urgent — print is the last v2 track and is blocked on Payments regardless. Michael to message the
owner when convenient.)*

---

## Before you start (have these ready)

- [ ] The **LLC's legal name + business address**.
- [ ] A **company payment card** (Lulu charges it per print order).
- [ ] A **business email** for the account (an LLC address).
- [ ] The LLC's **tax ID / EIN** (for the business/tax profile; plus a resale/tax-exempt certificate if you
      have one).

## Steps

1. Create a **Lulu account** registered to the **LLC** (business email + LLC name). Use Lulu's **Print API
   developer portal** (developers.lulu.com) — the API product, not the consumer self-publishing wizard.
2. Fill in the **business + tax profile** (LLC name, address, tax ID) and add the **company card** as the
   payment method for print orders.
3. Locate Lulu's **sandbox (test) environment**, which is separate from production — the developer builds
   against sandbox first. Note both the **sandbox and production base URLs**.
4. In the developer portal, **create API credentials for BOTH sandbox and production**. Lulu's Print API
   uses **OAuth client-credentials** — you'll get a **client key + client secret** per environment.
5. From Lulu's **product catalog**, capture the **POD package ID (SKU)** and **trim size** for the book
   we'll print. (The rest of the print spec — bleed, color profile, min/max pages, cover — is answered in
   `../print/lulu-spec-handoff.md`.)
6. **Skim the API Terms of Service:** confirm API order submission from a **subscription app** is permitted,
   and check **white-label / unbranded shipping** (the keepsake should not arrive branded "Lulu").

## What to hand back (the deliverable)

1. **Client id + client secret for BOTH sandbox and production** (via Onetime Secret, below).
2. The confirmed **POD package ID** and **trim size**.
3. The **sandbox and production base URLs**.
4. A one-line **go/no-go** on: white-label shipping available? subscription-app API use permitted?

These become the backend env vars:

```
LULU_API_BASE=...          # sandbox vs prod base URL
LULU_CLIENT_ID=...
LULU_CLIENT_SECRET=...
LULU_POD_PACKAGE_ID=...     # the confirmed trim-size / product SKU
```

## Send it securely (Onetime Secret — step by step)

The client **secret** must never go in an email or chat message. Send it like this:

1. Open **onetimesecret.com** in your browser.
2. Paste the **client secret** into the box.
3. Click **"Privacy Options"** and set a **passphrase** (make one up — it protects the secret). Optionally
   set a lifetime (e.g. 7 days).
4. Click **"Create a secret link"** and **copy the link**.
5. **Email the link** to the developer (the company Gmail is fine — the link is useless after one view).
6. **Send the passphrase separately** — a text or quick call, **not** in the same email.
7. Repeat for each secret (sandbox and production). The non-secret items (client **id**, POD package id,
   trim size, base URLs) can go in the plain email alongside the links.

## Notes / gotchas

- **No "invite a teammate" option** — unlike Stripe, Lulu's Print API is accessed by the client id +
  secret, so handing those to the developer securely (above) *is* how they get access. That's expected, not
  a missing step.
- **Sandbox first** — the developer builds and tests against Lulu's sandbox before the production
  credentials are ever used.
- **Never commit secrets** — client secrets live only in the deployment's secrets, never in a document,
  email, or code.
