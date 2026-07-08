# SV2 — Onboarding Explainers: Stripe & Lulu (owner ramp-up)

**Status: Needs Verification (implemented 2026-07-03).** A prep/reference task, not feature code. Run it whenever;
no vendor credentials needed (it's research + writing). Best run BEFORE the Payments and print build sessions
so Michael has context to help on the owner side.

**Delivered:** `stripe-explainer.html` + `lulu-explainer.html` at repo root (body-content HTML — open locally or
re-publish as Artifacts). Both grounded in our own plans and current (July 2026) vendor docs: stripe-java 32.x,
`Session`/`Webhook.constructEvent`/billingportal, test cards + Stripe CLI; Lulu OAuth client-credentials token,
`POST /print-jobs/` + `/print-job-cost-calculations/`, `pod_package_id` anatomy, sandbox/prod base URLs. Each
has a TOC, an owner-vs-dev split (amber/blue role colors), real code samples, reference links, and a glossary.
Artifacts: Stripe `b4de6ee9-f4d5-4fba-bd00-5909e21bb0cf`, Lulu `0f03d37a-38b4-411b-b4b6-4c8a4635dc0b`.

## Goal
Produce **two standalone HTML explainer documents** that get Michael (no prior Stripe/Lulu experience) up to
speed on the integrations we're about to build — **what they are, what he does on the owner side, what the
code does, with real code samples and reference links** he can read to familiarize himself.

- `stripe-explainer.html`
- `lulu-explainer.html`

(Put them at the repo root next to `deployment-guide.html` — same "open the file locally" pattern — or offer
to also publish each as an Artifact for easy viewing. Confirm location at session start.)

## Approach (this is "exploratory work")
1. **Ground in OUR decisions first** — read `plans/storybook-v2/payments/stripe-full-plan.md`,
   `plans/storybook-v2/sv2-s12-print.md`, `lulu-print-handoff.md`, `handoffs/` (money-flow + owner runbook),
   and `planning.md` §6/§8. The explainers describe **CradleHQ's specific setup**, not generic tutorials.
2. **Fetch CURRENT vendor docs** (WebFetch/WebSearch) so API details, endpoints, and code samples are
   accurate and not from memory — Stripe and Lulu both change. Capture real reference URLs to cite.
3. **Use the `artifact-design` skill** for the HTML (clean, readable, code blocks with syntax highlighting via
   inline CSS, a table of contents, glossary). Match the tone/quality of `deployment-guide.html`.
4. Each doc must be **skimmable** (TOC, short sections) AND **deep enough to learn from** (real code + links).

## `stripe-explainer.html` — outline
- **What Stripe is** + subscription mental model: customer → product → price → subscription → invoice.
- **Our specific model** (from stripe-full-plan.md): **Plus $4.99/mo**, Stripe-**hosted Checkout** (redirect),
  **webhook** to sync `users.tier`, **Billing Portal** for self-serve cancel, **credit allotment** (10/mo,
  reset on renewal), 3-day grace on failed payment.
- **Money flow**: Stripe = money **IN** → payouts to the **LLC bank account**.
- **What MICHAEL does (owner side)** — the ramp-up he needs: create the LLC Stripe account, business/tax/bank/
  representative details, **activate** (can take days), create the Plus product + $4.99 price (live mode), add
  the webhook endpoint, grab keys (**test `sk_test_` vs live `sk_live_`**, `whsec_`, `price_`), invite the dev.
  Cross-link the existing `handoffs/stripe-account-handoff.md`.
- **What the CODE does (dev side)** — the endpoints we build: `POST /billing/checkout`, `POST /billing/webhook`
  (signature-verified), `GET /billing/portal`, `GET /billing/status`; the V-migration; env vars.
- **Test mode**: test cards (`4242…`), Stripe CLI `stripe listen` for local webhooks.
- **Code samples** (pull real current ones): Java (Stripe SDK) — create a Checkout Session, verify a webhook
  signature + handle `checkout.session.completed` / `invoice.paid` / `customer.subscription.deleted`, create a
  Billing Portal session; Frontend — `fetch('/billing/checkout')` → `window.location = url`.
- **Security notes**: webhook signature, keys never in the client, the Spring 401-on-RuntimeException trap.
- **References**: Stripe Checkout, Subscriptions, Webhooks, Billing Portal, Testing, stripe-java SDK (capture URLs).
- **Glossary**: customer, price vs product, subscription, invoice, webhook, idempotency, price ID, publishable vs secret key.

## `lulu-explainer.html` — outline
- **What Lulu print-on-demand is** + the **Print API** (they print + ship; no inventory).
- **Our specific model** (from sv2-s12-print.md + lulu-print-handoff.md §Q4): checkout is **external to Lulu** —
  **we collect payment via our own Stripe**, then POST a **paid** print job; Lulu auto-charges a **company card**
  for print + ship. **OpenPDF** assembles a **300 DPI** print PDF **server-side** (reproduces every v2 page type
  — not the client html2canvas path). **Sandbox → prod.**
- **Money flow**: Lulu = money **OUT** (company card); the customer pays **us** via Stripe. Depends on Payments.
- **What MICHAEL does (owner side)**: create the Lulu **developer** account (Print API, not the consumer wizard),
  business/tax + company card, get **sandbox + prod** client id/secret, and **confirm the print spec** — trim
  size, bleed, RGB vs CMYK, embedded fonts, **min/max page count**, cover/spine, white-label shipping, ToS
  (subscription-app API allowed). Cross-link `lulu-print-handoff.md` (the exact question list) + `handoffs/`.
- **What the CODE does (dev side)**: OAuth **client-credentials** token; assemble interior + cover PDF (OpenPDF,
  300 DPI, embedded fonts); **create a print job**; **pricing/shipping** estimate before checkout; optional
  **order-status webhook**. Note the min-page-count gate (short books may fall below Lulu's minimum).
- **Code samples** (pull real current ones): get an OAuth token; create a print-job (curl + Java) with the
  pod-package-id / interior + cover URLs / shipping address; a print-cost calculation call.
- **Print-spec primer**: trim/bleed diagram-in-words, CMYK vs RGB, DPI, spine-width depends on page count.
- **References**: Lulu Print API auth, create-print-job, print-job-cost-calculations, shipping, product/pod
  package catalog (capture URLs). Flag anything that must be **confirmed in the account** (trim/package id).
- **Glossary**: pod package id, trim size, bleed, cover vs interior PDF, spine, client-credentials, sandbox.

## Verification (session done when)
- Both HTML files open cleanly, have a TOC, real code blocks, working reference links, and a glossary.
- Each clearly separates **"what Michael sets up"** from **"what the code does."**
- Integration specifics match our plans (Plus $4.99, hosted checkout, credit model; Lulu external-checkout +
  OpenPDF 300 DPI) — not generic vendor tutorials.

---

## Session prompt (paste to run)
```
Session: build the Stripe + Lulu onboarding explainers.
Plan: plans/storybook-v2/sv2-onboarding-explainers.md — follow it.

Do exploratory research: read our own plans first (payments/stripe-full-plan.md, sv2-s12-print.md,
lulu-print-handoff.md, handoffs/, planning.md §6/§8), THEN WebFetch/WebSearch the CURRENT Stripe and Lulu
docs for accurate endpoints, code samples, and reference URLs (don't rely on memory for API specifics).

Produce two standalone HTML docs (repo root, like deployment-guide.html — confirm location with me first):
stripe-explainer.html and lulu-explainer.html. Use the artifact-design skill. Each needs: a TOC, a clear
"what Michael sets up (owner side)" vs "what the code does (dev side)" split, real code samples (Java Stripe
SDK / Lulu OAuth + print-job; frontend redirect), reference links, and a glossary. Describe CradleHQ's
SPECIFIC setup (Plus $4.99/mo hosted-checkout + webhook + credits; Lulu external-checkout + OpenPDF 300 DPI),
not generic tutorials. Offer to also publish each as an Artifact for easy viewing.
```
