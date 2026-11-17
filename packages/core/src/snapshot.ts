// The local snapshot (ADR-082, ADR-122): a copy of the SQLite stores and the config, taken before anything changes
// their shape, kept in the data folder, last two only. `jaari rollback` restores one. The encrypted backup of
// ADR-027 replaces it in Phase 3.
import { chmod, copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { storeVersion } from "./database.js";

export type Snapshot = { name: string; dir: string; at: string; reason: string; stores: Record<string, number>; config: boolean };
export type SnapshotPlace = { dataDir: string; configPath?: string };

const KEEP = 2;
const MANIFEST = "manifest.json";
const root = (dataDir: string) => join(dataDir, "snapshots");

// Complete snapshots, oldest first. One without a manifest was cut short and does not count.
export async function listSnapshots(dataDir: string): Promise<Snapshot[]> {
  const found: Snapshot[] = [];
  for (const name of (await readdir(root(dataDir)).catch(() => [])).sort()) {
    const dir = join(root(dataDir), name);
    const manifest = await readFile(join(dir, MANIFEST), "utf8").then((text) => JSON.parse(text) as Omit<Snapshot, "name" | "dir">, () => undefined);
    if (manifest) found.push({ ...manifest, name, dir });
  }
  return found;
}

// `reason` names why it was taken ("pre-migration", "before-rollback"); it is part of the folder name.
export async function takeSnapshot(place: SnapshotPlace & { reason: string; now?: Date }): Promise<Snapshot> {
  if (!/^[a-z][a-z-]*$/.test(place.reason)) throw new Error(`a snapshot reason is a short lowercase name, not ${JSON.stringify(place.reason)}`);
  const at = (place.now ?? new Date()).toISOString();
  const name = `${at.replace(/[:.]/g, "-")}-${place.reason}`;
  const dir = join(root(place.dataDir), name);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(root(place.dataDir), 0o700); // `recursive` gives a parent the default mode
  const stores: Record<string, number> = {};
  for (const file of (await readdir(place.dataDir)).filter((entry) => entry.endsWith(".db")).sort()) {
    // SQLite's online backup: a consistent copy, with what the write-ahead log holds, even while the store is open.
    const source = new DatabaseSync(join(place.dataDir, file), { readOnly: true });
    try {
      await backup(source, join(dir, file));
    } finally {
      source.close();
    }
    await chmod(join(dir, file), 0o600);
    stores[file] = storeVersion(join(dir, file))!;
  }
  const config = place.configPath !== undefined && (await copyFile(place.configPath, join(dir, "config.jsonc")).then(() => true, () => false));
  if (config) await chmod(join(dir, "config.jsonc"), 0o600);
  // Last, so a snapshot that was cut short has no manifest.
  await writeFile(join(dir, MANIFEST), JSON.stringify({ at, reason: place.reason, stores, config }, null, 2) + "\n", { mode: 0o600 });
  const complete = await listSnapshots(place.dataDir);
  const keep = new Set(complete.slice(-KEEP).map((snapshot) => snapshot.name));
  for (const entry of await readdir(root(place.dataDir))) if (!keep.has(entry)) await rm(join(root(place.dataDir), entry), { recursive: true, force: true });
  return { name, dir, at, reason: place.reason, stores, config };
}

// Puts a snapshot's stores and config back. The daemon must be stopped: the caller checks. A store made after the
// snapshot stays where it is; the Jaari of that time does not open it.
export async function restoreSnapshot(place: SnapshotPlace, snapshot: Snapshot): Promise<void> {
  const put = async (from: string, to: string) => {
    await copyFile(from, `${to}.restoring`);
    await rename(`${to}.restoring`, to); // one step, so a crash leaves the old file or the new one, never half
  };
  for (const file of Object.keys(snapshot.stores)) {
    const live = join(place.dataDir, file);
    // The log of the store being replaced must not be replayed over the restored one.
    await rm(`${live}-wal`, { force: true });
    await rm(`${live}-shm`, { force: true });
    await put(join(snapshot.dir, file), live);
  }
  if (snapshot.config && place.configPath !== undefined) await put(join(snapshot.dir, "config.jsonc"), place.configPath);
}
