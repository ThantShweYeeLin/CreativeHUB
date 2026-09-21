\set ON_ERROR_STOP on
\set QUIET on
-- Atomic acceptance of open-Group-Request applications (supabase/premium_hardening.sql).
-- Fresh actors so the earlier fixtures (5-open-request cap etc.) don't interfere.
\set K  '''00000000-0000-0000-0000-0000000000a0'''
\set A1 '''00000000-0000-0000-0000-0000000000a1'''
\set A2 '''00000000-0000-0000-0000-0000000000a2'''
\set A3 '''00000000-0000-0000-0000-0000000000a3'''
\set OUT '''00000000-0000-0000-0000-0000000000a9'''

insert into public.users (id, full_name, role, account_status) values
 (:K,'Client K','client','active'),(:A1,'A1','freelancer','active'),(:A2,'A2','freelancer','active'),
 (:A3,'A3','freelancer','active'),(:OUT,'Outsider','client','active');
insert into public.freelancer_profiles (user_id, title, locations)
  select u, 'DJ', '[{"city":"Bangkok","latitude":13.75,"longitude":100.49}]'::jsonb from (values (:A1::uuid),(:A2),(:A3)) v(u);
insert into public.freelancer_subscriptions (user_id, plan, current_period_end)
  select u, 'monthly', now() + interval '20 days' from (values (:A1::uuid),(:A2),(:A3)) v(u);

set role authenticated; select public.as_user(:K);
select public.create_group_opportunity(jsonb_build_object('title','Accept test','event_date',(current_date+45)::text,
  'start_time','18:00','end_time','22:00','location_city','Bangkok','location_lat',13.75,'location_lng',100.49,
  'roles', jsonb_build_array(jsonb_build_object('category','DJ','budget',3000,'slots',1)))) as opp \gset
reset role;
select id as role_dj from public.group_opportunity_roles where opportunity_id = :'opp' \gset

set role authenticated;
select public.as_user(:A1); select public.apply_to_group_opportunity(:'role_dj', 3100, 'A1 here') \gset
select public.as_user(:A2); select public.apply_to_group_opportunity(:'role_dj', 2900, 'A2 here') \gset
select public.as_user(:A3); select public.apply_to_group_opportunity(:'role_dj', 3000, 'A3 here') \gset
reset role;
select request_id as req1 from public.group_opportunity_applications where freelancer_id = :A1 \gset
select request_id as req2 from public.group_opportunity_applications where freelancer_id = :A2 \gset
select request_id as req3 from public.group_opportunity_applications where freelancer_id = :A3 \gset

