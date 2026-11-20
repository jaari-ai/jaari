import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkRelease, identityFor, verifyRelease, VerifyError, type Attestation, type Dist } from "./verify.js";

// What npm and Sigstore really issued for jaari@0.1.0-beta.1, so a pass here is a pass against the real thing.
const real = JSON.parse(await readFile(join(import.meta.dirname, "fixtures/jaari-0.1.0-beta.1.json"), "utf8")) as { version: string; dist: Dist; attestations: Attestation[] };
const sha512 = Buffer.from(real.dist.integrity.slice("sha512-".length), "base64");
const copy = <T>(value: T): T => structuredClone(value);
const refused = (run: () => unknown, text: string) => {
  expect(run).toThrow(VerifyError);
  expect(run).toThrow(text);
};
type Bundle = { dsseEnvelope: { payload: string; signatures: { sig: string }[] } };
const bundleOf = (attestations: Attestation[], type: string) => attestations.find((attestation) => attestation.predicateType.includes(type))!.bundle as Bundle;

describe("release verification (ADR-056, ADR-124)", () => {
  it("accepts the published release and names the commit it was built from", () => {
    expect(checkRelease(real.version, real.dist, real.attestations, sha512)).toEqual({ commit: "46acb3db6c8406039ef547bbb7fc3512d7c1b9e2" });
  });

  it("refuses a file that is not the one the registry lists", () => {
    refused(() => verifyRelease(real.version, real.dist, real.attestations, Buffer.from("another tarball")), "checksum mismatch");
  });

  it("refuses a registry entry whose checksum was replaced: the signature and the attestations cover the old one", () => {
    const other = Buffer.alloc(64, 7);
    const dist = { ...real.dist, integrity: `sha512-${other.toString("base64")}` };
    refused(() => checkRelease(real.version, dist, real.attestations, other), "registry signature");
    // Even with a registry signature removed from the picture, the attestations name the real file.
    refused(() => checkRelease(real.version, { ...real.dist, signatures: [] }, real.attestations, sha512), "registry signature");
  });

  it("refuses another version's attestations, a missing one, and a doubled one", () => {
    refused(() => checkRelease("0.1.0-beta.2", real.dist, real.attestations, sha512), "registry signature"); // the signature names the version
    refused(() => checkRelease(real.version, real.dist, real.attestations.filter((a) => !a.predicateType.includes("slsa")), sha512), "0 attestations of type https://slsa.dev");
    refused(() => checkRelease(real.version, real.dist, real.attestations.filter((a) => a.predicateType.includes("slsa")), sha512), "0 attestations of type https://github.com/npm");
    refused(() => checkRelease(real.version, real.dist, [...real.attestations, real.attestations[1]!], sha512), "2 attestations");
  });

  it("refuses a provenance whose statement or signature was changed", () => {
    const edited = copy(real.attestations);
    const bundle = bundleOf(edited, "slsa");
    const statement = JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, "base64").toString()) as { subject: { digest: { sha512: string } }[] };
    statement.subject[0]!.digest.sha512 = "0".repeat(128);
    bundle.dsseEnvelope.payload = Buffer.from(JSON.stringify(statement)).toString("base64");
    refused(() => checkRelease(real.version, real.dist, edited, sha512), "does not verify");

    const resigned = copy(real.attestations);
    const signature = Buffer.from(bundleOf(resigned, "slsa").dsseEnvelope.signatures[0]!.sig, "base64");
    signature[signature.length - 1]! ^= 1;
    bundleOf(resigned, "slsa").dsseEnvelope.signatures[0]!.sig = signature.toString("base64");
    refused(() => checkRelease(real.version, real.dist, resigned, sha512), "does not verify");

    // The publish attestation in the provenance's place: signed by npm, but it is no proof of who built the file.
    const swapped = copy(real.attestations);
    swapped[1]!.bundle = swapped[0]!.bundle;
    refused(() => checkRelease(real.version, real.dist, swapped, sha512), "does not verify");
  });

  it("accepts only the release workflow of this repository at the tag of the version", () => {
    const pattern = identityFor("0.1.0-beta.1");
    expect(pattern.test("https://github.com/jaari-ai/jaari/.github/workflows/release.yml@refs/tags/v0.1.0-beta.1")).toBe(true);
    for (const other of [
      "https://github.com/jaari-ai/jaari/.github/workflows/ci.yml@refs/tags/v0.1.0-beta.1", // another workflow
      "https://github.com/jaari-ai/jaari/.github/workflows/release.yml@refs/heads/main", // a branch
      "https://github.com/jaari-ai/jaari/.github/workflows/release.yml@refs/tags/v0.1.0-beta.10", // another tag
      "https://github.com/jaari-ai/jaari/.github/workflows/release.yml@refs/tags/v0.1.0-beta.1x",
      "https://github.com/jaari-ai/jaari-fork/.github/workflows/release.yml@refs/tags/v0.1.0-beta.1", // a fork's name
      "https://github.com/someone/jaari/.github/workflows/release.yml@refs/tags/v0.1.0-beta.1", // a fork
      "https://github.com/jaari-ai/jaari/.github/workflows/release.yml@refs/tags/v0.1.0-beta.1/extra",
      "x https://github.com/jaari-ai/jaari/.github/workflows/release.yml@refs/tags/v0.1.0-beta.1",
      "https://github.com/jaari-ai/jaari/.github/workflows/release.yml@refs/tags/v0x1x0-beta.1", // dots are not wildcards
    ]) expect(pattern.test(other), other).toBe(false);
    // The real certificate names exactly this identity, so the check above is the one that applies.
    expect(() => checkRelease(real.version, real.dist, real.attestations, sha512)).not.toThrow();
  });

  it("refuses a version string that could widen the identity pattern", () => {
    for (const version of ["0.1.0-beta.1|.*", ".*", "0.1.0 ", "v0.1.0"]) refused(() => checkRelease(version, real.dist, real.attestations, sha512), "is not a version");
  });
});
