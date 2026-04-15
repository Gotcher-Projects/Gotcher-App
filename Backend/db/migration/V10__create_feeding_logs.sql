CREATE TABLE feeding_logs (
    id              BIGSERIAL PRIMARY KEY,
    baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('breast_left','breast_right','bottle','formula','solids')),
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    amount_ml       INTEGER,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feeding_logs_profile_started ON feeding_logs(baby_profile_id, started_at DESC);
