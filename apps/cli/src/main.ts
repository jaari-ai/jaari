#!/usr/bin/env node
// The `jaari` command. Each command loads only when it is used, so `jaari chat` never loads the config or keychain code.
import type { Command } from "./io.js";

const USAGE = `usage: jaari <command>
  chat [--home <dir> | --data <dir> | --socket <path>]   talk to the running daemon
  init [--home <dir>]                     write or revisit the config (~/.jaari/config.jsonc)
  secret set <name> [--home <dir>]        store a secret; the value is typed, never an argument`;

const COMMANDS: Record<string, () => Promise<{ run: Command }>> = {
  chat: () => import("./chat-command.js"),
  init: () => import("./init.js"),
  secret: () => import("./secret.js"),
};

const [name = "", ...args] = process.argv.slice(2);
const load = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;
if (!load) {
  console.error(USAGE);
  process.exit(2);
}
try {
  const { run } = await load();
  process.exitCode = await run(args, { input: process.stdin, output: process.stdout, isTTY: process.stdin.isTTY === true });
} catch (error) {
  console.error(`jaari: ${(error as Error).message}`);
  process.exitCode = (error as { code?: string }).code?.startsWith("ERR_PARSE_ARGS") ? 2 : 1;
}
