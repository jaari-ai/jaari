// The channel contract (ARCHITECTURE.md, Channels; ADR-035, ADR-084, ADR-117). A plugin only moves messages:
// it reports what arrived and sends what it is given. Who the owner is, prompts, and replies are the host's job.
import type { Manifest } from "@jaari/capabilities";
import { Type, type Static } from "typebox";
import { Compile } from "typebox/compile";

// The package manifest of a channel: the shared part plus its `channel` section (ADR-084).
export type ChannelManifest = Manifest & { channel: NonNullable<Manifest["channel"]> };

const closed = { additionalProperties: false } as const;
const id = Type.String({ minLength: 1, maxLength: 512 });

const AttachmentSchema = Type.Object(
  {
    kind: Type.Enum(["image", "audio", "video", "file"]),
    mimeType: Type.String({ minLength: 1, maxLength: 255 }),
    name: Type.Optional(Type.String({ maxLength: 255 })),
    bytes: Type.Integer({ minimum: 0 }),
    ref: id, // host-side storage handle, never inline data
  },
  closed,
);
export type Attachment = Static<typeof AttachmentSchema>;

// What a plugin hands to ingress. Checked at ingress, because a third-party plugin runs in its own process (ADR-071).
// There is no field for quoted text: a reply is only a pointer, and the host reads the quote from its own record (ADR-117).
export const InboundMessageSchema = Type.Object(
  {
    channel: id,
    conversationId: id,
    messageId: id, // unique inside the conversation
    senderHandle: id, // raw transport identity (phone, user id, email); the host decides who it is
    isGroup: Type.Boolean(),
    participants: Type.Optional(Type.Array(id)),
    text: Type.Optional(Type.String({ maxLength: 100_000 })),
    attachments: Type.Optional(Type.Array(AttachmentSchema)),
    answer: Type.Optional(Type.Object({ promptId: id, option: id }, closed)), // a tap on a rendered Prompt
    replyTo: Type.Optional(id), // id of the replied-to message, unique inside the conversation
    threadId: Type.Optional(id), // forum topic or thread to deliver into; not a session
    sentAt: Type.String({ format: "date-time" }),
    receivedAt: Type.String({ format: "date-time" }),
  },
  closed,
);
export type InboundMessage = Static<typeof InboundMessageSchema>;

const inbound = Compile(InboundMessageSchema);
export const isInboundMessage = (value: unknown): value is InboundMessage => inbound.Check(value);

// What Jaari asks, independent of the channel (ADR-035). The host renders it for the manifest's `prompts`
// level; for "text" it writes the reply grammar into the message.
export type Prompt =
  | { kind: "approval"; id: string; code: string; summary: string; options: ("once" | "always" | "deny")[]; detailsUrl?: string; expiresAt: string }
  | { kind: "choice"; id: string; question: string; options: { id: string; label: string }[] }
  | { kind: "confirm"; id: string; question: string }
  | { kind: "input"; id: string; question: string }
  | { kind: "link"; id: string; label: string; url: string }; // panel, takeover, pairing

export type OutboundMessage = {
  channel: string;
  conversationId: string;
  text?: string;
  attachments?: Attachment[];
  idempotencyKey: string; // the adapter must dedupe on it
  replyTo?: string; // set by code, never by the model; dropped without the `replies` capability (ADR-117)
  threadId?: string;
  prompt?: Prompt; // rendered by the host for this channel, never by the plugin
};

export type DeliveryReceipt =
  | { status: "confirmed"; providerMessageId: string }
  | { status: "failed"; retryable: boolean; error: string }
  | { status: "ambiguous"; error: string }; // never retried blindly

export type ChannelHealth = { ok: boolean; detail?: string };

export type ChannelContext = {
  manifest: ChannelManifest; // checked by the host before the plugin loads
  emit(message: InboundMessage): Promise<void>; // hand a message to ingress; may settle only after the turn, so do not wait on it before reading the next message
  secrets: { get(name: string): Promise<string> }; // only the names in the manifest's `secrets`
  log: { info(message: string): void; warn(message: string): void; error(message: string): void };
  signal: AbortSignal; // aborted on stop()
};

export type ChannelAdapter = {
  start(context: ChannelContext): Promise<void>;
  stop(): Promise<void>;
  send(message: OutboundMessage): Promise<DeliveryReceipt>;
  cursor(): Promise<string>; // opaque position for replay protection
  health(): Promise<ChannelHealth>;
};
