import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Allowlist: only workspace sources and root config are linted; refs/ never is (ADR-002).
export default tseslint.config(
  { ignores: ["refs/**", "**/dist/**", "**/node_modules/**", "python/**"] },
  {
    files: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts", "*.config.{js,ts}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
);
