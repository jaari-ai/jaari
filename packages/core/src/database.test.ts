import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openDatabase, type Migration } from "./database.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const file = async () => join(await mkdtemp(join(tmpdir(), "jaari-db-")), "x.db");
const version = (db: DatabaseSync) => Number(db.prepare("PRAGMA user_version").get()!.user_version);

const v1: Migration = (db) => db.exec("CREATE TABLE IF NOT EXISTS note (text TEXT NOT NULL)");
const v2: Migration = (db, ownerId) => {
  db.exec("ALTER TABLE note ADD COLUMN owner_id TEXT");
  db.prepare("UPDATE note SET owner_id = ?").run(ownerId);
};

describe("openDatabase (ADR-056, ADR-119)", () => {
  it("runs the missing steps once, in order, and keeps the data", async () => {
    const path = await file();
    const first = openDatabase(path, A, [v1]);
    first.prepare("INSERT INTO note VALUES (?)").run("kept");
    expect(version(first)).toBe(1);
    first.close();
    const second = openDatabase(path, A, [v1, v2]);
    expect(version(second)).toBe(2);
    expect(second.prepare("SELECT text, owner_id FROM note").all()).toEqual([{ text: "kept", owner_id: A }]);
    second.close();
    openDatabase(path, A, [v1, v2]).close(); // nothing left to run: v2 would fail on a second ALTER
  });

  it("takes a store from before versions existed (its tables are there, its version is 0)", async () => {
    const path = await file();
    const old = new DatabaseSync(path);
    old.exec("CREATE TABLE note (text TEXT NOT NULL); INSERT INTO note VALUES ('old')");
    old.close();
    const db = openDatabase(path, A, [v1, v2]);
    expect(db.prepare("SELECT text, owner_id FROM note").all()).toEqual([{ text: "old", owner_id: A }]);
    db.close();
  });

  it("refuses a store written by a newer Jaari, and leaves it as it was", async () => {
    const path = await file();
    openDatabase(path, A, [v1, v2]).close();
    expect(() => openDatabase(path, A, [v1])).toThrow("newer than this Jaari reads (1)");
    const db = new DatabaseSync(path);
    expect(version(db)).toBe(2);
    db.close();
  });

  it("refuses a store of another owner before it migrates anything", async () => {
    const path = await file();
    openDatabase(path, A, [v1]).close();
    expect(() => openDatabase(path, B, [v1, v2])).toThrow(`belongs to another owner (${A}), not ${B}`);
    const db = new DatabaseSync(path);
    expect(version(db)).toBe(1); // v2 did not run, so no row was handed to the wrong owner
    db.close();
    openDatabase(path, A, [v1, v2]).close(); // the right owner still opens it
  });

  it("refuses a store that is versioned but records no owner, instead of claiming it", async () => {
    const path = await file();
    openDatabase(path, A, [v1]).close();
    const db = new DatabaseSync(path);
    db.exec("DELETE FROM owner"); // the state a crash between a step and the owner row could leave in an earlier build
    db.close();
    expect(() => openDatabase(path, B, [v1])).toThrow("records no owner");
    expect(() => openDatabase(path, A, [v1])).toThrow("records no owner");
  });

  it("records the owner in the same transaction as the first step", async () => {
    const path = await file();
    const broken: Migration = () => {
      throw new Error("disk full");
    };
    expect(() => openDatabase(path, A, [broken])).toThrow("disk full");
    const db = new DatabaseSync(path);
    expect(db.prepare("SELECT id FROM owner").all()).toEqual([]); // rolled back with the step
    expect(version(db)).toBe(0);
    db.close();
    openDatabase(path, B, [v1]).close(); // nothing was claimed, so the next start is a clean first open
  });

  it("leaves the store untouched when a step fails", async () => {
    const path = await file();
    const first = openDatabase(path, A, [v1]);
    first.prepare("INSERT INTO note VALUES (?)").run("kept");
    first.close();
    const broken: Migration = (db) => {
      db.exec("DELETE FROM note");
      throw new Error("disk full");
    };
    expect(() => openDatabase(path, A, [v1, broken])).toThrow("disk full");
    const db = new DatabaseSync(path);
    expect(version(db)).toBe(1);
    expect(db.prepare("SELECT text FROM note").all()).toEqual([{ text: "kept" }]);
    db.close();
  });

  it("makes a store owner-only, a new one and one that was open to others (ADR-028)", async () => {
    const { chmod, stat } = await import("node:fs/promises");
    const path = join(await mkdtemp(join(tmpdir(), "jaari-db-mode-")), "s.db");
    openDatabase(path, "11111111-1111-4111-8111-111111111111", []).close();
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    await chmod(path, 0o644);
    openDatabase(path, "11111111-1111-4111-8111-111111111111", []).close();
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});
