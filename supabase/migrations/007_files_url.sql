-- ============================================
-- DangerStorm — Junk Drawer (external files link)
-- ============================================

-- Add files_url to profiles (base URL for user's cloud storage folder)
ALTER TABLE profiles ADD COLUMN files_url TEXT;
