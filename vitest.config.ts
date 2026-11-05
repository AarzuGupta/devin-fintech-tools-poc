import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    env: {
      DATABASE_URL: "file:./test.db",
      SESSION_SECRET: "test-secret-test-secret-test-secret-123",
    },
    fileParallelism: false,
    pool: "forks",
  },
});
