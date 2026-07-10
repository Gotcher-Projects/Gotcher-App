# Stripe — Primer & Pre-Flight

**Status: Reference. Written 2026-07-09 during `sv2-s9.6`.** Read before Payments S1.
**Canonical build plan:** `stripe-full-plan.md` (this file is the *why* behind it).

This is orientation, not a spec. It captures what you need to understand before the first Payments
session, the traps that are specific to *this* codebase, and the decisions that must be made outside
the code.

---

## 0. What we sell (recap)

No subscription. Four one-time SKUs, plus print.

| Thing | Kind | Scope | Sold via |
|---|---|---|---|
| AI credits (packs of 50 / 125) | **digital** | account | Stripe |
| Book share unlock ($10) | **digital** | one book | Stripe |
| Bundle: 150 credits + share ($15) | **digital** | account + book | Stripe |
| Printed book (pay-per-order) | **physical** | one book | Stripe (`sv2-s12`) |

The digital/physical split is not pedantry — it decides what the mobile app stores allow (§9).

---

## 1. The object model — fewer parts than the docs suggest

- **Product** — the thing ("150 credits + share"). **Price** — an amount attached to it.
  Create four Products with one Price each **in the Dashboard**; the backend only ever refers to the
  resulting `price_...` IDs.
- **Checkout Session** — a short-lived, *server-created* object representing one attempt to pay. It
  returns a `url`; you redirect the browser there. Stripe hosts the page and handles the card,
  Apple Pay, Google Pay, and 3-D Secure.
- **Customer** — ties purchases to a person. Not strictly required for one-time payments, but storing
  `stripe_customer_id` gets a clean dashboard view and automatic receipt emails.
- **Event** — what Stripe POSTs to your webhook when something happens.

**We do not need the publishable key and we never load Stripe.js.** The hosted-redirect flow means the
frontend's entire job is: call our own `/billing/checkout`, then `window.location.href = data.url`.
No `pk_...`, no client-side Stripe SDK, and the browser never touches a card number.

---

## 2. Test mode and live mode are separate universes

Different API keys. Different webhook signing secrets. **Different Product and Price IDs.**

Everything created in test must be created *again* in live, and the four `STRIPE_PRICE_*` env vars
hold different values per environment. This is the most common source of "it worked yesterday."

| Key | Where | Notes |
|---|---|---|
| `sk_test_...` / `sk_live_...` | server only, env | never in the frontend, never in git |
| `whsec_...` | server only, env | **one per webhook endpoint.** The Stripe CLI prints a *different* one for local. |
| `pk_...` | — | **not needed** (see §1) |

---

## 3. ⚠️ THE RULE: fulfill on the webhook, never on the redirect

`successUrl` is just a place the browser lands. **Arriving there proves nothing.** The user can close
the tab, lose signal, or type the URL by hand. If `/upgrade-success` grants credits, anyone can grant
themselves credits by visiting `/upgrade-success`.

Credits and share unlocks are granted in **exactly one place**: the `checkout.session.completed`
webhook handler, behind the `stripe_events_applied` idempotency ledger.

**Consequence for the UI:** the success page must not assume the grant has landed. The webhook usually
arrives within milliseconds of the redirect, but it is *not ordered* relative to it. Show
"Confirming your purchase…", poll `GET /auth/me` until the balance changes, and degrade gracefully
after a few seconds.

---

## 4. Webhooks in Spring — the sharp edges

**Signature verification hashes the exact raw request bytes.** Accept `@RequestBody String payload` and
pass it to `Webhook.constructEvent(payload, sigHeader, secret)` untouched. If Spring deserializes to a
DTO, your re-serialized JSON won't match the signature and verification fails for reasons that look
like nothing at all.

**The endpoint is public.** Add `/billing/webhook` to the `permitAll` matchers in `SecurityConfig` —
Stripe doesn't send our JWT. **The signature verification *is* the authentication.**

**⚠️ This is where our documented 401 trap gets expensive.** `CLAUDE.md`: an uncaught `RuntimeException`
in a controller re-dispatches to `/error` unauthenticated and surfaces as **401, not 500**. Stripe reads
any non-2xx as failure and **retries with backoff for up to ~3 days**. So one stray NPE becomes: 401 →
retry → NPE → retry, for days, while a paying customer receives nothing.

