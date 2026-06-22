CREATE TABLE bump_photos (
  id                BIGSERIAL PRIMARY KEY,
  baby_profile_id   BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  week              INT NOT NULL,                 -- pregnancy week the photo represents
  image_url         TEXT NOT NULL,
  note              TEXT,
  taken_date        DATE,
  image_orientation VARCHAR(16) NOT NULL DEFAULT 'portrait',  -- crop baked into image, same as journal/first_times
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Many photos per week allowed (no unique constraint): supports a richer pregnancy journal.
CREATE INDEX idx_bump_photos_baby ON bump_photos(baby_profile_id);
