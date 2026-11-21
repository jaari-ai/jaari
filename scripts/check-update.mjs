#!/usr/bin/env node
// `node scripts/check-update.mjs [--service | --docker]` (ADR-126, ADR-127): runs the real update between local builds,
// on this machine, without a release. Nothing here ships: verification has no off switch in the installed programs.
//
// npm (the default): builds the working tree, packs it three times (only the version differs), installs the first
// in a temporary folder as an owner would, and runs the `update` of the active version, as the launcher would. Only
// three things are replaced: the registry download (served from the local files), the signature check (a stub; it has
// its own tests against real attestations), and npm's install by name (pointed at the local file).
//   1. 0.0.0-check.1 → 0.0.0-check.2 must pass.
//   2. 0.0.0-check.2 → 0.0.0-check.3, whose `jaari doctor` is made to fail after it wrote to the data, must be undone
//      with the data from before.
// --service (macOS): the same through a real launchd agent under the test name `jaari-check`, never the owner's own;
//   the first update also sees a start that answers only after 20 s, past the old 15 s wait.
// --docker: two local images and the image update as the guide has it, then the way back. On Docker Desktop the data
//   folder is a volume inside Docker's Linux machine (ADR-127, point 3).
import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const mode = args[0] === "--service" ? "service" : args[0] === "--docker" ? "docker" : "npm";
const refuse = (why) => (console.error(`check-update: ${why}`), process.exit(2));
if (args.length > 1 || (args.length === 1 && mode === "npm")) refuse("usage: node scripts/check-update.mjs [--service | --docker]");
if (process.platform === "win32") refuse("Windows comes with roadmap 0.19 (ADR-125)");
// ADR-124, point 10: under systemd the update does not stop or start the service; the owner does.
if (mode === "service" && process.platform !== "darwin") refuse("--service runs under launchd (macOS)");

const VERSIONS = ["0.0.0-check.1", "0.0.0-check.2", "0.0.0-check.3"];
const NAME = "jaari-check"; // the test service: its own launchd label and log, never the owner's
const OWNER = "00000000-0000-4000-8000-00000000c4ec";
const PROJECT = "jaari-update-check";

const run = (command, argv, options = {}) =>
  promisify(execFile)(command, argv, { maxBuffer: 50_000_000, ...options }).then(
    ({ stdout, stderr }) => ({ code: 0, output: stdout + stderr }),
    (error) => ({ code: typeof error.code === "number" ? error.code : 127, output: (error.stdout ?? "") + (error.stderr ?? "") || error.message }),
  );
const must = async (command, argv, options) => {
  const done = await run(command, argv, options);
  if (done.code !== 0) throw new Error(`${command} ${argv.join(" ")} failed:\n${done.output}`);
  return done.output;
};
let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) failures++;
};
const indent = (text) => text.replace(/^(?=.)/gm, "    | ");

// Under /tmp: the daemon's socket path has a length limit, and macOS's own temp folder is long.
const work = await mkdtemp("/tmp/jaari-check.");
const prefix = join(work, "prefix");
const home = join(work, "home");
const installed = (root) => join(root, "lib", "node_modules", "jaari"); // npm's global layout on Linux and macOS
const launcher = (program) => join(installed(prefix), "bin", `${program}.js`); // follows home/current, as an owner's
const jaari = (argv) => run(process.execPath, [launcher("jaari"), ...argv]);
const compose = async (argv) => {
  const done = await run("docker", ["compose", "--project-directory", home, "--file", join(home, "compose.yaml"), "--project-name", PROJECT, ...argv]);
  if (done.code !== 0) process.stdout.write(indent(done.output));
  return done;
};
const image = (version) => `ghcr.io/jaari-ai/jaari:${version}`;
let daemon; // the daemon this script starts itself, when no service manager does
let names; // the test service's names, from the installed `serviceOf`, so they are never written twice

