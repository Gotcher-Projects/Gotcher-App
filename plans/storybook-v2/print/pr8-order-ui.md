# Print pr8 — "Order a Book" UI + min-page gate

**Status:** Not started
**Est:** ~2 hours · **Depends on:** pr6, pr7 · **Blocks:** pr9
**Launch prompt:** `session-prompts.md` → pr8

The customer-facing order flow: order a printed copy from the storybook view.

---

## ⚠ SUPERSEDED — read before building (pr5.5 / pr6 / pr7 locked 2026-07-19)
Full rewrite deferred until pr7 lands (pr8's UI wraps pr7's session-create endpoint — build against the real
contract). But these below are now WRONG and must not be built as written:
- **NO shipping-address form.** pr7 has **Stripe Checkout collect the US address** (`shipping_address_collection`);
  the webhook reads it. pr6's price is a **flat all-in (MAIL) table keyed on page count → address-independent**,
  so the estimate needs no address either. Delete the "Shipping address form" bullet.
- **Shipping level = MAIL, not GROUND** (GROUND is invalid for this SKU). No selector; single price.
- **Estimate = a single flat price** from `GET /books/{id}/print/price?quantity=N` (shipping baked in) — NOT a
  "unit cost + shipping" breakdown. (A delivery-time estimate is pr6's one remaining piece, added later.)
- **The min/max gate = consume `GET /books/{id}/print/orderability`** (pr5.5, the single source of truth), do
  NOT invent one. It returns `{ pageCount, min:32, max, orderable, shortBy, reason }` where `reason` is
  **`FILL_MORE`** (guided — "fill in N more pages", guided books can't add pages) or **`ADD_MORE`** (freeform —
  "add N more pages"); freeform max = **50**, guided max = 800. Message + block off that.
- **Order placement = call pr7's self-contained session-create endpoint** (it renders the PDFs + creates the
  `print_orders` row + opens Stripe). pr8 just shows a **"preparing your book…"** loading state while it runs,
  then redirects to the returned Stripe URL. pr8 does NOT render or create orders itself.
- The **quantity picker** + the **kill-switch-hidden entry point** (via `/auth/me`) below still stand.

---

## What you're building

- An **"Order a Printed Book"** entry point in the storybook/book view — **any user, no tier gate** (print is
  pay-per-order; `users.tier` is vestigial, don't read it).
- **Quantity picker** (1, 2, 3, 5… — multi-copy for grandparents is a first-class case).
- **Shipping address** form (feeds pr6 estimate + pr7 checkout).
- **Estimate display** — show unit cost + shipping + delivery time (pr6) **before** the user commits.
- **Checkout** → pr7's variable-amount Stripe flow.

## Kill switch — `app.print.enabled` (hide the entry point)
The feature flag is defined in **pr5** (default OFF). pr8 adds the **frontend UX gate**: the "Order a Printed
Book" entry point renders **only when the flag is true**, so users never start a flow that pr7 would refuse.
- Expose the boolean to the frontend on **`/auth/me` (`UserDto`)** — cheapest spot, no new endpoint; the app
  already reads `/auth/me` on load (`App.jsx`). It's a global on/off, not per-user, but riding `UserDto` avoids
  a second fetch. Read it wherever the entry point lives.
- This is UX only — the real guarantee is pr5's client backstop + pr7's checkout gate. A hidden button is not
  a security control; never rely on it alone.
- Build the entry point flag-aware from the start (this UI is new in pr8 — no retrofit).

## Decisions from pr0.5 (2026-07-16)
- **US-only shipping (gap #7)** — the address form **enforces a US destination** (no country picker, or US
  locked). Matches the payments track (Stripe Radar US-cards-only). International is explicitly out of scope.
- **Fixed GROUND shipping (gap #6)** — **no shipping-level selector.** The estimate (pr6) and checkout (pr7)
  use one level; the UI shows a single price + delivery estimate.
- **Pre-checkout render (gap #4)** — placing the order **renders the PDFs first** (a real, several-second
  step): show a **loading/"preparing your book" state** while pr3/pr4 render + persist before the pr7 Stripe
  redirect. The book is validated before the user is charged.
- **Max-page gate too (gap #9)** — pr0 set max **800**; gate on **both** ends. A book **> 800 pages** would be
  Lulu-rejected, so block it with an explanatory state just like the min-page gate (don't only check the min).
- **No pre-purchase PDF preview for v1 (gap #8, LOW)** — users already have the in-app book view + the digital
  export; a dedicated print-PDF preview before the $30–45 order is **not in scope**. Note only; revisit later.

## ⚠️ Notes
- **Min-page gate** — if the book is below Lulu's minimum page count (**32**, from **pr0**), show a
  **"not enough content yet"** state instead of the order button. Don't let a too-short book reach a Lulu
  rejection. (Pair with the **max** 800 gate above.)
- **Native (Apple 3.1.3(e))** — the printed book is a **physical good**, which Apple *requires* be sold
  **outside** IAP. So unlike the digital purchase UI (gated off native in Payments P9), **this button MAY
  ship on native**. Do not gate it off by copying the digital-purchase gate.
- Dates/prices through the shared formatters; reuse existing address/input components if present.

## Done when
- [ ] Any user can open the order flow from the book view (no tier gate).
- [ ] Quantity + **US** address + estimate all show; checkout hands off to pr7.
- [ ] Below-min-page (**< 32**) **and** above-max (**> 800**) books show a blocking state, not the order button.
- [ ] Placing the order shows a render/loading state before the Stripe redirect (pre-checkout render).
- [ ] The button is present on native (physical good), not gated off.
- [ ] The order entry point is hidden when `app.print.enabled=false` (flag read from `/auth/me`), shown when true.

## Not this session
The checkout backend (pr7) · confirmation/status (pr9). UI + gate only.
