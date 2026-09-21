\set ON_ERROR_STOP on
\set QUIET on
-- helpers (created as superuser, usable by every role)
create or replace function public.ok(name text, cond boolean) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL  %', name; end if;
  raise notice 'PASS  %', name;
end $$;
-- runs a statement and reports the error message (or null if it succeeded)
create or replace function public.err_of(stmt text) returns text language plpgsql as $$
begin execute stmt; return null; exception when others then return sqlerrm; end $$;
grant execute on function public.ok(text, boolean), public.err_of(text) to public;
create or replace function public.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;

-- ---------- fixtures (superuser) ----------
\set C   '''00000000-0000-0000-0000-00000000000c'''
\set F1  '''00000000-0000-0000-0000-0000000000f1'''
\set F2  '''00000000-0000-0000-0000-0000000000f2'''
\set F3  '''00000000-0000-0000-0000-0000000000f3'''
\set F4  '''00000000-0000-0000-0000-0000000000f4'''
\set F5  '''00000000-0000-0000-0000-0000000000f5'''
\set F6  '''00000000-0000-0000-0000-0000000000f6'''
\set F7  '''00000000-0000-0000-0000-0000000000f7'''
\set F8  '''00000000-0000-0000-0000-0000000000f8'''
\set F9  '''00000000-0000-0000-0000-0000000000f9'''

insert into public.users (id, full_name, role) values
 (:C,'Client','client'),(:F1,'F1 premium makeup','freelancer'),(:F2,'F2 free makeup','freelancer'),
 (:F3,'F3 expired makeup','freelancer'),(:F4,'F4 premium photographer','freelancer'),(:F5,'F5 busy makeup','freelancer'),
 (:F6,'F6 phuket makeup','freelancer'),(:F7,'F7 alerts off makeup','freelancer'),(:F8,'F8 blocked makeup','freelancer'),
 (:F9,'F9 premium makeup 2','freelancer');
update public.users set account_status='active';

insert into public.freelancer_profiles (user_id, title, locations) select u, 'Makeup Artist',
  '[{"city":"Bangkok","latitude":13.75,"longitude":100.49}]'::jsonb from (values (:F1::uuid),(:F2),(:F3),(:F5),(:F7),(:F8),(:F9)) v(u);
insert into public.freelancer_profiles (user_id, title, locations) values
 (:F4,'Photographer','[{"city":"Bangkok","latitude":13.72,"longitude":100.48}]'),
 (:F6,'Makeup Artist','[{"city":"Phuket","latitude":7.93,"longitude":98.35}]');

-- subscriptions: F1,F4,F5,F6,F7,F8,F9 active; F3 expired; F2 none
insert into public.freelancer_subscriptions (user_id, plan, current_period_end)
  select u, 'monthly', now() + interval '20 days' from (values (:F1::uuid),(:F4),(:F5),(:F6),(:F7),(:F8),(:F9)) v(u);
insert into public.freelancer_subscriptions (user_id, plan, current_period_end) values (:F3, 'monthly', now() - interval '1 day');

-- F5 has a booking on the event day; F8 is blocked by the client; F7 turned alerts off
insert into public.bookings (client_id, freelancer_id, start_date, status) values (:C, :F5, current_date + 30, 'confirmed');
insert into public.blocked_users (blocker_id, blocked_id) values (:C, :F8);
insert into public.notification_preferences (user_id, opportunity_alerts) values (:F7, false);

-- ---------- 1. tables are not writable by signed-in users ----------
set role authenticated; select public.as_user(:F2);
select public.ok('free user cannot grant themselves Premium (insert subscription)',
  public.err_of('insert into public.freelancer_subscriptions (user_id, plan, current_period_end) values (' || quote_literal(:F2) || ', ''annual'', now() + interval ''1 year'')') ilike '%permission denied%');
select public.ok('user cannot extend their own subscription (update)',
  public.err_of('update public.freelancer_subscriptions set current_period_end = now() + interval ''10 years'' where user_id = ' || quote_literal(:F3)) ilike '%permission denied%');
