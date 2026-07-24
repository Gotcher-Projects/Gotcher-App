-- PARKED MIGRATION — do NOT place in db/migration/ until ready (Flyway auto-runs that folder).
--
-- sv2-s11 decommissioned the batched AI page-generation. The application no longer reads or writes
-- storybook_chapters.generated_content, so the column is orphaned. This drops it.
--
-- TWO-PHASE (decided 2026-07-07): the code stopped using the column this session, but the physical
-- DROP is deferred so it can't auto-apply on deploy before prod is eyeballed. The app has been live
-- since April; generatePages() always rejected free tier and Payments never shipped, so no real user
-- could have generated content — but confirm before running:
--
--   SELECT count(*) FROM storybook_chapters WHERE generated_content IS NOT NULL;
--
-- If that is 0 (or only dev/demo rows), run the DROP below. To apply via Flyway, move/rename this file
-- to db/migration/V<next>__drop_generated_content.sql (pick the next free V number) and deploy.

ALTER TABLE storybook_chapters DROP COLUMN IF EXISTS generated_content;
