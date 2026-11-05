import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const env = {
  DATABASE_URL: "file:./e2e.db",
  SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-12345",
  REFUNDS_API_BASE_URL: `http://127.0.0.1:${PORT}/api/mock-finance/v1`,
  REFUNDS_API_TOKEN: "e2e-mock-token",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1600, height: 900 },
  },
  webServer: {
    // Fresh, deterministic database, then a production build.
    command: `npx prisma db push --force-reset --skip-generate && npx tsx prisma/seed.ts && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    env,
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
