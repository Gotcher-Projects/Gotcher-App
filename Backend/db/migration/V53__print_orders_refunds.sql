-- Print s14a-2: record a refund that Michael issued from the Stripe dashboard, and remember which customer
-- emails have already gone out.
--
-- Decision D2 (no unattended auto-refund) means nothing in the app moves money: Stripe is the source of truth
-- and we LEARN about the refund from the signed webhook. So these columns are a record, never an instruction.
--
-- Separate from V52 rather than folded into it: V52 has already been applied, and editing an applied migration
-- changes its checksum and stops the app booting.
ALTER TABLE print_orders
  ADD COLUMN refund_id             VARCHAR(120),   -- Stripe refund id (re_…), for support lookups
  ADD COLUMN refunded_at           TIMESTAMPTZ,
  -- CUMULATIVE cents refunded (Charge.amount_refunded), not the size of one refund: partial refunds are real,
  -- and a second partial must show the running total rather than overwrite it with a smaller number.
  ADD COLUMN refunded_amount_cents INT,

  -- Idempotency, the same shape as everything else on this table: the recording UPDATE is conditional on this
  -- column not already holding the event id, so a Stripe redelivery changes no row and therefore re-sends no
  -- email. Deliberately NOT the stripe_events_applied ledger — its user_id/sku are NOT NULL and a refund has
  -- no sku, so a refund row would be a lie in the credit ledger.
  ADD COLUMN refund_event_id VARCHAR(100),

  -- A refund that Stripe first reported as succeeded and LATER failed. This is not a hypothetical: card
  -- 4000000000005126 reproduces it, and it is how live card refunds genuinely behave — asynchronous, so
  -- charge.refunded can arrive before refund.failed. When that happens `refunded_at` is CLEARED, because
  -- the single question anyone asks this table is "does the customer have their money back?" and the answer
  -- is no. These two columns keep the audit trail of the attempt that didn't land.
  ADD COLUMN refund_failed_at      TIMESTAMPTZ,
  ADD COLUMN refund_failure_reason TEXT,

  -- One-shot guards for the two customer emails. Money is involved, so "exactly once" is the requirement:
  -- telling somebody twice that their book failed is worse than the failure. ⚠ refund_notified_at is RESET by
  -- a failed refund on purpose — otherwise the retry that finally works would reach the customer in silence.
  ADD COLUMN failure_notified_at TIMESTAMPTZ,
  ADD COLUMN refund_notified_at  TIMESTAMPTZ;

-- The webhook's lookup key for a refund: Stripe hands us a PaymentIntent, never our order id.
CREATE INDEX idx_print_orders_payment_intent ON print_orders(stripe_payment_intent);
