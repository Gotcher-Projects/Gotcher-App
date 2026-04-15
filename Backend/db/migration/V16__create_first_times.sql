CREATE TABLE first_times (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  label           VARCHAR(120) NOT NULL,
  occurred_date   DATE NOT NULL,
  image_url       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_first_times_baby ON first_times(baby_profile_id);
