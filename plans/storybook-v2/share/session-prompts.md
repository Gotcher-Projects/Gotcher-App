# Share (public book link) — Session Prompts

**Sliced 2026-07-12 into three ≤2h sessions** (`s13a`, `s13b`, `s13c`), mirroring the payments/print tracks.
The old single `sv2-s13` was one oversized session (schema + auth'd token endpoints + a public PII-filtered
endpoint + the public renderer + the share UI).

**Canonical spec:** `../sv2-s13-share-link.md` (the detailed, reconciled plan — read it first).
**Depends on the payments track — and half of this is ALREADY BUILT there:** the entitlement/unlock path
(`books.share_unlocked_at`, `POST /billing/checkout {sku, bookId}` with the IDOR check, and the webhook's
`GrantService` setting the unlock idempotently) shipped in **Payments P2/P3**. This track builds only the
**revocable token**, the **public read path**, and the **share UI** on top of that.

---

## Run order & budget

| # | Session | Est. | Depends on |
|---|---|---|---|
| **s13a** | Token backend — V48 re-key + `/books/{bookId}/share` (POST/GET/DELETE) | 1.5–2h | Payments P1 (V47 cols) ✅ |
| **s13b** | Public read endpoint (`GET /book/public/{token}`) + real `PublicBookPage` renderer | 2h | s13a |
| **s13c** | StorybookTab share section (upsell + copy/regenerate/revoke) | 1.5h | s13a, Payments P6 modal ✅ |
| **s13d** | Public page visual polish (card each page + widen) | 1–1.5h | s13b |
| **s13e-1** | Share-aware purchase confirmation + remove PDF download | 1.5h | s13c ✅ |
| **s13e-2** | Content-based public visibility + "finished" flag (backend) | 2h | s13b ✅ |
| **s13e-3** | WIP gate + "Mark as finished" toggle (frontend) | 2h | s13e-2 |

**s13a–s13d Complete.** s13e (3 slices) reshapes the public link: visibility becomes **content-based** (freeform:
all pages; guided: filled only) instead of publish-gated, with a one-toggle **"Mark as finished"** driving a
work-in-progress gate/badge for visitors. Mockup: `mockups/s13e-finished-toggle-and-wip.html` (Option A). s13e-1 is
independent (can go first); s13e-3 depends on s13e-2.

## ✅ Decisions locked (Michael, 2026-07-12)

- **Minting requires an unlocked book.** `POST /books/{bookId}/share` rejects unless `books.share_unlocked_at`
  is set. The locked case is handled by the s13c upsell, never by minting a link for an unpaid book.
- **"PII-filtered" = SCOPE, don't censor.** The public payload includes only what *this book's published pages*
  need to render, and omits account-level data no page shows (login email, other babies/books, unpublished
  pages, `parentName`/`birthdate` when unused). It does **not** redact content the parent deliberately placed
  on a shared page (a Birth Stats page's date, a "Your People" page's names) — they curated the book to share
  exactly that. See s13b for the concrete field list.
- **3-slice plan** (this file). **Routing already decided** (Payments P5: lightweight `window.location.pathname`
  branch, no router; `App.jsx` already renders `PublicBookPage` for `/book/{token}`).

## Deliberately NOT here
- **The share SKU checkout / bookId / webhook unlock** — **done** in Payments P2/P3. s13c only *opens* the
  existing `PurchaseModal` with the share SKU + `bookId`; it does not build checkout.
- **A new router** — there isn't one and we're not adding one (P5 decision).
- **Print** — unrelated track (`../print/`).

---

## s13a — Token backend (1.5–2h)

```
Share s13a — the revocable share token + its management endpoints. Backend only.
Plan: share/s13a-token-backend.md · Canonical spec: sv2-s13-share-link.md

⚠️ V25 book_share_tokens is UNUSABLE — it keys on baby_profile_id UNIQUE (one token per BABY, pre-`books`).
   No code references it. Clean break: V48 drops + recreates it keyed on book_id UNIQUE.
⚠️ Migration is V48 (max is V47 = stripe billing; confirm with `ls Backend/db/migration`).

Endpoints (auth'd, JWT): POST/GET/DELETE /books/{bookId}/share.
1. OWNERSHIP: books has no user_id — verify via books→baby_profiles→user (reuse the exact two-hop pattern in
   BillingService.userOwnsBook). Skip it and one user revokes/reads another's token.
2. MINT (POST): reject with 402 unless books.share_unlocked_at IS NOT NULL (locked → upsell, not a link).
   Token = SecureRandom + URL-safe base64 (~43 chars), NOT the UUID-hex auth idiom (decided 2026-07-12).
   Return { token, shareUrl } (shareUrl = ${app.frontend-url}/book/{token}, reuse the existing @Value).
   Regenerate = new row, MUST NOT touch share_unlocked_at (no re-charge; entitlement independent of token).
   GET with no token → 200 { token:null, shareUrl:null }; DELETE idempotent (204 even if none).
3. Catch Exception in the controller (CLAUDE.md 401 trap).

Done when: mint/get/revoke work for the owner; a non-owner is rejected; a locked book can't mint;
regenerate swaps the token without changing share_unlocked_at.
```

## s13b — Public read path + PublicBookPage (2h)

