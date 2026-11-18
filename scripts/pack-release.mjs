#!/usr/bin/env node
// `node scripts/pack-release.mjs <version> [folder]`: builds the one public npm package, `jaari` (ADR-122). The
// workspace packages travel inside it (`bundleDependencies`), so none of them is published on its own, and a
// shrinkwrap fixes every third-party version. Run `pnpm -r build` first. The result is <folder>/jaari-<version>.tgz.
import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const [version, folder = join(ROOT, "dist/npm")] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  console.error("usage: node scripts/pack-release.mjs <version such as 0.1.0 or 0.1.0-beta.1> [folder]");
  process.exit(2);
}
const out = resolve(folder);
const stage = join(out, "stage");
rmSync(stage, { recursive: true, force: true });

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const workspace = new Map();
for (const group of ["packages", "apps"]) {
  for (const name of readdirSync(join(ROOT, group))) {
    const path = join(ROOT, group, name);
    if (existsSync(join(path, "package.json"))) workspace.set(read(join(path, "package.json")).name, { path, manifest: read(join(path, "package.json")) });
  }
}

// What the two programs need, and nothing else (`@jaari/gate` and the rest come in only if they are used).
const bundled = new Set();
const third = {};
const visit = (name) => {
  if (bundled.has(name)) return;
  bundled.add(name);
  for (const [dep, range] of Object.entries(workspace.get(name).manifest.dependencies ?? {})) {
    if (workspace.has(dep)) visit(dep);
    else if (third[dep] && third[dep] !== range) throw new Error(`${dep} is pinned to both ${third[dep]} and ${range}`);
    else third[dep] = range;
  }
};
["@jaari/cli", "@jaari/daemon"].forEach(visit);

// `exports` with only what an installed copy has: the built file, not the source or the types.
const built = (exports) => Object.fromEntries(Object.entries(exports).map(([path, target]) => [path, target.default]));
for (const name of bundled) {
  const { path, manifest } = workspace.get(name);
  const target = join(stage, "node_modules", name);
  if (!existsSync(join(path, "dist"))) throw new Error(`${name} has no dist/; run pnpm -r build first`);
  cpSync(join(path, "dist"), join(target, "dist"), { recursive: true, filter: (file) => !/\.(map|d\.ts)$/.test(file) });
  if (existsSync(join(path, "prompts"))) cpSync(join(path, "prompts"), join(target, "prompts"), { recursive: true });
  // No `dependencies`: npm would count what a bundled package depends on as bundled too, and never download it. The
  // root package lists them all, and they install beside the bundled packages.
  const { private: _private, dependencies: _deps, devDependencies: _dev, peerDependencies: _peer, peerDependenciesMeta: _meta, scripts: _scripts, bin: _bin, ...kept } = manifest;
  writeFileSync(join(target, "package.json"), JSON.stringify({ ...kept, version, exports: built(manifest.exports) }, null, 2) + "\n");
}

mkdirSync(join(stage, "bin"), { recursive: true });
for (const [program, from] of [["jaari", "cli"], ["jaari-daemon", "daemon"]]) {
  const file = join(stage, "bin", `${program}.js`);
  writeFileSync(file, `#!/usr/bin/env node\nimport "../node_modules/@jaari/${from}/dist/main.js";\n`);
  chmodSync(file, 0o755);
}
for (const file of ["LICENSE", "NOTICE", "README.md"]) cpSync(join(ROOT, file), join(stage, file));
const names = [...bundled].sort();
writeFileSync(join(stage, "package.json"), JSON.stringify({
  name: "jaari",
  version,
  description: read(join(ROOT, "package.json")).description ?? "A self-hosted, single-owner personal AI agent",
  license: "MIT",
  homepage: "https://jaari.org",
  repository: { type: "git", url: "git+https://github.com/jaari-ai/jaari.git" },
  type: "module",
  engines: { node: ">=26" },
  bin: { jaari: "bin/jaari.js", "jaari-daemon": "bin/jaari-daemon.js" },
  files: ["bin", "NOTICE", "npm-shrinkwrap.json"],
  dependencies: { ...Object.fromEntries(names.map((name) => [name, version])), ...Object.fromEntries(Object.entries(third).sort()) },
  bundleDependencies: names,
}, null, 2) + "\n");

const npm = (...args) => execFileSync("npm", args, { cwd: stage, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
// The same seven-day rule as pnpm's `minimumReleaseAge` (ADR-043), for what the lockfile of this repo does not cover.
const before = new Date(Date.now() - 7 * 86_400_000).toISOString();
npm("install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund", `--before=${before}`);
renameSync(join(stage, "package-lock.json"), join(stage, "npm-shrinkwrap.json"));
npm("pack", "--pack-destination", out, "--silent");
rmSync(stage, { recursive: true, force: true });
console.log(join(out, `jaari-${version}.tgz`));
