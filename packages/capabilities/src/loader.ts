// Loads built-in packages: every manifest is checked before any package code is imported (ADR-071, ADR-084, ADR-108).
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { fileURLToPath } from "node:url";
import { parseManifest, type Manifest } from "./manifest.js";

export type LoadedPackage = { name: string; manifest: Manifest; module: unknown };

export class PackageLoadError extends Error {
  constructor(readonly problems: string[]) {
    super(`Refusing to start; package checks failed:\n${problems.join("\n")}`);
    this.name = "PackageLoadError";
  }
}

// `resolve` is the caller's `(s) => import.meta.resolve(s)`, so names resolve from the caller, not from
// this package. The check and the import both use it, so they cannot reach different copies of a
// package. Any failure refuses the whole set (ADR-109).
export async function loadBuiltins(
  names: readonly string[],
  resolve: (specifier: string) => string,
): Promise<LoadedPackage[]> {
  const base = resolve("./");
  const problems: string[] = [];
  const checked: { name: string; manifest: Manifest; url: string }[] = [];
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
    let url: string;
    try {
      url = resolve(name);
      // resolve() follows `exports` but does not check that the file exists; import() would fail later.
      if (!existsSync(fileURLToPath(url))) throw new Error(`${url} does not exist`);
    } catch (e) {
      problems.push(`${name}: cannot resolve its entry: ${(e as Error).message}`);
      continue;
    }
    checked.push({ name, manifest, url });
  }

  if (problems.length > 0) throw new PackageLoadError(problems);
  return Promise.all(checked.map(async ({ name, manifest, url }) => ({ name, manifest, module: await import(url) })));
}
