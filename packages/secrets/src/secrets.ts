// secretRef resolution (ADR-007, ADR-013) and exact-value scrubbing (ADR-016). Only executors call resolveRef.

// ADR-013's provider interface. `list` (metadata only) arrives with the vault providers (roadmap 3.3).
export type VaultProvider = {
  resolve(name: string): Promise<string>;
  health(): Promise<{ ok: true } | { ok: false; problem: string }>;
};

// No slash and no leading dot, so a name can never leave a provider's directory (path traversal).
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function parseRef(ref: string): string {
  const name = ref.startsWith("secretRef:") ? ref.slice("secretRef:".length) : "";
  if (!NAME.test(name)) throw new Error(`not a secretRef name: "${ref}" (vault handles such as bw: and op: arrive in roadmap 3.3)`);
  return name;
}

export const resolveRef = (ref: string, provider: VaultProvider): Promise<string> => provider.resolve(parseRef(ref));

// Replaces every exact secret value in strings and keys. Longest first, so no part of a longer value survives.
export function scrub<T>(value: T, secrets: readonly string[]): T {
  const values = secrets.filter((s) => s.length > 0).sort((a, b) => b.length - a.length);
  if (values.length === 0) return value;
  const walk = (v: unknown): unknown =>
    typeof v === "string" ? values.reduce((s, x) => s.replaceAll(x, "[redacted]"), v)
    : Array.isArray(v) ? v.map(walk)
    : v !== null && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [walk(k), walk(x)]))
    : v;
  return walk(value) as T;
}
