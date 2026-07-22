# SV2-S13 — Shareable Book Link

> **📁 SLICED 2026-07-12 into `share/` (three ≤2h sessions).** This file remains the **canonical detailed
> spec**; the buildable sessions + run order live in **`share/session-prompts.md`** →
> `share/s13a-token-backend.md` · `share/s13b-public-page.md` · `share/s13c-share-section.md`.
> **Also note:** the billing/unlock half is **already built** in Payments P2/P3 (`books.share_unlocked_at`,
> `checkout {sku, bookId}` with the IDOR check, the webhook `GrantService` unlock). What's left is the token,
> the public read path, and the share UI. **Decisions locked (2026-07-12):** mint requires an unlocked book;
> "PII-filtered" = scope-don't-censor. See `share/session-prompts.md`.

> **RECONCILED 2026-07-09 (`sv2-s9.6`).** Everything below the "Key Decisions" heading predates the
> v2 book model and was written against a subscription that no longer exists. Read the corrections in
> this header first — where the old body contradicts them, the header wins.

**Status:** ✅ **Complete (2026-07-14)** — this is the *parent* file; the work was **sliced → `share/`** and all
seven slices (s13a, s13b, s13c, s13d, s13e-1/2/3) are Complete and verified with Michael. The status here just
never got flipped; corrected 2026-07-21. ⚠ **Built and verified LOCALLY only — the share track has never run in
production**, since the whole `payments-v1` branch is undeployed. It ships with the first prod deploy.
**Depends on:** v2 page types stable ✅ · Payments (one-time Stripe checkout) · **not** print

## Goal
Let parents share their baby's storybook with a private URL. A "Share" button in the
storybook view generates a link (`cradlehq.app/book/{token}`) that anyone can read —
no app install, no login required. Parents can revoke access at any time.

## Gating + pricing — DECIDED 2026-07-09 (supersedes the S0 `plus`/`pro` decision below)

There is **no subscription and no paid tier** (see `payments/stripe-full-plan.md` → MODEL CHANGE).
Sharing is a **one-time $10 purchase, scoped to a single book.**

- **Per book, not per account.** A parent with two books buys the unlock twice. The purchase UI must
  name the book being unlocked — unlocking the wrong book is the obvious refund request.
- Also sold inside the **recommended bundle** (share + a credit pack) — see the SKU table in
  `payments/stripe-full-plan.md`. Same unlock, same book-scoping.
- **Do not gate on `tier`.** That column is vestigial. Gate on the book's own unlock state.
- Price may rise later; nothing should hardcode `1000` cents outside the Stripe price object.

### Consequence: checkout must carry a `book_id`
Credits are **account-scoped** (`users.ai_credits_remaining`); the share unlock is **book-scoped**.
`POST /billing/checkout` therefore takes an optional `bookId`, required for the share SKU and the
bundle, absent for credit-only packs. The webhook applies the unlock to that book, and the
idempotency ledger must record **what was granted and to which book** — not just a credit count.

### Schema (decide in this session)
Two moving parts, don't conflate them:
- **Entitlement** — "this book is paid for." `books.share_unlocked_at`. Survives revoking and
  regenerating a link; the parent paid once. **⚠️ This column is added by the Payments migration (V47),
  not by this session** — see `payments/stripe-full-plan.md` §Session 1. Don't add it twice.
- **Token** — the revocable secret in the URL. Regenerating mints a new one; it must **not** re-charge.

**V25 `book_share_tokens` is UNUSABLE as-is — inspected 2026-07-09:**
```sql
CREATE TABLE book_share_tokens (
  id BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE UNIQUE,  -- ← one token per BABY
  token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
It keys on `baby_profile_id` with a **UNIQUE** constraint — one token per *baby*, written before `books`
existed (V42). **It cannot express a per-book unlock.** Reshape it (re-key to `book_id`) or replace it.
No code references it, so either is a clean break.

## ⚠️ Routing: THE APP HAS NO ROUTER (verified 2026-07-09)
The old plan says "the app currently uses React Router (check App.jsx to confirm)". It does not.
There is **no `react-router` dependency in `Frontend/package.json`** and `App.jsx` contains no routes —
it is an auth gate that renders `<CradleHq />`. This is a **decision to make, not a fact to check**:
add a router, or branch on `window.location.pathname` for the `/book/` prefix before the auth gate.
The pathname branch is smaller and touches one file; a router is the right call if a `/pricing` page
is also coming (see `payments/stripe-full-plan.md` → Pricing page).

## Files to Change
| File | Change |
|------|--------|
| `Frontend/src/components/tabs/StorybookTab.jsx` | Add Share section at the bottom |
| `Frontend/src/App.jsx` | Serve `/book/:token` outside the auth gate — **no router exists**; add one or branch on `window.location.pathname` (see header) |
| `Frontend/src/components/PublicBookPage.jsx` | New file — read-only book renderer, via `LayoutRenderer` + all `*Canvas` |
| `Frontend/vite.config.js` | Verify SPA fallback is configured (needed for direct /book/:token loads) |

## Key Decisions

### Routing
**Superseded — see the no-router finding in the header.** There is no React Router in the project.
Whichever option you pick, the public page must sit **outside** the auth gate: the gate wraps
`<CradleHq />`, and `PublicBookPage` sits alongside it, not inside it.

### Share section in StorybookTab
Shown for **every** user (there is no tier). Its state depends on the *book's* unlock:
- **Not unlocked** → an upsell: "Share this book — $10" → opens checkout with this `bookId`.
- **Unlocked** → the copy/regenerate/revoke controls below.

Add below the chapter list:
```
────────────────────────────────────
  Share your baby's story

  [Copy link]  or  [Generate new link]

  "Anyone with this link can read the
   published chapters. They don't need
   an account."

  [ Revoke access ] (shown only when a token exists)
