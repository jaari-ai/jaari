// The built-in CLI channel (ADR-021): the daemon listens on a local Unix socket, mode 0600, and `jaari chat`
// attaches to it. One owner, one conversation, no history: a terminal sees what arrives while it is attached.
import { randomUUID } from "node:crypto";
import { chmod, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer, type Server } from "node:net";
import { join } from "node:path";
import type { Duplex } from "node:stream";
import { parseManifest } from "@jaari/capabilities";
import type { ChannelAdapter, ChannelContext, ChannelManifest, DeliveryReceipt, InboundMessage } from "../types.js";
import { encode, isClientLine, isHello, ndjson, PROTOCOL_VERSION, type ClientLine, type ServerLine } from "./protocol.js";

export const socketPath = (dataDir: string): string => join(dataDir, "jaari.sock");

// The same relative path works from src/cli/ and from the built dist/cli/.
const declared = (createRequire(import.meta.url)("../../package.json") as { jaari?: unknown }).jaari;
const checked = parseManifest(declared);
if (!checked.ok || checked.manifest.kind !== "channel") {
  throw new Error(`the CLI channel manifest in @jaari/channels' package.json is invalid: ${checked.ok ? "kind is not channel" : checked.errors.join("; ")}`);
}
export const CLI_MANIFEST = checked.manifest as ChannelManifest;

// macOS limits a Unix socket path to 104 bytes, Linux to 108; keep a margin.
const MAX_PATH_BYTES = 100;

const listen = (server: Server, path: string) =>
  new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(path, () => (server.off("error", reject), resolve()));
  });

export function createCliChannel(options: { socketPath: string }): ChannelAdapter {
  const path = options.socketPath;
  if (Buffer.byteLength(path) > MAX_PATH_BYTES) throw new Error(`the CLI socket path is longer than ${MAX_PATH_BYTES} bytes, choose a shorter data folder: ${path}`);
  let context: ChannelContext | undefined;
  let server: Server | undefined;
  let closing: Promise<void> | undefined;
  const connections = new Set<Duplex>();
  const attached = new Set<Duplex>(); // connections that finished the hello
  // shortcut: receipts are kept for the daemon's lifetime, drop old keys when the outbox persists them (roadmap 1.x).
  const receipts = new Map<string, DeliveryReceipt>();

  const inbound = (line: ClientLine): InboundMessage => {
    const at = new Date().toISOString();
    const base = { channel: CLI_MANIFEST.id, conversationId: "local", senderHandle: "local", isGroup: false, sentAt: at, receivedAt: at };
    if (line.type === "answer") return { ...base, messageId: randomUUID(), answer: { promptId: line.promptId, option: line.option } };
    return { ...base, messageId: line.id, text: line.text, ...(line.replyTo ? { replyTo: line.replyTo } : {}) };
  };

  async function serve(socket: Duplex) {
    connections.add(socket);
    socket.on("error", () => {}); // a terminal that goes away is normal; the loop below ends on it
    const write = (line: object) => socket.write(encode(line));
    const refuse = (error: string) => new Promise<void>((resolve) => socket.end(encode({ error }), resolve));
    let hello = false;
    try {
      for await (const raw of ndjson(socket)) {
        let line: unknown;
        try {
          line = JSON.parse(raw);
        } catch {
          if (!hello) return await refuse("the first line must be a hello");
          write({ error: "the line is not JSON" });
          continue;
        }
        if (!hello) {
          if (!isHello(line)) return await refuse("the first line must be a hello");
          if (!line.hello.versions.includes(PROTOCOL_VERSION)) return await refuse("no common protocol version");
          hello = true;
          attached.add(socket);
          write({ hello: { version: PROTOCOL_VERSION } });
        } else if (!isClientLine(line)) {
          write({ error: "the line is not a message or an answer" });
        } else {
          // Not awaited: ingress may wait for a whole turn, and the next line can be "stop" (ADR-116).
          void context?.emit(inbound(line)).catch((error: unknown) => context?.log.warn(`cli: ingress refused a message: ${String(error)}`));
        }
      }
    } catch {
      // a line over the cap, or a broken connection: drop this connection only
    } finally {
      connections.delete(socket);
      attached.delete(socket);
      socket.destroy();
    }
  }

  async function close() {
    context = undefined;
    for (const socket of connections) socket.destroy();
    const listening = server;
    server = undefined;
    if (listening) await new Promise<void>((resolve) => listening.close(() => resolve()));
    await rm(path, { force: true });
  }

  const adapter: ChannelAdapter = {
    async start(started) {
      context = started;
      closing = undefined;
      const created = createServer((socket) => void serve(socket));
      server = created;
      await listen(created, path).catch(async (error: NodeJS.ErrnoException) => {
        if (error.code !== "EADDRINUSE") throw error;
        // shortcut: a second daemon on the same data folder would take the socket, add a lock file with install and doctor (roadmap 0.12)
        await rm(path, { force: true });
        await listen(created, path);
      });
      await chmod(path, 0o600);
      started.signal.addEventListener("abort", () => void adapter.stop(), { once: true });
    },
    stop: () => (closing ??= close()),
    async send(message) {
      const known = receipts.get(message.idempotencyKey);
      if (known) return known;
      if (attached.size === 0) return { status: "failed", retryable: true, error: "no terminal is attached" };
      const id = randomUUID();
      const line: ServerLine = { type: "message", id, text: message.text ?? "", ...(message.replyTo ? { replyTo: message.replyTo } : {}), ...(message.prompt ? { prompt: message.prompt } : {}) };
      let receipt: DeliveryReceipt;
      try {
        for (const socket of attached) socket.write(encode(line));
        receipt = { status: "confirmed", providerMessageId: id };
      } catch (error) {
        receipt = { status: "ambiguous", error: `the write to the terminal failed: ${String(error)}` };
      }
      receipts.set(message.idempotencyKey, receipt);
      return receipt;
    },
    cursor: async () => "live", // no history to replay, so a fresh start replays nothing by construction
    health: async () => (server?.listening ? { ok: true } : { ok: false, detail: "the CLI socket is not listening" }),
  };
  return adapter;
}
