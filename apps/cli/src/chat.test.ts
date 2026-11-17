import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { CLI_MANIFEST, createCliChannel, socketPath, type InboundMessage } from "@jaari/channels";
import { afterEach, beforeEach, expect, it } from "vitest";
import { chat } from "./chat.js";
import { connect } from "./socket.js";

let dir: string;
let emitted: InboundMessage[];
let adapter: ReturnType<typeof createCliChannel>;
let input: PassThrough;
let shown: string;
let done: Promise<void>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "jc-"));
  emitted = [];
  adapter = createCliChannel({ socketPath: socketPath(dir) });
  await adapter.start({
    manifest: CLI_MANIFEST, emit: async (message) => void emitted.push(message), secrets: { get: async () => "" },
    log: { info() {}, warn() {}, error() {} }, signal: new AbortController().signal,
  });
  input = new PassThrough();
  const output = new PassThrough();
  shown = "";
  output.on("data", (chunk: Buffer) => (shown += chunk.toString()));
  done = chat({ socket: await connect(socketPath(dir)), input, output });
});

afterEach(async () => {
  input.end();
  await done;
  await adapter.stop();
  await rm(dir, { recursive: true, force: true });
});

const say = (text: string) => adapter.send({ channel: "cli", conversationId: "local", text, idempotencyKey: text });

it("hands a typed line to ingress and numbers it", async () => {
  input.write("hello\n\n");
  await expect.poll(() => emitted.map((m) => m.text)).toEqual(["hello"]);
  expect(shown).toBe("[1] you: hello\n");
});

it("shows a message from the daemon with its number", async () => {
  input.write("hi\n");
  await expect.poll(() => emitted.length).toBe(1);
  await say("which flight?");
  await expect.poll(() => shown).toBe("[1] you: hi\n[2] jaari: which flight?\n");
});

it("sends >N as a reply to message N, and shows which number the daemon answers", async () => {
  const asked = (await say("cheap or fast?")) as { providerMessageId: string };
  await expect.poll(() => shown).toContain("[1] jaari: cheap or fast?");
  input.write(">1 the cheaper one\n");
  await expect.poll(() => emitted.length).toBe(1);
  const receipt = await adapter.send({ channel: "cli", conversationId: "local", text: "booked", replyTo: emitted[0]!.messageId, idempotencyKey: "b" });
  expect(receipt.status).toBe("confirmed");
  await expect.poll(() => shown).toContain("[3] jaari (re 2): booked");
  expect(emitted[0]).toMatchObject({ text: "the cheaper one", replyTo: asked.providerMessageId });
});

it("sends nothing for an unknown message number", async () => {
  input.write(">9 what\n");
  await expect.poll(() => shown).toBe("there is no message 9\n");
  input.write("next\n");
  await expect.poll(() => emitted.map((m) => m.text)).toEqual(["next"]);
});

it("shows control codes as a placeholder, so a reply cannot set the clipboard or clear the screen", async () => {
  await say("\x1b]52;c;ZWNobyBoaQ==\x07ok\x1b[2J\u009b31m\tdone\nnext line");
  await expect.poll(() => shown).toContain("ok");
  for (const code of ["\x1b", "\x07", "\u009b"]) expect(shown).not.toContain(code);
  expect(shown).toBe("[1] jaari: \uFFFD]52;c;ZWNobyBoaQ==\uFFFDok\uFFFD[2J\uFFFD31m\tdone\nnext line\n");
});
