// Typed prompts (ADR-035, ADR-117): render a prompt for a channel's level, and read answers with a fixed grammar.
// Deterministic code: no model ever decides what the owner approved (ADR-006).
import type { Prompt } from "./types.js";

export type Answer = { promptId: string; option: string };
export type Settled =
  | { kind: "answer"; answer: Answer } // settle this prompt with this option
  | { kind: "refused"; reason: string } // one line for the owner
  | { kind: "none" }; // not an answer: the message goes to the main session

// The approval words and the option each one means; "yes" approves once.
// A Map, not an object literal, so "constructor" or "toString" is never a word.
const APPROVAL = new Map([["once", "once"], ["yes", "once"], ["always", "always"], ["no", "deny"], ["deny", "deny"]]);
const WORD = { once: "once", always: "always", deny: "no" } as const;

export function renderPrompt(prompt: Prompt, level: "buttons" | "quickReplies" | "text"): string {
  const text = level === "text";
  switch (prompt.kind) {
    case "approval": {
      const lines = [`Approval ${prompt.code}: ${prompt.summary}`];
      if (prompt.detailsUrl) lines.push(`Details: ${prompt.detailsUrl}`);
      lines.push(`Expires ${prompt.expiresAt}.`);
      const replies = prompt.options.map((option) => `"${WORD[option]} ${prompt.code}"`);
      if (text) lines.push(`Reply ${replies.length > 1 ? `${replies.slice(0, -1).join(", ")} or ${replies.at(-1)}` : replies[0]}.`);
      return lines.join("\n");
    }
    case "choice": {
      const lines = [prompt.question, ...prompt.options.map((option, i) => `${i + 1}. ${option.label}`)];
      if (text) lines.push("Reply to this message with a number.");
      return lines.join("\n");
    }
    case "confirm":
      return text ? `${prompt.question}\nReply "yes" or "no".` : prompt.question;
    case "input":
      return text ? `${prompt.question}\nReply to this message with your answer.` : prompt.question;
    case "link":
      return `${prompt.label}: ${prompt.url}`;
  }
}

// The option a word means for this prompt, or undefined when the word is not in its grammar.
function optionOf(prompt: Prompt, word: string): string | undefined {
  if (prompt.kind === "approval") return APPROVAL.get(word);
  if (prompt.kind === "confirm") return word === "yes" || word === "no" ? word : undefined;
  if (prompt.kind !== "choice") return undefined;
  const n = /^\d+$/.test(word) ? Number(word) : 0;
  return prompt.options[n - 1]?.id ?? prompt.options.find((option) => option.id.toLowerCase() === word)?.id;
}

const offers = (prompt: Prompt, option: string): boolean =>
  prompt.kind === "approval" ? (prompt.options as string[]).includes(option)
  : prompt.kind === "confirm" ? option === "yes" || option === "no"
  : prompt.kind === "choice" ? prompt.options.some((o) => o.id === option)
  : prompt.kind === "input";

const nameOf = (prompt: Prompt) => (prompt.kind === "approval" ? `Approval ${prompt.code}` : "That question");
const refused = (reason: string): Settled => ({ kind: "refused", reason });
const NOT_OPEN = refused("That question is no longer open.");

type Entry = { conversation: string; prompt: Prompt; done?: string }; // `done`: why it no longer takes answers

export function createPrompts(now: () => number = Date.now) {
  // shortcut: open prompts are lost on restart (an approval then needs asking again), persist them with the gate in Phase 3
  const entries = new Map<string, Entry>();

  function settle(entry: Entry, option: string): Settled {
    if (entry.done) return refused(entry.done);
    const { prompt } = entry;
    if (prompt.kind === "approval" && Date.parse(prompt.expiresAt) <= now()) {
      entry.done = `${nameOf(prompt)} has expired; nothing was done.`;
      return refused(entry.done);
    }
    if (!offers(prompt, option)) return refused(`${nameOf(prompt)} does not offer "${option}".`);
    return { kind: "answer", answer: { promptId: prompt.id, option } };
  }

  const inConversation = (conversation: string) => [...entries.values()].filter((e) => e.conversation === conversation);

  return {
    open: (conversation: string, prompt: Prompt) => void entries.set(prompt.id, { conversation, prompt }),
    close(promptId: string) {
      const entry = entries.get(promptId);
      if (entry) entry.done ??= `${nameOf(entry.prompt)} is already answered.`;
    },
    // A tap: only the literal option ids count.
    tap(conversation: string, answer: Answer): Settled {
      const entry = entries.get(answer.promptId);
      return entry?.conversation === conversation ? settle(entry, answer.option) : NOT_OPEN;
    },
    // The whole message must be an answer: any other word makes it a message for the session ("yes, but cc Sam").
    text(conversation: string, text: string, target?: string): Settled {
      const entry = target === undefined ? undefined : entries.get(target);
      if (entry?.conversation === conversation && entry.prompt.kind === "input") return settle(entry, text.trim());
      const words = text.normalize("NFC").toLowerCase().replace(/[.!]+$/, "").trim().split(/\s+/);
      const [word = "", code, ...rest] = words;
      if (rest.length > 0) return { kind: "none" };
      // With a code, the code picks the approval, whatever the message replies to.
      if (code !== undefined) {
        const option = APPROVAL.get(word);
        if (option === undefined) return { kind: "none" };
        const coded = inConversation(conversation).filter((e) => e.prompt.kind === "approval" && e.prompt.code.toLowerCase() === code);
        const found = coded.find((e) => !e.done) ?? coded[0];
        return found ? settle(found, option) : refused(`No approval has the code ${code}.`);
      }
      if (target !== undefined) {
        if (entry?.conversation !== conversation) return APPROVAL.has(word) ? NOT_OPEN : { kind: "none" };
        const option = optionOf(entry.prompt, word);
        return option === undefined ? { kind: "none" } : settle(entry, option);
      }
      // A bare answer counts only when exactly one prompt is open in the conversation (ADR-035).
      const open = inConversation(conversation).filter((e) => !e.done && e.prompt.kind !== "link" && e.prompt.kind !== "input");
      const only = open.length === 1 ? open[0]! : undefined;
      if (only) {
        const option = optionOf(only.prompt, word);
        return option === undefined ? { kind: "none" } : settle(only, option);
      }
      if (open.length === 0 || !open.some((e) => optionOf(e.prompt, word) !== undefined)) return { kind: "none" };
      const codes = open.flatMap((e) => (e.prompt.kind === "approval" ? [e.prompt.code] : []));
      return refused(`Several questions are open: ${codes.length > 0 ? `add the code (${codes.join(", ")}) or ` : ""}reply to the one you mean.`);
    },
  };
}
