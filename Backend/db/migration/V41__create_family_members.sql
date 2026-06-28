-- Flexible family roster for the "Your People" book page (sv2-s3). Global per baby profile,
-- reused across pages and the future family tree. role is free text (user-typed or from preset
-- chips); role_category is the structured bucket the future tree renderer uses for placement.
CREATE TABLE family_members (
  id              BIGSERIAL PRIMARY KEY,
  baby_profile_id BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  role            VARCHAR(100) NOT NULL,   -- 'Mum', 'Dad', 'Nana', 'Step-Dad', etc.
  role_category   VARCHAR(20),             -- 'parent' | 'sibling' | 'grandparent' | 'other'
  photo_url       TEXT,
  bio             TEXT,                    -- parent-written; shown on the page as-is
  sort_order      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_members_baby ON family_members(baby_profile_id);
