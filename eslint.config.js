import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Allowlist: only workspace sources and root config are linted; refs/ never is (ADR-002).
export default tseslint.config(
  { ignores: ["refs/**", "**/dist/**", "**/node_modules/**", "python/**"] },
  {
    files: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts", "*.config.{js,ts}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  // Only the gate builds a capability host, so no code can dispatch around it (ADR-018).
  {
    files: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
    ignores: ["packages/gate/src/**", "packages/capabilities/src/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "@jaari/capabilities", importNames: ["createInProcessHost"], message: "Dispatch through @jaari/gate (ADR-018)." }],
        patterns: [{ group: ["**/capabilities/src/**"], message: "Import @jaari/capabilities by name (ADR-111)." }],
      }],
    },
  },
);
