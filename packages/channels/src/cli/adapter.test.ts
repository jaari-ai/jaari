import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
// eslint-disable-next-line no-restricted-imports -- the test plays the terminal, so it dials the daemon's local socket
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { channelContract } from "../contract.js";
import type { ChannelAdapter, ChannelContext, InboundMessage } from "../types.js";
import { CLI_MANIFEST, createCliChannel, socketPath } from "./adapter.js";
import { encode, MAX_LINE_BYTES, ndjson } from "./protocol.js";
import packageJson from "../../package.json" with { type: "json" };

type Line = Record<string, unknown>;

// A terminal on the socket: records every line the daemon writes.
async function attach(path: string, versions = [1]) {
  const socket = createConnection({ path });
  socket.on("error", () => {});
  const lines: Line[] = [];
  const closed = new Promise<void>((resolve) => socket.on("close", () => resolve()));
  void (async () => { for await (const line of ndjson(socket)) lines.push(JSON.parse(line) as Line); })().catch(() => {});
  socket.write(encode({ hello: { versions } }));
  await expect.poll(() => lines.length).toBeGreaterThan(0);
  const messages = () => lines.filter((line) => line.type === "message");
  return { socket, lines, closed, messages, send: (line: object) => socket.write(encode(line)) };
}

const folders: string[] = [];
const temp = async () => {
  const dir = await mkdtemp(join(tmpdir(), "jc-"));
  folders.push(dir);
  return socketPath(dir);
};
afterEach(async () => void (await Promise.all(folders.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))));

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

channelContract({
  manifest: packageJson.jaari,
  sources: fileURLToPath(new URL(".", import.meta.url)),
  async create() {
    const path = await temp();
    const real = createCliChannel({ socketPath: path });
    let client: Awaited<ReturnType<typeof attach>> | undefined;
    // The terminal attaches right after the daemon starts, as `jaari chat` would.
    const adapter: ChannelAdapter = { ...real, start: async (context) => void (await real.start(context), (client = await attach(path))) };
    return {
      adapter,
      receive: async (text) => void client?.send({ type: "message", id: randomUUID(), text }),
      sent: async () => (await settle(), (client?.messages() ?? []).map((line) => line.text as string)),
      cleanup: async () => void client?.socket.destroy(),
    };
  },
});

// A started channel with a context that records what it emits.
async function started(path?: string) {
  const at = path ?? (await temp());
  const emitted: InboundMessage[] = [];
  const abort = new AbortController();
  const context: ChannelContext = {
    manifest: CLI_MANIFEST, emit: async (message) => void emitted.push(message), secrets: { get: async () => "" },
    log: { info() {}, warn() {}, error() {} }, signal: abort.signal,
  };
  const adapter = createCliChannel({ socketPath: at });
  await adapter.start(context);
  return { adapter, emitted, path: at, abort };
}

it("refuses a client with no common protocol version", async () => {
  const run = await started();
  const client = await attach(run.path, [2]);
  expect(client.lines).toEqual([{ error: "no common protocol version" }]);
  await client.closed;
  await run.adapter.stop();
});

it("answers a bad line with an error and keeps the connection", async () => {
  const run = await started();
  const client = await attach(run.path);
  client.send({ type: "message", id: "1", text: "hi", extra: true });
  client.socket.write("not json\n");
  client.send({ type: "message", id: "2", text: "ok" });
  await expect.poll(() => run.emitted.length).toBe(1);
  expect(run.emitted[0]).toMatchObject({ channel: "cli", conversationId: "local", messageId: "2", text: "ok" });
  expect(client.lines.filter((line) => "error" in line)).toHaveLength(2);
  await run.adapter.stop();
});

it("closes a connection that sends a line over the cap", async () => {
  const run = await started();
  const client = await attach(run.path);
  client.socket.write(Buffer.alloc(MAX_LINE_BYTES + 1, 0x61));
  await client.closed;
  expect(run.emitted).toEqual([]);
  await run.adapter.stop();
});

it("fails a send as retryable with no terminal attached, and does not remember the key", async () => {
  const run = await started();
  const message = { channel: "cli", conversationId: "local", text: "later", idempotencyKey: "k" };
  expect(await run.adapter.send(message)).toEqual({ status: "failed", retryable: true, error: "no terminal is attached" });
  const client = await attach(run.path);
  expect(await run.adapter.send(message)).toMatchObject({ status: "confirmed" });
  await expect.poll(() => client.messages().map((line) => line.text)).toEqual(["later"]);
  await run.adapter.stop();
});

it("makes the socket readable by the owner only, and removes it on stop", async () => {
  const run = await started();
  expect((await stat(run.path)).mode & 0o777).toBe(0o600);
  expect(await run.adapter.health()).toEqual({ ok: true });
  await run.adapter.stop();
  await expect(stat(run.path)).rejects.toThrow();
  expect(await run.adapter.health()).toMatchObject({ ok: false });
});

it("replaces a stale socket file left by a crashed daemon", async () => {
  const path = await temp();
  await writeFile(path, "");
  const run = await started(path);
  const client = await attach(path);
  expect(client.lines).toEqual([{ hello: { version: 1 } }]);
  await run.adapter.stop();
});

it("refuses a socket path that macOS cannot bind", () => {
  expect(() => createCliChannel({ socketPath: `/tmp/${"x".repeat(100)}` })).toThrow(/longer than 100 bytes/);
});

it("passes replyTo both ways", async () => {
  const run = await started();
  const client = await attach(run.path);
  client.send({ type: "message", id: "o-1", text: "the cheaper one", replyTo: "j-7" });
  await expect.poll(() => run.emitted.length).toBe(1);
  expect(run.emitted[0]).toMatchObject({ messageId: "o-1", replyTo: "j-7" });
  await run.adapter.send({ channel: "cli", conversationId: "local", text: "done", replyTo: "o-1", idempotencyKey: "r" });
  await expect.poll(() => client.messages()).toEqual([expect.objectContaining({ text: "done", replyTo: "o-1", id: expect.any(String) })]);
  client.send({ type: "answer", promptId: "p-1", option: "once" });
  await expect.poll(() => run.emitted.length).toBe(2);
  expect(run.emitted[1]).toMatchObject({ answer: { promptId: "p-1", option: "once" }, messageId: expect.any(String) });
  await run.adapter.stop();
});

it("reads the next line while ingress is still busy with the last one (ADR-116: a stop must get through)", async () => {
  const path = await temp();
  const emitted: string[] = [];
  const context: ChannelContext = {
    manifest: CLI_MANIFEST, secrets: { get: async () => "" }, log: { info() {}, warn() {}, error() {} }, signal: new AbortController().signal,
    emit: (message) => (emitted.push(message.text ?? ""), new Promise<void>(() => {})), // a turn that never ends
  };
  const adapter = createCliChannel({ socketPath: path });
  await adapter.start(context);
  const client = await attach(path);
  client.send({ type: "message", id: "1", text: "book the flight" });
  client.send({ type: "message", id: "2", text: "stop" });
  await expect.poll(() => emitted).toEqual(["book the flight", "stop"]);
  await adapter.stop();
});
