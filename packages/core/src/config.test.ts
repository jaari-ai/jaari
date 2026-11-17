import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, credentialsDirOf, expandHome, isInsideData, jaariPaths, loadConfig, parseConfig } from "./config.js";

const llm = { providers: {}, tiers: {}, roles: {} };
const problems = (text: string): string[] => {
  try {
    parseConfig(text);
  } catch (error) {
    return (error as ConfigError).problems;
  }
  return [];
};

describe("the owner config (ADR-056, ADR-118)", () => {
  it("reads the example config, so the example cannot drift from the schema", async () => {
    const config = await loadConfig(join(import.meta.dirname, "../../../jaari.config.example.jsonc"));
    expect(config).toMatchObject({ version: 1, deployment: { target: "vps" }, secrets: { zero: "host-credential" }, limits: { stepsPerTurn: 25 } });
  });

  it("reads comments, a // inside a string, and trailing commas", () => {
    const config = parseConfig(`{
      // where the model lives
      "version": 1, /* block */
      "llm": { "providers": { "local": { "baseUrl": "http://localhost:11434/v1" } }, "tiers": {}, "roles": {}, },
    }`);
    expect(config.llm).toMatchObject({ providers: { local: { baseUrl: "http://localhost:11434/v1" } } });
  });

  it("names every problem: a typo in a section name, a wrong value, a wrong type", () => {
    const found = problems(JSON.stringify({ version: 1, llm, deploymnet: {}, deployment: { target: "moon" }, limits: { stepsPerTurn: "many", nope: 1 }, secrets: { zero: "env" } }));
    expect(found).toContain("/deploymnet: unknown key");
    expect(found).toContain("/limits/nope: unknown key");
    expect(found.join("\n")).not.toContain("schema is false");
    expect(found.some((line) => line.startsWith("/deployment/target"))).toBe(true);
    expect(found.some((line) => line.startsWith("/limits"))).toBe(true);
    expect(found.some((line) => line.startsWith("/secrets/zero"))).toBe(true); // `env` is development-only, never config (ADR-079)
  });

  it("accepts a section of a feature that is not built yet, but not an unknown one", () => {
    expect(parseConfig(JSON.stringify({ version: 1, llm, persona: { curiosity: 2 }, backup: { anything: true } })).version).toBe(1);
    expect(problems(JSON.stringify({ version: 1, llm, personas: {} }))).not.toEqual([]);
  });

  it("refuses a config with no version, and one newer than this Jaari", () => {
    expect(problems(JSON.stringify({ llm }))).toEqual([expect.stringContaining('"version" is missing')]);
    expect(problems(JSON.stringify({ version: 2, llm }))).toEqual([expect.stringContaining("newer than this Jaari reads")]);
    expect(problems("[1]")).toEqual(["the config must be one object"]);
    expect(problems(JSON.stringify({ version: "1", llm }))).toEqual(['"version" must be a whole number such as 1, not "1"']);
    expect(problems(JSON.stringify({ version: 1.5, llm }))).toEqual(['"version" must be a whole number such as 1, not 1.5']);
  });

  it("points at the line of a syntax error, and at init when the file is missing", async () => {
    expect(problems('{\n  "version": 1,\n  "llm": \n}')).toEqual([expect.stringMatching(/^line 4, column 1: ValueExpected/)]);
    const dir = await mkdtemp(join(tmpdir(), "jaari-config-"));
    await expect(loadConfig(join(dir, "config.jsonc"))).rejects.toThrow(/^No config:\n.*run `jaari init`/);
    await writeFile(join(dir, "config.jsonc"), JSON.stringify({ version: 1, llm }));
    expect((await loadConfig(join(dir, "config.jsonc"))).version).toBe(1);
  });

  it("keeps one install under one folder, with credentials outside the data folder (ADR-079)", () => {
    const paths = jaariPaths("/home/owner/.jaari");
    expect(paths).toEqual({ home: "/home/owner/.jaari", config: "/home/owner/.jaari/config.jsonc", data: "/home/owner/.jaari/data", credentials: "/home/owner/.jaari/credentials" });
    expect(jaariPaths().home).toBe(join(homedir(), ".jaari"));
    expect(expandHome("~/.jaari/credentials")).toBe(join(homedir(), ".jaari/credentials"));
    expect(expandHome("/run/secrets")).toBe("/run/secrets");
    expect(expandHome("~other/x")).toBe("~other/x");
    expect(credentialsDirOf({}, paths)).toBe("/home/owner/.jaari/credentials");
    expect(credentialsDirOf({ secrets: { credentialsDir: "/run/secrets" } }, paths)).toBe("/run/secrets");
    expect(credentialsDirOf({ secrets: { credentialsDir: "creds" } }, paths)).toBe("/home/owner/.jaari/creds");
    expect(credentialsDirOf({ secrets: { credentialsDir: "~/c" } }, paths)).toBe(join(homedir(), "c"));
    expect(isInsideData("/home/owner/.jaari/data/creds", paths)).toBe(true);
    expect(isInsideData("/home/owner/.jaari/data", paths)).toBe(true);
    expect(isInsideData("/home/owner/.jaari/credentials", paths)).toBe(false);
    expect(isInsideData("/home/owner/.jaari/data-old", paths)).toBe(false); // a sibling that starts the same
  });

  it("keeps the smoke config that CI starts valid", async () => {
    const text = await readFile(join(import.meta.dirname, "../../../apps/daemon/smoke.config.json"), "utf8");
    expect(parseConfig(text).secrets?.zero).toBe("host-credential");
  });
});
