import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseManifest } from "./manifest.js";
import { CAPABILITIES } from "./vocabulary.js";

// The example manifest from docs/ARCHITECTURE.md (Channels > Contract).
const telegram = {
  id: "telegram", version: "1.2.0", kind: "channel",
  interfaceVersion: 1, minJaari: "0.3.0", hosts: ["daemon"],
  egress: ["api.telegram.org"], secrets: ["telegram.token"],
  channel: { capabilities: { text: true, media: true }, identity: "account", prompts: "buttons", maxMessageChars: 4096 },
};
const browser = {
  id: "browser-local", version: "0.1.0", kind: "capability", interfaceVersion: 1, minJaari: "0.1.0",
  provides: ["browser.read", "browser.act"], hosts: ["node"], provider: "local-profile",
  platforms: { os: ["darwin"], cpu: ["arm64"] }, permissions: ["accessibility"],
  sidecars: [{ name: "driver", sha256: "a".repeat(64), size: 1024, sbom: "sbom.json" }],
};

const errorsOf = (value: unknown) => {
  const r = parseManifest(value);
  return r.ok ? [] : r.errors;
};

describe("parseManifest", () => {
  it.each([["channel", telegram], ["capability", browser]])("accepts a valid %s manifest", (_, m) => {
    expect(parseManifest(m)).toEqual({ ok: true, manifest: m });
  });

  it.each([
    ["an unknown capability name", { ...browser, provides: ["browser.hack"] }],
    ["an unknown kind", { ...browser, kind: "plugin" }],
    ["an unknown field", { ...browser, trusted: true }],
    ["an unknown channel field", { ...telegram, channel: { ...telegram.channel, extra: 1 } }],
    ["a missing required field", { ...browser, hosts: undefined }],
    ["no hosts", { ...browser, hosts: [] }],
    ["an unknown host", { ...browser, hosts: ["cloud"] }],
    ["a duplicate name", { ...browser, provides: ["shell", "shell"] }],
    ["a non-semver version", { ...browser, version: "1.2" }],
    ["an egress URL instead of a hostname", { ...telegram, egress: ["https://api.telegram.org"] }],
    ["a wildcard egress host", { ...telegram, egress: ["*.telegram.org"] }],
    ["a sidecar without a digest", { ...browser, sidecars: [{ name: "driver", size: 1, sbom: "s" }] }],
    ["a channel without its section", { ...telegram, channel: undefined }],
    ["a channel section on another kind", { ...browser, channel: telegram.channel }],
    ["a value that is not an object", "telegram"],
    ["null", null],
  ])("refuses %s", (_, m) => {
    expect(errorsOf(m).length).toBeGreaterThan(0);
  });

  it("names the field that failed", () => {
    expect(errorsOf({ ...browser, kind: "plugin" }).join("\n")).toContain("/kind");
  });
});

describe("vocabulary", () => {
  // The SECURITY_MODEL.md table is the authority (ADR-018); the code must match it name for name.
  it("matches the capability table in SECURITY_MODEL.md", () => {
    const doc = readFileSync(new URL("../../../docs/SECURITY_MODEL.md", import.meta.url), "utf8");
    const table = doc.slice(doc.indexOf("| Capability | Class |")).split("\n\n")[0];
    const fromDoc: Record<string, string> = {};
    for (const row of table.split("\n").slice(2)) {
      const [, nameCell, classCell] = row.split("|");
      const names = [...nameCell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      // "gated by classifier" -> gated, "policy-checked" -> policy; "read, gated" pairs with the names in order.
      const classes = classCell.split(",").map((c) => c.trim().match(/^[a-z]+/)![0]);
      names.forEach((n, i) => (fromDoc[n] = classes.length === names.length ? classes[i] : classes[0]));
    }
    expect(Object.keys(fromDoc).length).toBeGreaterThan(0);
    expect(CAPABILITIES).toEqual(fromDoc);
  });

  it("does not treat inherited object keys as names", () => {
    expect(errorsOf({ ...browser, provides: ["toString"] }).length).toBeGreaterThan(0);
  });
});
