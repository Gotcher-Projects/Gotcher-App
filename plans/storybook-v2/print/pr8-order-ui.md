# Print pr8 — "Order a Book" UI + min-page gate

**Status:** Not started
**Est:** ~2 hours · **Depends on:** pr6, pr7 · **Blocks:** pr9
**Launch prompt:** `session-prompts.md` → pr8

The customer-facing order flow: order a printed copy from the storybook view.

---

## What you're building

- An **"Order a Printed Book"** entry point in the storybook/book view — **any user, no tier gate** (print is
  pay-per-order; `users.tier` is vestigial, don't read it).
- **Quantity picker** (1, 2, 3, 5… — multi-copy for grandparents is a first-class case).
- **Shipping address** form (feeds pr6 estimate + pr7 checkout).
- **Estimate display** — show unit cost + shipping + delivery time (pr6) **before** the user commits.
- **Checkout** → pr7's variable-amount Stripe flow.

## ⚠️ Notes
- **Min-page gate** — if the book is below Lulu's minimum page count (from **pr0**), show a
  **"not enough content yet"** state instead of the order button. Don't let a too-short book reach a Lulu
  rejection.
- **Native (Apple 3.1.3(e))** — the printed book is a **physical good**, which Apple *requires* be sold
  **outside** IAP. So unlike the digital purchase UI (gated off native in Payments P9), **this button MAY
  ship on native**. Do not gate it off by copying the digital-purchase gate.
- Dates/prices through the shared formatters; reuse existing address/input components if present.

## Done when
- [ ] Any user can open the order flow from the book view (no tier gate).
- [ ] Quantity + address + estimate all show; checkout hands off to pr7.
- [ ] Below-min-page books show the "not enough content yet" state, not the order button.
- [ ] The button is present on native (physical good), not gated off.

## Not this session
The checkout backend (pr7) · confirmation/status (pr9). UI + gate only.
