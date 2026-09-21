#!/usr/bin/env bash
# True concurrency tests: separate database sessions racing on the same role /
# request / charge. Session A holds its transaction open (pg_sleep) AFTER
# accepting, so B/C are guaranteed to contend for the same role lock rather
# than run back-to-back by luck.
set -uo pipefail
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
PORT="${PGTEST_PORT:-54329}"; DB=premium_check
Q() { psql -h /tmp -p "$PORT" -U postgres -d $DB -v ON_ERROR_STOP=0 -Atq "$@" 2>&1; }
pass=0; fail=0
ok() { if [ "$2" = "true" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1  ($3)"; fail=$((fail+1)); fi; }

K=00000000-0000-0000-0000-0000000000b0
B1=00000000-0000-0000-0000-0000000000b1; B2=00000000-0000-0000-0000-0000000000b2; B3=00000000-0000-0000-0000-0000000000b3
Q -c "insert into public.users (id, full_name, role, account_status) values ('$K','Client Q','client','active'),('$B1','B1','freelancer','active'),('$B2','B2','freelancer','active'),('$B3','B3','freelancer','active');
insert into public.freelancer_profiles (user_id, title, locations) select u, 'Violinist', '[{\"city\":\"Bangkok\",\"latitude\":13.75,\"longitude\":100.49}]'::jsonb from (values ('$B1'::uuid),('$B2'),('$B3')) v(u);
insert into public.freelancer_subscriptions (user_id, plan, current_period_end) select u,'monthly',now()+interval '10 days' from (values ('$B1'::uuid),('$B2'),('$B3')) v(u);" >/dev/null

as() { echo "set role authenticated; select set_config('request.jwt.claim.sub','$1',false);"; }
OPP=$(Q -c "$(as $K) select public.create_group_opportunity(jsonb_build_object('title','Race','event_date',(current_date+70)::text,'start_time','10:00','end_time','12:00','location_city','Bangkok','location_lat',13.75,'location_lng',100.49,'roles',jsonb_build_array(jsonb_build_object('category','Violinist','budget',2000,'slots',1))));" | tail -1)
ROLE=$(Q -c "select id from public.group_opportunity_roles where opportunity_id='$OPP'")
for f in $B1 $B2 $B3; do Q -c "$(as $f) select public.apply_to_group_opportunity('$ROLE', 2000, 'x');" >/dev/null; done
R1=$(Q -c "select request_id from public.group_opportunity_applications where freelancer_id='$B1' and opportunity_id='$OPP'")
R2=$(Q -c "select request_id from public.group_opportunity_applications where freelancer_id='$B2' and opportunity_id='$OPP'")
R3=$(Q -c "select request_id from public.group_opportunity_applications where freelancer_id='$B3' and opportunity_id='$OPP'")

# --- 1. the FINAL slot: three accepts race; A holds the lock for 2s ---
OA=$(mktemp); OB=$(mktemp); OC=$(mktemp)
( Q -c "begin; $(as $K) select public.accept_group_application('$R1'); select pg_sleep(2); commit;" > $OA ) &
sleep 0.6
( Q -c "$(as $K) select public.accept_group_application('$R2');" > $OB ) &
( Q -c "$(as $K) select public.accept_group_application('$R3');" > $OC ) &
wait
okcount=$(cat $OA $OB $OC | grep -c '"booking_id"')
ok "exactly one of three concurrent acceptances for the final slot succeeded" $([ "$okcount" = "1" ] && echo true || echo false) "$okcount succeeded"
ok "the contenders were refused with ROLE_FILLED (they waited for the lock, then saw it filled)" $([ "$(cat $OB $OC | grep -c ROLE_FILLED)" = "2" ] && echo true || echo false) "$(cat $OB $OC)"
ok "exactly one booking exists for the role" $([ "$(Q -c "select count(*) from public.bookings where client_id='$K'")" = "1" ] && echo true || echo false) "$(Q -c "select count(*) from public.bookings where client_id='$K'")"
ok "exactly one request is accepted and the other two stay open" $([ "$(Q -c "select count(*) filter (where status='accepted') || '/' || count(*) filter (where status='countered') from public.requests where id in ('$R1','$R2','$R3')")" = "1/2" ] && echo true || echo false) ""
ok "exactly one application is linked to a booking" $([ "$(Q -c "select count(*) from public.group_opportunity_applications where opportunity_id='$OPP' and booking_id is not null")" = "1" ] && echo true || echo false) ""

# --- 2. duplicate acceptance of the SAME request racing itself ---
OPP2=$(Q -c "$(as $K) select public.create_group_opportunity(jsonb_build_object('title','Dup','event_date',(current_date+71)::text,'start_time','10:00','end_time','12:00','location_city','Bangkok','location_lat',13.75,'location_lng',100.49,'roles',jsonb_build_array(jsonb_build_object('category','Violinist','budget',2000,'slots',3))));" | tail -1)
ROLE2=$(Q -c "select id from public.group_opportunity_roles where opportunity_id='$OPP2'")
Q -c "$(as $B2) select public.apply_to_group_opportunity('$ROLE2', 2000, 'x');" >/dev/null
RD=$(Q -c "select request_id from public.group_opportunity_applications where opportunity_id='$OPP2'")
OD1=$(mktemp); OD2=$(mktemp)
( Q -c "$(as $K) select public.accept_group_application('$RD');" > $OD1 ) &
( Q -c "$(as $K) select public.accept_group_application('$RD');" > $OD2 ) &
wait
ok "two simultaneous acceptances of the same application: exactly one succeeds" $([ "$(cat $OD1 $OD2 | grep -c '"booking_id"')" = "1" ] && echo true || echo false) "$(cat $OD1 $OD2)"
ok "the other is told ALREADY_ACCEPTED" $([ "$(cat $OD1 $OD2 | grep -c ALREADY_ACCEPTED)" = "1" ] && echo true || echo false) "$(cat $OD1 $OD2)"
ok "and only one booking exists for that freelancer/event" $([ "$(Q -c "select count(*) from public.bookings where client_id='$K' and freelancer_id='$B2' and start_date=current_date+71")" = "1" ] && echo true || echo false) ""

# --- 3. the same Omise charge confirmed by the webhook and by checkout at once ---
S1=$(mktemp); S2=$(mktemp)
( Q -c "set role service_role; select public.activate_freelancer_subscription('$B3','monthly','chrg_race_1',9900);" > $S1 ) &
( Q -c "set role service_role; select public.activate_freelancer_subscription('$B3','monthly','chrg_race_1',9900);" > $S2 ) &
wait
ok "the same charge activated concurrently records one payment (no unique-violation error either)" $([ "$(Q -c "select count(*) from public.subscription_payments where omise_charge_id='chrg_race_1'")" = "1" ] && ! grep -qi "ERROR" $S1 $S2 && echo true || echo false) "$(cat $S1 $S2)"
BASE=$(Q -c "select extract(epoch from current_period_end)::bigint from public.freelancer_subscriptions where user_id='$B3'")
ok "and it granted exactly one month, not two" $([ "$(Q -c "select (current_period_end < now() + interval '41 days') from public.freelancer_subscriptions where user_id='$B3'")" = "t" ] && echo true || echo false) ""

# --- 4. two DIFFERENT charges for one user at once still stack, never overlap ---
T1=$(mktemp); T2=$(mktemp)
( Q -c "set role service_role; select public.activate_freelancer_subscription('$B1','monthly','chrg_stack_1',9900);" > $T1 ) &
( Q -c "set role service_role; select public.activate_freelancer_subscription('$B1','monthly','chrg_stack_2',9900);" > $T2 ) &
wait
ok "two different charges for one user at the same time extend by two full months" $([ "$(Q -c "select (current_period_end > now() + interval '10 days' + interval '55 days') from public.freelancer_subscriptions where user_id='$B1'")" = "t" ] && echo true || echo false) "$(cat $T1 $T2)"

rm -f $OA $OB $OC $OD1 $OD2 $S1 $S2 $T1 $T2
echo "concurrency: $pass passed, $fail failed"
[ "$fail" = "0" ] && echo "ALL CONCURRENCY CHECKS PASSED" || exit 1
