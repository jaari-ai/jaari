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
    expect(await session.send("Stop now")).toEqual({ status: "stopped" });
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
    await session.send("second question");
    expect(await events()).toContainEqual(expect.objectContaining({ type: "compaction" }));
    const context = seen({ messages: session.messages() });
    expect(context).toContain("SUMMARY-1");
    expect(context).not.toContain("first question");
    expect(context).toContain("second question");
    expect(openStore(path).load().length).toBe(4);

    const reopened = (await setup({ path, limits, window: 1_000 })).session;
    expect(seen({ messages: reopened.messages() })).toBe(context);
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

it("selectCut never cuts inside a tool call and its result", () => {
  const text = (role: "user" | "assistant", size: number) => ({ role, content: "x".repeat(size * 4), timestamp: 0 }) as never;
  const messages = [text("user", 10), text("assistant", 10), text("user", 10), text("assistant", 10), text("assistant", 10)];
  expect(selectCut(messages, 15, 0)).toBe(2); // 15 tokens reach back into index 3; the cut moves to the owner message
  expect(selectCut(messages, 1_000, 0)).toBeUndefined();
});
