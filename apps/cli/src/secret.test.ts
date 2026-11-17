import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { createHostCredentialProvider } from "@jaari/secrets";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { secret } from "./secret.js";

// A fake keychain, passed in: no module mock, so no change in package layout can let a test reach the real one.
// The keychain provider itself is tested in packages/secrets, where its module mock resolves.
const keychain = { store: vi.fn<(name: string, value: string) => Promise<void>>() };

const VALUE = "value-" + "a".repeat(8);
const LLM = '"llm":{"providers":{},"tiers":{},"roles":{}}';

let home: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "jaari-secret-"));
  await writeFile(join(home, "config.jsonc"), `{"version":1,"secrets":{"zero":"host-credential"},${LLM}}`);
});

// Runs the command with `chunks` typed at the keyboard, one write each.
async function jaari(args: string[], chunks: string[] = [], isTTY = true) {
  const input = Object.assign(new PassThrough(), { setRawMode: vi.fn() });
  const output = new PassThrough();
  let text = "";
  output.on("data", (d: Buffer) => (text += d.toString()));
  const code = secret(args, { input, output, isTTY }, { keychain: () => keychain });
  for (const chunk of chunks) input.write(chunk);
  return { code: await code, text, input };
}
const set = (...extra: string[]) => ["set", "llm.x", "--home", home, ...extra];
const stored = () => createHostCredentialProvider(join(home, "credentials"), join(home, "data")).resolve("llm.x");
const nothingStored = async () => expect(await readdir(home)).toEqual(["config.jsonc"]);

describe("jaari secret set", () => {
  it("stores a typed value that reads back, echoes nothing, and restores the terminal", async () => {
    const { code, text, input } = await jaari(set(), [...VALUE, "\r"]);
    expect(code).toBe(0);
    expect(await stored()).toBe(VALUE);
    expect(text).toBe(`Value for llm.x (hidden): \nStored "llm.x" in ${join(home, "credentials")} (mode 0600).\n`);
    expect(input.setRawMode.mock.calls).toEqual([[true], [false]]);
    expect(input.listenerCount("data")).toBe(0);
  });

  it("handles a pasted chunk and Backspace", async () => {
    const { code, text } = await jaari(set(), [VALUE + "zz\x7f\b", "\n"]);
    expect(code).toBe(0);
    expect(await stored()).toBe(VALUE);
    expect(text).not.toContain(VALUE);
  });

  it.each([["\x03"], ["\x04"]])("cancels on %j and stores nothing", async (key) => {
    const { code, text, input } = await jaari(set(), [VALUE, key, "\r"]);
    expect(code).toBe(1);
    expect(text).toContain("Cancelled.");
    expect(text).not.toContain(VALUE);
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
    await nothingStored();
  });

  it("refuses an empty value", async () => {
    const { code } = await jaari(set(), ["\r"]);
    expect(code).toBe(1);
    await nothingStored();
  });

  it("refuses without a terminal", async () => {
    const { code, text } = await jaari(set(), [VALUE, "\r"], false);
    expect(code).toBe(2);
    expect(text).not.toContain(VALUE);
    expect(text).not.toContain("hidden");
    await nothingStored();
  });

  it.each([[set(VALUE)], [["set", "llm.x", "--value", VALUE]], [[`--value=${VALUE}`]], [["get", "llm.x"]], [["set"]]])("refuses the arguments %j", async (args) => {
    const { code, text } = await jaari(args, [VALUE, "\r"]);
    expect(code).toBe(2);
    expect(text).not.toContain(VALUE);
    expect(text).not.toContain("hidden");
    await nothingStored();
  });

  it("says why a value given as an argument is refused", async () => {
    expect((await jaari(set(VALUE))).text).toContain("shell history");
  });

  it("refuses a bad name before any prompt", async () => {
    const { code, text } = await jaari(["set", "../x", "--home", home], [VALUE, "\r"]);
    expect(code).toBe(2);
    expect(text).not.toContain("hidden");
    await nothingStored();
  });

  it("points to jaari init when there is no config", async () => {
    const { code, text } = await jaari(["set", "llm.x", "--home", join(home, "none")], [VALUE, "\r"]);
    expect(code).toBe(1);
    expect(text).toContain("jaari init");
    expect(text).not.toContain(VALUE);
  });

  it("reports a failed store without the value", async () => {
    await writeFile(join(home, "config.jsonc"), `{"version":1,"secrets":{"zero":"host-credential","credentialsDir":"data/creds"},${LLM}}`);
    const { code, text } = await jaari(set(), [VALUE, "\r"]);
    expect(code).toBe(1);
    expect(text).toContain('jaari: could not store "llm.x": ');
    expect(text).toContain("inside the Jaari data directory"); // a relative credentialsDir is resolved against the home folder
    expect(text).not.toContain(VALUE);
  });

  it("reads the config file the daemon was given, so both use the same credentials folder", async () => {
    const other = join(home, "other.jsonc");
    await writeFile(other, `{"version":1,"secrets":{"zero":"host-credential","credentialsDir":"creds2"},${LLM}}`);
    const { code } = await jaari([...set(), "--config", other], [VALUE, "\r"]);
    expect(code).toBe(0);
    expect(await createHostCredentialProvider(join(home, "creds2"), join(home, "data")).resolve("llm.x")).toBe(VALUE);
  });

  it("stores in the OS keychain by default", async () => {
    await writeFile(join(home, "config.jsonc"), `{"version":1,${LLM}}`);
    keychain.store.mockResolvedValue(undefined);
    const { code, text } = await jaari(set(), [VALUE, "\r"]);
    expect(code).toBe(0);
    expect(keychain.store).toHaveBeenLastCalledWith("llm.x", VALUE);
    expect(text).toContain('Stored "llm.x" in the OS keychain.');
    expect(text).not.toContain(VALUE);
  });
});
