# Payments P5 — Routing decision (router vs pathname)

**Status:** Complete (2026-07-11) — decided **lightweight** (no router); `/book/{token}` shell built and
confirmed rendering outside the auth gate by Michael. SPA fallback verified (dev + Caddy prod).
**Est:** ~1.5–4 hours (range depends on the decision below) · **Depends on:** nothing — **can run early, in parallel** · **Blocks:** P6, P7
**Launch prompt:** `session-prompts.md` → P5

> **Decision (Michael, 2026-07-11): lightweight, no `react-router`.** Two reasons the router wasn't worth it
> now: (1) the Stripe return is a *logged-in, transient* state, so P7 will handle it as a **`?upgrade=success`
> query param** — reusing the existing `email_verified`/`reset_token` pattern in `App.jsx` — not a route at
> all; (2) the only true URL surface is the **public `/book/{token}`** page, which is a single pathname
> branch. All routing here is **web-only** (native pathname is `/`; shared links open in the recipient's
> browser, and there's no purchase UI on native per P9), so wrapping the app in a router buys nothing.
> Revisit `react-router` only if the print track adds several real web routes — cheap to migrate then.

**This is a decision, not a check.** The app has no router, and two upcoming features need real URLs. Decide
once, together, then build only the shell.

---

## What you're actually doing, in one paragraph

Right now `App.jsx` is an auth gate that renders `<CradleHq />` — there are no URL routes at all. But the
payment success screen (P7) needs `/upgrade-success`, and the public shared book (sv2-s13) needs
`/book/{token}` *outside* the auth gate. Rather than hack in one route now and another later, we decide the
routing approach once and stand up the minimal shell. No feature logic this session.

---

## ⚠️ Ground truth — do not trust stale plan text

**The app has NO router.** There is no `react-router` in `Frontend/package.json`. `App.jsx` is an auth gate
that renders `<CradleHq />`. Any plan text saying "check `App.jsx` to confirm React Router is set up" is
**wrong** — there's nothing to confirm.

## The two consumers that need routes

- `/upgrade-success` — the return from Stripe checkout (Payments **P7**).
- `/book/{token}` — the public shared book (**sv2-s13**), which must render **outside** the auth gate.

## The options

| Option | What it is | Trade-off |
|---|---|---|
| **(a) Add `react-router`** ✅ recommended | A real router | Cleaner, and **sv2-s13 needs it anyway** — decide once for both. Slightly larger change now. |
| (b) Branch on `window.location.pathname` | Check the path before the auth gate | One file, no dependency — but gets ugly at the third route, and s13 makes a third route inevitable. |

**Recommendation: (a)**, given sv2-s13 is in scope and will force the issue regardless. **Confirm with
Michael before implementing** — this is the fork that sets the 1.5h vs 4h range.

## Also this session

Verify the **Caddy / Vite SPA fallback** so a direct load of a deep URL (e.g. someone opens
`/book/abc123` fresh) doesn't **404 at the server** before the SPA can route it.

## Done when

- [x] The routing approach is **decided with Michael** and written down. — lightweight, no router (see box).
- [x] The shell is in place. — `/book/{token}` renders `PublicBookPage` (placeholder) **outside** the auth
      gate via a pathname branch in `App.jsx` (returned before the session check). `/upgrade-success` is
      **not** a route by decision — it becomes `?upgrade=success`, built in P7; nothing to stand up now.
- [x] A direct deep-link load doesn't 404 at the server (SPA fallback confirmed). — `GET /book/test123` →
      200 `text/html` (Vite dev SPA fallback); Caddy prod already has `try_files {path} /index.html`.
- [x] No payment or share **feature** logic yet — shell only. — `PublicBookPage` does no data fetching;
      sv2-s13 builds the real read-only view.

## Not this session

The success-screen behaviour (P7) · the public book page (sv2-s13) · the purchase modal (P6). Just the
routing decision and the empty shells it implies.

## Closing note

Record the actual duration and **which option was chosen** — P6 and P7 both build on it, and sv2-s13
inherits the same decision. If (b) was chosen, note the trigger that would justify migrating to (a) later.
