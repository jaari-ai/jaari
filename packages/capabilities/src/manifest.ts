// The `jaari` manifest in a package's package.json (ADR-071, ADR-084), checked before any package code runs.
import { Type, type Static } from "typebox";
import { Compile } from "typebox/compile";
import { CAPABILITY_NAMES } from "./vocabulary.js";

// Package kinds named in ADR-071 and ADR-077 (ADR-108). An unknown kind fails closed.
export const PACKAGE_KINDS = [
  "capability",
  "channel",
  "browser-adapter",
  "fetch-rung",
  "egress-provider",
  "mailbox-provider",
  "vault-provider",
  "cli-engine",
] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];

const closed = { additionalProperties: false } as const;
const SEMVER = "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(-[0-9A-Za-z.-]+)?(\\+[0-9A-Za-z.-]+)?$";
const list = <T extends Parameters<typeof Type.Array>[0]>(item: T) => Type.Array(item, { uniqueItems: true });

const ChannelSection = Type.Object(
  {
    capabilities: Type.Object(
      {
        text: Type.Literal(true),
        media: Type.Optional(Type.Boolean()),
        reactions: Type.Optional(Type.Boolean()),
        typing: Type.Optional(Type.Boolean()),
        groups: Type.Optional(Type.Boolean()),
        readReceipts: Type.Optional(Type.Boolean()),
        edits: Type.Optional(Type.Boolean()),
        deletes: Type.Optional(Type.Boolean()),
      },
      closed,
    ),
    identity: Type.Enum(["carrier", "account", "device", "none"]),
    prompts: Type.Enum(["buttons", "quickReplies", "text"]),
    maxMessageChars: Type.Integer({ minimum: 1 }),
  },
  closed,
);

const Sidecar = Type.Union([
  Type.Object({ name: Type.String({ minLength: 1 }), image: Type.String({ pattern: "@sha256:[0-9a-f]{64}$" }), sbom: Type.String({ minLength: 1 }) }, closed),
  Type.Object(
    { name: Type.String({ minLength: 1 }), sha256: Type.String({ pattern: "^[0-9a-f]{64}$" }), size: Type.Integer({ minimum: 1 }), sbom: Type.String({ minLength: 1 }) },
    closed,
  ),
]);

export const ManifestSchema = Type.Object(
  {
    id: Type.String({ pattern: "^[a-z][a-z0-9-]{0,63}$" }),
    version: Type.String({ pattern: SEMVER }),
    kind: Type.Enum(PACKAGE_KINDS),
    interfaceVersion: Type.Integer({ minimum: 1 }),
    minJaari: Type.String({ pattern: SEMVER }),
    provides: Type.Optional(list(Type.Enum(CAPABILITY_NAMES))),
    hosts: Type.Array(Type.Enum(["daemon", "node"]), { minItems: 1, uniqueItems: true }),
    provider: Type.Optional(Type.String({ pattern: "^[a-z][a-z0-9-]*$" })),
    // Node's process.platform and process.arch values.
    platforms: Type.Optional(Type.Object({ os: Type.Optional(list(Type.String({ minLength: 1 }))), cpu: Type.Optional(list(Type.String({ minLength: 1 }))) }, closed)),
    permissions: Type.Optional(list(Type.String({ pattern: "^[a-z][a-z0-9-]*$" }))),
    sidecars: Type.Optional(Type.Array(Sidecar)),
    // Exact lowercase hostnames: no scheme, port, IP literal, or wildcard (the @jaari/http allowlist).
    egress: Type.Optional(list(Type.String({ pattern: "^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$" }))),
    secrets: Type.Optional(list(Type.String({ pattern: "^[a-z0-9]+([._-][a-z0-9]+)*$" }))),
    channel: Type.Optional(ChannelSection),
  },
  closed,
);

export type Manifest = Static<typeof ManifestSchema>;

export type ManifestResult = { ok: true; manifest: Manifest } | { ok: false; errors: string[] };

const validator = Compile(ManifestSchema);

// Validates untrusted JSON; never throws on bad input.
export function parseManifest(value: unknown): ManifestResult {
  if (!validator.Check(value)) {
    return { ok: false, errors: validator.Errors(value).map((e) => `${e.instancePath || "/"}: ${e.message}`) };
  }
  // A kind section is required for its kind and refused for any other (ADR-084).
  if ((value.kind === "channel") !== (value.channel !== undefined)) {
    return { ok: false, errors: [`/channel: required when kind is "channel" and refused otherwise`] };
  }
  return { ok: true, manifest: value };
}
