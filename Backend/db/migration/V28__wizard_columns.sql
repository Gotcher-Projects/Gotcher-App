ALTER TABLE storybook_chapters
  ADD COLUMN IF NOT EXISTS wizard_journal_ids    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wizard_first_time_ids TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS supplementary_notes   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS photo_overrides       TEXT DEFAULT NULL;
