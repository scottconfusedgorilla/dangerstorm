-- ============================================
-- DangerStorm MVP — Supabase Storage bucket
-- ============================================

-- Create a private bucket for generated files (PPT, ZIP)
INSERT INTO storage.buckets (id, name, public)
VALUES ('outputs', 'outputs', false);

-- Users can upload to their own folder
CREATE POLICY "Users can upload own files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'outputs'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Users can read their own files
CREATE POLICY "Users can read own files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'outputs'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'outputs'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
