// The owner's config file (ADR-056, ADR-118): one JSONC file, a schema version, a closed top level, and strict
// checks for the sections this version reads. The daemon and the `jaari` command both read it through here.
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
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

// The folder of host-credential files when no service manager supplies one: `jaari secret set` writes it and the
// daemon reads it, so both must agree (ADR-118). A relative path counts from the Jaari folder.
export const credentialsDirOf = (config: Pick<Config, "secrets">, paths: ReturnType<typeof jaariPaths>): string =>
  config.secrets?.credentialsDir ? resolve(paths.home, expandHome(config.secrets.credentialsDir)) : paths.credentials;

// The lexical form of ADR-079's rule; the provider also checks the real path, after links, before it writes or reads.
export const isInsideData = (dir: string, paths: ReturnType<typeof jaariPaths>): boolean => {
  const rel = relative(paths.data, dir);
  return rel === "" || !(rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel));
};

const closed = { additionalProperties: false } as const;
const OWNER_ID = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"; // a lowercase UUID
// A section that belongs to a feature not built yet: its name is known, so a typo in a name still fails, and its
// content is checked when the feature ships.
const later = Type.Optional(Type.Unknown());

export const ConfigSchema = Type.Object(
  {
    version: Type.Integer({ minimum: 1 }),
    // ADR-017: where this daemon runs. `jaari init` asks.
    deployment: Type.Optional(Type.Object({ target: Type.Enum(["vps", "server", "home", "laptop"]), overlay: Type.Optional(Type.String({ minLength: 1 })) }, closed)),
    // ADR-057, ADR-121: a laptop host. `stayAwake`: hold off idle sleep while a turn runs on mains power ("working",
    // the default on a laptop), "never", or "always". Below `batteryPausePercent` on battery, background work pauses.
    power: Type.Optional(
      Type.Object({ stayAwake: Type.Optional(Type.Enum(["working", "never", "always"])), batteryPausePercent: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })) }, closed),
    ),
    // ADR-124: which releases `jaari update` offers: "stable" (npm `latest`) or "beta" (also npm `next`). Without it,
    // an install keeps the kind it has.
    update: Type.Optional(Type.Object({ channel: Type.Optional(Type.Enum(["stable", "beta"])) }, closed)),
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
    // ADR-119: `id` is written once by `jaari init` and never changes; every record carries it (ADR-044). The other
    // owner keys (time zone, quiet hours, phones) are checked when their features ship.
    owner: Type.Optional(Type.Object({ id: Type.Optional(Type.String({ pattern: OWNER_ID })) }, { additionalProperties: true })),
    channels: later, persona: later, shadow: later, memory: later, web: later, egress: later, backup: later,
  },
  closed,
);
export type Config = Omit<Static<typeof ConfigSchema>, "limits"> & { limits?: Partial<Limits> };

// Forward-only steps, one per version: MIGRATIONS[0] turns a version 1 config into version 2 (ADR-056).
const MIGRATIONS: ((config: Record<string, unknown>) => Record<string, unknown>)[] = [];

export class ConfigError extends Error {
  constructor(readonly problems: string[], heading = "The config is not valid:") {
    super(`${heading}\n${problems.join("\n")}`);
    this.name = "ConfigError";
  }
}

const check = Compile(ConfigSchema);

// One line per problem, in words an owner can act on: an unknown key is named, not reported as "schema is false".
function problemOf(error: { keyword: string; schemaPath: string; instancePath: string; params: unknown; message: string }): string[] {
  if (error.keyword === "additionalProperties") {
    return ((error.params as { additionalProperties?: string[] }).additionalProperties ?? []).map((name) => `${error.instancePath}/${name}: unknown key`);
  }
  if (error.schemaPath.endsWith("/additionalProperties")) return []; // the same unknown key, reported a second time
  return [`${error.instancePath || "/"}: ${error.message}`];
}

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
  if (version === undefined) throw new ConfigError([`"version" is missing; this Jaari writes version ${CONFIG_VERSION}`]);
  if (!Number.isInteger(version) || (version as number) < 1) throw new ConfigError([`"version" must be a whole number such as ${CONFIG_VERSION}, not ${JSON.stringify(version)}`]);
  // A binary older than its data refuses to start (ADR-056).
  if ((version as number) > CONFIG_VERSION) {
    throw new ConfigError([`the config is version ${String(version)}, newer than this Jaari reads (${CONFIG_VERSION}); update Jaari, or restore the config from before the update`]);
  }
  for (let from = version as number; from < CONFIG_VERSION; from++) value = { ...MIGRATIONS[from - 1]!(value as Record<string, unknown>), version: from + 1 };
  if (!check.Check(value)) throw new ConfigError(check.Errors(value).flatMap(problemOf));
  return value as Config;
}

// The owner's id, for everything that stores a record. A config from before roadmap 0.14 has none: the loader still
// reads it, so that `jaari init` can add the id, but nothing that stores data starts without it (ADR-119).
export function ownerIdOf(config: Pick<Config, "owner">): string {
  const id = config.owner?.id;
  if (!id) throw new ConfigError(['"owner.id" is missing; run `jaari init` once: it adds the id and keeps everything else'], "The config has no owner id:");
  return id;
}

export async function loadConfig(path: string): Promise<Config> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new ConfigError([`no config at ${path}; run \`jaari init\` to write one`], "No config:");
    throw error;
  }
  return parseConfig(text);
}
