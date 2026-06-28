# Deferred — Shareable Book Link

> **V2 TRIAGE (2026-06-22):** kept **deferred / optional** — see `plans/storybook-v2/planning.md` §7.
> Useful but independent of the v2 book-structure work; pull in only if sharing is a near-term
> priority. ⚠️ **This is now a FRESH build, not a resume:** the review-fixes track **removed the old
> sharing backend** (migration V25 `book_share_tokens` kept, code removed), and this plan still
> describes serving legacy chapter `body` rather than `layout_data`. Also paid-gated → same Payments
> caveat as print (no upgrade flow yet; `tier` column exists).

**Status:** Not started (deferred — fresh build if resumed)
**Branch:** `feature/storybook`
**Depends on:** the scrapbook builder rewrite (S7–S10), S3 (storybook view must exist), S2 (public backend endpoint live)

## Goal
Let parents share their baby's storybook with a private URL. A "Share" button in the
storybook view generates a link (`cradlehq.app/book/{token}`) that anyone can read —
no app install, no login required. Parents can revoke access at any time.

**Gating (S0 decision):** Share section is only shown to `plus` and `pro` users.
Free users cannot share until they upgrade.

## Files to Change
| File | Change |
|------|--------|
| `Frontend/src/components/tabs/StorybookTab.jsx` | Add Share section at the bottom |
| `Frontend/src/App.jsx` | Add `/book/:token` route (public, no auth required) |
| `Frontend/src/components/PublicBookPage.jsx` | New file — read-only book renderer |
| `Frontend/vite.config.js` | Verify SPA fallback is configured (needed for direct /book/:token loads) |

## Key Decisions

### Routing
The app currently uses React Router (check App.jsx to confirm). Add a route:
```jsx
<Route path="/book/:token" element={<PublicBookPage />} />
```
This route must be outside the auth gate so unauthenticated visitors can access it.
The existing auth gate wraps `<CradleHq />` — `PublicBookPage` sits alongside it, not inside it.

If the app does NOT use React Router (check before assuming), use `window.location.pathname`
to detect the `/book/` prefix and render `PublicBookPage` instead of the normal auth flow.
Read `App.jsx` first.

### Share section in StorybookTab
Shown only for `plus` and `pro` users (check `tier !== 'free'`). Add below the chapter list:
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
On mount (for paid users only), call `GET /storybook/share` — if a token exists, store it.
"Copy link" copies `https://cradlehq.app/book/{token}` to clipboard using the existing
`navigator.clipboard.writeText` pattern (check share.js for the clipboard fallback pattern).
"Revoke" calls `DELETE /storybook/share`, clears local token.
"Generate new link" calls `GET /storybook/share` again (backend creates a new token after
the old one was deleted).

### PublicBookPage
Fetches from `GET /book/public/{token}` — no auth header.
Renders:
- Header: "{Baby Name}'s Story" with CradleHQ branding (logo + "Made with CradleHQ" link)
- If no published chapters: "No chapters published yet — check back soon."
- Each published chapter: anchor label as chapter title, published date, body text.
  Same typography as the in-app view (serif, relaxed leading, constrained width).
  If chapter has `layout_data`, render via LayoutRenderer; otherwise legacy inline-marker render.
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
The public page returns only:
- Baby's first name
- Published chapter bodies and labels
No email, birth date, parent name, or any other PII.
This matches what the backend already returns from `/book/public/{token}`.

### Caddy / SPA routing
The VPS uses Caddy as the reverse proxy. The React SPA needs a catch-all route so that
a direct load of `cradlehq.app/book/abc123` doesn't 404 at the server level.
Check `deployment-guide.html` to confirm Caddy is already configured with a `try_files`
or equivalent catch-all. If not, add it during this session.

The Vite dev server already handles this (history API fallback is on by default).

## Verification
- [ ] "Share" section appears in storybook view for `plus` and `pro` users only
- [ ] "Share" section is hidden for free users
- [ ] "Copy link" copies a valid URL to clipboard
- [ ] Pasting the link in a private/incognito window loads the public book page
- [ ] Public page shows baby name + all published chapters
- [ ] Public page does not show draft chapters
- [ ] Public page shows graceful message when there are no published chapters
- [ ] 404 token shows "link no longer active" message
- [ ] "Revoke" removes the token; the old link 404s immediately
- [ ] "Generate new link" creates a new working link
- [ ] Public page has CradleHQ branding and footer link
- [ ] Direct load of /book/:token URL works (SPA routing not broken)
- [ ] No auth token or user PII visible in the public page response
- [ ] Chapters with layout_data render via LayoutRenderer on the public page
