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

  it("allows listening servers outside @jaari/http, and still refuses their clients", async () => {
    const code = 'import { createServer } from "node:http";\nimport { createServer as net, isIP } from "node:net";\nexport { createServer, net, isIP };';
    expect(await rulesFired(code, "apps/daemon/src/x.ts")).toEqual([]);
    expect(await rulesFired('import { request } from "node:http";\nexport { request };', "apps/daemon/src/x.ts")).toEqual(["no-restricted-imports"]);
    expect(await rulesFired('import { connect } from "node:net";\nexport { connect };', "apps/daemon/src/x.ts")).toEqual(["no-restricted-imports"]);
  });

  it("lets only the CLI's socket file dial the daemon's socket, and keeps every other rule there", async () => {
    const code = 'import { createConnection } from "node:net";\nexport { createConnection };';
    expect(await rulesFired(code, "apps/cli/src/socket.ts")).toEqual([]);
    expect(await rulesFired(code, "apps/cli/src/chat.ts")).toEqual(["no-restricted-imports"]);
    expect(await rulesFired('import { connect } from "node:net";\nexport { connect };', "apps/cli/src/socket.ts")).toEqual(["no-restricted-imports"]);
    expect(await rulesFired('import { request } from "node:http";\nexport { request };', "apps/cli/src/socket.ts")).toEqual(["no-restricted-imports"]);
    expect(await rulesFired('export const f = () => fetch("https://example.com");', "apps/cli/src/socket.ts")).toEqual(["no-restricted-globals"]);
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
    expect(await rulesFired('import { connect } from "node:net";\nexport { connect };', "packages/gate/src/x.ts")).toEqual(["no-restricted-imports"]);
  });
});
