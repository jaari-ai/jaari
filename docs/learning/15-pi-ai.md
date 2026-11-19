# 15: pi-ai as the model layer

Written 2026-11-16, while building roadmap 0.7 (`@jaari/llm`). Source: pi-ai's README, types, and
adapters, read to make the calls in ADR-114.

| Ref | Pinned commit |
|---|---|
| `refs/pi` | `469d8651b59069d7bd907c7da84597865e114da6` (pi-ai 1.5.0) |

The installed pi-ai is 1.5.2; `refs/pi` is still at 1.5.0. Checked again in 1.5.2 (2026-11-19, after Dependabot PR #43): the refusal mapping and
`rawStopReason` are unchanged. New in 1.5.1, Anthropic message threads apply only to a call that
carries a `sessionId` (`cacheSessionId` in `dist/api/anthropic-messages.js`); Jaari passes none, so its
requests still send the whole conversation.

## 1. What pi-ai does
- A `Models` collection holds providers; each provider owns its catalog, its auth, and its wire
  protocol (`refs/pi/packages/ai/README.md`, Providers and Models). `createProvider()` builds one for
  a custom endpoint such as Ollama; built-in providers have one factory module each.
- Auth resolves per provider: an explicit per-request `apiKey` wins, then stored credentials, then
  environment variables and ambient files through an `AuthContext`
  (`refs/pi/packages/ai/src/auth/context.ts`).
- A failed request never throws: the stream ends with an `error` event and a final message with
  `stopReason: "error"`. A setup failure emits `error` without `start` (README, Error Handling).
- Anthropic's `refusal` stop reason becomes `stopReason: "error"`, with the provider's explanation as
  `errorMessage` and `rawStopReason` kept; the refusal category is dropped
  (`refs/pi/packages/ai/src/api/anthropic-messages.ts`, `mapStopReason`).
- `fauxProvider()` scripts responses for tests; a response factory receives each call's options.

## 2. Why
One message shape across providers lets an agent loop switch models without caring about wire
formats. Never throwing keeps a long-running loop alive. The ambient auth fallback is convenient
for a developer tool.

## 3. What Jaari did, and where it differs
- Jaari turns the ambient fallback off: keys come only from `secretRef` (ADR-018, ADR-079, ADR-114).
- The `start` event is the line between "never accepted" and "accepted" for retries (ADR-016).
- Without the refusal category, Jaari stops on every refusal until OQ-93 is decided.
- The usage log is Jaari's own SQLite table, not pi-telemetry metrics, which stay off by default
  (ADR-032).
