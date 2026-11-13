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
- Pass the shared contract suite (ADR-084) from your own tests, with a fake of your transport:
  ~~~ts
  import { channelContract } from "@jaari/channels/contract";
  import { adapter } from "./index.js";
  import { fakeTransport } from "./fake-transport.js";
  channelContract({ adapter, transport: fakeTransport });
  ~~~
  It checks the manifest, start and stop (including abort), idempotent `send`, `ambiguous`
  pass-through, a fresh cursor that replays nothing, refused undeclared secrets, and forbidden
  imports.

## Registering
A local path, as in the last entry below, is for development only and makes `jaari doctor`
warn (ADR-071).
~~~jsonc
// jaari.config.jsonc
{ "channels": ["@jaari/channel-web", "@jaari/channel-telegram", "./plugins/example"] }
~~~
