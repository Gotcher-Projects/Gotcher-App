# CradleHQ — Vendor Account Setup Runbook (for the owner's Claude)

> **How to use this:** paste this whole document into a Claude conversation. It is self-contained — Claude
> does not need any files or code to help you. Claude will walk you through creating three accounts and will
> tell you exactly what to send back to the developer at the end.

---

## Instructions to Claude

You are assisting the **owner of the LLC** in setting up three vendor accounts for the **CradleHQ** app.
The owner is **not technical** — guide them one step at a time, ask for the inputs you need before each
account, keep them oriented, and at the end produce a **credentials checklist** to hand back to the
developer. Do the accounts **in this order**: **1) Anthropic, 2) Stripe, 3) Lulu.** After each account,
confirm what was captured before moving on.

## What these three accounts are (money-flow map)

- **Anthropic (Claude AI)** — powers the app's AI writing feature. **A vendor we pay**; usage is billed to a
  **company card**. No bank account involved.
- **Stripe** — where **customer money comes IN**. Customers pay CradleHQ through Stripe, and Stripe pays out
  to the **LLC bank account**. Needs the LLC bank account + a company representative's ID details.
- **Lulu** — prints and ships physical books. **A vendor we pay** via a **company card on file**; the
  customer's payment is collected through our own Stripe checkout, not Lulu. No payout bank account needed.

## Have these ready before starting

- LLC **legal name + business address**
- LLC **tax ID / EIN**
- A **company payment card**
- The **LLC bank account** details (account + routing number) — for Stripe payouts
- A **company representative's** details: full name, date of birth, home address, and (US) **last 4 of SSN**
- A **business email** you can receive verification emails at

---

## Account 1 — Anthropic (Claude API key)

1. Go to **console.anthropic.com** and sign up with the **business email**. Create an **Organization** using
   the **LLC legal name**.
2. Open **Billing** → add the **company card** and business/tax details → add a small starting credit amount.
3. Set a **monthly spend limit** and a **low-balance alert** (a safety net against surprise bills).
4. Create a **Workspace** named **`cradlehq`**.
5. In that workspace, generate an **API key** named **`cradlehq-prod`**. **Copy it now — it's shown only
   once.** Hold onto it for the hand-back step.

**Capture:** the `cradlehq-prod` API key.

## Account 2 — Stripe

1. Go to **stripe.com** and sign up with the **business email**.
2. In **Business settings**, set the account type to **Company / LLC**; enter the LLC legal name, address,
   and **EIN**.
3. Enter the **representative's identity details** (name, DOB, home address, last-4 SSN) for Stripe's
   identity check.
4. **Link the LLC bank account** (for payouts).
5. **Activate the account** and wait for Stripe's approval (this can take a few days — that's fine, the
   developer can keep working in the meantime).
6. **⭐ Invite the developer as a team member (Developer role).** Go to **Settings → Team**, invite the
   developer's email, and choose the **Developer** role. **This step is essential** — it's what lets the
   developer set up the subscription product, the webhook, and pull the live keys directly. Without it, the
   developer is blocked on you for every pricing or key change.

That's all you need to do for Stripe. Once you've sent the invite, the developer handles the rest
(subscription product, price, webhook, and the live API keys) from inside the account — so **there are no
Stripe secrets for you to hand back.**

**Capture:** nothing — just confirm the developer's team invite was sent and accepted.

## Account 3 — Lulu

1. Go to **developers.lulu.com** and create an account registered to the **LLC** (business email + LLC name).
   Use the **Print API** product (not the consumer self-publishing wizard).
2. Fill in the **business + tax profile** and add the **company card** as the print-payment method.
3. Find Lulu's **sandbox (test)** environment; note both the **sandbox and production base URLs**.
4. Create **API credentials for BOTH sandbox and production** (a **client id + client secret** for each).
5. In Lulu's **product catalog**, note the **product/package ID** and **trim size** for the book (the
   developer can tell you which product if unsure).
6. Check two things in Lulu's terms: **unbranded/white-label shipping** is available, and **API orders from a
   subscription app** are allowed.

> **Note:** Lulu has **no "invite a teammate" option** like Stripe does — its Print API is accessed by the
> client id + secret, so handing those to the developer (securely, below) *is* how they get access. That's
> expected, not a missing step.

**Capture:** sandbox client id + secret, production client id + secret, the package ID, trim size, both base
URLs, and the two yes/no answers above.

---

## Handing the secrets back — securely

Some captured items are **secret** (the Anthropic key and the Lulu client **secrets**). **Never** paste a
secret into an email or text. Send each one as a **one-time self-destructing link**:

1. Open **onetimesecret.com** in your browser.
2. Paste the **secret value** into the box.
3. Click **"Privacy Options"** and set a **passphrase** (make one up). Optionally set a lifetime (e.g. 7 days).
4. Click **"Create a secret link"** and **copy the link**.
5. **Email the link** to the developer (the company Gmail is fine — the link stops working after one view).
6. **Send the passphrase separately** — a text or a quick call, **not** in the same email.
7. Repeat for each secret. If the developer says a link was already used when they opened it, regenerate that
   key/secret and resend.

The **non-secret** items (Lulu package ID + trim size + base URLs, and the two yes/no answers) can go in the
plain email.

## Final hand-back checklist

- [ ] Anthropic `cradlehq-prod` API key → one-time link + passphrase
- [ ] Stripe: **developer invited as a team member (Developer role)** — no secrets to send; developer pulls
      the live keys and sets up the product/webhook themselves
- [ ] Lulu **sandbox** client id + secret → id in plain email, secret via one-time link + passphrase
- [ ] Lulu **production** client id + secret → id in plain email, secret via one-time link + passphrase
- [ ] Lulu package ID, trim size, sandbox + production base URLs → plain email
- [ ] Lulu: white-label shipping? subscription-app API allowed? → plain email