select public.ok('user cannot call activate_freelancer_subscription',
  public.err_of('select public.activate_freelancer_subscription(' || quote_literal(:F2) || ', ''annual'', ''chrg_x'', 99900)') ilike '%permission denied%');
select public.ok('user cannot probe internal_has_active_premium for someone else',
  public.err_of('select public.internal_has_active_premium(' || quote_literal(:F1) || ')') ilike '%permission denied%');
select public.ok('user cannot insert an application directly',
  public.err_of('insert into public.group_opportunity_applications (opportunity_id, role_id, freelancer_id, proposed_price) values (gen_random_uuid(), gen_random_uuid(), ' || quote_literal(:F2) || ', 1)') ilike '%permission denied%');
select public.ok('a user sees only their own subscription row',
  (select count(*) from public.freelancer_subscriptions) = 0);
select public.as_user(:F1);
select public.ok('a Premium user sees only their own subscription row',
  (select count(*) from public.freelancer_subscriptions) = 1);
reset role;

-- ---------- 2. Client posts an open Group Request ----------
set role authenticated; select public.as_user(:C);
select public.create_group_opportunity(jsonb_build_object(
  'title','Bangkok wedding team','description','Full-day wedding','event_date', (current_date + 30)::text,
  'start_time','09:00','end_time','17:00','location_city','Bangkok','location_text','Bangkok, Thailand',
  'location_lat', 13.75, 'location_lng', 100.5,
  'roles', jsonb_build_array(
     jsonb_build_object('category','Makeup Artist','budget',5000,'currency','THB','slots',1),
     jsonb_build_object('category','Photographer','budget',9000,'currency','THB','slots',2)))) as opp \gset
reset role;
select id as opp_id from public.group_opportunities limit 1 \gset
select id as role_makeup from public.group_opportunity_roles where category='Makeup Artist' \gset
select id as role_photo from public.group_opportunity_roles where category='Photographer' \gset

select public.ok('eligible Premium freelancers were notified (F1, F4, F9)',
  (select array_agg(user_id order by user_id) from public.notifications where type='opportunity_new')
    = array[:F1::uuid, :F4::uuid, :F9::uuid]);
select public.ok('free (F2), expired (F3), busy (F5), far (F6), alerts-off (F7), blocked (F8) and the client got nothing',
  not exists (select 1 from public.notifications where type='opportunity_new' and user_id in (:F2,:F3,:F5,:F6,:F7,:F8,:C)));
select public.ok('each freelancer notified once per opportunity', (select count(*) from public.notifications where type='opportunity_new') = 3);
select public.ok('opportunity notifications carry no client identity',
  not exists (select 1 from public.notifications where type='opportunity_new' and (actor_id is not null or message ilike '%Client%')));

