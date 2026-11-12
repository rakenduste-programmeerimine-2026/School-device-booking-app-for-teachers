"use client";

import { useActionState, useState } from "react";
import { createBooking, type BookingState } from "../actions";

type Device = { id: number; name: string; total_quantity: number };
type Lesson = { id: number; lesson_number: number; starts_time: string; ends_time: string };

export function BookingForm({ devices, lessons }: { devices: Device[]; lessons: Lesson[] }) {
  const [state, action, pending] = useActionState<BookingState, FormData>(createBooking, {});
  const [deviceId, setDeviceId] = useState(devices[0]?.id);
  const [lessonId, setLessonId] = useState("");
  const single = devices.find((d) => d.id === deviceId)?.total_quantity === 1;
  const input = "rounded border px-2 py-1";

  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1">
        Seade
        <select name="deviceTypeId" className={input} value={deviceId} onChange={(e) => setDeviceId(Number(e.target.value))}>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>
      {!single && (
        <label className="flex flex-col gap-1">
          Kogus
          <input name="quantity" type="number" min={1} defaultValue={1} required className={input} />
        </label>
      )}
      <label className="flex flex-col gap-1">
        Kuupäev
        <input name="date" type="date" required className={input} />
      </label>
      <label className="flex flex-col gap-1">
        Koolitund
        <select name="lessonId" className={input} value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
          <option value="">Vabad ajad</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.lesson_number}. tund ({l.starts_time.slice(0, 5)}–{l.ends_time.slice(0, 5)})
            </option>
          ))}
        </select>
      </label>
      {!lessonId && (
        <div className="flex gap-3">
          <label className="flex flex-col gap-1">
            Algus
            <input name="startTime" type="time" required className={input} />
          </label>
          <label className="flex flex-col gap-1">
            Lõpp
            <input name="endTime" type="time" required className={input} />
          </label>
        </div>
      )}
      {state.error && <p role="alert" className="text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="text-green-700">Broneering tehtud.</p>}
      <button disabled={pending} className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black">
        Broneeri
      </button>
    </form>
  );
}
