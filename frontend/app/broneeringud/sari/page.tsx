import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tallinnDate } from "@/lib/tallinn-time";
import { SeriesForm } from "./series-form";

const todayInTallinn = () => tallinnDate(Date.now());

// Read per request (inside Suspense), so the lists are never cached.
async function Form() {
  // "Today" must be the request's date, not the build's.
  await connection();
  const supabase = await createClient();
  const today = todayInTallinn();
  const [{ data: devices }, { data: lessons }, { data: schoolYear }] = await Promise.all([
    supabase.from("device_types").select("id, name, total_quantity").is("archived_at", null).order("name"),
    supabase.from("lesson_periods").select("id, lesson_number, starts_time, ends_time").order("lesson_number"),
    // The current school year, or the next one once the current one has ended.
    supabase
      .from("school_years")
      .select("id, starts_on, ends_on")
      .gte("ends_on", today)
      .order("starts_on")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!schoolYear) return <p>Õppeaasta pole veel seadistatud.</p>;

  const { data: periods } = await supabase
    .from("non_teaching_periods")
    .select("id, name, starts_on, ends_on")
    .eq("school_year_id", schoolYear.id)
    .order("starts_on");

  return (
    <SeriesForm
      devices={devices ?? []}
      lessons={lessons ?? []}
      schoolYear={schoolYear}
      periods={periods ?? []}
      today={today}
    />
  );
}

export default function SeriesPage() {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Korduv broneering</h1>
      <Suspense>
        <Form />
      </Suspense>
    </main>
  );
}
