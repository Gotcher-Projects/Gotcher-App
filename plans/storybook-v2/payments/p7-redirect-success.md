# Payments P7 — Redirect return + success screen

**Status:** Not started
**Est:** ~2 hours · **Depends on:** P3 (webhook grants), P6 (something to return from) · **Blocks:** P10
**Launch prompt:** `session-prompts.md` → P7
**Read first:** `stripe-full-plan.md` Session 2 + `stripe-primer.md` §3

Come back from Stripe without lying to the user. The success screen **confirms** a purchase — it never
**grants** one. Granting is the P3 webhook's job, exclusively.

---

## What you're actually doing, in one paragraph

After paying, Stripe redirects the browser to `/upgrade-success`. That page must not add credits — if it
did, anyone who typed the URL could mint them. So it shows "confirming your purchase…", polls `/auth/me`
until the webhook-granted balance actually changes, and degrades gracefully if the webhook is a beat behind.
Then it refreshes the user object so the whole app sees the new balance.

---

## ⚠️ Two cardinal rules

**1. The success page MUST NOT grant anything.** If it does, anyone who visits `/upgrade-success` grants
themselves credits. **Fulfilment happens only in the P3 webhook.** This page is read-only confirmation.

**2. The webhook is NOT ordered relative to the redirect.** It usually lands within milliseconds, but that
is **not guaranteed**. So:
- Show **"Confirming your purchase…"**.
- **Poll `GET /auth/me`** until the balance changes.
- **Degrade gracefully** after a few seconds: "it's on its way" — never a hard error, never a claim that it
  failed. (The 3-D Secure path from P4 changes this timing; that's why we exercised it.)

## After confirmation

**Refresh the user object** so the entire app sees the new balance (the same `/auth/me` →
`AiCreditsContext` path that already feeds the UI). Route per the **P5** decision.

## Mobile (v1)

Plain **web fallback** — no universal links. Stripe opens in the system browser; the user pays and returns;
credits appear on next refresh. (Deeper native handling is deliberately out of scope until mobile is a real
conversion path — see P9.)

## Done when

- [ ] `/upgrade-success` shows a confirming state and **grants nothing** (verify: visiting it directly with
      no purchase does nothing).
- [ ] It polls `/auth/me` and reflects the balance once the webhook lands.
- [ ] It degrades to "on its way" if the webhook is slow, never to a false failure.
- [ ] The app-wide user object refreshes so the balance is current everywhere.
- [ ] Routed per P5.

## Not this session

Any fulfilment logic (that's P3 and must stay there) · the balance widget elsewhere in the app (P10) · the
native gate (P9). This screen is confirmation-only.

## Closing note

Record the actual duration. Note whether the webhook-vs-redirect race was ever visible in testing — if the
poll routinely caught an already-updated balance, the degrade path is still required but rarely exercised;
say so for the record.
