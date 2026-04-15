CREATE TABLE journal_entries (
    id              BIGSERIAL PRIMARY KEY,
    baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
    week            INTEGER NOT NULL DEFAULT 0,
    title           VARCHAR(255) NOT NULL,
    story           TEXT,
    entry_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
