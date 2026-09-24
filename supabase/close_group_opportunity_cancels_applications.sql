-- close_group_opportunity() only ever flipped group_opportunities.status to
-- 'closed' - every application sitting at pending/countered stayed exactly
-- there forever, with no signal to the freelancer that the client cancelled
-- the event. The frontend already fully supports a cancelled application
-- (GroupApplication.request_status includes 'cancelled', applicationStatusLabel()
-- already renders it as "Withdrawn by client", and notify_group_application_update
-- already has a case for it) - this was the one place nothing ever set it.
--
-- Run this once against your Supabase project's SQL editor. Safe to re-run.

create or replace function public.close_group_opportunity(p_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.group_opportunities set status = 'closed'
    where id = p_opportunity_id and client_id = auth.uid();
  if not found then raise exception 'Opportunity not found'; end if;

  -- Withdraw every application that hasn't already been settled - accepted
  -- ones are real bookings now and untouched by this, rejected/completed
  -- ones are already final.
  update public.requests r
  set status = 'cancelled'
  from public.group_opportunity_applications a
  where a.opportunity_id = p_opportunity_id
    and a.request_id = r.id
    and r.status not in ('accepted', 'rejected', 'completed', 'cancelled');
end;
$$;
