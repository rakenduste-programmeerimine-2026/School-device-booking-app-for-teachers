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

# Session A books every device and keeps its transaction open for 3 seconds.
psql_db -v ON_ERROR_STOP=1 > "$a_log" 2>&1 <<SQL &
begin;
$claims
select public.create_booking($device_id, $total, '2030-01-07 09:00+02', '2030-01-07 10:00+02');
select pg_sleep(3);
commit;
SQL
a_pid=$!

# Session B asks for one more overlapping device while A is still open. Without the row lock
# it would not see A's uncommitted booking and would succeed, exceeding the total.
sleep 1
b_started=$(date +%s)
b_output=$(psql_db 2>&1 <<SQL || true
$claims
select public.create_booking($device_id, 1, '2030-01-07 09:30+02', '2030-01-07 10:30+02');
SQL
)
b_waited=$(( $(date +%s) - b_started ))

a_status=0
wait "$a_pid" || a_status=$?
booked=$(psql_db -c "select coalesce(sum(quantity), 0) from public.bookings where device_type_id = $device_id")

failed=0
check() {
  if [ "$1" = ok ]; then echo "ok   - $2"; else echo "FAIL - $2"; failed=1; fi
}
[ "$a_status" -eq 0 ] && check ok "session A booked all $total devices" || check fail "session A booked all $total devices: $(cat "$a_log")"
grep -q insufficient_capacity <<<"$b_output" && check ok "session B was refused (waited ${b_waited}s for A)" \
  || check fail "session B was refused: $b_output"
[ "$booked" -le "$total" ] && check ok "booked $booked of $total, the total was not exceeded" \
  || check fail "booked $booked of $total, the total was exceeded"

exit "$failed"
