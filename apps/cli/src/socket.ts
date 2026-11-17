// The one place that dials: the daemon's local Unix socket, by filesystem path only (ADR-021, ADR-080).
import { once } from "node:events";
import { createConnection } from "node:net";
import { isAbsolute } from "node:path";
import { encode, ndjson, PROTOCOL_VERSION } from "@jaari/channels";

export type Line = Record<string, unknown>;
export type Connection = { send(line: object): void; lines: AsyncIterable<Line>; close(): void };

export async function connect(path: string, signal?: AbortSignal): Promise<Connection> {
  // A path is never a host and port, so this cannot reach the network.
  if (!isAbsolute(path)) throw new Error(`the daemon socket must be an absolute path: ${path}`);
  const socket = createConnection({ path });
  signal?.addEventListener("abort", () => socket.destroy(), { once: true }); // ends the wait for "connect" or the hello
  await once(socket, "connect");
  socket.on("error", () => {}); // after the hello, a closed daemon only ends `lines`
  socket.write(encode({ hello: { versions: [PROTOCOL_VERSION] } }));
  const raw = ndjson(socket);
  const first = await raw.next();
  const answer = first.done ? { error: "the daemon closed the connection" } : (JSON.parse(first.value) as Line);
  if ((answer.hello as Line | undefined)?.version !== PROTOCOL_VERSION) {
    socket.destroy();
    throw new Error(`the daemon refused the connection: ${String(answer.error ?? JSON.stringify(answer))}`);
  }
  async function* lines() {
    for await (const line of raw) {
      try {
        yield JSON.parse(line) as Line;
      } catch {
        // a line that is not JSON carries nothing to show
      }
    }
  }
  return { send: (line) => void socket.write(encode(line)), lines: lines(), close: () => void socket.destroy() };
}

// "running": the daemon answered its hello. "stopped": nothing listens (a socket file that a crash left behind refuses
// the connection). "silent": something listens but does not answer in time, such as a daemon that hangs.
export async function daemonRunning(path: string, waitMs = 2_000): Promise<"running" | "stopped" | "silent"> {
  const signal = AbortSignal.timeout(waitMs);
  try {
    (await connect(path, signal)).close();
    return "running";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ECONNREFUSED") return "stopped";
    return signal.aborted ? "silent" : "running"; // it answered, even if with a refusal
  }
}
