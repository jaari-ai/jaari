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

  it("ignores empty values", () => {
    expect(scrub("text", [""])).toBe("text");
  });
});
