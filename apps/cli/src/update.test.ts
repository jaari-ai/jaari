import { mkdir, readdir, readFile, readlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { listSnapshots, openStore } from "@jaari/core";
import { describe, expect, it } from "vitest";
import { run as rollback } from "./rollback.js";
import { install, OWNER, terminal } from "./testing.js";
import { pickVersion, update, type UpdateDeps } from "./update.js";
import { verifyRelease, VerifyError, type Dist } from "./verify.js";
import { readState } from "./versions.js";

const NEW = "0.1.0-beta.3";
const dist = (version: string): Dist => ({ tarball: `https://registry.npmjs.org/jaari/-/jaari-${version}.tgz`, integrity: "sha512-x", signatures: [], attestations: { url: "" } });
const said = (data: string) => {
  const store = openStore(join(data, "session.db"), OWNER);
  try {
    return store.load().map(({ message }) => JSON.stringify(message.content)).join();
  } finally {
    store.close();
  }
};

// An install on 0.1.0-beta.2 with one message, and a world of fakes around it.
async function world(over: Partial<UpdateDeps> & { checkFails?: boolean; doctorFails?: boolean; installs?: string; tags?: Record<string, string>; daemon?: ("running" | "stopped")[] } = {}) {
  const made = await install();
  const store = openStore(join(made.data, "session.db"), OWNER);
  store.append({ role: "user", content: [{ type: "text", text: "before the update" }], timestamp: 1 });
  store.close();
  const calls: string[] = [];
  const fetched: string[] = [];
  const daemon = [...(over.daemon ?? [])];
  const deps: UpdateDeps = {
    version: "0.1.0-beta.2", platform: "linux", uid: 501, homedir: join(made.home, ".."),
    fetch: ((url: string) => {
      fetched.push(url);
      if (url.endsWith(".tgz")) return Promise.resolve(new Response("tarball bytes"));
      if (url.includes("/attestations/")) return Promise.resolve(Response.json({ attestations: [] }));
      if (url.includes("api.github.com")) return Promise.resolve(Response.json({ body: "- a fix" }));
      return Promise.resolve(Response.json({ "dist-tags": over.tags ?? { latest: "0.0.0", next: NEW }, versions: Object.fromEntries([NEW, "0.1.0-beta.1", "0.2.0-beta.1"].map((version) => [version, { dist: dist(version) }])) }));
    }) as typeof fetch,
    verify: () => ({ commit: "46acb3db6c8406039ef547bbb7fc3512d7c1b9e2" }),
    exec: async (command, args) => {
      calls.push([command.replace(made.home, "~"), ...args.map((arg) => arg.replace(made.home, "~"))].join(" "));
      // npm installs the package files; the verified tarball holds the same ones, unless a test says otherwise.
      if (command === "npm" && args[0] === "install") {
        await mkdir(join(args[3]!, "bin"), { recursive: true });
        await mkdir(join(args[3]!, "lib", "node_modules", "jaari"), { recursive: true });
        await writeFile(join(args[3]!, "lib", "node_modules", "jaari", "package.json"), over.installs ?? "the package");
      }
      if (command === "tar") {
        await mkdir(join(args[3]!, "package"), { recursive: true });
        await writeFile(join(args[3]!, "package", "package.json"), "the package");
      }
      // The staged launcher reads `--home`: given the staging folder, it reports its own version.
      if (command.endsWith("/bin/jaari") && args[0] === "--version") return { code: 0, output: `${args[2]?.includes(NEW) ? NEW : "0.1.0-beta.2"}\n` };
      if (command.endsWith("/bin/jaari-daemon")) {
        // What a newer daemon does to the data at its first start, so a rollback has something to undo.
        const newer = openStore(join(made.data, "session.db"), OWNER);
        newer.append({ role: "user", content: [{ type: "text", text: "written by the new version" }], timestamp: 2 });
        newer.close();
        return over.checkFails ? { code: 1, output: "jaari-daemon: session.db cannot be migrated" } : { code: 0, output: "" };
      }
      if (command.endsWith("/bin/jaari") && args[0] === "doctor") return over.doctorFails ? { code: 1, output: "FAIL  the key of provider \"faux\"" } : { code: 0, output: "Healthy" };
      return { code: 0, output: "11.20.0" };
    },
    exists: (path) => readFile(path).then(() => true, (error: NodeJS.ErrnoException) => error.code === "EISDIR"),
    daemonRunning: () => Promise.resolve(daemon.shift() ?? "stopped"),
    sleep: () => Promise.resolve(),
    ...over,
  };
  const go = async (args: string[] = ["--yes"], lines: string[] = [], isTTY = false) => {
    const { io, shown } = terminal(lines, isTTY);
    return { code: await update(["--home", made.home, ...args], io, deps), shown: shown() };
  };
  return { ...made, deps, calls, fetched, go };
}

describe("jaari update (ADR-056, ADR-082, ADR-124)", () => {
  it("verifies, installs beside the running version, snapshots, switches, checks, and says how to go back", async () => {
    const { home, data, calls, fetched, go } = await world();
    const { code, shown } = await go();
    expect(shown).toContain(`Jaari ${NEW} is available; this is 0.1.0-beta.2 (beta channel).`);
    expect(shown).toContain("- a fix");
    expect(shown).toContain("built by jaari-ai/jaari's release workflow from tag v0.1.0-beta.3 (commit 46acb3d)");
    expect(code).toBe(0);
    expect(await readlink(join(home, "current"))).toBe(join("versions", NEW));
    expect(await readState(home)).toEqual({ current: NEW, previous: null });
    expect((await listSnapshots(data)).map((snapshot) => snapshot.reason)).toEqual(["pre-update"]);
    expect(calls).toEqual([
      "npm --version",
      // By name, so npm takes the dependencies from the shrinkwrap; then compared with the verified file.
      `npm install --global --prefix ~/versions/${NEW}.installing --ignore-scripts --no-audit --no-fund jaari@${NEW}`,
      `tar -xzf ~/versions/jaari-${NEW}.tgz -C ~/versions/jaari-${NEW}.tgz.files`,
      `~/versions/${NEW}.installing/bin/jaari --version --home ~/versions/${NEW}.installing`,
      "~/current/bin/jaari-daemon --check --home ~",
      "~/current/bin/jaari doctor --home ~ --no-daemon", // the daemon is not started here: no service manager to ask
    ]);
    expect(fetched[0]).toBe("https://registry.npmjs.org/jaari");
    expect((await readdir(join(home, "versions"))).sort()).toEqual([NEW, "state.json"]); // no tarball, no staging folder left
    expect(shown).toContain("Start the daemon again.");
  });

  it("undoes the update when the new version does not start: the version and the data go back", async () => {
    for (const failing of [{ checkFails: true }, { doctorFails: true }]) {
      const { home, data, go } = await world(failing);
      const { code, shown } = await go();
      expect(code).toBe(1);
      expect(shown).toContain("did not pass its check, so the update is undone");
      expect(shown).toContain("Back on Jaari 0.1.0-beta.2, with the data from before the update.");
      expect(await readdir(home)).not.toContain("current");
      expect(await readState(home)).toEqual({ current: null, previous: NEW });
      expect(said(data)).toContain("before the update");
      expect(said(data)).not.toContain("written by the new version");
    }
  });

  it("under launchd, stops the agent before the switch and starts it after, also when it undoes", async () => {
    const agent = async (made: { home: string }) => {
      await mkdir(join(made.home, "..", "Library", "LaunchAgents"), { recursive: true });
      await writeFile(join(made.home, "..", "Library", "LaunchAgents", "org.jaari.daemon.plist"), "");
    };
    const good = await world({ platform: "darwin", daemon: ["stopped", "stopped", "running"] });
    await agent(good);
    expect((await good.go()).code).toBe(0);
    const launchctl = (calls: string[]) => calls.filter((call) => call.startsWith("launchctl") || call.includes("jaari-daemon") || call.includes("doctor")).map((call) => call.split(" ").slice(0, 2).join(" "));
    expect(launchctl(good.calls)).toEqual(["launchctl bootout", "~/current/bin/jaari-daemon --check", "launchctl bootstrap", "~/current/bin/jaari doctor"]);
    expect(good.calls.at(-1)).toBe("~/current/bin/jaari doctor --home ~"); // with the daemon running: the full check

    // After the undo, the old daemon must answer before the owner is told it runs.
    const bad = await world({ platform: "darwin", doctorFails: true, daemon: ["stopped", "stopped", "running", "stopped", "stopped", "running"] });
    await agent(bad);
    const { code, shown } = await bad.go();
    expect(code).toBe(1);
    expect(launchctl(bad.calls)).toEqual(["launchctl bootout", "~/current/bin/jaari-daemon --check", "launchctl bootstrap", "~/current/bin/jaari doctor", "launchctl bootout", "launchctl bootstrap"]);
    expect(shown).toContain("The daemon runs again.");
    expect(said(bad.data)).not.toContain("written by the new version");

    const silent = await world({ platform: "darwin", doctorFails: true, daemon: ["stopped", "stopped", "running"] }); // never answers after the undo
    await agent(silent);
    const quiet = await silent.go();
    expect(quiet.shown).toContain("The daemon has not answered yet; check it with `jaari doctor`.");
    expect(quiet.shown).not.toContain("The daemon runs again.");
  });

  it("under launchd, waits for a slow start instead of failing it (a busy Mac)", async () => {
    // 30 s of no answer: longer than the old 15 s wait, inside the 2 minutes.
    const slow = await world({ platform: "darwin", daemon: ["stopped", "stopped", ...Array<"stopped">(60).fill("stopped"), "running"] });
    await mkdir(join(slow.home, "..", "Library", "LaunchAgents"), { recursive: true });
    await writeFile(join(slow.home, "..", "Library", "LaunchAgents", "org.jaari.daemon.plist"), "");
    // Like the real doctor: it fails while the daemon does not answer.
    let answered = false;
    const running = slow.deps.daemonRunning, exec = slow.deps.exec;
    slow.deps.daemonRunning = async (path) => { const state = await running(path); answered ||= state === "running"; return state; };
    slow.deps.exec = async (command, args) => (args[0] === "doctor" && !answered ? { code: 1, output: "FAIL  the daemon is not running" } : exec(command, args));
    const { code, shown } = await slow.go();
    expect(code).toBe(0);
    expect(shown).toContain("Waiting for the daemon to start…");
    expect(shown).toContain("Updated to Jaari");
  });

  it("refuses what npm installed when it is not the verified file, and changes nothing", async () => {
    const { home, data, calls, go } = await world({ installs: "something else" });
    const { code, shown } = await go();
    expect(code).toBe(1);
    expect(shown).toContain("the installed package.json differs from the verified file");
    expect(calls.some((call) => call.includes("--check"))).toBe(false);
    expect(await readdir(home)).not.toContain("current");
    expect((await readdir(join(home, "versions"))).filter((entry) => entry !== "state.json" && entry !== "update.lock")).toEqual([]);
    expect(await listSnapshots(data)).toEqual([]);
  });

  it("runs one update at a time", async () => {
    const { home, go } = await world();
    await mkdir(join(home, "versions"), { recursive: true });
    await writeFile(join(home, "versions", "update.lock"), `${process.pid}\n`); // this process is alive
    expect((await go()).shown).toContain("another `jaari update` is running");
    await writeFile(join(home, "versions", "update.lock"), "999999999\n"); // a process that is gone
    expect((await go()).code).toBe(0);
  });

  it("starts the daemon again when something fails after it was stopped, and restores nothing under a daemon that runs", async () => {
    const agentAt = async (made: { home: string }) => {
      await mkdir(join(made.home, "..", "Library", "LaunchAgents"), { recursive: true });
      await writeFile(join(made.home, "..", "Library", "LaunchAgents", "org.jaari.daemon.plist"), "");
    };
    const broken = await world({ platform: "darwin" });
    await agentAt(broken);
    broken.deps.exists = (path) => (path.endsWith("/data") ? Promise.reject(new Error("unable to open database file")) : readFile(path).then(() => true, () => false));
    const failed = await broken.go();
    expect(failed.code).toBe(1);
    expect(failed.shown).toContain("unable to open database file");
    expect(broken.calls.filter((call) => call.startsWith("launchctl")).map((call) => call.split(" ")[1])).toEqual(["bootout", "bootout", "bootstrap"]);
    expect(await readdir(broken.home)).not.toContain("current");
    expect((await readdir(join(broken.home, "versions"))).some((entry) => entry.endsWith(".installing"))).toBe(false);

    const stuck = await world({ platform: "darwin", doctorFails: true, daemon: ["stopped", "stopped", "running", ...Array<"running">(40).fill("running")] });
    await agentAt(stuck);
    const { shown } = await stuck.go();
    expect(shown).toContain("does not stop; nothing was put back");
    expect(said(stuck.data)).toContain("written by the new version"); // not restored under a running daemon
  });

  it("goes back to the version npm installed when the state names a version whose folder is gone", async () => {
    const { home, go } = await world({ doctorFails: true });
    await mkdir(join(home, "versions"), { recursive: true });
    await writeFile(join(home, "versions", "state.json"), JSON.stringify({ current: NEW }));
    await go();
    expect(await readState(home)).toEqual({ current: null, previous: NEW });
    expect(await readdir(home)).not.toContain("current");
  });

  it("installs nothing from a release that does not verify", async () => {
    const real = await world({ verify: verifyRelease });
    const { code, shown } = await real.go();
    expect(code).toBe(1);
    expect(shown).toContain("was not installed: the downloaded file is not the one the registry lists");
    expect(real.calls).toEqual(["npm --version"]); // npm never saw the file
    expect(await readdir(real.home)).not.toContain("current");
    expect((await readdir(join(real.home, "versions"))).filter((entry) => entry !== "state.json" && entry !== "update.lock")).toEqual([]);
    expect(await listSnapshots(real.data)).toEqual([]);

    const forged = await world({ verify: () => { throw new VerifyError("the attestation https://slsa.dev/provenance/v1 does not verify: certificate identity error"); } });
    expect((await forged.go()).shown).toContain("certificate identity error");
    const moved = await world({ fetch: (() => Promise.resolve(Response.json({ "dist-tags": { next: NEW }, versions: { [NEW]: { dist: { ...dist(NEW), tarball: "https://example.invalid/jaari.tgz" } } } }))) as typeof fetch });
    expect((await moved.go()).shown).toContain("unexpected download address");
  });

  it("changes nothing when it should not run: up to date, only a check, no confirmation, a running daemon, a checkout, no npm", async () => {
    const same = await world({ version: NEW });
    expect(await same.go()).toMatchObject({ code: 0, shown: `Jaari ${NEW} is up to date (beta channel).\n` });
    const stable = await world({ version: "0.1.0", tags: { latest: "0.1.0", next: "0.2.0-beta.1" } });
    expect((await stable.go()).shown).toContain("is up to date (stable channel)"); // a stable install is not offered a beta
    expect((await stable.go(["--check", "--channel", "beta"])).shown).toContain("0.2.0-beta.1 is available");

    const check = await world();
    expect(await check.go(["--check"])).toMatchObject({ code: 0, shown: expect.stringContaining("Run `jaari update` to install it.") as string });
    expect(check.calls).toEqual([]);
    expect((await (await world()).go([])).code).toBe(2); // no terminal and no --yes
    expect((await (await world()).go([], ["n"], true)).shown).toContain("Cancelled; nothing was changed.");
    expect((await (await world({ daemon: ["running"] })).go()).shown).toContain("stop the daemon first, then run `jaari update` again (sudo systemctl stop jaari.service)");
    expect((await (await world({ version: "0.0.0" })).go()).shown).toContain("development checkout");
    const container = await world({ exec: () => Promise.resolve({ code: 127, output: "" }) });
    expect((await container.go()).shown).toContain("Under Compose, change the image version");
    expect((await (await world()).go(["--to", "1.0"])).code).toBe(2);
    expect((await (await world()).go(["--to", "9.9.9"])).shown).toContain("version 9.9.9 is not on npm");
    for (const made of [same, check, container]) expect(await readdir(made.home)).not.toContain("current");
  });

  it("picks the newest release of the channel", () => {
    expect(pickVersion({ latest: "0.1.0", next: "0.2.0-beta.1" }, "stable")).toBe("0.1.0");
    expect(pickVersion({ latest: "0.1.0", next: "0.2.0-beta.1" }, "beta")).toBe("0.2.0-beta.1");
    expect(pickVersion({ latest: "0.2.0", next: "0.2.0-beta.1" }, "beta")).toBe("0.2.0"); // the release came after its betas
    expect(pickVersion({ next: "0.2.0-beta.1" }, "stable")).toBeUndefined();
    expect(pickVersion({ latest: "not a version" }, "stable")).toBeUndefined();
  });

  it("jaari rollback after an update restores the data and the version, and a second run brings both back", async () => {
    const { home, data, go } = await world();
    await go();
    const back = async () => {
      const { io, shown } = terminal();
      return { code: await rollback(["--home", home, "--yes"], io), shown: shown() };
    };
    expect((await back()).shown).toContain("The active version is now the one npm installed.");
    expect(await readdir(home)).not.toContain("current");
    expect(said(data)).not.toContain("written by the new version");
    expect((await back()).shown).toContain(`The active version is now ${NEW}.`);
    expect(said(data)).toContain("written by the new version");
    expect(await readlink(join(home, "current"))).toBe(join("versions", NEW));
  });
});
