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
  invalid_dates: "Sarjas pole ühtegi kuupäeva või on neid liiga palju.",
  overlapping_dates: "Sarja ajad kattuvad omavahel. Vajadusel suurenda kogust.",
  booking_not_found: "Broneeringut ei leitud.",
  not_allowed: "Sa võid muuta ainult oma broneeringuid.",
  booking_in_past: "Möödunud broneeringut saab muuta ainult admin.",
  invalid_selection: "Vali sama sarja broneeringud.",
  invalid_scope: "Tundmatu muutmise ulatus.",
  no_bookings: "Valitud ulatuses pole tulevasi broneeringuid.",
  nothing_to_change: "Muuda kogust või aega.",
};

// The same list goes to preview and commit, so the committed dates are the previewed ones.
export type SeriesInput = { starts_at: string; ends_at: string; quantity: number };
export type PreviewRow = {
  date_position: number;
  starts_at: string;
  ends_at: string;
  quantity: number;
  free_quantity: number;
  has_conflict: boolean;
};
export type Conflict = { date_position: number; free_quantity: number };

export async function previewSeries(
  deviceTypeId: number,
  dates: SeriesInput[],
): Promise<{ rows?: PreviewRow[]; error?: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) return { error: errorMessages.not_authenticated };

  const { data, error } = await supabase.rpc("preview_series", {
    p_device_type_id: deviceTypeId,
    p_dates: dates,
  });
  if (error) return { error: errorMessages[error.message] ?? "Eelvaade ebaõnnestus." };
  return { rows: data };
}

export async function commitSeries(
  deviceTypeId: number,
  dates: SeriesInput[],
): Promise<{ seriesId?: number; conflicts?: Conflict[]; error?: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) return { error: errorMessages.not_authenticated };

  const { data, error } = await supabase.rpc("commit_series", {
    p_device_type_id: deviceTypeId,
    p_dates: dates,
  });
  if (!error) return { seriesId: data };

  // Availability changed after the preview; the detail lists the dates that no longer fit.
  if (error.message === "insufficient_capacity") {
    return { conflicts: JSON.parse(error.details ?? "[]") as Conflict[] };
  }
  return { error: errorMessages[error.message] ?? "Sarja salvestamine ebaõnnestus." };
}

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

// 'one' / 'following' / 'series' act on the clicked booking's series; 'selected' also needs bookingIds.
export type Scope = "one" | "following" | "series" | "selected";
export type BookingConflict = { booking_id: number; free_quantity: number };

export async function updateBookings(
  bookingId: number,
  scope: Scope,
  change: { quantity?: number; startsTime?: string; endsTime?: string },
  bookingIds?: number[],
): Promise<{ updated?: number; conflicts?: BookingConflict[]; error?: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) return { error: errorMessages.not_authenticated };

  const { data, error } = await supabase.rpc("update_bookings", {
    p_booking_id: bookingId,
    p_scope: scope,
    p_booking_ids: bookingIds,
    p_quantity: change.quantity,
    p_starts_time: change.startsTime,
    p_ends_time: change.endsTime,
  });
  if (!error) return { updated: data };

  // Nothing was saved; the detail lists the bookings that no longer fit.
  if (error.message === "insufficient_capacity") {
    return { conflicts: JSON.parse(error.details ?? "[]") as BookingConflict[] };
  }
  return { error: errorMessages[error.message] ?? "Muutmine ebaõnnestus." };
}

export async function deleteBookings(
  bookingId: number,
  scope: Scope,
  bookingIds?: number[],
): Promise<{ deleted?: number; error?: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) return { error: errorMessages.not_authenticated };

  const { data, error } = await supabase.rpc("delete_bookings", {
    p_booking_id: bookingId,
    p_scope: scope,
    p_booking_ids: bookingIds,
  });
  if (error) return { error: errorMessages[error.message] ?? "Kustutamine ebaõnnestus." };
  return { deleted: data };
}
