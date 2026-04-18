-- V7 is an intentional gap. The original migration was written and then deleted before it was ever
-- applied to any database. Because Flyway validates that every version in its history exists on disk,
-- a missing V7 causes startup failure on fresh installs (outOfOrder is false by default). This
-- no-op placeholder restores version continuity without changing any schema.
SELECT 1;
