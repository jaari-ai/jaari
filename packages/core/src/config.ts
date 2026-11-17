// The owner's config file (ADR-056, ADR-118): one JSONC file, a schema version, a closed top level, and strict
// checks for the sections this version reads. The daemon and the `jaari` command both read it through here.
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import { Type, type Static } from "typebox";
import { Compile } from "typebox/compile";
import { LIMITS, type Limits } from "./limits.js";

export const CONFIG_VERSION = 1;

// Everything of one install sits under one folder, so a backup or a move is one folder (ADR-118). The credentials
// folder is a sibling of the data folder, never inside it (ADR-079).
export const jaariPaths = (home = join(homedir(), ".jaari")) => ({
  home,
  config: join(home, "config.jsonc"),
  data: join(home, "data"),
  credentials: join(home, "credentials"),
});

// "~/x" as the owner writes it in the config file.
export const expandHome = (path: string): string => (path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path);

const closed = { additionalProperties: false } as const;
// A section that belongs to a feature not built yet: its name is known, so a typo in a name still fails, and its
// content is checked when the feature ships.
const later = Type.Optional(Type.Unknown());

export const ConfigSchema = Type.Object(
  {
    version: Type.Integer({ minimum: 1 }),
    // ADR-017: where this daemon runs. `jaari init` asks.
    deployment: Type.Optional(Type.Object({ target: Type.Enum(["vps", "server", "home", "laptop"]), overlay: Type.Optional(Type.String({ minLength: 1 })) }, closed)),
    secrets: Type.Optional(
      Type.Object(
        {
          zero: Type.Optional(Type.Enum(["os-keychain", "host-credential"])), // ADR-079
          // host-credential without a service manager: the folder `jaari secret set` writes and the daemon reads.
          credentialsDir: Type.Optional(Type.String({ minLength: 1 })),
          vault: later, // roadmap 3.3
        },
        closed,
      ),
    ),
    llm: Type.Unknown(), // checked by @jaari/llm, which owns its schema
    limits: Type.Optional(Type.Object(Object.fromEntries(Object.keys(LIMITS).map((name) => [name, Type.Optional(Type.Integer({ minimum: 1 }))])), closed)),
    events: Type.Optional(Type.Object({ retentionDays: Type.Optional(Type.Integer({ minimum: 1 })) }, closed)), // ADR-032
    owner: later, channels: later, persona: later, shadow: later, memory: later, web: later, egress: later, backup: later,
  },
  closed,
);
export type Config = Omit<Static<typeof ConfigSchema>, "limits"> & { limits?: Partial<Limits> };

// Forward-only steps, one per version: MIGRATIONS[0] turns a version 1 config into version 2 (ADR-056).
const MIGRATIONS: ((config: Record<string, unknown>) => Record<string, unknown>)[] = [];

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`The config is not valid:\n${problems.join("\n")}`);
    this.name = "ConfigError";
  }
}

const check = Compile(ConfigSchema);

const position = (text: string, offset: number) => {
  const before = text.slice(0, offset).split("\n");
  return `line ${before.length}, column ${before.at(-1)!.length + 1}`;
};

// Checks the text of a config file. Throws ConfigError with every problem found, never a partial config.
export function parseConfig(text: string): Config {
  const errors: ParseError[] = [];
  let value: unknown = parse(text, errors, { allowTrailingComma: true });
  if (errors.length > 0) throw new ConfigError(errors.map((error) => `${position(text, error.offset)}: ${printParseErrorCode(error.error)}`));
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ConfigError(["the config must be one object"]);
  const version = (value as { version?: unknown }).version;
  if (!Number.isInteger(version) || (version as number) < 1) throw new ConfigError([`"version" is missing; this Jaari writes version ${CONFIG_VERSION}`]);
  // A binary older than its data refuses to start (ADR-056).
  if ((version as number) > CONFIG_VERSION) {
    throw new ConfigError([`the config is version ${String(version)}, newer than this Jaari reads (${CONFIG_VERSION}); update Jaari, or restore the config from before the update`]);
  }
  for (let from = version as number; from < CONFIG_VERSION; from++) value = { ...MIGRATIONS[from - 1]!(value as Record<string, unknown>), version: from + 1 };
  if (!check.Check(value)) throw new ConfigError(check.Errors(value).map((error) => `${error.instancePath || "/"}: ${error.message}`));
  return value as Config;
}

export async function loadConfig(path: string): Promise<Config> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new ConfigError([`no config at ${path}; run \`jaari init\` to write one`]);
    throw error;
  }
  return parseConfig(text);
}
