// ADR-080: "a lint rule refuses direct use of fetch, node:http, … outside @jaari/http, and a test checks the rule".
import { join } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../../..");
const eslint = new ESLint({ cwd: root });
const rulesFired = async (code: string, file: string) =>
  (await eslint.lintText(code, { filePath: join(root, file) }))[0]!.messages.map((m) => m.ruleId);

describe("egress lint rule", () => {
  it.each([
    'import { request } from "node:https";',
    'import * as net from "net";',
    'import { Agent } from "undici";',
    'import { connect } from "node:tls";',
    'export const f = () => fetch("https://example.com");',
    'export const f = () => globalThis.fetch("https://example.com");',
    'export const s = new WebSocket("wss://example.com");',
  ])("refuses %s outside @jaari/http", async (code) => {
    // Unused imports also fire no-unused-vars, so look for the restriction itself.
    expect(await rulesFired(code, "packages/probe/src/x.ts")).toEqual(expect.arrayContaining([expect.stringMatching(/^no-restricted-/)]));
  });

  it("allows the same code inside @jaari/http", async () => {
    expect(await rulesFired('import { Agent } from "undici";\nexport const f = () => fetch("x", { dispatcher: new Agent() } as RequestInit);', "packages/http/src/x.ts")).toEqual([]);
  });

  it("keeps the gate rule for packages that the egress rule also covers", async () => {
    expect(await rulesFired('import { createInProcessHost } from "@jaari/capabilities";\nexport { createInProcessHost };', "packages/probe/src/x.ts"))
      .toEqual(["no-restricted-imports"]);
    expect(await rulesFired('import { createInProcessHost } from "@jaari/capabilities";\nexport { createInProcessHost };', "packages/http/src/x.ts"))
      .toEqual(["no-restricted-imports"]);
  });

  it("refuses network modules in the gate and capabilities too", async () => {
    expect(await rulesFired('import "node:net";', "packages/gate/src/x.ts")).toEqual(["no-restricted-imports"]);
  });
});
