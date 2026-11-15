#!/usr/bin/env bash
# MVP criterion: two simultaneous requests can never exceed total_quantity.
# pgTAP runs in a single connection, so this uses two real psql sessions against the local
# database container. Run from the repo root after `supabase start` or `supabase db start`.
set -euo pipefail
export MSYS_NO_PATHCONV=1 # stops Git Bash on Windows rewriting paths passed to docker

project_id=$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)
container="supabase_db_${project_id}"
psql_db() { docker exec -i "$container" psql -U postgres -qAt "$@"; }

user_id='00000000-0000-0000-0000-0000000009b1'
email='concurrency-test@example.com'
device_id=9401
total=5
claims="set request.jwt.claims = '{\"sub\":\"$user_id\",\"role\":\"authenticated\"}';"
a_log=$(mktemp)

# These rows are committed (two sessions cannot share a rolled-back transaction), so remove
# them before and after the run.
cleanup() {
  psql_db -v ON_ERROR_STOP=1 <<SQL
delete from public.booking_series where owner_id = '$user_id';
delete from public.booking_changes where coalesce(new_data, old_data) ->> 'device_type_id' = '$device_id';
delete from public.device_types where id = $device_id;
delete from public.allowed_emails where email = '$email';
delete from auth.users where id = '$user_id';
SQL
  rm -f "$a_log"
}
trap cleanup EXIT
cleanup

psql_db -v ON_ERROR_STOP=1 <<SQL
insert into public.allowed_emails (email) values ('$email');
insert into auth.users (id, email) values ('$user_id', '$email');
insert into public.device_types (id, name, total_quantity) overriding system value
  values ($device_id, 'Concurrency test device', $total);
SQL

failed=0
check() {
  if [ "$1" = ok ]; then echo "ok   - $2"; else echo "FAIL - $2"; failed=1; fi
}

# One round: session A books every device on $1 and keeps its transaction open for 3 seconds,
# then session B runs $3 for an overlapping time. $2 names B's request in the output.
run_round() {
  local day=$1 b_label=$2 b_sql=$3
  psql_db -v ON_ERROR_STOP=1 > "$a_log" 2>&1 <<SQL &
begin;
$claims
select public.create_booking($device_id, $total, '$day 09:00+02', '$day 10:00+02');
select pg_sleep(3);
commit;
SQL
  local a_pid=$!

  # Wait until A is inside pg_sleep, so it has booked and holds the lock. A fixed sleep could
  # let B win the lock first on a slow runner, which would fail the test for the wrong reason.
  local a_holds_lock=0
  for _ in $(seq 1 50); do
    a_holds_lock=$(psql_db -c "select count(*) from pg_stat_activity
      where pid <> pg_backend_pid() and state = 'active' and query like 'select pg_sleep(3)%'")
    [ "$a_holds_lock" = 1 ] && break
    sleep 0.2
  done
  if [ "$a_holds_lock" != 1 ]; then
    echo "FAIL - session A did not take the lock within 10s: $(cat "$a_log")"
    exit 1
  fi

  # B asks while A is still open. Without the row lock it would not see A's uncommitted
  # booking and would succeed, exceeding the total.
  local b_started b_output b_waited a_status=0 booked
  b_started=$(date +%s)
  b_output=$(psql_db 2>&1 <<SQL || true
$claims
$b_sql
SQL
)
  b_waited=$(( $(date +%s) - b_started ))
  wait "$a_pid" || a_status=$?
  booked=$(psql_db -c "select coalesce(sum(quantity), 0) from public.bookings
    where device_type_id = $device_id and starts_at < '$day 10:00+02' and ends_at > '$day 09:00+02'")

  [ "$a_status" -eq 0 ] && check ok "$day: session A booked all $total devices" \
    || check fail "$day: session A booked all $total devices: $(cat "$a_log")"
  grep -q insufficient_capacity <<<"$b_output" && check ok "$day: $b_label was refused (waited ${b_waited}s for A)" \
    || check fail "$day: $b_label was refused: $b_output"
  [ "$booked" -le "$total" ] && check ok "$day: booked $booked of $total, the total was not exceeded" \
    || check fail "$day: booked $booked of $total, the total was exceeded"
}

run_round 2030-01-07 "a single booking" \
  "select public.create_booking($device_id, 1, '2030-01-07 09:30+02', '2030-01-07 10:30+02');"

# The series has a free date first, so a partial write would show up on 2030-01-21.
run_round 2030-01-14 "a series commit" \
  "select public.commit_series($device_id, '[
     {\"starts_at\": \"2030-01-21T09:00:00+02:00\", \"ends_at\": \"2030-01-21T10:00:00+02:00\", \"quantity\": 1},
     {\"starts_at\": \"2030-01-14T09:30:00+02:00\", \"ends_at\": \"2030-01-14T10:30:00+02:00\", \"quantity\": 1}
   ]'::jsonb);"
partial=$(psql_db -c "select count(*) from public.bookings
  where device_type_id = $device_id and starts_at = '2030-01-21 09:00+02'")
[ "$partial" = 0 ] && check ok "the refused series wrote none of its dates" \
  || check fail "the refused series wrote $partial booking(s) on its free date"

exit "$failed"
