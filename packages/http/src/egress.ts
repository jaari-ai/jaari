// Resolve, check, dial (ADR-016 point 5, ADR-080) with the `direct` provider: every new connection resolves the
// name itself, classifies each address, and dials only an address that passed. Redirects and IP-literal URLs
// open connections through the same connector, so they are checked too.
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { Agent, buildConnector } from "undici";
import { classify, type AddressClass } from "./address.js";

export type EgressPolicy = {
  // Owner-allowed loopback, this-machine, or private destinations: "127.0.0.1:11434", "192.168.1.0/24",
  // "[::1]:8080", "fd12::/48", or a name with its port, "ollama:11434" (a Compose service, whose address
  // changes on each start; ADR-080). Metadata, link-local, and reserved addresses can never be allowed.
  allow?: readonly string[];
  // The daemon's own listening ports, refused on every address that is not public (ADR-016).
  ownPorts?: readonly number[];
  // Names what must not leave in this text, if anything: the canary or the session fence id (ADR-104). It gets
  // the URL, the headers, and the body of every request. Model calls use an egress without it, because the prompt
  // that goes to the provider holds both (ADR-120).
  scan?: (text: string) => string | undefined;
  onLeak?: (hit: { host: string; marker: string }) => void; // the audit row and the owner's alert, written by the host
};

export type Refusal = { address: string; reason: AddressClass | "own-port" };

export class EgressRefused extends Error {
  constructor(readonly host: string, readonly port: number, readonly refusals: readonly Refusal[]) {
    super(`egress refused: ${host}:${port} (${refusals.map((r) => `${r.address} ${r.reason}`).join(", ") || "no addresses"})`);
    this.name = "EgressRefused";
  }
}

export class EgressLeak extends Error {
  constructor(readonly host: string, readonly marker: string) {
    super(`egress refused: the request to ${host} carried an internal marker (${marker})`);
    this.name = "EgressLeak";
  }
}

const aborted = (signal: AbortSignal) =>
  new Promise<never>((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });

type Rule = { list: BlockList; port: number | null } | { name: string };

// A DNS name with at least one letter (so "1.2.3:80" is not one), and a required port.
const NAME_ENTRY = /^((?=[^:]*[a-z])[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)*):(\d{1,5})$/i;

// IPv4 as a.b.c.d[/n][:port]; IPv6 as [addr][/n][:port], or bare addr[/n] with no port; or name:port.
function parseAllow(entry: string): Rule {
  const named = NAME_ENTRY.exec(entry);
  if (named && Number(named[2]) >= 1 && Number(named[2]) <= 65_535) return { name: `${named[1]!.toLowerCase()}:${Number(named[2])}` };
  const m =
    /^([\d.]+)(?:\/(\d{1,3}))?(?::(\d{1,5}))?$/.exec(entry) ?? // IPv4
    /^\[([^\]]+)\](?:\/(\d{1,3}))?(?::(\d{1,5}))?$/.exec(entry) ?? // bracketed IPv6, which can take a port
    /^([\da-fA-F:.]+)(?:\/(\d{1,3}))?()$/.exec(entry); // bare IPv6: its own colons rule out a port
  const [, network = "", prefixText, portText] = m ?? [];
  const kind = isIP(network);
  const prefix = prefixText === undefined ? (kind === 6 ? 128 : 32) : Number(prefixText);
  const port = portText ? Number(portText) : null;
  if (!kind || prefix > (kind === 6 ? 128 : 32) || (port !== null && (port < 1 || port > 65_535))) {
    throw new Error(`egress allow entry "${entry}" is not an IP address or CIDR range with an optional port, or a name with a port`);
  }
  const list = new BlockList();
  list.addSubnet(network, prefix, kind === 6 ? "ipv6" : "ipv4");
  return { list, port };
}

export function createPolicyCheck(policy: EgressPolicy = {}) {
  const rules = (policy.allow ?? []).map(parseAllow); // a bad entry throws at start, never at request time
  const ownPorts = new Set(policy.ownPorts ?? []);
  // `host` is the name the connection was opened for; URLs give it in lower case.
  const allowed = (address: string, port: number, host: string) =>
    rules.some((r) => "name" in r
      ? r.name === `${host}:${port}`
      : (r.port === null || r.port === port) && r.list.check(address, isIP(address) === 6 ? "ipv6" : "ipv4"));

  return (raw: string, port: number, host = ""): Refusal | null => {
    const address = raw.split("%", 1)[0]!;
    const reason = classify(address);
    if (reason === "public") return null;
    if (reason === "metadata" || reason === "link-local" || reason === "reserved") return { address, reason };
    if (ownPorts.has(port)) return { address, reason: "own-port" };
    return allowed(address, port, host) ? null : { address, reason };
  };
}

export function createEgress(policy: EgressPolicy = {}): { fetch: typeof globalThis.fetch } {
  const check = createPolicyCheck(policy);
  const connect = buildConnector({});

  // The addresses that passed, in resolver order. A name may also return refused addresses; they are never dialled.
  async function pick(host: string, port: number): Promise<string[]> {
    const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
    const refusals = addresses.map((address) => check(address, port, host));
    const passed = addresses.filter((_, i) => refusals[i] === null);
    if (passed.length === 0) throw new EgressRefused(host, port, refusals.filter((r) => r !== null));
    return passed;
  }

  const agent = new Agent({
    connect(opts, callback) {
      const port = Number(opts.port) || (opts.protocol === "https:" ? 443 : 80);
      const host = opts.hostname.replace(/^\[|\]$/g, "");
      // TLS still checks the certificate against the name, not the address dialled.
      const servername = opts.servername ?? (isIP(host) ? undefined : host);
      // Try each checked address until one connects: `localhost` gives ::1 first on many systems, while a local
      // server such as Ollama listens on 127.0.0.1 only.
      const dial = (addresses: string[]): void =>
        connect({ ...opts, hostname: addresses[0]!, servername }, (error, socket) => {
          if (error && addresses.length > 1) dial(addresses.slice(1));
          else if (error) callback(error, null);
          else callback(null, socket);
        });
      pick(host, port).then(dial, (error: Error) => callback(error, null));
    },
  });

  // The caller's init cannot replace the dispatcher, so it cannot dial around the check.
  const send: typeof globalThis.fetch = (input, init) => globalThis.fetch(input, { ...init, dispatcher: agent } as RequestInit);
  const { scan } = policy;
  if (!scan) return { fetch: send };
  return {
    // Before any connection opens: a request that carries a marker never reaches DNS or the network.
    // shortcut: the body is read into memory once more for the scan, stream it when a tool uploads large files (roadmap 4.x)
    async fetch(input, init) {
      const request = new Request(input, init);
      // The read stops when the caller aborts, as the unscanned fetch would.
      const body = request.body ? await Promise.race([request.clone().text(), aborted(request.signal)]) : "";
      const marker = scan([request.url, ...[...request.headers].map(([name, value]) => `${name}: ${value}`), body].join("\n"));
      if (!marker) return send(request);
      // The host name itself may carry the marker, and the host goes to the log and into the error.
      const { host: name } = new URL(request.url);
      const host = scan(name) ? "(a host name that carries the marker)" : name;
      policy.onLeak?.({ host, marker });
      throw new EgressLeak(host, marker);
    },
  };
}
