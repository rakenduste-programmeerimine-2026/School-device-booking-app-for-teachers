import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addAllowedEmail,
  addDevice,
  removeAllowedEmail,
  setDeviceArchived,
  updateDevice,
} from "./actions";

const input = "rounded border px-2 py-1";
const button = "rounded border px-3 py-1";

// Reading cookies and searchParams makes this render per request, so it is never cached.
async function Admin({ searchParams }: Pick<PageProps<"/haldus">, "searchParams">) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims!.claims.sub)
    .single();
  if (profile?.role !== "admin") redirect("/");

  const [{ data: devices }, { data: emails }] = await Promise.all([
    supabase.from("device_types").select("id, name, total_quantity, archived_at").order("name"),
    supabase.from("allowed_emails").select("email, role").order("email"),
  ]);

  return (
    <>
      {typeof error === "string" && (
        <p role="alert" className="text-red-600">
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
      <Suspense>
        <Admin searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
