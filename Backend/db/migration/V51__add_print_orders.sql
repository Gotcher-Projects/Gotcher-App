-- Print pr7: the print-order backbone. One row per printed-book order, created 'pending' at checkout
-- (session-create, commit a), then advanced by the Stripe webhook (commit b): pending → paid → submitted
-- (→ shipped / failed handled later by s14a hardening).
--
-- Deliberately NOT the credit ledger (stripe_events_applied): a print order carries data the digital ledger
-- has no shape for — a shipping address, quantity, per-copy + total price, the pre-checkout-rendered
-- interior/cover PDF URLs (+ their TTL), the Lulu job id, and an order status. This table is the backbone for
-- confirmation (pr9), the failure/refund path (s14a), webhook-retry dedup, and a later "my orders" view (s14c).
CREATE TABLE print_orders (
  id                BIGSERIAL   PRIMARY KEY,
  user_id           BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id           BIGINT      NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quantity          INT         NOT NULL,
  page_count        INT         NOT NULL,                    -- filled interior pages priced (pr5.5 gate / pr6)
  unit_price_cents  INT         NOT NULL,                    -- per-copy retail (pr6 flat, all-in table)
  amount_cents      INT         NOT NULL,                    -- unit × quantity = exactly what Stripe charges
  currency          VARCHAR(3)  NOT NULL DEFAULT 'USD',
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending → paid → submitted → shipped / failed

  -- The pre-checkout-rendered PDFs Lulu fetches (pr3/pr4). Each URL carries the unguessable print_pdfs token.
  interior_pdf_url  TEXT        NOT NULL,
  cover_pdf_url     TEXT        NOT NULL,
  pdf_expires_at    TIMESTAMPTZ NOT NULL,                    -- min(interior, cover) TTL

  -- Stripe + Lulu correlation.
  stripe_session_id VARCHAR(120),                            -- set right after the Checkout Session is created
  stripe_event_id   VARCHAR(100),                            -- the checkout.session.completed event that paid it
  lulu_job_id       BIGINT,                                  -- set once the paid Lulu job is submitted (commit b)

  -- Shipping address — collected by Stripe Checkout (US-only), read from the session in the webhook (commit b).
  ship_name         VARCHAR(200),
  ship_street1      VARCHAR(200),
  ship_street2      VARCHAR(200),
  ship_city         VARCHAR(120),
  ship_state_code   VARCHAR(10),
  ship_postcode     VARCHAR(20),
  ship_country_code VARCHAR(2),
  ship_phone        VARCHAR(40),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_print_orders_user    ON print_orders(user_id);
CREATE INDEX idx_print_orders_session ON print_orders(stripe_session_id);   -- webhook correlation lookups
