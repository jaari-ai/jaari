// Ingress and delivery: what an inbound message means, and the only code that calls `adapter.send` (ARCHITECTURE.md,
// Channels). The plugin only moves messages; who the owner is, secrets, prompts and replies are decided here, in code.
import { randomUUID } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { createPrompts, renderPrompt, type Settled } from "./prompts.js";
import { scrubSecrets } from "./scrub.js";
import { isInboundMessage, type ChannelAdapter, type ChannelManifest, type DeliveryReceipt, type InboundMessage, type OutboundMessage, type Prompt } from "./types.js";

// The session and the store come from @jaari/core, injected so a channel never imports it (ARCHITECTURE.md).
export type MessageKey = { channel: string; conversationId: string; messageId: string };
export type SessionReply = { status: string; text?: string; held?: string[]; tools?: string[]; notice?: string; seq?: number };
export type IngressDeps = {
  session: { send(text: string, options?: { preface?: string; stored?: (seq: number) => void }): Promise<SessionReply> };
  refs: {
    put(key: MessageKey, origin: string, seq?: number): boolean; // false: this id is already known (a duplicate delivery)
    stored(key: MessageKey, seq: number): void;
    get(key: MessageKey): { origin: string; seq?: number; at?: string; message?: { role: string; content: unknown } } | undefined;
  };
  events: { write(event: { type: string } & Record<string, unknown>): void };
  isCommand(text: string): boolean; // owner commands (stop, pause, resume); the session executes them
  // The floor of ADR-104 for everything that leaves on a channel, from @jaari/core: `strip` is the reply marker
  // filter, and `leak` names the canary or the fence id when the text carries one.
  guard: { strip(text: string): string; leak(text: string): string | undefined };
  onAnswer?(answer: { promptId: string; option: string }): void | Promise<void>; // the gate, from Phase 3
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
};

const RETRY_MS = [5_000, 25_000, 125_000];
const QUOTE_CHARS = 500;
const ONLY_MARKERS = "Jaari's reply held only internal markers, so it is not shown.";
const LEAK = "Jaari blocked one of its own messages: it carried an internal marker. Something Jaari read may have tried to make it reveal its instructions. Nothing was sent.";
const GROUP = "Answers count only in your private chat with Jaari, never in a group.";

// `vouched`: the host itself made the transport owner-only (the CLI socket in the owner's data folder). A manifest's
// own id or fields never make a sender the owner: a third-party package can choose any id.
// shortcut: only a vouched device channel is the owner, check the device registry when pairing ships (roadmap 2.7)
export const isOwner = (message: InboundMessage, manifest: ChannelManifest, vouched: boolean): boolean =>
  vouched && manifest.channel.identity === "device" && message.channel === manifest.id;

type Conversation = { channel: string; conversationId: string; threadId?: string; isGroup: boolean };
// `quote`: the owner message that started this reply; code decides at send time whether to quote it (ADR-117).
type Item = { text: string; seq?: number; prompt?: Prompt; quote?: MessageKey };

const keyOf = (c: { channel: string; conversationId: string }) => JSON.stringify([c.channel, c.conversationId]);

// Cut at the last line break that fits, else the last space, else hard.
function split(text: string, max: number): string[] {
  const parts: string[] = [];
  while (text.length > max) {
    const at = [text.lastIndexOf("\n", max), text.lastIndexOf(" ", max)].find((i) => i > 0) ?? max;
    parts.push(text.slice(0, at));
    text = text.slice(at).replace(/^[\n ]/, "");
  }
  return [...parts, text];
}

const textOf = (content: unknown): string =>
  typeof content === "string" ? content
  : Array.isArray(content) ? content.flatMap((part) => (part?.type === "text" && typeof part.text === "string" ? [part.text] : [])).join("")
  : "";

