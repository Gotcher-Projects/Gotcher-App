-- Share s13e-2: owner-settable "this book is finished" flag.
-- Drives the visitor-facing work-in-progress treatment on the public share link (gate + badge), NOT
-- which pages appear (that's content-based, decided server-side). Null = still in progress.
ALTER TABLE books ADD COLUMN finished_at TIMESTAMPTZ;
