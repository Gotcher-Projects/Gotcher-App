-- sv2-s9.0b follow-up (2026-07-02): step-relations were dropped after review — rare for a first-year
-- keepsake and they forced awkward >2-parent family-tree layouts (see the step-nodes mockup). Remove the
-- is_step column V44 added; linked_member_id stays as the family-tree side-link.
-- (V44 is left intact rather than edited, so already-applied dev DBs pass Flyway validation and this
--  migration cleans up the column on the next startup — no DB wipe needed.)
ALTER TABLE family_members
  DROP COLUMN IF EXISTS is_step;
