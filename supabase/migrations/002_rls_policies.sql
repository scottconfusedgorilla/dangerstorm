-- ============================================
-- DangerStorm MVP — Row Level Security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_versions ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ---- IDEAS ----

CREATE POLICY "Users can view own ideas"
    ON ideas FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create own ideas"
    ON ideas FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own ideas"
    ON ideas FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own ideas"
    ON ideas FOR DELETE
    USING (user_id = auth.uid());

-- ---- IDEA VERSIONS ----

CREATE POLICY "Users can view own idea versions"
    ON idea_versions FOR SELECT
    USING (
        idea_id IN (SELECT id FROM ideas WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create own idea versions"
    ON idea_versions FOR INSERT
    WITH CHECK (
        idea_id IN (SELECT id FROM ideas WHERE user_id = auth.uid())
    );
