import { lstat, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { loadConfig } from "@jaari/core/config";
import { checkLlmConfig } from "@jaari/llm";
import { afterEach, beforeEach, expect, it } from "vitest";
import { init } from "./init.js";

let root: string;
let home: string;
let config: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ji-"));
  home = join(root, "jaari"); // not created yet: init makes it
  config = join(home, "config.jsonc");
});
afterEach(() => rm(root, { recursive: true, force: true }));

// Answers one per line, all in one chunk, then the end of input.
const answer = async (lines: string[], platform: NodeJS.Platform = "linux") => {
  const input = new PassThrough();
  const output = new PassThrough();
  let shown = "";
  output.on("data", (chunk: Buffer) => (shown += chunk.toString()));
  input.end(lines.map((line) => `${line}\n`).join(""));
  const code = await init(["--home", home], { input, output, isTTY: false }, platform);
  return { code, shown };
};

it("writes a new config from the defaults on linux, and names the secret to set", async () => {
  const { code, shown } = await answer(["", "", "", "", "", "claude-test"]);
  expect(code).toBe(0);
  const written = await loadConfig(config);
  expect(written).toMatchObject({ version: 1, deployment: { target: "vps" }, secrets: { zero: "host-credential", credentialsDir: join(home, "credentials") } });
  expect(checkLlmConfig(written.llm).tiers).toEqual({ large: ["anthropic/claude-test"] });
  expect(shown).toContain("jaari secret set llm.anthropic");
  // Every next step names the same install, or the daemon would start on the default folder.
  for (const step of [`jaari secret set llm.anthropic --home ${home}`, `jaari-daemon --home ${home}`, `jaari chat --home ${home}`]) expect(shown).toContain(step);
  expect((await stat(config)).mode & 0o777).toBe(0o600);
  expect((await stat(home)).mode & 0o777).toBe(0o700);
  expect(await readdir(home)).toEqual(["config.jsonc"]); // no temp file left
});

it("defaults to laptop and the keychain on macOS, with no credentials folder", async () => {
  expect((await answer(["", "", "", "", "m"], "darwin")).code).toBe(0);
  const written = await loadConfig(config);
  expect(written.deployment?.target).toBe("laptop");
  expect(written.secrets).toEqual({ zero: "os-keychain" });
});

it("writes a local server without a secret", async () => {
  const { code, shown } = await answer(["", "", "", "local", "", "qwen3:8b", ""]);
  expect(code).toBe(0);
  const written = checkLlmConfig((await loadConfig(config)).llm);
  expect(written.providers).toEqual({ local: { api: "openai-completions", baseUrl: "http://localhost:11434/v1" } });
  expect(shown).not.toContain("jaari secret set");
});

it("changes nothing, byte for byte, when every answer is empty on a second run", async () => {
  await answer(["", "", "", "", "", "claude-test"]);
  const before = (await readFile(config, "utf8")).replace("{", "{\n  // mine, by hand");
  await writeFile(config, before);
  expect((await answer(["", "", "", ""])).code).toBe(0);
  expect(await readFile(config, "utf8")).toBe(before);
});

it("changes only the target on a second run, and keeps the comment and every other key", async () => {
  await answer(["", "", "", "", "", "claude-test"]);
  await writeFile(config, (await readFile(config, "utf8")).replace("{", "{\n  // mine, by hand"));
  const before = await loadConfig(config);
  expect((await answer(["home", "", "", ""])).code).toBe(0);
  expect(await readFile(config, "utf8")).toContain("// mine, by hand");
  expect(await loadConfig(config)).toEqual({ ...before, deployment: { target: "home" } });
});

it("removes the credentials folder when the owner moves to the keychain", async () => {
  await answer(["", "", "", "", "", "claude-test"]);
  expect((await answer(["", "os-keychain", ""])).code).toBe(0);
  expect((await loadConfig(config)).secrets).toEqual({ zero: "os-keychain" });
});

it("asks again after a wrong answer", async () => {
  const { code, shown } = await answer(["moon", "", "", "", "", "", "claude-test"]);
  expect(code).toBe(0);
  expect(shown).toContain("answer one of: vps, server, home, laptop");
  expect(shown.match(/Where does Jaari run/g)).toHaveLength(2);
});

it("never overwrites a config it cannot read", async () => {
  await answer(["", "", "", "", "", "claude-test"]);
  await writeFile(config, '{ "version": 1, "deploymnet": {} }');
  const { code, shown } = await answer(["", "", "", ""]);
  expect(code).toBe(1);
  expect(shown).toContain("Nothing was written");
  expect(await readFile(config, "utf8")).toBe('{ "version": 1, "deploymnet": {} }');
});

it("writes nothing when the input ends early", async () => {
  const { code, shown } = await answer(["", ""]);
  expect(code).toBe(1);
  expect(shown).toContain("Cancelled; nothing was written.");
  await expect(stat(home)).rejects.toThrow();
});

it("refuses a credentials folder inside the data folder, which the daemon would refuse (ADR-079)", async () => {
  const { code, shown } = await answer(["", "", "data/creds", "creds", "", "", "claude-test"]);
  expect(code).toBe(0);
  expect(shown).toContain(`not inside the data folder ${join(home, "data")}`);
  expect((await loadConfig(config)).secrets?.credentialsDir).toBe("creds");
});

it("writes through a config that is a link, so a dotfiles manager keeps its link", async () => {
  const real = join(root, "dotfiles", "jaari.jsonc");
  await mkdir(join(root, "dotfiles"));
  await mkdir(home);
  await answer(["", "", "", "", "", "claude-test"]); // writes the file first
  await writeFile(real, await readFile(config, "utf8"));
  await rm(config);
  await symlink(real, config);
  expect((await answer(["server", "", "", ""])).code).toBe(0);
  expect((await lstat(config)).isSymbolicLink()).toBe(true);
  expect((await loadConfig(real)).deployment?.target).toBe("server");
});

it("writes through a link whose target does not exist yet", async () => {
  await mkdir(home);
  await mkdir(join(root, "dotfiles"));
  await symlink(join(root, "dotfiles", "jaari.jsonc"), config); // dangling until init writes
  expect((await answer(["", "", "", "", "", "claude-test"])).code).toBe(0);
  expect((await lstat(config)).isSymbolicLink()).toBe(true);
  expect((await stat(join(root, "dotfiles", "jaari.jsonc"))).mode & 0o777).toBe(0o600);
  expect((await loadConfig(config)).version).toBe(1);
});
