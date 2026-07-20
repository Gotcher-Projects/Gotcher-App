# Print pr9 — Order confirmation + status

**Status:** Not started
**Est:** ~1.5 hours · **Depends on:** pr7, pr8 · **Blocks:** nothing
**Launch prompt:** `session-prompts.md` → pr9

Close the loop after a successful print order: confirm it, and (optionally) tell the user when it ships.

---

## What you're building

- A **confirmation screen** after the pr7 checkout returns — order placed, copies, estimated delivery,
  shipping address. Like the credit success screen (Payments P7), it **confirms**, it doesn't fulfil —
  the Lulu job was submitted by the webhook (pr7), not the redirect.
- **(Optional) order status / shipped notification** — if Lulu offers an order-status / shipped **webhook**
  (`lulu-spec-handoff.md` Q7), subscribe and notify the user when their book ships.

## ⚠️ Notes
- **Confirmation ≠ fulfilment** — same rule as the credit flow: the browser landing here proves nothing;
  the paid Lulu job was triggered by the signed Stripe webhook in pr7.
- The shipped-webhook is a **nice-to-have** — scope it out if Lulu's status API is thin; the confirmation
  screen is the required part.

## Done when
- [ ] A successful order shows a confirmation with order details + estimated delivery.
- [ ] (If in scope) a Lulu shipped event notifies the user.

## Not this session
Refunds / order-cancellation / print-job-rejection recovery **and the persistent "my orders" history list** →
**`../sv2-s14-print-hardening.md`** (order-history is s14c). pr9 is only the single post-checkout confirmation
(+ optional shipped ping); it reads the `print_orders` row (table from pr7) but doesn't build a list view.
