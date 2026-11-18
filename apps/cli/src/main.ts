#!/usr/bin/env node
// The `jaari` command. Each command loads only when it is used, so `jaari chat` never loads the config or keychain code.
import type { Command } from "./io.js";

const USAGE = `usage: jaari <command> | --version
  chat [--home <dir> | --data <dir> | --socket <path>]   talk to the running daemon
  init [--home <dir>]                     write or revisit the config (~/.jaari/config.jsonc)
  config <deployment | secrets | llm> [--home <dir>]   revisit one step of init
  secret set <name> [--home <dir>] [--config <file>]   store a secret; typed, never an argument
  doctor [--home <dir>]                   check the install; exits 1 when a check fails
  service install [--home <dir>] [--daemon <path>] [--print]   start the daemon at login or boot
  rollback [--home <dir>] [--list] [--yes]   restore the latest snapshot of the stores and the config`;

const COMMANDS: Record<string, () => Promise<{ run: Command }>> = {
  chat: () => import("./chat-command.js"),
  init: () => import("./init.js"),
  config: () => import("./config-command.js"),
  secret: () => import("./secret.js"),
  doctor: () => import("./doctor.js"),
  service: () => import("./service.js"),
  rollback: () => import("./rollback.js"),
};

const [name = "", ...args] = process.argv.slice(2);
if (name === "--version") {
  console.log((await import("./version.js")).VERSION);
  process.exit(0);
}
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
