// The CLI socket protocol (ADR-021, ADR-076): NDJSON, one JSON object per line, a hello first to agree a version.
import { Type, type Static } from "typebox";
import { Compile } from "typebox/compile";

export const PROTOCOL_VERSION = 1;
export const MAX_LINE_BYTES = 1024 * 1024;

const closed = { additionalProperties: false } as const;
const id = Type.String({ minLength: 1, maxLength: 512 });

const HelloSchema = Type.Object({ hello: Type.Object({ versions: Type.Array(Type.Integer(), { maxItems: 16 }) }, closed) }, closed);
export type Hello = Static<typeof HelloSchema>;

export const ClientLineSchema = Type.Union([
  Type.Object({ type: Type.Literal("message"), id, text: Type.String({ minLength: 1, maxLength: 100_000 }), replyTo: Type.Optional(id) }, closed),
  Type.Object({ type: Type.Literal("answer"), promptId: id, option: id }, closed),
]);
export type ClientLine = Static<typeof ClientLineSchema>;

// What the server writes after the hello. `prompt` is the host's Prompt, already rendered into `text`.
export type ServerLine = { type: "message"; id: string; text: string; replyTo?: string; prompt?: unknown } | { error: string };

const hello = Compile(HelloSchema);
const clientLine = Compile(ClientLineSchema);
export const isHello = (value: unknown): value is Hello => hello.Check(value);
export const isClientLine = (value: unknown): value is ClientLine => clientLine.Check(value);

export const encode = (line: object): string => `${JSON.stringify(line)}\n`;

// Splits a byte stream into lines; throws on a line over `max` bytes, so one peer cannot fill the memory.
export async function* ndjson(stream: AsyncIterable<Buffer>, max = MAX_LINE_BYTES): AsyncGenerator<string> {
  let pending = Buffer.alloc(0);
  for await (const chunk of stream) {
    pending = Buffer.concat([pending, chunk]);
    for (let end = pending.indexOf(10); end !== -1; end = pending.indexOf(10)) {
      if (end > max) throw new Error(`a line is longer than ${max} bytes`);
      yield pending.subarray(0, end).toString("utf8");
      pending = pending.subarray(end + 1);
    }
    if (pending.length > max) throw new Error(`a line is longer than ${max} bytes`);
  }
}
