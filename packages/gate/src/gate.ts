// The one dispatch entry point for capabilities (ADR-018). Phase 0 is deny-all: read-class
// capabilities run, every other class is refused. Phase 3 replaces the refusal with digests and approvals.
import { CAPABILITIES, createInProcessHost, receive, type DispatchRequest, type LoadedPackage, type Result } from "@jaari/capabilities";

export type Gate = {
  dispatch(request: DispatchRequest, signal?: AbortSignal): Promise<Result>;
};

// The gate builds the host and never hands it out; a lint rule keeps createInProcessHost inside this package.
export function createGate(hostId: string, packages: readonly LoadedPackage[]): Gate {
  const host = createInProcessHost(hostId, packages);
  return {
    async dispatch(input, signal) {
      // Decide on a checked copy and pass that same copy on, so the request cannot change after the check.
      const request = receive("request", input);
      if (!request.ok) return { status: "failed", error: `invalid request: ${request.errors.join("; ")}` };
      const { capability } = request.value.action;
      if (CAPABILITIES[capability] !== "read") return { status: "failed", error: `denied by gate: ${capability} is not a read capability` };
      return host.dispatch(request.value, signal);
    },
  };
}