```

State needed in StorybookTab:
```js
const [shareToken, setShareToken] = useState(null);
const [shareLoading, setShareLoading] = useState(false);
```
> **⚠️ These endpoints do not exist — you are building them (verified 2026-07-09).** `GET/DELETE
> /storybook/share` were deleted with the old sharing backend. Worse, the names are **account/baby-scoped
> and the feature is now book-scoped**: a parent with two books needs a token per book. Design them as
> `/books/{bookId}/share` (or equivalent) — do not resurrect the old shape.

On mount (only when that book is unlocked), fetch its token — if one exists, store it.
"Copy link" copies `https://cradlehq.app/book/{token}` to clipboard using the existing
`navigator.clipboard.writeText` pattern (check `share.js` for the clipboard fallback pattern).
"Revoke" deletes the token, clears local state.
"Generate new link" mints a new token — and **must not re-charge**: the entitlement is
`books.share_unlocked_at`, which the token's lifecycle never touches.

### PublicBookPage
Fetches from `GET /book/public/{token}` — no auth header.

**The "chapter `body`" model below is dead.** A v2 book is `layout_data` v2 pages. The public renderer
must go through **`LayoutRenderer` + every `*Canvas`** — the same dispatch set the PDF exporter uses
(`Frontend/src/lib/storybookPdf.js`), themed. As of 2026-07-09 that is ten named `templateId`s —
`moment-hero` (portrait + landscape), `letter`, `gallery`, `birth-day`, `people`, `family-tree`,
`chapter_divider`, `prompts`, `bump`, `milestones` — **plus a `LayoutRenderer` fallback for freeform
pages, plus the Cover** (which `storybookPdf.js` builds as raw DOM, not a canvas). Don't enumerate from
this list at build time; read the dispatch in `storybookPdf.js` and match it.

The data-driven pages (`BirthDayCanvas`, `PeopleCanvas`, `FamilyTreeCanvas`, `MilestonesCanvas`) need a
`pageData` prop — the public endpoint must serve that payload too, filtered for PII (see Privacy).

Renders:
- Header: "{Baby Name}'s Story" with CradleHQ branding (logo + "Made with CradleHQ" link)
- If the book has no filled pages: "This story is still being written — check back soon."
- The book's pages, in order, via `LayoutRenderer`.
- Footer: "Created with CradleHQ — track your baby's story at cradlehq.app"

The public page should look polished enough that a grandparent reading it wants to share it.
Use a light theme (white/cream background) since this is outward-facing, not the app UI.

### Token not found (404)
Render: "This link is no longer active. Ask the parent to share a new one."
No redirect, no error state that exposes app internals.

### No published chapters
If the token is valid but there are no published chapters:
"This story is still being written — check back soon."
Do not show draft chapters on the public page.

### Privacy
The public page must return only:
- Baby's first name
- The **published chapters'** pages (`status` is **chapter-level** — `ScrapbookBuilder.jsx:552` sets
  `status: 'published'` on the chapter, `storybookPdf.js:204` filters `chapters.filter(c => c.status === 'published')`)
  and their `layout_data`. Filter at the chapter level, not per page.
- The `pageData` payload the data-driven canvases need, **PII-filtered**

No email, birth date, parent name, or any other PII.

> **⚠️ CORRECTED 2026-07-09.** This section used to end *"This matches what the backend already returns
> from `/book/public/{token}`."* **There is no such endpoint.** Verified: no `/book/public` handler, no
> `/storybook/share` endpoints, and **no code references `book_share_tokens` at all**. The entire
> sharing backend is gone. **Nothing exists to match** — you are designing this response from scratch,
> and "filtered for PII" is a thing you must *build*, not inherit.
>
> One useful leftover: **`SecurityConfig` already lists `/book/public/**` in its `permitAll` matchers** —
> an orphan from the removed feature. The public route is pre-authorized; today it just 404s. You don't
> need to add it, but do confirm it still says what you expect.

### Caddy / SPA routing
The VPS uses Caddy as the reverse proxy. The React SPA needs a catch-all route so that
a direct load of `cradlehq.app/book/abc123` doesn't 404 at the server level.
Check `deployment-guide.html` to confirm Caddy is already configured with a `try_files`
or equivalent catch-all. If not, add it during this session.

The Vite dev server already handles this (history API fallback is on by default).

## Verification
- [ ] Share section shows the **$10 upsell** on a book that has not been unlocked
- [ ] Buying the unlock applies it to **that book only** — a second book still shows the upsell
- [ ] The bundle SKU grants credits **and** unlocks the book named at checkout
- [ ] Replaying the Stripe webhook does **not** double-grant credits or re-unlock
- [ ] "Regenerate link" mints a new token **without** re-charging
- [ ] "Copy link" copies a valid URL to clipboard
- [ ] Pasting the link in a private/incognito window loads the public book page
- [ ] Public page shows baby name + the book's pages
- [ ] Every page type renders (all ten templates + freeform fallback + cover) — compare against the
      `storybookPdf.js` dispatch, not against this doc
- [ ] Public page shows graceful message when there are no published chapters
- [ ] 404 token shows "link no longer active" message
- [ ] "Revoke" removes the token; the old link 404s immediately
- [ ] "Generate new link" creates a new working link
- [ ] Public page has CradleHQ branding and footer link
- [ ] Direct load of /book/:token URL works (SPA routing not broken)
- [ ] No auth token or user PII visible in the public page response
- [ ] Data-driven pages (birth details, people, family tree, milestones) receive `pageData` and render
      with no PII leaked in the public response
