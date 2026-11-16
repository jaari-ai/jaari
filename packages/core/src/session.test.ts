import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createModels, fauxAssistantMessage, fauxProvider, fauxToolCall, type AssistantMessage, type FauxResponseStep } from "@earendil-works/pi-ai";
import { createLlm } from "@jaari/llm";
import { describe, expect, it, vi } from "vitest";
import { openEventLog } from "./events.js";
import { createSession, createWatchdog, selectCut, type Limits } from "./session.js";
import { openStore } from "./store.js";

const tool = (name: string, execute: AgentTool["execute"]): AgentTool => ({ name, label: name, description: name, parameters: { type: "object", properties: {} }, execute });
const echo = tool("echo", async () => ({ content: [{ type: "text", text: "ok" }], details: undefined }));
const broken = tool("broken", async () => { throw new Error("disk full"); });
const callTool = (name: string) => fauxAssistantMessage(fauxToolCall(name, {}), { stopReason: "toolUse" });
// A model call that never answers until it is aborted.
const hang: FauxResponseStep = (_, options) =>
  new Promise((resolve) => options!.signal!.addEventListener("abort", () => resolve(fauxAssistantMessage("", { stopReason: "aborted" }))));
// The text of every message the model was sent on one call.
const seen = (context: { messages: readonly unknown[] }) => JSON.stringify(context.messages).replace(/"timestamp":\d+/g, "");

async function setup(options: { path?: string; limits?: Partial<Limits>; tools?: AgentTool[]; window?: number } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "jaari-core-"));
  const faux = fauxProvider({ provider: "faux", models: [{ id: "a", contextWindow: options.window ?? 100_000 }] });
  const models = createModels();
  models.setProvider(faux.provider);
  const llm = await createLlm({
    config: { providers: { faux: { apiKey: "secretRef:llm.faux" } }, tiers: { small: ["faux/a"] }, roles: { main: "small", summarize: "small" } },
    fetch: vi.fn() as unknown as typeof globalThis.fetch, secrets: { resolve: async () => "", health: async () => ({ ok: true }) },
    usage: { record: () => {}, close: () => {} }, models,
  });
  const path = options.path ?? join(dir, "session.db");
  const log = join(dir, "events.ndjson");
  const session = createSession({ store: openStore(path), events: openEventLog(log), llm, systemPrompt: "You are Jaari.", tools: options.tools, limits: options.limits });
  const events = async () => (await readFile(log, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as { type: string; limit?: string });
  return { faux, session, path, events };
}

