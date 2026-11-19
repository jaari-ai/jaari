// Installed versions, side by side (ADR-122, ADR-124): `<home>/versions/<version>` holds one npm install each, and
// `<home>/current` is a link to the active one. No link means the version that npm installed, which holds the launcher.
import { lstat, mkdir, readdir, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { VERSION_FORMAT } from "./verify.js";

// `null` is the version that npm installed. `previous` is absent until the first update.
export type VersionState = { current: string | null; previous?: string | null };

export const versionPaths = (home: string) => ({
  dir: join(home, "versions"),
  link: join(home, "current"),
  state: join(home, "versions", "state.json"),
  of: (version: string) => join(home, "versions", version),
});
// Where an npm install with `--global --prefix <dir>` puts a program's entry file.
export const mainOf = (root: string, program: "cli" | "daemon") => join(root, "lib", "node_modules", "jaari", "node_modules", "@jaari", program, "dist", "main.js");
export const binOf = (root: string, program: "jaari" | "jaari-daemon") => join(root, "bin", program);

export async function readState(home: string): Promise<VersionState> {
  const state = await readFile(versionPaths(home).state, "utf8").then((text) => JSON.parse(text) as VersionState, (): VersionState => ({ current: null }));
  const ok = (value: unknown) => value === null || (typeof value === "string" && VERSION_FORMAT.test(value));
  if (!ok(state.current) || (state.previous !== undefined && !ok(state.previous))) throw new Error(`${versionPaths(home).state} is damaged; remove it and run \`jaari update\` again`);
  return state;
}

// Points the link first, then records it: the link is what runs, and a crash between the two leaves a state that
// names the old version as current, which the next update corrects.
async function apply(home: string, state: VersionState): Promise<void> {
  const paths = versionPaths(home);
  await mkdir(paths.dir, { recursive: true, mode: 0o700 });
  await rm(`${paths.link}.new`, { force: true });
  if (state.current === null) await rm(paths.link, { force: true });
  else {
    await symlink(join("versions", state.current), `${paths.link}.new`); // relative, so a moved Jaari folder keeps working
    await rename(`${paths.link}.new`, paths.link); // one step: there is never a moment without a valid link
  }
  await writeFile(`${paths.state}.tmp`, JSON.stringify(state) + "\n", { mode: 0o600 });
  await rename(`${paths.state}.tmp`, paths.state);
}

// Makes `version` the active one and remembers the one before it.
export async function activate(home: string, version: string): Promise<VersionState> {
  const state = { current: version, previous: (await readState(home)).current };
  await apply(home, state);
  return state;
}

// Goes back to the version before the last update or the last swap; undefined when there is none.
export async function swapBack(home: string): Promise<VersionState | undefined> {
  const { current, previous } = await readState(home);
  if (previous === undefined) return undefined;
  const state = { current: previous, previous: current };
  await apply(home, state);
  return state;
}

// Removes every installed version that is neither active nor the one to go back to, and unfinished installs.
export async function prune(home: string): Promise<void> {
  const paths = versionPaths(home);
  const { current, previous } = await readState(home);
  for (const entry of await readdir(paths.dir).catch(() => [])) {
    if (entry === "state.json" || entry === current || entry === previous) continue;
    if (VERSION_FORMAT.test(entry) || entry.endsWith(".installing") || entry.endsWith(".tgz")) await rm(join(paths.dir, entry), { recursive: true, force: true });
  }
}

// The folder of the active version when it is one that `jaari update` installed: the link must exist and must stay
// inside `<home>/versions`, so a link that points elsewhere is never run.
export async function activeRoot(home: string): Promise<string | undefined> {
  const paths = versionPaths(home);
  if (!(await lstat(paths.link).catch(() => undefined))?.isSymbolicLink()) return undefined;
  const [root, dir] = await Promise.all([realpath(paths.link), realpath(paths.dir)]).catch(() => [undefined, undefined]);
  return root !== undefined && dir !== undefined && root.startsWith(`${dir}/`) ? root : undefined;
}

// Orders two versions as SemVer does: numbers by value, and a pre-release before its release.
export function compareVersions(a: string, b: string): number {
  const parse = (version: string) => {
    const [core = "", pre] = version.split(/-(.*)/s);
    return { core: core.split(".").map(Number), pre: pre === undefined ? undefined : pre.split(".") };
  };
  const [x, y] = [parse(a), parse(b)];
  for (let at = 0; at < 3; at++) if ((x.core[at] ?? 0) !== (y.core[at] ?? 0)) return (x.core[at] ?? 0) - (y.core[at] ?? 0);
  if (x.pre === undefined || y.pre === undefined) return x.pre === y.pre ? 0 : x.pre === undefined ? 1 : -1;
  for (let at = 0; at < Math.max(x.pre.length, y.pre.length); at++) {
    const [p, q] = [x.pre[at], y.pre[at]];
    if (p === undefined || q === undefined) return p === q ? 0 : p === undefined ? -1 : 1;
    if (p === q) continue;
    const [n, m] = [/^\d+$/.test(p), /^\d+$/.test(q)];
    return n && m ? Number(p) - Number(q) : n ? -1 : m ? 1 : p < q ? -1 : 1;
  }
  return 0;
}
