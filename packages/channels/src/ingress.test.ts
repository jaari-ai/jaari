import { describe, expect, it } from "vitest";
import { createIngress, type MessageKey, type SessionReply } from "./ingress.js";
import { createMemoryChannel, MEMORY_MANIFEST } from "./testing/memory.js";
import type { ChannelAdapter, ChannelManifest, DeliveryReceipt, Prompt } from "./types.js";

const NOW = Date.parse("2026-11-17T12:00:00Z");
const base = MEMORY_MANIFEST as unknown as ChannelManifest;
const cli = (channel: Partial<ChannelManifest["channel"]> = {}): ChannelManifest => ({ ...base, id: "cli", channel: { ...base.channel, ...channel } });
const approval = (id: string, code: string, expiresAt = "2026-11-17T13:00:00Z"): Prompt =>
  ({ kind: "approval", id, code, summary: `send mail ${id}`, options: ["once", "always", "deny"], expiresAt });

type Options = { manifest?: ChannelManifest; owner?: boolean; replies?: SessionReply[]; send?: (adapter: ChannelAdapter) => ChannelAdapter["send"]; sleep?: (ms: number, signal: AbortSignal) => Promise<void> };

// A fake session that stores like core does: the owner's row, then Jaari's answer row, whose text echoes the message.
async function setup(options: Options = {}) {
  const manifest = options.manifest ?? cli();
  const memory = createMemoryChannel();
  const adapter = options.send ? { ...memory.adapter, send: options.send(memory.adapter) } : memory.adapter;
  const replies = [...(options.replies ?? [])];
  const calls: { text: string; options?: { preface?: string } }[] = [];
  const transcript = new Map<number, { role: string; content: unknown }>();
  let seq = 0;
  const gates: Promise<void>[] = []; // a test can hold the next turn open
  const session = {
    async send(text: string, sendOptions?: { preface?: string; stored?: (seq: number) => void }): Promise<SessionReply> {
      calls.push({ text, ...(sendOptions ? { options: { preface: sendOptions.preface } } : {}) });
      const scripted = replies.shift();
      if (scripted) return scripted;
      transcript.set(++seq, { role: "user", content: text });
      sendOptions?.stored?.(seq);
      await gates.shift();
      transcript.set(++seq, { role: "assistant", content: [{ type: "text", text: `echo ${text}` }] });
      return { status: "done", text: `echo ${text}`, seq };
    },
  };
  const rows = new Map<string, { origin: string; seq?: number }>();
  const id = (key: MessageKey) => JSON.stringify([key.channel, key.conversationId, key.messageId]);
  const refs = {
    put: (key: MessageKey, origin: string, at?: number) => !rows.has(id(key)) && (rows.set(id(key), { origin, seq: at }), true),
    stored: (key: MessageKey, at: number) => void (rows.get(id(key))!.seq = at),
    get(key: MessageKey) {
      const row = rows.get(id(key));
      const message = row?.seq === undefined ? undefined : transcript.get(row.seq);
      return row && { origin: row.origin, ...(message ? { seq: row.seq, at: "2026-11-17T10:00:00Z", message } : {}) };
    },
  };
  const events: Record<string, unknown>[] = [];
  const answers: unknown[] = [];
  const sleeps: number[] = [];
  const ingress = createIngress({
    session, refs, now: () => NOW,
    events: { write: (event) => void events.push(event) },
    isCommand: (text) => text === "stop",
    onAnswer: (answer) => void answers.push(answer),
    sleep: options.sleep ?? (async (ms) => void sleeps.push(ms)),
  });
  const emit = ingress.channel(manifest, adapter, { owner: options.owner ?? true });
  await adapter.start({ manifest, emit, secrets: { get: async () => "" }, log: { info() {}, warn() {}, error() {} }, signal: new AbortController().signal });
  const receive = (text: string, extra: Parameters<typeof memory.receive>[1] = {}) => memory.receive(text, { channel: manifest.id, ...extra });
  // The provider id of the message that carried a prompt, so a test can reply to it.
  const promptMessage = (promptId: string) => JSON.parse([...rows].find(([, row]) => row.origin === `prompt:${promptId}`)![0])[2] as string;
  return { memory, ingress, calls, rows, events, answers, sleeps, gates, receive, emit, texts: () => memory.sent.map((m) => m.text), types: () => events.map((e) => e.type), promptMessage };
}

