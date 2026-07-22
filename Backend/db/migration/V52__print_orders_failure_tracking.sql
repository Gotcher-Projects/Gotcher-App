-- Print s14a-1: make a paid print order's failure visible. Until now the only failure signal was a log line —
-- a Lulu rejection that lands AFTER a clean submit was completely invisible (the row said 'submitted' and we
-- never looked at that job again), and an order parked at 'paid' recorded no reason, so nobody could tell a
-- kill-switch park (resume it) from a Lulu rejection (refund it).
--
-- No DDL is needed for the new 'shipped'/'failed' status values: V51 left print_orders.status a plain
-- VARCHAR(20) with no CHECK constraint.
ALTER TABLE print_orders
  -- ⚠ The gap that blocked every refund: V51 stored the Checkout Session but not the PaymentIntent, and
  -- Refund.create needs one of those. Captured in the atomic pending→paid claim, where the Session is in hand.
  ADD COLUMN stripe_payment_intent VARCHAR(120),

  -- Last-seen Lulu job status (their vocabulary, not ours: CREATED/UNPAID/…/SHIPPED/REJECTED/CANCELED), for
  -- support and for the reconciliation sweep. Distinct from `status`, which is OUR order lifecycle.
  ADD COLUMN lulu_status    VARCHAR(30),
  ADD COLUMN lulu_status_at TIMESTAMPTZ,

  -- Why it failed. Holds the LINE-ITEM messages, not the job-level text: Lulu's job-level message is the
  -- useless "One or more line-items were rejected." while the real reason lives at
  -- line_items[].status.messages.printable_normalization.{interior,cover}[].
  ADD COLUMN failure_reason TEXT,

  -- Why a PAID order is sitting unsubmitted. 'print_disabled' (kill switch — retryable, resume when the flag
  -- flips back on) vs 'submit_failed' (Lulu API error — needs a human) vs 'pdf_expired' (the 24h render TTL
  -- lapsed while parked — needs a re-render before it can ever be submitted). NULL once submitted.
  ADD COLUMN parked_reason  VARCHAR(40),

  -- Bounds the resume path so a permanently broken order can't retry forever.
  ADD COLUMN submit_attempts INT NOT NULL DEFAULT 0,

  -- SHIPPED arrives on the same status feed as the rejection, so tracking is nearly free here; s14c shows it.
  ADD COLUMN tracking_id   VARCHAR(120),
  ADD COLUMN tracking_urls TEXT,                -- newline-separated (a URL can legally contain a comma)
  ADD COLUMN carrier_name  VARCHAR(80),
  ADD COLUMN shipped_at    TIMESTAMPTZ,

  -- The reconciliation sweep's cursor: stamped on every visit, so a persistently weird order is re-checked on
  -- the same cadence as everything else rather than hammered every pass.
  ADD COLUMN last_checked_at TIMESTAMPTZ;

-- The webhook's lookup key: a Lulu delivery identifies the order only by its print-job id.
CREATE INDEX idx_print_orders_lulu_job ON print_orders(lulu_job_id);

-- The sweep's working set: only non-terminal orders are ever re-checked, so keep the index that small.
CREATE INDEX idx_print_orders_open ON print_orders(last_checked_at)
  WHERE status IN ('paid', 'submitted');
