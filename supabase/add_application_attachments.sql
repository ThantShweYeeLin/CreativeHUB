-- Lets a freelancer attach photos (e.g. relevant portfolio samples) when
-- applying to an Open Group Request, and lets the client who posted the
-- request see them on their My Requests page. Same public-read,
-- own-folder-write bucket pattern as post-media/avatars (see
-- supabase/post_media_storage.sql) - these are portfolio-style images the
-- freelancer wants a prospective client to see, same sensitivity level as
-- a For You post photo.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

insert into storage.buckets (id, name, public)
values ('application-attachments', 'application-attachments', true)
on conflict (id) do update set public = excluded.public;

DO $$ BEGIN
  CREATE POLICY "Application attachment files are publicly viewable"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'application-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can upload own application attachment files"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'application-attachments'
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own application attachment files"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'application-attachments'
      AND auth.role() = 'authenticated'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Stored on both tables, same duplication apply_to_group_opportunity()
-- already does for the freelancer's message: group_opportunity_applications
-- is the freelancer-facing "My applications" source, requests/the row the
-- client actually reads on My Requests is the client-facing one.
alter table public.group_opportunity_applications
  add column if not exists attachment_urls text[] default array[]::text[];
alter table public.requests
  add column if not exists attachment_urls text[] default array[]::text[];

create or replace function public.apply_to_group_opportunity(
  p_role_id uuid, p_price numeric, p_message text default null, p_attachment_urls text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_role public.group_opportunity_roles;
  v_opp public.group_opportunities;
  v_request_id uuid;
  v_app_id uuid;
  v_msg text;
  v_schedule text;
  v_filled integer;
  v_start time;
  v_end time;
  v_attachments text[] := coalesce(p_attachment_urls, array[]::text[]);
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Enter a valid price'; end if;
  if array_length(v_attachments, 1) > 6 then raise exception 'Attach at most 6 photos'; end if;

  select * into v_role from public.group_opportunity_roles where id = p_role_id;
  if not found then raise exception 'Opportunity not found'; end if;
  select * into v_opp from public.group_opportunities where id = v_role.opportunity_id;

  if v_opp.client_id = v_me then raise exception 'You cannot apply to your own request'; end if;
  if v_opp.status <> 'open' or v_opp.event_date < current_date then raise exception 'This request is no longer open'; end if;

  if not public.internal_has_active_premium(v_me) then raise exception 'PREMIUM_REQUIRED'; end if;

  if exists (select 1 from public.group_opportunity_applications where opportunity_id = v_opp.id and freelancer_id = v_me) then
    raise exception 'ALREADY_APPLIED';
  end if;

  select count(*) into v_filled
    from public.group_opportunity_applications a
    join public.requests q on q.id = a.request_id
    where a.role_id = v_role.id and q.status = 'accepted';
  if v_filled >= v_role.slots then raise exception 'ROLE_FILLED'; end if;

  if not public.internal_freelancer_eligible_for_role(v_me, v_role.id) then
    raise exception 'NOT_ELIGIBLE';
  end if;

  v_start := coalesce(v_opp.start_time, time '12:00');
  v_end := coalesce(v_opp.end_time, v_start + interval '2 hours');
  v_schedule := '[[SCHEDULE_META:' || v_opp.event_date::text || ':' || to_char(v_start, 'HH24:MI') || ':' || to_char(v_end, 'HH24:MI') || ']]';
  v_msg := coalesce(nullif(trim(p_message), ''), 'Applying to your open Group Request.')
    || E'\n\n' || v_schedule
    || case when v_opp.location_city is not null then E'\n\n[[LOCATION_META:' || replace(v_opp.location_city, ']', '') || ']]' else '' end;

  insert into public.requests (
    client_id, freelancer_id, project_name, description, message, budget, status,
    counter_price, counter_message, counter_by, counter_round,
    counter_date, counter_time, counter_end_time,
    start_date, start_time, end_time, attachment_urls
  ) values (
    v_opp.client_id, v_me, v_opp.title || ' — ' || v_role.category, v_msg, v_msg, v_role.budget, 'countered',
    p_price, nullif(trim(p_message), ''), 'freelancer', 1,
    v_opp.event_date, v_start, v_end,
    v_opp.event_date, v_start, v_end, v_attachments
  ) returning id into v_request_id;

  begin
    insert into public.group_opportunity_applications (opportunity_id, role_id, freelancer_id, request_id, proposed_price, message, attachment_urls)
    values (v_opp.id, v_role.id, v_me, v_request_id, p_price, nullif(trim(p_message), ''), v_attachments)
    returning id into v_app_id;
  exception when unique_violation then
    raise exception 'ALREADY_APPLIED';
  end;

  insert into public.request_offers (request_id, round, offered_by, action, price, message, date, time, end_time)
  values (v_request_id, 1, 'freelancer', 'counter', p_price, nullif(trim(p_message), ''), v_opp.event_date, v_start, v_end);

  -- The client sees this like any other freelancer counter-offer. The type
  -- contains "request" so the notification panel routes it to My Requests.
  insert into public.notifications (user_id, actor_id, type, title, message, related_id, read, metadata)
  values (
    v_opp.client_id, v_me, 'group_application_request', 'New application on your Group Request',
    'A freelancer applied to "' || v_opp.title || '" as ' || v_role.category || '. Review it in My Requests.',
    v_request_id, false, jsonb_build_object('request_id', v_request_id, 'opportunity_id', v_opp.id)
  );

  return v_app_id;
end;
$$;
revoke all on function public.apply_to_group_opportunity(uuid, numeric, text, text[]) from public, anon;
grant execute on function public.apply_to_group_opportunity(uuid, numeric, text, text[]) to authenticated;

-- The old 3-argument signature no longer exists once CREATE OR REPLACE above
-- runs (Postgres treats a different parameter list as a different function,
-- so the previous 3-arg version is left behind as dead code) - drop it so
-- there's only ever one apply_to_group_opportunity to call.
drop function if exists public.apply_to_group_opportunity(uuid, numeric, text);
