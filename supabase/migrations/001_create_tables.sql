-- ============================================
-- DangerStorm MVP — Core Tables
-- ============================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    display_name    TEXT,
    tier            TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
    stripe_customer_id      TEXT,
    stripe_subscription_id  TEXT,
    idea_count      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ideas (one per domain per user)
CREATE TABLE ideas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    domain          TEXT NOT NULL DEFAULT 'None',
    product_name    TEXT,
    tagline         TEXT,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'complete')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, domain)
);

-- Idea versions (conversation + outputs snapshot)
CREATE TABLE idea_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id         UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    conversation    JSONB NOT NULL DEFAULT '[]'::jsonb,
    outputs         JSONB DEFAULT '{}'::jsonb,
    ppt_storage_path  TEXT,
    zip_storage_path  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(idea_id, version_number)
);

-- Indexes for common queries
CREATE INDEX idx_ideas_user_id ON ideas(user_id);
CREATE INDEX idx_ideas_updated_at ON ideas(updated_at DESC);
CREATE INDEX idx_idea_versions_idea_id ON idea_versions(idea_id);
CREATE INDEX idx_idea_versions_created_at ON idea_versions(created_at DESC);
