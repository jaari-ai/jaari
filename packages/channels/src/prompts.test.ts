import { describe, expect, it } from "vitest";
import { createPrompts, renderPrompt } from "./prompts.js";
import type { Prompt } from "./types.js";

const NOW = Date.parse("2026-11-17T12:00:00Z");
const approval = (id: string, code: string, expiresAt = "2026-11-17T13:00:00Z"): Prompt =>
  ({ kind: "approval", id, code, summary: `send mail ${id}`, options: ["once", "always", "deny"], expiresAt });
const choice: Prompt = { kind: "choice", id: "c", question: "Which?", options: [{ id: "red", label: "Red" }, { id: "blue", label: "Blue" }] };
const answer = (promptId: string, option: string) => ({ kind: "answer", answer: { promptId, option } });

function setup(...prompts: Prompt[]) {
  const registry = createPrompts(() => NOW);
  for (const prompt of prompts) registry.open("conv", prompt);
  return registry;
}

describe("renderPrompt (ADR-035)", () => {
  it("writes the reply grammar for a text channel only", () => {
    expect(renderPrompt(approval("a", "4821"), "text")).toBe(
      'Approval 4821: send mail a\nExpires 2026-11-17T13:00:00Z.\nReply "once 4821", "always 4821" or "no 4821".');
    expect(renderPrompt(approval("a", "4821"), "buttons")).not.toContain("Reply");
    expect(renderPrompt(choice, "text")).toBe("Which?\n1. Red\n2. Blue\nReply to this message with a number.");
    expect(renderPrompt({ kind: "link", id: "l", label: "Open the panel", url: "https://example.test/p" }, "text")).toBe("Open the panel: https://example.test/p");
  });
});

describe("createPrompts (ADR-035, ADR-117)", () => {
  it("settles the single open approval with a bare word; yes means once", () => {
    expect(setup(approval("a", "4821")).text("conv", "Yes!")).toEqual(answer("a", "once"));
    expect(setup(approval("a", "4821")).text("conv", "no")).toEqual(answer("a", "deny"));
  });

  it("refuses a bare word with several open, naming the codes; the code picks the prompt", () => {
    const prompts = setup(approval("a", "4821"), approval("b", "1234"));
    expect(prompts.text("conv", "yes")).toEqual({ kind: "refused", reason: "Several questions are open: add the code (4821, 1234) or reply to the one you mean." });
    expect(prompts.text("conv", "always 1234")).toEqual(answer("b", "always"));
    expect(prompts.text("conv", "once 9999")).toMatchObject({ kind: "refused" });
  });

  it("settles the replied-to prompt without its code", () => {
    expect(setup(approval("a", "4821"), approval("b", "1234")).text("conv", "yes", "b")).toEqual(answer("b", "once"));
  });

  it("treats anything but a whole answer as a message", () => {
    const prompts = setup(approval("a", "4821"));
    expect(prompts.text("conv", "yes, but cc Sam", "a")).toEqual({ kind: "none" });
    expect(prompts.text("conv", "once 4821 please")).toEqual({ kind: "none" });
    expect(prompts.text("conv", "hello")).toEqual({ kind: "none" });
    expect(setup().text("conv", "yes")).toEqual({ kind: "none" });
  });

  it("refuses expired, answered, other-conversation and not-offered answers", () => {
    const prompts = setup(approval("old", "1111", "2026-11-17T11:00:00Z"), { ...approval("a", "4821"), options: ["once", "deny"] } as Prompt);
    expect(prompts.text("conv", "once 1111")).toEqual({ kind: "refused", reason: "Approval 1111 has expired; nothing was done." });
    expect(prompts.text("conv", "always", "a")).toEqual({ kind: "refused", reason: 'Approval 4821 does not offer "always".' });
    prompts.close("a");
    expect(prompts.tap("conv", { promptId: "a", option: "once" })).toEqual({ kind: "refused", reason: "Approval 4821 is already answered." });
    expect(prompts.tap("elsewhere", { promptId: "a", option: "once" })).toEqual({ kind: "refused", reason: "That question is no longer open." });
  });

  it("accepts a tap only with one of the prompt's options", () => {
    const prompts = setup(approval("a", "4821"));
    expect(prompts.tap("conv", { promptId: "a", option: "yes" })).toMatchObject({ kind: "refused" });
    expect(prompts.tap("conv", { promptId: "a", option: "always" })).toEqual(answer("a", "always"));
  });

  it("answers choice, confirm and input prompts; never a link", () => {
    expect(setup(choice).text("conv", "2")).toEqual(answer("c", "blue"));
    expect(setup(choice).text("conv", "RED", "c")).toEqual(answer("c", "red"));
    expect(setup({ kind: "confirm", id: "f", question: "Sure?" }).text("conv", "no")).toEqual(answer("f", "no"));
    expect(setup({ kind: "input", id: "i", question: "Name?" }).text("conv", " Sam Lee ", "i")).toEqual(answer("i", "Sam Lee"));
    expect(setup({ kind: "input", id: "i", question: "Name?" }).text("conv", "Sam")).toEqual({ kind: "none" });
    expect(setup({ kind: "link", id: "l", label: "x", url: "https://example.test" }).text("conv", "yes", "l")).toEqual({ kind: "none" });
  });

  it("never reads a word from the object prototype", () => {
    expect(setup(approval("a", "4821")).text("conv", "constructor 4821")).toEqual({ kind: "none" });
  });
});
