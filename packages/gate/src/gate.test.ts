import { describe, expect, it, vi } from "vitest";
import type { DispatchRequest, LoadedPackage } from "@jaari/capabilities";
import { createGate } from "./gate.js";

const execute = vi.fn(async () => ({ status: "ok" as const }));
const pkg: LoadedPackage = {
  name: "@jaari/test",
  module: { executor: { execute } },
  manifest: { id: "test", version: "0.1.0", kind: "capability", interfaceVersion: 1, minJaari: "0.1.0", hosts: ["daemon"], provides: ["files.read", "files.write", "takeover.request"] },
};
const request = (capability: DispatchRequest["action"]["capability"]): DispatchRequest => ({
  actionId: "a1", packageId: "test", secrets: {},
  action: { capability, target: "/notes.md", params: {}, expiresAt: new Date(Date.now() + 60_000).toISOString() },
});

describe("deny-all gate", () => {
  it("runs a read-class capability", async () => {
    execute.mockClear();
    expect(await createGate("d", [pkg]).dispatch(request("files.read"))).toEqual({ status: "ok" });
    expect(execute).toHaveBeenCalledOnce();
  });

  it.each(["files.write", "takeover.request"] as const)("refuses %s without starting the executor", async (capability) => {
    execute.mockClear();
    const result = await createGate("d", [pkg]).dispatch(request(capability));
    expect(result).toEqual({ status: "failed", error: `denied by gate: ${capability} is not a read capability` });
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses an invalid request before it reaches the host", async () => {
    const result = await createGate("d", [pkg]).dispatch({ ...request("files.read"), action: { capability: "toString" } } as never);
    expect(result).toMatchObject({ status: "failed", error: expect.stringContaining("invalid request") });
  });

  it("decides on a copy, so a request cannot change after the check", async () => {
    execute.mockClear();
    let reads = 0;
    const tricky = request("files.read");
    // First read says files.read, every later read says files.write.
    Object.defineProperty(tricky.action, "capability", { enumerable: true, get: () => (reads++ === 0 ? "files.read" : "files.write") });
    await createGate("d", [pkg]).dispatch(tricky);
    expect(execute.mock.calls[0]).toMatchObject([{ action: { capability: "files.read" } }]);
  });
});
