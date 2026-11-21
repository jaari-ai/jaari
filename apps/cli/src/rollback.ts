// `jaari rollback [--home <dir>] [--config <file>] [--data <dir>] [--list] [--yes]`: put back the stores and the
// config of the latest snapshot (ADR-082, ADR-122). The data as it is now is snapshotted first, so a second run undoes it.
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { socketPath } from "@jaari/channels";
import { listSnapshots, restoreSnapshot, restoring, takeSnapshot } from "@jaari/core";
import { jaariPaths } from "@jaari/core/config";
import type { Command } from "./io.js";
import { createPrompter, InputEnded } from "./prompt.js";
import { daemonRunning } from "./socket.js";
import { pendingPath, readPending, readState, setState } from "./versions.js";

export const run: Command = async (args, io) => {
  const { values } = parseArgs({ args, options: { home: { type: "string" }, config: { type: "string" }, data: { type: "string" }, list: { type: "boolean", default: false }, yes: { type: "boolean", default: false } } });
  const say = (line: string) => io.output.write(`${line}\n`);
  const paths = jaariPaths(values.home ? resolve(values.home) : undefined);
  const place = { dataDir: values.data ? resolve(values.data) : paths.data, configPath: values.config ? resolve(values.config) : paths.config };
  const snapshots = await listSnapshots(place.dataDir);
  const describe = (s: (typeof snapshots)[number]) => `${s.at}  ${s.reason}  ${Object.entries(s.stores).map(([file, version]) => `${file} v${version}`).join(", ")}${s.config ? ", config" : ""}${s.version ? `  by ${s.version}` : ""}`;
  if (values.list) {
    for (const snapshot of snapshots) say(describe(snapshot));
    if (snapshots.length === 0) say("No snapshot yet. Jaari takes one before it migrates a store, and when a new version starts.");
    return 0;
  }
  const unfinished = await restoring(place.dataDir);
  // The version a cut-short rollback was switching to, written before it started (ADR-124).
  const pending = await readPending(paths.home);
  const latest = unfinished ? snapshots.find((snapshot) => snapshot.name === unfinished) : snapshots.at(-1);
  if (!latest && !pending) return (say(unfinished ? `jaari: the snapshot ${unfinished} that a rollback was restoring is gone; restore from a backup` : `jaari: no snapshot in ${place.dataDir}; nothing to roll back to`), 1);
  // A running daemon holds the stores open and would write over the restored ones.
  if ((await daemonRunning(socketPath(place.dataDir))) !== "stopped") return (say("jaari: the daemon is running; stop it first, then run `jaari rollback` again"), 1);
  const finishVersion = async (state: Awaited<ReturnType<typeof readPending>>) => {
    if (!state) return;
    await setState(paths.home, state);
    await rm(pendingPath(paths.home), { force: true });
    say(`The active version is now ${state.current ?? "the one npm installed"}. Start the daemon.`);
  };
  if (unfinished || pending) {
    // The data as it was before that rollback is already a snapshot: finish it, take no new one.
    say("Finishing a rollback that was cut short.");
    if (unfinished && latest) await restoreSnapshot(place, latest);
    await finishVersion(pending);
    return (say("Restored. Run `jaari rollback` again to undo it."), 0);
  }
  if (!values.yes) {
    // ADR-076: it replaces the owner's data, so a person confirms it.
    if (!io.isTTY) return (say("jaari: rollback replaces the current data; run it in a terminal, or pass --yes"), 2);
    say(`This replaces the current data with the snapshot: ${describe(latest!)}`);
    const prompter = createPrompter(io);
    try {
      if ((await prompter.ask('Type "yes" to go on')) !== "yes") return (say("Cancelled; nothing was changed."), 1);
    } catch (error) {
      if (!(error instanceof InputEnded)) throw error;
      return (say("Cancelled; nothing was changed."), 1);
    } finally {
      prompter.close();
    }
  }
  await takeSnapshot({ ...place, reason: "before-rollback" });
  // The version goes back with the data when `jaari update` installed one (ADR-124). It is written down first, so a
  // run that is cut short anywhere is finished by the next one, never undone by it.
  const versions = await readState(paths.home);
  const wanted = versions.previous === undefined ? undefined : { current: versions.previous, previous: versions.current };
  if (wanted) await writeFile(pendingPath(paths.home), JSON.stringify(wanted) + "\n", { mode: 0o600 });
  await restoreSnapshot(place, latest!);
  say(`Restored: ${describe(latest!)}`);
  say("The data from just before this is kept as a snapshot: run `jaari rollback` again to undo.");
  if (wanted) await finishVersion(wanted);
  else say("Start the Jaari version of that time. A newer one migrates the stores again, after a new snapshot.");
  return 0;
};