> Catch `Exception`. Log it. Return **200** once the event is durably recorded. Reconcile out of band.
> Return 4xx **only** for a genuine signature failure.

Retries also mean events arrive **more than once**, and events can arrive **out of order**. That is the
entire reason for the ledger: insert the `evt_...` id first, grant only if the insert won, all in one
transaction.

**The other direction of idempotency:** on requests *we* send Stripe, an `Idempotency-Key` header stops
a double-clicked Buy button from creating two Customers or two Sessions.

---

## 5. Money

**Amounts are integers in the smallest currency unit.** $15.00 is `1500`. Never a float, never a
`double`. Currency is fixed when the Price is created.

**Fees:** ~2.9% + $0.30 per successful charge (US cards — *verify in the dashboard*; international
cards and currency conversion add roughly 1.5% each). There is **no threshold** — the effective cut is
`2.9% + $0.30/price`, which falls smoothly with basket size:

| $1 | $2 | $5 | $10 | $20 | $50 |
|---|---|---|---|---|---|
| 32.9% | 17.9% | 8.9% | 5.9% | 4.4% | 3.5% |

This is why "$2 for 20 credits" was dropped. For comparison, Claude (Haiku 4.5, ≤1024 output tokens)
costs ~**$0.002/credit typical, $0.007 worst case** — Stripe is the dominant cost by a wide margin.

**Refunds return the customer's money but Stripe keeps the fee.** Refunding a $15 bundle costs us the
$0.74 already paid. **Chargebacks are worse:** a dispute fee (~$15 US) *on top of* losing the sale — a
single chargeback on a $15 product wipes out two successful ones.

> Design implication: the "I unlocked the wrong book" refund is the one we've invented for ourselves.
> Making the book name impossible to miss at checkout is cheaper than any refund flow.

---

## 6. Tax — ask an accountant, not a model

We are **merchant of record**: we sell to the customer, and separately we pay Lulu.

- **Digital goods** are taxable in many US states (economic nexus rules vary by state).
- Selling to **EU/UK consumers**, VAT on digital services generally applies **from the first sale, with
  no threshold**.
- **Stripe Tax** will calculate and collect for ~0.5%/transaction — but *collecting is not registering
  and remitting*. Those obligations land on the LLC.

**Neither Claude nor any model is qualified to advise here.** Ask an accountant before the first live
dollar, not after.

### DECIDED 2026-07-09 (Michael): restrict the web store to US cards for v1

Add a **Stripe Radar rule blocking payments whose card issuing country is not `US`**. This makes the web
store match the US-only app-store posture — one coherent "we sell in the US" story — and defers the
whole VAT question rather than accumulating a liability against it. Reversible in the dashboard the
moment an accountant says where to register.

- Build this **as part of Payments S1**, not as an afterthought.
- **Verify the exact Radar rule surface in the dashboard** — Claude is reasoning from memory about
  Stripe's rule syntax (`:card_country:`), not from the current docs.
- **A blocked card produces a decline the customer won't understand.** Handle it: detect the block and
  show "We currently only sell in the US" rather than a raw Stripe error.
- Note this does **not** limit who can *use* the app, only who can *pay*. Free-tier international users
  are unaffected.

---

## 7. Account activation — start this NOW, it has lead time

Live mode requires business details, an EIN, a bank account, and identity verification of the owner.
Per `handoffs/`, the Stripe account is to be **LLC-owned**. That is a multi-day (sometimes multi-week)
process involving someone other than the implementing session.

**Everything in S1 and S2 is fully buildable against test mode.** Only the final key swap and a live
smoke test need an activated account. Don't let this block the build — but don't start it late either.

---

## 8. Local development

```sh
stripe login
stripe listen --forward-to localhost:3001/billing/webhook   # prints a whsec_ FOR LOCAL ONLY
stripe trigger checkout.session.completed                    # synthetic event, no card needed
```

The local `whsec_` is **different** from the one the production endpoint gets. Budget half an hour of
confusion for this exactly once.

Test cards (any future expiry, any CVC):

| Card | Behavior |
|---|---|
| `4242 4242 4242 4242` | succeeds |
| `4000 0000 0000 9995` | declines |
| `4000 0025 0000 3155` | forces a 3-D Secure challenge (changes redirect timing — exercise it once) |

