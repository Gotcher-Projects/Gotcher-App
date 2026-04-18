CREATE TABLE poop_logs (
    id              BIGSERIAL PRIMARY KEY,
    baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
    logged_at       TIMESTAMPTZ NOT NULL,
    type            VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (type IN ('normal','loose','hard')),
    color           VARCHAR(20) CHECK (color IN ('yellow','brown','green','black','red','white','orange')),
    consistency     VARCHAR(20) CHECK (consistency IN ('normal','watery','seedy','mucusy','hard')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_poop_logs_profile_logged ON poop_logs(baby_profile_id, logged_at DESC);
