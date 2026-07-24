ALTER TABLE baby_profiles ADD COLUMN due_date DATE;          -- nullable: baby profiles have no due date

-- phase: add nullable, backfill every existing row to 'baby' (the only phase we support today),
-- then lock it to NOT NULL. No default — every INSERT must state the phase explicitly.
ALTER TABLE baby_profiles ADD COLUMN phase VARCHAR(16);
UPDATE baby_profiles SET phase = 'baby' WHERE phase IS NULL;
ALTER TABLE baby_profiles ALTER COLUMN phase SET NOT NULL;
ALTER TABLE baby_profiles ADD CONSTRAINT phase_valid CHECK (phase IN ('pregnancy','baby'));
