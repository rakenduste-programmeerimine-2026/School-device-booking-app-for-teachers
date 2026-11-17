import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addAllowedEmail,
  addDevice,
  addLessonPeriod,
  addNonTeachingPeriod,
  addSchoolYear,
  deleteLessonPeriod,
  deleteNonTeachingPeriod,
  removeAllowedEmail,
  setDeviceArchived,
  updateDevice,
  updateLessonPeriod,
  updateNonTeachingPeriod,
  updateSchoolYear,
} from "./actions";

const input = "rounded border px-2 py-1";
const button = "rounded border px-3 py-1";

const periodKinds = [
  ["break", "Koolivaheaeg"],
  ["public_holiday", "Riigipüha"],
  ["day_off", "Õppetöövaba päev"],
] as const;

// Postgres returns "08:15:00"; with seconds the time input would show a seconds field.
const hoursAndMinutes = (time: string) => time.slice(0, 5);

function PeriodFields({ period }: { period?: { kind: string; name: string; starts_on: string; ends_on: string } }) {
  return (
    <>
      <select name="kind" defaultValue={period?.kind ?? "break"} aria-label="Liik" className={input}>
        {periodKinds.map(([kind, label]) => (
          <option key={kind} value={kind}>
            {label}
          </option>
        ))}
      </select>
      <input name="name" defaultValue={period?.name} placeholder="Nimi" aria-label="Nimi" required className={input} />
      <input
        name="starts_on"
        type="date"
        defaultValue={period?.starts_on}
        aria-label="Algus"
        required
        className={input}
      />
      <input name="ends_on" type="date" defaultValue={period?.ends_on} aria-label="Lõpp" required className={input} />
    </>
  );
}

function LessonFields({ lesson }: { lesson?: { lesson_number: number; starts_time: string; ends_time: string } }) {
  return (
    <>
      <input
        name="lesson_number"
        type="number"
        min={1}
        defaultValue={lesson?.lesson_number}
        aria-label="Tunni number"
        required
        className={`${input} w-16`}
      />
      <input
        name="starts_time"
        type="time"
        defaultValue={lesson && hoursAndMinutes(lesson.starts_time)}
        aria-label="Algus"
        required
        className={input}
      />
      <input
        name="ends_time"
        type="time"
        defaultValue={lesson && hoursAndMinutes(lesson.ends_time)}
        aria-label="Lõpp"
        required
        className={input}
      />
    </>
  );
}

