# Payments P11 — Admin credit adjustment

**Status:** Not started
**Est:** ~1.5 hours · **Depends on:** P1 (the columns exist) · **Blocks:** nothing
**Launch prompt:** `session-prompts.md` → P11

A support endpoint to hand-adjust a user's credits: `POST /admin/users/{id}/credits { "amount": 5 }`. Small
— but it **mints credits**, so the auth posture is a deliberate decision, not an inherited default.

---

## What you're actually doing, in one paragraph

When a support request comes in ("I paid but never got my credits", or a goodwill grant), we need a way to
adjust a balance by hand. The endpoint itself is trivial; the real content of this session is deciding
whether the existing admin auth posture is strong enough for an endpoint that creates money out of nothing.

---

## The endpoint

`POST /admin/users/{id}/credits` with body `{ "amount": 5 }` (positive to grant, negative to correct).

## ⚠️ The auth decision — don't just inherit the matcher

`/admin/**` is **already `permitAll`** in `SecurityConfig`, gated only by an **`ADMIN_SECRET` header** — not
JWT. This new endpoint **mints credits**. **Decide deliberately** whether a shared-secret header is
sufficient for that, rather than reaching for the matcher just because it's already there. Write down the
decision (and, if you tighten it, what to).

## ⚠️ No reset job — don't build one

Credits are **purchased, not allotted** — nothing refills them on a schedule. `credits_reset_at` (V23)
stays **unused**. Do not add a reset/cron/allotment mechanism; that's why "Session 3" shrank to almost
nothing. This endpoint is a manual lever, not an automated one.

## Done when

- [ ] `POST /admin/users/{id}/credits` adjusts a balance (positive and negative) and reflects on `/auth/me`.
- [ ] The auth posture for a credit-minting endpoint was **decided on purpose** and recorded.
- [ ] No reset/allotment logic was added; `credits_reset_at` remains unused.

## Not this session

Any scheduled reset (there is none) · a full admin UI (this is an API lever for support) · refund/idempotency
concerns (those are `sv2-s14`). Just the adjustment endpoint and its auth decision.

## Closing note

Record the actual duration, and note the auth decision explicitly — a credit-minting endpoint on a shared
secret is exactly the kind of thing a future security pass will flag, so the reasoning should be findable.