let cleaning;
const cleanUp = () =>
  (cleaning ??= (async () => {
    daemon?.kill("SIGTERM");
    if (mode === "service") {
      await jaari(["uninstall", "--home", home, "--service-name", NAME, "--yes"]);
      // When the uninstall could not run (the install itself failed): the test agent must not stay loaded.
      if (names) await run("launchctl", ["bootout", `gui/${process.getuid()}/${names.label}`]);
      if (names) await rm(join(homedir(), "Library", "LaunchAgents", `${names.label}.plist`), { force: true });
      if (names) await rm(join(homedir(), "Library", "Logs", names.log), { force: true });
    }
    if (mode === "docker") {
      await compose(["down", "--volumes"]);
      await run("docker", ["rmi", "--force", image(VERSIONS[0]), image(VERSIONS[1])]);
    }
    await rm(work, { recursive: true, force: true });
  })());
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => void cleanUp().then(() => process.exit(130)));

try {
  await must("pnpm", ["-r", "build"], { cwd: ROOT }); // the check is about this working tree, not an older build
  const tarballs = {};
  for (const version of VERSIONS) {
    tarballs[version] = (await must(process.execPath, [join(ROOT, "scripts", "pack-release.mjs"), version, join(work, version)], { cwd: ROOT })).trim();
  }
  await must("npm", ["install", "--global", "--prefix", prefix, "--ignore-scripts", "--no-audit", "--no-fund", tarballs[VERSIONS[0]]]);
  const { serviceOf } = await import(pathToFileURL(join(installed(prefix), "node_modules", "@jaari", "cli", "dist", "service.js")).href);
  names = serviceOf(NAME);
  if (mode === "docker") await checkDocker(tarballs);
  else await checkNpm(tarballs);
} catch (error) {
  failures++;
  console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await cleanUp();
}
console.log(failures === 0 ? "check-update: all passed" : `check-update: ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);

async function checkNpm(tarballs) {
  // An owner's Jaari folder with nothing secret: a local model needs no key, and host-credential needs only its folder.
  await mkdir(join(home, "credentials"), { recursive: true, mode: 0o700 });
  const llm = { providers: { local: { api: "openai-completions", baseUrl: "http://127.0.0.1:9/v1" } }, tiers: { small: ["local/check"] }, roles: { main: "small", summarize: "small" } };
  await writeFile(join(home, "config.jsonc"), JSON.stringify({ version: 1, owner: { id: OWNER }, secrets: { zero: "host-credential" }, llm }, null, 2), { mode: 0o600 });

  const answers = async () => {
    for (let waited = 0; waited < 60_000; waited += 500) {
      if ((await jaari(["doctor", "--home", home])).code === 0) return true;
      await new Promise((done) => setTimeout(done, 500));
    }
    return false;
  };
  // Without a service manager the owner stops the daemon before an update and starts it after (ADR-124, point 10).
  const start = () => mode === "npm" && (daemon = spawn(process.execPath, [launcher("jaari-daemon"), "--home", home], { stdio: "ignore" }));
  const stop = async () => {
    if (!daemon) return;
    const gone = new Promise((done) => daemon.once("exit", done));
    daemon.kill("SIGTERM");
    await gone;
    daemon = undefined;
  };

  if (mode === "service") await must(process.execPath, [launcher("jaari"), "service", "install", "--home", home, "--service-name", NAME, "--daemon", join(prefix, "bin", "jaari-daemon")]);
  else start();
  check(await answers(), `${VERSIONS[0]} starts and \`jaari doctor\` passes`);

  const state = async () => JSON.parse(await readFile(join(home, "versions", "state.json"), "utf8")).current;
  const version = async () => (await jaari(["--version", "--home", home])).output.trim();

  await stop();
  const first = await update(tarballs, VERSIONS[1], { slowStart: mode === "service" ? 20 : 0 });
  start();
  check(first.code === 0, `${VERSIONS[0]} → ${VERSIONS[1]} passes`);
  check((await version()) === VERSIONS[1], `the launcher runs ${VERSIONS[1]}`);
  check((await state()) === VERSIONS[1], "versions/state.json names it");
  check(await answers(), "the new daemon answers and `jaari doctor` passes");
  if (mode === "service") check(first.shown.includes("Waiting for the daemon to start"), "a 20 s start is waited for, not failed");

  await stop();
  const second = await update(tarballs, VERSIONS[2], { failDoctor: true });
  start();
  check(second.failedDoctor, `${VERSIONS[2]}'s check ran and wrote to the data before it failed`);
  check(second.code === 1 && second.shown.includes("so the update is undone"), `${VERSIONS[1]} → ${VERSIONS[2]} is undone`);
  check((await version()) === VERSIONS[1], `the launcher runs ${VERSIONS[1]} again`);
  check((await state()) === VERSIONS[1], "versions/state.json names it again");
  check(await answers(), "the daemon answers again after the undo");
  const db = new DatabaseSync(join(home, "data", "session.db"), { readOnly: true });
  const kept = db.prepare("SELECT 1 FROM state WHERE key = 'check-update'").get();
  db.close();
  check(kept === undefined, "the data is from before the update: what the failed version wrote is gone");
  if (mode === "service") check(second.shown.includes("The daemon runs again."), "the undo says the daemon runs only once it answers");
}

