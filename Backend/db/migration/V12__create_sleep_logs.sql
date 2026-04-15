CREATE TABLE sleep_logs (
    id              BIGSERIAL PRIMARY KEY,
    baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
    type            VARCHAR(10) NOT NULL CHECK (type IN ('nap','night')),
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sleep_logs_profile_started ON sleep_logs(baby_profile_id, started_at DESC);
