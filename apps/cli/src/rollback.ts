// `jaari rollback [--home <dir>] [--config <file>] [--data <dir>] [--list] [--yes]`: put back the stores and the
// config of the latest snapshot (ADR-082, ADR-122). The data as it is now is snapshotted first, so a second run undoes it.
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { socketPath } from "@jaari/channels";
import { listSnapshots, restoreSnapshot, restoring, takeSnapshot } from "@jaari/core";
import { jaariPaths } from "@jaari/core/config";
import type { Command } from "./io.js";
import { createPrompter, InputEnded } from "./prompt.js";
import { daemonRunning } from "./socket.js";
import { swapBack } from "./versions.js";

export const run: Command = async (args, io) => {
  const { values } = parseArgs({ args, options: { home: { type: "string" }, config: { type: "string" }, data: { type: "string" }, list: { type: "boolean", default: false }, yes: { type: "boolean", default: false } } });
  const say = (line: string) => io.output.write(`${line}\n`);
  const paths = jaariPaths(values.home ? resolve(values.home) : undefined);
  const place = { dataDir: values.data ? resolve(values.data) : paths.data, configPath: values.config ? resolve(values.config) : paths.config };
  const snapshots = await listSnapshots(place.dataDir);
  const describe = (s: (typeof snapshots)[number]) => `${s.at}  ${s.reason}  ${Object.entries(s.stores).map(([file, version]) => `${file} v${version}`).join(", ")}${s.config ? ", config" : ""}`;
  if (values.list) {
    for (const snapshot of snapshots) say(describe(snapshot));
    if (snapshots.length === 0) say("No snapshot yet. Jaari takes one before it migrates a store.");
    return 0;
  }
  const unfinished = await restoring(place.dataDir);
  const latest = unfinished ? snapshots.find((snapshot) => snapshot.name === unfinished) : snapshots.at(-1);
  if (!latest) return (say(unfinished ? `jaari: the snapshot ${unfinished} that a rollback was restoring is gone; restore from a backup` : `jaari: no snapshot in ${place.dataDir}; nothing to roll back to`), 1);
  // A running daemon holds the stores open and would write over the restored ones.
  if ((await daemonRunning(socketPath(place.dataDir))) !== "stopped") return (say("jaari: the daemon is running; stop it first, then run `jaari rollback` again"), 1);
  if (unfinished) {
    // The data as it was before that rollback is already a snapshot: finish the restore, take no new one.
    say(`Finishing a rollback that was cut short: ${describe(latest)}`);
    await restoreSnapshot(place, latest);
    return (say("Restored. Run `jaari rollback` again to undo it."), 0);
  }
  if (!values.yes) {
    // ADR-076: it replaces the owner's data, so a person confirms it.
    if (!io.isTTY) return (say("jaari: rollback replaces the current data; run it in a terminal, or pass --yes"), 2);
    say(`This replaces the current data with the snapshot: ${describe(latest)}`);
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
  await restoreSnapshot(place, latest);
  say(`Restored: ${describe(latest)}`);
  say("The data from just before this is kept as a snapshot: run `jaari rollback` again to undo.");
  // The version goes back with the data when `jaari update` installed one (ADR-124); a second run swaps both again.
  const swapped = await swapBack(paths.home);
  if (swapped) say(`The active version is now ${swapped.current ?? "the one npm installed"}. Start the daemon.`);
  else say("Start the Jaari version of that time. A newer one migrates the stores again, after a new snapshot.");
  return 0;
};