describe("the main session", () => {
  it("answers, and reopens over its transcript after a restart (ADR-065)", async () => {
    const first = await setup();
    first.faux.setResponses([fauxAssistantMessage("Hello.")]);
    expect(await first.session.send("My cat is Miso.")).toEqual({ status: "done", text: "Hello." });

    const second = await setup({ path: first.path });
    let context = "";
    second.faux.setResponses([(sent) => ((context = seen(sent)), fauxAssistantMessage("Miso."))]);
    expect((await second.session.send("What is my cat called?")).text).toBe("Miso.");
    expect(context).toContain("My cat is Miso.");
    expect((await second.events()).map((e) => e.type)).toEqual(["turn.start", "turn.end"]);
  });

  it("stops a turn at the step limit (ADR-031)", async () => {
    const { faux, session, events } = await setup({ tools: [echo], limits: { stepsPerTurn: 3 } });
    faux.setResponses(Array.from({ length: 5 }, () => callTool("echo")));
    expect((await session.send("loop")).status).toBe("steps");
    expect(faux.state.callCount).toBe(3);
    expect(await events()).toContainEqual(expect.objectContaining({ type: "limit", limit: "steps" }));
  });

  it("ends a turn as stalled after two steps whose tool calls all failed", async () => {
    const { faux, session } = await setup({ tools: [broken] });
    faux.setResponses(Array.from({ length: 5 }, () => callTool("broken")));
    expect((await session.send("try")).status).toBe("stalled");
    expect(faux.state.callCount).toBe(2);
  });

  it('"stop now" aborts the running turn, and the pause survives a restart', async () => {
    const { faux, session, path } = await setup();
    faux.setResponses([hang, fauxAssistantMessage("never")]);
    const turn = session.send("do a long thing");
    await expect.poll(() => faux.state.callCount).toBe(1);
    expect(await session.send("Stop now!")).toEqual({ status: "stopped", tools: [], held: [] }); // punctuation still stops
    expect((await turn).status).toBe("stopped");

    const reopened = (await setup({ path })).session;
    expect(reopened.paused()).toBe(true);
    expect(await reopened.send("and this?")).toEqual({ status: "held" });
    expect(faux.state.callCount).toBe(1);
    expect(reopened.resume()).toEqual({ status: "resumed", held: ["and this?"] });
  });

  it('"pause" lets the running turn finish and holds what comes after', async () => {
    const { faux, session } = await setup({ tools: [echo] });
    faux.setResponses([callTool("echo"), fauxAssistantMessage("finished")]);
    const turn = session.send("work");
    await expect.poll(() => faux.state.callCount).toBeGreaterThan(0);
    expect(await session.send("pause")).toEqual({ status: "paused" });
    expect(await turn).toEqual({ status: "done", text: "finished" });
    expect(await session.send("more")).toEqual({ status: "held" });
    expect(faux.state.callCount).toBe(2);
  });

  it("the watchdog aborts a turn with no activity", async () => {
    const { faux, session } = await setup({ limits: { watchdogMs: 30, watchdogTickMs: 5 } });
    faux.setResponses([hang]);
    expect((await session.send("hello?")).status).toBe("watchdog");
  });

  it("adds a message sent during a turn at the next step (steering)", async () => {
    let release = () => {};
    const slow = tool("slow", () => new Promise((resolve) => (release = () => resolve({ content: [{ type: "text", text: "ok" }], details: undefined }))));
    const { faux, session } = await setup({ tools: [slow] });
    let context = "";
    faux.setResponses([callTool("slow"), (sent) => ((context = seen(sent)), fauxAssistantMessage("Both done."))]);
    const turn = session.send("first");
    await expect.poll(() => faux.state.callCount).toBe(1);
    expect(await session.send("also this")).toEqual({ status: "steered" });
    release();
    expect((await turn).text).toBe("Both done.");
    expect(context).toContain("also this");
  });

  it("ends the turn on a refusal with no second model call (ADR-085)", async () => {
    const { faux, session } = await setup();
    const refusal: AssistantMessage = { ...fauxAssistantMessage("", { stopReason: "error", errorMessage: "no" }), rawStopReason: "refusal" };
    faux.setResponses([refusal, fauxAssistantMessage("never")]);
    expect((await session.send("x")).status).toBe("refusal");
    expect(faux.state.callCount).toBe(1);
  });

  it("compacts the context after a turn and keeps the whole transcript (ADR-065)", async () => {
    // A 1,000-token window with 900 reserved: the context may hold 100 tokens, the kept part 40.
    const limits = { reserveTokens: 900, keepRecentTokens: 40 };
    const { faux, session, path, events } = await setup({ limits, window: 1_000 });
    const long = (word: string) => `${word} `.repeat(60);
    faux.setResponses([fauxAssistantMessage(long("one")), fauxAssistantMessage(long("two")), fauxAssistantMessage("SUMMARY-1")]);
    await session.send("first question");
    expect((await session.send("second question")).text).toBe(long("two")); // the reply does not wait for the summary
    await session.idle();
    expect(await events()).toContainEqual(expect.objectContaining({ type: "compaction" }));
    const context = seen({ messages: session.messages() });
    expect(context).toContain("SUMMARY-1");
    expect(context).not.toContain("first question");
    expect(context).toContain("two two"); // the cut may now land on the model's last answer
    expect(openStore(path).load().length).toBe(4);

    const reopened = (await setup({ path, limits, window: 1_000 })).session;
    expect(seen({ messages: reopened.messages() })).toBe(context);
  });
});

