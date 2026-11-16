// Loads built-in packages: every manifest is checked before any package code is imported (ADR-071, ADR-084, ADR-108).
import { readFile } from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { parseManifest, type Manifest } from "./manifest.js";

export type LoadedPackage = { name: string; manifest: Manifest; module: unknown };

export class PackageLoadError extends Error {
  constructor(readonly problems: string[]) {
    super(`Refusing to start; package checks failed:\n${problems.join("\n")}`);
    this.name = "PackageLoadError";
  }
}

// `base` is the caller's import.meta.url; `importModule` is the caller's `(n) => import(n)`, so names
// resolve from the caller, not from this package. Any failure refuses the whole set (ADR-108).
export async function loadBuiltins(
  names: readonly string[],
  base: string | URL,
  importModule: (name: string) => Promise<unknown>,
): Promise<LoadedPackage[]> {
  const problems: string[] = [];
  const checked: { name: string; manifest: Manifest }[] = [];
  const ids = new Map<string, string>();

  for (const name of names) {
    let path: string | undefined;
    try {
      path = findPackageJSON(name, base);
    } catch {
      // Node 26 throws ERR_MODULE_NOT_FOUND for a missing bare name, although the docs say undefined.
    }
    if (!path) {
      problems.push(`${name}: package.json not found`);
      continue;
    }
    let pkg: { version?: unknown; jaari?: unknown } | null;
    try {
      pkg = JSON.parse(await readFile(path, "utf8"));
    } catch (e) {
      problems.push(`${name}: cannot read ${path}: ${(e as Error).message}`);
      continue;
    }
    const result = parseManifest(pkg?.jaari);
    if (!result.ok) {
      problems.push(...result.errors.map((e) => `${name}: jaari${e}`));
      continue;
    }
    const { manifest } = result;
    if (manifest.version !== pkg?.version) {
      problems.push(`${name}: jaari.version ${manifest.version} differs from package version ${String(pkg?.version)}`);
    }
    const other = ids.get(manifest.id);
    if (other) problems.push(`${name}: id "${manifest.id}" is already used by ${other}`);
    ids.set(manifest.id, name);
    checked.push({ name, manifest });
  }

  if (problems.length > 0) throw new PackageLoadError(problems);
  return Promise.all(checked.map(async (c) => ({ ...c, module: await importModule(c.name) })));
}
