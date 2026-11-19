// What the `jaari` and `jaari-daemon` commands of the npm package run first (ADR-124). When `jaari update` has
// installed a version, this starts that one; otherwise the one beside this file. So the commands on PATH, and the
// service that names them, follow an update and a rollback without being rewritten.
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { realpath } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { activeRoot, mainOf } from "./versions.js";

// `--home <dir>` or `--home=<dir>`, as every command reads it; the default is ~/.jaari.
export function homeOf(argv: readonly string[]): string {
  const at = argv.findIndex((arg) => arg === "--home" || arg.startsWith("--home="));
  const value = at < 0 ? undefined : argv[at]!.includes("=") ? argv[at]!.slice("--home=".length) : argv[at + 1];
  return value ? resolve(value) : join(homedir(), ".jaari");
}

// The entry file to run: the active version's, unless there is none or it is this one.
export async function entryOf(program: "cli" | "daemon", argv: readonly string[], own: string): Promise<string> {
  const root = await activeRoot(homeOf(argv)).catch(() => undefined);
  if (root === undefined) return own;
  const active = await realpath(mainOf(root, program)).catch(() => undefined);
  return active === undefined || active === (await realpath(own)) ? own : active;
}

export async function launch(program: "cli" | "daemon"): Promise<void> {
  const own = fileURLToPath(new URL(program === "cli" ? "./main.js" : "../../daemon/dist/main.js", import.meta.url));
  await import(pathToFileURL(await entryOf(program, process.argv.slice(2), own)).href);
}
