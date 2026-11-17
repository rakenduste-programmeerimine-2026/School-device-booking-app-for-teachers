"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBookings, updateBookings, type Scope } from "../actions";

export type Booking = { id: number; startsAt: string; endsAt: string; quantity: number; isPast: boolean };
export type Series = {
  id: number;
  deviceName: string;
  totalQuantity: number;
  ownerName: string;
  bookings: Booking[];
};
type Lesson = { id: number; lesson_number: number; starts_time: string; ends_time: string };

const scopeLabels: Record<Scope, string> = {
  one: "Ainult see broneering",
  following: "See ja kõik järgmised",
  series: "Terve sari (tulevased)",
  selected: "Valitud kuupäevad",
};

// Postgres returns "08:15:00"; time inputs and update_bookings use "08:15".
const hhmm = (time: string) => time.slice(0, 5);
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
const input = "rounded border px-2 py-1";
const button = "rounded border px-3 py-1";

export function SeriesBookings({ series, lessons, isAdmin }: { series: Series; lessons: Lesson[]; isAdmin: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  // The booking the action panel is open for; null means the panel is closed.
  const [anchor, setAnchor] = useState<Booking | null>(null);
  const [scope, setScope] = useState<Scope>("one");
  // Empty fields mean "keep": bookings in a series may differ after conflicts were resolved.
  const [quantity, setQuantity] = useState("");
  const [time, setTime] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [conflicts, setConflicts] = useState(new Map<number, number>());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const single = series.totalQuantity === 1;
  const upcoming = series.bookings.filter((b) => !b.isPast);
  const first = series.bookings[0];
  const last = series.bookings[series.bookings.length - 1];

  function open(booking: Booking, nextScope: Scope) {
    setAnchor(booking);
    setScope(nextScope);
    setQuantity("");
    setTime("");
    setStart("");
    setEnd("");
    setConflicts(new Map());
    setError("");
    setMessage("");
  }

  function finish(text: string) {
    setMessage(text);
    setAnchor(null);
    setSelected([]);
    setConflicts(new Map());
    router.refresh();
  }

  // How many bookings the chosen scope covers, for the delete confirmation.
  function affectedCount(): number {
    if (!anchor) return 0;
    if (scope === "one") return 1;
    if (scope === "selected") return selected.length;
    if (scope === "series") return upcoming.length;
    return upcoming.filter((b) => b.startsAt >= anchor.startsAt).length;
  }

  function save() {
    const change = {
      quantity: quantity ? Number(quantity) : undefined,
      startsTime: start || undefined,
      endsTime: end || undefined,
    };
    if (change.quantity === undefined && !change.startsTime && !change.endsTime) {
      return setError("Muuda kogust või aega.");
    }
    // Only one free time would keep the other end, which is rarely meant and fails confusingly.
    if (time === "free" && (!start || !end)) {
      return setError("Sisesta vaba aja algus ja lõpp.");
    }
    startTransition(async () => {
      const result = await updateBookings(anchor!.id, scope, change, scope === "selected" ? selected : undefined);
      if (result.conflicts) {
        setConflicts(new Map(result.conflicts.map((c) => [c.booking_id, c.free_quantity])));
        setError("Mõnel kuupäeval pole piisavalt vabu seadmeid. Midagi ei muudetud.");
      } else if (result.error) {
        setError(result.error);
      } else {
        finish(`Muudetud: ${result.updated} broneeringut.`);
      }
    });
  }

  function remove() {
    if (!window.confirm(`Kas kustutada ${affectedCount()} broneeringut? Seda ei saa tagasi võtta.`)) return;
    startTransition(async () => {
      const result = await deleteBookings(anchor!.id, scope, scope === "selected" ? selected : undefined);
      if (result.error) setError(result.error);
      else finish(`Kustutatud: ${result.deleted} broneeringut.`);
    });
  }

  function pickTime(value: string) {
    setTime(value);
    const lesson = lessons.find((l) => String(l.id) === value);
    setStart(lesson ? hhmm(lesson.starts_time) : "");
    setEnd(lesson ? hhmm(lesson.ends_time) : "");
  }

  function toggle(id: number, checked: boolean) {
    setSelected(checked ? [...selected, id] : selected.filter((x) => x !== id));
  }

  // A past booking can only be corrected on its own (DB decision 7); series scopes skip the past.
  const scopes: Scope[] = anchor?.isPast
    ? ["one"]
    : ["one", "following", "series", ...(selected.length > 0 ? (["selected"] as const) : [])];

  return (
    <details className="rounded border p-3">
      <summary className="cursor-pointer font-semibold">
        {series.deviceName} · {tallinnDay.format(new Date(first.startsAt))} – {tallinnDay.format(new Date(last.startsAt))} ·{" "}
        {upcoming.length} tulevast / {series.bookings.length} kokku
        {isAdmin && <span className="font-normal"> · {series.ownerName}</span>}
      </summary>

      <div className="mt-3 flex flex-col gap-3">
        {message && <p role="status" className="text-green-700">{message}</p>}
        {selected.length > 0 && (
          <button
            type="button"
            className={`${button} self-start`}
            // The earliest selected date, not the first one ticked, so the panel title matches the list.
            onClick={() => open(series.bookings.find((b) => selected.includes(b.id))!, "selected")}
          >
            Muuda või kustuta valitud ({selected.length})
          </button>
        )}

        <table className="text-left">
          <thead>
            <tr>
              <th className="pr-2"><span className="sr-only">Vali</span></th>
              <th className="pr-4">Kuupäev</th>
              <th className="pr-4">Kellaaeg</th>
              <th className="pr-4">Kogus</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {series.bookings.map((b) => (
              <tr key={b.id} className={b.isPast ? "text-gray-500" : anchor?.id === b.id ? "font-semibold" : undefined}>
                <td className="pr-2">
                  {!b.isPast && (
                    <input
                      type="checkbox"
                      aria-label={`Vali ${tallinnDay.format(new Date(b.startsAt))}`}
                      checked={selected.includes(b.id)}
                      onChange={(e) => toggle(b.id, e.target.checked)}
                    />
                  )}
                </td>
                <td className="pr-4">{tallinnDay.format(new Date(b.startsAt))}</td>
                <td className="whitespace-nowrap pr-4">
                  {tallinnTime.format(new Date(b.startsAt))}–{tallinnTime.format(new Date(b.endsAt))}
                </td>
                <td className="pr-4">
                  {b.quantity}
                  {conflicts.has(b.id) && <span className="ml-2 text-red-600">vabu {conflicts.get(b.id)}</span>}
                </td>
                <td>
                  {/* Teachers never see an edit control on a past booking; admins may correct one. */}
                  {!b.isPast ? (
                    <button type="button" className="underline" onClick={() => open(b, "one")}>
                      Muuda
                    </button>
                  ) : isAdmin ? (
                    <button type="button" className="underline" onClick={() => open(b, "one")}>
                      Paranda
                    </button>
                  ) : (
                    "möödunud"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {anchor && (
          <section className="flex flex-col gap-3 rounded border p-3" aria-label="Muuda broneeringuid">
            <h3 className="font-semibold">
              {anchor.isPast ? "Paranda möödunud broneeringut" : "Muuda või kustuta"}:{" "}
              {tallinnDay.format(new Date(anchor.startsAt))}
            </h3>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1">Ulatus</legend>
              {scopes.map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input type="radio" name={`scope-${series.id}`} checked={scope === s} onChange={() => setScope(s)} />
                  {scopeLabels[s]}
                  {s === "selected" && ` (${selected.length})`}
                </label>
              ))}
            </fieldset>

            <div className="flex flex-wrap items-end gap-2">
              {!single && (
                <label className="flex flex-col gap-1">
                  Uus kogus
                  <input
                    type="number"
                    min={1}
                    max={series.totalQuantity}
                    placeholder="jääb samaks"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={`${input} w-32`}
                  />
                </label>
              )}
              <label className="flex flex-col gap-1">
                Uus aeg
                <select className={input} value={time} onChange={(e) => pickTime(e.target.value)}>
                  <option value="">jääb samaks</option>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lesson_number}. tund ({hhmm(l.starts_time)}–{hhmm(l.ends_time)})
                    </option>
                  ))}
                  <option value="free">Vaba aeg</option>
                </select>
              </label>
              {time === "free" && (
                <>
                  <input aria-label="Algus" type="time" className={input} value={start} onChange={(e) => setStart(e.target.value)} />
                  <input aria-label="Lõpp" type="time" className={input} value={end} onChange={(e) => setEnd(e.target.value)} />
                </>
              )}
            </div>

            {error && <p role="alert" className="text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" disabled={pending} className={button} onClick={save}>
                Salvesta muudatus
              </button>
              <button type="button" disabled={pending} className={`${button} text-red-700`} onClick={remove}>
                Kustuta
              </button>
              <button type="button" disabled={pending} className={button} onClick={() => setAnchor(null)}>
                Loobu
              </button>
            </div>
          </section>
        )}
      </div>
    </details>
  );
}
