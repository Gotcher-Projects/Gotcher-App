# Payments P9 — Native gate + polish

**Status:** Complete (2026-07-12) — two-file, one-flag gate built; `npm run build` green. Verified both paths:
**native** (phone on prod DB at 0 credits shows a plain non-clickable "Out of AI credits" pill, no purchase
path) and **web** (local demo forced to 0 credits shows the clickable buy CTA → PurchaseModal). Notes below.

> **Notes from the build (2026-07-12):**
> - **`App.jsx`:** imported `Capacitor`, added `const isNative = Capacitor.isNativePlatform();`. On native,
>   `onGetCredits={isNative ? undefined : …}` and `PurchaseModal` is not mounted (`{!isNative && …}`).
>   `UpgradeConfirm` left mounted — it's driven by the `?upgrade=success` query-param return that only
>   happens on web, so on native it renders nothing anyway (not a buy surface).
> - **`AiAssistField.jsx`** (path is `components/storybook/AiAssistField.jsx`, not repo root): the inline
>   out-of-credits state now branches on `onGetCredits`. Undefined (native) → a plain non-clickable
>   `<span>` "Out of AI credits" with no button and no "get more"/steering text. Defined (web) → the
>   unchanged pink buy CTA. The toolbar-variant ✨ button is `disabled` at zero credits so it never fires
>   `onGetCredits` — no purchase UI there either; left as-is.
> - **`AiCreditsContext`** passes `onGetCredits` straight through (undefined stays undefined; its own
>   out-of-provider default is already `undefined`) — the gate needs no context change.
> - **P10 header pill / sv2-s13 share upsell:** not built yet, so nothing to gate now. Both must gate the
>   same way (on `onGetCredits` presence / `isNative`) when built — noted for those sessions.
> - **Printed-book button:** N/A — doesn't exist yet (print track `../print/pr0–pr9`, unbuilt). Forward-
>   looking reminder only: it must ship UN-gated on native (physical good, Apple 3.1.3(e)).
> - Optional browser sanity (hardcode `isNative = true`) NOT run by me; Android is the real target and is
>   Michael's to verify.

**Est:** ~1.5 hours · **Depends on:** P6 · **Blocks:** nothing
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

**Every buy surface must be gated, not just the out-of-credits modal.** Inventory as of 2026-07-11:
the `onGetCredits` purchase modal (P6); the **persistent header balance pill** that doubles as the proactive
credits Shop entry — always clickable to open the modal (P10, decided 2026-07-11); and the on-book share
upsell (sv2-s13). All OFF on native. The **printed-book** button is the only buy surface that
ships (physical good — see below).

## Implementation shape (grounded 2026-07-12)

**Two files, one flag.** Gate on **`onGetCredits` presence**, not scattered `Capacitor` checks — `App.jsx`
is the single decision point, and every consumer already reads `onGetCredits` from `AiCreditsContext`.

1. **`App.jsx`** — `const isNative = Capacitor.isNativePlatform();`
   - `onGetCredits={isNative ? undefined : () => setPurchaseOpen(true)}`
   - `{!isNative && <PurchaseModal … />}` (with `onGetCredits` undefined it never opens anyway, but don't mount it).
   - When the **P10 header pill** is built, it gates the same way (no pill / not clickable on native).

2. **`AiAssistField.jsx:152-167`** — the real work. The out-of-credits state today renders a pink
   **"Out of credits" button → `onGetCredits`** plus the CTA text **"Get more credits to use AI."** Branch on
   `onGetCredits`:
   - **defined (web):** the current buy CTA, unchanged.
   - **undefined (native):** plain informational — a non-clickable "Out of AI credits" indicator, **no button,
     no "get more" text, and no "buy on the web" steering** (anti-steering is its own App Store risk). Just
     state the fact and stop.

   The toolbar-variant ✨ button (line ~130) at zero credits also calls `onGetCredits`; on native that's a
   harmless no-op (it's the assist button, not purchase UI). Leaving it is fine — optional polish is to make
   its title read "out of credits" only.

## ⚠️ Two opposite cases — don't conflate them

- **Digital purchases (credits, share unlock):** gated OFF on native. No UI, no CTA. This is what keeps us
  inside 3.1.3(f).
- **The printed book:** the OPPOSITE. It's a **physical good**, and Apple **3.1.3(e) requires** it be sold
  outside IAP. That button **can ship in the app on day one** — **do not gate it by mistake.** ⚠️ **Note
  (2026-07-12): it doesn't exist yet** — the printed-book button is the print track (`../print/pr0–pr9`,
  unbuilt). So there's nothing to protect *now*; this is a forward-looking reminder for when print lands.

See `stripe-primer.md` §9 for the staged-submission plan and the full rationale.

## Also

The **P8 US-only notice is already done** (built into `PurchaseModal` in P8, 2026-07-12). Nothing to do here
unless it regressed — and note that on native the whole modal is gated off anyway.

## Testing (2026-07-12)

- **Android — Michael can verify.** Build via `build-android.sh` + Android Studio / emulator and confirm: no
  purchase modal, no "Get more credits" CTA, the out-of-credits state is plain informational; web is unchanged.
- **iOS — Michael CANNOT build/verify** (he isn't the Apple account owner — see `project_apple_developer`).
  This is acceptable because `Capacitor.isNativePlatform()` is **platform-agnostic**: iOS and Android run the
  **same** gated code path, so a passing Android check confirms the mechanism for both. iOS gets its real
  check whenever an iOS build is possible.
- **Quick browser sanity (no build):** temporarily hardcode `const isNative = true` in `App.jsx`, load the
  browser, confirm the CTAs vanish and the out-of-credits state goes informational, then revert.

## Done when

- [ ] `App.jsx`: `onGetCredits` undefined + `PurchaseModal` not mounted on native; both present on web.
- [ ] `AiAssistField` out-of-credits state is informational on native (no button, no "get more"/steering CTA);
      unchanged buy CTA on web.
- [ ] Verified on an **Android** build (Android Studio); web path unchanged. (iOS shares the same gate — not
      buildable by Michael; see Testing.)
- [ ] The **printed-book** button — N/A this session (doesn't exist yet); reminder logged for the print track.

## Not this session

The web purchase modal itself (P6) · anything about actual App Store submission/certs (separate track;
Michael isn't the Apple account owner — see `project_apple_developer`). This is the client-side gate only.

## Closing note

Record the actual duration. Note explicitly that the printed-book button was verified **un-gated** on native
— that's the easy thing to get wrong here and it's a revenue path, not a bug.
