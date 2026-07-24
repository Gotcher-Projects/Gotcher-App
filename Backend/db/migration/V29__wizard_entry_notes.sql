ALTER TABLE storybook_chapters
  ADD COLUMN IF NOT EXISTS wizard_entry_notes TEXT DEFAULT NULL;
