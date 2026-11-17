// The persistent main session (ADR-065): one Pi Agent over a stored transcript and one serial queue,
// with pause, emergency stop, and the runaway limits of ADR-031 enforced in code.
// Words: Pi calls one model response with its tool calls a "turn"; here that is a step, and a turn is
// the whole answer to one owner message.
import { Agent, type AgentMessage, type AgentTool } from "@earendil-works/pi-agent-core";
import { isContextOverflow, type AssistantMessage } from "@earendil-works/pi-ai";
import { outcomeOf, type createLlm } from "@jaari/llm";
import { commandOf } from "./commands.js";
import type { EventLog } from "./events.js";
import type { Store } from "./store.js";

// Defaults of ADR-031 and ADR-065; the owner's config may replace each one.
export const LIMITS = {
  stepsPerTurn: 25,
  stallSteps: 2, // steps in a row whose tool calls all failed
  sameErrors: 3, // identical tool errors in one turn
  watchdogMs: 300_000,
  watchdogTickMs: 5_000,
  sleepGapMs: 120_000, // a longer gap between two ticks is sleep, not a stall (ADR-057)
  reserveTokens: 16_384,
  keepRecentTokens: 20_000,
  repeatStopMs: 10_000, // a second stop word within this time cuts the turn (ADR-116)
};
export type Limits = typeof LIMITS;

export type Status =
  | "done" | "refusal" | "error" // how the model's answer ended
  | "steps" | "stalled" | "watchdog" | "stopped" // a limit or the owner cut the turn
  | "steered" | "held" | "paused" | "resumed"; // no turn of its own
// `tools`: the tools that were running when "stop now" cut the turn (ADR-031: the owner is told what was cut).
// `notice`: a one-time message for the owner, such as a new segment (ADR-065).
// `seq`: the transcript row of the answer, so a channel's message id can point at it (ADR-117).
export type Reply = { status: Status; text?: string; held?: string[]; tools?: string[]; notice?: string; seq?: number };
// `preface`: context that code puts before the owner's words for the model, such as the message they replied to.
// Owner commands are read from the text alone. `stored`: called with the message's transcript row once it is stored.
export type SendOptions = { preface?: string; stored?: (seq: number) => void };

export type SessionDeps = {
  store: Store;
  events: EventLog;
  llm: Pick<Awaited<ReturnType<typeof createLlm>>, "chain" | "stream" | "complete">;
  systemPrompt: string;
  tools?: AgentTool[];
  limits?: Partial<Limits>;
  now?: () => number; // wall clock, so that sleep shows as a gap
};

type Compaction = { summary: string; firstKept: number; at: number };


const SUMMARY_PROMPT =
  "Summarize the conversation below for the assistant that will continue it. Keep what the owner asked for, " +
  "decisions, facts, names, numbers, open tasks, and what was promised. If it starts with an earlier summary, " +
  "fold that in. Write plain text.";

const textOf = (message: AgentMessage | undefined): string =>
  typeof message?.content === "string"
    ? message.content
    : (message?.content ?? []).flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");

const userMessage = (text: string): AgentMessage => ({ role: "user", content: [{ type: "text", text }], timestamp: Date.now() });

// shortcut: 4 characters per token; use the provider's count when context assembly ships (1.3).
const estimate = (message: AgentMessage) => Math.ceil(JSON.stringify(message.content).length / 4);

// Fires after `limit` ms without activity. A gap between two checks longer than `sleepGap` means the
// machine slept, so the count starts again (ADR-031, ADR-057).
export function createWatchdog(now: () => number, limit: number, sleepGap: number) {
  let active = now();
  let checked = active;
  return {
    touch: () => void (active = now()),
    expired() {
      const time = now();
      if (time - checked > sleepGap) active = time;
      checked = time;
      return time - active > limit;
    },
  };
}

