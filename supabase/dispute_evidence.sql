-- Per-item tagged evidence for the dispute flow. Until now a dispute round
-- carried at most one evidence_text + a flat evidence_photos array on
-- booking_events (see booking_escrow.sql) — enough for a single freeform
-- submission, but not for tagging each item's type (Photo/Video/
-- Screenshot/Document/Message/Other) or describing what it shows
-- individually, which the redesigned evidence-upload step needs.
--
-- One row per uploaded/described item. `round` mirrors the booking's
-- dispute_round at submission time, same convention booking_events already
-- uses, so evidence can be grouped per round alongside the events timeline.
-- Reuses the existing private booking-evidence Storage bucket for the
-- actual files (storage_path, same {uploaderUserId}/{bookingId}/{filename}
-- layout) — evidence_type/description/text-only items live only in this
-- table.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

create table if not exists public.dispute_evidence (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings on delete cascade not null,
  round int not null default 1,
  submitted_by uuid references auth.users(id) not null,
  role text not null check (role in ('client', 'freelancer')),
  evidence_type text not null check (evidence_type in ('photo', 'video', 'screenshot', 'document', 'message', 'other')),
  storage_path text,
  description text,
  created_at timestamptz default timezone('utc', now()) not null
);

create index if not exists idx_dispute_evidence_booking_id on public.dispute_evidence(booking_id, round);

alter table public.dispute_evidence enable row level security;

DO $$ BEGIN
  CREATE POLICY "Participants view own dispute evidence" ON public.dispute_evidence FOR SELECT
    USING (auth.uid() in (select client_id from public.bookings where id = booking_id)
        OR auth.uid() in (select freelancer_id from public.bookings where id = booking_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins view all dispute evidence" ON public.dispute_evidence FOR SELECT
    USING (public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Submitter must be who they say AND actually hold that role on the
-- booking (closes the same actor-forgery hole booking_events' own insert
-- policy closes).
DO $$ BEGIN
  CREATE POLICY "Participants insert own dispute evidence as themselves" ON public.dispute_evidence FOR INSERT
    WITH CHECK (
      submitted_by = auth.uid()
      AND (
        (role = 'client' AND EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND client_id = auth.uid()))
        OR
        (role = 'freelancer' AND EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND freelancer_id = auth.uid()))
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pre-existing gap, not introduced by this migration: AdminBookingDetail.tsx
-- already reads booking-evidence files for the admin dispute view via
-- getBookingEvidenceSignedUrl(), but no storage policy has ever let an
-- admin (as opposed to a booking participant) actually read that bucket's
-- objects. Fixing it here since this migration is already extending the
-- same evidence-viewing surface for admins.
DO $$ BEGIN
  CREATE POLICY "Admins view all booking evidence" ON storage.objects FOR SELECT
    USING (bucket_id = 'booking-evidence' AND public.is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
