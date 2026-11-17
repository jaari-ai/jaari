#!/usr/bin/env node
// `jaari-daemon --config <file> --data <dir> [--credentials <dir>] [--check]`. Runs from the built
// dist/ files under plain Node (ADR-115).
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { startDaemon, type DaemonConfig } from "./daemon.js";

const { values } = parseArgs({
  options: {
    config: { type: "string" },
    data: { type: "string" },
    // systemd sets $CREDENTIALS_DIRECTORY; Compose mounts secrets at /run/secrets (ADR-079).
    credentials: { type: "string", default: process.env.CREDENTIALS_DIRECTORY ?? "/run/secrets" },
    check: { type: "boolean", default: false }, // start every part, then stop: proves the build and the config
  },
});
if (!values.config || !values.data) {
  console.error("usage: jaari-daemon --config <file> --data <dir> [--credentials <dir>] [--check]");
  process.exit(2);
}

// shortcut: plain JSON; the config loader with JSONC, defaults, and `jaari init` is roadmap 0.6.
const config = JSON.parse(await readFile(values.config, "utf8")) as DaemonConfig;
const daemon = await startDaemon({ config, dataDir: values.data, credentialsDir: values.credentials! });
if (values.check) {
  await daemon.close();
  console.log("jaari-daemon: started and stopped cleanly");
} else {
  // The CLI socket keeps the process alive until a signal closes it.
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void daemon.close());
  console.log(`jaari-daemon: running; chat with \`jaari chat --socket ${daemon.socketPath}\``);
}
