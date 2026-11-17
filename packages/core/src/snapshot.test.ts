import { mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openDatabase, storeVersion, type Migration } from "./database.js";
import { listSnapshots, restoreSnapshot, takeSnapshot } from "./snapshot.js";

const OWNER = "11111111-1111-4111-8111-111111111111";
const V1: Migration[] = [(db) => db.exec("CREATE TABLE note (text TEXT)")];
const V2: Migration[] = [...V1, (db) => db.exec("ALTER TABLE note ADD COLUMN at TEXT")];
const notes = (path: string) => {
  const db = new DatabaseSync(path);
  try {
    return db.prepare("SELECT text FROM note").all().map((row) => String(row.text));
  } finally {
    db.close();
  }
};

async function place() {
  const dataDir = await mkdtemp(join(tmpdir(), "jaari-snap-"));
  const configPath = join(dataDir, "..", `${dataDir.split("/").at(-1)}.jsonc`);
  await writeFile(configPath, '{ "version": 1 } // mine\n');
  const db = openDatabase(join(dataDir, "session.db"), OWNER, V1);
  db.exec("PRAGMA journal_mode = WAL");
  db.prepare("INSERT INTO note VALUES (?)").run("before");
  return { dataDir, configPath, db };
}
const at = (minute: number) => new Date(Date.UTC(2026, 10, 17, 12, minute));

describe("snapshot (ADR-082, ADR-122)", () => {
  it("copies an open store with its log, and the config, owner-only, with the store versions", async () => {
    const { dataDir, configPath, db } = await place();
    const snapshot = await takeSnapshot({ dataDir, configPath, reason: "pre-migration", now: at(0) }); // the store is still open
    db.close();
    expect(snapshot.name).toBe("2026-11-17T12-00-00-000Z-pre-migration");
    expect(snapshot).toMatchObject({ reason: "pre-migration", stores: { "session.db": 1 }, config: true });
    expect(notes(join(snapshot.dir, "session.db"))).toEqual(["before"]);
    expect(await readFile(join(snapshot.dir, "config.jsonc"), "utf8")).toContain("// mine");
    expect((await stat(join(dataDir, "snapshots"))).mode & 0o777).toBe(0o700);
    expect((await stat(snapshot.dir)).mode & 0o777).toBe(0o700);
    for (const file of await readdir(snapshot.dir)) expect((await stat(join(snapshot.dir, file))).mode & 0o077).toBe(0);
    await expect(takeSnapshot({ dataDir, reason: "../x" })).rejects.toThrow("short lowercase name");
  });

  it("restores the data of before a migration, and drops the newer log", async () => {
    const { dataDir, configPath, db } = await place();
    db.close();
    const snapshot = await takeSnapshot({ dataDir, configPath, reason: "pre-migration", now: at(0) });
    const newer = openDatabase(join(dataDir, "session.db"), OWNER, V2);
    newer.exec("PRAGMA journal_mode = WAL");
    newer.prepare("INSERT INTO note VALUES (?, ?)").run("after", "now");
    await writeFile(configPath, '{ "version": 2 }\n');
    newer.close();
    await writeFile(join(dataDir, "session.db-wal"), "a log that a crash left beside the newer store");

    await restoreSnapshot({ dataDir, configPath }, snapshot);
    expect(storeVersion(join(dataDir, "session.db"))).toBe(1);
    expect(notes(join(dataDir, "session.db"))).toEqual(["before"]);
    expect(await readFile(configPath, "utf8")).toContain("// mine");
    expect((await readdir(dataDir)).filter((file) => file.includes("restoring") || file.endsWith("-wal"))).toEqual([]);
  });

  it("keeps the last two, and removes one that was cut short", async () => {
    const { dataDir, db } = await place();
    db.close();
    for (const minute of [0, 1]) await takeSnapshot({ dataDir, reason: "pre-migration", now: at(minute) });
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(dataDir, "snapshots", "2026-11-17T12-01-30-000Z-pre-migration")); // no manifest
    await takeSnapshot({ dataDir, reason: "before-rollback", now: at(2) });
    expect((await listSnapshots(dataDir)).map((snapshot) => [snapshot.at.slice(14, 16), snapshot.reason, snapshot.config])).toEqual([["01", "pre-migration", false], ["02", "before-rollback", false]]);
    expect(await readdir(join(dataDir, "snapshots"))).toHaveLength(2);
    expect(await listSnapshots(join(dataDir, "nothing-here"))).toEqual([]);
  });

  it("reads a store's version without making or changing the file", async () => {
    const { dataDir, db } = await place();
    db.close();
    expect(storeVersion(join(dataDir, "session.db"))).toBe(1);
    expect(storeVersion(join(dataDir, "usage.db"))).toBeUndefined();
    expect(await readdir(dataDir)).not.toContain("usage.db");
  });
});
