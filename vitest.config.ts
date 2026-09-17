import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url))
    }
  },
  test: {
    environment: "node",
    // Testes contra Postgres real rodam à parte: `pnpm test:integration`.
    exclude: ["**/node_modules/**", "**/.next/**", "tests/integration/**"]
  }
});
