import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Agent } from "undici";
import { createEgress, createPolicyCheck, EgressLeak, EgressRefused } from "./egress.js";

// "rebind.invalid" stands for a public-looking name whose DNS answer points at this machine (DNS rebinding).
// .invalid never resolves for real (RFC 6761), so a pass proves the connector dialled our checked address.
vi.mock("node:dns/promises", async (original) => {
  const real = await original<typeof import("node:dns/promises")>();
  return {
    ...real,
    lookup: vi.fn(async (host: string, options: object) =>
      host === "rebind.invalid" ? [{ address: "127.0.0.1", family: 4 }]
      // localhost on many systems: ::1 first, while a server such as Ollama listens on 127.0.0.1 only.
      : host === "dual.invalid" ? [{ address: "::1", family: 6 }, { address: "127.0.0.1", family: 4 }]
      : real.lookup(host, options as { all: true })),
  };
});

const listen = (handler: Parameters<typeof createServer>[1]) =>
  new Promise<{ server: Server; port: number }>((done) => {
    const server = createServer(handler).listen(0, "127.0.0.1", () => done({ server, port: (server.address() as AddressInfo).port }));
  });

let target: { server: Server; port: number };
let redirector: { server: Server; port: number };
beforeAll(async () => {
  target = await listen((_, res) => res.end("ok"));
  redirector = await listen((_, res) => res.writeHead(302, { location: `http://127.0.0.1:${target.port}/` }).end());
});
afterAll(() => {
  target.server.close();
  redirector.server.close();
});

const refusedWith = async (call: Promise<Response>) => {
  const error = await call.then(() => null, (e: Error) => e);
  expect(error?.cause).toBeInstanceOf(EgressRefused);
  return error!.cause as EgressRefused;
};

it("pins undici to the major version Node's own fetch runs on, so our Agent fits its dispatcher slot", async () => {
  const { version } = (await import("undici/package.json", { with: { type: "json" } })).default as { version: string };
  expect(version.split(".")[0]).toBe(process.versions.undici?.split(".")[0]);
});

describe("createPolicyCheck", () => {
  it("refuses metadata, link-local, and reserved addresses even when allowed", () => {
    const check = createPolicyCheck({ allow: ["169.254.0.0/16", "0.0.0.0/8"] });
    expect(check("169.254.169.254", 80)).toEqual({ address: "169.254.169.254", reason: "metadata" });
    expect(check("169.254.1.1", 80)).toEqual({ address: "169.254.1.1", reason: "link-local" });
    expect(check("0.0.0.0", 80)).toEqual({ address: "0.0.0.0", reason: "reserved" });
  });

  it("allows a private destination only on the allowed address and port", () => {
    const check = createPolicyCheck({ allow: ["192.168.1.0/24", "127.0.0.1:11434", "[::1]:8080", "fd12::/48"] });
    expect(check("192.168.1.20", 443)).toBeNull();
    expect(check("127.0.0.1", 11434)).toBeNull();
    expect(check("127.0.0.1", 11435)).toEqual({ address: "127.0.0.1", reason: "loopback" });
    expect(check("::1", 8080)).toBeNull();
    expect(check("fd12::9", 1)).toBeNull();
    expect(check("10.0.0.1", 443)).toEqual({ address: "10.0.0.1", reason: "private" });
    expect(check("8.8.8.8", 443)).toBeNull();
  });

  it("allows a name:port entry's loopback or private addresses for that name and port only", () => {
    const check = createPolicyCheck({ allow: ["ollama:11434"] });
    expect(check("172.18.0.5", 11434, "ollama")).toBeNull();
    expect(check("172.18.0.5", 11435, "ollama")).toEqual({ address: "172.18.0.5", reason: "private" });
    expect(check("172.18.0.5", 11434, "other")).toEqual({ address: "172.18.0.5", reason: "private" });
    expect(check("169.254.169.254", 11434, "ollama")).toEqual({ address: "169.254.169.254", reason: "metadata" });
  });

  it("refuses the daemon's own ports on any address that is not public, even when allowed", () => {
    const check = createPolicyCheck({ allow: ["127.0.0.1"], ownPorts: [7420] });
    expect(check("127.0.0.1", 7420)).toEqual({ address: "127.0.0.1", reason: "own-port" });
  });

  it.each(["localhost", "ollama", "1.2.3:80", "-bad:80", "10.0.0.1/33", "10.0.0.1:0", "[::1", "::1:80:x", "1.2.3"])("refuses the allow entry %s at start", (entry) => {
    expect(() => createPolicyCheck({ allow: [entry] })).toThrow("is not an IP address");
  });
});

