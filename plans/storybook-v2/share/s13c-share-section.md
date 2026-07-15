# Share s13c — StorybookTab share section

**Status:** Complete (verified 2026-07-14 by Michael — credits modal still opens post-refactor; share
upsell/manage confirmed; DTO + token endpoints verified via API). Follow-ups split to **s13e** (share-aware
purchase confirmation + content-based public visibility + WIP gate + remove PDF download).

_Implementation (for reference):_ backend `Book` DTO now exposes `shareUnlocked`
(derived boolean); the purchase seam was generalized to `openPurchase({skus,bookId,heading,subheading})` in a
new `PurchaseContext` (moved off `AiCreditsContext.onGetCredits`); `PurchaseModal` parameterized
(heading/subheading, title-or-credits card, badge) + exports `SHARE_SKUS`; `CreditsPill`/`AiAssistField`
swapped to `usePurchase`; new `ShareSection` at the bottom of `StorybookTab` (upsell / copy·regenerate·revoke)
with a focus-refetch of `/books`. Backend book tests + **337 frontend tests** green; Vite build clean.
**Left to verify live** (needs backend restart): (a) **credits modal still opens** at zero credits (regression),
(b) locked book → upsell → modal for that bookId, (c) unlocked → copy/regenerate/revoke, (d) upsell absent on native.

Final seam name: `openPurchase` (was `onGetCredits`), in `contexts/PurchaseContext.jsx`.
**Est:** ~1.5h · **Depends on:** s13a (token endpoints) · Payments P6 (`PurchaseModal`) ✅ · **Blocks:** nothing
**Launch prompt:** `session-prompts.md` → s13c
**Read first:** `../sv2-s13-share-link.md` → "Share section in StorybookTab"

The in-app UI: a "Share your baby's story" section at the bottom of the Storybook tab whose state follows the
**active book's** unlock. Frontend, plus one small DTO addition.

---

## What you're actually doing, in one paragraph

Give the parent the buy-or-manage surface for sharing. If the active book isn't unlocked, show an upsell
that opens the purchase modal scoped to *that* book; if it is unlocked, show copy / regenerate / revoke
controls wired to the s13a endpoints. This is the last slice — after it, share is end-to-end.

## Decisions locked (Michael, 2026-07-12)

1. **DTO: derived `shareUnlocked` boolean.** `books.share_unlocked_at` is **confirmed absent** from the `/books`
   DTO — `BookService.COLS` today is `id, baby_profile_id, type, title, theme, cover_photo_url, cover_subtitle,
   sort_order, created_at, updated_at`. Add `share_unlocked_at` to `COLS` (it then flows through every
   SELECT/RETURNING automatically; create returns null — fine) and in `mapRow` expose it as a **boolean**
   `shareUnlocked = row.get("share_unlocked_at") != null` — **not** the raw timestamp. The tab reads
   `activeBook.shareUnlocked`.
2. **Modal wiring: generalize the App-level seam** (not a second local modal). Refactor the single App-mounted
   `PurchaseModal` + its context seam to carry `{ skus, bookId }` so credits and share both route through one
   modal. Concretely: App holds the purchase params in state and renders one `<PurchaseModal skus bookId>` (still
   web-only); the seam becomes `openPurchase({ skus, bookId })`, **`undefined` on native** (inherits the P9 gate
   for free). Credits path: `openPurchase({ skus: CREDIT_SKUS })` (no bookId). Share path:
   `openPurchase({ skus: SHARE_SKUS, bookId: activeBookId })`.
   - ⚠️ **Naming:** the seam lives in `AiCreditsContext` today (`onGetCredits`). Generalizing it to cover share is
     a naming stretch — prefer renaming to a neutral `openPurchase` (relocate to a small `PurchaseContext` if it
     reads cleaner), rather than passing share purchases through an "AiCredits" name.
   - ⚠️ **Regression risk:** this touches the live-ish credits buy path (`onGetCredits` → `CreditsPill`,
     `AiAssistField`). **Re-verify the credits flow still opens the modal at zero credits** after the refactor.
