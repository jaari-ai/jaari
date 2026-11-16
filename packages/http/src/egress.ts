// Resolve, check, dial (ADR-016 point 5, ADR-080) with the `direct` provider: every new connection resolves the
// name itself, classifies each address, and dials only an address that passed. Redirects and IP-literal URLs
// open connections through the same connector, so they are checked too.
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { Agent, buildConnector } from "undici";
import { classify, type AddressClass } from "./address.js";

export type EgressPolicy = {
  // Owner-allowed loopback, this-machine, or private destinations: "127.0.0.1:11434", "192.168.1.0/24",
  // "[::1]:8080", "fd12::/48". Metadata, link-local, and reserved addresses can never be allowed.
  allow?: readonly string[];
  // The daemon's own listening ports, refused on every address that is not public (ADR-016).
  ownPorts?: readonly number[];
};

export type Refusal = { address: string; reason: AddressClass | "own-port" };

export class EgressRefused extends Error {
  constructor(readonly host: string, readonly port: number, readonly refusals: readonly Refusal[]) {
    super(`egress refused: ${host}:${port} (${refusals.map((r) => `${r.address} ${r.reason}`).join(", ") || "no addresses"})`);
    this.name = "EgressRefused";
  }
}

type Rule = { list: BlockList; port: number | null };

// IPv4 as a.b.c.d[/n][:port]; IPv6 as [addr][/n][:port], or bare addr[/n] with no port.
function parseAllow(entry: string): Rule {
  const m =
    /^([\d.]+)(?:\/(\d{1,3}))?(?::(\d{1,5}))?$/.exec(entry) ?? // IPv4
    /^\[([^\]]+)\](?:\/(\d{1,3}))?(?::(\d{1,5}))?$/.exec(entry) ?? // bracketed IPv6, which can take a port
    /^([\da-fA-F:.]+)(?:\/(\d{1,3}))?()$/.exec(entry); // bare IPv6: its own colons rule out a port
  const [, network = "", prefixText, portText] = m ?? [];
  const kind = isIP(network);
  const prefix = prefixText === undefined ? (kind === 6 ? 128 : 32) : Number(prefixText);
  const port = portText ? Number(portText) : null;
  if (!kind || prefix > (kind === 6 ? 128 : 32) || (port !== null && (port < 1 || port > 65_535))) {
    throw new Error(`egress allow entry "${entry}" is not an IP address or CIDR range with an optional port`);
  }
  const list = new BlockList();
  list.addSubnet(network, prefix, kind === 6 ? "ipv6" : "ipv4");
  return { list, port };
}

export function createPolicyCheck(policy: EgressPolicy = {}) {
  const rules = (policy.allow ?? []).map(parseAllow); // a bad entry throws at start, never at request time
  const ownPorts = new Set(policy.ownPorts ?? []);
  const allowed = (address: string, port: number) =>
    rules.some((r) => (r.port === null || r.port === port) && r.list.check(address, isIP(address) === 6 ? "ipv6" : "ipv4"));

  return (raw: string, port: number): Refusal | null => {
    const address = raw.split("%", 1)[0]!;
    const reason = classify(address);
    if (reason === "public") return null;
    if (reason === "metadata" || reason === "link-local" || reason === "reserved") return { address, reason };
    if (ownPorts.has(port)) return { address, reason: "own-port" };
    return allowed(address, port) ? null : { address, reason };
  };
}

export function createEgress(policy: EgressPolicy = {}): { fetch: typeof globalThis.fetch } {
  const check = createPolicyCheck(policy);
  const connect = buildConnector({});

  // Dials the first address that passed. A name may also return refused addresses; they are never dialled.
  async function pick(hostname: string, port: number): Promise<string> {
    const host = hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
    const refusals: Refusal[] = [];
    for (const address of addresses) {
      const refusal = check(address, port);
      if (refusal === null) return address;
      refusals.push(refusal);
    }
    throw new EgressRefused(host, port, refusals);
  }

  const agent = new Agent({
    connect(opts, callback) {
      const port = Number(opts.port) || (opts.protocol === "https:" ? 443 : 80);
      const host = opts.hostname.replace(/^\[|\]$/g, "");
      pick(opts.hostname, port).then(
        // TLS still checks the certificate against the name, not the address dialled.
        // shortcut: no fallback to the next checked address when the first one fails to connect; add with the pool (Phase 6).
        (address) => connect({ ...opts, hostname: address, servername: opts.servername ?? (isIP(host) ? undefined : host) }, callback),
        (error: Error) => callback(error, null),
      );
    },
  });

  return {
    // The caller's init cannot replace the dispatcher, so it cannot dial around the check.
    fetch: ((input, init) => globalThis.fetch(input, { ...init, dispatcher: agent } as RequestInit)) as typeof globalThis.fetch,
  };
}
