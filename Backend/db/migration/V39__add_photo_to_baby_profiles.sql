-- Baby avatar photo for the profile summary card (sv2-profile-modal).
-- Distinct from cover_photo_url (the book cover): this is a square portrait avatar shown on the
-- dashboard summary card + in the Edit Profile modal's Basics tab. Uploaded via POST /baby-profile/photo.
ALTER TABLE baby_profiles ADD COLUMN photo_url TEXT;
