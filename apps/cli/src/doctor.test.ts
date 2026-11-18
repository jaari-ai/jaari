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
  const fixed = await check(home, { platform: "linux", exec: () => Promise.reject(new Error("no lsblk")) });
  await stop();
  expect(off.code).toBe(0);
  expect(off.shown).toContain("Healthy, 3 warnings.");
  for (const line of ["warn  disk encryption: FileVault is off", "warn  config", "warn  the laptop is not kept awake: caffeinate"]) expect(off.shown).toContain(line);
  expect(fixed.shown).not.toContain("not kept awake"); // the failure was before the last start
  expect(fixed.shown).toContain("info  disk encryption: could not be read here");
});

it("tells an encrypted Linux volume from a plain one, a host without a TPM, and reads the keys that Compose hands over", async () => {
  const { home, credentials, config } = await install();
  const unitPath = join(await mkdtemp(join(tmpdir(), "jd-unit-")), "jaari.service");
  await writeFile(unitPath, "[Service]\nLoadCredentialEncrypted=llm.faux:/etc/jaari/credstore/llm.faux.cred\n");
  const calls: string[][] = [];
  const linux = (type: string): Partial<DoctorDeps> => ({
    platform: "linux", unitPath,
    exec: (command, args) => {
      calls.push([command, ...args]);
      if (command === "systemd-creds") return Promise.reject(new Error("no TPM"));
      return Promise.resolve(command === "findmnt" ? "/dev/mapper/root[/var]\n" : type);
    },
  });
  const encrypted = await check(home, linux("crypt\npart\ndisk\n"));
  expect(encrypted.shown).toContain("ok    disk encryption: the data folder is on an encrypted volume");
  expect(encrypted.shown).toMatch(/encrypted with systemd-creds\n/);
  expect(calls).toContainEqual(["lsblk", "-s", "-n", "-o", "TYPE", "/dev/mapper/root"]); // no btrfs-style [/subvolume]
  expect((await check(home, linux("part\ndisk\n"))).shown).toContain("warn  disk encryption: the data folder is not on an encrypted volume");

  const elsewhere = await mkdtemp(join(tmpdir(), "jd-run-"));
  await chmod(elsewhere, 0o700);
  await writeFile(join(elsewhere, "llm.faux"), "scripted-key\n", { mode: 0o600 });
  await rm(join(credentials, "llm.faux"));
  await chmod(config, 0o600);
  const compose = await check(home, { credentialsDir: elsewhere });
  expect(compose.shown).toContain(`host-credential, plain owner-only files in ${elsewhere}`);
  expect(compose.shown).toContain('ok    the key of provider "faux" can be read');
});

it("reports what it cannot read as a failure, never a crash: a dangling link, a damaged store, a silent socket", async () => {
  const { home, data } = await install();
  const { symlink } = await import("node:fs/promises");
  await symlink(join(data, "gone"), join(data, "link"));
  await writeFile(join(data, "session.db"), "not a database", { mode: 0o600 });
  // holds the socket without answering, as a hung daemon would
  const { createServer } = await import("node:net");
  const { socketPath } = await import("@jaari/channels");
  const server = createServer(() => {});
  await new Promise<void>((done) => server.listen(socketPath(data), done));
  await chmod(socketPath(data), 0o600);
  const { code, shown } = await check(home);
  server.close();
  expect(code).toBe(1);
  expect(shown).toMatch(/FAIL {2}session\.db cannot be read: .*`jaari rollback`/);
  expect(shown).toContain("FAIL  something holds the daemon's socket but does not answer");
  expect(shown).not.toContain("open to other users"); // the link's own mode is not the data's
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
  expect(encrypted.shown).toContain("ok    secrets: host-credential, encrypted with systemd-creds and sealed to the TPM");
  expect(encrypted.shown).not.toContain("the key of provider"); // systemd reads the keys, not this user
  expect(encrypted.shown).toMatch(/FAIL {2}session\.db is at version 99, newer than this Jaari reads/);
  expect(encrypted.shown).toMatch(/info {2}latest snapshot: .* \(pre-migration\)/);
  await writeFile(unitPath, "[Service]\nLoadCredential=llm.faux:/home/o/.jaari/credentials/llm.faux\n");
  expect((await check(home, { platform: "linux", unitPath })).shown).toContain("warn  secrets: host-credential, plain files that systemd hands over");
  expect((await check(home, { node: "22.11.0" })).shown).toContain("FAIL  Node 22.11.0");
});
