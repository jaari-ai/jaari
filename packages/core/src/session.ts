// The persistent main session (ADR-065): one Pi Agent over a stored transcript and one serial queue,
// with pause, emergency stop, and the runaway limits of ADR-031 enforced in code.
// Words: Pi calls one model response with its tool calls a "turn"; here that is a step, and a turn is
// the whole answer to one owner message.
import { Agent, type AgentMessage, type AgentTool } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { outcomeOf, type createLlm } from "@jaari/llm";
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
};
export type Limits = typeof LIMITS;

export type Status =
  | "done" | "refusal" | "error" // how the model's answer ended
  | "steps" | "stalled" | "watchdog" | "stopped" // a limit or the owner cut the turn
  | "steered" | "held" | "paused" | "resumed"; // no turn of its own
export type Reply = { status: Status; text?: string; held?: string[] };

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

// Handled by code at once, never queued behind the model (ADR-031, ADR-065).
const COMMANDS: Record<string, "pause" | "stop" | "resume"> = {
  pause: "pause", "stop everything": "pause", "stop now": "stop", resume: "resume",
};

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
// lands only on an owner message, so a tool call is never split from its result. Design from Pi,
// refs/pi/packages/durable/src/harness/compaction.ts at 469d865.
export function selectCut(messages: AgentMessage[], keep: number, start: number): number | undefined {
  let kept = 0;
  for (let index = messages.length - 1; index > start; index--) {
    kept += estimate(messages[index]!);
    if (kept < keep) continue;
    const owner = messages.flatMap((message, at) => (at > start && message.role === "user" ? [at] : []));
    return owner.find((at) => at >= index) ?? owner.at(-1);
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
  const summaryMessage = (summary: string) => userMessage(`Summary of the earlier conversation:\n${summary}`);
  const compaction = store.get<Compaction>("compaction");
  const messages = store.load(compaction?.firstKept).map(({ seq, message }) => (seqOf.set(message, seq), message));
  if (compaction) messages.unshift(summaryMessage(compaction.summary));

  let steps = 0;
  let failing = 0;
  const errors = new Map<string, number>();
  let ended: Status | undefined; // set when a limit or the owner cuts the running turn
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
      else if (steps >= limits.stepsPerTurn && toolResults.length > 0) limit("steps");
      return ended ? { action: "end" } : undefined;
    },
  });

  agent.subscribe((event) => {
    watchdog.touch();
    // System messages are rebuilt from the prompt and the tool list at start, so they are not stored.
    if (event.type === "message_end" && event.message.role !== "system") seqOf.set(event.message, store.append(event.message));
    if (event.type === "tool_execution_end") events.write({ type: "tool", name: event.toolName, isError: event.isError, ms: event.durationMs });
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
  async function compact(): Promise<void> {
    const all = agent.state.messages;
    const start = all[0]?.role === "system" ? 1 : 0;
    const budget = model!.contextWindow - limits.reserveTokens;
    if (contextTokens(all) <= budget) return;
    // On a small context window the kept part may take at most half of the budget.
    const cut = selectCut(all, Math.min(limits.keepRecentTokens, Math.floor(budget / 2)), start);
    if (cut === undefined) return;
    try {
      const older = all.slice(start, cut).map((m) => `${m.role}: ${textOf(m) || JSON.stringify(m.content)}`).join("\n\n");
      // shortcut: one call; a transcript longer than the summarize model's window fails and is logged.
      const { message, outcome } = await llm.complete("summarize", { systemPrompt: SUMMARY_PROMPT, messages: [{ role: "user", content: older, timestamp: now() }] });
      if (outcome !== "ok") throw new Error(outcome);
      const kept = all.slice(cut).filter((m) => m.role !== "system");
      store.set("compaction", { summary: textOf(message), firstKept: seqOf.get(all[cut]!)!, at: seqOf.get(kept.at(-1)!)! } satisfies Compaction);
      agent.state.messages = [...all.slice(0, start), summaryMessage(textOf(message)), ...kept];
      events.write({ type: "compaction", summarized: cut - start, kept: kept.length });
    } catch (error) {
      events.write({ type: "compaction.failed", reason: error instanceof Error ? error.message : String(error) });
    }
  }

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
    // A message steered into a turn that was cut never reached the model: it is held, or run next.
    const left = agent.peekQueuedMessages();
    agent.clearAllQueues();
    if (!paused()) await compact(); // nothing calls a model while paused (ADR-031)
    if (left.length === 0) return { status, text: textOf(last) };
    return paused() ? hold(left.map(textOf)) : run(left);
  }

  function pause(): Reply {
    store.set("paused", true);
    events.write({ type: "pause" });
    return { status: "paused" };
  }

  // Pause, and abort the running turn (ADR-031). Its `send` settles as "stopped".
  function stop(): Reply {
    store.set("paused", true);
    const cut = agent.state.isStreaming;
    if (cut) {
      ended ??= "stopped";
      agent.abort();
    }
    events.write({ type: "stop", cut });
    return { status: "stopped" };
  }

  // Held messages are returned, not run: the owner decides whether they still matter (ADR-031).
  function resume(): Reply {
    const held = store.get<string[]>("held") ?? [];
    store.set("paused", false);
    store.set("held", []);
    events.write({ type: "resume", held: held.length });
    return { status: "resumed", held };
  }

  async function send(text: string): Promise<Reply> {
    const command = COMMANDS[text.trim().toLowerCase()];
    if (command) return { pause, stop, resume }[command]();
    if (paused()) return hold([text]);
    // During a turn the message joins it at the next step boundary (Pi steering).
    if (agent.state.isStreaming) return (agent.steer(userMessage(text)), { status: "steered" });
    return enqueue(async () => (paused() ? hold([text]) : run([userMessage(text)])));
  }

  return { send, pause, stop, resume, paused, idle: () => tail.then(() => {}), messages: () => agent.state.messages };
}
