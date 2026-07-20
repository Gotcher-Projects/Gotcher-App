# Print pr6 — Cost / shipping estimate

**Status:** Pricing DONE + tested (2026-07-19); delivery estimate deferred to the tunnel session. ⚠ The pricing
MODEL CHANGED (Michael, 2026-07-19): retail is a **flat, all-in step table** keyed on filled page count — NOT
Lulu's live quote. Shipping level = **MAIL** (locked). Table: 32–34 → $35 · 35–39 → $40 · 40–44 → $42 · 45–49 →
$45 · 50 → $50 (rounds down; guided First Year 32pp = $35, Bump 35pp = $40 land exactly). Multi-copy = qty ×
unit. Built: `PrintPricingService` + `GET /books/{id}/print/price?quantity=N` (gated on orderability, 409 if
un-orderable) + `PrintPricingServiceTest`. The amount is deterministic from the pr5.5 page counter, so pr7
charges it directly — Lulu cost-calc is no longer needed for the amount. **REMAINING:** the Lulu
`shipping-options` delivery-estimate ("arrives in ~10–13 days") — needs a US destination (pr8 form) + a live
sandbox shape check, so it folds in during the tunnel verification. Everything below is the pre-change context.

**Original status:** Not started — **prepped from pr5 (2026-07-18):** the Lulu cost/shipping endpoints are already mapped
against the sandbox and `LuluClient` exists to build on. See **"Starting point from pr5"** below before reading
the rest. **First decision this session: pick the real shipping level (pr0.5's "GROUND" is invalid).**
**Est:** ~1.5 hours · **Depends on:** pr5 (DONE) · **Blocks:** pr7, pr8
**Launch prompt:** `session-prompts.md` → pr6
**Read first:** THIS file's "Starting point from pr5" + `lulu-spec-handoff.md` (Q6 pricing)

---

## Starting point from pr5 (endpoints already mapped, client already built)

pr5 built `com.gotcherapp.api.print.LuluClient` (OAuth + cached token + typed HTTP plumbing) and
`LuluPrintService`. pr6 **adds a pricing method to `LuluClient` + a backend endpoint** — the Lulu shapes below
are already confirmed live against sandbox, so no re-probing needed.

**Cost endpoint — `POST /print-job-cost-calculations/`** (top-level, NOT under `/print-jobs/`). Body:
```json
{ "line_items":[{"page_count":100,"pod_package_id":"<SKU>","quantity":1}],
  "shipping_address":{"name","street1","city","state_code","postcode","country_code":"US","phone_number"},
  "shipping_level":"MAIL" }
```
Returns `line_item_costs[]`, `shipping_cost`, `total_tax`, `total_cost_excl_tax`, `total_cost_incl_tax`,
`currency` (all money as strings). The **grand `total_cost_incl_tax` is the number pr7 charges.**

**Shipping options — `POST /shipping-options/`** returns the available levels + per-service cost/transit for a
destination. ⚠ **Its address schema differs**: it wants `country` (NOT `country_code`), and needs only
`country`/`state_code`/`postcode`/`city`. Use this to (a) decide the level and (b) show a delivery estimate
(`total_days_min/max`, `min/max_delivery_date`).

**Real cost data (sandbox, SKU `0850X1100FCPREPB080CW444GXX`, qty 1, MAIL, US):**

| Pages | Print (pre-tax) | All-in (print+tax+MAIL ship) |
|------:|----------------:|-----------------------------:|
| 32 (min) | $9.03 | $16.35 |
| 64 | $15.91 | $23.90 |
| 100 | $23.64 | $32.39 |
| 200 | $45.12 | $55.96 |

Print curve ≈ **$2.15 base + $0.215/page** (full color). Shipping (100pp, US): MAIL $5.69 · GROUND_HD $13.74 ·
PRIORITY_MAIL $14.74 · EXPEDITED $20.74 · EXPRESS $35.74. `Backend/lulu-pr5-verify.sh` reproduces all of this.

Before a user pays, show them what it costs. Lulu has a **pricing / shipping-cost** endpoint — use it to
compute the total the pr7 checkout will charge.

---

## What you're building

A backend endpoint that, given `pod_package_id`, page count, **quantity**, and a **destination**, returns:
- **unit print cost** (per copy), **shipping**, **delivery estimate**, and our **total** (copies × price +
  shipping + any markup).

This total is what pr7's variable-amount Stripe checkout charges and what pr8 shows the user before they commit.

## Decisions from pr0.5 (2026-07-16) — one CORRECTED in pr5
- **⚠ Shipping level = fixed ONE level, but NOT `GROUND` (gap #6, corrected 2026-07-18).** pr0.5 assumed a fixed
  `GROUND`, but for THIS SKU→US Lulu does **not** offer plain GROUND — a GROUND job is **REJECTED** (verified,
  sandbox job 314931). The available levels are `MAIL` / `PRIORITY_MAIL` / `GROUND_HD` / `EXPEDITED` / `EXPRESS`.
  The single-level intent still holds (no selector in pr6/pr8) — **pr6's FIRST task is to pick which one.**
  Candidates: **`MAIL` $5.69** (cheapest, ~10–13 days, USPS/OSM, postbox-OK) vs **`GROUND_HD` $13.74** (FedEx
  Home, ~8–11 days, home delivery, traceable). A keepsake isn't urgent → MAIL is the cheap default, but GROUND_HD
  buys tracking + a real courier for ~$8 more. **Owner (Michael) call** — surface it, then hardcode the winner as
  the one level pr6 prices and pr7 ships.
- **US-only (gap #7).** Estimate only for **US destinations**, matching the payments track (Stripe Radar
  US-cards-only). pr8 enforces a US address; pr6 need not price non-US destinations.

## ⚠️ Notes
- **Markup / retail — the old sketch is STALE.** `print-full-plan.md` guessed print cost ~$8–12; real numbers
  (above) are **$9 for a 32-page floor up to ~$45 at 200 pages** — a typical ~64–100pp book lands **$16–$32
  all-in COGS** with MAIL. Set the retail markup here (or config), computed on Lulu's quoted `total_cost_incl_tax`,
  and cover Stripe fees (~2.9%+$0.30). Real decision, not locked — a ~100pp book at ~$32 cost implies retail
  roughly **$49–$59** to hold a margin, but that's a pricing call to confirm with the owner.
- **Quantity matters** — multi-copy orders (grandparents) are a first-class case; the estimate must handle
  copies > 1 in one order.
- Address is needed for shipping cost — pr8 collects it; pr6 may run once the user has entered a destination.
- **Single source of truth for the amount** — because pr0.5 chose **pre-checkout render**, the page count is
  known *before* pricing, so Lulu's quoted cost is deterministic at estimate time. pr7 charges exactly this
  total; any tiny divergence when Lulu actually charges our card is absorbed (see pr7 reconciliation note + the
  reserve policy in `../sv2-s14-print-hardening.md`).

## Done when
- [ ] The endpoint returns unit cost + shipping + delivery estimate + total for a given qty/destination.
- [ ] Multi-copy quantities compute correctly.
- [ ] The total matches what pr7 will charge (single source of truth for the amount).

## Not this session
The Stripe checkout that charges the total (pr7) · the order UI (pr8). Estimate only.
