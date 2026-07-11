# Print pr6 — Cost / shipping estimate

**Status:** Not started
**Est:** ~1.5 hours · **Depends on:** pr5 · **Blocks:** pr7, pr8
**Launch prompt:** `session-prompts.md` → pr6
**Read first:** `lulu-spec-handoff.md` (Q6 pricing) + Lulu pricing/shipping API

Before a user pays, show them what it costs. Lulu has a **pricing / shipping-cost** endpoint — use it to
compute the total the pr7 checkout will charge.

---

## What you're building

A backend endpoint that, given `pod_package_id`, page count, **quantity**, and a **destination**, returns:
- **unit print cost** (per copy), **shipping**, **delivery estimate**, and our **total** (copies × price +
  shipping + any markup).

This total is what pr7's variable-amount Stripe checkout charges and what pr8 shows the user before they commit.

## ⚠️ Notes
- **Markup / retail** — economics sketch in `print-full-plan.md` ("Rough Economics"): print cost ~$8–12,
  retail ~$30–45. Whatever markup we choose lives here (or config), computed on top of Lulu's quoted cost.
- **Quantity matters** — multi-copy orders (grandparents) are a first-class case; the estimate must handle
  copies > 1 in one order.
- Address is needed for shipping cost — pr8 collects it; pr6 may run once the user has entered a destination.

## Done when
- [ ] The endpoint returns unit cost + shipping + delivery estimate + total for a given qty/destination.
- [ ] Multi-copy quantities compute correctly.
- [ ] The total matches what pr7 will charge (single source of truth for the amount).

## Not this session
The Stripe checkout that charges the total (pr7) · the order UI (pr8). Estimate only.
