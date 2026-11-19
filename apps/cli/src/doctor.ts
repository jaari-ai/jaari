// `jaari doctor [--home <dir>] [--config <file>] [--data <dir>]`: a read-only health check that exits 1 when a check
// fails (ADR-032). It changes nothing. A warning does not fail it: `jaari update` rolls back on a failure (ADR-122).
// Checks are added as their features ship.
import { execFile } from "node:child_process";
import { lstat, readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs, promisify } from "node:util";
import { socketPath } from "@jaari/channels";
import { listSnapshots, restoring, STORE_MIGRATIONS, storeVersion } from "@jaari/core";
import { ConfigError, credentialsDirOf, jaariPaths, loadConfig, ownerIdOf, type Config } from "@jaari/core/config";
import { checkLlmConfig, USAGE_MIGRATIONS } from "@jaari/llm";
import { createHostCredentialProvider, createOsKeychainProvider, resolveRef, type VaultProvider } from "@jaari/secrets";
import type { Io } from "./io.js";
import { daemonRunning } from "./socket.js";

// Everything outside the Jaari folder is passed in, so a test never reads the owner's keychain or the real host.
export type DoctorDeps = {
  keychain: () => VaultProvider;
  platform: NodeJS.Platform;
  node: string; // process.versions.node
  exec(command: string, args: string[]): Promise<string>;
  unitPath: string; // the systemd unit that `jaari service install` writes
  credentialsDir?: string; // what systemd or Compose hands over, as the daemon reads it
};
const systemDeps: DoctorDeps = {
  keychain: createOsKeychainProvider,
  platform: process.platform,
  node: process.versions.node,
  exec: (command, args) => promisify(execFile)(command, args, { timeout: 5_000 }).then(({ stdout }) => stdout),
  unitPath: "/etc/systemd/system/jaari.service",
  ...(process.env.CREDENTIALS_DIRECTORY ? { credentialsDir: process.env.CREDENTIALS_DIRECTORY } : {}),
};

type Level = "ok" | "info" | "warn" | "FAIL";
const open = (mode: number) => (mode & 0o077) !== 0; // group or others may read, write, or enter