describe("review of 0.5", () => {
  const limits = { reserveTokens: 900, keepRecentTokens: 40 };
  const long = (word: string) => `${word} `.repeat(60);

  it("never runs a step past the limit, even after a text-only step and a steered message", async () => {
    let release = () => {};
    const wait = new Promise<void>((resolve) => (release = resolve));
    const { faux, session, events } = await setup({ tools: [echo], limits: { stepsPerTurn: 2 } });
    faux.setResponses([callTool("echo"), async () => (await wait, fauxAssistantMessage("step two")), fauxAssistantMessage("next turn")]);
    const turn = session.send("go");
    await expect.poll(() => faux.state.callCount).toBe(2);
    expect(await session.send("also")).toEqual({ status: "steered" }); // arrives during step 2
    release();
    expect(await turn).toEqual({ status: "done", text: "next turn" }); // "also" ran as its own turn
    expect(faux.state.callCount).toBe(3);
    expect(await events()).toContainEqual(expect.objectContaining({ type: "limit", limit: "steps", steps: 2 }));
  });

  it('holds a steered message on "stop now", even when "resume" comes before the turn settles', async () => {
    let release = () => {};
    const stubborn = tool("stubborn", () => new Promise((resolve) => (release = () => resolve({ content: [{ type: "text", text: "ok" }], details: undefined }))));
    const { faux, session } = await setup({ tools: [stubborn] });
    faux.setResponses([callTool("stubborn"), fauxAssistantMessage("never")]);
    const turn = session.send("first");
    await expect.poll(() => faux.state.callCount).toBe(1);
    await session.send("extra");
    session.stop();
    expect(session.resume()).toEqual({ status: "resumed", held: ["extra"] });
    release();
    expect((await turn).status).toBe("stopped");
    expect(faux.state.callCount).toBe(1);
  });

  it("ends the turn as stalled on three identical tool errors", async () => {
    const { faux, session } = await setup({ tools: [broken, echo] });
    const both = fauxAssistantMessage([fauxToolCall("broken", {}), fauxToolCall("echo", {})], { stopReason: "toolUse" });
    faux.setResponses([both, both, both, both]);
    expect((await session.send("try")).status).toBe("stalled");
    expect(faux.state.callCount).toBe(3);
  });

  it("refuses an empty summary and keeps the context whole", async () => {
    const { faux, session, events } = await setup({ limits, window: 1_000 });
    faux.setResponses([fauxAssistantMessage(long("one")), fauxAssistantMessage(long("two")), fauxAssistantMessage("")]);
    await session.send("first question");
    await session.send("second question");
    await session.idle();
    expect(await events()).toContainEqual(expect.objectContaining({ type: "compaction.failed", reason: "empty summary" }));
    expect(seen({ messages: session.messages() })).toContain("first question");
  });

  it('"stop now" during a compaction aborts it, and nothing is applied', async () => {
    const { faux, session, events } = await setup({ limits, window: 1_000 });
    faux.setResponses([fauxAssistantMessage(long("one")), fauxAssistantMessage(long("two")), hang]);
    await session.send("first question");
    await session.send("second question");
    await expect.poll(() => faux.state.callCount).toBe(3); // the summary call is in flight
    session.stop();
    await session.idle();
    expect(await events()).toContainEqual(expect.objectContaining({ type: "compaction.failed" }));
    expect(seen({ messages: session.messages() })).toContain("first question");
  });

  it("compacts one long turn with a single owner message, cutting at a model message", async () => {
    const big = tool("big", async () => ({ content: [{ type: "text", text: long("data") }], details: undefined }));
    const { faux, session, events } = await setup({ limits, window: 1_000, tools: [big] });
    faux.setResponses([callTool("big"), callTool("big"), fauxAssistantMessage("done"), fauxAssistantMessage("SUMMARY")]);
    await session.send("collect");
    await session.idle();
    expect(await events()).toContainEqual(expect.objectContaining({ type: "compaction" }));
    expect(seen({ messages: session.messages() })).toContain("SUMMARY");
    const roles = session.messages().map((m) => m.role);
    expect(roles[roles.indexOf("user") + 1]).not.toBe("toolResult");
  });
});

