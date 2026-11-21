// `jaari uninstall [--home <dir>] [--service-name <name>] [--purge] [--yes]`: remove the app and keep the data; `--purge` also deletes the
// data after a typed confirmation (ADR-056).
import { lstat, realpath, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join, parse, resolve } from "node:path";
import { parseArgs } from "node:util";
import { socketPath } from "@jaari/channels";
import { jaariPaths } from "@jaari/core/config";
import type { Command, Io } from "./io.js";
import { createPrompter, InputEnded } from "./prompt.js";
import { serviceFromArgs, systemDeps as serviceDeps } from "./service.js";
import { daemonRunning } from "./socket.js";

const USAGE = "usage: jaari uninstall [--home <dir>] [--service-name <name>] [--purge] [--yes]";

// Every effect on the system, so a test hands over fakes and never reaches the real launchd or files.
export type UninstallDeps = {
  platform: NodeJS.Platform;
  uid: number;
  homedir: string;
  exec: (command: string, args: string[]) => Promise<{ code: number; stderr: string }>;
  exists: (path: string) => Promise<boolean>;
  remove: (path: string) => Promise<void>;
  daemonRunning: (path: string) => Promise<"running" | "stopped" | "silent">;
};

export const systemDeps: UninstallDeps = {
  platform: process.platform,
  uid: process.getuid?.() ?? -1,
  homedir: homedir(),
  exec: (command, args) => serviceDeps.exec(command, args),
  exists: async (path) => (await lstat(path).catch(() => null)) !== null, // lstat: a broken `current` link still counts
  remove: (path) => rm(path, { recursive: true, force: true }),
  daemonRunning: (path) => daemonRunning(path),
};

export async function uninstall(args: string[], io: Io, deps: UninstallDeps = systemDeps): Promise<number> {
  const say = (line: string) => io.output.write(`${line}\n`);
  let parsed;
  try {
    parsed = parseArgs({ args, options: { home: { type: "string" }, "service-name": { type: "string" }, purge: { type: "boolean", default: false }, yes: { type: "boolean", default: false } } });
  } catch {
    return (say(USAGE), 2);
  }
  const { values } = parsed;
  const svc = serviceFromArgs(values["service-name"], values.home);
  if (typeof svc === "string") return (say(`jaari: ${svc}`), 2);
  const paths = jaariPaths(values.home ? resolve(values.home) : join(deps.homedir, ".jaari"));
  const log = join(deps.homedir, "Library", "Logs", svc.log);

  if (values.purge) {
    // ADR-076: deleting the owner's data needs a person; --yes does not stand in for one.
    if (!io.isTTY) return (say("jaari: --purge deletes the data and needs a person; run it in a terminal"), 2);
    // Through links too: a Jaari folder that is a link to the home folder must not pass.
    const real = await realpath(paths.home).catch(() => paths.home);
    const owner = await realpath(deps.homedir).catch(() => resolve(deps.homedir));
    if ([paths.home, real].some((dir) => dir === parse(dir).root || dir === resolve(deps.homedir) || dir === owner)) return (say(`jaari: refusing to purge ${paths.home}: it is not a Jaari folder`), 1);
    // `jaari init` always writes config.jsonc; a folder that only has a `data` folder may be any project.
    if (!(await deps.exists(paths.config))) return (say(`jaari: refusing to purge ${paths.home}: it has no config.jsonc, so it is not a Jaari folder`), 1);
  }

  let removed = false;
  if (deps.platform === "darwin") {
    const plist = join(deps.homedir, "Library", "LaunchAgents", `${svc.label}.plist`);
    if (await deps.exists(plist)) {
      await deps.exec("launchctl", ["bootout", `gui/${deps.uid}/${svc.label}`]); // fails when not loaded, which is fine
      await deps.remove(plist);
      say(`Stopped the service ${svc.label} and removed ${plist}.`);
      removed = true;
    }
  }
  if (deps.platform === "linux" && (await deps.exists(svc.unit))) {
    say("The system service needs root to remove. Run:");
    say(`  sudo systemctl disable --now ${svc.name}.service && sudo rm ${svc.unit}`);
    if (await deps.exists(svc.credstore)) say(`  sudo rm -r ${svc.credstore}`);
    removed = true;
  }
  // A running daemon still uses the installed version and holds the stores open.
  if ((await deps.daemonRunning(socketPath(paths.data))) !== "stopped") return (say("jaari: a daemon is still running; stop it, then run `jaari uninstall` again. The installed versions and the data were not removed."), 1);

  for (const path of [join(paths.home, "current"), join(paths.home, "versions")]) {
    if (!(await deps.exists(path))) continue;
    await deps.remove(path);
    say(`Removed ${path}.`);
    removed = true;
  }
  if (!removed) say("No Jaari service or installed version found; nothing to remove.");

  if (!values.purge) {
    const kept = [];
    for (const [name, path] of [["config.jsonc", paths.config], ["data", paths.data], ["credentials", paths.credentials]] as const) if (await deps.exists(path)) kept.push(name);
    if (kept.length > 0) say(`Kept in ${paths.home}: ${kept.join(", ")}.`);
    say("Last step: npm uninstall --global jaari");
    return 0;
  }

  // A Jaari folder that is a link: the data is where it points, so that is what goes, and what the owner is shown.
  const target = await realpath(paths.home).catch(() => paths.home);
  say(`This deletes ${target}: the conversation, the config and the credential files in it. They cannot be restored.`);
  const cancelled = () => (say("Cancelled; the data was kept. The service and installed versions removed above stay removed."), 1);
  const prompter = createPrompter(io);
  try {
    if ((await prompter.ask('Type "delete" to delete it')) !== "delete") return cancelled();
  } catch (error) {
    if (!(error instanceof InputEnded)) throw error;
    return cancelled();
  } finally {
    prompter.close();
  }
  await deps.remove(target);
  if (target !== paths.home) await deps.remove(paths.home);
  say(`Deleted ${target}.`);
  if (deps.platform === "darwin" && (await deps.exists(log))) {
    await deps.remove(log);
    say(`Deleted ${log}.`);
  }
  say(deps.platform === "darwin"
    ? 'Secrets in the OS keychain are not removed: open Keychain Access, search for "jaari", and delete the entries.'
    : "Secrets in the OS keychain are not removed: delete the jaari entries with the Secret Service tool of your desktop.");
  say("Last step: npm uninstall --global jaari");
  return 0;
}

export const run: Command = (args, io) => uninstall(args, io);
