import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RefreshOnBookingChange } from "../../refresh-on-booking-change";
import { SeriesBookings, type Series } from "./series-bookings";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// PostgREST returns at most max_rows (1000) rows per request, and an admin sees every
// teacher's full-year series, so bookings are read page by page instead of silently cut off.
const PAGE_SIZE = 1000;

function bookingsPage(supabase: Supabase, from: number, ownerId: string | null) {
  const query = supabase
    .from("bookings")
    .select(
      "id, series_id, quantity, starts_at, ends_at, device_types(name, total_quantity), booking_series!inner(owner_id, profile_names(full_name))",
    )
    .order("starts_at")
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
  // Every signed-in user may read all bookings, so a teacher's list is narrowed to their own.
  return ownerId ? query.eq("booking_series.owner_id", ownerId) : query;
}

type BookingRow = NonNullable<Awaited<ReturnType<typeof bookingsPage>>["data"]>[number];

async function loadBookings(supabase: Supabase, ownerId: string | null) {
  const rows: BookingRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await bookingsPage(supabase, from, ownerId);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// Rows arrive ordered by start, so each series lists its dates in order.
// Call only after connection(), so "now" is the request's time, not the build's.
function groupBySeries(rows: BookingRow[]): Series[] {
  const now = Date.now();
  const groups = new Map<number, Series>();
  for (const row of rows) {
    let series = groups.get(row.series_id);
    if (!series) {
      series = {
        id: row.series_id,
        deviceName: row.device_types.name,
        totalQuantity: row.device_types.total_quantity,
        ownerName: row.booking_series.profile_names?.full_name ?? "Nimeta kasutaja",
        bookings: [],
      };
      groups.set(row.series_id, series);
    }
    series.bookings.push({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      quantity: row.quantity,
      // Same rule as the DB: a booking that has started is past.
      isPast: Date.parse(row.starts_at) <= now,
    });
  }
  return [...groups.values()];
}

// Reading cookies makes this render per request, so bookings are never served from cache.
// Do not add "use cache" here.
async function MyBookings() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  // "Now" must be the request's time, not the build's.
  await connection();

  const [rows, { data: lessons }] = await Promise.all([
    loadBookings(supabase, isAdmin ? null : claims!.claims.sub),
    supabase.from("lesson_periods").select("id, lesson_number, starts_time, ends_time").order("lesson_number"),
  ]);
  const seriesList = groupBySeries(rows);

  return (
    <>
      {isAdmin && <p>Admin: näed ja saad muuta kõigi õpetajate broneeringuid.</p>}
      {seriesList.length === 0 ? (
        <p>
          Broneeringuid pole.{" "}
          <Link href="/" className="underline">
            Broneeri seade
          </Link>
        </p>
      ) : (
        seriesList.map((series) => (
          <SeriesBookings key={series.id} series={series} lessons={lessons ?? []} isAdmin={isAdmin === true} />
        ))
      )}
      <RefreshOnBookingChange />
    </>
  );
}

export default function MyBookingsPage() {
  return (
    <main className="flex flex-col gap-4 p-8">
      <Link href="/" className="underline">
        Avalehele
      </Link>
      <h1 className="text-2xl font-semibold">Minu broneeringud</h1>
      <Suspense>
        <MyBookings />
      </Suspense>
    </main>
  );
}