3. **Upsell shows BOTH SKUs.** `share_only` ($10 unlock) **and** `bundle_share_150` ($15 = 150 ✨ credits + the
   same unlock, flagged "best value"). `PurchaseModal` already renders a multi-card `skus` list; define a
   `SHARE_SKUS` array (display copy cosmetic — real price/grant come from Stripe metadata, P2/P3). Both SKUs
   carry `bookId = activeBookId`.

## Where it goes

Bottom of `StorybookTab.jsx` (below the chapter list), inside the active-book view. The tab already has
`activeBook` (`StorybookTab.jsx:50`) and `activeBookId`. State follows `activeBook.shareUnlocked` (decision 1).

### The `/books` DTO addition (decision 1 — confirmed required)
`share_unlocked_at` is **not** in `BookService.COLS` today, so the DTO doesn't expose it. Add the column to
`COLS` and map it in `mapRow` as a boolean `shareUnlocked` (see decision 1 above). Do this first — the whole
section keys off it.

## The two states

**Not unlocked → upsell.** A call-to-action that opens the modal with **both** SKUs (decision 3):
```
Share this book
"Anyone with the link can read it — no app, no login. One-time, this book only."
[ $10 — Unlock sharing ]
[ $15 — Unlock + 150 ✨ credits · best value ]
```
Click → `openPurchase({ skus: SHARE_SKUS, bookId: activeBookId })` (decision 2 — the generalized seam). The
modal already accepts `skus` + `bookId`. The webhook then sets `share_unlocked_at` (Payments P3); on return the
state flips to unlocked. **Do not build checkout here** — only open the modal.

> ⚠️ **Return refetch:** the unlock happens server-side via the webhook, so after the Stripe hand-off returns
> (`?upgrade=success`), the tab must **refetch `/books`** for `shareUnlocked` to flip. The P7 success path
> tracks a *credits* delta (`pendingBuy`), which won't catch a share unlock — ensure books are re-fetched on
> that return (or on tab focus) so a share/bundle purchase reflects without a manual reload.

**Unlocked → manage** (the layout from the canonical spec):
```
────────────────────────────────────
  Share your baby's story
  [ Copy link ]   [ Generate new link ]
  "Anyone with this link can read the published pages. They don't need an account."
  [ Revoke access ]   (only when a token exists)
```
- On entering the unlocked state, `GET /books/{activeBookId}/share` → if a token exists, store it.
- **Copy link** → `https://cradlehq.app/book/{token}` via `navigator.clipboard.writeText` (use the fallback
  pattern in `lib/share.js`).
- **Generate new link** → `POST /books/{activeBookId}/share` → new token. **Must not re-charge** (s13a
  guarantees the entitlement is untouched) — copy is fine to keep calling it "Generate new link".
- **Revoke** → `DELETE /books/{activeBookId}/share` → clear local token; the old URL 404s immediately (s13b).

### Native gate (P9 posture — inherited via decision 2)
Because the upsell opens the modal through the generalized `openPurchase` seam, which is **`undefined` on
native** (App leaves it unset and doesn't mount `PurchaseModal` there), the buy CTA drops out on native for
free — same mechanism as the credits flow. Render the upsell only when `openPurchase` is defined (mirror how
`CreditsPill`/`AiAssistField` degrade when `onGetCredits` is absent). The **copy / regenerate / revoke**
controls are not purchase UI and remain available on native for an already-unlocked book.

## Done when

- [ ] A **not-unlocked** active book shows the upsell → opens `PurchaseModal` for **that** `bookId`; buying it
      flips the section to the unlocked state.
- [ ] A second, still-locked book continues to show the upsell (per-book, not per-account).
- [ ] Unlocked: copy / generate-new / revoke all work against the s13a endpoints.
- [ ] Regenerate mints a new working link **without** re-charging.
- [ ] Revoke clears the token and the old link 404s.
- [ ] Upsell is absent on native; copy/revoke controls still function there.
- [ ] Full pass over `../sv2-s13-share-link.md`'s verification checklist (end-to-end).

## Not this session

The token endpoints (s13a) · the public renderer (s13b) · checkout itself (Payments P2/P6).

## Closing note

Record the actual duration. Note the final name you gave the generalized purchase seam (was `onGetCredits`) so
future purchase surfaces reuse it, and confirm the credits buy path was re-verified post-refactor.
