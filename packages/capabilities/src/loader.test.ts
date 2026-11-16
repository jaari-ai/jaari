import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadBuiltins, PackageLoadError } from "./loader.js";

const manifest = (id: string, version = "0.1.0") => ({
  id, version, kind: "capability", interfaceVersion: 1, minJaari: "0.1.0", hosts: ["daemon"], provides: ["files.read"],
});

// Each fixture's index.js records that its code ran.
const ran = (globalThis as { __jaariRan?: string[] }).__jaariRan ??= [];
let root: string;
let resolve: (specifier: string) => string;

// Writes node_modules/<name> with a package.json (`raw` is written as-is) and an index.js.
const install = (name: string, pkg: unknown, raw?: string) => {
  const dir = join(root, "node_modules", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), raw ?? JSON.stringify({ type: "module", exports: "./index.js", ...(pkg as object) }));
  writeFileSync(join(dir, "index.js"), `globalThis.__jaariRan.push(${JSON.stringify(name)}); export const version = ${JSON.stringify((pkg as { version?: string })?.version)};`);
};
const problemsOf = async (names: string[]) => {
  const err = await loadBuiltins(names, resolve).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(PackageLoadError);
  return (err as PackageLoadError).problems.join("\n");
};

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "jaari-loader-"));
  // The caller's resolver, as the daemon will pass it: names resolve from the fixture root.
  writeFileSync(join(root, "resolver.mjs"), "export const resolve = (s) => import.meta.resolve(s);");
  ({ resolve } = await import(pathToFileURL(join(root, "resolver.mjs")).href));
  ran.length = 0;
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("loadBuiltins", () => {
  it("checks every manifest, then imports the same copy it checked", async () => {
    install("@jaari/a", { version: "0.1.0", jaari: manifest("a") });
    install("@jaari/b", { version: "0.2.0", jaari: manifest("b", "0.2.0") });
    const loaded = await loadBuiltins(["@jaari/a", "@jaari/b"], resolve);
    expect(loaded.map((p) => [p.name, p.manifest.version, (p.module as { version: string }).version])).toEqual([
      ["@jaari/a", "0.1.0", "0.1.0"],
      ["@jaari/b", "0.2.0", "0.2.0"],
    ]);
    expect(ran.sort()).toEqual(["@jaari/a", "@jaari/b"]);
  });

  it("runs no package code when any manifest fails", async () => {
    install("@jaari/good", { version: "0.1.0", jaari: manifest("good") });
    install("@jaari/bad", { version: "0.1.0", jaari: { ...manifest("bad"), kind: "plugin" } });
    expect(await problemsOf(["@jaari/good", "@jaari/bad"])).toContain("@jaari/bad: jaari/kind");
    expect(ran).toEqual([]);
  });

  it.each([
    ["a missing package", () => {}, "package.json not found"],
    ["no jaari key", () => install("@jaari/x", { version: "0.1.0" }), "@jaari/x: jaari/"],
    ["a package.json that is null", () => install("@jaari/x", null, "null"), "@jaari/x: jaari/"],
    ["invalid JSON", () => install("@jaari/x", null, "{"), "cannot read"],
    ["a version mismatch", () => install("@jaari/x", { version: "0.2.0", jaari: manifest("x") }), "differs from package version 0.2.0"],
    ["an entry that does not resolve", () => install("@jaari/x", { version: "0.1.0", exports: "./missing.js", jaari: manifest("x") }), "cannot resolve its entry"],
  ])("refuses %s", async (_, setup, expected) => {
    setup();
    expect(await problemsOf(["@jaari/x"])).toContain(expected);
    expect(ran).toEqual([]);
  });

  it("names the package whose import fails", async () => {
    install("@jaari/a", { version: "0.1.0", jaari: manifest("a") });
    install("@jaari/b", { version: "0.1.0", jaari: manifest("b") });
    writeFileSync(join(root, "node_modules", "@jaari/b", "index.js"), 'throw new Error("boom");');
    expect(await problemsOf(["@jaari/a", "@jaari/b"])).toBe("@jaari/b: import failed: boom");
  });

  it("refuses two packages with the same id and reports both problems at once", async () => {
    install("@jaari/a", { version: "0.1.0", jaari: manifest("same") });
    install("@jaari/b", { version: "0.1.0", jaari: manifest("same") });
    const problems = await problemsOf(["@jaari/a", "@jaari/b", "@jaari/missing"]);
    expect(problems).toContain('@jaari/b: id "same" is already used by @jaari/a');
    expect(problems).toContain("@jaari/missing: package.json not found");
  });
});