-- ---------- 3. discovery: free vs Premium vs expired ----------
set role authenticated;
select public.as_user(:F2);
select public.ok('free user cannot list opportunities', public.err_of('select public.get_group_opportunities()') ilike '%PREMIUM_REQUIRED%');
select public.ok('free user cannot open an opportunity', public.err_of('select public.get_group_opportunity(''' || :'opp_id' || ''')') ilike '%PREMIUM_REQUIRED%');
select public.ok('free user cannot apply', public.err_of('select public.apply_to_group_opportunity(''' || :'role_makeup' || ''', 4000, ''hi'')') ilike '%PREMIUM_REQUIRED%');
select public.as_user(:F3);
select public.ok('expired subscription cannot list', public.err_of('select public.get_group_opportunities()') ilike '%PREMIUM_REQUIRED%');
select public.ok('expired subscription cannot apply', public.err_of('select public.apply_to_group_opportunity(''' || :'role_makeup' || ''', 4000, ''hi'')') ilike '%PREMIUM_REQUIRED%');
select public.as_user(:F1);
select public.ok('Premium makeup artist sees the opportunity', jsonb_array_length(public.get_group_opportunities()) = 1);
select public.ok('list never exposes client_id, exact address or subscription info',
  (public.get_group_opportunities()::text) !~ '(client_id|location_text|location_lat|subscription|premium)');
select public.as_user(:F6);
select public.ok('Premium freelancer outside the area sees nothing', jsonb_array_length(public.get_group_opportunities()) = 0);
select public.ok('...and cannot apply (not eligible)', public.err_of('select public.apply_to_group_opportunity(''' || :'role_makeup' || ''', 4000, ''hi'')') ilike '%NOT_ELIGIBLE%');
select public.as_user(:F5);
select public.ok('Premium freelancer busy on the day sees nothing', jsonb_array_length(public.get_group_opportunities()) = 0);
select public.as_user(:F8);
select public.ok('Premium freelancer blocked by the client sees nothing', jsonb_array_length(public.get_group_opportunities()) = 0);
select public.as_user(:F4);
select public.ok('applying to a role of another category is rejected', public.err_of('select public.apply_to_group_opportunity(''' || :'role_makeup' || ''', 4000, ''hi'')') ilike '%NOT_ELIGIBLE%');
select public.as_user(:C);
select public.ok('client cannot apply to their own request', public.err_of('select public.apply_to_group_opportunity(''' || :'role_makeup' || ''', 4000, ''hi'')') ilike '%own request%');
reset role;

-- ---------- 4. applying ----------
set role authenticated; select public.as_user(:F1);
select public.apply_to_group_opportunity(:'role_makeup', 4500, 'I have 8 years of bridal experience') as app1 \gset
select public.ok('application created a freelancer counter-offer the client can review',
  (select count(*) from public.requests where client_id = :C and freelancer_id = :F1 and status = 'countered' and counter_by = 'freelancer' and counter_price = 4500) = 1);
select public.ok('duplicate application to the same request is rejected',
  public.err_of('select public.apply_to_group_opportunity(''' || :'role_makeup' || ''', 4600, ''again'')') ilike '%ALREADY_APPLIED%');
select public.ok('duplicate is rejected even via a different role of the same opportunity',
  public.err_of('select public.apply_to_group_opportunity(''' || :'role_photo' || ''', 4600, ''again'')') ilike '%ALREADY_APPLIED%');
select public.ok('exactly one application row exists', (select count(*) from public.group_opportunity_applications) = 1);
select public.ok('applicant sees their own application', jsonb_array_length(public.get_my_group_applications()) = 1);
select public.as_user(:F9);
select public.ok('another freelancer cannot read that application (RLS)', (select count(*) from public.group_opportunity_applications) = 0);
select public.ok('another freelancer''s own list is empty', jsonb_array_length(public.get_my_group_applications()) = 0);
select public.as_user(:C);
select public.ok('client can read the application on their opportunity', (select count(*) from public.group_opportunity_applications) = 1);
reset role;
select public.ok('client was notified of the application',
  exists (select 1 from public.notifications where user_id = :C and type = 'group_application_request'));

-- ---------- 5. application status -> notifications (uses the existing requests table, as the client would) ----------
select id as req1 from public.requests where freelancer_id = :F1 \gset
update public.requests set status = 'countered', counter_by = 'client', counter_price = 4200 where id = :'req1';
select public.ok('client counter-offer notifies the applicant',
  (select count(*) from public.notifications where user_id = :F1 and type = 'application_update' and metadata->>'event' = 'countered') = 1);
update public.requests set counter_price = 4300 where id = :'req1';
select public.ok('an unrelated edit does not notify again',
  (select count(*) from public.notifications where user_id = :F1 and type = 'application_update') = 1);
set role authenticated; select public.as_user(:F1);
select public.accept_group_application(:'req1') as acc1 \gset
reset role;
select public.ok('acceptance notifies the applicant',
  (select count(*) from public.notifications where user_id = :F1 and type = 'application_update' and metadata->>'event' = 'accepted') = 1);
update public.requests set status = 'accepted', updated_at = now() where id = :'req1';
select public.ok('re-saving the same status does not duplicate the notification',
  (select count(*) from public.notifications where user_id = :F1 and type = 'application_update' and metadata->>'event' = 'accepted') = 1);
select public.ok('status notifications never mention the client identity',
  not exists (select 1 from public.notifications where type = 'application_update' and (actor_id is not null or message ilike '%Client%')));
-- a non-application request does not produce application notifications
insert into public.requests (client_id, freelancer_id, project_name, status) values (:C, :F9, 'plain request', 'pending');
update public.requests set status = 'accepted' where freelancer_id = :F9;
select public.ok('ordinary (non-application) requests do not trigger application notifications',
  not exists (select 1 from public.notifications where user_id = :F9 and type = 'application_update'));
-- preference off -> no notification
update public.freelancer_subscriptions set current_period_end = now() + interval '5 days' where user_id = :F9;
insert into public.notification_preferences (user_id, application_updates) values (:F9, false);
update public.group_opportunity_roles set slots = 2 where id = :'role_makeup';
set role authenticated; select public.as_user(:F9);
select public.apply_to_group_opportunity(:'role_makeup', 4400, null) as app9 \gset
reset role;
update public.requests set status = 'rejected' where freelancer_id = :F9 and project_name like 'Bangkok%';
select public.ok('application-update preference off suppresses the notification',
  not exists (select 1 from public.notifications where user_id = :F9 and type = 'application_update'));

-- ---------- 6. expiry preserves existing commitments ----------
update public.freelancer_subscriptions set current_period_end = now() - interval '1 hour' where user_id = :F1;
set role authenticated; select public.as_user(:F1);
select public.ok('after expiry the accepted application is still listed and accepted',
  (select (a->>'request_status') from jsonb_array_elements(public.get_my_group_applications()) a limit 1) = 'accepted');
select public.ok('after expiry the applied opportunity can still be opened', public.get_group_opportunity(:'opp_id') is not null);
select public.ok('after expiry discovery is closed again', public.err_of('select public.get_group_opportunities()') ilike '%PREMIUM_REQUIRED%');
reset role;
select public.ok('the accepted request row is untouched by expiry', (select status::text from public.requests where id = :'req1') = 'accepted');
select public.ok('the freelancer still cannot appear in Event Matching once expired',
  not exists (select 1 from jsonb_array_elements(public.get_event_matcher_candidates('Makeup Artist')) c where c->>'user_id' = :F1));

-- ---------- 7. roles fill up ----------
update public.group_opportunity_roles set slots = 1 where id = :'role_makeup';
update public.freelancer_subscriptions set current_period_end = now() + interval '10 days' where user_id in (:F1, :F7);
set role authenticated; select public.as_user(:F7);
select public.ok('a role whose slot is already accepted is closed to new applicants',
  public.err_of('select public.apply_to_group_opportunity(''' || :'role_makeup' || ''', 4000, ''late'')') ilike '%ROLE_FILLED%');
reset role;

-- ---------- 8. Event Matching eligibility ----------
update public.freelancer_subscriptions set current_period_end = now() + interval '10 days' where user_id = :F1;
set role authenticated; select public.as_user(:C);
select public.ok('event matcher returns only active-Premium freelancers of the category',
  (select array_agg(c->>'user_id' order by c->>'user_id') from jsonb_array_elements(public.get_event_matcher_candidates('Makeup Artist')) c)
   = array[:F1::text,:F5::text,:F6::text,:F7::text,:F8::text,:F9::text]);
select public.ok('free (F2) and expired (F3) freelancers do not appear',
  not exists (select 1 from jsonb_array_elements(public.get_event_matcher_candidates('Makeup Artist')) c where c->>'user_id' in (:F2::text,:F3::text)));
select public.ok('the result shape carries no subscription/premium field',
  not exists (select 1 from jsonb_array_elements(public.get_event_matcher_candidates('Makeup Artist')) c, jsonb_object_keys(c) k where k ~* '(premium|subscription|period)')
  and not exists (select 1 from jsonb_array_elements(public.get_event_matcher_candidates('Makeup Artist')) c, jsonb_object_keys(c->'users') k where k ~* '(premium|subscription|period)'));
select public.ok('the result keeps the fields the matcher scores on',
  (public.get_event_matcher_candidates('Makeup Artist')->0) ?& array['id','user_id','styles','experience_years','hourly_rate','locations','studio_locations','users']);
reset role;
select public.ok('anonymous callers get nothing from event matching',
  public.err_of('set role anon; select public.get_event_matcher_candidates(''Makeup Artist'')') ilike '%permission denied%');
reset role;

-- ---------- 9. subscription lifecycle (service role = the server) ----------
set role service_role;
select public.activate_freelancer_subscription(:F2, 'monthly', 'chrg_test_1', 9900);
select public.ok('a paid monthly charge activates ~1 month',
  (select current_period_end between now() + interval '29 days' and now() + interval '32 days' from public.freelancer_subscriptions where user_id = :F2));
select public.activate_freelancer_subscription(:F2, 'monthly', 'chrg_test_1', 9900);
select public.ok('confirming the same charge twice grants nothing extra',
  (select count(*) from public.subscription_payments where omise_charge_id = 'chrg_test_1') = 1
  and (select current_period_end < now() + interval '32 days' from public.freelancer_subscriptions where user_id = :F2));
select public.activate_freelancer_subscription(:F2, 'annual', 'chrg_test_2', 99900);
select public.ok('an annual renewal extends from the end of the running period (no lost time)',
  (select current_period_end > now() + interval '390 days' from public.freelancer_subscriptions where user_id = :F2));
reset role;
set role authenticated; select public.as_user(:F2);
select public.cancel_my_subscription();
select public.ok('cancelling turns renewal off but access continues to the period end',
  (select status = 'cancelled' and current_period_end > now() from public.freelancer_subscriptions where user_id = :F2));
select public.ok('a cancelled-but-unexpired subscriber can still use Premium', jsonb_typeof(public.get_group_opportunities()) = 'array');
select public.as_user(:F3);
select public.ok('cancelling with no active subscription is rejected', public.err_of('select public.cancel_my_subscription()') ilike '%No active subscription%');
reset role;

-- ---------- 10. anonymous access ----------
set role anon;
select public.ok('anon cannot list opportunities', public.err_of('select public.get_group_opportunities()') ilike '%permission denied%');
select public.ok('anon cannot read subscriptions', public.err_of('select * from public.freelancer_subscriptions') ilike '%permission denied%');
reset role;

-- ---------- 11. abuse limits ----------
set role authenticated; select public.as_user(:C);
do $$ declare i int; begin
  for i in 1..4 loop
    perform public.create_group_opportunity(jsonb_build_object('title','Extra '||i,'event_date',(current_date+40)::text,
      'roles', jsonb_build_array(jsonb_build_object('category','Makeup Artist','budget',1000))));
  end loop;
end $$;
select public.ok('a client cannot keep more than 5 open group requests',
  public.err_of('select public.create_group_opportunity(jsonb_build_object(''title'',''Sixth'',''event_date'',(current_date+41)::text,''roles'',jsonb_build_array(jsonb_build_object(''category'',''Makeup Artist'',''budget'',1000))))') ilike '%5 open%');
select public.ok('a past event date is rejected',
  public.err_of('select public.create_group_opportunity(jsonb_build_object(''title'',''Old one'',''event_date'',(current_date-1)::text,''roles'',jsonb_build_array(jsonb_build_object(''category'',''Makeup Artist'',''budget'',1000))))') ilike '%today or later%');
select public.close_group_opportunity(:'opp_id');
select public.as_user(:F9);
select public.ok('a closed request can no longer be applied to',
  public.err_of('select public.apply_to_group_opportunity(''' || :'role_photo' || ''', 1000, ''x'')') ilike '%no longer open%');
reset role;
\echo ALL CHECKS PASSED
