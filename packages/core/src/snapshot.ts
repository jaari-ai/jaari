// The local snapshot (ADR-082, ADR-122): a copy of the SQLite stores and the config, taken before anything changes
// their shape, kept in the data folder, last two only. `jaari rollback` restores one. The encrypted backup of
// ADR-027 replaces it in Phase 3.
import { chmod, copyFile, mkdir, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { storeVersion } from "./database.js";

// `target`: the store versions the Jaari that took a pre-migration snapshot migrates to.
export type Snapshot = { name: string; dir: string; seq: number; at: string; reason: string; stores: Record<string, number>; config: boolean; target?: Record<string, number> };
export type SnapshotPlace = { dataDir: string; configPath?: string };

const KEEP = 2;
const MANIFEST = "manifest.json";
const NAME = /^(\d{6})-[0-9TZ-]+-[a-z-]+$/; // a sequence number first: the order does not depend on the clock
const root = (dataDir: string) => join(dataDir, "snapshots");
const versions = (value: unknown) =>
  typeof value === "object" && value !== null && Object.entries(value).every(([file, version]) => /^[\w.-]+\.db$/.test(file) && Number.isInteger(version));

// Complete snapshots, oldest first. One whose manifest is missing or unreadable was cut short and does not count.
export async function listSnapshots(dataDir: string): Promise<Snapshot[]> {
  const found: Snapshot[] = [];
  for (const name of (await readdir(root(dataDir)).catch(() => [])).filter((entry) => NAME.test(entry)).sort()) {
    const dir = join(root(dataDir), name);
    const manifest = await readFile(join(dir, MANIFEST), "utf8").then((text) => JSON.parse(text) as Record<string, unknown>).catch(() => undefined);
    if (!manifest || typeof manifest.at !== "string" || typeof manifest.reason !== "string" || typeof manifest.config !== "boolean" || !versions(manifest.stores)) continue;
    if (manifest.target !== undefined && !versions(manifest.target)) continue;
    found.push({ ...(manifest as Omit<Snapshot, "name" | "dir" | "seq">), name, dir, seq: Number(NAME.exec(name)![1]) });
  }
  return found;
}

// `reason` names why it was taken ("pre-migration", "before-rollback"); it is part of the folder name.
export async function takeSnapshot(place: SnapshotPlace & { reason: string; now?: Date; target?: Record<string, number> }): Promise<Snapshot> {
  if (!/^[a-z][a-z-]*$/.test(place.reason)) throw new Error(`a snapshot reason is a short lowercase name, not ${JSON.stringify(place.reason)}`);
  const at = (place.now ?? new Date()).toISOString();
  // One more than any folder there, complete or not, so a new snapshot is always the latest.
  const seq = Math.max(0, ...(await readdir(root(place.dataDir)).catch(() => [])).map((entry) => Number(NAME.exec(entry)?.[1] ?? 0))) + 1;
  const name = `${String(seq).padStart(6, "0")}-${at.replace(/[:.]/g, "-")}-${place.reason}`;
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
  // Last, and whole or not at all, so a snapshot that was cut short has no manifest.
  const manifest = { at, reason: place.reason, stores, config, ...(place.target ? { target: place.target } : {}) };
  await writeFile(join(dir, `${MANIFEST}.tmp`), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
  await rename(join(dir, `${MANIFEST}.tmp`), join(dir, MANIFEST));
  // Only folders this code names are removed; the one a rollback is restoring from is always kept.
  const keep = new Set([...(await listSnapshots(place.dataDir)).slice(-KEEP).map((snapshot) => snapshot.name), name, (await restoring(place.dataDir)) ?? ""]);
  for (const entry of await readdir(root(place.dataDir))) if (NAME.test(entry) && !keep.has(entry)) await rm(join(root(place.dataDir), entry), { recursive: true, force: true });
  return { ...manifest, name, dir, seq };
}

// A rollback writes the name of the snapshot it restores before it starts and removes it when done, so one that was
// cut short is finished by the next run, not replaced by a rollback of the half-restored data.
const MARK = (dataDir: string) => join(root(dataDir), "restoring");
export const restoring = (dataDir: string): Promise<string | undefined> => readFile(MARK(dataDir), "utf8").then((text) => text.trim() || undefined, () => undefined);

// Puts a snapshot's stores and config back. The daemon must be stopped: the caller checks. A store made after the
// snapshot stays where it is; the Jaari of that time does not open it.
export async function restoreSnapshot(place: SnapshotPlace, snapshot: Snapshot): Promise<void> {
  await writeFile(MARK(place.dataDir), snapshot.name + "\n", { mode: 0o600 });
  const put = async (from: string, link: string) => {
    // Written through a link (a dotfiles manager keeps the config as one), so the link stays a link, as `jaari init` does.
    const to = await realpath(link).catch(() => link);
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
  await rm(MARK(place.dataDir));
}
