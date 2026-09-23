\set ON_ERROR_STOP on
\set QUIET on
-- Event Matcher premium-fallback (supabase/event_matcher_premium_fallback.sql):
-- a category with zero Premium freelancers falls back to everyone else who
-- qualifies; a category with at least one Premium freelancer stays
-- Premium-only.
\set K   '''00000000-0000-0000-0000-0000000000e0'''
\set P1  '''00000000-0000-0000-0000-0000000000e1'''
\set F1  '''00000000-0000-0000-0000-0000000000e2'''
\set F2  '''00000000-0000-0000-0000-0000000000e3'''
\set NP1 '''00000000-0000-0000-0000-0000000000e4'''
\set NP2 '''00000000-0000-0000-0000-0000000000e5'''

insert into public.users (id, full_name, role, account_status) values
  (:K,'Client E','client','active'),
  (:P1,'Premium DJ','freelancer','active'),
  (:F1,'Free DJ 1','freelancer','active'),
  (:F2,'Free DJ 2','freelancer','active'),
  (:NP1,'No-premium-category Videog 1','freelancer','active'),
  (:NP2,'No-premium-category Videog 2','freelancer','active');

insert into public.freelancer_profiles (user_id, title, is_available, visibility)
  values (:P1,'Musician',true,'public'), (:F1,'Musician',true,'public'), (:F2,'Musician',true,'public');
insert into public.freelancer_profiles (user_id, title, is_available, visibility)
  values (:NP1,'Videographer',true,'public'), (:NP2,'Videographer',true,'public');

-- Only P1 (of the 3 Musician freelancers) has an active subscription; neither Videographer does.
insert into public.freelancer_subscriptions (user_id, plan, current_period_end)
  values (:P1,'monthly', now() + interval '10 days');

set role authenticated; select public.as_user(:K);

select public.ok(
  'Musician (one Premium exists): only the Premium freelancer is returned',
  (select jsonb_agg(c->>'user_id' order by c->>'user_id') from jsonb_array_elements(public.get_event_matcher_candidates('Musician')) c) = jsonb_build_array(:P1::text)
);

select public.ok(
  'Videographer (zero Premium exist): both non-Premium freelancers fill in',
  (select jsonb_agg(c->>'user_id' order by c->>'user_id') from jsonb_array_elements(public.get_event_matcher_candidates('Videographer')) c)
    = (select jsonb_agg(x order by x) from jsonb_array_elements_text(jsonb_build_array(:NP1::text, :NP2::text)) x)
);

select public.ok(
  'a category with no freelancers at all still returns an empty array, not an error',
  public.get_event_matcher_candidates('Hair Stylist') = '[]'::jsonb
);

reset role;
-- Once F1 also buys Premium, the fallback category's Premium tier grows -
-- but Musician (which already had P1) was never affected by the fallback.
insert into public.freelancer_subscriptions (user_id, plan, current_period_end) values (:F1,'monthly', now() + interval '10 days');
set role authenticated; select public.as_user(:K);
select public.ok(
  'Musician now returns both Premium freelancers (P1 and the newly-subscribed F1), never F2',
  (select jsonb_agg(c->>'user_id' order by c->>'user_id') from jsonb_array_elements(public.get_event_matcher_candidates('Musician')) c)
    = (select jsonb_agg(x order by x) from jsonb_array_elements_text(jsonb_build_array(:P1::text, :F1::text)) x)
);
reset role;

select public.ok('anon still cannot call the fallback-aware function', public.err_of('set role anon; select public.get_event_matcher_candidates(''Musician'')') ilike '%permission denied%');
reset role;
\echo ALL CHECKS PASSED
