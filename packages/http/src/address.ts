// The one address-class table (ADR-016): the HTTP client, the browser, and sandboxes all classify with it.
// Ranges are from the IANA IPv4 and IPv6 special-purpose address registries (RFC 6890 and its updates).
import { BlockList, isIP } from "node:net";
import { networkInterfaces } from "node:os";

export type AddressClass = "metadata" | "loopback" | "link-local" | "reserved" | "this-machine" | "private" | "public";

const family = (address: string) => (isIP(address) === 6 ? "ipv6" : "ipv4");
const ranges = (entries: [string, number][]) => {
  const list = new BlockList();
  for (const [network, prefix] of entries) list.addSubnet(network, prefix, family(network));
  return list;
};

// AWS, Azure, GCP, and Oracle answer on 169.254.169.254, AWS on IPv6 too, Alibaba on 100.100.100.200.
const METADATA = new BlockList();
for (const address of ["169.254.169.254", "fd00:ec2::254", "100.100.100.200"]) METADATA.addAddress(address, family(address));
const LOOPBACK = ranges([["127.0.0.0", 8], ["::1", 128]]);
const LINK_LOCAL = ranges([["169.254.0.0", 16], ["fe80::", 10]]);
const RESERVED = ranges([
  ["0.0.0.0", 8], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
  // ::/96 holds the unspecified address and the old IPv4-compatible form; local NAT64, Teredo, and ORCHID
  // carry addresses a translator may route without checking.
  ["::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 32], ["2001:2::", 48], ["2001:10::", 28],
  ["2001:20::", 28], ["2001:db8::", 32], ["fec0::", 10], ["ff00::", 8],
]);
// 100.64.0.0/10 is carrier-grade NAT, and also where Tailscale puts the owner's overlay.
const PRIVATE = ranges([["10.0.0.0", 8], ["100.64.0.0", 10], ["172.16.0.0", 12], ["192.168.0.0", 16], ["fc00::", 7]]);

// IPv6 forms that stand for an IPv4 address, with the index of the two groups that hold it.
const WRAPPERS: [BlockList, number][] = [
  [ranges([["::ffff:0:0", 96]]), 6], // IPv4-mapped
  [ranges([["64:ff9b::", 96]]), 6], // NAT64
  [ranges([["2002::", 16]]), 1], // 6to4
];

// The URL parser writes IPv6 in hex groups only (no dotted IPv4 tail), so only "::" needs expanding.
function groups(address: string): number[] {
  const [head = "", tail] = new URL(`http://[${address}]`).hostname.slice(1, -1).split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const zeros = tail === undefined ? [] : Array<string>(8 - left.length - right.length).fill("0");
  return [...left, ...zeros, ...right].map((g) => Number.parseInt(g, 16));
}

function embeddedIPv4(address: string): string | undefined {
  const at = WRAPPERS.find(([list]) => list.check(address, "ipv6"))?.[1];
  if (at === undefined) return undefined;
  const g = groups(address);
  return [g[at]! >> 8, g[at]! & 0xff, g[at + 1]! >> 8, g[at + 1]! & 0xff].join(".");
}

// Read on every call: a laptop's interfaces change when it moves between networks.
function ownAddresses(): BlockList {
  const own = new BlockList();
  for (const entry of Object.values(networkInterfaces()).flat()) {
    if (entry) own.addAddress(entry.address.split("%", 1)[0]!, entry.family === "IPv6" ? "ipv6" : "ipv4");
  }
  return own;
}

export function classify(raw: string, own: BlockList = ownAddresses()): AddressClass {
  const address = raw.split("%", 1)[0]!; // drop an IPv6 zone such as %eth0
  if (isIP(address) === 0) return "reserved"; // not an address: fail closed
  const type = family(address);
  const inner = type === "ipv6" ? embeddedIPv4(address) : undefined;
  if (inner !== undefined) return classify(inner, own);
  if (METADATA.check(address, type)) return "metadata";
  if (LOOPBACK.check(address, type)) return "loopback";
  if (LINK_LOCAL.check(address, type)) return "link-local";
  if (RESERVED.check(address, type)) return "reserved";
  if (own.check(address, type)) return "this-machine";
  if (PRIVATE.check(address, type)) return "private";
  return "public";
}
