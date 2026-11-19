// `jaari update [--home <dir>] [--channel stable|beta] [--to <version>] [--check] [--yes]` (ADR-056, ADR-082, ADR-124):
// find a newer release, verify it, install it beside the running one, snapshot the data, switch, check, and go back
// by itself when the check fails. The daemon is stopped for the switch.
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs, promisify } from "node:util";
import { socketPath } from "@jaari/channels";
import { restoreSnapshot, takeSnapshot, type Snapshot } from "@jaari/core";
import { ConfigError, jaariPaths, loadConfig } from "@jaari/core/config";
import { createEgress } from "@jaari/http";
import type { Io } from "./io.js";
import { createPrompter, InputEnded } from "./prompt.js";
import { LABEL } from "./service.js";
import { daemonRunning } from "./socket.js";
import { PACKAGE, VERSION_FORMAT, VerifyError, verifyRelease, type Attestation, type Dist } from "./verify.js";
import { VERSION } from "./version.js";
import { activate, activeRoot, binOf, compareVersions, lock, prune, readState, swapBack, versionPaths } from "./versions.js";

const REGISTRY = "https://registry.npmjs.org";
const NOTES = "https://api.github.com/repos/jaari-ai/jaari/releases/tags";
const MAX_TARBALL_BYTES = 50_000_000;
const USAGE = "usage: jaari update [--home <dir>] [--channel stable|beta] [--to <version>] [--check] [--yes]";

// Everything outside the Jaari folder, so a test runs the whole flow with fakes: no network, no npm, no launchd.
export type UpdateDeps = {
  version: string; // the version of this program
  platform: NodeJS.Platform;
  uid: number;
  homedir: string;
  fetch: typeof globalThis.fetch;
  verify: typeof verifyRelease;
  exec(command: string, args: string[]): Promise<{ code: number; output: string }>;
  exists(path: string): Promise<boolean>;
  daemonRunning(path: string): Promise<"running" | "stopped" | "silent">;
  sleep(ms: number): Promise<void>;
};
const systemDeps = (): UpdateDeps => ({
  version: VERSION,
  platform: process.platform,
  uid: process.getuid?.() ?? -1,
  homedir: homedir(),
  fetch: createEgress().fetch, // through the egress gate, as every outbound call (ADR-080)
  verify: verifyRelease,
  exec: (command, args) =>
    promisify(execFile)(command, args, { timeout: 300_000, maxBuffer: 10_000_000 }).then(
      ({ stdout, stderr }) => ({ code: 0, output: stdout + stderr }),
      (error: { code?: unknown; stdout?: string; stderr?: string; message: string }) => ({ code: typeof error.code === "number" ? error.code : 127, output: (error.stdout ?? "") + (error.stderr ?? "") || error.message }),
    ),
  exists: (path) => stat(path).then(() => true, () => false),
  daemonRunning,
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
});

type Packument = { "dist-tags"?: Record<string, string>; versions?: Record<string, { dist?: Dist }> };

// The newest release of the channel: "beta" also takes a stable release that is newer than the newest pre-release.
export function pickVersion(tags: Record<string, string>, channel: "stable" | "beta"): string | undefined {
  const offered = [tags.latest, channel === "beta" ? tags.next : undefined].filter((version): version is string => version !== undefined && VERSION_FORMAT.test(version));
  return offered.sort(compareVersions).at(-1);
}