**Production:** register the endpoint URL in the Dashboard. Caddy must proxy it to `:3001` with the
`Stripe-Signature` header intact — a proxy that rewrites or drops headers produces the same silent
verification failure as body-parsing.

---

## 9. ⚠️ The mobile app stores — the biggest open question

`Frontend/ios/` and `Frontend/android/` both exist; Capacitor is in `package.json`. This is not
hypothetical.

**Apple and Google both require digital goods sold inside an app to use their billing**, not Stripe.
Credits and the share unlock are unambiguously digital. Commission is 30%, or 15% under Apple's Small
Business Program (we'd qualify, being under $1M/yr). Margins survive that; the real cost is that it is
a **second, entirely separate purchase implementation** — StoreKit / Play Billing, receipt validation,
a separate server-side grant path. That roughly doubles the Payments track.

**The printed book is the opposite case.** It's a physical good, so Apple's rules *forbid* using IAP
for it. Stripe is correct there. `sv2-s12` is safe on both platforms.

### The decided position (2026-07-09, Michael): purchases are WEB-ONLY, Stripe only, no IAP

- The web app (`cradlehq.app`) shows the buy buttons.
- The native builds **show no purchase UI** for credits or the share unlock.
- Credits bought on the web are spent in the app. **See the 3.1.3(b)/(f) catch below — this needs the
  right exemption, and it is not the one you'd assume.**
- The **printed book** is a physical good: Stripe is *mandatory* and the button can live in the app.

**This falls out of `sv2-s10b`'s design for free.** `AiCreditsContext` exposes an `onGetCredits`
callback that is *deliberately left undefined* until Payments ships, making the out-of-credits state
informational rather than a call to action. On native, **leave it undefined permanently.** Gate the web
purchase UI behind a platform check (`Capacitor.isNativePlatform()`); do the same for the share upsell
in `StorybookTab`. One seam, both platforms.

### What the guidelines actually say — checked against primary sources 2026-07-09

Sources: [Apple App Review Guidelines §3.1](https://developer.apple.com/app-store/review/guidelines/) ·
[Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818) ·
[Google Play US policy update](https://support.google.com/googleplay/android-developer/answer/15582165)

#### Apple

**3.1.3(e) — physical goods.** Verbatim: *"If your app enables people to purchase physical goods or
services that will be consumed outside of the app, you **must** use purchase methods other than in-app
purchase."* The printed book **must** go through Stripe. Not merely permitted — required. The app can
carry a fully functional "Order a printed book" button on both platforms.

**3.1.1 — digital goods.** Unlocking features or functionality in-app (explicitly including "in-game
currencies" and "premium content") must use IAP. Credits and the share unlock are squarely in scope.

**3.1.1(a) — external links.** Verbatim: *"These entitlements are **not required** for developers to
include buttons, external links, or other calls to action in their **United States storefront** apps."*
And: *"In all other storefronts, except for the United States storefront, where this prohibition does
not apply, apps and their metadata **may not** include buttons, external links, or other calls to action
that direct customers to purchasing mechanisms other than in-app purchase."*

> **So the link-out is legal on the US storefront and illegal almost everywhere else.** The same build
> shipped globally violates 3.1.1 in the UK, Canada, Japan, Australia, and most other regions. Links
> must open in the user's default browser, outside the app.

**⚠️ 3.1.3(b) — the catch that breaks the obvious plan.** Verbatim: *"Apps that operate across multiple
platforms may allow users to access content, subscriptions, or features they have acquired in your app
on other platforms or your web site … **provided those items are also available as in-app purchases
within the app**."*

Read that condition. The multiplatform allowance — "let users spend credits they bought on the web" —
is granted **only if the same items are also purchasable via IAP inside the app.** It does **not**
authorise "web-only purchases, app just consumes them."

**3.1.3(f) — the clause we'd actually be relying on.** Verbatim: *"Free apps acting as a stand-alone
companion to a paid web based tool (i.e. VoIP, Cloud Storage, Email Services, Web Hosting) do not need
to use in-app purchase, provided there is no purchasing inside the app, or calls to action for purchase
outside of the app."*

This is the exemption that permits web-only purchase with no IAP. Two problems: (1) its examples are
all *paid web tools*, and CradleHQ's core app is **free** with AI as a paid add-on — whether we qualify
is a judgement call a reviewer makes, not a settled fact; (2) it requires **no purchasing AND no calls
to action** in the app. The 3.1.3 preamble carves out the US storefront from the no-CTA half
(*"except for apps on the United States storefront"*), which **appears** to let a US-storefront app keep
both the exemption and the link — but that is our reading of two clauses read together, not a ruling.

#### Google

More permissive on the consumption question. Play billing is required for "digital items (such as
virtual currencies…)", **but** apps where users access content purchased elsewhere are permitted
without offering Play billing — with **no IAP-parity condition** of the kind Apple's 3.1.3(b) imposes.
Physical goods are exempt, same as Apple.

On steering: developers cannot lead users to another payment method inside the app **except under
specific programs**. Following *Epic v. Google*, developers *"may offer users in the U.S. additional
alternative billing options or lead users in the U.S. to external content outside of the app **if they
are enrolled in the appropriate program(s)**"* — external-link and alternative-billing policies
launched **2025-12-09**. **Enrollment is required; it is not automatic.**

> ⚠️ **Google's rules are actively in motion.** A March 2026 Epic/Google settlement is *not yet
> approved*; Judge Donato set a summer 2026 evidentiary hearing. Re-check before shipping.

### The consequence for us

| Want | US storefront | Everywhere else |
|---|---|---|
| Sell the **printed book** via Stripe in-app | ✅ **required** (3.1.3(e)) | ✅ required |
| Spend **web-bought credits** in-app, no IAP offered | ⚠️ relies on Apple 3.1.3(f), not 3.1.3(b) | ⚠️ same, and no CTA allowed |
| **Link/button** to the web store | ✅ Apple: no entitlement needed · Google: enroll in the US linking program | ❌ Apple 3.1.1 violation |
| **Text** telling users to buy on the site | ✅ (US storefront carve-out) | ❌ counts as a "call to action" |

### DECIDED 2026-07-09 (Michael): native apps ship to the **US storefront only**

1. **App Store + Play availability: United States only**, at first. The link-out is then explicitly
   permitted by Apple (3.1.1(a) US carve-out) and by Google on program enrollment.
2. **Enroll in Google Play's US external-offers/linking program before shipping the link.** Enrollment
   is required and is not automatic.
3. **Keep the print button in the app.** It's the highest-revenue item and Stripe is *mandatory* for it
   (3.1.3(e)).
4. **All digital purchases are Stripe, on the web. No IAP, on either platform.**
5. If you later ship outside the US, the purchase link and any steering copy must be **hidden by
   storefront, not merely by platform** — and Capacitor cannot reliably read the App Store storefront.
   Assume "global release" means "no purchase UI in the app at all."

### "Link out → pay on web → return and use it" — is that allowed?

Michael's question, 2026-07-09. It is **three permissions**, not one, and they differ in confidence:

| Act | Governed by | Verdict |
|---|---|---|
| 1. The **link/CTA** in the app | Apple 3.1.1(a) US carve-out; Google US linking program | ✅ **Allowed.** No entitlement (Apple). Enrollment required (Google). |
| 2. Paying on `cradlehq.app` | nothing — it's our website | ✅ Not Apple's concern |
| 3. **Returning and spending** the credits in-app, with **no IAP offered** | Apple 3.1.3(f) | ⚠️ **The contested one** |

**The bind.** 3.1.1 requires IAP to unlock in-app functionality and explicitly names *"in-game
currencies"* — a credit is exactly that. The exemption that would cover consuming a web purchase,
**3.1.3(b), grants it only "provided those items are also available as in-app purchases within the
app"** — which we don't offer, so it doesn't apply. The clause that fits our shape is **3.1.3(f)**
(free stand-alone companion apps), which grants the no-IAP exemption *"provided there is no purchasing
inside the app, **or calls to action for purchase outside of the app**."*

> **3.1.3(f) gives the no-IAP exemption on condition of no CTA. 3.1.1(a) gives the CTA.** Taking both
> means claiming an exemption whose stated condition you just violated. The 3.1.3 preamble carves the US
> storefront out of its own no-encouragement sentence, which *probably* resolves it — but that is two
> clauses stitched together, not a written rule.

**Act 3 alone is the ordinary SaaS pattern** (Notion, Slack, Dropbox, Figma) and is what 3.1.3(f) exists
for. **Act 1 + Act 3 together is the untested combination.**

### ✅ Plan of record: staged submission

The stake is a **rejected review, not legal jeopardy.** Probe it; don't theorize.

1. **v1 submission: no purchase UI in the app at all.** No button, no link, no "visit our site" copy.
   The out-of-credits state is informational and stops there. This sits squarely inside 3.1.3(f) and
   claims nothing contested. It is also *already what `sv2-s10b` built* (`onGetCredits` undefined).
2. **Get approved.**
3. **Add the link in a point release.** If it passes, keep it. If rejected, pull it and resubmit — one
   lost cycle, and the web store worked the whole time.

Shipping the contested combination in the **initial** submission risks the one review where rejection
actually hurts. Do it in an update instead.

**Softeners:** per `project_apple_developer`, iOS submission is separately gated (Michael isn't the
account owner, can't create Distribution certs) — so this is less urgent than it looks. And the
**printed book is a physical good**: Apple *requires* it be sold outside IAP, so that button can ship
on day one with no argument.

> ### ⚠️ US storefront ≠ US customers
> App-store availability restricts **who can download the app**. It does **not** restrict who can buy.
> `cradlehq.app` is a public website and all four digital SKUs are sold there — an EU consumer can load
> it and pay tomorrow. **The VAT exposure in §6 is created by the web store and is untouched by this
> decision.** Restricting web sales to the US is a separate mechanism (Stripe Radar rule on
> `card_country`, or Stripe Tax + registration) and a separate decision. Do not assume §9 solved §6.

**None of this is legal advice.** The guidelines are quoted above so a lawyer or an accountant can be
pointed at the exact clause. 3.1.3(f) qualification is the one a reviewer could reasonably dispute.

### The engineering consequence, whichever way the rules land

Build the entitlement layer so it **doesn't care where the purchase happened**. Credits are a balance;
the share unlock is a column on `books`. Neither knows about Stripe. If IAP or link-outs become
necessary later, they add a *new grant path* into the same ledger — not a rewrite. Keep the purchase UI
behind a single platform flag so it can be enabled per-platform without touching the backend.

---

## 10. Pre-flight checklist

**Nothing here blocks Payments S1.** Every SKU is sold on the web; the Stripe build is identical under
every mobile posture. These are the out-of-code decisions, ordered by lead time.

### Blocks the *live* launch, not the build — start now
- [ ] **LLC Stripe account** activation: business details, EIN, bank account, owner identity. Multi-week. (§7)
- [ ] **Refund posture**, especially a share unlock applied to the wrong book. (§5)

### Blocks app submission, not the build
- [x] ~~Set App Store + Play availability to **United States only**~~ — ✅ already US-only (2026-07-09).
- [ ] **Enroll in Google Play's US external-offers/linking program.** Required before shipping the link.
- [ ] Have a lawyer glance at the 3.1.3(f) qualification if real revenue depends on it. (§9)
- [ ] *(Blocked separately: per `project_apple_developer`, Michael is not the Apple account owner and
      cannot create Distribution certificates. iOS submission is gated on that regardless.)*

### Done during S1
- [ ] Four Products/Prices created **in test mode**, with `sku` + `credits` in each price's metadata.
- [ ] `/billing/webhook` added to `SecurityConfig` `permitAll`. (§4)
- [ ] Caddy passes `Stripe-Signature` through to `:3001`. (§8)

### Done during S2 (frontend)
- [ ] Purchase UI gated behind `Capacitor.isNativePlatform()` — one flag, both platforms. On native,
      `AiCreditsContext.onGetCredits` stays **undefined**, exactly as `sv2-s10b` already built it.
- [ ] Native out-of-credits state is **informational, never a call to action** (until the US link ships).

## 11. Things that will bite, in one list

1. Granting on the redirect instead of the webhook. **Free credits for anyone who knows the URL.** (§3)
2. Parsing the webhook body before verifying the signature. (§4)
3. An uncaught exception in the webhook → 401 → Stripe retries for 3 days. (§4)
4. No idempotency ledger → a retried event double-grants credits nobody paid for. (§4)
5. Using test Price IDs in live, or vice versa. (§2)
6. Floats for money. (§5)
7. Forgetting that `bookId` on the share SKU must be **validated as belonging to the caller** — otherwise
   a user pays $10 and unlocks someone else's book. (`stripe-full-plan.md`)
8. Shipping a "Buy credits" button in the iOS build. (§9)
