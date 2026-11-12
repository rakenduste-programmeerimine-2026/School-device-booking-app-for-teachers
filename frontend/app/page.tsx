import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DevicePicker } from "./device-picker";

async function CurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", data!.claims.sub)
    .single();
  return (
    <p>
      {profile?.email} ({profile?.role === "admin" ? "admin" : "õpetaja"})
    </p>
  );
}

const firstValue = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

// Reading searchParams makes this render per request, so availability is never served
// from cache. Do not add "use cache" here.
async function Picker({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(firstValue(params.date)) ? firstValue(params.date) : "";
  const start = /^\d{2}:\d{2}$/.test(firstValue(params.start)) ? firstValue(params.start) : "";
  const end = /^\d{2}:\d{2}$/.test(firstValue(params.end)) ? firstValue(params.end) : "";

  const supabase = await createClient();
  const { data: lessons } = await supabase
    .from("lesson_periods")
    .select("lesson_number, starts_time, ends_time")
    .order("lesson_number");

  const { data: devices } =
    date && start && end && start < end
      ? await supabase.rpc("device_availability", { p_date: date, p_starts: start, p_ends: end })
      : { data: [] };

  return (
    <DevicePicker
      date={date}
      start={start}
      end={end}
      lessons={lessons ?? []}
      devices={devices ?? []}
    />
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="flex flex-col gap-6 p-8">
      <Suspense>
        <CurrentUser />
      </Suspense>
      <Link href="/broneeringud" className="underline">
        Vaata broneeringuid
      </Link>
      <h1 className="text-2xl font-semibold">Broneeri seade</h1>
      <Suspense>
        <Picker searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
