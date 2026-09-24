-- Lets a freelancer see who posted an Open Group Request and open their
-- profile, instead of it staying fully anonymous until a booking is
-- confirmed. internal_opportunity_json's own comment used to say "Never
-- includes client_id, the exact address, other applicants, or anyone's
-- subscription status" - this deliberately changes that first part; the
-- other guarantees (no exact address, no visibility into other applicants
-- or the client's Premium status) are untouched.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

create or replace function public.internal_opportunity_json(p_opp_id uuid, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'title', o.title,
    'description', o.description,
    'event_date', o.event_date,
    'start_time', o.start_time,
    'end_time', o.end_time,
    'location_city', o.location_city,
    'status', o.status,
    'created_at', o.created_at,
    'has_applied', exists (select 1 from public.group_opportunity_applications a where a.opportunity_id = o.id and a.freelancer_id = p_viewer),
    'client', (
      select jsonb_build_object('id', u.id, 'full_name', u.full_name, 'avatar_url', u.avatar_url)
      from public.users u where u.id = o.client_id
    ),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'category', r.category,
        'budget', r.budget,
        'currency', r.currency,
        'styles', r.styles,
        'slots', r.slots,
        'note', r.note,
        'slots_filled', (
          select count(*) from public.group_opportunity_applications a
          join public.requests q on q.id = a.request_id
          where a.role_id = r.id and q.status = 'accepted'
        ),
        'eligible', public.internal_freelancer_eligible_for_role(p_viewer, r.id)
      ) order by r.category)
      from public.group_opportunity_roles r where r.opportunity_id = o.id
    ), '[]'::jsonb)
  )
  from public.group_opportunities o where o.id = p_opp_id;
$$;
revoke all on function public.internal_opportunity_json(uuid, uuid) from public, anon, authenticated;
