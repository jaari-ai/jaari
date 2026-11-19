import { mkdir, mkdtemp, readdir, readlink, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { entryOf, homeOf } from "./launch.js";
import { activate, activeRoot, compareVersions, mainOf, prune, readState, swapBack, versionPaths } from "./versions.js";

const home = () => mkdtemp(join(tmpdir(), "jv-"));
const installed = async (dir: string, version: string) => {
  const main = mainOf(versionPaths(dir).of(version), "cli");
  await mkdir(join(main, ".."), { recursive: true });
  await writeFile(main, `// ${version}\n`);
  return main;
};

describe("installed versions (ADR-122, ADR-124)", () => {
  it("activates a version, remembers the one before, and swaps back and forth", async () => {
    const dir = await home();
    expect(await readState(dir)).toEqual({ current: null });
    expect(await swapBack(dir)).toBeUndefined(); // nothing to go back to before the first update
    await installed(dir, "0.1.0-beta.2");
    await installed(dir, "0.1.0-beta.3");
    expect(await activate(dir, "0.1.0-beta.2")).toEqual({ current: "0.1.0-beta.2", previous: null });
    expect(await readlink(versionPaths(dir).link)).toBe(join("versions", "0.1.0-beta.2")); // relative: the folder can move
    await activate(dir, "0.1.0-beta.3");
    expect(await swapBack(dir)).toEqual({ current: "0.1.0-beta.2", previous: "0.1.0-beta.3" });
    expect(await activeRoot(dir)).toMatch(/versions\/0\.1\.0-beta\.2$/);
    expect(await swapBack(dir)).toEqual({ current: "0.1.0-beta.3", previous: "0.1.0-beta.2" }); // a second rollback undoes the first

    await activate(dir, "0.1.0-beta.2");
    await swapBack(dir);
    await activate(dir, "0.1.0-beta.3"); // state is now beta.3 over beta.3's predecessor
    const base = await home();
    await installed(base, "1.0.0");
    await activate(base, "1.0.0");
    expect(await swapBack(base)).toEqual({ current: null, previous: "1.0.0" }); // back to the version npm installed: no link
    expect(await activeRoot(base)).toBeUndefined();
    expect(await readdir(base)).not.toContain("current");
  });

  it("prunes versions that are neither active nor the one to go back to, and unfinished installs", async () => {
    const dir = await home();
    for (const version of ["0.1.0", "0.2.0", "0.3.0"]) await installed(dir, version);
    await mkdir(join(versionPaths(dir).dir, "0.4.0.installing"));
    await mkdir(join(versionPaths(dir).dir, "notes"));
    await activate(dir, "0.2.0");
    await activate(dir, "0.3.0");
    await prune(dir);
    expect((await readdir(versionPaths(dir).dir)).sort()).toEqual(["0.2.0", "0.3.0", "notes", "state.json"]);
  });

  it("never runs a link that leaves the versions folder, and refuses a damaged state file", async () => {
    const dir = await home();
    const outside = await home();
    await mkdir(versionPaths(dir).dir);
    await symlink(outside, versionPaths(dir).link);
    expect(await activeRoot(dir)).toBeUndefined();
    await writeFile(versionPaths(dir).state, '{"current":"../../elsewhere"}');
    await expect(readState(dir)).rejects.toThrow("is damaged");
  });

  it("orders versions as SemVer does", () => {
    const ordered = ["0.1.0-alpha", "0.1.0-alpha.1", "0.1.0-beta.2", "0.1.0-beta.10", "0.1.0-rc.1", "0.1.0", "0.1.1", "0.2.0", "0.10.0", "1.0.0-beta.1", "1.0.0"];
    expect([...ordered].reverse().sort(compareVersions)).toEqual(ordered);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });
});

describe("the launcher (ADR-124)", () => {
  it("runs the active version, and its own when there is none, it is the active one, or the link is broken", async () => {
    const dir = await home();
    const own = join(dir, "own.js");
    await writeFile(own, "");
    const argv = ["doctor", "--home", dir];
    expect(await entryOf("cli", argv, own)).toBe(own); // no update yet
    const main = await installed(dir, "0.2.0");
    await activate(dir, "0.2.0");
    expect(await entryOf("cli", argv, own)).toMatch(/versions\/0\.2\.0\/lib\/node_modules\/jaari\/node_modules\/@jaari\/cli\/dist\/main\.js$/);
    expect(await entryOf("cli", [`--home=${dir}`], own)).not.toBe(own);
    expect(await entryOf("cli", argv, main)).toBe(main); // already the active one: no loop
    expect(await entryOf("daemon", argv, own)).toBe(own); // that version has no such program
    expect(await entryOf("cli", ["--home", join(dir, "missing")], own)).toBe(own);
    expect(homeOf(["chat"])).toMatch(/\.jaari$/);
  });
});
