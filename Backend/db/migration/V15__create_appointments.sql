CREATE TABLE appointments (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  doctor_name     VARCHAR(100),
  appointment_type VARCHAR(100),
  notes           TEXT,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON appointments(baby_profile_id, appointment_date);
