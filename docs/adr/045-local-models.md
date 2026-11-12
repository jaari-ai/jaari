# ADR-045: Local models: a suggested-models data file, per-machine qualification, any OpenAI-compatible local runtime

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**No model names in docs or code.** Suggestions live in a data file, `models/suggested.json`,
shipped with each release. Each entry gives the model and quantization, file SHA-256 where a file
is downloaded, licence (information only), the targets and tiers it is offered for, the project's
measured eval results, and a minimum Jaari version. There is no licence filter: every suggested
model can be offered and chosen.

**Refresh.** The list updates with releases; `jaari llm models update` can pull a newer list from
the release channel through `@jaari/http`, checked against the release signature. Tier chains do
not change until the owner re-runs eval and accepts.

**Qualification is per machine.** `jaari init` and `jaari llm eval` run the fixtures (tool calls,
JSON validity, canonicalize golden set, injection resistance) on the owner's hardware and measure
pass rate, tokens per second, and time to first token. Only passing models are written into the
tier chains; the project's scores are a hint, never a qualification (ADR-019). A model that passes
but runs under 8 tokens per second (configurable) qualifies for background roles only.

**Runtimes: all OpenAI-compatible local servers.** Ollama, llama.cpp `llama-server`, LM Studio,
and MLX are each a `local` provider with a base URL; several can be configured at once.
- `jaari init` detects running runtimes (default ports 11434, 8080, 1234, and MLX) and offers
  them. With none installed it offers Ollama (easier; manages downloads) or llama.cpp (smaller, no
  daemon, owner-chosen GGUF files), defaulting to Ollama.
- Model download: through Ollama's API for Ollama; for llama.cpp, a GGUF file or Hugging Face
  repository fetched through `@jaari/http` and checked against the SHA-256 in `suggested.json`.
- Small-tier typed questions use Pi's `llama-cpp-classify` on llama.cpp, otherwise the chat
  endpoint with a constrained JSON schema.
- The runtime is a separate process reached over loopback, never a library in the daemon.

**Re-check.** When a model or a fixture changes, `jaari doctor` suggests re-running eval for
local-only roles; a model that no longer passes is flagged and its role fails closed.

**First candidates to measure in Phase 1** (as of mid-2026; the fixtures decide): the Qwen3
family (dense and 30B-A3B MoE), gpt-oss-20b, Mistral Small, Gemma 3, and Llama models.

Borrowed: `llama-cpp-classify` and the provider model from Pi `ai` (learning/10).

## Alternatives rejected
A hard-coded model list (stale within months); qualifying by size or by published benchmarks
(only the owner's fixtures on the owner's hardware count); a permissive-licence filter (the owner
chooses); a single supported runtime; embedding a runtime in the daemon (a crash or malicious
model file would run inside it).

## Consequences
_TODO: fill in as implementation reveals them._