```
Share s13b — the public, no-auth read endpoint + the real read-only renderer.
Plan: share/s13b-public-page.md · Canonical spec: sv2-s13-share-link.md

Backend GET /book/public/{token} — NO auth (SecurityConfig already permits /book/public/**; confirm).
Returns, for a valid token whose book is unlocked: baby FIRST name, theme, cover (subtitle RESOLVED
server-side — bake "Born {date}" only when no custom subtitle; cover never needs raw birthdate), and
CHAPTER-NESTED chapters:[{anchorType,anchorLabel,pages}] — published chapters only (status is CHAPTER-level:
c.status==='published') AND layoutData.version===2 (classic body chapters SKIPPED). Plus pageData scoped
per-template: birthDetails iff a birth_day page; familyMembers iff people/family_tree; achievedMilestones iff
milestones; birthdate iff birth_day; parentName NEVER sent. 404 → "link no longer active"; empty chapters[] →
"still being written".

Frontend PublicBookPage.jsx (replace the P5 placeholder shell): fetch the above, walk chapters→pages and render
each via LayoutRenderer + the SAME *Canvas dispatch as storybookPdf.js (read the dispatch there — 10 templates +
moment-hero portrait/landscape + freeform fallback + Cover). Letter eyebrow = chapter.anchorType==='guided' ?
anchorLabel. Light/cream outward-facing theme, CradleHQ header + footer link, graceful empty + 404 states.
Data-driven canvases get the served pageData prop.

Done when: pasting a link in incognito loads the book; every page type renders; no account PII in the
response; empty + 404 states render.
```

## s13e-1 — Share-aware confirmation + remove PDF download (1.5h)

```
Share s13e-1 — FRONTEND ONLY. Plan: share/s13e-1-confirmation-and-pdf.md
1. Make the return-from-Stripe confirmation share-aware: PurchaseModal stashes {before,bookId,sku};
   App.confirmUpgrade branches (credits=delta, share_only=poll /books for shareUnlocked, bundle=either);
   UpgradeConfirm shows share copy + a "Copy your link" button. Show the link immediately (decided 2026-07-14).
2. Remove the user-facing "Download PDF" button (StorybookTab + GuidedBookView). Keep lib/storybookPdf.js
   (render-dispatch reference; Lulu uses a separate server renderer). Independent — can go first.
```

## s13e-2 — Content-based public visibility + finished flag (2h)

```
Share s13e-2 — BACKEND. Plan: share/s13e-2-content-visibility.md · Mockup: mockups/s13e-finished-toggle-and-wip.html
Replace the status='published' gate in GET /book/public/{token} with a CONTENT rule: freeform → all pages;
guided → filled pages only (pageIsFilled, incl. data-driven pages: birth_day iff birth details, people/family_tree
iff members, milestones iff achieved; dividers only if their section has a filled page). SERVER-SIDE only.
Add books.finished_at (V49) → derived boolean `finished` on the /books DTO + public payload; settable via
PATCH /books/{id} {finished}. Payload also carries `type` (+ optional shown/total counts). Empty → chapters:[].
```

## s13e-3 — WIP gate + "Mark as finished" toggle (2h)

```
Share s13e-3 — FRONTEND. Plan: share/s13e-3-wip-gate.md · Build to mockup mockups/s13e-finished-toggle-and-wip.html
Owner: a "Mark as finished" toggle in the StorybookTab share section (both flows) → PATCH /books/{id} {finished},
optimistic update; a "📖 N pages added" line. Visitor (payload.finished === false, pages present): a once-per-session
acknowledgment gate (sessionStorage per token) → then a persistent "Work in progress" badge + a ? help popover.
Finished → clean book. Empty → today's "still being written". Depends on s13e-2.
```

## s13d — Public page visual polish (1–1.5h)

```
Share s13d — outward-facing polish on the public book page. FRONTEND ONLY (PublicBookPage.jsx).
Plan: share/s13d-public-polish.md · Canonical spec: sv2-s13-share-link.md

Two fixes (decided 2026-07-14, grounded in Screenshot 2026-07-14 175251.jpg):
1. Card each page — wrap every LayoutRenderer in a rounded card w/ hairline border + soft shadow,
   matching CoverCard, so page breaks are obvious.
2. Widen + paper framing — column ~560–600px (drop the inner 440px cap); cream bg is the "desk".
No backend / renderer change. ⚠️ Border+shadow must read on dark-theme book bgs too (test one).
```

## s13c — StorybookTab share section (1.5h)

```
Share s13c — the in-app share UI. Frontend (+ small DTO addition).
Plan: share/s13c-share-section.md · Canonical spec: sv2-s13-share-link.md

Add a "Share your baby's story" section at the bottom of StorybookTab, state driven by the ACTIVE book's
unlock (activeBook.shareUnlocked — a derived boolean, decision 1):
 - NOT unlocked → upsell showing BOTH SKUs (share_only $10 + bundle_share_150 $15/150-credits, decision 3)
   → openPurchase({ skus: SHARE_SKUS, bookId: activeBookId }).
 - unlocked → Copy link / Generate new link / Revoke, calling the s13a endpoints.

⚠️ CONFIRMED: share_unlocked_at is NOT in BookService.COLS. Add it to COLS + map in mapRow as boolean
   shareUnlocked (row.share_unlocked_at != null). Do this first.
⚠️ Modal wiring (decision 2): GENERALIZE the App-level PurchaseModal seam to openPurchase({skus, bookId})
   (undefined on native → inherits the P9 gate). Rename off the AiCredits name; RE-VERIFY the credits buy
   path still works after the refactor.
⚠️ Return refetch: webhook sets the unlock server-side; refetch /books on ?upgrade=success return (P7's
   pendingBuy tracks credits, not the share unlock) so shareUnlocked flips without a manual reload.
Copy uses navigator.clipboard.writeText (lib/share.js pattern; no execCommand fallback there). Regenerate
must not re-charge. Copy/revoke controls are fine on native for an already-unlocked book.

Done when: locked book shows the upsell → checkout for THAT book; unlocked book shows working
copy/regenerate/revoke; end-to-end against sv2-s13-share-link.md's verification checklist.
```
