# Share s13e-1 — Share-aware purchase confirmation + remove PDF download

**Status:** Complete (verified 2026-07-14 by Michael — real share purchase showed share copy + working Copy-your-link; credits confirmation unchanged; no Download-PDF anywhere).

_Implementation:_ `PurchaseModal` stashes `{before,sku,bookId}`;
`App.confirmUpgrade` branches (credits=delta, share=poll `/books` for `shareUnlocked`, bundle=either) and carries
`{phase,kind,bookId}`; `UpgradeConfirm` is kind-aware with a **Copy your link** button (mints+copies). Download-PDF
button removed from `StorybookTab` + `GuidedBookView` (+ its test); `storybookPdf.js` kept. Build clean, 336 FE tests pass.
**Left to verify live** (listener is up): real share purchase on a locked book → return shows share copy + working
Copy-your-link (not the credits "on its way"); credits purchase confirmation unchanged; no Download-PDF anywhere.
**Est:** ~1.5h · **Depends on:** s13c ✅ · **Blocks:** nothing (independent — can go first)
**Scope:** FRONTEND ONLY. No backend, no migration.

Two small, unrelated frontend cleanups bundled because both are quick and touch the purchase/book UI.

---

## Part 1 — Make the return-from-Stripe confirmation share-aware

**Problem (found 2026-07-14).** `confirmUpgrade` (App.jsx) + `UpgradeConfirm` were built credits-only: they poll
`/auth/me` for a **credit** delta. A `share_only` purchase grants no credits, so it *always* falls through to
the `slow` state ("Your credits will appear here shortly") — wrong copy, and it can never show `done` for a pure
share unlock. (This is not an error path: reaching `?upgrade=success` means Stripe confirmed payment; only the
grant is async via the webhook. See s13c thread.)

### Decisions locked (Michael, 2026-07-14)
- **Show the link immediately** on a successful share/bundle purchase (a "Copy your link" button on the success screen).

### What to change
1. **`PurchaseModal.buy`** — stash the purchase shape, not just the balance:
   `sessionStorage pendingBuy = { before: credits, bookId, sku }` (today it's `{ before }`).
2. **`App.confirmUpgrade`** — branch on the stashed `sku`/`bookId`:
   - **credits pack** → unchanged (poll `/auth/me` for the credit delta).
   - **share_only** → poll `/books` for that book's `shareUnlocked === true` → `done`; don't wait on credits.
   - **bundle_share_150** → success when EITHER the credit delta lands OR the book unlocks (both are granted by
     one webhook; either signal confirms it).
3. **`UpgradeConfirm`** — take a `kind` (`credits | share | bundle`) and render matching copy. For share/bundle,
   the `done` state shows **"Copy your link"** — mint+copy via `POST /books/{bookId}/share` (reuse the s13c call),
   or "Manage sharing" that routes to the StorybookTab section. Never claim a false failure (keep the `slow`
   fallback, worded for the purchase kind).

### Done when
- [ ] A `share_only` purchase return shows a share-worded `done` (not the credits "on its way") once the webhook lands.
- [ ] The success screen offers a working **Copy your link** for share/bundle.
- [ ] A credits purchase confirmation is unchanged.
- [ ] Bundle confirms on either signal (credits or unlock).

---

## Part 2 — Remove the user-facing "Download PDF" button

**Decision (Michael, 2026-07-14):** the in-app **Download PDF** button was a testing affordance and should go —
users shouldn't be able to download the book PDF. Keep the PDF *machinery* (`lib/storybookPdf.js`): it's the
canonical render dispatch `PublicBookPage` mirrors, and the **Lulu** print path uses a *separate* server-side
headless-Chrome renderer (print track pr1–pr9), NOT this client jsPDF — so removing the button doesn't touch Lulu.

### What to change
- Remove the **Download PDF** button in `StorybookTab.jsx` (the freeform one) and the `onDownloadPdf`/`exportingPdf`
  wiring passed to `GuidedBookView` (remove the button there too).
- Leave `lib/storybookPdf.js` and `generateStorybookPdf`/`downloadPdf` in place (still referenced as the render
  dispatch reference). Drop now-unused imports/handlers (`handleDownloadPdf`, `exportingPdf` state) if fully orphaned.

### Done when
- [ ] No "Download PDF" affordance anywhere in the app (guided or freeform).
- [ ] `storybookPdf.js` still builds/imports cleanly; no dead references; frontend build green.

## Not this session
Content-based visibility (s13e-2) · the WIP gate + "Mark as finished" toggle (s13e-3).
