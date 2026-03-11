-- ============================================
-- DangerStorm — Branch Support
-- ============================================

-- Add branched_from_id to ideas table (nullable — NULL means original idea)
ALTER TABLE ideas ADD COLUMN branched_from_id UUID REFERENCES ideas(id) ON DELETE SET NULL;

-- Index for finding branches of a parent idea
CREATE INDEX idx_ideas_branched_from ON ideas(branched_from_id) WHERE branched_from_id IS NOT NULL;