// The quote comes from Jaari's own copy, never from the platform (ADR-117); JSON keeps it on one line.
// shortcut: a plain bracketed line that stays one line (capture strips it by its prefix, roadmap 1.8); context
// assembly labels it with a harness note (roadmap 1.3, ADR-120)
function prefaceOf(ref: ReturnType<IngressDeps["refs"]["get"]>): string {
  if (!ref?.message) return "[The owner replied to a message Jaari has no record of.]";
  const role = ref.message.role;
  const who = role === "assistant" ? "Jaari" : role === "user" ? "the owner" : "a tool";
  return `[The owner replied to this message from ${who}${ref.at ? ` at ${ref.at}` : ""}: ${JSON.stringify(textOf(ref.message.content).slice(0, QUOTE_CHARS))}]`;
}

const list = (items: string[]) => items.map((item, i) => `${i + 1}. ${item}`).join("\n");

// One line for how the turn ended, then the answer's text (ADR-031: a stop names what was cut and held).
function headOf(reply: SessionReply): string | undefined {
  const held = reply.held ?? [];
  switch (reply.status) {
    case "done": return undefined;
    case "held": return "Jaari is paused and kept your message. Send resume to continue.";
    case "paused": return "Paused. Nothing runs until you send resume.";
    case "resumed": return held.length > 0 ? `Resumed. These messages came while paused and did not run; send again what still matters:\n${list(held)}` : "Resumed.";
    case "stopped": {
      // The command's reply names what was cut (it has `tools`); the cut turn's own reply would only repeat "Stopped."
      if (reply.tools === undefined) return undefined;
      const tools = reply.tools;
      const cut = tools.length > 0 ? ` Cut while running: ${tools.join(", ")}.` : "";
      return `Stopped.${cut}${held.length > 0 ? ` Held, not run:\n${list(held)}` : ""}`;
    }
    case "steps": return "The turn ended: it reached the step limit.";
    case "stalled": return "The turn ended: its tool calls kept failing.";
    case "watchdog": return "The turn ended: it ran too long without progress.";
    case "refusal": return "The model refused to answer.";
    case "error": return "The model call failed.";
    default: return `The turn ended (${reply.status}).`;
  }
}

function itemsOf(reply: SessionReply): Item[] {
  if (reply.status === "steered") return []; // the message joined the running turn, whose reply answers it
  const text = [headOf(reply), reply.text].filter(Boolean).join("\n\n");
  return [...(text ? [{ text, seq: reply.seq }] : []), ...(reply.notice ? [{ text: reply.notice }] : [])];
}

const secretNotice = (kinds: string[]) =>
  `Your message contained a secret (${kinds.join(", ")}). Jaari removed it before storing or reading the message, ` +
  "but the value is still in this chat app's history. Rotate it, then save the new value with: jaari secret set <name>";

