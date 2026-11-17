import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { openEventLog } from "./events.js";

it("drops lines older than the retention period when it opens (ADR-032)", async () => {
  const path = join(await mkdtemp(join(tmpdir(), "jaari-events-")), "events.ndjson");
  const now = Date.parse("2026-11-16T12:00:00Z");
  await writeFile(path, ['{"at":"2026-10-01T00:00:00.000Z","type":"old"}', '{"at":"2026-11-10T00:00:00.000Z","type":"recent"}', "not json"].join("\n") + "\n");
  openEventLog(path, "11111111-1111-4111-8111-111111111111", 30, now).write({ type: "new" });
  const types = (await readFile(path, "utf8")).trim().split("\n").map((line) => (line.startsWith("{") ? JSON.parse(line).type : line));
  expect(types).toEqual(["recent", "not json", "new"]);
  expect(JSON.parse((await readFile(path, "utf8")).trim().split("\n").at(-1)!)).toMatchObject({ type: "new", ownerId: "11111111-1111-4111-8111-111111111111" });
});
