import { defineConfig } from "@playwright/test";

// Local runs read the same Supabase URL and key as the app; CI sets them in the environment.
try {
  process.loadEnvFile(".env.local");
} catch {}

const baseURL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "e2e",
  // Not *.spec.ts, so Vitest (`npm test`) does not pick these files up.
  testMatch: "**/*.e2e.ts",
  // One shared database and one flow: tests must not run side by side.
  workers: 1,
  use: { baseURL },
  webServer: {
    // A production build, because that is where the cached/uncached split we ship shows up.
    command: "npm run build && npm run start",
    url: baseURL,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
});
