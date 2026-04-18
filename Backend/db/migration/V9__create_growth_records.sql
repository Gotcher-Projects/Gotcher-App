CREATE TABLE growth_records (
    id              BIGSERIAL PRIMARY KEY,
    baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
    recorded_date   DATE NOT NULL,
    weight_kg       NUMERIC(5,3),
    height_cm       NUMERIC(5,1),
    head_cm         NUMERIC(5,1),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_growth_records_profile ON growth_records(baby_profile_id);
