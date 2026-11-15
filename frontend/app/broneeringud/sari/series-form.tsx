"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { generateSeriesDates } from "@/lib/series-dates";
import { addDays, tallinnDate, tallinnToIso } from "@/lib/tallinn-time";
import { commitSeries, previewSeries, type PreviewRow, type SeriesInput } from "../actions";

type Device = { id: number; name: string; total_quantity: number };
type Lesson = { id: number; lesson_number: number; starts_time: string; ends_time: string };
type Period = { id: number; name: string; starts_on: string; ends_on: string };
type TimeRow = { key: number; weekday: number; lessonId: string; start: string; end: string };

type Props = {
  devices: Device[];
  lessons: Lesson[];
  schoolYear: { starts_on: string; ends_on: string };
  periods: Period[];
  today: string;
};

const weekdays = ["esmaspäev", "teisipäev", "kolmapäev", "neljapäev", "reede"];
// Postgres returns "08:15:00"; time inputs use "08:15".
const hhmm = (time: string) => time.slice(0, 5);
// "2026-10-26" → "26.10"
const dayMonth = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;
const tallinnDay = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const tallinnTime = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn",
  hour: "2-digit",
  minute: "2-digit",
});
// "08:15" in Tallinn time, the format time inputs and lesson times use.
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Tallinn",
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

// Every calendar day of a period, so a kept period keeps all its dates.
function periodDates(p: Period): string[] {
  const dates: string[] = [];
  for (let d = p.starts_on; d <= p.ends_on; d = addDays(d, 1)) dates.push(d);
  return dates;
}

