// Shared by the tests of the admin commands: a Jaari folder in a temp dir, and something that answers like the daemon.
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { socketPath } from "@jaari/channels";
import type { Io } from "./io.js";

export const OWNER = "11111111-1111-4111-8111-111111111111";

// A config with host-credential secrets and one provider key, as `jaari init` and `jaari secret set` leave it.
export async function install() {
  const home = join(await mkdtemp(join(tmpdir(), "jd-")), "jaari"); // short: a socket path has a length limit
  const data = join(home, "data");
  const credentials = join(home, "credentials");
  await mkdir(data, { recursive: true, mode: 0o700 });
  await mkdir(credentials, { mode: 0o700 });
  await writeFile(join(credentials, "llm.faux"), "scripted-key\n", { mode: 0o600 });
  const config = join(home, "config.jsonc");
  const write = (extra: object = {}) =>
    writeFile(config, JSON.stringify({
      version: 1, owner: { id: OWNER }, secrets: { zero: "host-credential" },
      llm: { providers: { faux: { apiKey: "secretRef:llm.faux" } }, tiers: { small: ["faux/a"] }, roles: { main: "small", summarize: "small" } },
      ...extra,
    }, null, 2), { mode: 0o600 });
  await write();
  return { home, data, credentials, config, write };
}

// Answers the hello on the daemon's socket, and nothing else.
export async function fakeDaemon(data: string) {
  const server = createServer((socket) => void socket.once("data", () => socket.write(JSON.stringify({ hello: { version: 1 } }) + "\n")));
  await new Promise<void>((done) => server.listen(socketPath(data), done));
  await chmod(socketPath(data), 0o600); // as the daemon leaves it
  return () => new Promise<void>((done) => server.close(() => done()));
}

export function terminal(lines: string[] = [], isTTY = false) {
  const input = new PassThrough();
  const output = new PassThrough();
  let shown = "";
  output.on("data", (chunk: Buffer) => (shown += chunk.toString()));
  input.end(lines.map((line) => `${line}\n`).join(""));
  const io: Io = { input, output, isTTY };
  return { io, shown: () => shown };
}
