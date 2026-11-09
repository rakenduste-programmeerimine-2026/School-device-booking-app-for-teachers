"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Lesson = { lesson_number: number; starts_time: string; ends_time: string };
export type DeviceAvailability = {
  id: number;
  name: string;
  total_quantity: number;
  free_quantity: number;
};

type Props = {
  date: string;
  start: string;
  end: string;
  lessons: Lesson[];
  devices: DeviceAvailability[];
};

// Postgres returns "08:15:00"; time inputs and the URL use "08:15".
const hhmm = (time: string) => time.slice(0, 5);

export function DevicePicker({ date, start, end, lessons, devices }: Props) {
  const router = useRouter();
  const [range, setRange] = useState({ date, start, end });
  const [deviceId, setDeviceId] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Availability is computed on the server, so a new range goes into the URL and the
  // server component re-renders with fresh numbers.
  function changeRange(next: Partial<typeof range>) {
    const updated = { ...range, ...next };
    setRange(updated);
    router.replace(`?${new URLSearchParams(updated)}`, { scroll: false });
  }

  const selectedLesson = lessons.find(
    (l) => hhmm(l.starts_time) === range.start && hhmm(l.ends_time) === range.end,
  );
  const device = devices.find((d) => String(d.id) === deviceId);
  const isSingleObject = device?.total_quantity === 1;
  const rangeIsValid = range.date && range.start && range.end && range.start < range.end;

  return (
    <form className="flex max-w-md flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
      <label className="flex flex-col gap-1">
        Kuupäev
        <input
          type="date"
          required
          value={range.date}
          onChange={(e) => changeRange({ date: e.target.value })}
          className="rounded border p-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        Koolitund
        <select
          value={selectedLesson?.lesson_number ?? ""}
          onChange={(e) => {
            const lesson = lessons.find((l) => String(l.lesson_number) === e.target.value);
            if (lesson) {
              changeRange({ start: hhmm(lesson.starts_time), end: hhmm(lesson.ends_time) });
            }
          }}
          className="rounded border p-2"
        >
          <option value="">Vaba aeg</option>
          {lessons.map((l) => (
            <option key={l.lesson_number} value={l.lesson_number}>
              {l.lesson_number}. tund ({hhmm(l.starts_time)}–{hhmm(l.ends_time)})
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1">
          Algus
          <input
            type="time"
            required
            value={range.start}
            onChange={(e) => changeRange({ start: e.target.value })}
            className="rounded border p-2"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          Lõpp
          <input
            type="time"
            required
            value={range.end}
            onChange={(e) => changeRange({ end: e.target.value })}
            className="rounded border p-2"
          />
        </label>
      </div>

      {!rangeIsValid ? (
        <p>
          {range.start && range.end && range.start >= range.end
            ? "Lõpuaeg peab olema hiljem kui algusaeg."
            : "Vali kuupäev ja aeg, et näha vabu seadmeid."}
        </p>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            Seade
            <select
              required
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="rounded border p-2"
            >
              <option value="" disabled>
                Vali seade
              </option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} – {d.free_quantity} / {d.total_quantity} vaba
                </option>
              ))}
            </select>
          </label>

          {device && !isSingleObject && (
            <label className="flex flex-col gap-1">
              Kogus
              <input
                type="number"
                required
                min={1}
                max={device.total_quantity}
                value={quantity}
                onChange={(e) => setQuantity(e.target.valueAsNumber)}
                className="rounded border p-2"
              />
            </label>
          )}

          {device && (isSingleObject ? 1 : quantity) > device.free_quantity && (
            <p role="alert" className="text-red-600">
              {device.free_quantity === 0
                ? "Sel ajal pole ühtegi vaba."
                : `Sel ajal on vaba ainult ${device.free_quantity}.`}
            </p>
          )}
        </>
      )}
    </form>
  );
}
