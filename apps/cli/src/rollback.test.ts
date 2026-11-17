import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { listSnapshots, openStore, takeSnapshot } from "@jaari/core";
import { expect, it } from "vitest";
import { run } from "./rollback.js";
import { fakeDaemon, install, OWNER, terminal } from "./testing.js";

const text = (text: string) => ({ role: "user" as const, content: [{ type: "text" as const, text }], timestamp: 1 });
const said = (data: string) => {
  const store = openStore(join(data, "session.db"), OWNER);
  try {
    return store.load().map(({ message }) => JSON.stringify(message.content));
  } finally {
    store.close();
  }
};
async function withSnapshot() {
  const made = await install();
  const store = openStore(join(made.data, "session.db"), OWNER);
  store.append(text("before"));
  await takeSnapshot({ dataDir: made.data, configPath: made.config, reason: "pre-migration", now: new Date("2026-11-17T12:00:00Z") });
  store.append(text("after"));
  store.close();
  await made.write({ events: { retentionDays: 9 } });
  return made;
}
const rollback = async (home: string, args: string[], lines: string[] = [], isTTY = false) => {
  const { io, shown } = terminal(lines, isTTY);
  return { code: await run(["--home", home, ...args], io), shown: shown() };
};

it("restores the stores and the config of the latest snapshot, and a second run undoes it", async () => {
  const { home, data, config } = await withSnapshot();
  const done = await rollback(home, ["--yes"]);
  expect(done.code).toBe(0);
  expect(said(data).join()).toContain("before");
  expect(said(data).join()).not.toContain("after");
  expect(await readFile(config, "utf8")).not.toContain("retentionDays");
  expect((await listSnapshots(data)).map((snapshot) => snapshot.reason)).toEqual(["pre-migration", "before-rollback"]);

  expect((await rollback(home, ["--yes"])).code).toBe(0); // the latest is now the data from before the rollback
  expect(said(data).join()).toContain("after");
  expect(await readFile(config, "utf8")).toContain("retentionDays");
});

it("refuses while the daemon runs, without a snapshot, and without a person or --yes", async () => {
  const { home, data } = await withSnapshot();
  const stop = await fakeDaemon(data);
  const running = await rollback(home, ["--yes"]);
  await stop();
  expect(running).toMatchObject({ code: 1, shown: expect.stringContaining("stop it first") as string });
  expect((await rollback(home, [])).code).toBe(2); // a pipe is not a person (ADR-076)
  expect((await rollback(home, [], ["no"], true)).shown).toContain("Cancelled; nothing was changed.");
  expect((await rollback(home, [], [], true)).shown).toContain("Cancelled"); // the input ended
  expect(said(data).join()).toContain("after");
  expect(await listSnapshots(data)).toHaveLength(1);

  const typed = await rollback(home, [], ["yes"], true);
  expect(typed.code).toBe(0);
  expect(typed.shown).toContain("This replaces the current data with the snapshot: 2026-11-17T12:00:00.000Z  pre-migration  session.db v");

  const empty = await install();
  expect(await rollback(empty.home, ["--yes"])).toMatchObject({ code: 1, shown: expect.stringContaining("no snapshot") as string });
  expect((await rollback(empty.home, ["--list"])).shown).toContain("No snapshot yet");
  expect((await rollback(home, ["--list"])).shown.trim().split("\n")).toHaveLength(2);
});
