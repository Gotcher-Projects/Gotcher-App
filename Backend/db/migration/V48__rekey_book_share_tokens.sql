-- Share s13a: re-key book_share_tokens from baby_profile_id to book_id.
-- V25 keyed the token on baby_profile_id UNIQUE (one token per BABY), written before `books`
-- existed (V42). It cannot express a per-book share link. No code references it and it holds no
-- data, so drop and recreate — clean break, no data migration.
--
-- The token is the REVOCABLE secret in the public URL; it is NOT the entitlement. "This book is
-- paid for" lives in books.share_unlocked_at (V47). Regenerating a link replaces this row and must
-- never touch that column, so the two are deliberately separate.
DROP TABLE IF EXISTS book_share_tokens;
CREATE TABLE book_share_tokens (
  id         BIGSERIAL PRIMARY KEY,
  book_id    BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE UNIQUE,  -- one active token per BOOK
  token      VARCHAR(64) NOT NULL UNIQUE,                                     -- fast public lookup (s13b)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
