import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { channelContract } from "./contract.js";
import { createMemoryChannel, MEMORY_MANIFEST } from "./testing/memory.js";
import { isInboundMessage } from "./types.js";

channelContract({
  manifest: MEMORY_MANIFEST,
  sources: fileURLToPath(new URL("./testing", import.meta.url)),
  create() {
    const channel = createMemoryChannel();
    return { adapter: channel.adapter, receive: async (text) => void (await channel.receive(text)), sent: async () => channel.sent.map((m) => m.text ?? ""), ambiguous: channel.ambiguous };
  },
});

it("refuses an inbound message with a field the contract does not have (ADR-117: no quoted text)", () => {
  const message = { channel: "x", conversationId: "c", messageId: "1", senderHandle: "h", isGroup: false, text: "hi", sentAt: "2026-11-17T10:00:00.000Z", receivedAt: "2026-11-17T10:00:00.000Z" };
  expect(isInboundMessage(message)).toBe(true);
  expect(isInboundMessage({ ...message, replyTo: "41" })).toBe(true);
  expect(isInboundMessage({ ...message, quotedText: "Approve the payment?" })).toBe(false);
  expect(isInboundMessage({ ...message, messageId: "" })).toBe(false);
  expect(isInboundMessage({ ...message, sentAt: "yesterday" })).toBe(false);
});
