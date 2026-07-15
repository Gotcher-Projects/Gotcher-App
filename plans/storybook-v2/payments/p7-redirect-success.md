# Payments P7 — Redirect return + success screen

**Status:** Complete (2026-07-11) — query-param return + stash-based confirm built and verified live: paid
`4242` → returned to `/?upgrade=success` → "Confirming…" overlay flipped to "You're all set — 50 credits"
once the webhook granted (0→50). Files: `BillingService.java` (URLs), `PurchaseModal.jsx` (stash),
`App.jsx` (poll), new `UpgradeConfirm.jsx`.

> **⚠️ Caveat for sv2-s13 (share SKUs):** the confirm poll detects the grant by a **credit balance delta**.
> `share_only` grants **0 credits** (it only unlocks a book), so the balance never moves and this screen
> would always degrade to "on its way". When s13 adds share SKUs, its confirmation must key off the book's
> `share_unlocked_at` (or a session-status check), not the credit delta. `bundle_share_150` is fine — it
> adds 150 credits.
**Est:** ~2 hours · **Depends on:** P3 (webhook grants), P6 (something to return from) · **Blocks:** P10
**Launch prompt:** `session-prompts.md` → P7
**Read first:** `stripe-full-plan.md` Session 2 + `stripe-primer.md` §3

Come back from Stripe without lying to the user. The success screen **confirms** a purchase — it never
**grants** one. Granting is the P3 webhook's job, exclusively.

> **Decisions (Michael, 2026-07-11):**
> 1. **Return as a query param, not a route.** P2 currently hardcodes `frontendUrl + "/upgrade-success…"` /
>    `"/upgrade-cancelled"` (`BillingService.java:96-97`). Change these to **`/?upgrade=success&session_id=
>    {CHECKOUT_SESSION_ID}`** and **`/?upgrade=cancelled`**, and handle `?upgrade=` in `App.jsx` boot exactly
>    like the existing `email_verified` / `reset_token` params (read → act → `history.replaceState` to clean).
>    This honors the P5 lightweight-routing decision (no new route) and is robust if the session lapsed
>    mid-checkout.
> 2. **Detect the grant by stashing the pre-purchase balance.** Before `window.location.href` to Stripe,
>    `PurchaseModal` writes the current balance to `sessionStorage` (a `pendingBuy` marker). On return, poll
>    `/auth/me` until `credits > pendingBuy.before`, then clear it. No new backend endpoint. If the stash is
>    missing (URL visited directly), fall back to a timed soft confirm — never a false "granted".

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

## Implementation shape (per the decisions above)

- **P2 backend:** change `setSuccessUrl`/`setCancelUrl` in `BillingService.java` to the `/?upgrade=…` query
  forms. (Two lines; keep `{CHECKOUT_SESSION_ID}` on success.)
- **PurchaseModal (P6):** just before the redirect, `sessionStorage.setItem('pendingBuy', {before: credits})`.
- **App.jsx boot:** if `?upgrade=success`, show a "Confirming your purchase…" overlay, poll `/auth/me` until
  `credits > pendingBuy.before` (or timed degrade), then `handleUserUpdate` the fresh user, clear `pendingBuy`,
  and `replaceState` to `/`. If `?upgrade=cancelled`, just clean the URL (optional quiet "no charge" note).

## Done when

- [x] The `?upgrade=success` return shows a confirming state and **grants nothing** — App.jsx only reads
      `/auth/me`; no-baseline case shows a soft state, never a false grant.
- [x] It polls `/auth/me` and reflects the balance once the webhook lands (delta vs the stashed balance). —
      verified 0→50 live.
- [x] It degrades to "on its way" if the webhook is slow, never to a false failure. — 12s poll → `'slow'`.
- [x] The app-wide user object refreshes so the balance is current everywhere. — `setUser(fresh)` on each poll.
- [x] `?upgrade=cancelled` returns cleanly with no charge and no error. — `replaceState` to `/`, no grant.
- [x] Return is a query param (no new route), per P5.

## Not this session

Any fulfilment logic (that's P3 and must stay there) · the balance widget elsewhere in the app (P10) · the
native gate (P9). This screen is confirmation-only.

## Closing note

Record the actual duration. Note whether the webhook-vs-redirect race was ever visible in testing — if the
poll routinely caught an already-updated balance, the degrade path is still required but rarely exercised;
say so for the record.
