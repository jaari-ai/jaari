import { describe, expect, it } from "vitest";
import { parseRef, resolveRef, scrub, type VaultProvider } from "./secrets.js";

describe("parseRef", () => {
  it("returns the name of a secretRef", () => {
    expect(parseRef("secretRef:llm.anthropic")).toBe("llm.anthropic");
  });

  it.each(["llm.anthropic", "secretRef:", "secretRef:../etc/shadow", "secretRef:a/b", "secretRef:.hidden", "secretRef:bw:item/field"])(
    "refuses %s", (ref) => expect(() => parseRef(ref)).toThrow("not a secretRef name"),
  );
});

it("resolveRef passes the parsed name to the provider", async () => {
  const provider: VaultProvider = { resolve: async (n) => `value-of-${n}`, health: async () => ({ ok: true }) };
  expect(await resolveRef("secretRef:token", provider)).toBe("value-of-token");
});

describe("scrub", () => {
  it("replaces exact values in nested strings and keys", () => {
    expect(scrub({ msg: "auth abc failed", list: ["abc"], abc: 1, n: 2 }, ["abc"])).toEqual({ msg: "auth [redacted] failed", list: ["[redacted]"], "[redacted]": 1, n: 2 });
  });

  it("hides a value that contains another, so no part of it survives", () => {
    expect(scrub("key=abcdef", ["abc", "abcdef"])).toBe("key=[redacted]");
  });

  it("hides two values that overlap, with nothing left between or after", () => {
    expect(scrub("x=abcd!", ["abc", "bcd"])).toBe("x=[redacted]!");
  });

  // ADR-016 point 6: the exact value "and common encodings of it".
  const secret = "tok/SECRET+12345="; // / + = change under percent-encoding and differ between base64 forms
  const leaks = (out: string) =>
    [out, ...out.split("[redacted]")].some((part) =>
      [Buffer.from(part, "base64").toString(), Buffer.from(part, "base64url").toString(), decodeURIComponent(part.replace(/%(?![\da-f]{2})/gi, "")), Buffer.from(part, "hex").toString()]
        .some((decoded) => decoded.includes(secret.slice(0, 8))));

  it.each([
    ["base64", (s: string) => Buffer.from(s).toString("base64")],
    ["base64url", (s: string) => Buffer.from(s).toString("base64url")],
    ["percent-encoding", (s: string) => encodeURIComponent(s + " /&")],
    ["hex", (s: string) => Buffer.from(s).toString("hex")],
  ])("hides the %s form", (_, encode) => {
    const out = scrub(`value=${encode(secret)}`, [secret]);
    expect(out).toContain("[redacted]");
    expect(leaks(out)).toBe(false);
  });

  it.each(["u:", "us:", "use:"])("hides a secret inside a longer base64 run (Basic auth with user %s)", (user) => {
    const out = scrub(`Authorization: Basic ${Buffer.from(user + secret).toString("base64")}`, [secret]);
    expect(out).toContain("[redacted]");
    expect(leaks(out.slice("Authorization: Basic ".length))).toBe(false);
  });

  it("ignores empty values", () => {
    expect(scrub("text", [""])).toBe("text");
  });
});
