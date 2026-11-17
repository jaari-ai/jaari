import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { STORE_MIGRATIONS, openStore } from "./store.js";

const OWNER = "11111111-1111-4111-8111-111111111111";
const message = (text: string) => ({ role: "user" as const, content: [{ type: "text" as const, text }], timestamp: 1 });

it("never hands out a row number again after the owner migration, even one deleted before it (ADR-119)", async () => {
  const path = join(await mkdtemp(join(tmpdir(), "jaari-store-")), "session.db");
  const old = new DatabaseSync(path);
  STORE_MIGRATIONS[0]!(old, OWNER); // the schema as roadmap 0.5 to 0.8 wrote it, with no version and no owner
  const add = old.prepare("INSERT INTO transcript (at, message) VALUES (?, ?)");
  for (let i = 1; i <= 20; i++) add.run("2026-11-16T10:00:00.000Z", JSON.stringify(message(`m${i}`)));
  old.exec("DELETE FROM transcript WHERE seq > 15 OR seq IN (3, 4)"); // the counter stays at 20; the highest row left is 15
  old.close();

  const store = openStore(path, OWNER);
  expect(store.load().map(({ seq }) => seq)).toEqual([1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  expect(store.append(message("next"))).toBe(21); // not 16: an old reference to row 16 must never find a new message
  store.close();
});

it("keeps the counter of an empty transcript whose rows were all deleted", async () => {
  const path = join(await mkdtemp(join(tmpdir(), "jaari-store-")), "session.db");
  const old = new DatabaseSync(path);
  STORE_MIGRATIONS[0]!(old, OWNER);
  old.prepare("INSERT INTO transcript (at, message) VALUES (?, ?)").run("2026-11-16T10:00:00.000Z", JSON.stringify(message("gone")));
  old.exec("DELETE FROM transcript");
  old.close();
  const store = openStore(path, OWNER);
  expect(store.append(message("first after"))).toBe(2);
  store.close();
});
