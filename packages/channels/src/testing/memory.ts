// An in-memory channel for tests: the smallest adapter that passes the contract suite. It has no transport,
// so `receive` hands a message straight to the adapter, and `sent` lists what the adapter was asked to carry.
import type { ChannelAdapter, ChannelContext, DeliveryReceipt, InboundMessage, OutboundMessage } from "../types.js";

export const MEMORY_MANIFEST = {
  id: "memory", version: "0.0.0", kind: "channel", interfaceVersion: 1, minJaari: "0.0.0", hosts: ["daemon"],
  channel: { capabilities: { text: true, replies: true }, identity: "device", prompts: "text", maxMessageChars: 4000 },
} as const;

export function createMemoryChannel() {
  let context: ChannelContext | undefined;
  let count = 0;
  let unknown = false;
  const receipts = new Map<string, DeliveryReceipt>();
  const sent: OutboundMessage[] = [];
  const adapter: ChannelAdapter = {
    async start(started) {
      context = started;
      started.signal.addEventListener("abort", () => (context = undefined));
    },
    stop: async () => void (context = undefined),
    async send(message) {
      const known = receipts.get(message.idempotencyKey);
      if (known) return known;
      if (unknown) return ((unknown = false), { status: "ambiguous", error: "the transport did not answer" });
      sent.push(message);
      const receipt: DeliveryReceipt = { status: "confirmed", providerMessageId: `out-${++count}` };
      receipts.set(message.idempotencyKey, receipt);
      return receipt;
    },
    cursor: async () => String(count),
    health: async () => ({ ok: true }),
  };
  return {
    adapter,
    sent,
    ambiguous: () => void (unknown = true),
    // Returns the message id, so a test can reply to it.
    async receive(text: string, extra: Partial<InboundMessage> = {}): Promise<string> {
      const at = new Date().toISOString();
      const messageId = extra.messageId ?? `in-${++count}`;
      await context?.emit({ channel: MEMORY_MANIFEST.id, conversationId: "local", messageId, senderHandle: "owner", isGroup: false, text, sentAt: at, receivedAt: at, ...extra });
      return messageId;
    },
  };
}