-- ---------- authorization ----------
set role authenticated;
select public.as_user(:OUT);
select public.ok('an unrelated user cannot accept', public.err_of('select public.accept_group_application(''' || :'req1' || ''')') ilike '%Not authorized%');
select public.as_user(:A1);
select public.ok('the applicant cannot accept their own offer (only the other party can)',
  public.err_of('select public.accept_group_application(''' || :'req1' || ''')') ilike '%Only the other party%');
select public.ok('a plain request cannot go through the application function',
  public.err_of('select public.accept_group_application(gen_random_uuid())') ilike '%NOT_AN_APPLICATION%');
-- ---------- the guard trigger ----------
select public.as_user(:K);
select public.ok('the client cannot bypass the slot limit by flipping the request status directly',
  public.err_of('update public.requests set status = ''accepted'' where id = ''' || :'req2' || '''') ilike '%accept_group_application%');
reset role;
select public.ok('...and nothing was accepted by that attempt', (select status::text from public.requests where id = :'req2') = 'countered');

-- ---------- happy path: booking consistency ----------
set role authenticated; select public.as_user(:K);
select public.accept_group_application(:'req1') as res \gset
reset role;
select public.ok('acceptance returns the booking and the agreed price', (:'res'::jsonb->>'price')::numeric = 3100 and (:'res'::jsonb->>'booking_id') is not null);
select public.ok('the request is accepted at the agreed price', (select status::text = 'accepted' and budget = 3100 from public.requests where id = :'req1'));
select public.ok('exactly one booking exists for the acceptance', (select count(*) from public.bookings where client_id = :K and freelancer_id = :A1) = 1);
select public.ok('the booking carries price, 30% deposit, event date/time and a pending unpaid state',
  (select budget = 3100 and deposit_amount = 930 and status = 'pending' and payment_status = 'unpaid'
     and start_date = current_date + 45 and start_time = '18:00' and end_time = '22:00'
     and start_at = ((current_date + 45) + time '18:00') at time zone 'Asia/Bangkok'
     from public.bookings where freelancer_id = :A1));
select public.ok('the booking has a 24h deposit deadline and a locked agreement snapshot',
  (select deposit_deadline between now() + interval '23 hours' and now() + interval '25 hours'
      and (confirmed_agreement->>'price')::numeric = 3100 and confirmed_agreement->>'service' like 'Accept test%'
      from public.bookings where freelancer_id = :A1));
select public.ok('the application links to that same booking',
  (select a.booking_id = b.id from public.group_opportunity_applications a join public.bookings b on b.freelancer_id = a.freelancer_id where a.freelancer_id = :A1));
select public.ok('the applicant got exactly one accepted notification',
  (select count(*) from public.notifications where user_id = :A1 and type = 'application_update' and metadata->>'event' = 'accepted') = 1);

-- ---------- duplicate acceptance + the final slot ----------
set role authenticated; select public.as_user(:K);
select public.ok('accepting the same application again is rejected',
  public.err_of('select public.accept_group_application(''' || :'req1' || ''')') ilike '%ALREADY_ACCEPTED%');
select public.ok('the last slot is taken, so another applicant is refused (ROLE_FILLED)',
  public.err_of('select public.accept_group_application(''' || :'req2' || ''')') ilike '%ROLE_FILLED%');
reset role;
select public.ok('a refused acceptance leaves no booking, no status change, no link',
  (select count(*) from public.bookings where freelancer_id in (:A2, :A3)) = 0
  and (select count(*) from public.requests where id in (:'req2', :'req3') and status = 'countered') = 2
  and (select count(*) from public.group_opportunity_applications where freelancer_id in (:A2, :A3) and booking_id is not null) = 0);
select public.ok('no duplicate booking was created by the repeat acceptance', (select count(*) from public.bookings where client_id = :K) = 1);

-- ---------- rollback: a failing booking insert must not consume the slot ----------
-- New opportunity, one slot; A2 already has a pending booking that overlaps the event.
set role authenticated; select public.as_user(:K);
select public.create_group_opportunity(jsonb_build_object('title','Rollback test','event_date',(current_date+50)::text,
  'start_time','18:00','end_time','22:00','location_city','Bangkok','location_lat',13.75,'location_lng',100.49,
  'roles', jsonb_build_array(jsonb_build_object('category','DJ','budget',3000,'slots',1)))) as opp2 \gset
reset role;
select id as role2 from public.group_opportunity_roles where opportunity_id = :'opp2' \gset
set role authenticated;
select public.as_user(:A2); select public.apply_to_group_opportunity(:'role2', 3000, 'A2 again') \gset
select public.as_user(:A3); select public.apply_to_group_opportunity(:'role2', 3000, 'A3 again') \gset
reset role;
insert into public.bookings (client_id, freelancer_id, start_date, status, start_at, end_at)
  values (:OUT, :A2, current_date + 50, 'confirmed', ((current_date + 50) + time '17:00') at time zone 'Asia/Bangkok', ((current_date + 50) + time '20:00') at time zone 'Asia/Bangkok');
select request_id as r2b from public.group_opportunity_applications where freelancer_id = :A2 and opportunity_id = :'opp2' \gset
select request_id as r3b from public.group_opportunity_applications where freelancer_id = :A3 and opportunity_id = :'opp2' \gset
set role authenticated; select public.as_user(:K);
select public.ok('accepting a freelancer who is double-booked fails with BOOKING_SLOT_TAKEN',
  public.err_of('select public.accept_group_application(''' || :'r2b' || ''')') ilike '%BOOKING_SLOT_TAKEN%');
reset role;
select public.ok('the failed acceptance left NO partial state (request still open, no booking, no link)',
  (select status::text from public.requests where id = :'r2b') = 'countered'
  and (select count(*) from public.bookings where client_id = :K and freelancer_id = :A2) = 0
  and (select booking_id from public.group_opportunity_applications where request_id = :'r2b') is null);
set role authenticated; select public.as_user(:K);
select public.accept_group_application(:'r3b') as ok3 \gset
reset role;
select public.ok('the slot was NOT consumed by the failed attempt: the next applicant was accepted', (select status::text from public.requests where id = :'r3b') = 'accepted');

-- ---------- closed / expired / subscription ----------
set role authenticated; select public.as_user(:K);
select public.create_group_opportunity(jsonb_build_object('title','Closed test','event_date',(current_date+60)::text,
  'location_city','Bangkok','location_lat',13.75,'location_lng',100.49,
  'roles', jsonb_build_array(jsonb_build_object('category','DJ','budget',3000,'slots',2)))) as opp3 \gset
reset role;
select id as role3 from public.group_opportunity_roles where opportunity_id = :'opp3' \gset
set role authenticated; select public.as_user(:A1); select public.apply_to_group_opportunity(:'role3', 3000, 'x') \gset
reset role;
select request_id as r1c from public.group_opportunity_applications where opportunity_id = :'opp3' \gset
set role authenticated; select public.as_user(:K); select public.close_group_opportunity(:'opp3');
select public.ok('a closed request can no longer be accepted', public.err_of('select public.accept_group_application(''' || :'r1c' || ''')') ilike '%OPPORTUNITY_CLOSED%');
reset role;
-- reopen, expire the applicant's subscription: acceptance must still work
update public.group_opportunities set status = 'open' where id = :'opp3';
update public.freelancer_subscriptions set current_period_end = now() - interval '1 day' where user_id = :A1;
set role authenticated; select public.as_user(:K);
select public.accept_group_application(:'r1c') as ok4 \gset
reset role;
select public.ok('an expired subscription never blocks accepting an existing application', (select status::text from public.requests where id = :'r1c') = 'accepted');

-- ---------- normal (non-application) requests are unaffected ----------
insert into public.requests (client_id, freelancer_id, project_name, status) values (:K, :A3, 'plain', 'pending');
update public.requests set status = 'accepted' where project_name = 'plain';
select public.ok('ordinary requests can still be accepted the normal way', (select status::text from public.requests where project_name = 'plain') = 'accepted');

-- ---------- activation idempotency (lock path) ----------
set role service_role;
select public.activate_freelancer_subscription(:A3, 'monthly', 'chrg_hard_1', 9900);
select public.activate_freelancer_subscription(:A3, 'monthly', 'chrg_hard_1', 9900);
reset role;
select public.ok('re-activating the same charge grants no second period', (select count(*) from public.subscription_payments where omise_charge_id = 'chrg_hard_1') = 1);
select public.ok('payment_events is not readable or writable by signed-in users',
  public.err_of('set role authenticated; select * from public.payment_events') ilike '%permission denied%');
reset role;
\echo ALL CHECKS PASSED
