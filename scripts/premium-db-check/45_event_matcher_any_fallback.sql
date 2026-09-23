\set ON_ERROR_STOP on
\set QUIET on
-- supabase/event_matcher_fallback_after_filtering.sql: get_event_matcher_candidates
-- goes back to strict Premium-only (no DB-side category fallback); the new
-- get_event_matcher_candidates_any() is a separate, Premium-blind function
-- the frontend calls only as a second attempt.
\set K   '''00000000-0000-0000-0000-0000000000c0'''
\set P1  '''00000000-0000-0000-0000-0000000000c1'''
\set FR1 '''00000000-0000-0000-0000-0000000000c2'''
\set FR2 '''00000000-0000-0000-0000-0000000000c3'''

insert into public.users (id, full_name, role, account_status) values
  (:K,'Client F','client','active'),
  (:P1,'Subscribed Illustrator','freelancer','active'),
  (:FR1,'Free Illustrator 1','freelancer','active'),
  (:FR2,'Free Illustrator 2','freelancer','active');

insert into public.freelancer_profiles (user_id, title, is_available, visibility)
  values (:P1,'Fashion Designer',true,'public'), (:FR1,'Fashion Designer',true,'public'), (:FR2,'Fashion Designer',true,'public');
insert into public.freelancer_subscriptions (user_id, plan, current_period_end) values (:P1,'monthly', now() + interval '10 days');

set role authenticated; select public.as_user(:K);

select public.ok(
  'get_event_matcher_candidates (strict) returns only the Premium freelancer, not the two free ones',
  (select jsonb_agg(c->>'user_id' order by c->>'user_id') from jsonb_array_elements(public.get_event_matcher_candidates('Fashion Designer')) c) = jsonb_build_array(:P1::text)
);

select public.ok(
  'get_event_matcher_candidates_any returns all three regardless of Premium',
  (select jsonb_agg(c->>'user_id' order by c->>'user_id') from jsonb_array_elements(public.get_event_matcher_candidates_any('Fashion Designer')) c)
    = (select jsonb_agg(x order by x) from jsonb_array_elements_text(jsonb_build_array(:P1::text, :FR1::text, :FR2::text)) x)
);

select public.ok(
  'a category with zero freelancers at all: both functions return empty, not an error',
  public.get_event_matcher_candidates('Hair Stylist') = '[]'::jsonb
  and public.get_event_matcher_candidates_any('Hair Stylist') = '[]'::jsonb
);

select public.ok(
  'neither function''s result ever contains a premium/subscription field (no status leak)',
  not (public.get_event_matcher_candidates_any('Fashion Designer')::text ~* '(premium|subscription|period_end)')
);

reset role;
select public.ok('anon cannot call get_event_matcher_candidates', public.err_of('set role anon; select public.get_event_matcher_candidates(''Fashion Designer'')') ilike '%permission denied%');
reset role;
select public.ok('anon cannot call get_event_matcher_candidates_any either', public.err_of('set role anon; select public.get_event_matcher_candidates_any(''Fashion Designer'')') ilike '%permission denied%');
reset role;
\echo ALL CHECKS PASSED
