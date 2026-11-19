// The daemon–node contract (ADR-015, ADR-110): JSON data messages, checked on receipt. Phase 0 runs them
// in-process; Phase 6 sends the same messages over the node link (ADR-058).
import { Type, type Static } from "typebox";
import { Compile } from "typebox/compile";
import { CAPABILITY_NAMES } from "./vocabulary.js";

const closed = { additionalProperties: false } as const;

// The action the gate approves (SECURITY_MODEL.md). `amount` joins with spend checks; `pay` is reserved (ADR-040).
export const ActionSchema = Type.Object(
  {
    capability: Type.Enum(CAPABILITY_NAMES),
    target: Type.String({ minLength: 1 }),
    params: Type.Record(Type.String(), Type.Unknown()),
    expiresAt: Type.String({ format: "date-time" }),
  },
  closed,
);

// Sent by the daemon to a host. `packageId` picks the executor when two packages provide a name (ADR-018).
// `secrets` holds values the daemon resolved for this one action (ADR-007, ADR-015).
export const DispatchRequestSchema = Type.Object(
  {
    actionId: Type.String({ minLength: 1 }),
    packageId: Type.String({ minLength: 1 }),
    action: ActionSchema,
    secrets: Type.Record(Type.String(), Type.String()),
  },
  closed,
);

// `outcome-unknown`: the effect may have happened, so it is never sent again (ADR-016, ADR-058).
export const ResultSchema = Type.Union([
  Type.Object({ status: Type.Literal("ok"), output: Type.Optional(Type.Unknown()) }, closed),
  Type.Object({ status: Type.Literal("failed"), error: Type.String() }, closed),
  Type.Object({ status: Type.Literal("outcome-unknown"), detail: Type.String() }, closed),
]);

// What a host offers; a node sends it again on every reconnect (ADR-058).
export const AdvertisementSchema = Type.Object(
  {
    hostId: Type.String({ minLength: 1 }),
    host: Type.Enum(["daemon", "node"]),
    packages: Type.Array(
      Type.Object(
        {
          id: Type.String({ minLength: 1 }),
          version: Type.String({ minLength: 1 }),
          provides: Type.Array(Type.Enum(CAPABILITY_NAMES)),
          provider: Type.Optional(Type.String()),
        },
        closed,
      ),
    ),
  },
  closed,
);

export type Action = Static<typeof ActionSchema>;
export type DispatchRequest = Static<typeof DispatchRequestSchema>;
export type Result = Static<typeof ResultSchema>;
export type Advertisement = Static<typeof AdvertisementSchema>;

// A host: the in-process one now, a node over the link in Phase 6. Callers never assume it is local.
export type CapabilityHost = {
  advertise(): Advertisement;
  dispatch(request: DispatchRequest, signal?: AbortSignal): Promise<Result>;
};

// What a `capability` package exports as `executor`.
export type Executor = {
  execute(request: { action: Action; secrets: Record<string, string>; signal: AbortSignal }): Promise<Result>;
};

const validators = {
  request: Compile(DispatchRequestSchema),
  result: Compile(ResultSchema),
  advertisement: Compile(AdvertisementSchema),
};

type Messages = { request: DispatchRequest; result: Result; advertisement: Advertisement };

// Every message crosses the boundary as JSON, the way the node link will carry it, then is checked.
// Returns the copy, or the schema errors.

export function receive<K extends keyof Messages>(
  kind: K,
  value: unknown,
): { ok: true; value: Messages[K] } | { ok: false; errors: string[] } {
  let copy: unknown;
  try {
    copy = JSON.parse(JSON.stringify(value) ?? "null");
  } catch (e) {
    return { ok: false, errors: [`not JSON: ${(e as Error).message}`] };
  }
  const v = validators[kind];
  return v.Check(copy) ? { ok: true, value: copy as Messages[K] } : { ok: false, errors: v.Errors(copy).map((e) => `${e.instancePath || "/"}: ${e.message}`) };
}