export async function update(args: string[], io: Io, deps: UpdateDeps = systemDeps()): Promise<number> {
  const say = (line: string) => io.output.write(`${line}\n`);
  let values;
  try {
    ({ values } = parseArgs({ args, options: { home: { type: "string" }, channel: { type: "string" }, to: { type: "string" }, check: { type: "boolean", default: false }, yes: { type: "boolean", default: false } } }));
  } catch {
    return (say(USAGE), 2);
  }
  if ((values.channel !== undefined && values.channel !== "stable" && values.channel !== "beta") || (values.to !== undefined && !VERSION_FORMAT.test(values.to))) return (say(USAGE), 2);
  // A checkout has no release to compare with, and its programs are not the installed ones.
  if (deps.version === "0.0.0") return (say("jaari: this is a development checkout; update it with git"), 1);

  const paths = jaariPaths(values.home ? resolve(values.home) : join(deps.homedir, ".jaari"));
  let config;
  try {
    config = await loadConfig(paths.config);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    for (const problem of error.problems) say(`jaari: ${problem}`);
    return 1;
  }
  await readState(paths.home); // a damaged state file stops here, before anything is downloaded
  // This program is the active version: the launcher started it.
  const running = deps.version;
  const channel = (values.channel as "stable" | "beta" | undefined) ?? config.update?.channel ?? (running.includes("-") ? "beta" : "stable");

  const json = async <T>(url: string, what: string): Promise<T> => {
    const response = await deps.fetch(url, { headers: { accept: "application/json", "user-agent": `jaari/${deps.version}` }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${what}: the server answered ${response.status}`);
    return (await response.json()) as T;
  };
  let target: string | undefined, dist: Dist | undefined;
  try {
    const packument = await json<Packument>(`${REGISTRY}/${PACKAGE}`, "the npm registry");
    target = values.to ?? pickVersion(packument["dist-tags"] ?? {}, channel);
    dist = target === undefined ? undefined : packument.versions?.[target]?.dist;
  } catch (error) {
    return (say(`jaari: could not ask the npm registry for releases: ${(error as Error).message}`), 1);
  }
  if (target === undefined) return (say(`jaari: no ${channel} release is on npm`), 1);
  // An older version is installed only when the owner names it.
  if (target === running || (values.to === undefined && compareVersions(target, running) < 0)) return (say(`Jaari ${running} is up to date (${channel} channel).`), 0);
  if (dist === undefined) return (say(`jaari: version ${target} is not on npm`), 1);
  say(`Jaari ${target} is available; this is ${running} (${channel} channel).`);
  // Pull request titles reach the terminal: control characters (escape sequences) are dropped.
  const notes = await json<{ body?: string }>(`${NOTES}/v${target}`, "release notes").then((release) => [...(release.body ?? "")].filter((c) => c === "\n" || c === "\t" || (c >= " " && (c < "\u007f" || c > "\u009f"))).join("").trim(), () => undefined);
  if (notes) say(`\nWhat changed:\n${notes}\n`);
  if (values.check) return (say("Run `jaari update` to install it."), 0);

  // In the Compose image there is no npm, and the image is the version: the guide has the steps.
  if ((await deps.exec("npm", ["--version"])).code !== 0) return (say("jaari: npm is not available here. Under Compose, change the image version: see docs/guides/install.md, Updating."), 1);
  // The daemon is stopped for the switch. Only a launchd agent can be stopped and started from here without root.
  const agent = join(deps.homedir, "Library", "LaunchAgents", `${LABEL}.plist`);
  const launchd = deps.platform === "darwin" && (await deps.exists(agent));
  const socket = socketPath(paths.data);
  if (!launchd && (await deps.daemonRunning(socket)) !== "stopped") {
    return (say(`jaari: stop the daemon first, then run \`jaari update\` again${deps.platform === "linux" ? " (sudo systemctl stop jaari.service)" : ""}`), 1);
  }
  if (!values.yes) {
    if (!io.isTTY) return (say("jaari: update changes the installed version; run it in a terminal, or pass --yes"), 2);
    const prompter = createPrompter(io);
    try {
      if (!/^y(es)?$/i.test(await prompter.ask(`Install Jaari ${target}? The daemon stops for a moment [y/N]`))) return (say("Cancelled; nothing was changed."), 1);
    } catch (error) {
      if (!(error instanceof InputEnded)) throw error;
      return (say("Cancelled; nothing was changed."), 1);
    } finally {
      prompter.close();
    }
  }

  // One update at a time: two would share the staging folder, the link, and the daemon.
  const unlock = await lock(paths.home);
  if (!unlock) return (say("jaari: another `jaari update` is running"), 1);
  try {
    return await install({ deps, say, paths, target, dist, running, launchd, agent, socket, json });
  } finally {
    await unlock();
  }
}

