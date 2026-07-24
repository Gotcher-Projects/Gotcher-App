-- sv2-s7a: a baby owns many books. Each book is a container for storybook_chapters.
-- Cover photo, cover subtitle, and theme move here from baby_profiles (per-book now).
CREATE TABLE books (
  id               BIGSERIAL PRIMARY KEY,
  baby_profile_id  BIGINT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  type             VARCHAR(16) NOT NULL DEFAULT 'freeform' CHECK (type IN ('guided','freeform')),
  title            VARCHAR(200),
  theme            VARCHAR(20) NOT NULL DEFAULT 'classic',
  cover_photo_url  TEXT,
  cover_subtitle   TEXT,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ
);
CREATE INDEX idx_books_baby_profile ON books(baby_profile_id);

-- CLEAN BREAK (pre-prod, sv2-s7a): only the dev account has chapters and a lossless migration buys
-- nothing, so the existing chapters are cleared rather than reparented. book_id is NOT NULL with no
-- backfill. Nothing has a foreign key to storybook_chapters, so TRUNCATE is safe here.
TRUNCATE storybook_chapters;
ALTER TABLE storybook_chapters
  ADD COLUMN book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE;
CREATE INDEX idx_chapters_book ON storybook_chapters(book_id);

-- Uniqueness was per-baby (one implicit book); it must now be per-book, otherwise two books under
-- the same baby (or a duplicated book) collide on the same anchor. Re-scope the constraint to book_id.
-- Drop the old per-baby unique constraint by lookup (its generated name is not relied upon); the
-- table has exactly one unique constraint (the anchor one), so this is unambiguous.
DO $$
DECLARE cname text;
BEGIN
  FOR cname IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'storybook_chapters'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE storybook_chapters DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;
ALTER TABLE storybook_chapters
  ADD CONSTRAINT storybook_chapters_book_anchor_key UNIQUE (book_id, anchor_type, anchor_key);

-- Cover/theme now live on books; drop the old per-profile columns.
ALTER TABLE baby_profiles
  DROP COLUMN book_theme,
  DROP COLUMN cover_photo_url,
  DROP COLUMN cover_subtitle;