describe("createEgress fetch", () => {
  it("refuses loopback by default", async () => {
    const refused = await refusedWith(createEgress().fetch(`http://127.0.0.1:${target.port}/`));
    expect(refused.refusals).toEqual([{ address: "127.0.0.1", reason: "loopback" }]);
  });

  it("reaches an allowed destination", async () => {
    const response = await createEgress({ allow: [`127.0.0.1:${target.port}`] }).fetch(`http://127.0.0.1:${target.port}/`);
    expect(await response.text()).toBe("ok");
  });

  it("dials the checked address of a name, so DNS cannot change it after the check", async () => {
    await refusedWith(createEgress().fetch(`http://rebind.invalid:${target.port}/`));
    // Allowed: undici never resolves rebind.invalid itself (it would get ENOTFOUND), it dials the address we checked.
    const response = await createEgress({ allow: [`127.0.0.1:${target.port}`] }).fetch(`http://rebind.invalid:${target.port}/`);
    expect(await response.text()).toBe("ok");
  });

  it("dials only addresses that pass when a name also returns refused ones (localhost)", async () => {
    const response = await createEgress({ allow: [`127.0.0.1:${target.port}`] }).fetch(`http://localhost:${target.port}/`);
    expect(await response.text()).toBe("ok");
  });

  it("reaches a name allowed as name:port, as a Compose service name would be", async () => {
    const egress = createEgress({ allow: [`rebind.invalid:${target.port}`] });
    expect(await (await egress.fetch(`http://rebind.invalid:${target.port}/`)).text()).toBe("ok");
    await refusedWith(egress.fetch(`http://127.0.0.1:${target.port}/`));
  });

  it("tries the next checked address when the first one does not answer", async () => {
    const egress = createEgress({ allow: [`dual.invalid:${target.port}`] });
    expect(await (await egress.fetch(`http://dual.invalid:${target.port}/`)).text()).toBe("ok");
  });

  it("checks every redirect hop", async () => {
    const egress = createEgress({ allow: [`127.0.0.1:${redirector.port}`] });
    const refused = await refusedWith(egress.fetch(`http://127.0.0.1:${redirector.port}/`));
    expect(refused.port).toBe(target.port);
  });

  it("ignores a dispatcher passed by the caller", async () => {
    await refusedWith(createEgress().fetch(`http://127.0.0.1:${target.port}/`, { dispatcher: new Agent() } as RequestInit));
  });

  it("refuses the daemon's own port", async () => {
    const egress = createEgress({ allow: ["127.0.0.1"], ownPorts: [target.port] });
    expect((await refusedWith(egress.fetch(`http://127.0.0.1:${target.port}/`))).refusals[0]?.reason).toBe("own-port");
  });

  describe("the leak scan (ADR-104, ADR-120)", () => {
    const MARKER = "canary".repeat(4);
    const setup = async () => {
      const bodies: string[] = [];
      const echo = await listen((req, res) => {
        let body = "";
        req.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")));
        req.on("end", () => (bodies.push(body), res.end(body)));
      });
      const leaks: { host: string; marker: string }[] = [];
      const egress = createEgress({
        allow: [`127.0.0.1:${echo.port}`],
        scan: (text) => (text.includes(MARKER) ? "canary" : undefined),
        onLeak: (hit) => void leaks.push(hit),
      });
      return { url: `http://127.0.0.1:${echo.port}/`, bodies, leaks, egress, close: () => echo.server.close() };
    };

    it.each([
      ["the URL", (url: string) => [`${url}?q=${MARKER}`, undefined] as const],
      ["a header", (url: string) => [url, { headers: { "x-note": MARKER } }] as const],
      ["a text body", (url: string) => [url, { method: "POST", body: `{"q":"${MARKER}"}` }] as const],
      ["a binary body", (url: string) => [url, { method: "POST", body: new TextEncoder().encode(`a${MARKER}b`) }] as const],
      ["a form body", (url: string) => [url, { method: "POST", body: new URLSearchParams({ q: MARKER }) }] as const],
      ["a Request object", (url: string) => [new Request(url, { method: "POST", body: MARKER }), undefined] as const],
    ])("blocks a marker in %s before anything is sent, and reports it", async (_, build) => {
      const h = await setup();
      const [input, init] = build(h.url);
      const error = await h.egress.fetch(input, init).then(() => null, (thrown: unknown) => thrown);
      h.close();
      expect(error).toBeInstanceOf(EgressLeak);
      expect((error as EgressLeak).message).not.toContain(MARKER);
      expect(h.leaks).toEqual([{ host: new URL(h.url).host, marker: "canary" }]);
      expect(h.bodies).toEqual([]); // the server saw no request
    });

    it("sends a clean request with its body intact, and still checks the address", async () => {
      const h = await setup();
      const response = await h.egress.fetch(h.url, { method: "POST", body: "weather in Tunis" });
      expect(await response.text()).toBe("weather in Tunis");
      await refusedWith(h.egress.fetch(`http://127.0.0.1:${target.port}/`, { method: "POST", body: "x" }));
      h.close();
      expect(h.leaks).toEqual([]);
    });
  });
});
