import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests unitaires des invariants metier purs (src/lib, src/server/*.test.ts) :
// conflits de creneaux, recurrences, tarification, libelles, dates.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
