import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Integração com Postgres real (banco descartável preparado por scripts/db-test-setup.sh). */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000
  }
});
