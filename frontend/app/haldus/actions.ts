"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const errorMessages: Record<string, string> = {
  "23505": "Selline kirje on juba olemas.",
  "42501": "Ainult admin saab seda teha.",
  "23514": "Kontrolli andmeid: nimi, kogus, kuupäevade ja kellaaegade järjekord.",
  "23P01": "Õppeaasta kattub mõne teise õppeaastaga.",
  "23503": "Valitud õppeaastat ei leitud.",
  "22007": "Kuupäev või kellaaeg on puudu või vigane.",
  "22008": "Kuupäev või kellaaeg on puudu või vigane.",
  empty_name: "Sisesta seadme nimi.",
  last_admin: "Viimast admini ei saa eemaldada.",
};

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

async function finish(error: { code?: string; message: string } | null) {
  if (!error) redirect("/haldus");
  const message = errorMessages[error.code ?? ""] ?? errorMessages[error.message] ?? "Salvestamine ebaõnnestus.";
  redirect(`/haldus?error=${encodeURIComponent(message)}`);
}

// Checked here because RLS makes a non-admin's update or delete match 0 rows without an error.
async function adminClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/");
  return supabase;
}

export async function addDevice(formData: FormData) {
  const supabase = await adminClient();
  if (!field(formData, "name")) return finish({ message: "empty_name" });
  const { error } = await supabase
    .from("device_types")
    .insert({ name: field(formData, "name"), total_quantity: Number(field(formData, "quantity")) });
  return finish(error);
}

export async function updateDevice(formData: FormData) {
  const supabase = await adminClient();
  if (!field(formData, "name")) return finish({ message: "empty_name" });
  const { error } = await supabase
    .from("device_types")
    .update({ name: field(formData, "name"), total_quantity: Number(field(formData, "quantity")) })
    .eq("id", Number(field(formData, "id")));
  return finish(error);
}

// Devices are archived, never deleted, so their old bookings keep a device to point at.
export async function setDeviceArchived(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase
    .from("device_types")
    .update({ archived_at: field(formData, "archive") === "1" ? new Date().toISOString() : null })
    .eq("id", Number(field(formData, "id")));
  return finish(error);
}

export async function addAllowedEmail(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("allowed_emails").insert({
    email: field(formData, "email").toLowerCase(),
    role: field(formData, "role") === "admin" ? "admin" : "teacher",
  });
  return finish(error);
}

export async function removeAllowedEmail(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("allowed_emails").delete().eq("email", field(formData, "email"));
  return finish(error);
}

const id = (formData: FormData) => Number(field(formData, "id"));

const schoolYearFields = (formData: FormData) => ({
  starts_on: field(formData, "starts_on"),
  ends_on: field(formData, "ends_on"),
});

const periodFields = (formData: FormData) => ({
  school_year_id: Number(field(formData, "school_year_id")),
  kind: field(formData, "kind") as "break" | "public_holiday" | "day_off",
  name: field(formData, "name"),
  ...schoolYearFields(formData),
});

const lessonFields = (formData: FormData) => ({
  lesson_number: Number(field(formData, "lesson_number")),
  starts_time: field(formData, "starts_time"),
  ends_time: field(formData, "ends_time"),
});

export async function addSchoolYear(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("school_years").insert(schoolYearFields(formData));
  return finish(error);
}

export async function updateSchoolYear(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("school_years").update(schoolYearFields(formData)).eq("id", id(formData));
  return finish(error);
}

// Deleting a year also deletes its non-teaching periods (on delete cascade).
export async function deleteSchoolYear(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("school_years").delete().eq("id", id(formData));
  return finish(error);
}

export async function addNonTeachingPeriod(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("non_teaching_periods").insert(periodFields(formData));
  return finish(error);
}

export async function updateNonTeachingPeriod(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("non_teaching_periods").update(periodFields(formData)).eq("id", id(formData));
  return finish(error);
}

export async function deleteNonTeachingPeriod(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("non_teaching_periods").delete().eq("id", id(formData));
  return finish(error);
}

export async function addLessonPeriod(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("lesson_periods").insert(lessonFields(formData));
  return finish(error);
}

export async function updateLessonPeriod(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("lesson_periods").update(lessonFields(formData)).eq("id", id(formData));
  return finish(error);
}

export async function deleteLessonPeriod(formData: FormData) {
  const supabase = await adminClient();
  const { error } = await supabase.from("lesson_periods").delete().eq("id", id(formData));
  return finish(error);
}
