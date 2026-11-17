# Writing a channel plugin

A channel plugin is an npm package that exports a `ChannelAdapter` (full contract, host rules, and identity binding in
[../ARCHITECTURE.md](../ARCHITECTURE.md#channels)). It is a capability package (ADR-071): it declares a `jaari`
manifest with `kind: channel`, is installed and pinned like any package, and, when third-party, runs in its own
process with only its declared egress and secrets. The manifest is the `jaari` key of your `package.json`, with the
channel's own fields in a `channel` section (ADR-084).

## Minimal skeleton

~~~jsonc
// package.json
{
  "name": "jaari-channel-example",
  "version": "0.1.0",
  "jaari": {
    "id": "example", "version": "0.1.0", "kind": "channel",
    "interfaceVersion": 1, "minJaari": "0.1.0", "hosts": ["daemon"],
    "egress": ["api.example.com"], "secrets": ["example.token"],
    "channel": {
      "capabilities": { "text": true, "groups": false },
      "identity": "account",
      "prompts": "text",           // or "buttons" / "quickReplies" if the transport has them
      "maxMessageChars": 4000
    }
  }
}
~~~

~~~ts
import type { ChannelAdapter, ChannelContext, OutboundMessage } from "@jaari/channels";

export const adapter: ChannelAdapter = {
  async start(ctx: ChannelContext) {   // ctx.manifest is your checked manifest
    const token = await ctx.secrets.get("example.token");
    // connect; on each message: ctx.emit({ channel: "example", ... })
  },
  async stop() {},
  async send(msg: OutboundMessage) {
    // must be idempotent on msg.idempotencyKey
    return { status: "confirmed", providerMessageId: "..." };
  },
  async cursor() { return "opaque-position"; },
  async health() { return { ok: true }; },
};
~~~

## Rules
- Never import `@jaari/memory`, `@jaari/gate`, `@jaari/llm`, `@jaari/persona`, or any tool package.
- Report the raw `senderHandle`; do not decide who the owner is.
- Make `send()` idempotent on `idempotencyKey`; the outbox retries. Return `ambiguous`
  when you can't tell whether a message went out.
- Don't format approvals or questions yourself. With `prompts: "text"` the host has already
  written the reply instructions into `msg.text`; with `buttons` or `quickReplies`, render
  `msg.prompt.options` natively and report a tap as `answer: { promptId, option }` (ADR-035).
- Use only `ctx.secrets.get` for credentials, and never log them.
- Hand each message to `ctx.emit` without waiting for it before you read the next one: ingress
  may settle only after a whole turn, and the next message can be "stop" (ADR-116).
- Pass `replyTo` (the platform's id of the replied-to message) and `threadId` when the transport
  has them; never pass the quoted text. Declare `capabilities.replies` if you can send a
  quote-reply (ADR-117).
- Pass the shared contract suite (ADR-084) from your own tests, with a fake of your transport:
  ~~~ts
  import { fileURLToPath } from "node:url";
  import { channelContract } from "@jaari/channels/contract";
  import pkg from "../package.json" with { type: "json" };
  import { createAdapter } from "./index.js";
  import { createFakeTransport } from "./fake-transport.js";

  channelContract({
    manifest: pkg.jaari,
    sources: fileURLToPath(new URL(".", import.meta.url)),   // scanned for forbidden imports
    create() {
      const transport = createFakeTransport();
      return {
        adapter: createAdapter(transport),
        receive: (text) => transport.incoming(text),   // the owner writes; before start, a message already waiting
        sent: async () => transport.outgoing(),        // texts the transport was asked to carry
        ambiguous: () => transport.dropNextAnswer(),   // optional: the next send cannot tell if it went out
      };
    },
  });
  ~~~
  It checks the manifest, start and stop (including abort), idempotent `send`, `ambiguous`
  pass-through, a fresh cursor that replays nothing, refused undeclared secrets, and forbidden
  imports. The built-in CLI channel (`packages/channels/src/cli/adapter.test.ts`) is a full example.

## Registering
A local path, as in the last entry below, is for development only and makes `jaari doctor`
warn (ADR-071).
~~~jsonc
// jaari.config.jsonc
{ "channels": ["@jaari/channel-web", "@jaari/channel-telegram", "./plugins/example"] }
~~~