// The update of the active version, as the launcher would run it, with its real dependencies but three.
async function update(tarballs, target, { failDoctor = false, slowStart = 0 }) {
  const active = (await stat(join(home, "current")).then(() => true, () => false)) ? join(home, "current") : prefix;
  const module = await import(pathToFileURL(join(installed(active), "node_modules", "@jaari", "cli", "dist", "update.js")).href);
  const real = module.systemDeps();
  const bytes = await readFile(tarballs[target]);
  let startedAt, failedDoctor = false;
  const deps = {
    ...real,
    fetch: async (url) => {
      const href = String(url);
      if (href === "https://registry.npmjs.org/jaari") {
        const dist = { tarball: `https://registry.npmjs.org/jaari/-/jaari-${target}.tgz`, integrity: "sha512-local", signatures: [], attestations: { url: "" } };
        // Only `next`: 0.0.0 would be newer than every 0.0.0-check.N pre-release, and the beta channel takes the newest.
        return Response.json({ "dist-tags": { next: target }, versions: { [target]: { dist } } });
      }
      if (href.endsWith(`/jaari-${target}.tgz`)) return new Response(bytes);
      if (href.includes("/attestations/")) return Response.json({ attestations: [] });
      if (href.startsWith("https://api.github.com/")) return Response.json({ body: `Local build ${target}.` });
      throw new Error(`check-update: unexpected request ${href}`);
    },
    verify: () => ({ commit: "0000000local" }),
    exec: async (command, argv) => {
      if (command === "npm" && argv[0] === "install") argv = [...argv.slice(0, -1), tarballs[target]]; // by name → the local file
      if (command === "launchctl" && argv[0] === "bootstrap") startedAt = Date.now();
      if (failDoctor && argv[0] === "doctor") {
        // What a new version may do before its check fails: write to the data. The undo must take it back.
        const db = new DatabaseSync(join(home, "data", "session.db"));
        db.prepare("INSERT INTO state VALUES (?, 'check-update', '\"written by the failed version\"')").run(OWNER);
        db.close();
        failedDoctor = true;
        return { code: 1, output: "FAIL  made to fail by check-update" };
      }
      const done = await real.exec(command, argv);
      // The update keeps only the exit code of launchctl; the reason for a failure is shown here.
      if (command === "launchctl" && done.code !== 0 && argv[0] === "bootstrap") process.stdout.write(indent(`launchctl ${argv[0]} failed (${done.code}): ${done.output}`));
      return done;
    },
    // A start that answers only after `slowStart` seconds, as on a busy machine.
    daemonRunning: async (path) => (startedAt !== undefined && Date.now() - startedAt < slowStart * 1000 ? "stopped" : real.daemonRunning(path)),
  };
  let shown = "";
  const output = { write: (text) => ((shown += text), process.stdout.write(indent(text)), true) };
  const argv = ["--home", home, "--yes", "--channel", "beta", "--service-name", NAME];
  const code = await module.update(argv, { input: process.stdin, output, isTTY: false }, deps);
  return { code, shown, failedDoctor };
}

