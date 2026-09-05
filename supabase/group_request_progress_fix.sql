-- acceptRequestAndCreateBooking() (src/lib/acceptRequest.ts) needs to know
-- how many of a group request's recipients have accepted so far, to detect
-- the moment everyone has and auto-create the group chat. It used to do
-- this via getClientRequestsWithProgress(request.client_id), which queries
-- `requests` as whichever user is currently authenticated - almost always
-- the FREELANCER who's accepting, not the client. The "Users see own
-- requests" RLS policy only lets a freelancer see rows where they
-- themselves are client_id or freelancer_id, so a freelancer accepting
-- their own slot in a group request could never see their sibling
-- freelancers' rows in the same group - `total` always came out as 1,
-- so the "everyone accepted" check could never be satisfied by a
-- freelancer's own acceptance (the normal, expected way a group
-- completes). This adds a security-definer function that returns every
-- member's freelancer_id/status for a given group_id regardless of who's
-- asking - safe to expose broadly since it only reveals acceptance status
-- for a group_id the caller already knows, not any request content.
--
-- group_id isn't a real column - it's embedded as `"group_id":"<value>"`
-- inside a [GROUP_REQUEST]{...} JSON blob appended to message/description
-- (see src/lib/groupRequest.ts) - hence the text match below rather than
-- an indexed equality lookup.

create or replace function public.get_group_request_members(p_group_id text)
returns table(freelancer_id uuid, status text)
language sql
security definer
set search_path = public
stable
as $$
  select r.freelancer_id, r.status
  from public.requests r
  where r.message like '%"group_id":"' || p_group_id || '"%'
     or r.description like '%"group_id":"' || p_group_id || '"%';
$$;

revoke all on function public.get_group_request_members(text) from public;
grant execute on function public.get_group_request_members(text) to authenticated;
