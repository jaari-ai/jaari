// Checks a release before `jaari update` installs it (ADR-056, ADR-124): the tarball is the one the registry lists,
// the npm registry signed it, and its provenance says that this repository's release workflow built it from the tag of
// this version. Offline: the Sigstore roots and the npm keys come from the `@sigstore/tuf` package, not the network.
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { createRequire } from "node:module";
import { bundleFromJSON } from "@sigstore/bundle";
import { TrustedRoot } from "@sigstore/protobuf-specs";
import { toSignedEntity, toTrustMaterial, Verifier } from "@sigstore/verify";

export const PACKAGE = "jaari";
const REPOSITORY = "https://github.com/jaari-ai/jaari";
const WORKFLOW = ".github/workflows/release.yml";
const ISSUER = "https://token.actions.githubusercontent.com";
const PROVENANCE = "https://slsa.dev/provenance/v1";
const PUBLISH = "https://github.com/npm/attestation/tree/main/specs/publish/v0.1";
export const VERSION_FORMAT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export type Dist = { tarball: string; integrity: string; signatures?: { keyid: string; sig: string }[]; attestations?: { url: string } };
export type Attestation = { predicateType: string; bundle: unknown };

// One line an owner can act on; the update stops and nothing is installed.
export class VerifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerifyError";
  }
}

type NpmKey = { keyId: string; keyUsage: string; publicKey: { rawBytes: string; validFor?: { start?: string; end?: string } } };
type Seeds = Record<string, { targets: Record<string, string> }>;
const targets = (createRequire(import.meta.url)("@sigstore/tuf/seeds.json") as Seeds)["https://tuf-repo-cdn.sigstore.dev"]!.targets;
const seed = (name: string) => JSON.parse(Buffer.from(targets[name]!, "base64").toString("utf8")) as unknown;
const npmKeys = (seed("registry.npmjs.org%2Fkeys.json") as { keys: NpmKey[] }).keys;
const keyObject = (key: NpmKey) => createPublicKey({ key: Buffer.from(key.publicKey.rawBytes, "base64"), format: "der", type: "spki" });
const validAt = (key: NpmKey, date: Date) =>
  (!key.publicKey.validFor?.start || date >= new Date(key.publicKey.validFor.start)) && (!key.publicKey.validFor?.end || date <= new Date(key.publicKey.validFor.end));

// The npm keys sign the "publish" attestation; the provenance carries its own certificate, checked against the roots.
const verifier = new Verifier(
  toTrustMaterial(TrustedRoot.fromJSON(seed("trusted_root.json")), (hint) => {
    const key = npmKeys.find((candidate) => candidate.keyId === hint && candidate.keyUsage === "npm:attestations");
    if (!key) throw new Error(`no npm attestation key ${hint}`);
    return { publicKey: keyObject(key), validFor: (date) => validAt(key, date) };
  }),
);

type Statement = { predicateType?: string; subject?: { name?: string; digest?: { sha512?: string } }[]; predicate?: { buildDefinition?: { resolvedDependencies?: { digest?: { gitCommit?: string } }[] } } };

// Verifies one attestation and returns its statement, which must name this package version and this tarball.
function attested(attestations: Attestation[], type: string, version: string, sha512: Buffer, identity?: RegExp): Statement {
  const found = attestations.filter((attestation) => attestation.predicateType === type);
  if (found.length !== 1) throw new VerifyError(`the registry lists ${found.length} attestations of type ${type}, not one`);
  let statement: Statement;
  try {
    const bundle = bundleFromJSON(found[0]!.bundle);
    verifier.verify(toSignedEntity(bundle), identity ? { subjectAlternativeName: identity, extensions: { issuer: ISSUER } } : undefined);
    const envelope = bundle.content.$case === "dsseEnvelope" ? bundle.content.dsseEnvelope : undefined;
    if (envelope?.payloadType !== "application/vnd.in-toto+json") throw new Error("it is not an in-toto statement");
    statement = JSON.parse(envelope.payload.toString("utf8")) as Statement;
  } catch (error) {
    throw new VerifyError(`the attestation ${type} does not verify: ${(error as Error).message}`);
  }
  const subject = statement.subject ?? [];
  if (statement.predicateType !== type || subject.length !== 1 || subject[0]!.name !== `pkg:npm/${PACKAGE}@${version}` || subject[0]!.digest?.sha512 !== sha512.toString("hex")) {
    throw new VerifyError(`the attestation ${type} is for another package, version, or file`);
  }
  return statement;
}

// Exactly this repository's release workflow, at the tag of this version: a fork, another workflow, a branch, or
// another tag does not pass.
export const identityFor = (version: string): RegExp => new RegExp(`^${`${REPOSITORY}/${WORKFLOW}@refs/tags/v${version}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

// `sha512` is the digest of the downloaded tarball. Returns the commit the release was built from.
export function checkRelease(version: string, dist: Dist, attestations: Attestation[], sha512: Buffer, now = new Date()): { commit: string } {
  if (!VERSION_FORMAT.test(version)) throw new VerifyError(`${JSON.stringify(version)} is not a version`);
  if (dist.integrity !== `sha512-${sha512.toString("base64")}`) throw new VerifyError("the downloaded file is not the one the registry lists (checksum mismatch)");

  // The registry's signature over "name@version:integrity", with a key that npm published for signatures.
  const signed = (dist.signatures ?? []).some(({ keyid, sig }) => {
    const key = npmKeys.find((candidate) => candidate.keyId === keyid && candidate.keyUsage === "npm:signatures" && validAt(candidate, now));
    return key !== undefined && verifySignature("sha256", Buffer.from(`${PACKAGE}@${version}:${dist.integrity}`), keyObject(key), Buffer.from(sig, "base64"));
  });
  if (!signed) throw new VerifyError("the npm registry signature is missing or does not verify; if npm changed its keys, install a newer Jaari by hand");

  attested(attestations, PUBLISH, version, sha512);
  const provenance = attested(attestations, PROVENANCE, version, sha512, identityFor(version));
  return { commit: provenance.predicate?.buildDefinition?.resolvedDependencies?.[0]?.digest?.gitCommit ?? "unknown" };
}

export const verifyRelease = (version: string, dist: Dist, attestations: Attestation[], tarball: Uint8Array, now?: Date) =>
  checkRelease(version, dist, attestations, createHash("sha512").update(tarball).digest(), now);
