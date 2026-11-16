import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadBuiltins, PackageLoadError } from "./loader.js";

const manifest = (id: string, version = "0.1.0") => ({
  id, version, kind: "capability", interfaceVersion: 1, minJaari: "0.1.0", hosts: ["daemon"], provides: ["files.read"],
});

let root: string;
let base: URL;
let imported: string[];
const importModule = async (name: string) => (imported.push(name), { name });

// Writes node_modules/<name>/package.json; `raw` is written as-is instead of JSON.
const install = (name: string, pkg: unknown, raw?: string) => {
  const dir = join(root, "node_modules", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), raw ?? JSON.stringify(pkg));
};
const problemsOf = async (names: string[]) => {
  const err = await loadBuiltins(names, base, importModule).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(PackageLoadError);
  return (err as PackageLoadError).problems.join("\n");
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jaari-loader-"));
  base = pathToFileURL(join(root, "app.js"));
  imported = [];
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("loadBuiltins", () => {
  it("checks every manifest, then imports each package", async () => {
    install("@jaari/a", { name: "@jaari/a", version: "0.1.0", jaari: manifest("a") });
    install("@jaari/b", { name: "@jaari/b", version: "0.2.0", jaari: manifest("b", "0.2.0") });
    const loaded = await loadBuiltins(["@jaari/a", "@jaari/b"], base, importModule);
    expect(loaded.map((p) => [p.name, p.manifest.id, p.module])).toEqual([
      ["@jaari/a", "a", { name: "@jaari/a" }],
      ["@jaari/b", "b", { name: "@jaari/b" }],
    ]);
  });

  it("imports no package code when any manifest fails", async () => {
    install("@jaari/good", { version: "0.1.0", jaari: manifest("good") });
    install("@jaari/bad", { version: "0.1.0", jaari: { ...manifest("bad"), kind: "plugin" } });
    expect(await problemsOf(["@jaari/good", "@jaari/bad"])).toContain("@jaari/bad: jaari/kind");
    expect(imported).toEqual([]);
  });

  it.each([
    ["a missing package", () => {}, "package.json not found"],
    ["no jaari key", () => install("@jaari/x", { version: "0.1.0" }), "@jaari/x: jaari/"],
    ["a package.json that is null", () => install("@jaari/x", null, "null"), "@jaari/x: jaari/"],
    ["invalid JSON", () => install("@jaari/x", null, "{"), "cannot read"],
    ["a version mismatch", () => install("@jaari/x", { version: "0.2.0", jaari: manifest("x") }), "differs from package version 0.2.0"],
  ])("refuses %s", async (_, setup, expected) => {
    setup();
    expect(await problemsOf(["@jaari/x"])).toContain(expected);
    expect(imported).toEqual([]);
  });

  it("refuses two packages with the same id and reports both problems at once", async () => {
    install("@jaari/a", { version: "0.1.0", jaari: manifest("same") });
    install("@jaari/b", { version: "0.1.0", jaari: manifest("same") });
    const problems = await problemsOf(["@jaari/a", "@jaari/b", "@jaari/missing"]);
    expect(problems).toContain('@jaari/b: id "same" is already used by @jaari/a');
    expect(problems).toContain("@jaari/missing: package.json not found");
  });
});
