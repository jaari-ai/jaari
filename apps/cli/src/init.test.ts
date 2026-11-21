import { lstat, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { loadConfig } from "@jaari/core/config";
import { checkLlmConfig } from "@jaari/llm";
import { afterEach, beforeEach, expect, it } from "vitest";
import { run as configCommand } from "./config-command.js";
import { composeFile } from "./compose.js";
import { init, type Host } from "./init.js";

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
  expect(written.power).toBeUndefined();
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
  expect((await answer(["", "", "", "", "", "m"], "darwin")).code).toBe(0);
  const written = await loadConfig(config);
  expect(written.deployment?.target).toBe("laptop");
  expect(written.power).toEqual({ stayAwake: "working" }); // asked on a laptop only (ADR-057)
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

it("writes the owner id once, keeps it on later runs, and adds it to a config from before it existed (ADR-119)", async () => {
  await answer(["", "", "", "", "", "claude-test"]);
  const id = (await loadConfig(config)).owner?.id;
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/); // a random UUID
  await answer(["server", "", "", ""]);
  expect((await loadConfig(config)).owner?.id).toBe(id); // the stores would refuse a new one

  // A config as roadmap 0.6 wrote it: no owner section, and a comment to keep.
  await writeFile(config, `{
  // mine, by hand
  "version": 1,
  "deployment": { "target": "server" },
  "secrets": { "zero": "os-keychain" },
  "llm": { "providers": { "anthropic": { "apiKey": "secretRef:llm.anthropic" } }, "tiers": { "large": ["anthropic/claude-test"] }, "roles": { "main": "large", "summarize": "large" } }
}
`);
  expect((await answer(["", "", "", ""])).code).toBe(0);
  const added = await loadConfig(config);
  expect(added.owner?.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(added.owner?.id).not.toBe(id);
  expect(added.deployment?.target).toBe("server");
  expect(await readFile(config, "utf8")).toContain("// mine, by hand");
});

// `jaari config <step>`: one step of init, on the platform this test runs on.
const revisit = async (step: string, lines: string[]) => {
  const input = new PassThrough();
  const output = new PassThrough();
  let shown = "";
  output.on("data", (chunk: Buffer) => (shown += chunk.toString()));
  input.end(lines.map((line) => `${line}\n`).join(""));
  return { code: await configCommand([step, "--home", home], { input, output, isTTY: false }), shown };
};

it("jaari config revisits one step and leaves the rest of the file as it was", async () => {
  expect((await revisit("llm", ["", "", "m"])).shown).toContain("run `jaari init` first"); // no config yet
  await answer(["", "", "", "", "", "claude-test"]);
  await writeFile(config, (await readFile(config, "utf8")).replace("{", "{\n  // mine, by hand"));
  const before = await loadConfig(config);

  const target = await revisit("deployment", ["laptop", "always"]);
  expect(target.code).toBe(0);
  expect(target.shown).not.toContain("secrets"); // only this step's questions
  expect(await loadConfig(config)).toEqual({ ...before, deployment: { target: "laptop" }, power: { stayAwake: "always" } });

  expect((await revisit("llm", ["", "", "other-model"])).shown).toContain("jaari secret set llm.anthropic"); // asked at once, no "keep?"
  const after = await loadConfig(config);
  expect(checkLlmConfig(after.llm).tiers).toEqual({ large: ["anthropic/other-model"] });
  expect(after.secrets).toEqual(before.secrets);
  expect(await readFile(config, "utf8")).toContain("// mine, by hand");

  const text = await readFile(config, "utf8");
  expect((await revisit("secrets", ["", ""])).code).toBe(0);
  expect(await readFile(config, "utf8")).toBe(text); // empty answers change nothing
  expect(await revisit("nope", [])).toMatchObject({ code: 2, shown: expect.stringContaining("usage: jaari config") as string });
});

const composeRun = async (lines: string[], host: Host = { version: "1.2.3", uid: 1000, gid: 1001 }, platform: NodeJS.Platform = "linux") => {
  const input = new PassThrough();
  const output = new PassThrough();
  let shown = "";
  output.on("data", (chunk: Buffer) => (shown += chunk.toString()));
  input.end(lines.map((line) => `${line}\n`).join(""));
  return { code: await init(["--home", home], { input, output, isTTY: false }, platform, undefined, host), shown };
};

it("writes compose.yaml on a server: pinned image, the owner's account, the container limits, one secret per key (ADR-094, ADR-122)", async () => {
  const { code, shown } = await composeRun(["", "", "", "", "", "claude-test"]);
  expect(code).toBe(0);
  const text = await readFile(join(home, "compose.yaml"), "utf8");
  for (const line of [
    'image: "ghcr.io/jaari-ai/jaari:1.2.3"', 'user: "1000:1001"', "read_only: true", "- ALL", "- no-new-privileges:true", "restart: unless-stopped",
    "- ./config.jsonc:/home/jaari/.jaari/config.jsonc:ro", "- ./data:/home/jaari/.jaari/data", // no credentials folder, a read-only config
    'profiles: ["admin"]', "network_mode: none", 'entrypoint: ["jaari"]',
    '- "llm.anthropic"', '"llm.anthropic":\n    file: "./credentials/llm.anthropic"',
    "Start: docker compose up --wait.",
    "    healthcheck: # ADR-127", '\n      test: ["CMD", "jaari", "doctor"]\n      interval: 30s\n      timeout: 20s\n      retries: 3\n      start_period: 120s\n      start_interval: 2s\n',
  ]) expect(text).toContain(line);
  expect(text.indexOf("healthcheck:")).toBeLessThan(text.indexOf("  admin:")); // the daemon's, not the admin's
  expect(text.split("healthcheck:")).toHaveLength(2);
  expect((await stat(join(home, "compose.yaml"))).mode & 0o777).toBe(0o600);
  expect((await stat(join(home, "data"))).mode & 0o777).toBe(0o700); // made here, or Docker would make it as root
  expect(shown).toContain("  docker compose up --wait --wait-timeout 180");
  expect(shown).toContain("without Docker: jaari service install"); // a server may run it under systemd
  expect(shown).not.toContain("  jaari-daemon");
  expect(shown).not.toContain("cd /"); // this may run inside the container, whose paths mean nothing on the host
});

it("keeps the data in a named volume where a socket's mode cannot be set, as on Docker Desktop (ADR-128)", async () => {
  expect((await composeRun(["", "", "", "", "", "claude-test"], { version: "1.2.3", uid: 501, gid: 20, dataVolume: true })).code).toBe(0);
  const text = await readFile(join(home, "compose.yaml"), "utf8");
  expect(text).not.toContain("./data:");
  expect(await readdir(home)).not.toContain("data"); // Docker's volume, not a folder here
  const volume = "      - type: volume\n        source: data\n        target: /home/jaari/.jaari/data\n        volume:\n          nocopy: true\n";
  expect(text.split(volume)).toHaveLength(4); // the daemon, admin, and the step that gives the volume to the owner
  expect(text.split("condition: service_completed_successfully")).toHaveLength(3);
  const step = text.slice(text.indexOf("\n  data:\n"));
  for (const line of ['user: "0:0"', '"chown 501:20 /home/jaari/.jaari/data && chmod 700 /home/jaari/.jaari/data"', "network_mode: none", "- ALL\n    cap_add:\n      - CHOWN\n      - FOWNER\n", "- no-new-privileges:true"]) expect(step).toContain(line);
  expect(text).toContain("\nvolumes:\n  data: {}\n");
});

it("keeps an edited compose.yaml, and writes none for a laptop, the keychain, root, or a checkout", async () => {
  await composeRun(["", "", "", "", "", "claude-test"]);
  const path = join(home, "compose.yaml");
  await writeFile(path, "# mine\n");
  const second = await composeRun(["", "", "", ""], { version: "1.2.4", uid: 1000, gid: 1001 });
  expect(second.shown).toContain("so it was kept");
  expect(await readFile(path, "utf8")).toBe("# mine\n");
  expect(await readFile(`${path}.new`, "utf8")).toContain("jaari:1.2.4");

  for (const [host, lines, platform] of [
    [{ version: "0.0.0", uid: 1000, gid: 1000 }, ["", "", "", "", "", "m"], "linux"],
    [{ version: "1.2.3", uid: 0, gid: 0 }, ["", "", "", "", "", "m"], "linux"],
    [{ version: "1.2.3", uid: 1000, gid: 1000 }, ["", "", "", "", "", "m"], "darwin"],
  ] as const) {
    await rm(home, { recursive: true, force: true });
    const { shown } = await composeRun([...lines], host, platform);
    expect(await readdir(home)).not.toContain("compose.yaml");
    expect(shown.includes("not as root")).toBe(host.uid === 0);
  }
});

it("warns when the model server is on localhost, which the container cannot reach", async () => {
  expect((await composeRun(["", "", "", "local", "", "qwen3:8b", ""])).shown).toContain("cannot be reached from the container");
  // No key to hand over, but the daemon refuses to start when the credentials folder is missing.
  const text = await readFile(join(home, "compose.yaml"), "utf8");
  expect(text).toContain("- /run/secrets:size=1m,mode=0700,uid=1000,gid=1001");
  expect(text).not.toContain("secrets:\n");
});

it("lists a key that two providers share once, and keeps a $ in a path from Compose's substitution", () => {
  const text = composeFile({ version: "1.2.3", uid: 1000, gid: 1000, secrets: [{ name: "llm.a", file: "/srv/$x/llm.a" }, { name: "llm.a", file: "/srv/$x/llm.a" }] });
  expect(text.match(/"llm\.a":/g)).toHaveLength(1);
  expect(text).toContain('file: "/srv/$$x/llm.a"');
});
