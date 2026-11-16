"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const errorMessages: Record<string, string> = {
  "23505": "Selline nimi või e-post on juba olemas.",
  "42501": "Ainult admin saab seda teha.",
  "23514": "Sisesta nimi ja kogus, mis on vähemalt 1.",
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
