-- ForYouPage's post composer only ever created a browser-local blob: URL
-- for a photo/video (URL.createObjectURL) and stored THAT directly in
-- client_posts.image_url — never actually uploading the file anywhere. A
-- blob: URL only resolves inside the exact browser tab/document that
-- created it, so the "photo" looked fine immediately after posting and
-- then silently broke (fails to load, falls back to a placeholder) on the
-- next page reload, in any other tab, or for any other viewer — this is
-- the "newly uploaded photos disappear after a while" bug. Fixed on the
-- frontend by actually uploading to this new public bucket at publish
-- time and storing the real public URL — same pattern as the existing
-- 'avatars' bucket (see supabase/schema.sql).

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do update set public = excluded.public;

DO $$ BEGIN
  CREATE POLICY "Post media files are publicly viewable"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'post-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can upload own post media files"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'post-media'
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own post media files"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'post-media'
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
