# Payments P0 — Stripe account: first login & setup

**Status:** Needs Verification — done 2026-07-10 (full webhook round-trip verifies in P3)
**Est:** ~2 hours · **Blocked on:** nothing (the owner has already created the account and invited Michael)
**Run before:** P1. This is the only thing standing between us and writing code.

> **Done 2026-07-10:** Developer role can create Products + read keys. Four one-time SKUs created in the
> sandbox, each Price carrying `sku` + `credits` metadata. `Backend/.env` holds the `sk_test_` key, four
> `price_` ids, and a laptop `whsec_` from `stripe listen` ("Ready!" confirmed). Stripe CLI v1.43.7 installed.
> `.env.example` updated to the four-SKU placeholders. Shareable walkthrough: `stripe-add-products-guide.html`.
> Not yet verified: an actual payment → webhook → grant round-trip (nothing listens at `/billing/webhook`
> until P3). Radar/activation observations still owed to P0.5.

**No app code this session.** Dashboard clicks, four Products, six env values, one CLI install.

> **Written for someone who has never used Stripe.** Michael is a **team member** on an LLC-owned
> account, not the owner. That distinction shapes half this session.

---

## What you're actually doing, in one paragraph

Stripe needs to know *what* we sell before our code can charge for it. You'll create four **Products**
(the things) each with one **Price** (the amount), in a **test sandbox** where no real money moves. Then
you'll copy six values into a `.env` file. Then you'll install a command-line tool that forwards Stripe's
"someone paid you" notifications to your laptop, because your laptop has no public address for Stripe to
reach. That's the whole session.

---

## Vocabulary (read this first — five terms, then it all makes sense)

| Term | What it actually is |
|---|---|
| **Product** | The thing you sell. "150 credits + share unlock." Just a name and a description. |
| **Price** | An amount attached to a Product. `$15.00`, one-time. Has an id like `price_1abc…`. **Our code only ever refers to Price ids, never to dollar amounts.** |
| **Checkout Session** | One attempt by one person to pay. Our server creates it; Stripe gives back a URL; we send the browser there. Stripe hosts the card form. |
| **Webhook** | Stripe's phone call back to us: "that session completed, they paid." **This — not the browser returning — is what makes us grant the credits.** |
| **Sandbox / test mode** | A parallel universe with fake money. Test cards work, real ones don't. Everything you create here exists *only* here. |

The single most important idea: **the browser landing on our success page proves nothing.** Anyone can
type that URL. Only the webhook is trustworthy. Everything in the build plan follows from that.

---

## Before you sit down

- [ ] The invite email from the LLC owner. Accept it if you haven't.
- [ ] Know which email the invite went to — you'll log in as that.
- [ ] `Backend/.env` exists locally (copy `Backend/.env.example` if not).

You do **not** need the EIN, the bank account, or activation. Those gate *live* payments, not this
session. Test mode works immediately, even on an unactivated account.

---

## Part 1 — First login and orientation (~30 min)

### 1. Log in and find your bearings

Go to `dashboard.stripe.com`. Log in as the invited email.

**⚠️ Stripe replaced the old "test mode" toggle with Sandboxes** (verified 2026-07-10). You now switch
environments with the **account/environment picker**, and there's a **Sandboxes** page. Your account comes
with a default test-mode sandbox. *Confirm you are in a sandbox, not live, before touching anything.*
Live mode will be visibly marked and, on an unactivated account, largely inert.

> If the UI doesn't match this description, trust the UI. Stripe reorganizes the dashboard often, and this
> paragraph is the single most likely thing in the plan to be out of date. **Don't fight it — look for the
> environment picker, tell me what you see, and we'll adapt.**

### 2. ⚠️ Check what your role lets you do — do this early

You have the **Developer** role (per `handoffs/stripe-account-handoff.md`). Per Stripe's docs, Developer
grants **API keys, webhooks, and logs**, and cannot edit **team or bank settings**. What the docs do *not*
say clearly is whether Developer can create **Products/Prices** and **Radar rules**.

**Find out now, not in an hour.** Try to open each of these:

- [ ] **Developers → API keys** — can you see a `sk_test_…` Secret key? (Expected: yes)
- [ ] **Product catalog** — is there a "＋ Add product" button, or is it greyed out?
- [ ] **Radar → Rules** — can you see the rules editor? (We need this in P8, not today.)

If Products or Radar are blocked, **stop and ask the owner** to either raise your role to Administrator or
create the four Products themselves. This is a five-minute email that otherwise blocks the whole track.
Better to discover it in minute ten than at the end.

### 3. While you're in there — two things to *observe* (5 min)

Not tasks. Just look, and write down what you see. Both feed **P0.5**, the decisions session.

- [ ] **Is the account activated, or still under review?** The dashboard says so plainly (usually a banner
      or Settings → Business). Activation gates *live* payments only — P1 through P11 run fine in the
      sandbox either way. But if it hasn't been *started*, that's a multi-week clock nobody has started,
      and it's the single thing most likely to make us finish the build and then sit waiting.
- [ ] **Can you open Radar → Rules?** (Also part of the role check above.) We need it in P8, not today.

Don't try to fix either. Just report them.

---

## Part 2 — Create the four SKUs (~45 min)