// Reading cookies and searchParams makes this render per request, so it is never cached.
async function Admin({ searchParams }: Pick<PageProps<"/haldus">, "searchParams">) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect("/login");
  // Same check as the admin actions, so the page and the actions follow the allow-list together.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/");

  const [{ data: devices }, { data: emails }, { data: schoolYears }, { data: lessons }] = await Promise.all([
    supabase.from("device_types").select("id, name, total_quantity, archived_at").order("name"),
    supabase.from("allowed_emails").select("email, role").order("email"),
    supabase
      .from("school_years")
      .select("id, starts_on, ends_on, non_teaching_periods (id, kind, name, starts_on, ends_on)")
      .order("starts_on")
      .order("starts_on", { referencedTable: "non_teaching_periods" }),
    supabase.from("lesson_periods").select("id, lesson_number, starts_time, ends_time").order("lesson_number"),
  ]);

  return (
    <>
      {/* Sticky because the forms are far down the page and the error would scroll out of view. */}
      {typeof error === "string" && (
        <p role="alert" className="sticky top-0 z-10 border border-red-600 bg-background p-2 text-red-600">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Seadmed</h2>
        {devices?.map((device) => (
          <div key={device.id} className="flex flex-wrap items-center gap-2">
            <form action={updateDevice} className="flex gap-2">
              <input type="hidden" name="id" value={device.id} />
              <input name="name" defaultValue={device.name} aria-label="Nimi" required className={input} />
              <input
                name="quantity"
                type="number"
                min={1}
                defaultValue={device.total_quantity}
                aria-label="Kogus"
                required
                className={`${input} w-20`}
              />
              <button className={button}>Salvesta</button>
            </form>
            <form action={setDeviceArchived}>
              <input type="hidden" name="id" value={device.id} />
              <input type="hidden" name="archive" value={device.archived_at ? "0" : "1"} />
              <button className={button}>{device.archived_at ? "Taasta" : "Arhiveeri"}</button>
            </form>
            {device.archived_at && <span className="text-sm text-gray-500">arhiveeritud</span>}
          </div>
        ))}
        <form action={addDevice} className="flex gap-2">
          <input name="name" placeholder="Uus seade" aria-label="Uue seadme nimi" required className={input} />
          <input
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            aria-label="Uue seadme kogus"
            required
            className={`${input} w-20`}
          />
          <button className={button}>Lisa seade</button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Lubatud e-postid</h2>
        {emails?.map((entry) => (
          <form key={entry.email} action={removeAllowedEmail} className="flex items-center gap-2">
            <input type="hidden" name="email" value={entry.email} />
            <span>
              {entry.email} ({entry.role === "admin" ? "admin" : "õpetaja"})
            </span>
            <button className={button}>Eemalda</button>
          </form>
        ))}
        <form action={addAllowedEmail} className="flex gap-2">
          <input name="email" type="email" placeholder="e-post" aria-label="E-post" required className={input} />
          <select name="role" aria-label="Roll" className={input}>
            <option value="teacher">õpetaja</option>
            <option value="admin">admin</option>
          </select>
          <button className={button}>Lisa e-post</button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Õppeaasta ja õppetöövabad ajad</h2>
        {schoolYears?.map((year) => (
          <div key={year.id} className="flex flex-col gap-2 border-l-2 pl-3">
            <form action={updateSchoolYear} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={year.id} />
              <span>Õppeaasta</span>
              <input
                name="starts_on"
                type="date"
                defaultValue={year.starts_on}
                aria-label="Õppeaasta algus"
                required
                className={input}
              />
              <input
                name="ends_on"
                type="date"
                defaultValue={year.ends_on}
                aria-label="Õppeaasta lõpp"
                required
                className={input}
              />
              <button className={button}>Salvesta</button>
            </form>
            {year.non_teaching_periods.map((period) => (
              <div key={period.id} className="flex flex-wrap items-center gap-2">
                <form action={updateNonTeachingPeriod} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={period.id} />
                  <input type="hidden" name="school_year_id" value={year.id} />
                  <PeriodFields period={period} />
                  <button className={button}>Salvesta</button>
                </form>
                <form action={deleteNonTeachingPeriod}>
                  <input type="hidden" name="id" value={period.id} />
                  <button className={button}>Kustuta</button>
                </form>
              </div>
            ))}
            <form action={addNonTeachingPeriod} className="flex flex-wrap gap-2">
              <input type="hidden" name="school_year_id" value={year.id} />
              <PeriodFields />
              <button className={button}>Lisa periood</button>
            </form>
          </div>
        ))}
        <form action={addSchoolYear} className="flex flex-wrap items-center gap-2">
          <span>Uus õppeaasta</span>
          <input name="starts_on" type="date" aria-label="Uue õppeaasta algus" required className={input} />
          <input name="ends_on" type="date" aria-label="Uue õppeaasta lõpp" required className={input} />
          <button className={button}>Lisa õppeaasta</button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Koolitunnid</h2>
        {lessons?.map((lesson) => (
          <div key={lesson.id} className="flex flex-wrap items-center gap-2">
            <form action={updateLessonPeriod} className="flex gap-2">
              <input type="hidden" name="id" value={lesson.id} />
              <LessonFields lesson={lesson} />
              <button className={button}>Salvesta</button>
            </form>
            <form action={deleteLessonPeriod}>
              <input type="hidden" name="id" value={lesson.id} />
              <button className={button}>Kustuta</button>
            </form>
          </div>
        ))}
        <form action={addLessonPeriod} className="flex gap-2">
          <LessonFields />
          <button className={button}>Lisa tund</button>
        </form>
      </section>
    </>
  );
}

export default function AdminPage({ searchParams }: PageProps<"/haldus">) {
  return (
    <main className="flex flex-col gap-6 p-8">
      <Link href="/" className="underline">
        Avalehele
      </Link>
      <h1 className="text-2xl font-semibold">Haldus</h1>
      <Link href="/haldus/ajalugu" className="underline">
        Broneeringute muudatuste ajalugu
      </Link>
      <Suspense>
        <Admin searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
