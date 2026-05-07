CREATE TABLE storybook_chapters (
  id                  BIGSERIAL PRIMARY KEY,
  baby_profile_id     BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  anchor_type         VARCHAR(20) NOT NULL,
  anchor_key          VARCHAR(50) NOT NULL,
  anchor_label        VARCHAR(255) NOT NULL,
  period_start_weeks  INT,
  period_end_weeks    INT,
  sort_order          INT,
  body                TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'unlocked',
  generated_at        TIMESTAMPTZ,
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (baby_profile_id, anchor_type, anchor_key)
);
