-- Adds a freelancer reply to reviews, and makes reviews publicly readable
-- (they were previously only visible to the reviewer/reviewee). Run this
-- once against your Supabase project's SQL editor.

alter table public.reviews
  add column if not exists reply text,
  add column if not exists replied_at timestamptz;

DO $$ BEGIN
  CREATE POLICY "Reviews are viewable by everyone"
    ON public.reviews FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Reviewee can reply to own reviews"
    ON public.reviews FOR UPDATE
    USING (auth.uid() = reviewee_id)
    WITH CHECK (auth.uid() = reviewee_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
