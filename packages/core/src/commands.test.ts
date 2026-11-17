import { describe, expect, it } from "vitest";
import { commandOf } from "./commands.js";

describe("commandOf (ADR-116)", () => {
  it.each([
    ["Stop now!", "stop"],
    ["stop  now.", "stop"],
    ["stop everything", "pause"],
    ["Pause", "pause"],
    ["stop", "brake"],
    ["STOP, please", "brake"],
    ["stop stop stop", "brake"],
    ["arrête tout", "brake"],
    ["停止", "brake"],
    ["Stopp, bitte", "brake"],
    ["enough!", "brake"],
    ["wait", "pause"],
    ["wait a sec", "pause"],
    ["hold on", "pause"],
    ["attends", "pause"],
    ["подожди", "pause"],
    ["resume", "resume"],
    ["retomar", "resume"],
  ])("%s → %s", (text, command) => expect(commandOf(text)).toBe(command));

  it.each(["stop the emails", "don't stop", "wait for the reply, then send it", "hold the second one", "please", "continue", "", "!!!"])(
    "%s → nothing: it goes to the model",
    (text) => expect(commandOf(text)).toBeUndefined(),
  );
});
