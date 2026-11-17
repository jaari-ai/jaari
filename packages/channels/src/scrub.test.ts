import { describe, expect, it } from "vitest";
import { scrubSecrets } from "./scrub.js";

// Test values are built from repeated low-entropy characters, so the CI secret scanner sees no real key.
const a = (n: number) => "a".repeat(n);

describe("scrubSecrets (ADR-081)", () => {
  it.each([
    ["api key", "sk-" + a(40)],
    ["api key", "sk-ant-" + a(40)],
    ["token", "ghp_" + a(36)],
    ["token", "github_pat_" + a(40)],
    ["token", "xoxb-" + "1".repeat(12) + "-" + a(20)],
    ["api key", "AKIA" + "A".repeat(16)],
    ["api key", "AIza" + a(35)],
    ["token", "1".repeat(10) + ":" + a(35)],
    ["token", "eyJ" + a(20) + ".eyJ" + a(20) + "." + a(20)],
    ["card number", "4111 " + "1111 ".repeat(2) + "1111"],
    ["card number", "4111-" + "1111-".repeat(2) + "1111"],
  ])("removes a %s", (kind, value) => {
    const { text, kinds } = scrubSecrets(`here it is: ${value} thanks`);
    expect(text).toBe(`here it is: [secret removed: ${kind}] thanks`);
    expect(kinds).toEqual([kind]);
  });

  it("removes a PEM private key block", () => {
    const pem = ["-----BEGIN RSA " + "PRIVATE KEY-----", a(64), a(64), "-----END RSA " + "PRIVATE KEY-----"].join("\n");
    expect(scrubSecrets(`key:\n${pem}\nok`)).toEqual({ text: "key:\n[secret removed: private key]\nok", kinds: ["private key"] });
  });

  it("removes a labelled password and keeps the label", () => {
    expect(scrubSecrets("password: hunter2 and pwd=abc PassPhrase : x y").text).toBe(
      "password: [secret removed: password] and pwd=[secret removed: password] PassPhrase : [secret removed: password] y");
  });

  it("reports each kind once", () => {
    expect(scrubSecrets(`${"sk-" + a(30)} ${"sk-" + a(31)} password=x`).kinds).toEqual(["api key", "password"]);
  });

  it.each([
    ["a git hash", "commit 3f786850e387550fdab836ed7e6dc881de23001b"],
    ["a UUID", "id 123e4567-e89b-12d3-a456-426614174000"],
    ["an order id", "order ORD-2026-118842 shipped"],
    ["a Luhn-invalid number", "4111 1111 1111 1112"],
    ["a millisecond timestamp that passes the Luhn check", "at 1763373600008"],
    ["a short number", "call 555 0132 or 12345678"],
    ["a word that only starts like a key", "the task-list and sk-short"],
    ["a password with no label", "my password is hunter2"],
  ])("keeps %s", (_, text) => {
    expect(scrubSecrets(text)).toEqual({ text, kinds: [] });
  });
});
