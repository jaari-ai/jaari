// The one place that dials: the daemon's local Unix socket, by filesystem path only (ADR-021, ADR-080).
import { once } from "node:events";
import { createConnection } from "node:net";
import { isAbsolute } from "node:path";
import { encode, ndjson, PROTOCOL_VERSION } from "@jaari/channels";

export type Line = Record<string, unknown>;
export type Connection = { send(line: object): void; lines: AsyncIterable<Line>; close(): void };

export async function connect(path: string): Promise<Connection> {
  // A path is never a host and port, so this cannot reach the network.
  if (!isAbsolute(path)) throw new Error(`the daemon socket must be an absolute path: ${path}`);
  const socket = createConnection({ path });
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