export async function doctor(args: string[], io: Io, deps: DoctorDeps = systemDeps): Promise<number> {
  const { values } = parseArgs({ args, options: { home: { type: "string" }, config: { type: "string" }, data: { type: "string" } } });
  const paths = jaariPaths(values.home ? resolve(values.home) : undefined);
  const configPath = values.config ? resolve(values.config) : paths.config;
  const dataDir = values.data ? resolve(values.data) : paths.data;
  const found: [Level, string][] = [];
  const add = (level: Level, text: string) => void found.push([level, text]);
  const finish = () => {
    for (const [level, text] of found) io.output.write(`${level.padEnd(4)}  ${text}\n`);
    const count = (level: Level) => found.filter(([l]) => l === level).length;
    io.output.write(count("FAIL") > 0 ? `${count("FAIL")} failed, ${count("warn")} warnings.\n` : `Healthy, ${count("warn")} warnings.\n`);
    return count("FAIL") > 0 ? 1 : 0;
  };

  add(Number(deps.node.split(".")[0]) >= 26 ? "ok" : "FAIL", `Node ${deps.node} (Jaari needs 26 or later, ADR-105)`);

  let config: Config;
  try {
    config = await loadConfig(configPath);
    checkLlmConfig(config.llm);
    ownerIdOf(config);
    add("ok", `config ${configPath}`);
  } catch (error) {
    for (const problem of error instanceof ConfigError ? error.problems : [(error as Error).message]) add("FAIL", `config: ${problem}`);
    return finish(); // every other check reads the config
  }
  if (open((await stat(configPath)).mode)) add("warn", `config ${configPath} can be read by other users; run: chmod 600 ${configPath}`);

  // ADR-028: the data folder is 0700 and its files 0600.
  const data = await stat(dataDir).catch(() => undefined);
  if (!data) add("info", `data folder ${dataDir} does not exist yet; the daemon makes it at its first start`);
  else {
    const loose = open(data.mode) ? [dataDir] : [];
    // lstat: a link's own mode says nothing, and a link that points nowhere must not stop the check.
    for (const entry of await readdir(dataDir)) {
      const file = await lstat(join(dataDir, entry));
      if (!file.isSymbolicLink() && open(file.mode)) loose.push(join(dataDir, entry));
    }
    if (loose.length > 0) add("FAIL", `open to other users: ${loose.join(", ")}; run: chmod -R go-rwx ${dataDir}`);
    else add("ok", `data folder ${dataDir} is private`);
  }

  await secrets(config, { paths, dataDir }, deps, add);

  // ADR-056, ADR-119: a store newer than this Jaari is refused at start; an older one is migrated, after a snapshot.
  for (const [file, steps] of [["session.db", STORE_MIGRATIONS.length], ["usage.db", USAGE_MIGRATIONS.length]] as const) {
    let version: number | undefined;
    try {
      version = storeVersion(join(dataDir, file));
    } catch (error) {
      add("FAIL", `${file} cannot be read: ${(error as Error).message}; \`jaari rollback\` restores the latest snapshot`);
      continue;
    }
    if (version === undefined) continue;
    if (version > steps) add("FAIL", `${file} is at version ${version}, newer than this Jaari reads (${steps}); update Jaari, or run \`jaari rollback\``);
    else if (version < steps) add("warn", `${file} is at version ${version}; the next start migrates it to ${steps}, after a snapshot`);
    else add("ok", `${file} is at version ${version}`);
  }
  const snapshot = (await listSnapshots(dataDir)).at(-1);
  if (snapshot) add("info", `latest snapshot: ${snapshot.at} (${snapshot.reason}); \`jaari rollback\` restores it`);

  const unfinished = await restoring(dataDir);
  if (unfinished) add("FAIL", `a rollback to ${unfinished} did not finish; run \`jaari rollback\` to finish it`);
  const running = await daemonRunning(socketPath(dataDir));
  if (running === "running") add("ok", "the daemon answers on its socket");
  else if (running === "silent") add("FAIL", "something holds the daemon's socket but does not answer; restart the daemon");
  else add("FAIL", "the daemon is not running (start it: jaari-daemon, or `jaari service install`)");

  // ADR-121: a hold that failed since the last start means the laptop is not kept awake.
  const events = (await readFile(join(dataDir, "events.ndjson"), "utf8").catch(() => "")).split("\n");
  const sinceStart = events.slice(events.findLastIndex((line) => line.includes('"type":"daemon.start"')) + 1);
  if (sinceStart.some((line) => line.includes('"type":"power.hold.failed"'))) {
    add("warn", `the laptop is not kept awake: ${deps.platform === "darwin" ? "caffeinate" : "systemd-inhibit"} did not hold. A closed lid sleeps under every setting (ADR-121)`);
  }

  // ADR-028: Jaari relies on the host's disk encryption and says what it can see.
  if (deps.platform === "linux") {
    // What the data folder's disk is built on, read without root: an encrypted layer shows as `crypt`.
    const layers = await deps.exec("findmnt", ["-n", "-o", "SOURCE", "--target", dataDir])
      .then((source) => deps.exec("lsblk", ["-s", "-n", "-o", "TYPE", source.trim().replace(/\[.*$/, "")]))
      .catch(() => undefined);
    if (layers === undefined) add("info", "disk encryption: could not be read here (normal in a container); see docs/guides/securing-your-install.md");
    else if (layers.split(/\s+/).includes("crypt")) add("ok", "disk encryption: the data folder is on an encrypted volume");
    else add("warn", "disk encryption: the data folder is not on an encrypted volume (ADR-028)");
  } else if (deps.platform === "darwin") {
    const status = await deps.exec("fdesetup", ["status"]).catch(() => "");
    if (status.includes("FileVault is On")) add("ok", "disk encryption: FileVault is on");
    else if (status.includes("FileVault is Off")) add("warn", "disk encryption: FileVault is off; turn it on in System Settings, Privacy & Security");
    else add("info", "disk encryption: could not be read");
  } else add("info", `disk encryption: not checked on ${deps.platform}; see docs/guides/securing-your-install.md`);

  return finish();
}

// ADR-079: which form secret zero has, and whether each model key can be read. A value is read and dropped, never shown.
async function secrets(config: Config, at: { paths: ReturnType<typeof jaariPaths>; dataDir: string }, deps: DoctorDeps, add: (level: Level, text: string) => void) {
  const zero = config.secrets?.zero ?? "os-keychain";
  let provider: VaultProvider;
  if (zero === "os-keychain") {
    provider = deps.keychain();
  } else {
    const unit = deps.platform === "linux" ? await readFile(deps.unitPath, "utf8").catch(() => "") : "";
    if (unit.includes("LoadCredential")) {
      // The keys themselves are checked by systemd at start. `systemd-creds` uses a TPM by default when the host has one.
      if (!unit.includes("LoadCredentialEncrypted=")) return add("warn", "secrets: host-credential, plain files that systemd hands over; they must be readable by root only");
      const tpm = await deps.exec("systemd-creds", ["has-tpm2"]).then(() => true, () => false);
      return add("ok", `secrets: host-credential, encrypted with systemd-creds${tpm ? " (this host has a TPM)" : ""}`);
    }
    const dir = deps.credentialsDir ?? credentialsDirOf(config, at.paths);
    provider = createHostCredentialProvider(dir, at.dataDir);
    add("ok", `secrets: host-credential, plain owner-only files in ${dir}`);
  }
  const health = await provider.health?.() ?? { ok: true };
  if (!health.ok) return add("FAIL", `secrets: ${health.problem}`);
  if (zero === "os-keychain") add("ok", "secrets: OS keychain");
  for (const [id, { apiKey }] of Object.entries(checkLlmConfig(config.llm).providers)) {
    if (!apiKey) continue;
    await resolveRef(apiKey, provider).then(() => add("ok", `the key of provider "${id}" can be read`), (error: unknown) => add("FAIL", `the key of provider "${id}": ${(error as Error).message}`));
  }
}

export const run = (args: string[], io: Io) => doctor(args, io);
