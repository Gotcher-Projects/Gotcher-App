ALTER TABLE journal_entries ADD COLUMN image_orientation VARCHAR(11) DEFAULT 'landscape';
ALTER TABLE first_times     ADD COLUMN image_orientation VARCHAR(11) DEFAULT 'landscape';
