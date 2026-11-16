"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const errorMessages: Record<string, string> = {
  "23505": "Selline nimi või e-post on juba olemas.",
  "42501": "Ainult admin saab seda teha.",
  "23514": "Sisesta nimi ja kogus, mis on vähemalt 1.",
  last_admin: "Viimast admini ei saa eemaldada.",
};

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

// RLS lets only admins write, so a non-admin posting here gets 42501 rather than a change.
async function finish(error: { code?: string; message: string } | null) {
  if (!error) redirect("/haldus");
  const message = errorMessages[error.code ?? ""] ?? errorMessages[error.message] ?? "Salvestamine ebaõnnestus.";
  redirect(`/haldus?error=${encodeURIComponent(message)}`);
}

async function signedInClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect("/login");
  return supabase;
}

export async function addDevice(formData: FormData) {
  const supabase = await signedInClient();
  const { error } = await supabase
    .from("device_types")
    .insert({ name: field(formData, "name"), total_quantity: Number(field(formData, "quantity")) });
  return finish(error);
}

export async function updateDevice(formData: FormData) {
  const supabase = await signedInClient();
  const { error } = await supabase
    .from("device_types")
    .update({ name: field(formData, "name"), total_quantity: Number(field(formData, "quantity")) })
    .eq("id", Number(field(formData, "id")));
  return finish(error);
}

// Devices are archived, never deleted, so their old bookings keep a device to point at.
export async function setDeviceArchived(formData: FormData) {
  const supabase = await signedInClient();
  const { error } = await supabase
    .from("device_types")
    .update({ archived_at: field(formData, "archive") === "1" ? new Date().toISOString() : null })
    .eq("id", Number(field(formData, "id")));
  return finish(error);
}

export async function addAllowedEmail(formData: FormData) {
  const supabase = await signedInClient();
  const { error } = await supabase.from("allowed_emails").insert({
    email: field(formData, "email").toLowerCase(),
    role: field(formData, "role") === "admin" ? "admin" : "teacher",
  });
  return finish(error);
}

export async function removeAllowedEmail(formData: FormData) {
  const supabase = await signedInClient();
  const { error } = await supabase.from("allowed_emails").delete().eq("email", field(formData, "email"));
  return finish(error);
}
