// Opens one of Jaari's SQLite stores (ADR-056, ADR-119): runs its migrations forward, and refuses a store written
// by a newer Jaari or owned by someone else. Every store goes through here, so both rules hold for all of them.
import { chmodSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

// One step per schema version, in order: MIGRATIONS[0] takes an empty or pre-version store to version 1. A step may
// only add: a released step is never edited, because stores in the field have already run it.
export type Migration = (db: DatabaseSync, ownerId: string) => void;

export function openDatabase(path: string, ownerId: string, migrations: readonly Migration[]): DatabaseSync {
  const db = new DatabaseSync(path);
  try {
    // Before any migration: a store of another owner is never read, changed, or given this owner's id.
    db.exec("CREATE TABLE IF NOT EXISTS owner (id TEXT PRIMARY KEY)");
    chmodSync(path, 0o600); // SQLite makes the file with the default mode; a store is private (ADR-028)
    const owners = db.prepare("SELECT id FROM owner").all().map((row) => String(row.id));
    if (owners.length > 0 && !owners.includes(ownerId)) {
      throw new Error(`${path} belongs to another owner (${owners.join(", ")}), not ${ownerId}; check "owner.id" in the config and the data folder`);
    }
    const version = Number(db.prepare("PRAGMA user_version").get()!.user_version);
    // A binary older than its data refuses to start (ADR-056).
    if (version > migrations.length) {
      throw new Error(`${path} is at version ${version}, newer than this Jaari reads (${migrations.length}); update Jaari, or restore the data from before the update`);
    }
    // The owner is recorded in the same transaction as the first step, so no store is ever versioned but unowned.
    // One that is (an earlier build could leave it) holds rows of an unknown owner: refused, never claimed.
    if (owners.length === 0 && version > 0) {
      throw new Error(`${path} is at version ${version} but records no owner; restore it from a backup, or move it away to start a new store`);
    }
    for (let at = version; at < migrations.length; at++) {
      // One transaction per step, with the version: a failed step leaves the store exactly as it was.
      db.exec("BEGIN IMMEDIATE");
      try {
        if (at === version && owners.length === 0) db.prepare("INSERT INTO owner VALUES (?)").run(ownerId);
        migrations[at]!(db, ownerId);
        db.exec(`PRAGMA user_version = ${at + 1}`);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

// The schema version of a store, read without changing it; undefined when there is no file yet. For what must know
// before the store opens whether opening will migrate it: the snapshot and `jaari doctor` (ADR-122).
export function storeVersion(path: string): number | undefined {
  if (!existsSync(path)) return undefined;
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return Number(db.prepare("PRAGMA user_version").get()!.user_version);
  } finally {
    db.close();
  }
}
