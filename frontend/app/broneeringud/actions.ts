"use server";

import { createClient } from "@/lib/supabase/server";
import { tallinnToIso } from "@/lib/tallinn-time";

export type BookingState = { error?: string; success?: boolean };

const errorMessages: Record<string, string> = {
  not_authenticated: "Broneerimiseks logi sisse.",
  access_revoked: "Sul pole enam ligipääsu.",
  invalid_quantity: "Sisesta kogus, mis on vähemalt 1.",
  invalid_range: "Lõppaeg peab olema algusajast hilisem.",
  device_type_not_found: "Seadet ei leitud.",
  device_type_archived: "See seade on arhiveeritud ega ole broneeritav.",
};

export async function createBooking(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) return { error: errorMessages.not_authenticated };

  // A missing field must stay empty: String(null) would be the truthy text "null".
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const date = field("date");
  const lessonId = field("lessonId");
  let start = field("startTime");
  let end = field("endTime");

  // A lesson only fills in the times; the booking itself stores plain timestamps.
  if (lessonId) {
    const { data: lesson } = await supabase
      .from("lesson_periods")
      .select("starts_time, ends_time")
      .eq("id", Number(lessonId))
      .single();
    if (!lesson) return { error: "Koolitundi ei leitud." };
    start = lesson.starts_time;
    end = lesson.ends_time;
  }
  if (!date || !start || !end) return { error: "Vali kuupäev ja ajad." };

  // Malformed input (e.g. "2026-13-45") makes toISOString throw; report it instead of crashing.
  let startsAt: string, endsAt: string;
  try {
    startsAt = tallinnToIso(date, start);
    endsAt = tallinnToIso(date, end);
  } catch {
    return { error: "Vali kuupäev ja ajad." };
  }

  const { error } = await supabase.rpc("create_booking", {
    p_device_type_id: Number(field("deviceTypeId")),
    p_quantity: Number(field("quantity") || 1),
    p_starts_at: startsAt,
    p_ends_at: endsAt,
  });
  if (!error) return { success: true };

  if (error.message === "insufficient_capacity") {
    const free = error.details?.match(/available=(\d+)/)?.[1] ?? "0";
    return { error: `Valitud ajal on vabu seadmeid ainult ${free}.` };
  }
  return { error: errorMessages[error.message] ?? "Broneerimine ebaõnnestus." };
}
