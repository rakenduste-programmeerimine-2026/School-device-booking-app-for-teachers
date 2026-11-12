import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { BookingForm } from "./booking-form";

// Read per request (inside Suspense), so the lists are never cached.
async function Form() {
  const supabase = await createClient();
  const [{ data: devices }, { data: lessons }] = await Promise.all([
    supabase.from("device_types").select("id, name, total_quantity").is("archived_at", null).order("name"),
    supabase.from("lesson_periods").select("id, lesson_number, starts_time, ends_time").order("lesson_number"),
  ]);
  return <BookingForm devices={devices ?? []} lessons={lessons ?? []} />;
}

export default function NewBookingPage() {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Uus broneering</h1>
      <Suspense>
        <Form />
      </Suspense>
    </main>
  );
}