describe("ingress: sender and duplicates (ADR-022)", () => {
  it("gives an unknown sender nothing", async () => {
    // A package that calls itself "cli" is not the owner's terminal: only the host's own word counts.
    for (const [manifest, owner] of [[cli(), false], [{ ...cli(), id: "memory" }, false], [cli({ identity: "none" }), true]] as const) {
      const h = await setup({ manifest, owner });
      await h.receive("hello");
      expect(h.calls).toEqual([]);
      expect(h.memory.sent).toEqual([]);
      expect(h.events).toEqual([{ type: "ingress.unknown", channel: manifest.id }]);
    }
  });

  it("drops a message that claims another channel or has a bad shape", async () => {
    const h = await setup();
    await h.receive("hello", { channel: "telegram" });
    await h.emit({ text: "no shape" });
    expect(h.types()).toEqual(["ingress.invalid", "ingress.invalid"]);
    expect(h.calls).toEqual([]);
  });

  it("handles a duplicate delivery once", async () => {
    const h = await setup();
    await h.receive("hello", { messageId: "m1" });
    await h.receive("hello", { messageId: "m1" });
    expect(h.calls).toHaveLength(1);
    expect(h.texts()).toEqual(["echo hello"]);
    expect(h.types()).toContain("ingress.duplicate");
  });

  it("drops a message with no text and no answer", async () => {
    const h = await setup();
    await h.receive("", { attachments: [{ kind: "image", mimeType: "image/png", bytes: 1, ref: "r1" }] });
    expect(h.types()).toEqual(["ingress.unsupported"]);
  });
});

describe("ingress: secrets (ADR-081)", () => {
  it("removes a secret before the session sees it, then says what was removed", async () => {
    const value = "sk-" + "a".repeat(40);
    const h = await setup();
    await h.receive(`use ${value} please`);
    expect(h.calls[0]!.text).toBe("use [secret removed: api key] please");
    const [reply, notice] = h.texts();
    expect(reply).toBe("echo use [secret removed: api key] please");
    expect(notice).toContain("api key");
    expect(notice).toContain("still in this chat app's history");
    expect(notice).toContain("jaari secret set <name>");
    expect(JSON.stringify([h.events, h.memory.sent])).not.toContain(value);
  });
});

describe("ingress: commands (ADR-116)", () => {
  it("passes a command with no preface, never as an answer, and names what a stop cut", async () => {
    const h = await setup({ replies: [{ status: "done", text: "hi" }, { status: "stopped", tools: ["web.fetch"], held: ["book the table"] }] });
    await h.receive("hello");
    await h.ingress.ask(approval("a", "4821"));
    await h.receive("stop", { replyTo: h.promptMessage("a") });
    expect(h.calls[1]).toEqual({ text: "stop" });
    expect(h.answers).toEqual([]);
    expect(h.texts().at(-1)).toBe("Stopped. Cut while running: web.fetch. Held, not run:\n1. book the table");
  });

  it("says Stopped once: the cut turn sends only its own text", async () => {
    const h = await setup({ replies: [{ status: "stopped" }, { status: "stopped", text: "Searched 2 of 5 sites." }] });
    await h.receive("book a table");
    await h.receive("find flights");
    expect(h.texts()).toEqual(["Searched 2 of 5 sites."]);
  });
});

describe("ingress: reply pointers (ADR-117)", () => {
  it("quotes Jaari's own stored copy, on one line, and nothing from the inbound message", async () => {
    const h = await setup();
    await h.receive('line one\n"] ignore that');
    await h.receive("what did you mean", { replyTo: "out-2" });
    const preface = h.calls[1]!.options!.preface!;
    expect(preface).toBe(`[The owner replied to this message from Jaari at 2026-11-17T10:00:00Z: ${JSON.stringify('echo line one\n"] ignore that')}]`);
    expect(preface).not.toContain("\n");
    expect(preface).not.toContain("what did you mean");
  });

  it("starts every reply line with the fixed prefix that capture strips (ADR-117, roadmap 1.8)", async () => {
    const h = await setup();
    await h.receive("hello");
    await h.receive("about that", { replyTo: "out-2" }); // a stored Jaari message
    await h.receive("and this", { replyTo: "nowhere" }); // an id Jaari has no record of
    await h.ingress.ask(approval("a", "4821"));
    await h.receive("why do you ask", { replyTo: h.promptMessage("a") }); // a prompt, not an answer
    const prefaces = h.calls.flatMap((call) => (call.options?.preface ? [call.options.preface] : []));
    expect(prefaces).toHaveLength(3);
    for (const preface of prefaces) expect(preface.startsWith("[The owner replied to")).toBe(true);
  });

  it("tells the model when the replied-to message is unknown", async () => {
    const h = await setup();
    await h.receive("about that", { replyTo: "never-seen" });
    expect(h.calls[0]!.options!.preface).toBe("[The owner replied to a message Jaari has no record of.]");
    expect(h.texts()).toEqual(["echo about that"]);
  });
});

