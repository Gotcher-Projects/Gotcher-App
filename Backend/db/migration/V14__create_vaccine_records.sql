CREATE TABLE vaccine_records (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  vaccine_key     VARCHAR(40) NOT NULL,
  administered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(baby_profile_id, vaccine_key)
);