describe("review 2 of 0.5", () => {
  const overflow = () => fauxAssistantMessage("", { stopReason: "error", errorMessage: "prompt is too long: 250000 tokens > 200000 maximum" });

  it('"stop now" names the running tools and the held messages', async () => {
    let release = () => {};
    const slow = tool("slow", () => new Promise((resolve) => (release = () => resolve({ content: [{ type: "text", text: "ok" }], details: undefined }))));
    const { faux, session } = await setup({ tools: [slow] });
    faux.setResponses([callTool("slow")]);
    const turn = session.send("go");
    await expect.poll(() => faux.state.callCount).toBe(1);
    await session.send("and this");
    expect(session.stop()).toEqual({ status: "stopped", tools: ["slow"], held: ["and this"] });
    release();
    await turn;
  });

  it("rolls to a new segment after two context failures and a failed compaction (ADR-065)", async () => {
    const { faux, session, path, events } = await setup();
    faux.setResponses([fauxAssistantMessage("ok"), overflow(), overflow(), fauxAssistantMessage(""), fauxAssistantMessage("fresh")]);
    await session.send("one");
    await session.send("two");
    await session.idle(); // one failure: the compaction summarizes "one" and fails on the empty summary
    await session.send("three");
    await session.idle();
    expect((await events()).map((e) => e.type)).toContain("segment.roll");
    let context = "";
    faux.setResponses([(sent) => ((context = seen(sent)), fauxAssistantMessage("fresh"))]);
    expect(await session.send("four")).toEqual({ status: "done", text: "fresh", notice: expect.stringContaining("new segment") });
    expect(context).not.toContain("one");
    expect(context).toContain("archived");
    expect((await session.send("five")).notice).toBeUndefined(); // told once
    expect(openStore(path).load().length).toBeGreaterThan(6); // the old segment stays in the transcript
  });

  it("compacts at open when the stored context no longer fits the model (ADR-065)", async () => {
    const big = await setup();
    big.faux.setResponses([fauxAssistantMessage("x ".repeat(600)), fauxAssistantMessage("y ".repeat(600))]);
    await big.session.send("first");
    await big.session.send("second");
    const small = await setup({ path: big.path, window: 1_000, limits: { reserveTokens: 600, keepRecentTokens: 100 } });
    small.faux.setResponses([fauxAssistantMessage("SUMMARY")]);
    await small.session.idle();
    expect(await small.events()).toContainEqual(expect.objectContaining({ type: "compaction" }));
    expect(seen({ messages: small.session.messages() })).toContain("SUMMARY");
  });
});

describe("brake words (ADR-116)", () => {
  it("a stop word pauses; a second one within the window cuts the turn", async () => {
    let release = () => {};
    const slow = tool("slow", () => new Promise((resolve) => (release = () => resolve({ content: [{ type: "text", text: "ok" }], details: undefined }))));
    const { faux, session } = await setup({ tools: [slow], limits: { repeatStopMs: 60_000 } });
    faux.setResponses([callTool("slow"), fauxAssistantMessage("never")]);
    const turn = session.send("go");
    await expect.poll(() => faux.state.callCount).toBe(1);
    expect(await session.send("stop")).toEqual({ status: "paused" });
    expect(await session.send("STOP!")).toMatchObject({ status: "stopped", tools: ["slow"] });
    release();
    expect((await turn).status).toBe("stopped");
  });

  it("a stop word after the window only pauses again", async () => {
    const { session } = await setup({ limits: { repeatStopMs: 0 } });
    expect(await session.send("arrête")).toEqual({ status: "paused" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await session.send("arrête")).toEqual({ status: "paused" });
  });

  it("a sentence that only mentions stopping goes to the model", async () => {
    const { faux, session } = await setup();
    faux.setResponses([fauxAssistantMessage("Done.")]);
    expect(await session.send("stop the emails from Bob")).toEqual({ status: "done", text: "Done." });
    expect(session.paused()).toBe(false);
  });
});

describe("createWatchdog", () => {
  it("expires after the limit, and a sleep gap starts the count again (ADR-057)", () => {
    let time = 0;
    const watchdog = createWatchdog(() => time, 300, 120);
    time = 100;
    expect(watchdog.expired()).toBe(false);
    time = 200;
    watchdog.touch();
    time = 5_000; // the machine slept
    expect(watchdog.expired()).toBe(false);
    time = 5_100;
    expect(watchdog.expired()).toBe(false);
    for (time = 5_200; time <= 5_300; time += 100) expect(watchdog.expired()).toBe(false);
    time = 5_400;
    expect(watchdog.expired()).toBe(true);
  });
});

it("refuses to start on a model whose window is not above the reserve", async () => {
  await expect(setup({ window: 16_000 })).rejects.toThrow("context window");
});

it("selectCut never cuts at a tool result", () => {
  const text = (role: "user" | "assistant", size: number) => ({ role, content: "x".repeat(size * 4), timestamp: 0 }) as never;
  const result = { role: "toolResult", toolCallId: "t", toolName: "x", content: "x".repeat(40), isError: false, timestamp: 0 } as never;
  const messages = [text("user", 10), text("assistant", 10), result, text("assistant", 10), text("assistant", 10)];
  expect(selectCut(messages, 15, 0)).toBe(3); // 15 tokens reach back into index 3, a model message
  expect(selectCut(messages, 25, 0)).toBe(3); // index 2 is a tool result: the cut moves forward, never onto it
  expect(selectCut(messages, 1_000, 0)).toBeUndefined();
});
