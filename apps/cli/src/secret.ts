// `jaari secret set <name> [--home <dir>] [--data <dir>]`: store a secret typed at a hidden prompt (ADR-088).
// The value never comes from an argument and never reaches the output: not echoed, not counted, not in errors.
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { ConfigError, credentialsDirOf, jaariPaths, loadConfig } from "@jaari/core/config";
import { createHostCredentialProvider, createOsKeychainProvider, isSecretName, scrub } from "@jaari/secrets";
import type { Io } from "./io.js";

const USAGE = "usage: jaari secret set <name> [--home <dir>] [--data <dir>]";

// The keychain is passed in, so a test hands over a fake and can never write to the owner's real keychain.
export type SecretDeps = { keychain: () => Pick<ReturnType<typeof createOsKeychainProvider>, "store"> };

export async function secret(args: string[], io: Io, deps: SecretDeps = { keychain: createOsKeychainProvider }): Promise<number> {
  const say = (line: string) => io.output.write(`${line}\n`);
  let parsed;
  try {
    parsed = parseArgs({ args, allowPositionals: true, options: { home: { type: "string" }, data: { type: "string" } } });
  } catch {
    // parseArgs errors quote the argument, which may be a value typed in the wrong place.
    say(USAGE);
    return 2;
  }
  const { values, positionals } = parsed;
  const [sub, name, ...rest] = positionals;
  if (sub !== "set" || name === undefined) return (say(USAGE), 2);
  if (rest.length > 0) return (say("jaari: type the value at the prompt, never as an argument: arguments land in shell history and process lists"), 2);
  // ADR-076: admin commands need a person at the keyboard; a pipe is not one.
  if (!io.isTTY) return (say("jaari: secret set needs an interactive terminal; it does not read a value from a pipe"), 2);
  if (!isSecretName(name)) return (say("jaari: a secret name uses letters, digits, '.', '_' and '-', and starts with a letter or digit"), 2);

  const paths = jaariPaths(values.home === undefined ? undefined : resolve(values.home));
  let config;
  try {
    config = await loadConfig(paths.config);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    for (const problem of error.problems) say(`jaari: ${problem}`);
    return 1;
  }
  const zero = config.secrets?.zero ?? "os-keychain";
  const dir = credentialsDirOf(config, paths); // the folder the daemon reads, by the same rule (ADR-118)
  const provider = zero === "os-keychain" ? deps.keychain() : createHostCredentialProvider(dir, resolve(values.data ?? paths.data));

  io.output.write(`Value for ${name} (hidden): `);
  const value = await readHidden(io);
  io.output.write("\n");
  if (value === null) return (say("Cancelled."), 1);
  if (value === "") return (say("jaari: nothing was typed; nothing stored"), 1);
  try {
    await provider.store(name, value);
  } catch (error) {
    say(`jaari: could not store "${name}": ${scrub((error as Error).message, [value])}`);
    return 1;
  }
  say(`Stored "${name}" ${zero === "os-keychain" ? "in the OS keychain" : `in ${dir} (mode 0600)`}.`);
  return 0;
}

export const run = (args: string[], io: Io) => secret(args, io);

// Reads one line in raw mode with no echo. Resolves null on Ctrl+C, Ctrl+D, or the end of input.
async function readHidden(io: Io): Promise<string | null> {
  const { input } = io;
  let onData!: (chunk: string) => void, onEnd!: () => void, onError!: (error: Error) => void;
  input.setRawMode?.(true);
  try {
    input.setEncoding("utf8"); // a character split across two chunks is joined, not garbled
    return await new Promise<string | null>((done, fail) => {
      const chars: string[] = []; // whole characters, so Backspace never splits a surrogate pair
      onData = (chunk) => {
        for (const c of chunk) {
          if (c === "\r" || c === "\n") return done(chars.join(""));
          if (c === "\x03" || c === "\x04") return done(null);
          if (c === "\x7f" || c === "\b") chars.pop();
          // shortcut: other control characters are dropped, but the tail of an arrow-key sequence ("[A") is kept; parse escape sequences if owners hit it
          else if (c >= " ") chars.push(c);
        }
      };
      onEnd = () => done(null);
      onError = fail;
      input.on("data", onData).once("end", onEnd).once("error", onError);
    });
  } finally {
    input.off("data", onData).off("end", onEnd).off("error", onError);
    input.pause(); // a flowing stdin would keep the process alive
    input.setRawMode?.(false);
  }
}
