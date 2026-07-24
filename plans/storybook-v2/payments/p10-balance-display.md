# Payments P10 — Balance display

**Status:** ✅ **Complete** — implemented 2026-07-12. `CreditsPill.jsx` built + wired into the CradleHq
header; `npm run build` green. Awaiting Michael's in-app look (web pill clickable → PurchaseModal; native
informational). Notes below.

> **Notes from the build (2026-07-12):**
> - **Design B+C** (Michael's call): soft tinted lavender pill with a `+` add badge; the **whole pill** is
>   the click target → opens the P6 `PurchaseModal` via `onGetCredits`. Sparkle icon ties it to the AI-credit
>   currency. Bare count only ("12 credits"), full "N credits remaining" in the hover tooltip.
> - **Zero state** = same pill in **brand-pink** (border/text/`+`), still clickable. Not a separate CTA.
> - **New file `Frontend/src/components/CreditsPill.jsx`**; placed in the header action group (left of "Hi,
>   {name}", before Sign Out) in `CradleHq.jsx`. Reads `useAiCredits()` — no new backend, no props needed.
> - **Native treatment (decision to confirm):** on native `onGetCredits` is undefined (P9 gate), so the pill
>   degrades to a **plain non-clickable count** — informational, no `+`, no buy affordance. I chose to keep
>   the balance *visible* on native rather than hide it entirely; flip to "render nothing on native" if you'd
>   rather the header stay clean there.

**Est:** ~1 hour · **Depends on:** P7 · **Blocks:** nothing
**Launch prompt:** `session-prompts.md` → P10

Show the credit balance. Small and self-contained — the data already reaches the UI, so this is
presentation only.

> **Absorbs the "Shop" surface (Michael, 2026-07-11).** Rather than a separate Shop page/tab, the credits
> Shop is a **persistent balance pill in the app header** that is **always clickable** to open the P6
> `PurchaseModal` — not only at zero. This is the proactive "I want to buy credits" entry point. Web only,
> gated off native by P9. The "on-book" purchase options Michael also mentioned are not new scope — they're
> the sv2-s13 share upsell and the print button, which already have homes.

---

## What you're actually doing, in one paragraph

Credits already flow to the frontend via `user.ai_credits_remaining` on `/auth/me`, read by
`AiCreditsContext` (built in `sv2-s10b`). This session just renders it honestly — a plain count, no
allotment framing — and turns the zero state into an entry point to the P6 modal.

---

## The display

- **"7 credits remaining"** — and nothing else. **No "/ 10"**, **no "resets on…"**. There is no allotment
  and no reset job; credits are purchased and don't expire. Framing it as "X / Y" or "resets monthly" would
  be a lie about how the product works.
- **A persistent header pill** showing the count, **always clickable** to open the P6 `PurchaseModal` (the
  proactive Shop entry — via `onGetCredits`, web only per the P9 native gate). It's the buy affordance
  whether the balance is 7 or 0 — the zero state ("0 credits remaining") is just the same pill at zero, not
  a separate CTA.

## No new backend work

`credits` already reaches the UI through `AiCreditsContext`. Don't build `GET /billing/status` for this —
`/auth/me` already answers it (that endpoint is deliberately skipped; see `session-prompts.md`).

## Done when

- [ ] The balance renders as a bare count wherever it belongs, with no allotment/reset language.
- [ ] A persistent header pill shows the count and is **always clickable** → opens the P6 modal (web only).
- [ ] No new backend endpoint was added.

## Not this session

The purchase modal itself (P6) · admin credit adjustment (P11) · any reset/allotment logic (there is none,
by design). Presentation only.

## Closing note

Record the actual duration. If a "1 hour" display task ran long, it's usually because the balance needs to
appear in more places than expected — note where, for future reference.
