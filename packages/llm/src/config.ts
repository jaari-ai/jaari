// The `llm` section of the owner config (ADR-011, ADR-019, ADR-093), checked with TypeBox at start.
// The config loader itself is roadmap 0.6; this checks the object it is handed.
import { isIP } from "node:net";
import { classify } from "@jaari/http";
import { Type, type Static } from "typebox";
import { Compile } from "typebox/compile";

const SECRET_REF = Type.String({ pattern: "^secretRef:" });
const ID = Type.String({ pattern: "^[a-z0-9][a-z0-9-]*$" });

// A tier name, a direct "provider/model" (the speech roles), or a capability (vision). Each role is
// optional: an owner may skip speech.
const RoleValue = Type.Optional(Type.Union([
  Type.String({ minLength: 1 }),
  Type.Object({ capability: Type.Literal("image") }, { additionalProperties: false }),
]));
// ADR-011 roles, plus the speech roles of ADR-037.
const RolesSchema = Type.Object(
  {
    main: RoleValue, child: RoleValue, canonicalize: RoleValue, curiosity: RoleValue, classify: RoleValue,
    summarize: RoleValue, title: RoleValue, reader: RoleValue, vision: RoleValue, stt: RoleValue, tts: RoleValue,
  },
  { additionalProperties: false },
);
export type Role = keyof Static<typeof RolesSchema>;
export const ROLES = Object.keys(RolesSchema.properties) as Role[];

const ProviderSchema = Type.Object(
  {
    // A built-in pi-ai provider has neither; a custom endpoint (Ollama, LM Studio) has both.
    api: Type.Optional(ID),
    baseUrl: Type.Optional(Type.String({ pattern: "^https?://" })),
    apiKey: Type.Optional(SECRET_REF),
  },
  { additionalProperties: false },
);

export const LlmConfigSchema = Type.Object(
  {
    providers: Type.Record(ID, ProviderSchema),
    tiers: Type.Record(ID, Type.Array(Type.String({ pattern: "^[a-z0-9][a-z0-9-]*/.+" }), { minItems: 1 })),
    roles: RolesSchema,
    privacy: Type.Optional(Type.Object({ localOnly: Type.Optional(Type.Array(Type.KeyOf(RolesSchema))) }, { additionalProperties: false })),
    // Read when they ship: the budget in Phase 1 (ADR-046, ADR-087), escalation with children in Phase 4.
    budget: Type.Optional(Type.Unknown()),
    escalation: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);

export type LlmConfig = Static<typeof LlmConfigSchema>;
export type ProviderConfig = Static<typeof ProviderSchema>;

const check = Compile(LlmConfigSchema);

// "openrouter/anthropic/claude" names provider "openrouter" and model "anthropic/claude".
export const splitRef = (ref: string): [provider: string, model: string] => {
  const at = ref.indexOf("/");
  return [ref.slice(0, at), ref.slice(at + 1)];
};

// A custom endpoint on this machine, the private network, or a Compose service (a name with no dot).
// Built-in providers are cloud APIs, never local.
export function isLocal(provider: ProviderConfig): boolean {
  if (!provider.baseUrl) return false;
  const host = new URL(provider.baseUrl).hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost") return true;
  if (isIP(host)) return ["loopback", "this-machine", "private"].includes(classify(host));
  return !host.includes(".");
}

// The tier or direct reference a role uses; a capability role draws from every tier.
export function roleRefs(config: LlmConfig, role: Role): string[] {
  const value = config.roles[role];
  if (value === undefined) return [];
  if (typeof value !== "string") return [...new Set(Object.values(config.tiers).flat())];
  return config.tiers[value] ?? [value];
}

export function checkLlmConfig(value: unknown): LlmConfig {
  if (!check.Check(value)) {
    throw new Error(`invalid llm config: ${check.Errors(value).map((e) => `${e.instancePath || "/"}: ${e.message}`).join("; ")}`);
  }
  const config = value as LlmConfig;
  const problems: string[] = [];
  for (const [id, p] of Object.entries(config.providers)) {
    if ((p.api === undefined) !== (p.baseUrl === undefined)) problems.push(`provider "${id}": api and baseUrl go together`);
    // Keys come only from secretRef, never from pi-ai's environment fallback (ADR-018, ADR-079).
    if (p.api === undefined && p.apiKey === undefined) problems.push(`provider "${id}": a built-in provider needs apiKey`);
  }
  for (const [tier, refs] of Object.entries(config.tiers)) {
    for (const ref of refs) if (!config.providers[splitRef(ref)[0]]) problems.push(`tier "${tier}": unknown provider in "${ref}"`);
  }
  for (const [role, value] of Object.entries(config.roles)) {
    if (typeof value === "string" && !config.tiers[value] && !(value.includes("/") && config.providers[splitRef(value)[0]])) {
      problems.push(`role "${role}": "${value}" is neither a tier nor a provider/model`);
    }
  }
  // A local-only role fails closed: it can never reach a model that is not local (ADR-011, ADR-019).
  for (const role of config.privacy?.localOnly ?? []) {
    const remote = roleRefs(config, role).filter((ref) => !isLocal(config.providers[splitRef(ref)[0]] ?? {}));
    if (remote.length > 0) problems.push(`role "${role}" is local-only but reaches ${remote.join(", ")}`);
  }
  if (problems.length > 0) throw new Error(`invalid llm config: ${problems.join("; ")}`);
  return config;
}
