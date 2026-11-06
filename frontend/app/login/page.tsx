import { Suspense } from "react";
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

async function LoginError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p role="alert" className="text-red-600">
      Sisselogimine ebaõnnestus. Kontrolli, et sinu e-post on lubatud kasutajate nimekirjas.
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="m-auto flex flex-col items-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Seadmebroneering</h1>
      <Suspense>
        <LoginError searchParams={searchParams} />
      </Suspense>
      <form action={signInWithGoogle}>
        <button className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black">
          Logi sisse Google’iga
        </button>
      </form>
    </main>
  );
}
