# Jaari: LLM providers and routing (ADR-011)

Owner sets policy, code routes by role, the model may only request escalation, and
outcome logs tune the routing.

## Decision layers
1. Owner policy: allowed providers, budgets, local-only roles.
2. Role routing: role → tier → first healthy model in the chain.
3. Automatic escalation (code): context > window; image input; two invalid tool calls or
   schema failures; provider error → next model in chain.
4. Model request: `llm.escalate(reason)`, children only, checked against budget and privacy.
Owner override: "use the big model for this", `/model <tier>`.

## Roles
| Role | Default tier | Notes |
|---|---|---|
| main | large | Pinned for the session; outage failover only at a turn boundary (ADR-019) |
| child | medium | Tier chosen at spawn; may request escalation |
| canonicalize | medium | Local-only if possible |
| curiosity, classify, summarize, title | small | Local preferred |
| reader | small | No tools |
| vision | by capability | Any model accepting images; follows the owner's routing, including for photos and documents (ADR-066, ADR-078) |
| stt, tts | speech | Local whisper.cpp and Piper or Kokoro by default; API optional (ADR-037) |
| approvals, spend, digests | none | Deterministic code |

## Rules
- Local-only roles never fall back to an API; they fail closed and notify once.
- `canonicalize` and `curiosity` are local-only by default only if `jaari llm eval` qualifies
  a local model at `jaari init`; otherwise `init` asks the owner to install one or allow an
  API tier, and canonicalize does not run until they choose (ADR-019).
- The main session is pinned: no routine switching. On a provider outage it may move down its
  chain at a turn boundary, to a model with the same tools, with one notice, and stays there
  until restart or until the owner reverts (ADR-019).
- Every call logs role, model, tokens, cost, latency, escalation reason, outcome to SQLite;
  `jaari llm usage` reports it.
- `jaari llm eval <model>` runs role fixtures (tool-call accuracy, JSON validity,
  canonicalize golden set, injection resistance); models qualify per tier.
- Later: learned router trained on Jaari's own outcome log; static rules stay as fallback.
- After OpenMausBot (learning/09; retry rule accepted in ADR-016, caching points decided in ADR-065): a call is retried or moved down the
  chain only when protocol state shows the provider never accepted the turn, and only to
  a model that supports the same tools; provider limit-reset times are remembered instead
  of probed; the system prompt is split into a stable and a volatile part and the tool
  list stays byte-identical across a session on models that cannot change tools mid-conversation,
  so the cached prefix survives (ADR-065).
- Small-tier classification calls are typed questions (choice, score, yes/no) with a
  timeout and a calibrated acceptance threshold; below it, a deterministic rule decides.
  Local-only roles still fail closed.

## Local models per target
Size guide, not a model list: models change monthly and a model qualifies for a tier only by
passing `jaari llm eval`, never by its size (ADR-045). Suggestions ship as data in
`models/suggested.json`; runtimes are any OpenAI-compatible local server (Ollama, llama.cpp,
LM Studio, MLX), each a separate process on loopback. Memory rule of thumb at 4-bit
quantization: about 0.6 GB per billion parameters, plus a few GB for context.

| Target (ADR-017) | Typical hardware | Local model size | Local roles | API roles |
|---|---|---|---|---|
| VPS or remote server (CPU only) | 4–8 vCPU, 8–16 GB RAM | 3–8B dense, or none | small tier at most (classify, title, summarize, reader); slow, so background only | main, child, canonicalize (unless the owner chooses local-only and accepts the speed) |
| GPU server or GPU VPS | 24–48 GB VRAM | 14–32B dense, or a ~30B mixture-of-experts (MoE) model with a few billion active | small and medium tiers if they pass; canonicalize | main; hard children |
| Home hardware, mid | Mini PC or Mac with 32 GB unified memory, or a 24 GB GPU | 14–32B dense or ~30B MoE | small tier; canonicalize if it passes | main; most children |
| Home hardware, large | 64–128 GB unified memory, or 48 GB+ GPU | 70B-class dense or a large MoE | small and medium tiers; canonicalize; many children | main (frontier models still lead on long tool-using sessions) |
| Laptop | 16–32 GB | 3–8B, up to ~14B | small tier while awake | everything else |
| Local-only preset | 64 GB+ recommended | Largest that passes the main-role fixtures | every role | none; expect a weaker main session |

Rules:
- `jaari init` detects memory and GPU, proposes the row, runs `jaari llm eval` on the
  suggested models, and writes only the ones that pass into the tier chains. A model under
  8 tokens per second (configurable) qualifies for background roles only.
- A role is local-only only if a local model qualified for it (ADR-019); otherwise `init` asks.
- Tool-calling accuracy and JSON validity decide the small tier; the canonicalize golden set
  decides the medium tier; the main role needs long multi-turn tool use, which is why it
  defaults to the API.

## Presets (`jaari init`)
| Preset | Main | Background |
|---|---|---|
| local-only | local | local |
| hybrid (default) | API | local, API fallback where privacy allows |
| api-only | API large | API small |

Config: see `jaari.config.example.jsonc`, section `llm`.
