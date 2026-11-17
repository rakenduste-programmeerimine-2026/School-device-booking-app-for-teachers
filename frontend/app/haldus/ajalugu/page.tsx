import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/database.types";

type Action = Database["public"]["Enums"]["booking_change_action"];
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

const PAGE_SIZE = 100;

const actionLabels: Record<Action, string> = {
  created: "Lisatud",
  updated: "Muudetud",
  deleted: "Kustutatud",
};

const dateTime = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const date = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const clock = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn",
  hour: "2-digit",
  minute: "2-digit",
});

// old_data and new_data are to_jsonb(bookings row), written by the trigger on bookings.
function describe(data: Json | null, deviceNames: Map<number, string>): string {
  if (data === null) return "";
  const booking = data as unknown as BookingRow;
  const starts = new Date(booking.starts_at);
  return [
    deviceNames.get(booking.device_type_id) ?? "Tundmatu seade",
    `${date.format(starts)} ${clock.format(starts)}–${clock.format(new Date(booking.ends_at))}`,
    `${booking.quantity} tk`,
  ].join(" · ");
}

// Reading cookies and searchParams makes this render per request, so it is never cached.
async function History({ searchParams }: Pick<PageProps<"/haldus/ajalugu">, "searchParams">) {
  const { before } = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect("/login");
  // Same check as the admin actions, so the page and the actions follow the allow-list together.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/");

  // Ordered by id, not changed_at: id follows the order rows were written, and a single id
  // is enough for the "older" link. Rows of one bulk edit share changed_at anyway.
  let query = supabase
    .from("booking_changes")
    .select("id, booking_id, series_id, action, changed_at, old_data, new_data, profiles(full_name, email)")
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);
  if (typeof before === "string" && /^\d+$/.test(before)) query = query.lt("id", Number(before));

  // Archived devices are included so history of their old bookings still shows the name.
  const [{ data: changes }, { data: devices }] = await Promise.all([
    query,
    supabase.from("device_types").select("id, name"),
  ]);
  const deviceNames = new Map((devices ?? []).map((d) => [d.id, d.name]));

  if (!changes?.length) return <p className="text-gray-500">Muudatusi pole</p>;

  return (
    <>
      <table className="text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2">Aeg</th>
            <th className="p-2">Tegija</th>
            <th className="p-2">Toiming</th>
            <th className="p-2">Broneering</th>
            <th className="p-2">Enne</th>
            <th className="p-2">Pärast</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.id} className="border-b align-top">
              <td className="p-2 whitespace-nowrap">{dateTime.format(new Date(change.changed_at))}</td>
              <td className="p-2">
                {change.profiles
                  ? `${change.profiles.full_name ?? ""} (${change.profiles.email})`
                  : "Tundmatu"}
              </td>
              <td className="p-2">{actionLabels[change.action]}</td>
              <td className="p-2 whitespace-nowrap">
                #{change.booking_id} (sari #{change.series_id})
              </td>
              <td className="p-2">{describe(change.old_data, deviceNames)}</td>
              <td className="p-2">{describe(change.new_data, deviceNames)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {changes.length === PAGE_SIZE && (
        <Link href={`?before=${changes[changes.length - 1].id}`} className="underline">
          Vanemad muudatused
        </Link>
      )}
    </>
  );
}

export default function HistoryPage({ searchParams }: PageProps<"/haldus/ajalugu">) {
  return (
    <main className="flex flex-col gap-6 p-8">
      <Link href="/haldus" className="underline">
        Haldusesse
      </Link>
      <h1 className="text-2xl font-semibold">Broneeringute muudatuste ajalugu</h1>
      <Suspense>
        <History searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
