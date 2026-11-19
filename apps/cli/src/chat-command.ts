// `jaari chat [--home <dir> | --data <dir> | --socket <path>]`: attach this terminal to a running daemon.
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { socketPath } from "@jaari/channels";
import { jaariPaths } from "@jaari/core/config";
import { chat } from "./chat.js";
import type { Command } from "./io.js";
import { connect } from "./socket.js";

export const run: Command = async (args, io) => {
  const { values } = parseArgs({ args, options: { home: { type: "string" }, data: { type: "string" }, socket: { type: "string" } } });
  if ([values.home, values.data, values.socket].filter(Boolean).length > 1) throw new Error("give one of --home, --data, --socket");
  const data = values.data ? resolve(values.data) : jaariPaths(values.home ? resolve(values.home) : undefined).data;
  const path = values.socket ? resolve(values.socket) : socketPath(data);
  try {
    await chat({ socket: await connect(path), input: io.input, output: io.output });
    return 0;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ECONNREFUSED") throw error;
    io.output.write(`jaari: the daemon is not running (no socket at ${path})\n`);
    return 1;
  }
};
