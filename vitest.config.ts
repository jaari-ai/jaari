import { defineConfig } from "vitest/config";

// Workspace packages resolve to their TypeScript source, so tests need no build step (ADR-111).
export default defineConfig({
  ssr: { resolve: { conditions: ["@jaari/source", "import", "default"] } },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    exclude: ["refs/**", "**/node_modules/**"],
  },
});
