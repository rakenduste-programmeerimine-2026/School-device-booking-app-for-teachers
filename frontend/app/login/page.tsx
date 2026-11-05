import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function signInWithGoogle() {
  "use server";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=1");
  redirect(data.url);
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="m-auto flex flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Seadmebroneering</h1>
      {error && (
        <p role="alert" className="text-red-600">
          Sisselogimine ebaõnnestus. Kontrolli, et sinu e-post on lubatud kasutajate nimekirjas.
        </p>
      )}
      <form action={signInWithGoogle}>
        <button className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black">
          Logi sisse Google’iga
        </button>
      </form>
    </main>
  );
}
