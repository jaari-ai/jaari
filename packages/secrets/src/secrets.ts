// secretRef resolution (ADR-007, ADR-013) and exact-value scrubbing (ADR-016). Only executors call resolveRef.

// ADR-013's provider interface. `list` (metadata only) arrives with the vault providers (roadmap 3.3).
export type VaultProvider = {
  resolve(name: string): Promise<string>;
  health(): Promise<{ ok: true } | { ok: false; problem: string }>;
};

// No slash and no leading dot, so a name can never leave a provider's directory (path traversal).
// Providers that build a path from a name check it themselves, not only through parseRef.
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const isSecretName = (name: string): boolean => NAME.test(name);

export function parseRef(ref: string): string {
  const name = ref.startsWith("secretRef:") ? ref.slice("secretRef:".length) : "";
  if (!isSecretName(name)) throw new Error(`not a secretRef name: "${ref}" (vault handles such as bw: and op: arrive in roadmap 3.3)`);
  return name;
}

export const resolveRef = (ref: string, provider: VaultProvider): Promise<string> => provider.resolve(parseRef(ref));

// The forms a secret commonly takes in output (ADR-016 point 6): itself, percent-encoded, hex, and base64 and
// base64url. Base64 turns 3 bytes into 4 characters, so a secret inside a longer run (HTTP Basic auth encodes
// "user:secret") is encoded differently at each of the three byte offsets. For each offset, keep only the
// characters made from the secret's own bits: drop those that also hold bits of the bytes before or after it.
function forms(value: string): string[] {
  const bytes = Buffer.from(value);
  const hex = bytes.toString("hex");
  const out = [value, encodeURIComponent(value), hex, hex.toUpperCase()];
  for (const offset of [0, 1, 2]) {
    const b64 = Buffer.concat([Buffer.alloc(offset), bytes]).toString("base64").replace(/=+$/, "");
    const start = [0, 2, 3][offset]!;
    const end = (offset + bytes.length) % 3 === 0 ? b64.length : b64.length - 1;
    const core = b64.slice(start, end);
    if (core.length >= 4) out.push(core, core.replaceAll("+", "-").replaceAll("/", "_"));
  }
  return [...new Set(out)];
}

// Replaces every secret value, and its common forms, in strings and keys. Each value's positions are marked
// first and every marked run is replaced once, so values that contain or overlap each other leave nothing behind.
export function scrub<T>(value: T, secrets: readonly string[]): T {
  const values = secrets.filter((s) => s.length > 0).flatMap(forms);
  if (values.length === 0) return value;
  const clean = (s: string): string => {
    const hidden = new Uint8Array(s.length);
    let found = false;
    for (const x of values) {
      for (let i = s.indexOf(x); i !== -1; i = s.indexOf(x, i + 1)) {
        hidden.fill(1, i, i + x.length);
        found = true;
      }
    }
    if (!found) return s;
    let out = "";
    for (let i = 0; i < s.length; i++) out += !hidden[i] ? s[i] : i === 0 || !hidden[i - 1] ? "[redacted]" : "";
    return out;
  };
  const walk = (v: unknown): unknown =>
    typeof v === "string" ? clean(v)
    : Array.isArray(v) ? v.map(walk)
    : v !== null && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [walk(k), walk(x)]))
    : v;
  return walk(value) as T;
}
