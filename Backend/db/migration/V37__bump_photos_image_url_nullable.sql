-- S5: the bump diary doubles as the pregnancy journal — a photo is no longer required.
-- Entries may be text-only ("we found out", "first kick", heard the heartbeat). The
-- service enforces "photo OR note required" so empty rows still can't be saved.
ALTER TABLE bump_photos ALTER COLUMN image_url DROP NOT NULL;
