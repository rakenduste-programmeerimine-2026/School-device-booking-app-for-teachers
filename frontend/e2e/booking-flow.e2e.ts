import { expect, test, type BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { addDays, tallinnDate, tallinnToIso } from "../lib/tallinn-time";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
// Only the test setup uses this key (to allow-list the test users); the app never sees it.
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const password = "e2e-test-password";
const teacherEmail = "e2e-teacher@example.test";
const otherEmail = "e2e-other@example.test";
// Own device type, so leftover bookings in a developer's database cannot change the result.
const deviceName = "E2E seade";
const deviceTotal = 10;

// Removes the test users and everything they booked, so a run always starts from the same state.
async function resetTestData() {
  const { data } = await admin.auth.admin.listUsers();
  for (const user of data.users.filter((u) => [teacherEmail, otherEmail].includes(u.email ?? ""))) {
    await admin.from("booking_series").delete().eq("owner_id", user.id);
    await admin.auth.admin.deleteUser(user.id);
  }
  await admin.from("allowed_emails").delete().in("email", [teacherEmail, otherEmail]);
  await admin.from("device_types").delete().eq("name", deviceName);
}

// The first Monday from `from` that is not in a break, so the series' first date is known.
async function firstTeachingMonday(from: string, schoolYearId: number) {
  const { data: periods } = await admin
    .from("non_teaching_periods")
    .select("starts_on, ends_on")
    .eq("school_year_id", schoolYearId);
  let day = from;
  while (new Date(`${day}T00:00:00Z`).getUTCDay() !== 1 || periods!.some((p) => p.starts_on <= day && day <= p.ends_on)) {
    day = addDays(day, 1);
  }
  return day;
}

// Signs in with a password and hands the session cookies to the browser, because the app's
// own login is Google-only. The cookies are written by @supabase/ssr, so they match what the app reads.
async function signInBrowser(context: BrowserContext, email: string) {
  const cookies = new Map<string, string>();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  await context.addCookies([...cookies].map(([name, value]) => ({ name, value, url: "http://127.0.0.1:3000" })));
}

test.beforeAll(async () => {
  await resetTestData();
  for (const email of [teacherEmail, otherEmail]) {
    await admin.from("allowed_emails").insert({ email, role: "teacher" });
    const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(error).toBeNull();
  }
  const { error } = await admin.from("device_types").insert({ name: deviceName, total_quantity: deviceTotal });
  expect(error).toBeNull();
});

test.afterAll(resetTestData);

test("teacher books a full-year series, resolves a conflict and bulk-deletes future dates", async ({ page, context }) => {
  // The series form offers the current school year from today on.
  const { data: schoolYear } = await admin
    .from("school_years")
    .select("id, starts_on")
    .gte("ends_on", tallinnDate(Date.now()))
    .order("starts_on")
    .limit(1)
    .single();
  expect(schoolYear, "no current school year in the database").not.toBeNull();
  const today = tallinnDate(Date.now());
  const firstMonday = await firstTeachingMonday(today > schoolYear!.starts_on ? today : schoolYear!.starts_on, schoolYear!.id);
  const { data: device } = await admin.from("device_types").select("id").eq("name", deviceName).single();

  // Another teacher holds 8 of 10 devices on the series' first Monday, lesson 1 (08:15-09:00).
  const other = createClient<Database>(url, publishableKey);
  expect((await other.auth.signInWithPassword({ email: otherEmail, password })).error).toBeNull();
  const { error: blockError } = await other.rpc("create_booking", {
    p_device_type_id: device!.id,
    p_quantity: 8,
    p_starts_at: tallinnToIso(firstMonday, "08:15"),
    p_ends_at: tallinnToIso(firstMonday, "09:00"),
  });
  expect(blockError).toBeNull();

  await signInBrowser(context, teacherEmail);
  await page.goto("/broneeringud/sari");

  // Book 5 devices every Monday, lesson 1, for the rest of the school year.
  await page.getByRole("combobox").first().selectOption({ label: deviceName });
  await page.getByRole("spinbutton").first().fill("5");
  await page.getByLabel("Koolitund").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Näita eelvaadet" }).click();

  // Only the first Monday clashes with the other teacher's 8 devices (8 + 5 > 10).
  await expect(page.getByText(/neist 1 konfliktiga/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Kinnita sari" })).toBeDisabled();

  // Lower the quantity on that date to the 2 devices that are free, then the series can be saved.
  await page.getByLabel("Uus kogus").fill("2");
  await page.getByLabel("Uus kogus").blur();
  await expect(page.getByText(/neist 0 konfliktiga/)).toBeVisible();
  await page.getByRole("button", { name: "Kinnita sari" }).click();
  await expect(page.getByRole("status")).toContainText("Sari loodud");

  // The whole-year series is saved: every Monday has 5 devices, except the lowered first one.
  const { data: series } = await admin
    .from("bookings")
    .select("id")
    .eq("device_type_id", device!.id)
    .eq("quantity", 5);
  expect(series!.length).toBeGreaterThan(20);
  const total = series!.length + 1;

  // Pick three future dates in "Minu broneeringud" and delete them in one action.
  await page.goto("/broneeringud/minu");
  await page.getByText(deviceName).click();
  const rows = page.getByRole("row");
  await expect(rows).toHaveCount(total + 1); // +1 for the header
  for (const row of [0, 1, 2]) await page.getByRole("checkbox").nth(row).check();
  await page.getByRole("button", { name: /Muuda või kustuta valitud \(3\)/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Kustuta", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Kustutatud: 3 broneeringut");

  const { count } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("device_type_id", device!.id);
  // The other teacher's booking plus the series without its three deleted dates.
  expect(count).toBe(total + 1 - 3);
});
