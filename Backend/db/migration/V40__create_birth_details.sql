-- Birth-day details for "The Day We Met You" book page (sv2-s2). One row per baby profile.
-- birthdate itself stays on baby_profiles (used app-wide for age/milestones). These are the
-- birth-snapshot measurements + story; they intentionally overlap with growth_records (recurring
-- tracking) — different purposes. Units are IMPERIAL (lbs / inches) to match growth_records, which
-- the app already uses everywhere — there is no metric/imperial preference toggle in the app.
CREATE TABLE birth_details (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE UNIQUE,
  birth_time      TIME,
  hospital        VARCHAR(200),
  weight_lbs      NUMERIC(5,2),
  height_in       NUMERIC(4,1),
  head_in         NUMERIC(4,1),
  birth_type      VARCHAR(50),    -- 'natural' | 'c-section' | 'induced' | 'other'
  birth_story     TEXT,           -- parent-written note (also the seed for optional AI assist)
  birth_photo_url TEXT,           -- birth-day hero photo; falls back to the book cover when unset
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
