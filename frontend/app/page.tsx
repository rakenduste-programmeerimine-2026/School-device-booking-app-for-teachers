import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

async function CurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", data!.claims.sub)
    .single();
  return (
    <p>
      {profile?.email} ({profile?.role === "admin" ? "admin" : "õpetaja"})
    </p>
  );
}

export default function Home() {
  return (
    <main className="p-8">
      <Suspense>
        <CurrentUser />
      </Suspense>
    </main>
  );
}
