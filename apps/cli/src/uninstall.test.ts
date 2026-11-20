import { lstat, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serviceOf } from "./service.js";
import { terminal } from "./testing.js";
import { uninstall, type UninstallDeps } from "./uninstall.js";

const { unit: UNIT, credstore: CREDSTORE } = serviceOf();

// A fake user home in a temp folder; exists and remove act on it, every other effect is a fake.
let user: string, home: string;
beforeEach(async () => {
  user = await realpath(await mkdtemp(join(tmpdir(), "jaari-uninstall-"))); // macOS: /var is a link to /private/var
  home = join(user, ".jaari");
  await mkdir(join(home, "data"), { recursive: true });
  await mkdir(join(home, "credentials"));
  await writeFile(join(home, "config.jsonc"), "{}");
  await mkdir(join(home, "versions", "0.1.0"), { recursive: true });
  await symlink(join(home, "versions", "0.1.0"), join(home, "current"));
});
afterEach(() => rm(user, { recursive: true, force: true }));

const there = async (path: string) => (await lstat(path).catch(() => null)) !== null;
const plist = () => join(user, "Library", "LaunchAgents", "org.jaari.daemon.plist");
const log = () => join(user, "Library", "Logs", "jaari-daemon.log");
async function macService() {
  await mkdir(join(user, "Library", "LaunchAgents"), { recursive: true });
  await writeFile(plist(), "<plist/>");
  await mkdir(join(user, "Library", "Logs"), { recursive: true });
  await writeFile(log(), "log");
}

function fakes(over: Partial<UninstallDeps> = {}, systemFiles: string[] = []) {
  const deps: UninstallDeps = {
    platform: "darwin",
    uid: 501,
    homedir: user,
    exec: vi.fn(async () => ({ code: 0, stderr: "" })),
    // Paths outside the temp folder (the Linux unit) are answered from the list, never looked up.
    exists: vi.fn(async (path: string) => (path.startsWith(user) ? there(path) : systemFiles.includes(path))),
    remove: vi.fn(async (path: string) => {
      if (!path.startsWith(user)) throw new Error(`test: refusing to remove ${path}`);
      await rm(path, { recursive: true, force: true });
    }),
    daemonRunning: vi.fn(async () => "stopped" as const),
    ...over,
  };
  return deps;
}
async function jaari(args: string[], deps: UninstallDeps, lines: string[] = [], isTTY = true) {
  const { io, shown } = terminal(lines, isTTY);
  const code = await uninstall(args, io, deps);
  return { code, text: shown() };
}
const dataKept = async () => {
  for (const name of ["config.jsonc", "data", "credentials"]) expect(await there(join(home, name))).toBe(true);
};

describe("jaari uninstall", () => {
  it("on macOS unloads and removes the service and the app, and keeps the data", async () => {
    await macService();
    const deps = fakes();
    const { code, text } = await jaari([], deps);
    expect(code).toBe(0);
    expect(deps.exec).toHaveBeenCalledWith("launchctl", ["bootout", "gui/501/org.jaari.daemon"]);
    expect(await there(plist())).toBe(false);
    expect(await there(join(home, "current"))).toBe(false);
    expect(await there(join(home, "versions"))).toBe(false);
    await dataKept();
    expect(await there(log())).toBe(true);
    expect(text).toContain(`Kept in ${home}: config.jsonc, data, credentials.`);
    expect(text).toContain("npm uninstall --global jaari");
  });

  it("removes only the service named by --service-name, and leaves the owner's agent (ADR-126)", async () => {
    await macService(); // the owner's own agent
    const check = join(user, "Library", "LaunchAgents", "org.jaari.daemon.check.plist");
    await writeFile(check, "<plist/>");
    const deps = fakes();
    expect((await jaari(["--home", home, "--service-name", "jaari-check"], deps)).code).toBe(0);
    expect(deps.exec).toHaveBeenCalledWith("launchctl", ["bootout", "gui/501/org.jaari.daemon.check"]);
    expect(deps.exec).not.toHaveBeenCalledWith("launchctl", ["bootout", "gui/501/org.jaari.daemon"]);
    expect(await there(check)).toBe(false);
    expect(await there(plist())).toBe(true);

    const linux = fakes({ platform: "linux" }, ["/etc/systemd/system/jaari-check.service"]);
    expect((await jaari(["--home", home, "--yes", "--service-name", "jaari-check"], linux)).text).toContain("sudo systemctl disable --now jaari-check.service && sudo rm /etc/systemd/system/jaari-check.service");
    expect((await jaari(["--home", home, "--service-name", "../x"], fakes())).code).toBe(2);
    // Without --home it would act on the owner's own ~/.jaari: refused before anything is removed.
    const bare = fakes();
    const refused = await jaari(["--service-name", "jaari-check"], bare);
    expect(refused.code).toBe(2);
    expect(refused.text).toContain("--service-name jaari-check needs --home");
    expect(bare.remove).not.toHaveBeenCalled();
  });

  it("on Linux prints the sudo commands and does not run systemctl", async () => {
    const deps = fakes({ platform: "linux" }, [UNIT, CREDSTORE]);
    const { code, text } = await jaari(["--home", home, "--yes"], deps);
    expect(code).toBe(0);
    expect(deps.exec).not.toHaveBeenCalled();
    expect(text).toContain(`sudo systemctl disable --now jaari.service && sudo rm ${UNIT}`);
    expect(text).toContain(`sudo rm -r ${CREDSTORE}`);
    expect(await there(join(home, "versions"))).toBe(false);
    await dataKept();
  });

  it("says so when nothing is installed", async () => {
    await rm(home, { recursive: true });
    const { code, text } = await jaari([], fakes());
    expect(code).toBe(0);
    expect(text).toContain("nothing to remove");
  });

  it("stops when a daemon still answers, with nothing else removed", async () => {
    const deps = fakes({ daemonRunning: vi.fn(async () => "silent" as const) });
    const { code, text } = await jaari(["--purge"], deps, ["delete"]);
    expect(code).toBe(1);
    expect(text).toContain("a daemon is still running");
    expect(deps.remove).not.toHaveBeenCalled();
    expect(await there(join(home, "current"))).toBe(true);
    await dataKept();
  });

  it("rejects an unknown flag or a positional", async () => {
    for (const args of [["--force"], ["now"]]) {
      const deps = fakes();
      const { code, text } = await jaari(args, deps);
      expect(code).toBe(2);
      expect(text).toContain("usage: jaari uninstall");
      expect(deps.remove).not.toHaveBeenCalled();
    }
  });
});

