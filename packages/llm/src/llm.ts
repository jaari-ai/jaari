// Role routing on pi-ai (ADR-011): each role maps to a tier, a tier is a fallback chain of models.
import {
  createModels,
  createProvider,
  type Api,
  type AssistantMessage,
  type Context,
  type Model,
  type MutableModels,
  type Provider,
} from "@earendil-works/pi-ai";
import { resolveRef, type VaultProvider } from "@jaari/secrets";
import { checkLlmConfig, ROLES, roleRefs, splitRef, type LlmConfig, type Role } from "./config.js";
import type { Outcome, UsageLog } from "./usage.js";

// ADR-085: the provider's raw stop reasons that mean a refusal, never a provider error.
const REFUSALS = new Set(["refusal", "content_filter", "SAFETY", "PROHIBITED_CONTENT"]);

// `started`: the stream emitted `start`, so the provider accepted the request (ADR-016 point 4).
export function outcomeOf(message: AssistantMessage, started: boolean): Outcome {
  if (message.rawStopReason !== undefined && REFUSALS.has(message.rawStopReason)) return "refusal";
  if (message.stopReason === "aborted") return "aborted";
  if (message.stopReason !== "error") return "ok";
  return started ? "failed" : "not-accepted";
}

export type LlmDeps = {
  config: unknown;
  fetch: typeof globalThis.fetch; // from @jaari/http (ADR-080)
  secrets: VaultProvider;
  usage: UsageLog;
  models?: MutableModels; // tests pass one that already holds pi-ai's faux provider
};

export type Completion = { message: AssistantMessage; outcome: Outcome; model: Model<Api> };

// Keys come only from secretRef: no environment variables, no ambient credential files (ADR-018, ADR-079).
const NO_AMBIENT_AUTH = { env: async () => undefined, fileExists: async () => false };

// pi-ai modules are loaded by name; the name comes from owner config, so it is checked first.
async function loadNamed(path: string, suffix: string): Promise<unknown> {
  const mod = (await import(path)) as Record<string, unknown>;
  const found = Object.values(mod).find((v) => typeof v === "function" && v.name.endsWith(suffix));
  if (!found) throw new Error(`${path} exports no *${suffix}`);
  return (found as () => unknown)();
}

// shortcut: custom endpoints get fixed limits (32k context, 4k output, text only); read them from the
// server or config when `jaari llm eval` qualifies local models (roadmap 1.9).
function customModel(provider: string, id: string, api: string, baseUrl: string): Model<Api> {
  return {
    id, name: id, api, provider, baseUrl, reasoning: false, input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 32_768, maxTokens: 4_096,
  } as Model<Api>;
}

export async function createLlm(deps: LlmDeps) {
  const config: LlmConfig = checkLlmConfig(deps.config);
  const models = deps.models ?? createModels({ authContext: NO_AMBIENT_AUTH });
  const allRefs = [...Object.values(config.tiers).flat(), ...Object.values(config.roles).filter((v) => typeof v === "string")];

  for (const [id, p] of Object.entries(config.providers)) {
    if (models.getProvider(id)) continue;
    if (p.api && p.baseUrl) {
      const ids = [...new Set(allRefs.filter((r) => splitRef(r)[0] === id).map((r) => splitRef(r)[1]))];
      models.setProvider(createProvider({
        id, name: id, baseUrl: p.baseUrl,
        // Keyless local servers resolve with no key; a configured key is passed per request instead.
        auth: { apiKey: { name: id, resolve: async () => ({ auth: {} }) } },
        models: ids.map((m) => customModel(id, m, p.api!, p.baseUrl!)),
        api: (await loadNamed(`@earendil-works/pi-ai/api/${p.api}.lazy`, "Api")) as Parameters<typeof createProvider>[0]["api"],
      }));
    } else {
      models.setProvider((await loadNamed(`@earendil-works/pi-ai/providers/${id}`, "Provider")) as Provider);
    }
  }

  const modelFor = (ref: string): Model<Api> => {
    const [provider, id] = splitRef(ref);
    const model = models.getModel(provider, id);
    if (!model) throw new Error(`unknown model "${ref}"`);
    return model;
  };

  // The models a role may use, in order. `vision` keeps only models that take images.
  function chain(role: Role): Model<Api>[] {
    const list = roleRefs(config, role).map(modelFor);
    return typeof config.roles[role] === "string" ? list : list.filter((m) => m.input.includes("image"));
  }

  async function complete(role: Role, context: Context, signal?: AbortSignal): Promise<Completion> {
    // The main session is pinned to one model (ADR-019); its outage failover belongs to the session.
    const candidates = role === "main" ? chain(role).slice(0, 1) : chain(role);
    if (candidates.length === 0) throw new Error(`role "${role}" has no model`);
    let last: Completion | undefined;
    for (const model of candidates) {
      const keyRef = config.providers[model.provider]?.apiKey;
      // Resolved just before the call and never kept (ADR-007).
      const apiKey = keyRef ? await resolveRef(keyRef, deps.secrets) : undefined;
      const begun = performance.now();
      const stream = models.stream(model, context, { fetch: deps.fetch, signal, ...(apiKey ? { apiKey } : {}) });
      let started = false;
      for await (const event of stream) if (event.type === "start") started = true;
      const message = await stream.result();
      const outcome = outcomeOf(message, started);
      const { usage } = message;
      deps.usage.record({
        role, provider: model.provider, model: model.id, input: usage.input, output: usage.output,
        cacheRead: usage.cacheRead, cacheWrite: usage.cacheWrite, costUsd: usage.cost.total,
        latencyMs: Math.round(message.durationMs ?? performance.now() - begun), outcome,
      });
      last = { message, outcome, model };
      // Only a request the provider never accepted moves on (ADR-016). A refusal stops and is reported
      // until refusal categories are mapped (OQ-93); an accepted failure may have cost tokens, so it stops too.
      if (outcome !== "not-accepted") return last;
    }
    return last!;
  }

  // A model name the provider does not know fails at start, not at the role's first call (ADR-011).
  ROLES.forEach(chain);
  return { chain, complete, models };
}