type Install = {
  deps: UpdateDeps; say: (line: string) => void; paths: ReturnType<typeof jaariPaths>; target: string; dist: Dist; running: string;
  launchd: boolean; agent: string; socket: string; json: <T>(url: string, what: string) => Promise<T>;
};

// Every file of the verified tarball must be in the installed copy, byte for byte. npm downloads the package again
// itself, because it honours the shrinkwrap only for an install by name; this proves it installed the same file.
async function sameAsVerified(tarball: string, installed: string, exec: UpdateDeps["exec"]): Promise<string | undefined> {
  const unpacked = `${tarball}.files`;
  await rm(unpacked, { recursive: true, force: true });
  await mkdir(unpacked, { recursive: true });
  try {
    if ((await exec("tar", ["-xzf", tarball, "-C", unpacked])).code !== 0) return "the verified file could not be unpacked";
    const root = join(unpacked, "package");
    const files = (await readdir(root, { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile());
    if (files.length === 0) return "the verified file holds no package";
    for (const entry of files) {
      const path = join(entry.parentPath, entry.name).slice(root.length + 1);
      const [want, have] = await Promise.all([readFile(join(root, path)), readFile(join(installed, path)).catch(() => undefined)]);
      if (have === undefined || !want.equals(have)) return `the installed ${path} differs from the verified file`;
    }
    return undefined;
  } finally {
    await rm(unpacked, { recursive: true, force: true });
  }
}

async function install({ deps, say, paths, target, dist, running, launchd, agent, socket, json }: Install): Promise<number> {
  const versions = versionPaths(paths.home);
  // 1. Download and verify. Nothing is installed from a file that does not pass.
  await mkdir(versions.dir, { recursive: true, mode: 0o700 });
  const tarball = join(versions.dir, `${PACKAGE}-${target}.tgz`);
  const staging = `${versions.of(target)}.installing`;
  try {
    const expected = `${REGISTRY}/${PACKAGE}/-/${PACKAGE}-${target}.tgz`;
    if (dist.tarball !== expected) throw new VerifyError(`the registry names an unexpected download address: ${dist.tarball}`);
    const response = await deps.fetch(expected, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`the download answered ${response.status}`);
    if (Number(response.headers.get("content-length") ?? 0) > MAX_TARBALL_BYTES) throw new VerifyError("the download is larger than any Jaari release");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_TARBALL_BYTES) throw new VerifyError("the download is larger than any Jaari release");
    const { attestations } = await json<{ attestations: Attestation[] }>(`${REGISTRY}/-/npm/v1/attestations/${PACKAGE}@${target}`, "the attestations");
    const { commit } = deps.verify(target, dist, attestations, bytes);
    say(`Verified: signed by the npm registry, built by jaari-ai/jaari's release workflow from tag v${target} (commit ${commit.slice(0, 7)}).`);
    await writeFile(tarball, bytes, { mode: 0o600 });
  } catch (error) {
    say(`jaari: ${target} was not installed: ${(error as Error).message}`);
    return 1;
  }

  // 2. Install beside the running version, by name, so npm takes every dependency from the shrinkwrap with its
  // checksum; then prove that it installed the verified file. `--home` keeps the new launcher off the active link.
  await rm(staging, { recursive: true, force: true });
  const installed = await deps.exec("npm", ["install", "--global", "--prefix", staging, "--ignore-scripts", "--no-audit", "--no-fund", `${PACKAGE}@${target}`]);
  const differs = installed.code === 0 ? await sameAsVerified(tarball, join(staging, "lib", "node_modules", PACKAGE), deps.exec) : undefined;
  const reports = installed.code === 0 && differs === undefined ? await deps.exec(binOf(staging, "jaari"), ["--version", "--home", staging]) : installed;
  await rm(tarball, { force: true });
  if (installed.code !== 0 || differs !== undefined || reports.code !== 0 || reports.output.trim() !== target) {
    await rm(staging, { recursive: true, force: true });
    const why = differs ?? reports.output.trim().split("\n").slice(-5).join("\n");
    return (say(`jaari: npm could not install ${target}; nothing was changed.\n${why}`), 1);
  }

  // 3. Stop the daemon, snapshot, switch. From here on, any error puts back what was changed.
  const launchctl = (...args: string[]) => deps.exec("launchctl", args);
  const stopped = async () => {
    for (let tries = 0; tries < 30 && (await deps.daemonRunning(socket)) !== "stopped"; tries++) await deps.sleep(500);
    return (await deps.daemonRunning(socket)) === "stopped";
  };
  const start = async () => (launchd ? (await launchctl("bootstrap", `gui/${deps.uid}`, agent)).code === 0 : true);
  // The version folder that runs now; none when it is the one npm installed, or when its folder is gone.
  const before = (await activeRoot(paths.home)) ? (await readState(paths.home)).current : null;
  if (launchd) {
    await launchctl("bootout", `gui/${deps.uid}/${LABEL}`); // fails when it is not loaded, which is fine
    if (!(await stopped())) {
      await rm(staging, { recursive: true, force: true });
      await start();
      return (say("jaari: the daemon did not stop; nothing was changed"), 1);
    }
  }
  const place = { dataDir: paths.data, configPath: paths.config };
  let snapshot: Snapshot | undefined, switched = false;
  // Puts back the version and the data. Only once the daemon is stopped: restored files under a running daemon
  // would be written over.
  const undo = async (why: string): Promise<number> => {
    say(`jaari: Jaari ${target} did not pass its check, so the update is undone:\n${why}`);
    if (launchd) await launchctl("bootout", `gui/${deps.uid}/${LABEL}`);
    if (!(await stopped())) return (say(`jaari: the daemon of ${target} does not stop; nothing was put back. Stop it, then run \`jaari rollback\`.`), 1);
    if (switched) await swapBack(paths.home);
    if (snapshot) await restoreSnapshot(place, snapshot);
    await rm(staging, { recursive: true, force: true });
    const back = await start();
    say(`Back on Jaari ${running}, with the data from before the update.${launchd ? (back ? " The daemon runs again." : " Start the daemon: jaari service install") : " Start the daemon again."}`);
    return 1;
  };
  try {
    snapshot = (await deps.exists(paths.data)) ? await takeSnapshot({ ...place, reason: "pre-update" }) : undefined;
    await rm(versions.of(target), { recursive: true, force: true }); // a copy from an earlier, undone try
    await rename(staging, versions.of(target));
    await activate(paths.home, target, before);
    switched = true;
  } catch (error) {
    return undo((error as Error).message);
  }

  // 4. Check the new version: every part starts, then `doctor`. A failure puts the version and the data back.
  const home = ["--home", paths.home];
  let reason: string | undefined;
  try {
    const boots = await deps.exec(binOf(versions.link, "jaari-daemon"), ["--check", ...home]);
    if (boots.code !== 0) reason = boots.output.trim() || "the daemon did not start";
    else if (launchd && !(await start())) reason = "launchd could not start the daemon";
    else {
      if (launchd) for (let tries = 0; tries < 30 && (await deps.daemonRunning(socket)) !== "running"; tries++) await deps.sleep(500);
      const doctor = await deps.exec(binOf(versions.link, "jaari"), ["doctor", ...home, ...(launchd ? [] : ["--no-daemon"])]);
      if (doctor.code !== 0) reason = doctor.output.trim() || "jaari doctor failed";
    }
  } catch (error) {
    reason = (error as Error).message;
  }
  if (reason !== undefined) return undo(reason);
  await prune(paths.home);
  say(`Updated to Jaari ${target}. To go back: stop the daemon, then \`jaari rollback\`.`);
  if (!launchd) say("Start the daemon again.");
  return 0;
}

export const run = (args: string[], io: Io) => update(args, io);