// The image is the version (ADR-124, point 14): `jaari init` writes compose.yaml, and the owner changes its tag.
async function checkDocker(tarballs) {
  for (const version of VERSIONS.slice(0, 2)) {
    // The Dockerfile installs every tarball in dist/npm: a build context of its own holds exactly this one.
    const context = join(work, `image-${version}`);
    await mkdir(join(context, "dist", "npm"), { recursive: true });
    await writeFile(join(context, "dist", "npm", `jaari-${version}.tgz`), await readFile(tarballs[version]));
    await must("docker", ["build", "--quiet", "--file", join(ROOT, "docker", "Dockerfile"), "--tag", image(version), context]);
  }
  // As the guide runs it: inside the image, as the owner's account, on the Jaari folder of the host. There it finds
  // whether that folder can hold the chat socket (Docker Desktop cannot), and writes the data volume if not (ADR-128).
  // The answers check-release.sh gives: a server, host-credential, a local model with no key.
  await mkdir(home, { recursive: true, mode: 0o700 });
  const init = spawn("docker", ["run", "--rm", "-i", "--user", `${process.getuid()}:${process.getgid()}`, "--env", "HOME=/home/jaari", "--volume", `${home}:/home/jaari/.jaari`, image(VERSIONS[0]), "jaari", "init"], { stdio: ["pipe", "ignore", "inherit"] });
  init.stdin.end(["server", "host-credential", "", "local", "", "check", "http://192.0.2.1:11434/v1", ""].join("\n"));
  check((await new Promise((done) => init.once("exit", done))) === 0, "`jaari init` writes compose.yaml");
  // Docker Desktop runs on macOS and Windows; Docker on Linux shares the host's own file system.
  const volume = (await readFile(join(home, "compose.yaml"), "utf8").catch(() => "")).includes("        source: data\n");
  check(volume === (process.platform !== "linux"), volume ? "the data is in a named volume, as Docker Desktop needs" : "the data is in the host folder, as on Linux");

  const file = join(home, "compose.yaml");
  const tag = async (from, to) => writeFile(file, (await readFile(file, "utf8")).replace(image(from), image(to)));
  const up = async () => (await compose(["up", "--wait", "--wait-timeout", "180"])).code === 0;
  const version = async () => (await compose(["exec", "-T", "jaari", "jaari", "--version"])).output.trim();

  check(await up(), `${VERSIONS[0]} comes up healthy with \`up --wait\``);
  check((await compose(["run", "--rm", "admin", "doctor"])).code === 0, "`admin doctor` passes beside it");
  await tag(VERSIONS[0], VERSIONS[1]);
  check(await up(), `the image update to ${VERSIONS[1]} comes up healthy`);
  check((await version()) === VERSIONS[1], `the daemon runs ${VERSIONS[1]}`);
  check((await compose(["run", "--rm", "admin", "doctor"])).code === 0, "`admin doctor` passes after the update");

  // The way back, as the guide has it: down, the latest snapshot is the new image's, the old tag, rollback, up again.
  check((await compose(["down"])).code === 0, "`docker compose down` stops it");
  // Only the snapshot lines, which start with a date: Compose writes its own lines into the same output.
  const list = (await compose(["run", "--rm", "admin", "rollback", "--list"])).output.split("\n").filter((line) => /^\d{4}-/.test(line));
  check(list.at(-1)?.endsWith(`by ${VERSIONS[1]}`) === true, `the latest snapshot was taken by ${VERSIONS[1]} when it started (OQ-96)`);
  await tag(VERSIONS[1], VERSIONS[0]);
  check((await compose(["run", "--rm", "admin", "rollback", "--yes"])).code === 0, "`admin rollback --yes` restores the data from before the update");
  check(await up(), `${VERSIONS[0]} comes back up healthy`);
  check((await version()) === VERSIONS[0], `the daemon runs ${VERSIONS[0]} again`);
}
