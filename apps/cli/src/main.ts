#!/usr/bin/env node
// `jaari chat --data <dir>` or `jaari chat --socket <path>`: attach this terminal to a running daemon.
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { socketPath } from "@jaari/channels";
import { chat } from "./chat.js";
import { connect } from "./socket.js";

const usage = () => {
  console.error("usage: jaari chat (--data <dir> | --socket <path>)");
  process.exit(2);
};

let parsed;
try {
  parsed = parseArgs({ allowPositionals: true, options: { data: { type: "string" }, socket: { type: "string" } } });
} catch {
  usage();
}
const { values, positionals } = parsed!;
if (positionals.length !== 1 || positionals[0] !== "chat" || !values.data === !values.socket) usage();

const path = values.socket ? resolve(values.socket) : socketPath(resolve(values.data!));
try {
  await chat({ socket: await connect(path), input: process.stdin, output: process.stdout });
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code;
  console.error(code === "ENOENT" || code === "ECONNREFUSED" ? `jaari: the daemon is not running (no socket at ${path})` : `jaari: ${(error as Error).message}`);
  process.exit(1);
}
