#!/usr/bin/env bash
# Applies supabase/freelancer_premium.sql to a THROWAWAY local Postgres (never
# your Supabase project) on top of a stub schema, then runs the access-control
# tests. Needs Postgres.app / any local `initdb`+`psql`.
set -euo pipefail
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${PGTEST_PORT:-54329}"; DB=premium_check
PSQL=(psql -h /tmp -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d $DB -f "$HERE/00_stub_schema.sql"
"${PSQL[@]}" -d $DB -f "$HERE/../../supabase/freelancer_premium.sql"
"${PSQL[@]}" -d $DB -f "$HERE/../../supabase/premium_hardening.sql"
"${PSQL[@]}" -d $DB -f "$HERE/../../supabase/travel_anywhere_location_coverage.sql"
"${PSQL[@]}" -d $DB -f "$HERE/20_tests.sql" 2>&1 | grep -E '(NOTICE:  (PASS|FAIL)|ERROR|ALL CHECKS)' | sed -E 's/^psql:[^ ]+ //; s/^NOTICE:  //'

"${PSQL[@]}" -d $DB -f "$HERE/25_accept_tests.sql" 2>&1 | grep -E '(NOTICE:  (PASS|FAIL)|ERROR|ALL CHECKS)' | sed -E 's/^psql:[^ ]+ //; s/^NOTICE:  //'
"${PSQL[@]}" -d $DB -f "$HERE/../../supabase/event_matcher_premium_fallback.sql"
"${PSQL[@]}" -d $DB -f "$HERE/../../supabase/event_matcher_fallback_after_filtering.sql"
"${PSQL[@]}" -d $DB -f "$HERE/../../supabase/event_matcher_category_alias_tolerance.sql"
"${PSQL[@]}" -d $DB -f "$HERE/45_event_matcher_any_fallback.sql" 2>&1 | grep -E '(NOTICE:  (PASS|FAIL)|ERROR|ALL CHECKS)' | sed -E 's/^psql:[^ ]+ //; s/^NOTICE:  //'
bash "$HERE/30_concurrency.sh"
