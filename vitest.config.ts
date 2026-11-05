import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    env: {
      DATABASE_URL: "file:./test.db?connection_limit=1",
      SESSION_SECRET: "test-secret-test-secret-test-secret-123",
      REFUNDS_API_TOKEN: "test-mock-token",
    },
    fileParallelism: false,
    pool: "forks",
  },
});
