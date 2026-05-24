import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` is a build-time guard that throws when imported into a
      // client bundle. Vitest runs in Node where it is meaningless, so stub it.
      "server-only": path.resolve(__dirname, "tests/__stubs__/server-only.ts"),
    },
  },
});
