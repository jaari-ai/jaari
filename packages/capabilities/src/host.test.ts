import { describe, expect, it, vi } from "vitest";
import type { DispatchRequest, Executor } from "./contract.js";
import { createInProcessHost } from "./host.js";
import { PackageLoadError, type LoadedPackage } from "./loader.js";
import type { Manifest } from "./manifest.js";

const later = () => new Date(Date.now() + 60_000).toISOString();
const pkg = (id: string, module: unknown, extra: Partial<Manifest> = {}): LoadedPackage => ({
  name: `@jaari/${id}`,
  module,
  manifest: { id, version: "0.1.0", kind: "capability", interfaceVersion: 1, minJaari: "0.1.0", hosts: ["daemon"], provides: ["files.read", "files.write"], secrets: ["token"], ...extra },
});
const request = (over: Partial<DispatchRequest> = {}, action: Partial<DispatchRequest["action"]> = {}): DispatchRequest => ({
  actionId: "a1", packageId: "files", secrets: {},
  action: { capability: "files.read", target: "/notes.md", params: {}, expiresAt: later(), ...action },
  ...over,
});
const hostWith = (execute: Executor["execute"]) => {
  const spy = vi.fn(execute);
  return { host: createInProcessHost("daemon-1", [pkg("files", { executor: { execute: spy } })]), spy };
};

describe("createInProcessHost", () => {
  it("advertises capability packages for the daemon only", () => {
    const host = createInProcessHost("daemon-1", [
      pkg("files", { executor: { execute: async () => ({ status: "ok" }) } }, { provider: "local" }),
      pkg("desktop", {}, { hosts: ["node"] }),
      pkg("cli", {}, { kind: "channel" }),
    ]);
    expect(host.advertise()).toEqual({
      hostId: "daemon-1", host: "daemon",
      packages: [{ id: "files", version: "0.1.0", provides: ["files.read", "files.write"], provider: "local" }],
    });
  });

  it("returns a copy of the advertisement, so a caller cannot change it", () => {
    const host = createInProcessHost("daemon-1", [pkg("files", { executor: { execute: async () => ({ status: "ok" }) } })]);
    host.advertise().packages.length = 0;
    expect(host.advertise().packages).toHaveLength(1);
  });

  it("refuses a capability package without an executor", () => {
    expect(() => createInProcessHost("d", [pkg("files", { default: {} })])).toThrow(PackageLoadError);
  });
});

describe("dispatch", () => {
  it("runs the executor with JSON copies of the action and secrets, and returns JSON", async () => {
    const { host, spy } = hostWith(async ({ action, secrets }) => ({
      status: "ok", output: { target: action.target, token: secrets.token, at: new Date(0), fn: () => 1 },
    }));
    const result = await host.dispatch(request({ secrets: { token: "tok-123" } }));
    expect(result).toEqual({ status: "ok", output: { target: "/notes.md", token: "[redacted]", at: "1970-01-01T00:00:00.000Z" } });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0].secrets).toEqual({ token: "tok-123" }); // the executor itself sees the value
  });

  it.each([
    ["a thrown error", async () => { throw new Error("bad token tok-123"); }, { status: "failed", error: "executor threw: bad token [redacted]" }],
    ["a failed result", async () => ({ status: "failed" as const, error: "denied for tok-123" }), { status: "failed", error: "denied for [redacted]" }],
  ])("scrubs secret values from %s", async (_, execute, expected) => {
    const { host } = hostWith(execute);
    expect(await host.dispatch(request({ secrets: { token: "tok-123" } }))).toEqual(expected);
  });

  it.each([
    ["an unknown capability", request({}, { capability: "files.hack" as never }), "invalid request"],
    ["an extra field", { ...request(), trusted: true } as DispatchRequest, "invalid request"],
    ["an expiry that is not a date-time", request({}, { expiresAt: "tomorrow" }), "invalid request"],
    ["an unknown package", request({ packageId: "nope" }), 'no package "nope"'],
    ["a capability the package does not provide", request({}, { capability: "shell" }), "does not provide shell"],
    ["a secret the manifest does not declare", request({ secrets: { token: "t", "telegram.token": "x" } }), "undeclared secrets: telegram.token"],
    ["an expired action", request({}, { expiresAt: new Date(Date.now() - 1).toISOString() }), "action expired"],
    // Valid RFC 3339 that Date.parse cannot read: it must count as expired, not as never expiring.
    ["an expiry with a time-zone suffix", request({}, { expiresAt: "2099-01-01T00:00:00Z[UTC]" }), "action expired"],
    ["an expiry on a leap second", request({}, { expiresAt: "2099-12-31T23:59:60Z" }), "action expired"],
  ])("refuses %s without running the executor", async (_, req, error) => {
    const { host, spy } = hostWith(async () => ({ status: "ok" }));
    const result = await host.dispatch(req);
    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.error).toContain(error);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not start an aborted action", async () => {
    const { host, spy } = hostWith(async () => ({ status: "ok" }));
    expect(await host.dispatch(request(), AbortSignal.abort())).toEqual({ status: "failed", error: "aborted before start" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("passes the signal so the executor can stop", async () => {
    const controller = new AbortController();
    const { host } = hostWith(({ signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("stopped")))));
    const pending = host.dispatch(request({}, { capability: "files.write" }), controller.signal);
    controller.abort();
    expect(await pending).toEqual({ status: "outcome-unknown", detail: "executor threw: stopped" });
  });

  it.each([
    ["a read", "files.read", "failed"],
    ["a gated action", "files.write", "outcome-unknown"],
  ] as const)("reports a throw during %s as %s", async (_, capability, status) => {
    const { host } = hostWith(async () => { throw new Error("disk gone"); });
    expect((await host.dispatch(request({}, { capability }))).status).toBe(status);
  });

  it.each([
    ["a read", "files.read", "failed"],
    ["a gated action", "files.write", "outcome-unknown"],
  ] as const)("reports an invalid result from %s as %s", async (_, capability, status) => {
    const { host } = hostWith(async () => ({ status: "done" }) as never);
    expect((await host.dispatch(request({}, { capability }))).status).toBe(status);
  });
});
