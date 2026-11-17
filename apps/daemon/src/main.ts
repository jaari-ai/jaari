#!/usr/bin/env node
// `jaari-daemon [--home <dir>] [--config <file>] [--data <dir>] [--credentials <dir>] [--check]`. Runs from the
// built dist/ files under plain Node (ADR-115). Without flags it uses ~/.jaari, as `jaari init` writes it (ADR-118).
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { ConfigError, credentialsDirOf, jaariPaths, loadConfig } from "@jaari/core";
import { startDaemon } from "./daemon.js";

const { values } = parseArgs({
  options: {
    home: { type: "string" }, // the Jaari folder, in place of ~/.jaari
    config: { type: "string" },
    data: { type: "string" },
    // host-credential files: the flag, then what systemd supplies, then the folder named in the config (ADR-079).
    // Compose passes `--credentials /run/secrets`.
    credentials: { type: "string", default: process.env.CREDENTIALS_DIRECTORY },
    check: { type: "boolean", default: false }, // start every part, then stop: proves the build and the config
  },
});
const paths = jaariPaths(values.home ? resolve(values.home) : undefined);

const config = await loadConfig(values.config ?? paths.config).catch((error: unknown) => {
  if (!(error instanceof ConfigError)) throw error;
  console.error(`jaari-daemon: ${error.message}`);
  process.exit(1);
});
// A refused start (a bad llm section, an unreadable key, a missing credentials folder) is a message for the owner,
// not a crash: one line, exit 1 (ADR-079).
const daemon = await startDaemon({ config, dataDir: values.data ?? paths.data, credentialsDir: values.credentials ?? credentialsDirOf(config, paths) })
  .catch((error: unknown) => {
    console.error(`jaari-daemon: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
if (values.check) {
  await daemon.close();
  console.log("jaari-daemon: started and stopped cleanly");
} else {
  // The CLI socket keeps the process alive until a signal closes it.
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void daemon.close());
  console.log(`jaari-daemon: running; chat with \`jaari chat --socket ${daemon.socketPath}\``);
}
