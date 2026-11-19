import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createModels, fauxAssistantMessage, fauxProvider, type AssistantMessage, type Context } from "@earendil-works/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { createLlm, outcomeOf } from "./llm.js";
import { openUsageLog, USAGE_MIGRATIONS, type UsageRow } from "./usage.js";

const context: Context = { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] };
const refusal = (raw: string): AssistantMessage => ({ ...fauxAssistantMessage("", { stopReason: "error", errorMessage: "no" }), rawStopReason: raw });
const fetchFn = vi.fn() as unknown as typeof globalThis.fetch;

async function setup() {
  const faux = fauxProvider({ provider: "faux", models: [{ id: "a", input: ["text"] }, { id: "b", input: ["text"] }, { id: "eye", input: ["text", "image"] }] });
  const models = createModels();
  models.setProvider(faux.provider);
  const rows: UsageRow[] = [];
  const llm = await createLlm({
    config: {
      providers: { faux: { apiKey: "secretRef:llm.faux" } },
      tiers: { small: ["faux/a", "faux/b"], large: ["faux/eye"] },
      roles: { main: "small", classify: "small", vision: { capability: "image" } },
    },
    fetch: fetchFn,
    secrets: { resolve: async (name) => `value-of-${name}`, health: async () => ({ ok: true }) },
    usage: { record: (r) => rows.push(r), close: () => {} },
    models,
  });
  return { faux, llm, rows };
}

const ok = fauxAssistantMessage("fine");
const notAccepted = () => { throw new Error("connection refused"); }; // fails before `start`

describe("complete", () => {
  it("passes the resolved key and the egress fetch, and logs the call", async () => {
    const { faux, llm, rows } = await setup();
    let seen: { apiKey?: string; fetch?: unknown } = {};
    faux.setResponses([(_, options) => ((seen = options as typeof seen), ok)]);
    const { outcome, model } = await llm.complete("classify", context);
    expect([outcome, model.id]).toEqual(["ok", "a"]);
    expect(seen.apiKey).toBe("value-of-llm.faux");
    expect(seen.fetch).toBe(fetchFn);
    expect(rows).toEqual([expect.objectContaining({ role: "classify", provider: "faux", model: "a", outcome: "ok" })]);
  });

  it("moves to the next model when the provider never accepted the request", async () => {
    const { faux, llm, rows } = await setup();
    faux.setResponses([notAccepted, ok]);
    const { outcome, model } = await llm.complete("classify", context);
    expect([outcome, model.id]).toEqual(["ok", "b"]);
    expect(rows.map((r) => r.outcome)).toEqual(["not-accepted", "ok"]);
  });

  it("keeps the main session on its one model (ADR-019)", async () => {
    const { faux, llm } = await setup();
    faux.setResponses([notAccepted, ok]);
    expect((await llm.complete("main", context)).outcome).toBe("not-accepted");
    expect(faux.state.callCount).toBe(1);
  });

  it("stops after a failure the provider had accepted, since it may have cost tokens", async () => {
    const { faux, llm } = await setup();
    faux.setResponses([fauxAssistantMessage("partial", { stopReason: "error", errorMessage: "overloaded" }), ok]);
    expect((await llm.complete("classify", context)).outcome).toBe("failed");
    expect(faux.state.callCount).toBe(1);
  });

  it("stops and reports a refusal in a role that is not pinned (OQ-93)", async () => {
    const { faux, llm } = await setup();
    faux.setResponses([refusal("refusal"), ok]);
    expect((await llm.complete("classify", context)).outcome).toBe("refusal");
    expect(faux.state.callCount).toBe(1);
  });
});

