import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { addDays, tallinnDate, tallinnToIso } from "@/lib/tallinn-time";

type PeriodKind = Database["public"]["Enums"]["non_teaching_kind"];

// Each kind gets its own label and colour so a break, a holiday and a day off look different.
const periodStyles: Record<PeriodKind, { label: string; className: string }> = {
  break: { label: "Koolivaheaeg", className: "bg-amber-100 text-amber-900" },
  public_holiday: { label: "Riigipüha", className: "bg-red-100 text-red-900" },
  day_off: { label: "Õppetöövaba päev", className: "bg-sky-100 text-sky-900" },
};

const clock = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn",
  hour: "2-digit",
  minute: "2-digit",
});

// Dates are plain calendar days, so format them in UTC to avoid shifting the day.
const dayHeading = new Intl.DateTimeFormat("et-EE", {
  timeZone: "UTC",
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const shortDate = new Intl.DateTimeFormat("et-EE", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

// A Server Component renders once per request, so reading the clock here is stable.
const todayInTallinn = () => tallinnDate(Date.now());

function mondayOf(date: string): string {
  const weekday = asDate(date).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

// Reading searchParams makes this render per request, so bookings are never served from
// cache. Do not add "use cache" here.
async function Week({ searchParams }: Pick<PageProps<"/broneeringud">, "searchParams">) {
  const { week } = await searchParams;
  const requested = typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : "";
  const monday = mondayOf(requested || todayInTallinn());
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const sunday = days[6];

  const supabase = await createClient();
  const [{ data: bookings }, { data: periods }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, quantity, starts_at, ends_at, device_types(name), booking_series(profile_names(full_name))")
      // Half-open overlap with [Monday 00:00, next Monday 00:00) in Tallinn time.
      .lt("starts_at", tallinnToIso(addDays(monday, 7), "00:00"))
      .gt("ends_at", tallinnToIso(monday, "00:00"))
      .order("starts_at"),
    supabase
      .from("non_teaching_periods")
      .select("id, kind, name, starts_on, ends_on")
      // Period days are inclusive.
      .lte("starts_on", sunday)
      .gte("ends_on", monday),
  ]);

  return (
    <>
      <nav className="flex gap-4">
        <Link href={`?week=${addDays(monday, -7)}`} className="underline">
          Eelmine nädal
        </Link>
        <span>
          {shortDate.format(asDate(monday))} – {shortDate.format(asDate(sunday))}
        </span>
        <Link href={`?week=${addDays(monday, 7)}`} className="underline">
          Järgmine nädal
        </Link>
      </nav>

      {days.map((day) => {
        const dayPeriods = (periods ?? []).filter((p) => p.starts_on <= day && day <= p.ends_on);
        const dayBookings = (bookings ?? []).filter((b) => tallinnDate(b.starts_at) === day);
        return (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="flex flex-wrap items-center gap-2 font-semibold">
              {dayHeading.format(asDate(day))}
              {dayPeriods.map((p) => (
                <span key={p.id} className={`rounded px-2 text-sm font-normal ${periodStyles[p.kind].className}`}>
                  {periodStyles[p.kind].label}: {p.name}
                </span>
              ))}
            </h2>
            {dayBookings.length === 0 ? (
              <p className="text-gray-500">Broneeringuid pole</p>
            ) : (
              <ul>
                {dayBookings.map((b) => (
                  <li key={b.id}>
                    {clock.format(new Date(b.starts_at))}–{clock.format(new Date(b.ends_at))} ·{" "}
                    {b.device_types.name} · {b.quantity} tk ·{" "}
                    {b.booking_series.profile_names?.full_name ?? "Nimeta kasutaja"}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}

// Read-only on purpose: there are no edit or delete controls here, and clients cannot write
// bookings directly anyway (no grants, RLS).
export default function BookingsOverviewPage({ searchParams }: PageProps<"/broneeringud">) {
  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Broneeringud</h1>
      <Suspense>
        <Week searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