// The index of the first message a summary keeps: the most recent `keep` tokens stay, and the cut
// lands on an owner or a model message, never on a tool result, so a tool call keeps its result. Design from Pi,
// refs/pi/packages/durable/src/harness/compaction.ts at 469d865.
export function selectCut(messages: AgentMessage[], keep: number, start: number): number | undefined {
  let kept = 0;
  for (let index = messages.length - 1; index > start; index--) {
    kept += estimate(messages[index]!);
    if (kept < keep) continue;
    // Pi adds steered messages after a step's tool results, so an owner message never splits a call from its result.
    const cuts = messages.flatMap((message, at) => (at > start && message.role !== "toolResult" ? [at] : []));
    return cuts.find((at) => at >= index) ?? cuts.at(-1);
  }
  return undefined;
}

export function createSession(deps: SessionDeps) {
  const { store, events, llm } = deps;
  const limits = { ...LIMITS, ...deps.limits };
  const now = deps.now ?? Date.now;
  const model = llm.chain("main")[0];
  if (!model) throw new Error('role "main" has no model');
  if (model.contextWindow <= limits.reserveTokens) throw new Error(`model "${model.id}" has a context window of ${model.contextWindow} tokens, not above the ${limits.reserveTokens} reserved`);
  if (!llm.chain("summarize")[0]) throw new Error('role "summarize" has no model; compaction needs it (ADR-065)');

  // The session reopens over its transcript; a fresh one never starts silently (ADR-065).
  const seqOf = new WeakMap<AgentMessage, number>();
  const storedOf = new WeakMap<AgentMessage, (seq: number) => void>();
  const summaryMessage = (summary: string) => userMessage(`Summary of the earlier conversation:\n${summary}`);
  const compaction = store.get<Compaction>("compaction");
  const messages = store.load(compaction?.firstKept).map(({ seq, message }) => (seqOf.set(message, seq), message));
  if (compaction) messages.unshift(summaryMessage(compaction.summary));

  let steps = 0;
  let failing = 0;
  const errors = new Map<string, number>();
  let ended: Status | undefined; // set when a limit or the owner cuts the running turn
  let lastBrake = -Infinity; // when the last stop word arrived, for the repeat rule
  let overflows = 0; // turns in a row that failed because the context was too long (ADR-065)
  const running = new Map<string, string>(); // tool call id → tool name, for the stop reply
  const watchdog = createWatchdog(now, limits.watchdogMs, limits.sleepGapMs);
  const limit = (kind: Status) => ((ended ??= kind), events.write({ type: "limit", limit: kind, steps }));

  const agent = new Agent({
    initialState: { systemPrompt: deps.systemPrompt, model, tools: deps.tools ?? [], messages },
    streamFn: llm.stream,
    steeringMode: "all",
    identity: { userAgent: { custom: "jaari" }, attribution: null }, // Jaari's identity, not Pi's (ADR-065)
    // Runs after every step: the step limit and the stall guard (ADR-031).
    finishTurn: ({ toolResults }) => {
      steps++;
      const failed = toolResults.filter((result) => result.isError);
      if (toolResults.length > 0) failing = failed.length === toolResults.length ? failing + 1 : 0;
      for (const result of failed) {
        const key = `${result.toolName}: ${textOf(result)}`;
        errors.set(key, (errors.get(key) ?? 0) + 1);
      }
      if (failing >= limits.stallSteps || Math.max(0, ...errors.values()) >= limits.sameErrors) limit("stalled");
      // At the limit the turn ends unless it would end anyway; a steered message then runs as the next turn.
      else if (steps >= limits.stepsPerTurn && (toolResults.length > 0 || agent.hasQueuedMessages())) limit("steps");
      return ended ? { action: "end" } : undefined;
    },
  });

  agent.subscribe((event) => {
    watchdog.touch();
    // System messages are rebuilt from the prompt and the tool list at start, so they are not stored.
    if (event.type === "message_end" && event.message.role !== "system") {
      const seq = store.append(event.message);
      seqOf.set(event.message, seq);
      storedOf.get(event.message)?.(seq);
    }
    if (event.type === "tool_execution_start") running.set(event.toolCallId, event.toolName);
    if (event.type === "tool_execution_end") {
      running.delete(event.toolCallId);
      events.write({ type: "tool", name: event.toolName, isError: event.isError, ms: event.durationMs });
    }
  });

  const paused = () => store.get<boolean>("paused") === true;
  const hold = (texts: string[]): Reply => {
    store.set("held", [...(store.get<string[]>("held") ?? []), ...texts]);
    return { status: "held" };
  };

  // One serial queue: turns and compactions never overlap (ADR-065).
  let tail: Promise<unknown> = Promise.resolve();
  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const next = tail.then(job);
    tail = next.catch(() => {});
    return next;
  }

  function contextTokens(all: AgentMessage[]): number {
    // A count the provider reported before the last compaction describes the old, longer context.
    const since = store.get<Compaction>("compaction")?.at ?? -1;
    const last = all.findLastIndex((m) => m.role === "assistant" && m.usage.totalTokens > 0 && (seqOf.get(m) ?? 0) > since);
    return (last < 0 ? 0 : (all[last] as AssistantMessage).usage.totalTokens) + all.slice(last + 1).reduce((sum, m) => sum + estimate(m), 0);
  }

  // Runs only after a turn has settled (ADR-065). The transcript keeps every message; only the
  // model's context shrinks.
  let compacting: AbortController | undefined; // pause and stop abort a compaction in flight (ADR-031)
  // Returns true when it replaced older messages with a summary.
  async function compact(): Promise<boolean> {
    const all = agent.state.messages;
    const start = all[0]?.role === "system" ? 1 : 0;
    const budget = model!.contextWindow - limits.reserveTokens;
    // After a context failure the provider has spoken, whatever the estimate says.
    if (overflows === 0 && contextTokens(all) <= budget) return false;
    // On a small context window the kept part may take at most half of the budget.
    const cut = selectCut(all, Math.min(limits.keepRecentTokens, Math.floor(budget / 2)), start);
    if (cut === undefined) return (events.write({ type: "compaction.skipped", reason: "no cut point" }), false);
    compacting = new AbortController();
    try {
      const older = all.slice(start, cut).map((m) => `${m.role}: ${textOf(m) || JSON.stringify(m.content)}`).join("\n\n");
      // shortcut: one call; a transcript longer than the summarize model's window fails and is logged.
      const request = { systemPrompt: SUMMARY_PROMPT, messages: [{ role: "user" as const, content: older, timestamp: now() }] };
      const { message, outcome } = await llm.complete("summarize", request, compacting.signal);
      if (outcome !== "ok") throw new Error(outcome);
      if (paused()) throw new Error("paused");
      if (!textOf(message).trim()) throw new Error("empty summary"); // it would drop the older turns with nothing in their place
      const kept = all.slice(cut).filter((m) => m.role !== "system");
      store.set("compaction", { summary: textOf(message), firstKept: seqOf.get(all[cut]!)!, at: seqOf.get(kept.at(-1)!)! } satisfies Compaction);
      agent.state.messages = [...all.slice(0, start), summaryMessage(textOf(message)), ...kept];
      events.write({ type: "compaction", summarized: cut - start, kept: kept.length });
      return true;
    } catch (error) {
      events.write({ type: "compaction.failed", reason: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      compacting = undefined;
    }
  }

  // After two context failures in a row and a failed compaction, the context starts again from here.
  // The transcript keeps the old segment (ADR-065).
  function roll(): string {
    const last = store.load(store.get<Compaction>("compaction")?.firstKept).at(-1)?.seq ?? 0;
    const summary = "The earlier conversation was archived because it no longer fit; it is kept and searchable.";
    store.set("compaction", { summary, firstKept: last + 1, at: last } satisfies Compaction);
    agent.state.messages = [...agent.state.messages.filter((m) => m.role === "system").slice(0, 1), summaryMessage(summary)];
    overflows = 0;
    events.write({ type: "segment.roll" });
    return "The conversation got too long to summarize, so I started a new segment. The earlier part is archived.";
  }

  // Compaction is its own job in the queue, so the reply does not wait for the summary call (ADR-065).
  let notice: string | undefined; // given with the next reply, once
  const settle = () =>
    void enqueue(async () => {
      if (paused()) return; // nothing calls a model while paused (ADR-031)
      if (!(await compact()) && overflows >= 2 && !paused()) notice = roll();
    });

  async function run(input: AgentMessage[]): Promise<Reply> {
    steps = failing = 0;
    errors.clear();
    ended = undefined;
    watchdog.touch();
    events.write({ type: "turn.start" });
    const timer = setInterval(() => {
      if (ended || !watchdog.expired()) return;
      limit("watchdog");
      agent.abort();
    }, limits.watchdogTickMs);
    try {
      await agent.prompt(input);
    } finally {
      clearInterval(timer);
    }
    const last = agent.state.messages.findLast((m) => m.role === "assistant");
    const outcome = last ? outcomeOf(last, true) : "failed";
    const status: Status = ended ?? (outcome === "ok" ? "done" : outcome === "refusal" ? "refusal" : outcome === "aborted" ? "stopped" : "error");
    events.write({ type: "turn.end", status, steps });
    overflows = status === "error" && last?.role === "assistant" && isContextOverflow(last, model!.contextWindow) ? overflows + 1 : 0;
    // A message steered into a turn that was cut never reached the model: it is held, or run next.
    const left = agent.peekQueuedMessages();
    agent.clearAllQueues();
    if (left.length > 0) return paused() ? hold(left.map(textOf)) : run(left);
    settle();
    const seq = last && seqOf.get(last);
    const reply: Reply = { status, text: textOf(last), ...(notice ? { notice } : {}), ...(seq ? { seq } : {}) };
    notice = undefined;
    return reply;
  }

  function pause(): Reply {
    store.set("paused", true);
    compacting?.abort();
    events.write({ type: "pause" });
    return { status: "paused" };
  }

  // Pause, and abort the running turn (ADR-031). Its `send` settles as "stopped".
  function stop(): Reply {
    store.set("paused", true);
    compacting?.abort();
    // Messages steered into the stopped turn wait for the owner's decision, even if "resume" comes first.
    const steered = agent.peekQueuedMessages();
    agent.clearAllQueues();
    if (steered.length > 0) hold(steered.map(textOf));
    const cut = agent.state.isStreaming;
    const tools = [...running.values()];
    if (cut) {
      ended ??= "stopped";
      agent.abort();
    }
    events.write({ type: "stop", cut, tools: tools.length, held: steered.length });
    return { status: "stopped", tools, held: steered.map(textOf) };
  }

  // Held messages are returned, not run: the owner decides whether they still matter (ADR-031).
  function resume(): Reply {
    const held = store.get<string[]>("held") ?? [];
    store.set("paused", false);
    store.set("held", []);
    events.write({ type: "resume", held: held.length });
    return { status: "resumed", held };
  }

  async function send(text: string, options: SendOptions = {}): Promise<Reply> {
    // Handled by code at once, never queued behind the model (ADR-031, ADR-065, ADR-116).
    const command = commandOf(text);
    if (command === "brake") {
      const repeated = now() - lastBrake <= limits.repeatStopMs;
      lastBrake = now();
      return repeated ? stop() : pause();
    }
    if (command) return { pause, stop, resume }[command]();
    if (paused()) return hold([text]);
    const message = userMessage(options.preface ? `${options.preface}\n${text}` : text);
    if (options.stored) storedOf.set(message, options.stored);
    // During a turn the message joins it at the next step boundary (Pi steering).
    if (agent.state.isStreaming) return (agent.steer(message), { status: "steered" });
    return enqueue(async () => (paused() ? hold([text]) : run([message])));
  }

  // A context stored under a larger model may not fit the one configured now (ADR-065).
  settle();
  return { send, pause, stop, resume, paused, idle: () => tail.then(() => {}), messages: () => agent.state.messages };
}
