# Payments P6 — Routing decision (router vs pathname)

**Status:** Not started
**Est:** ~1.5–4 hours (range depends on the decision below) · **Depends on:** nothing — **can run early, in parallel** · **Blocks:** P7, P8
**Launch prompt:** `session-prompts.md` → P6

**This is a decision, not a check.** The app has no router, and two upcoming features need real URLs. Decide
once, together, then build only the shell.

---

## What you're actually doing, in one paragraph

Right now `App.jsx` is an auth gate that renders `<CradleHq />` — there are no URL routes at all. But the
payment success screen (P8) needs `/upgrade-success`, and the public shared book (sv2-s13) needs
`/book/{token}` *outside* the auth gate. Rather than hack in one route now and another later, we decide the
routing approach once and stand up the minimal shell. No feature logic this session.

---

## ⚠️ Ground truth — do not trust stale plan text

**The app has NO router.** There is no `react-router` in `Frontend/package.json`. `App.jsx` is an auth gate
that renders `<CradleHq />`. Any plan text saying "check `App.jsx` to confirm React Router is set up" is
**wrong** — there's nothing to confirm.

## The two consumers that need routes

- `/upgrade-success` — the return from Stripe checkout (Payments **P8**).
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

- [ ] The routing approach is **decided with Michael** and written down.
- [ ] The shell is in place: `/upgrade-success` and `/book/{token}` resolve to placeholder components, with
      `/book/{token}` **outside** the auth gate.
- [ ] A direct deep-link load doesn't 404 at the server (SPA fallback confirmed).
- [ ] No payment or share **feature** logic yet — shell only.

## Not this session

The success-screen behaviour (P8) · the public book page (sv2-s13) · the purchase modal (P7). Just the
routing decision and the empty shells it implies.

## Closing note

Record the actual duration and **which option was chosen** — P7 and P8 both build on it, and sv2-s13
inherits the same decision. If (b) was chosen, note the trigger that would justify migrating to (a) later.
