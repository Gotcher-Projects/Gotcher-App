-- sv2-grant (2026-07-09): give the first N signups a few free AI credits so they can try the ✨
-- "write this for me" assist before being asked to buy credits. V23 set ai_credits_remaining
-- DEFAULT 0, so today every new user meets the feature in its out-of-credits state.
--
-- This column records HAVING BEEN GRANTED, independent of the current balance. Counting
-- `ai_credits_remaining > 0` instead would drop a user the moment they spend their last credit,
-- leaking the cap (grant #501 fires as soon as user #3 runs dry). It doubles as the once-per-user
-- idempotency guard.
ALTER TABLE users ADD COLUMN free_grant_at TIMESTAMPTZ;  -- null = never granted

-- The grant statement's cap check counts rows where this is NOT NULL.
CREATE INDEX idx_users_free_grant_at ON users (free_grant_at) WHERE free_grant_at IS NOT NULL;