it("stream passes the events on for the main session and logs the call", async () => {
  const { faux, llm, rows } = await setup();
  let seen: { apiKey?: string } = {};
  faux.setResponses([(_, options) => ((seen = options as typeof seen), ok)]);
  const stream = await llm.stream(llm.chain("main")[0]!, context);
  const types: string[] = [];
  for await (const event of stream) types.push(event.type);
  expect([types[0], types.at(-1)]).toEqual(["start", "done"]);
  expect((await stream.result()).content).toEqual(ok.content);
  expect(seen.apiKey).toBe("value-of-llm.faux");
  expect(rows).toEqual([expect.objectContaining({ role: "main", model: "a", outcome: "ok" })]);
});

describe("outcomeOf", () => {
  it.each(["refusal", "content_filter", "SAFETY", "PROHIBITED_CONTENT"])("reads %s as a refusal, not an error", (raw) => {
    expect(outcomeOf(refusal(raw), true)).toBe("refusal");
  });
});

describe("chain", () => {
  it("routes vision only to models that take images", async () => {
    const { llm } = await setup();
    expect(llm.chain("vision").map((m) => m.id)).toEqual(["eye"]);
  });
});

describe("providers", () => {
  it("builds a custom endpoint from config", async () => {
    const llm = await createLlm({
      config: { providers: { local: { api: "openai-completions", baseUrl: "http://localhost:11434/v1" } }, tiers: { small: ["local/llama3"] }, roles: { classify: "small" } },
      fetch: fetchFn, secrets: { resolve: async () => "", health: async () => ({ ok: true }) }, usage: { record: () => {}, close: () => {} },
    });
    expect(llm.chain("classify")).toEqual([expect.objectContaining({ id: "llama3", provider: "local", baseUrl: "http://localhost:11434/v1" })]);
  });

  it("refuses at start a model the provider does not know, even as a fallback", async () => {
    const models = createModels();
    models.setProvider(fauxProvider({ provider: "faux", models: [{ id: "a" }] }).provider);
    await expect(createLlm({
      config: { providers: { faux: { apiKey: "secretRef:llm.faux" } }, tiers: { small: ["faux/a", "faux/typo"] }, roles: { classify: "small" } },
      fetch: fetchFn, secrets: { resolve: async () => "", health: async () => ({ ok: true }) }, usage: { record: () => {}, close: () => {} }, models,
    })).rejects.toThrow('unknown model "faux/typo"');
  });

  it("loads a built-in provider and ignores its environment variable key (ADR-079)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-from-env");
    const any = createModels();
    const { anthropicProvider } = await import("@earendil-works/pi-ai/providers/anthropic");
    any.setProvider(anthropicProvider());
    const id = any.getModels("anthropic")[0]!.id;
    const llm = await createLlm({
      config: { providers: { anthropic: { apiKey: "secretRef:llm.anthropic" } }, tiers: { large: [`anthropic/${id}`] }, roles: { main: "large" } },
      fetch: fetchFn, secrets: { resolve: async () => "", health: async () => ({ ok: true }) }, usage: { record: () => {}, close: () => {} },
    });
    expect(llm.chain("main")[0]?.id).toBe(id);
    expect(await llm.models.getAuth("anthropic")).toBeUndefined();
    vi.unstubAllEnvs();
  });
});

it("the usage log writes one row per call to SQLite", async () => {
  const path = join(await mkdtemp(join(tmpdir(), "jaari-usage-")), "usage.db");
  const owner = "11111111-1111-4111-8111-111111111111";
  const opened = new DatabaseSync(path);
  for (const step of USAGE_MIGRATIONS) step(opened, owner); // in the daemon, openDatabase from @jaari/core runs these
  const log = openUsageLog(opened, owner);
  log.record({ role: "classify", provider: "faux", model: "a", input: 3, output: 5, cacheRead: 0, cacheWrite: 0, costUsd: 0.25, latencyMs: 12, outcome: "ok" });
  log.close();
  const db = new DatabaseSync(path);
  expect(db.prepare("SELECT owner_id, role, model, input, output, cost_usd, outcome FROM usage").all()).toEqual([
    { owner_id: owner, role: "classify", model: "a", input: 3, output: 5, cost_usd: 0.25, outcome: "ok" },
  ]);
  db.close();
});
