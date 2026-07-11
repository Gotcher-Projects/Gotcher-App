-- Payments P1: durable state for Stripe one-time checkout (four SKUs, NO subscription).
-- Adds a per-user Stripe customer id, a per-book "paid for" entitlement, and the
-- idempotency ledger the webhook (P3) uses to grant each event exactly once.

-- One Stripe customer per user, created lazily on first checkout (P2).
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(100);

-- Entitlement: "this book is paid for." Distinct from the revocable share TOKEN (sv2-s13) —
-- regenerating a share link must NOT re-charge, so the unlock outlives any single token.
ALTER TABLE books ADD COLUMN share_unlocked_at TIMESTAMPTZ;

-- Idempotency ledger: one row per successfully-applied Stripe event.
-- The webhook grants ONLY if the INSERT wins (ON CONFLICT DO NOTHING -> 0 rows -> skip),
-- because Stripe retries until it gets a 2xx and can redeliver even after one. Incrementing
-- a balance twice is not harmless. A bundle grants BOTH: credits > 0 AND unlocked_book_id IS NOT NULL.
CREATE TABLE stripe_events_applied (
  event_id         VARCHAR(100) PRIMARY KEY,   -- Stripe's evt_... id
  user_id          BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sku              VARCHAR(40) NOT NULL,       -- credits_50 | credits_125 | bundle_share_150 | share_only
  credits          INT         NOT NULL DEFAULT 0,
  unlocked_book_id BIGINT      REFERENCES books(id) ON DELETE SET NULL,  -- null for credit packs
  applied_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stripe_events_user ON stripe_events_applied(user_id);
