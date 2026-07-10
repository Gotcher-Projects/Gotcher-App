# Payments P10 — Balance display

**Status:** Not started
**Est:** ~1 hour · **Depends on:** P8 · **Blocks:** nothing
**Launch prompt:** `session-prompts.md` → P10

Show the credit balance. Small and self-contained — the data already reaches the UI, so this is
presentation only.

---

## What you're actually doing, in one paragraph

Credits already flow to the frontend via `user.ai_credits_remaining` on `/auth/me`, read by
`AiCreditsContext` (built in `sv2-s10b`). This session just renders it honestly — a plain count, no
allotment framing — and turns the zero state into an entry point to the P7 modal.

---

## The display

- **"7 credits remaining"** — and nothing else. **No "/ 10"**, **no "resets on…"**. There is no allotment
  and no reset job; credits are purchased and don't expire. Framing it as "X / Y" or "resets monthly" would
  be a lie about how the product works.
- **At zero:** "0 credits remaining" + a **"Get more credits"** action → opens the **P7** modal (via the
  `onGetCredits` seam — web only, per the P9 native gate).

## No new backend work

`credits` already reaches the UI through `AiCreditsContext`. Don't build `GET /billing/status` for this —
`/auth/me` already answers it (that endpoint is deliberately skipped; see `session-prompts.md`).

## Done when

- [ ] The balance renders as a bare count wherever it belongs, with no allotment/reset language.
- [ ] The zero state offers "Get more credits" → the P7 modal (web only).
- [ ] No new backend endpoint was added.

## Not this session

The purchase modal itself (P7) · admin credit adjustment (P11) · any reset/allotment logic (there is none,
by design). Presentation only.

## Closing note

Record the actual duration. If a "1 hour" display task ran long, it's usually because the balance needs to
appear in more places than expected — note where, for future reference.