export function createIngress(deps: IngressDeps) {
  const { session, refs, events } = deps;
  const sleep = deps.sleep ?? ((ms: number, signal: AbortSignal) => wait(ms, undefined, { signal }));
  const prompts = createPrompts(deps.now);
  const channels = new Map<string, { manifest: ChannelManifest; adapter: ChannelAdapter }>();
  const latest = new Map<string, string>(); // conversation → id of the owner's latest message there
  const queues = new Map<string, Promise<void>>(); // conversation → its delivery chain, so messages keep their order
  const inflight = new Set<Promise<unknown>>();
  const abort = new AbortController();
  let active: Conversation | undefined; // where the owner's latest message came from (ADR-022)

  function track<T>(promise: Promise<T>): Promise<T> {
    inflight.add(promise);
    const done = () => void inflight.delete(promise);
    promise.then(done, done);
    return promise;
  }

  // Returns the provider's message id, or undefined when the message did not go out.
  async function attempt(adapter: ChannelAdapter, out: OutboundMessage): Promise<string | undefined> {
    const about = { channel: out.channel, idempotencyKey: out.idempotencyKey };
    for (let tries = 1; ; tries++) {
      let receipt: DeliveryReceipt;
      try {
        receipt = await adapter.send(out);
      } catch (error) {
        receipt = { status: "failed", retryable: true, error: error instanceof Error ? error.message : String(error) };
      }
      if (receipt.status === "confirmed") return receipt.providerMessageId;
      // The message may have gone out: sending it again could deliver it twice (ARCHITECTURE.md, Channels).
      // The receipt's error text comes from the plugin and may quote the message, so it stays out of the events (ADR-032).
      if (receipt.status === "ambiguous") return void events.write({ type: "delivery.ambiguous", ...about });
      const delay = receipt.retryable ? RETRY_MS[tries - 1] : undefined;
      const waited = delay !== undefined && !abort.signal.aborted && (await sleep(delay, abort.signal).then(() => true, () => false));
      if (!waited) return void events.write({ type: "delivery.failed", ...about, attempts: tries, retryable: receipt.retryable });
    }
  }

  async function send(to: Conversation, item: Item): Promise<void> {
    const { manifest, adapter } = channels.get(to.channel)!;
    const quote = item.quote;
    // Quote only when a newer owner message would make the reply ambiguous (ADR-117).
    const replyTo = quote && manifest.channel.capabilities.replies && keyOf(quote) === keyOf(to) && latest.get(keyOf(to)) !== quote.messageId
      ? quote.messageId : undefined;
    const base = item.seq !== undefined ? `turn:${item.seq}` : randomUUID();
    const origin = item.prompt ? `prompt:${item.prompt.id}` : "turn";
    // Before the split, so a marker cut in two cannot pass. The event names the marker, never the text (ADR-032).
    const stripped = deps.guard.strip(item.text);
    if (stripped !== item.text) events.write({ type: "reply.stripped", channel: to.channel });
    const marker = deps.guard.leak(stripped);
    if (marker) events.write({ type: "leak.blocked", path: "channel", channel: to.channel, marker });
    const parts = split(marker ? LEAK : stripped.trim() || stripped === item.text ? stripped : ONLY_MARKERS, manifest.channel.maxMessageChars);
    for (const [i, text] of parts.entries()) {
      const out: OutboundMessage = { channel: to.channel, conversationId: to.conversationId, idempotencyKey: `${base}:${i}`, text, threadId: to.threadId };
      if (i === 0 && replyTo) out.replyTo = replyTo;
      if (item.prompt && !marker && i === parts.length - 1) out.prompt = item.prompt;
      const id = await attempt(adapter, out);
      if (id === undefined) return; // the later parts would arrive with a gap
      refs.put({ channel: to.channel, conversationId: to.conversationId, messageId: id }, origin, i === 0 ? item.seq : undefined);
    }
  }

  function deliver(to: Conversation, items: Item[]): Promise<void> {
    const key = keyOf(to);
    const chain = (queues.get(key) ?? Promise.resolve()).then(async () => {
      for (const item of items) await send(to, item);
    });
    queues.set(key, chain.catch(() => {})); // one failed delivery must not block the conversation's later ones
    return chain;
  }

  async function answered(settled: Settled): Promise<Item[]> {
    if (settled.kind === "none") return [];
    if (settled.kind === "refused") return [{ text: settled.reason }];
    // Closed before the gate runs, so a second answer arriving meanwhile is refused, not settled twice.
    prompts.close(settled.answer.promptId);
    events.write({ type: "prompt.answered", promptId: settled.answer.promptId });
    await deps.onAnswer?.(settled.answer);
    return [{ text: "Answer recorded." }];
  }

  // The pipeline's order is the security argument: sender, duplicate, scrub, then meaning.
  async function handle(manifest: ChannelManifest, vouched: boolean, message: unknown): Promise<void> {
    const channel = manifest.id;
    // After close() nothing new starts: a turn begun during shutdown could outlive the stores.
    if (abort.signal.aborted) return void events.write({ type: "ingress.closed", channel });
    if (!isInboundMessage(message) || message.channel !== channel) return void events.write({ type: "ingress.invalid", channel });
    if (!isOwner(message, manifest, vouched)) return void events.write({ type: "ingress.unknown", channel }); // unknown senders get nothing
    const key: MessageKey = { channel, conversationId: message.conversationId, messageId: message.messageId };
    if (!refs.put(key, "turn")) return void events.write({ type: "ingress.duplicate", channel });
    const conversation = keyOf(key);
    active = { channel, conversationId: message.conversationId, threadId: message.threadId, isGroup: message.isGroup };
    latest.set(conversation, message.messageId);
    // Replies go to the conversation active when they are ready, quoting the message that started them.
    const reply = (items: Item[]) => (items.length > 0 ? deliver(active!, items.map((item, i) => (i === 0 ? { ...item, quote: key } : item))) : undefined);
    try {
      if (message.answer) return void (await reply(message.isGroup ? [{ text: GROUP }] : await answered(prompts.tap(conversation, message.answer))));
      if (!message.text?.trim()) return void events.write({ type: "ingress.unsupported", channel });
      // Before anything reads or stores the text (ADR-081).
      const { text, kinds } = scrubSecrets(message.text);
      if (kinds.length > 0) events.write({ type: "ingress.scrubbed", channel, kinds });
      const notice = kinds.length > 0 ? [{ text: secretNotice(kinds) }] : [];
      // Commands first, before any prompt answer (ADR-116, ADR-117).
      if (deps.isCommand(text)) return void (await reply([...itemsOf(await session.send(text)), ...notice]));
      let preface: string | undefined;
      let target: string | undefined;
      const ref = message.replyTo === undefined ? undefined : refs.get({ channel, conversationId: message.conversationId, messageId: message.replyTo });
      if (ref?.origin.startsWith("prompt:")) target = ref.origin.slice("prompt:".length);
      else if (message.replyTo !== undefined) preface = prefaceOf(ref);
      // A reply to a stored message is about that message, not an answer; in a group nothing settles (ADR-044).
      if (!message.isGroup && !ref?.message) {
        const settled = prompts.text(conversation, text, target);
        if (settled.kind !== "none") return void (await reply([...(await answered(settled)), ...notice]));
      }
      if (target !== undefined) preface = `[The owner replied to Jaari's question ${JSON.stringify(target)}.]`;
      const answer = await session.send(text, { ...(preface ? { preface } : {}), stored: (seq) => refs.stored(key, seq) });
      await reply([...itemsOf(answer), ...notice]);
    } catch (error) {
      events.write({ type: "ingress.failed", channel, error: error instanceof Error ? error.name : "unknown" });
      await reply([{ text: "Jaari could not handle that message. Try again, or check the event log." }]);
    }
  }

  return {
    // The host passes the result to the adapter as `ChannelContext.emit`.
    // `options.owner`: the host vouches that only the owner can reach this transport (see isOwner).
    channel(manifest: ChannelManifest, adapter: ChannelAdapter, options: { owner?: boolean } = {}): (message: unknown) => Promise<void> {
      channels.set(manifest.id, { manifest, adapter });
      return (message) => track(handle(manifest, options.owner === true, message));
    },
    // Returns false when no conversation is active yet.
    async ask(prompt: Prompt): Promise<boolean> {
      // Approvals and codes never go to a group (ADR-044).
      if (!active || active.isGroup) return false;
      const to = active;
      // Checked before the prompt opens: an answer word must never settle a prompt the owner did not see.
      const marker = deps.guard.leak(JSON.stringify(prompt));
      if (marker) {
        events.write({ type: "leak.blocked", path: "channel", channel: to.channel, marker });
        await track(deliver(to, [{ text: LEAK }]));
        return false;
      }
      prompts.open(keyOf(to), prompt);
      await track(deliver(to, [{ text: renderPrompt(prompt, channels.get(to.channel)!.manifest.channel.prompts), prompt }]));
      return true;
    },
    // A notice that code sends to the owner's active conversation, such as a blocked outbound call (ADR-104).
    // Returns false when no conversation is active yet. shortcut: no ledger or quiet hours yet (roadmap 2.3)
    async tell(text: string): Promise<boolean> {
      if (!active) return false;
      await track(deliver(active, [{ text }]));
      return true;
    },
    // Refuses new messages and stops the retry waits at once (a pending retry gives up), then waits for every
    // message in flight, so close() ends even while the owner keeps typing.
    async close(): Promise<void> {
      abort.abort();
      while (inflight.size > 0) await Promise.allSettled([...inflight]);
    },
  };
}
