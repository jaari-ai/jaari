// The in-process capability host: runs loaded `capability` packages through the contract (ADR-015, ADR-110).
import { receive, type Action, type Advertisement, type CapabilityHost, type Executor, type Result } from "./contract.js";
import { PackageLoadError, type LoadedPackage } from "./loader.js";
import { CAPABILITIES } from "./vocabulary.js";

// After the executor has started, only a read is known to have had no effect. Anything else may have,
// so it is reported as outcome-unknown and never sent again (ADR-016).
const afterStart = (capability: Action["capability"], message: string): Result =>
  CAPABILITIES[capability] === "read" ? { status: "failed", error: message } : { status: "outcome-unknown", detail: message };

export function createInProcessHost(hostId: string, packages: readonly LoadedPackage[]): CapabilityHost {
  const executors = new Map<string, { pkg: LoadedPackage; executor: Executor }>();
  const problems: string[] = [];
  for (const pkg of packages) {
    if (pkg.manifest.kind !== "capability" || !pkg.manifest.hosts.includes("daemon")) continue;
    const executor = (pkg.module as { executor?: Partial<Executor> } | null)?.executor;
    if (typeof executor?.execute !== "function") problems.push(`${pkg.name}: does not export executor.execute`);
    else executors.set(pkg.manifest.id, { pkg, executor: executor as Executor });
  }
  if (problems.length > 0) throw new PackageLoadError(problems);

  const advertisement: Advertisement = {
    hostId,
    host: "daemon",
    packages: [...executors.values()].map(({ pkg: { manifest: m } }) => ({
      id: m.id, version: m.version, provides: m.provides ?? [], ...(m.provider ? { provider: m.provider } : {}),
    })),
  };

  return {
    // A fresh, checked copy each time, like every other message (ADR-110).
    advertise: () => {
      const copy = receive("advertisement", advertisement);
      if (!copy.ok) throw new Error(`invalid advertisement: ${copy.errors.join("; ")}`);
      return copy.value;
    },

    async dispatch(input, signal = new AbortController().signal): Promise<Result> {
      const request = receive("request", input);
      if (!request.ok) return { status: "failed", error: `invalid request: ${request.errors.join("; ")}` };
      const { packageId, action, secrets } = request.value;
      const entry = executors.get(packageId);
      if (!entry) return { status: "failed", error: `no package "${packageId}" on host ${hostId}` };
      if (!entry.pkg.manifest.provides?.includes(action.capability)) {
        return { status: "failed", error: `package "${packageId}" does not provide ${action.capability}` };
      }
      // Fail closed: RFC 3339 times that Date.parse cannot read (a leap second, a "[UTC]" suffix) give NaN.
      if (!(Date.parse(action.expiresAt) > Date.now())) return { status: "failed", error: "action expired" };
      if (signal.aborted) return { status: "failed", error: "aborted before start" };

      // shortcut: secret values are not scrubbed from results yet; exact-value scrubbing ships with @jaari/secrets (0.11).
      let raw: unknown;
      try {
        raw = await entry.executor.execute({ action, secrets, signal });
      } catch (e) {
        return afterStart(action.capability, `executor threw: ${(e as Error)?.message ?? String(e)}`);
      }
      const result = receive("result", raw);
      return result.ok ? result.value : afterStart(action.capability, `invalid result: ${result.errors.join("; ")}`);
    },
  };
}
