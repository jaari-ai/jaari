import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore, takeSnapshot } from "@jaari/core";
import { expect, it } from "vitest";
import { doctor, type DoctorDeps } from "./doctor.js";
import { fakeDaemon, install, OWNER, terminal } from "./testing.js";

const deps = (over: Partial<DoctorDeps> = {}): DoctorDeps => ({
  keychain: () => ({ resolve: () => Promise.reject(new Error("no entry")), health: () => Promise.resolve({ ok: true }) }),
  platform: "darwin", node: "26.13.1", unitPath: "/nonexistent/jaari.service",
  exec: () => Promise.resolve("FileVault is On.\n"),
  ...over,
});
const check = async (home: string, over: Partial<DoctorDeps> = {}) => {
  const { io, shown } = terminal();
  const code = await doctor(["--home", home], io, deps(over));
  return { code, shown: shown(), lines: shown().trim().split("\n") };
};

it("passes a healthy install, and shows no secret", async () => {
  const { home, data } = await install();
  openStore(join(data, "session.db"), OWNER).close();
  await chmod(join(data, "session.db"), 0o600);
  const stop = await fakeDaemon(data);
  const { code, shown } = await check(home);
  await stop();
  expect(shown).toContain("Healthy, 0 warnings.");
  expect(code).toBe(0);
  for (const line of ["ok    Node 26.13.1", 'ok    the key of provider "faux" can be read', "ok    session.db is at version", "ok    the daemon answers", "ok    disk encryption: FileVault is on", "host-credential, plain owner-only files"]) expect(shown).toContain(line);
  expect(shown).not.toContain("scripted-key");
});

it("fails when the daemon is down, a key is missing, or the data is open to others", async () => {
  const { home, data, credentials } = await install();
  await rm(join(credentials, "llm.faux"));
  await writeFile(join(data, "events.ndjson"), "", { mode: 0o644 });
  const { code, shown } = await check(home);
  expect(code).toBe(1);
  expect(shown).toMatch(/FAIL {2}the daemon is not running/);
  expect(shown).toMatch(/FAIL {2}the key of provider "faux"/);
  expect(shown).toMatch(/FAIL {2}open to other users: .*events\.ndjson/);
  expect(shown).toContain("3 failed");
});

it("stops at a config it cannot read, and names each problem", async () => {
  const { home, config } = await install();
  await writeFile(config, '{ "version": 1, "llm": {}, "deploymnet": {} }');
  const { code, lines } = await check(home);
  expect(code).toBe(1);
  expect(lines).toContain("FAIL  config: /deploymnet: unknown key");
  expect(lines.some((line) => line.includes("daemon"))).toBe(false);
  expect((await check(join(home, "missing"))).shown).toContain("run `jaari init`");
});

it("warns without failing: FileVault off, a config others can read, a hold that failed since the last start", async () => {
  const { home, data, config } = await install();
  await chmod(config, 0o644);
  const event = (type: string) => JSON.stringify({ at: "2026-11-17T10:00:00.000Z", type }) + "\n";
  await writeFile(join(data, "events.ndjson"), event("power.hold.failed") + event("daemon.start") + event("power.hold.failed"), { mode: 0o600 });
  const stop = await fakeDaemon(data);
  const off = await check(home, { exec: () => Promise.resolve("FileVault is Off.\n") });
  await writeFile(join(data, "events.ndjson"), event("power.hold.failed") + event("daemon.start"), { mode: 0o600 });
  const fixed = await check(home, { platform: "linux" });
  await stop();
  expect(off.code).toBe(0);
  expect(off.shown).toContain("Healthy, 3 warnings.");
  for (const line of ["warn  disk encryption: FileVault is off", "warn  config", "warn  the laptop is not kept awake: caffeinate"]) expect(off.shown).toContain(line);
  expect(fixed.shown).not.toContain("not kept awake"); // the failure was before the last start
  expect(fixed.shown).toContain("info  disk encryption: not checked on linux");
});

it("reports the form of secret zero under systemd, a store newer than this Jaari, and the latest snapshot", async () => {
  const { home, data } = await install();
  const unitPath = join(await mkdtemp(join(tmpdir(), "jd-unit-")), "jaari.service");
  await writeFile(unitPath, "[Service]\nLoadCredentialEncrypted=llm.faux:/etc/jaari/credstore/llm.faux.cred\n");
  const store = openStore(join(data, "session.db"), OWNER);
  store.close();
  await takeSnapshot({ dataDir: data, reason: "pre-migration" });
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(join(data, "session.db"));
  db.exec("PRAGMA user_version = 99");
  db.close();
  for (const file of ["session.db", "snapshots"]) await chmod(join(data, file), 0o700);
  const encrypted = await check(home, { platform: "linux", unitPath });
  expect(encrypted.shown).toContain("ok    secrets: host-credential, encrypted with systemd-creds");
  expect(encrypted.shown).not.toContain("the key of provider"); // systemd reads the keys, not this user
  expect(encrypted.shown).toMatch(/FAIL {2}session\.db is at version 99, newer than this Jaari reads/);
  expect(encrypted.shown).toMatch(/info {2}latest snapshot: .* \(pre-migration\)/);
  await writeFile(unitPath, "[Service]\nLoadCredential=llm.faux:/home/o/.jaari/credentials/llm.faux\n");
  expect((await check(home, { platform: "linux", unitPath })).shown).toContain("warn  secrets: host-credential, plain files that systemd hands over");
  expect((await check(home, { node: "22.11.0" })).shown).toContain("FAIL  Node 22.11.0");
});
