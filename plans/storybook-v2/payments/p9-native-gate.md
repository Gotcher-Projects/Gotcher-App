# Payments P9 — Native gate + polish

**Status:** Not started
**Est:** ~1.5 hours · **Depends on:** P7 · **Blocks:** nothing
**Launch prompt:** `session-prompts.md` → P9
**Read first:** `stripe-full-plan.md` Session 2 → native gate + `stripe-primer.md` §9

No purchase UI in the native builds. Gate every buy surface behind `Capacitor.isNativePlatform()` so the
iOS/Android apps ship with **no purchase UI and no call to action** — the condition our App Store exemption
depends on.

---

## What you're actually doing, in one paragraph

Apple's 3.1.1 requires IAP for in-app digital purchases; the exemption we rely on (3.1.3(f), free companion
app) holds **only if there is no purchase UI and no call to action** in the native app. So this session
wraps all purchase UI in a native check and, on native, leaves the out-of-credits state purely
informational. The printed-book button is the deliberate exception — a physical good Apple *requires* be
sold outside IAP — and must NOT be gated by mistake.

---

## The gate

Wrap **all** purchase UI in `Capacitor.isNativePlatform()`. On native, leave
`AiCreditsContext.onGetCredits` **undefined** — exactly as `sv2-s10b` already built it — so the
out-of-credits state stays **informational** and never becomes a call to action. One seam, both platforms.

## ⚠️ Two opposite cases — don't conflate them

- **Digital purchases (credits, share unlock):** gated OFF on native. No UI, no CTA. This is what keeps us
  inside 3.1.3(f).
- **The printed book:** the OPPOSITE. It's a **physical good**, and Apple **3.1.3(e) requires** it be sold
  outside IAP. That button **can ship in the app on day one** — **do not gate it by mistake.**

See `stripe-primer.md` §9 for the staged-submission plan and the full rationale.

## Also

Handle the **P5 US-only decline message** here if it wasn't finished in P5.

## Done when

- [ ] All digital-purchase UI is hidden on native (`Capacitor.isNativePlatform()`), visible on web.
- [ ] On native, the out-of-credits state is informational — no button, no CTA, `onGetCredits` undefined.
- [ ] The **printed-book** button is **not** gated (verify it still shows on native).
- [ ] The US-only decline message is complete.

## Not this session

The web purchase modal itself (P7) · anything about actual App Store submission/certs (separate track;
Michael isn't the Apple account owner — see `project_apple_developer`). This is the client-side gate only.

## Closing note

Record the actual duration. Note explicitly that the printed-book button was verified **un-gated** on native
— that's the easy thing to get wrong here and it's a revenue path, not a bug.
