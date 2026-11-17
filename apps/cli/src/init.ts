// `jaari init [--home <dir>]`: ask a few questions and write the owner config (ADR-056). Run again, it revisits every
// step with the current values as defaults and edits only what changed, so the owner's comments stay.
import { randomBytes, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readlink, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { CONFIG_VERSION, ConfigError, credentialsDirOf, isInsideData, jaariPaths, parseConfig, type Config } from "@jaari/core/config";
import { applyEdits, modify } from "jsonc-parser";
import type { Command, Io } from "./io.js";
import { createPrompter, InputEnded } from "./prompt.js";

// Placeholders that the answers replace; only the comments survive as written.
const TEMPLATE = `{
  // ADR-056, ADR-118: the schema version of this file. \`jaari init\` writes it; migrations raise it.
  "version": ${CONFIG_VERSION},

  // ADR-119: written once by \`jaari init\`; every record carries it. Never change it by hand.
  "owner": {},

  // ADR-017: where this daemon runs. "vps" | "server" | "home" | "laptop"
  "deployment": { "target": "vps" },

  // ADR-079: secret zero from the OS keychain ("os-keychain") or, on a server, from owner-only files in
  // \`credentialsDir\` ("host-credential"). ADR-118: that folder is outside the data folder.
  "secrets": { "zero": "host-credential" },

  // ADR-011, ADR-019: model providers, tiers (fallback chains of "provider/model"), and the tier of each role.
  "llm": {}
}
`;

const FORMAT = { formattingOptions: { insertSpaces: true, tabSize: 2 } };
const ID = /^[a-z0-9][a-z0-9-]*$/;

const readExisting = async (path: string): Promise<string | undefined> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const llmIsValid = async (value: unknown): Promise<boolean> => {
  const { checkLlmConfig } = await import("@jaari/llm");
  try {
    checkLlmConfig(value);
    return true;
  } catch {
    return false;
  }
};

// shortcut: one provider and one tier; the presets, the budget and local-model qualification arrive with jaari llm eval (roadmap 1.9)
async function askModel(ask: ReturnType<typeof createPrompter>["ask"]): Promise<Config["llm"]> {
  const kind = await ask("Model: an API or a local server?", { current: "api", allowed: ["api", "local"] });
  const id = await ask("Provider id", { current: kind === "api" ? "anthropic" : "local", check: (a) => (ID.test(a) ? undefined : "use lowercase letters, digits and -") });
  const model = await ask("Model id", { check: (a) => (a ? undefined : "a model id is required") });
  const provider = kind === "api"
    ? { apiKey: `secretRef:llm.${id}` }
    : { api: "openai-completions", baseUrl: await ask("Server URL", { current: "http://localhost:11434/v1", check: (a) => (/^https?:\/\//.test(a) ? undefined : "start with http:// or https://") }) };
  return { providers: { [id]: provider }, tiers: { large: [`${id}/${model}`] }, roles: { main: "large", summarize: "large" } };
}

// Writes into the same folder and renames, so a crash never leaves half a config; owner-only, as it names accounts.
// A config that is a link (a dotfiles manager) is written through, so the link stays a link.
async function writePrivately(home: string, link: string, text: string): Promise<void> {
  await mkdir(home, { recursive: true, mode: 0o700 });
  // A link to a file not written yet has no real path: follow it by hand, or the rename would replace the link.
  const path = await realpath(link).catch(async () =>
    (await lstat(link).catch(() => null))?.isSymbolicLink() ? resolve(dirname(link), await readlink(link)) : link);
  const temp = `${path}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(temp, text, { flag: "wx", mode: 0o600 });
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

export async function init(args: string[], io: Io, platform: NodeJS.Platform = process.platform): Promise<number> {
  const { values } = parseArgs({ args, options: { home: { type: "string" } } });
  const home = values.home ? resolve(values.home) : undefined; // an empty --home means the default, as everywhere
  const paths = jaariPaths(home);
  const say = (line: string) => io.output.write(`${line}\n`);
  const existing = await readExisting(paths.config);
  let current: Config | undefined;
  try {
    current = existing === undefined ? undefined : parseConfig(existing);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    for (const problem of error.problems) say(problem);
    say(`Fix ${paths.config} or move it away, then run \`jaari init\` again. Nothing was written.`);
    return 1;
  }

  const mac = platform === "darwin";
  const prompter = createPrompter(io);
  let target: string, stayAwake: string | undefined, zero: string, credentialsDir: string | undefined, llm: Config["llm"] | undefined;
  try {
    target = await prompter.ask("Where does Jaari run (vps, server, home, laptop)?", { current: current?.deployment?.target ?? (mac ? "laptop" : "vps"), allowed: ["vps", "server", "home", "laptop"] });
    // ADR-057: asked only on a laptop; another host never sleeps by itself.
    if (target === "laptop") {
      say("While Jaari works on mains power, it can ask the laptop not to fall asleep by itself (a closed lid still sleeps).");
      stayAwake = await prompter.ask("Keep the laptop awake (working, never, always)?", { current: current?.power?.stayAwake ?? "working", allowed: ["working", "never", "always"] });
    }
    say("A server has no keychain, so it keeps secrets in a folder of owner-only files (host-credential).");
    zero = await prompter.ask("Where are secrets kept (os-keychain, host-credential)?", { current: current?.secrets?.zero ?? (mac ? "os-keychain" : "host-credential"), allowed: ["os-keychain", "host-credential"] });
    if (zero === "host-credential") {
      credentialsDir = await prompter.ask("Credentials folder", {
        current: current?.secrets?.credentialsDir ?? (home === undefined ? "~/.jaari/credentials" : paths.credentials),
        // The daemon and `jaari secret set` refuse it there (ADR-079), so init does too, before writing.
        check: (answer) => (isInsideData(credentialsDirOf({ secrets: { credentialsDir: answer } }, paths), paths) ? `not inside the data folder ${paths.data}` : undefined),
      });
    }
    const keep = current !== undefined && (await llmIsValid(current.llm))
      && !/^n/i.test(await prompter.ask("Keep the current model settings? [Y/n]", { check: (a) => (/^(y|yes|n|no)?$/i.test(a) ? undefined : "answer y or n") }));
    if (!keep) llm = await askModel(prompter.ask);
  } catch (error) {
    if (!(error instanceof InputEnded)) throw error;
    say("Cancelled; nothing was written.");
    return 1;
  } finally {
    prompter.close();
  }

  let text = existing ?? TEMPLATE;
  const base = existing === undefined ? parseConfig(TEMPLATE) : current;
  // Only a changed value is edited, so a run that changes nothing leaves the file as it was, byte for byte.
  const set = (path: string[], value: unknown) => {
    const was = path.reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], base);
    if (!isDeepStrictEqual(was, value)) text = applyEdits(text, modify(text, path, value, FORMAT));
  };
  // shortcut: an older config is migrated only in memory, so only `version` changes in the file; write the migrated sections here when the first migration ships (ADR-056)
  set(["version"], CONFIG_VERSION);
  // Made once and never replaced: the stores refuse to open under another id (ADR-119).
  set(["owner", "id"], current?.owner?.id ?? randomUUID());
  set(["deployment", "target"], target);
  if (stayAwake !== undefined) set(["power", "stayAwake"], stayAwake); // a host that is no laptop keeps what it had
  set(["secrets", "zero"], zero);
  set(["secrets", "credentialsDir"], credentialsDir);
  if (llm !== undefined) set(["llm"], llm);

  let config: Config;
  try {
    config = parseConfig(text);
    const { checkLlmConfig } = await import("@jaari/llm");
    checkLlmConfig(config.llm);
  } catch (error) {
    for (const problem of error instanceof ConfigError ? error.problems : [(error as Error).message]) say(problem);
    say("Nothing was written.");
    return 1;
  }
  await writePrivately(paths.home, paths.config, text);

  say(`Wrote ${paths.config}. Next:`);
  const providers = Object.values((config.llm as { providers: Record<string, { apiKey?: string }> }).providers);
  const where = home === undefined ? "" : ` --home ${paths.home}`;
  for (const { apiKey } of providers) if (apiKey?.startsWith("secretRef:")) say(`  jaari secret set ${apiKey.slice("secretRef:".length)}${where}`);
  say(`  jaari-daemon${where}`);
  say(`  jaari chat${where}`);
  return 0;
}

export const run: Command = (args, io) => init(args, io);
