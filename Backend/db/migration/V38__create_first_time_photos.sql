-- Multi-photo support for First Times (sv2-s4).
-- The existing first_times.image_url stays as the HERO photo; these are ADDITIONAL photos
-- (the gallery). Hero is not duplicated here. Cascade-deletes with the parent first time.
CREATE TABLE first_time_photos (
  id              BIGSERIAL PRIMARY KEY,
  first_time_id   BIGINT NOT NULL REFERENCES first_times(id) ON DELETE CASCADE,
  image_url       TEXT NOT NULL,
  caption         VARCHAR(200),
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_first_time_photos_first ON first_time_photos(first_time_id);