describe("jaari uninstall --purge", () => {
  it("deletes the Jaari folder and the log after the word delete, and points to the keychain", async () => {
    await macService();
    const { code, text } = await jaari(["--purge"], fakes(), ["delete"]);
    expect(code).toBe(0);
    expect(await there(home)).toBe(false);
    expect(await there(log())).toBe(false);
    expect(text).toContain("cannot be restored");
    expect(text).toContain("Keychain Access");
  });

  it("keeps the data on a wrong word or the end of input, and the app stays removed", async () => {
    for (const lines of [["yes"], []]) {
      const { code, text } = await jaari(["--purge"], fakes(), lines);
      expect(code).toBe(1);
      expect(text).toContain("Cancelled; the data was kept.");
      await dataKept();
    }
    expect(await there(join(home, "versions"))).toBe(false);
  });

  it("refuses without a terminal, with or without --yes, before removing anything", async () => {
    await macService();
    for (const args of [["--purge"], ["--purge", "--yes"]]) {
      const deps = fakes();
      const { code } = await jaari(args, deps, ["delete"], false);
      expect(code).toBe(2);
      expect(deps.remove).not.toHaveBeenCalled();
      expect(deps.exec).not.toHaveBeenCalled();
    }
    expect(await there(plist())).toBe(true);
  });

  it("refuses to purge the root, the user's home, or a folder that is not a Jaari folder", async () => {
    const other = join(user, "other");
    await mkdir(other);
    for (const target of ["/", user, other]) {
      const deps = fakes();
      const { code, text } = await jaari(["--purge", "--home", target], deps, ["delete"]);
      expect(code).toBe(1);
      expect(text).toContain("refusing to purge");
      expect(deps.remove).not.toHaveBeenCalled();
    }
    await dataKept();
  });

  it("refuses to purge a Jaari folder that is a link to the home folder", async () => {
    const { mkdtemp, symlink, writeFile: write, readdir: list } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const owner = await mkdtemp(join(tmpdir(), "ju-home-"));
    await write(join(owner, "config.jsonc"), "{}"); // so only the home-folder rule can stop it
    const link = join(await mkdtemp(join(tmpdir(), "ju-link-")), "jaari");
    await symlink(owner, link);
    const { terminal } = await import("./testing.js");
    const { io, shown } = terminal(["delete"], true);
    const code = await uninstall(["--home", link, "--purge"], io, {
      platform: "linux", uid: 1000, homedir: owner, exec: () => Promise.resolve({ code: 0, stderr: "" }),
      exists: () => Promise.resolve(true), remove: () => Promise.reject(new Error("must not remove")), daemonRunning: () => Promise.resolve("stopped"),
    });
    expect(code).toBe(1);
    expect(shown()).toContain("refusing to purge");
    expect(await list(owner)).toEqual(["config.jsonc"]);
  });
});