export function SeriesForm({ devices, lessons, schoolYear, periods, today }: Props) {
  const [deviceId, setDeviceId] = useState(devices[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [rows, setRows] = useState<TimeRow[]>([{ key: 0, weekday: 1, lessonId: "", start: "", end: "" }]);
  const [nextKey, setNextKey] = useState(1);
  // Past dates cannot be used, so the default is the rest of the school year.
  const [from, setFrom] = useState(today > schoolYear.starts_on ? today : schoolYear.starts_on);
  const [to, setTo] = useState(schoolYear.ends_on);
  const [keptPeriods, setKeptPeriods] = useState<number[]>([]);
  const [preview, setPreview] = useState<{ dates: SeriesInput[]; rows: PreviewRow[] } | null>(null);
  const [error, setError] = useState("");
  const [seriesSize, setSeriesSize] = useState(0);
  const [pending, startTransition] = useTransition();
  // Edits re-check at once, so a slower older answer must not overwrite a newer one.
  const lastRequest = useRef(0);

  const device = devices.find((d) => d.id === deviceId);
  const single = device?.total_quantity === 1;
  const input = "rounded border px-2 py-1";

  // Any change makes the old preview stale; commit must only ever send previewed dates.
  function changed() {
    setPreview(null);
    setError("");
    setSeriesSize(0);
  }

  function updateRow(key: number, next: Partial<TimeRow>) {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...next } : r)));
    changed();
  }

  function buildDates(): SeriesInput[] | string {
    if (!device) return "Vali seade.";
    if (rows.length === 0) return "Lisa vähemalt üks päev.";
    if (rows.some((r) => !r.start || !r.end)) return "Vali igale päevale koolitund või kellaajad.";
    if (rows.some((r) => r.start >= r.end)) return "Lõppaeg peab olema algusajast hilisem.";
    if (!from || !to || from > to) return "Perioodi lõpp peab olema algusest hilisem.";

    const keepDates = periods.filter((p) => keptPeriods.includes(p.id)).flatMap(periodDates);
    return rows
      .flatMap((r) =>
        generateSeriesDates({
          schoolYear: { starts_on: from, ends_on: to },
          nonTeachingPeriods: periods,
          weekdays: [r.weekday],
          startTime: r.start,
          endTime: r.end,
          keepDates,
        }),
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((d) => ({ starts_at: d.startsAt, ends_at: d.endsAt, quantity: single ? 1 : quantity }));
  }

  function showPreview() {
    // A new preview starts a new series, so the last result no longer applies.
    setError("");
    setSeriesSize(0);
    const dates = buildDates();
    if (typeof dates === "string") return setError(dates);
    if (dates.length === 0) return setError("Valitud päevadel pole perioodis ühtegi kuupäeva.");
    runPreview(dates);
  }

  // Dates and rows are only ever set together, so commit always sends a previewed list.
  // On error the previous preview stays as it was.
  function runPreview(dates: SeriesInput[]) {
    const request = ++lastRequest.current;
    startTransition(async () => {
      const result = await previewSeries(device!.id, dates);
      if (request !== lastRequest.current) return;
      if (result.error) setError(result.error);
      else {
        setError("");
        setPreview({ dates, rows: result.rows ?? [] });
      }
    });
  }

  // Resolves one conflict: change the date's quantity or time, or skip it (null), then re-check.
  function editDate(index: number, next: Partial<SeriesInput> | null) {
    if (!preview) return;
    const dates = next
      ? preview.dates.map((d, i) => (i === index ? { ...d, ...next } : d))
      : preview.dates.filter((_, i) => i !== index);
    if (dates.length === 0) {
      setPreview(null);
      return setError("Kõik kuupäevad on vahele jäetud.");
    }
    runPreview(dates);
  }

  // A new time keeps the row's own Tallinn date.
  function editTime(index: number, startsAt: string, start: string, end: string) {
    const date = tallinnDate(startsAt);
    editDate(index, { starts_at: tallinnToIso(date, start), ends_at: tallinnToIso(date, end) });
  }

  // Start and end are read together, so changing both fields sends one range rather than a
  // mix of the new start and the old end. An unfinished range waits for the other field.
  function applyFreeTime(field: HTMLInputElement, index: number, startsAt: string) {
    const [start, end] = [...field.parentElement!.querySelectorAll<HTMLInputElement>("input[type=time]")].map(
      (f) => f.value,
    );
    if (start && end && start < end) editTime(index, startsAt, start, end);
  }

  function commit() {
    if (!preview) return;
    startTransition(async () => {
      const result = await commitSeries(device!.id, preview.dates);
      if (result.seriesId) {
        setSeriesSize(preview.dates.length);
        setPreview(null);
      } else if (result.conflicts) {
        // Someone booked in between: mark the dates that no longer fit.
        const free = new Map(result.conflicts.map((c) => [c.date_position, c.free_quantity]));
        setPreview({
          ...preview,
          rows: preview.rows.map((r) =>
            free.has(r.date_position) ? { ...r, free_quantity: free.get(r.date_position)!, has_conflict: true } : r,
          ),
        });
        setError("Vahepeal on keegi broneerinud. Mõnel kuupäeval pole enam piisavalt vabu seadmeid.");
      } else {
        setError(result.error ?? "Sarja salvestamine ebaõnnestus.");
      }
    });
  }

  const conflictCount = preview?.rows.filter((r) => r.has_conflict).length ?? 0;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <label className="flex max-w-sm flex-col gap-1">
        Seade
        <select
          className={input}
          value={deviceId}
          onChange={(e) => {
            setDeviceId(Number(e.target.value));
            changed();
          }}
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>
      {!single && (
        <label className="flex max-w-sm flex-col gap-1">
          Kogus
          <input
            type="number"
            min={1}
            max={device?.total_quantity}
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.valueAsNumber);
              changed();
            }}
            className={input}
          />
        </label>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1">Päevad ja ajad</legend>
        {rows.map((r) => (
          <div key={r.key} className="flex flex-wrap items-end gap-2">
            <select
              aria-label="Nädalapäev"
              className={input}
              value={r.weekday}
              onChange={(e) => updateRow(r.key, { weekday: Number(e.target.value) })}
            >
              {weekdays.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              aria-label="Koolitund"
              className={input}
              value={r.lessonId}
              onChange={(e) => {
                const lesson = lessons.find((l) => String(l.id) === e.target.value);
                updateRow(r.key, lesson
                  ? { lessonId: e.target.value, start: hhmm(lesson.starts_time), end: hhmm(lesson.ends_time) }
                  : { lessonId: "", start: "", end: "" });
              }}
            >
              <option value="">Vaba aeg</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lesson_number}. tund ({hhmm(l.starts_time)}–{hhmm(l.ends_time)})
                </option>
              ))}
            </select>
            {!r.lessonId && (
              <>
                <input
                  aria-label="Algus"
                  type="time"
                  className={input}
                  value={r.start}
                  onChange={(e) => updateRow(r.key, { start: e.target.value })}
                />
                <input
                  aria-label="Lõpp"
                  type="time"
                  className={input}
                  value={r.end}
                  onChange={(e) => updateRow(r.key, { end: e.target.value })}
                />
              </>
            )}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setRows(rows.filter((x) => x.key !== r.key));
                changed();
              }}
            >
              Eemalda
            </button>
          </div>
        ))}
        <button
          type="button"
          className="self-start underline"
          onClick={() => {
            setRows([...rows, { key: nextKey, weekday: 1, lessonId: "", start: "", end: "" }]);
            setNextKey(nextKey + 1);
            changed();
          }}
        >
          Lisa päev
        </button>
      </fieldset>

      <div className="flex gap-3">
        <label className="flex flex-col gap-1">
          Alates
          <input
            type="date"
            className={input}
            min={schoolYear.starts_on}
            max={schoolYear.ends_on}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              changed();
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          Kuni
          <input
            type="date"
            className={input}
            min={schoolYear.starts_on}
            max={schoolYear.ends_on}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              changed();
            }}
          />
        </label>
      </div>

      {periods.length > 0 && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1">Õppetöövabad ajad jäetakse vahele. Jäta sarja alles:</legend>
          {periods.map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={keptPeriods.includes(p.id)}
                onChange={(e) => {
                  setKeptPeriods(e.target.checked ? [...keptPeriods, p.id] : keptPeriods.filter((id) => id !== p.id));
                  changed();
                }}
              />
              {p.name} {dayMonth(p.starts_on)}
              {p.ends_on !== p.starts_on && `–${dayMonth(p.ends_on)}`}
            </label>
          ))}
        </fieldset>
      )}

      {error && <p role="alert" className="text-red-600">{error}</p>}
      {seriesSize > 0 && (
        <p role="status" className="text-green-700">
          Sari loodud: {seriesSize} broneeringut. <Link href="/broneeringud" className="underline">Vaata broneeringuid</Link>
        </p>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={showPreview}
        className="self-start rounded border px-4 py-2"
      >
        Näita eelvaadet
      </button>

      {preview && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Eelvaade</h2>
          <p>
            {preview.rows.length} kuupäeva, neist {conflictCount} konfliktiga.
          </p>
          <table className="text-left">
            <thead>
              <tr>
                <th className="pr-4">Kuupäev</th>
                <th className="pr-4">Kellaaeg</th>
                <th className="pr-4">Kogus</th>
                <th className="pr-4">Vaba</th>
                {conflictCount > 0 && <th>Lahenda</th>}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r, i) => {
                const start = clock.format(new Date(r.starts_at));
                const end = clock.format(new Date(r.ends_at));
                const lesson = lessons.find((l) => hhmm(l.starts_time) === start && hhmm(l.ends_time) === end);
                return (
                // Inputs below apply on blur from their default value; a new key resets them to the
                // previewed values after each re-check.
                <tr key={`${r.date_position}-${r.starts_at}-${r.ends_at}-${r.quantity}`} className={r.has_conflict ? "text-red-600" : undefined}>
                  <td className="pr-4">{tallinnDay.format(new Date(r.starts_at))}</td>
                  <td className="whitespace-nowrap pr-4">
                    {tallinnTime.format(new Date(r.starts_at))}–{tallinnTime.format(new Date(r.ends_at))}
                  </td>
                  <td className="pr-4">{r.quantity}</td>
                  <td className="pr-4 font-semibold">{r.free_quantity}</td>
                  {conflictCount > 0 && (
                    <td>
                      {r.has_conflict && (
                        <div className="flex flex-wrap items-center gap-2 py-1 text-foreground">
                          {!single && (
                            <input
                              aria-label="Uus kogus"
                              type="number"
                              min={1}
                              max={device?.total_quantity}
                              defaultValue={r.quantity}
                              onBlur={(e) => {
                                const q = e.target.valueAsNumber;
                                if (q >= 1 && q !== r.quantity) editDate(i, { quantity: q });
                              }}
                              className={`${input} w-20`}
                            />
                          )}
                          <select
                            aria-label="Muu koolitund"
                            className={input}
                            value={lesson?.id ?? ""}
                            onChange={(e) => {
                              const l = lessons.find((x) => String(x.id) === e.target.value);
                              if (l) editTime(i, r.starts_at, hhmm(l.starts_time), hhmm(l.ends_time));
                            }}
                          >
                            <option value="">Vaba aeg</option>
                            {lessons.map((l) => (
                              <option key={l.id} value={l.id}>{l.lesson_number}. tund</option>
                            ))}
                          </select>
                          <input
                            aria-label="Uus algus"
                            type="time"
                            className={input}
                            defaultValue={start}
                            onBlur={(e) => applyFreeTime(e.currentTarget, i, r.starts_at)}
                          />
                          <input
                            aria-label="Uus lõpp"
                            type="time"
                            className={input}
                            defaultValue={end}
                            onBlur={(e) => applyFreeTime(e.currentTarget, i, r.starts_at)}
                          />
                          <button type="button" className="underline" onClick={() => editDate(i, null)}>
                            Jäta vahele
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
          {conflictCount > 0 && (
            <p role="alert" className="text-red-600">
              Mõnel kuupäeval pole piisavalt vabu seadmeid. Lahenda konfliktid: muuda kogust, vali muu aeg või jäta kuupäev vahele.
            </p>
          )}
          <button
            type="button"
            disabled={pending || conflictCount > 0}
            onClick={commit}
            className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Kinnita sari
          </button>
        </section>
      )}
    </div>
  );
}