In the **test sandbox**. Product catalog → Add product. Four times.

For each: a name, a **one-time** price (Stripe defaults to recurring — **change it**), USD, and — the part
everyone forgets — **two metadata keys on the Price**.

| Product name | Price | one-time? | metadata `sku` | metadata `credits` |
|---|---|---|---|---|
| 50 AI credits | $5.00 | ✅ | `credits_50` | `50` |
| 125 AI credits | $10.00 | ✅ | `credits_125` | `125` |
| 150 AI credits + share unlock | $15.00 | ✅ | `bundle_share_150` | `150` |
| Share unlock | $10.00 | ✅ | `share_only` | `0` |

**Why metadata?** Our webhook reads how many credits to grant *from the Price itself*. The alternative — a
lookup table hardcoded in Java — silently drifts the day someone edits a price in the dashboard. Put the
truth in one place.

**⚠️ `mode: payment`, not `subscription`.** If a price is created as "recurring," our code will reject it
and you'll spend an hour confused. We sell nothing recurring. There is no subscription, no Plus tier, no
monthly anything — if a doc tells you otherwise, that doc is from before 2026-07-09.

After each, copy the **Price id** (`price_1…`, *not* the Product id `prod_…`). Four ids.

---

## Part 3 — Keys and env (~15 min)

**Developers → API keys**, in the sandbox. You need exactly one: the **Secret key** (`sk_test_…`).

- **Never** put a secret key in the frontend, a commit, or a screenshot.
- We do **not** need the Publishable key (`pk_…`). We never load Stripe.js — Stripe hosts the payment page
  and the browser never touches a card number in our code. If a tutorial hands you a `pk_`, it's building
  something we aren't.

Fill in `Backend/.env` (P1 adds these to `application.properties`):

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=            # ← leave blank; Part 4 gives you this
STRIPE_PRICE_CREDITS_50=price_...
STRIPE_PRICE_CREDITS_125=price_...
STRIPE_PRICE_BUNDLE_SHARE_150=price_...
STRIPE_PRICE_SHARE_ONLY=price_...
```

---

## Part 4 — The Stripe CLI and your first webhook (~30 min)

Stripe needs to POST to us when a payment completes. `localhost:3001` has no public address. The CLI opens
a tunnel.

```sh
# Windows: winget install Stripe.StripeCLI   (or scoop install stripe)
stripe login                                        # opens a browser, authorizes the CLI
stripe listen --forward-to localhost:3001/billing/webhook
```

That last command prints a **`whsec_…`**. Put it in `STRIPE_WEBHOOK_SECRET`.

> **⚠️ Budget half an hour of confusion for this exactly once.** The `whsec_` the CLI prints is **for your
> laptop only**. The production endpoint gets a *completely different* `whsec_`. They are not
> interchangeable, and using the wrong one produces a signature failure that looks like nothing at all —
> no error message that names the cause. When webhook verification mysteriously fails, this is why.

Nothing listens at `/billing/webhook` yet — that's P3. Today, seeing the CLI print `whsec_` and say
"Ready!" is the whole win.

**Optional, and satisfying:** `stripe trigger checkout.session.completed` fires a fake event. You'll see
the CLI report a 404. That 404 is correct — it proves the tunnel works and our endpoint doesn't exist yet.

---

## Test cards (for later sessions — memorize `4242`)

| Card | Does what |
|---|---|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 9995` | Declines |
| `4000 0025 0000 3155` | Forces a 3-D Secure challenge (changes redirect timing) |

Any future expiry, any CVC, any ZIP.

---

## Done when

- [ ] You can log in, and you know whether your role can create Products and Radar rules.
- [ ] Four Products exist **in the sandbox**, each with a **one-time** Price carrying `sku` + `credits` metadata.
- [ ] `Backend/.env` has the secret key, four price ids, and a `whsec_` from the CLI.
- [ ] `stripe listen` runs and prints "Ready!".
- [ ] **Nothing secret was committed.** `.env` is gitignored; `.env.example` holds only placeholders.

## Closing debrief — 5 minutes, don't skip (this is data)

**Did this session actually fit in two hours?** Write the real number down.

Every session from here is scoped to a ≤2h cap. That cap is currently a *guess* — nobody has measured a
session against it. P0 is the first data point. If P0 ran 3.5 hours, every downstream estimate is wrong by
the same factor and we should find that out now rather than at P6.

Also note: what took longer than expected, and what was trivial? Feeds **P0.5** and the re-slice checkpoint.

## Not this session

Activation, EIN, bank account (owner's job, multi-week, blocks *live* only) · the Radar US-only rule (P8) ·
any Java (P1) · live-mode keys (P12, and they are **different price ids** — test and live are separate
universes) · **refund posture, tax, and who owns the unowned items → P0.5**, immediately after this.

---

## For me to remember when we run this

- Michael has **never used Stripe**. Explain *why* before *where to click* — the "webhook, not redirect"
  idea especially, since every later design decision falls out of it.
- The dashboard will not match this doc exactly. **Ask him what he sees rather than insisting.**
- The role check is the one step that can block everything. Do it in the first ten minutes.
- Do not let a stray `pk_` key or a "recurring" price slip through. Both are cheap to catch now and
  expensive to debug in P3.
