// Runs scripts/screens/make-save.ts, which writes the save the screenshots
// load (see scripts/screens.mjs). Not part of the test suite:
//
//   npx vitest run --config scripts/screens/vitest.config.mts
import { defineConfig } from "vitest/config";
import path from "path";

const root = path.resolve(import.meta.dirname, "..", "..");

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "server-only": path.resolve(root, "tests/support/server-only.ts"),
    },
  },
  test: { include: ["scripts/screens/*.ts"], testTimeout: 120_000 },
});
