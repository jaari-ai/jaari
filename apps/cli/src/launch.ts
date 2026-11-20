// What the `jaari` and `jaari-daemon` commands of the npm package run first (ADR-124). When `jaari update` has
// installed a version, this starts that one; otherwise the one beside this file. So the commands on PATH, and the
// service that names them, follow an update and a rollback without being rewritten.
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { readFile, realpath } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { activeRoot, compareVersions, mainOf, readState } from "./versions.js";

// `--home <dir>` or `--home=<dir>`, as `parseArgs` reads it in every command: the last one wins, and nothing after
// `--` counts. The default is ~/.jaari.
export function homeOf(argv: readonly string[]): string {
  let home: string | undefined;
  for (let at = 0; at < argv.length && argv[at] !== "--"; at++) {
    if (argv[at] === "--home" && at + 1 < argv.length) home = argv[++at];
    else if (argv[at]!.startsWith("--home=")) home = argv[at]!.slice("--home=".length);
  }
  return home ? resolve(home) : join(homedir(), ".jaari");
}

const versionAt = (main: string) => readFile(join(main, "..", "..", "package.json"), "utf8").then((text) => (JSON.parse(text) as { version?: string }).version, () => undefined);

// The entry file to run: the active version's, unless there is none, it is this one, or this one is newer (the owner
// installed a newer Jaari with npm, which then wins). `warn` gets one line when the active version is gone.
export async function entryOf(program: "cli" | "daemon", argv: readonly string[], own: string, warn: (line: string) => void = () => {}): Promise<string> {
  const home = homeOf(argv);
  const root = await activeRoot(home).catch(() => undefined);
  if (root === undefined) {
    const state = await readState(home).catch(() => undefined);
    if (state?.current) warn(`jaari: the active version ${state.current} is missing from ${join(home, "versions")}; running the one npm installed`);
    return own;
  }
  const active = await realpath(mainOf(root, program)).catch(() => undefined);
  if (active === undefined || active === (await realpath(own))) return own;
  const [mine, theirs] = await Promise.all([versionAt(own), versionAt(active)]);
  return mine !== undefined && theirs !== undefined && compareVersions(mine, theirs) > 0 ? own : active;
}

export async function launch(program: "cli" | "daemon"): Promise<void> {
  const own = fileURLToPath(new URL(program === "cli" ? "./main.js" : "../../daemon/dist/main.js", import.meta.url));
  await import(pathToFileURL(await entryOf(program, process.argv.slice(2), own, (line) => console.error(line))).href);
}