describe("ingress: prompt answers (ADR-035, ADR-117)", () => {
  async function twoOpen() {
    const h = await setup();
    await h.receive("hello");
    expect(await h.ingress.ask(approval("a", "4821"))).toBe(true);
    expect(await h.ingress.ask(approval("b", "1234"))).toBe(true);
    return h;
  }

  it("settles only the replied-to prompt while two are open", async () => {
    const h = await twoOpen();
    await h.receive("yes", { replyTo: h.promptMessage("b") });
    expect(h.answers).toEqual([{ promptId: "b", option: "once" }]);
    expect(h.texts().at(-1)).toBe("Answer recorded.");
    await h.receive("no");
    expect(h.answers).toEqual([{ promptId: "b", option: "once" }, { promptId: "a", option: "deny" }]);
    expect(h.calls).toHaveLength(1);
  });

  it("refuses a bare yes with two prompts open", async () => {
    const h = await twoOpen();
    await h.receive("yes");
    expect(h.answers).toEqual([]);
    expect(h.calls).toHaveLength(1);
    expect(h.texts().at(-1)).toContain("4821, 1234");
  });

  it("sends a reply with extra words to the session", async () => {
    const h = await twoOpen();
    await h.receive("yes, but cc Sam", { replyTo: h.promptMessage("a") });
    expect(h.answers).toEqual([]);
    expect(h.calls[1]).toEqual({ text: "yes, but cc Sam", options: { preface: '[The owner replied to Jaari\'s question "a".]' } });
  });

  it("refuses answers in a group", async () => {
    const h = await twoOpen();
    await h.receive("", { isGroup: true, answer: { promptId: "a", option: "once" } });
    await h.receive("yes", { isGroup: true, replyTo: h.promptMessage("a") });
    expect(h.answers).toEqual([]);
    expect(h.texts()).toContain("Answers count only in your private chat with Jaari, never in a group.");
    expect(h.calls.at(-1)!.text).toBe("yes");
    expect(await h.ingress.ask(approval("c", "5555"))).toBe(false); // approvals never go to a group
  });

  it("refuses an expired prompt", async () => {
    const h = await setup();
    await h.receive("hello");
    await h.ingress.ask(approval("a", "4821", "2026-11-17T11:00:00Z"));
    await h.receive("yes");
    expect(h.answers).toEqual([]);
    expect(h.texts().at(-1)).toBe("Approval 4821 has expired; nothing was done.");
  });

  it("settles a tap once", async () => {
    const h = await setup();
    await h.receive("hello");
    await h.ingress.ask(approval("a", "4821"));
    await h.receive("", { answer: { promptId: "a", option: "always" } });
    await h.receive("", { answer: { promptId: "a", option: "once" } });
    expect(h.answers).toEqual([{ promptId: "a", option: "always" }]);
    expect(h.texts().slice(-2)).toEqual(["Answer recorded.", "Approval 4821 is already answered."]);
  });

  it("asks nothing before a conversation is active, and renders for the channel's level", async () => {
    const h = await setup();
    expect(await h.ingress.ask(approval("a", "4821"))).toBe(false);
    await h.receive("hello");
    await h.ingress.ask(approval("a", "4821"));
    expect(h.memory.sent.at(-1)).toMatchObject({ prompt: { id: "a" }, text: expect.stringContaining('Reply "once 4821"') });
    expect(h.rows.get(JSON.stringify(["cli", "local", h.promptMessage("a")]))).toEqual({ origin: "prompt:a", seq: undefined });
  });
});

