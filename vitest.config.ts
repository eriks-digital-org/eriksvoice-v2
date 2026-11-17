import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@/": fileURLToPath(new URL("./src/", import.meta.url)),
      // Server-only modules are tested as plain modules.
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
