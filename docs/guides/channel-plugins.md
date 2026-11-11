# Writing a channel plugin

A channel plugin is an npm package that exports a `ChannelAdapter` (full contract, host rules, and identity binding in
[../ARCHITECTURE.md](../ARCHITECTURE.md#channels)).

## Minimal skeleton

~~~ts
import type { ChannelAdapter, ChannelContext, OutboundMessage } from "@jaari/channels";

export const adapter: ChannelAdapter = {
  manifest: {
    id: "example",
    version: "0.1.0",
    capabilities: { text: true, groups: false },
    identity: "account",
    prompts: "text",              // or "buttons" / "quickReplies" if the transport has them
    maxMessageChars: 4000,
  },
  async start(ctx: ChannelContext) {
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
- Pass the shared contract tests: `pnpm test --filter @jaari/channels -- --adapter ./dist`.

## Registering
~~~jsonc
// jaari.config.jsonc
{ "channels": ["@jaari/channel-web", "@jaari/channel-telegram", "./plugins/example"] }
~~~
