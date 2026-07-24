-- Print pr3: persisted print PDFs (interior now; cover reuses this in pr4).
-- The `token` is the unguessable secret in GET /print/pdf/{token} — the URL Lulu fetches the PDF from (pr5).
-- It is NOT auth: the endpoint is permitAll and serves any non-expired row by token. Short TTL (expires_at)
-- keeps these baby-photo PDFs from lingering; a sweep deletes expired rows.
-- pr7's print_orders will reference a row here (interior + cover) via FK, decoupling artifact from order.
CREATE TABLE print_pdfs (
  id           BIGSERIAL PRIMARY KEY,
  token        VARCHAR(64) NOT NULL UNIQUE,                                   -- unguessable fetch path
  book_id      BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  kind         VARCHAR(16) NOT NULL,                                          -- 'interior' | 'cover'
  bytes        BYTEA NOT NULL,
  content_type VARCHAR(64) NOT NULL DEFAULT 'application/pdf',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL                                           -- read + sweep both gate on this
);

CREATE INDEX idx_print_pdfs_expires_at ON print_pdfs (expires_at);           -- for the TTL sweep
