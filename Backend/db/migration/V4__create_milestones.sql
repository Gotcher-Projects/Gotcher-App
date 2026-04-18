CREATE TABLE milestones (
    id              BIGSERIAL PRIMARY KEY,
    baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
    milestone_key   VARCHAR(20) NOT NULL,
    achieved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (baby_profile_id, milestone_key)
);