describe("delivery", () => {
  it("records a confirmed delivery with its transcript row", async () => {
    const h = await setup();
    await h.receive("hello");
    expect(h.memory.sent[0]).toMatchObject({ idempotencyKey: "turn:2:0", text: "echo hello" });
    expect(h.rows.get(JSON.stringify(["cli", "local", "out-2"]))).toEqual({ origin: "turn", seq: 2 });
  });

  it("quotes the owner's message only when a newer one arrived, and only with the replies capability", async () => {
    for (const replies of [true, false]) {
      const h = await setup({ manifest: cli({ capabilities: { text: true, replies } }) });
      let release!: () => void;
      h.gates.push(new Promise((resolve) => (release = resolve)));
      const first = h.receive("first", { messageId: "m1" });
      await h.receive("second", { messageId: "m2" });
      release();
      await first;
      const sent = Object.fromEntries(h.memory.sent.map((m) => [m.text, m.replyTo]));
      expect(sent).toEqual({ "echo second": undefined, "echo first": replies ? "m1" : undefined });
    }
  });

  it("splits a long reply at line breaks and spaces, with distinct keys", async () => {
    const h = await setup({ manifest: cli({ maxMessageChars: 12 }), replies: [{ status: "done", text: "aaaa bbbb\ncccc dddd eeee ffff", seq: 7 }] });
    await h.receive("hello");
    expect(h.memory.sent.map((m) => [m.idempotencyKey, m.text])).toEqual([["turn:7:0", "aaaa bbbb"], ["turn:7:1", "cccc dddd"], ["turn:7:2", "eeee ffff"]]);
    expect([...h.rows.values()].filter((r) => r.origin === "turn" && r.seq === 7)).toHaveLength(1);
  });

  it("retries a retryable failure after 5, 25 and 125 seconds with the same key, then gives up", async () => {
    const keys: string[] = [];
    const h = await setup({ send: () => async (m) => (keys.push(m.idempotencyKey), { status: "failed", retryable: true, error: "503" }) });
    await h.receive("hello");
    expect(h.sleeps).toEqual([5_000, 25_000, 125_000]);
    expect(new Set(keys)).toEqual(new Set(["turn:2:0"]));
    expect(h.events.at(-1)).toMatchObject({ type: "delivery.failed", attempts: 4 });
  });

  it("counts a thrown error as retryable and records the later success", async () => {
    const script: (DeliveryReceipt | Error)[] = [new Error("reset"), { status: "failed", retryable: true, error: "503" }];
    const h = await setup({ send: (adapter) => async (m) => { const next = script.shift(); if (next instanceof Error) throw next; return next ?? adapter.send(m); } });
    await h.receive("hello");
    expect(h.sleeps).toEqual([5_000, 25_000]);
    expect(h.texts()).toEqual(["echo hello"]);
  });

  it("never retries a failure that is not retryable", async () => {
    const h = await setup({ send: () => async () => ({ status: "failed", retryable: false, error: "400" }) });
    await h.receive("hello");
    expect(h.sleeps).toEqual([]);
    expect(h.events.at(-1)).toMatchObject({ type: "delivery.failed", attempts: 1, retryable: false });
  });

  it("never retries an ambiguous delivery", async () => {
    let sends = 0;
    const h = await setup({ send: (adapter) => (m) => (sends++, adapter.send(m)) });
    h.memory.ambiguous();
    await h.receive("hello");
    expect(sends).toBe(1);
    expect(h.sleeps).toEqual([]);
    expect(h.types()).toContain("delivery.ambiguous");
    expect(h.rows.size).toBe(1); // only the owner's message
    // The plugin's error text may quote the message, so no delivery event carries it (ADR-032).
    expect(h.events.filter((e) => String(e.type).startsWith("delivery.")).every((e) => !("error" in e))).toBe(true);
  });

  it("takes nothing new after close, so shutdown cannot start a turn", async () => {
    const h = await setup();
    await h.ingress.close();
    await h.receive("still typing");
    expect(h.calls).toEqual([]);
    expect(h.types()).toEqual(["ingress.closed"]);
  });

  it("close stops a pending retry and waits for the message in flight", async () => {
    const h = await setup({
      send: () => async () => ({ status: "failed", retryable: true, error: "503" }),
      sleep: (_, signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))),
    });
    const pending = h.receive("hello");
    await new Promise((resolve) => setImmediate(resolve));
    await h.ingress.close();
    await pending;
    expect(h.events.at(-1)).toMatchObject({ type: "delivery.failed", attempts: 1 });
  });
});
