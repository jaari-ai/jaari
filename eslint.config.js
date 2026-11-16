import js from "@eslint/js";
import tseslint from "typescript-eslint";

const SOURCES = ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"];
const GATE = ["packages/gate/src/**", "packages/capabilities/src/**"];
const HTTP = ["packages/http/src/**"];

// Only the gate builds a capability host, so no code can dispatch around it (ADR-018).
const HOST = [{ name: "@jaari/capabilities", importNames: ["createInProcessHost"], message: "Dispatch through @jaari/gate (ADR-018)." }];
const DEEP = [{ group: ["**/capabilities/src/**"], message: "Import @jaari/capabilities by name (ADR-111)." }];
// All network egress goes through @jaari/http (ADR-080).
const egress = "Network egress goes through @jaari/http (ADR-080).";
const NETWORK = [
  ...["http", "https", "net", "tls", "http2", "dgram"].flatMap((m) => [m, `node:${m}`]),
  "undici",
].map((name) => ({ name, message: egress }));
const NETWORK_GLOBALS = ["fetch", "WebSocket", "EventSource"];

// A later block replaces an earlier block's options for the same rule, so each set of files gets its whole list.
const restrict = (paths, patterns = []) => ({ "no-restricted-imports": ["error", { paths, patterns }] });

// Allowlist: only workspace sources and root config are linted; refs/ never is (ADR-002).
export default tseslint.config(
  { ignores: ["refs/**", "**/dist/**", "**/node_modules/**", "python/**"] },
  {
    files: [...SOURCES, "*.config.{js,ts}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  { files: SOURCES, ignores: [...GATE, ...HTTP], rules: restrict([...HOST, ...NETWORK], DEEP) },
  { files: GATE, rules: restrict(NETWORK) },
  { files: HTTP, rules: restrict(HOST, DEEP) },
  {
    files: SOURCES,
    ignores: HTTP,
    rules: {
      "no-restricted-globals": ["error", ...NETWORK_GLOBALS.map((name) => ({ name, message: egress }))],
      "no-restricted-properties": ["error", ...["globalThis", "global"].flatMap((object) =>
        NETWORK_GLOBALS.map((property) => ({ object, property, message: egress })))],
    },
  },
);
