ALTER TABLE poop_logs RENAME TO diaper_logs;
ALTER TABLE diaper_logs ADD COLUMN category VARCHAR(10) NOT NULL DEFAULT 'poop';
ALTER TABLE diaper_logs ADD CONSTRAINT diaper_logs_category_check CHECK (category IN ('pee', 'poop'));
