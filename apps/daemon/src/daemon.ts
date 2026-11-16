// Starts the daemon's parts in order and refuses to start on any failure: secrets, egress, model
// routing, the main session (ADR-015, ADR-065, ADR-079).
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { MutableModels } from "@earendil-works/pi-ai";
import { createSession, openEventLog, openStore, type Limits } from "@jaari/core";
import { createEgress, type EgressPolicy } from "@jaari/http";
import { checkLlmConfig, createLlm, openUsageLog } from "@jaari/llm";
import { createHostCredentialProvider, createOsKeychainProvider, resolveRef, type VaultProvider } from "@jaari/secrets";

// The sections of the owner's config the daemon reads in Phase 0; the full loader is roadmap 0.6.
export type DaemonConfig = {
  secrets?: { zero?: "os-keychain" | "host-credential" };
  llm: unknown; // checked by @jaari/llm
  egress?: { allow?: string[] };
  limits?: Partial<Limits>;
};

export type DaemonOptions = {
  config: DaemonConfig;
  dataDir: string;
  credentialsDir?: string; // host-credential: $CREDENTIALS_DIRECTORY under systemd, /run/secrets under Compose
  models?: MutableModels; // the smoke test passes pi-ai's scripted provider here (ADR-041)
};

// shortcut: a placeholder; the locked safety section and the prompt layers come with roadmap 0.16 and 2.4.
const SYSTEM_PROMPT = "You are Jaari, the owner's personal assistant.";

function secretsFor(options: DaemonOptions): VaultProvider {
  const zero = options.config.secrets?.zero ?? "os-keychain";
  if (zero === "os-keychain") return createOsKeychainProvider();
  if (!options.credentialsDir) throw new Error("secrets.zero is host-credential, but no credential directory was given");
  return createHostCredentialProvider(options.credentialsDir, options.dataDir);
}

export async function startDaemon(options: DaemonOptions) {
  const { config, dataDir } = options;
  const secrets = secretsFor(options);
  // Unattended start fails here, before anything runs, when secret zero is unusable (ADR-079).
  const health = await secrets.health();
  if (!health.ok) throw new Error(`refusing to start: ${health.problem}`);
  // Each model key is read once as a check and dropped, so a bad credential file stops the start, not the
  // first turn (ADR-079). Calls still resolve the key just before they run (ADR-007).
  for (const [id, provider] of Object.entries(checkLlmConfig(config.llm).providers)) {
    if (!provider.apiKey) continue;
    await resolveRef(provider.apiKey, secrets).catch((error: unknown) => {
      throw new Error(`refusing to start: the key of provider "${id}": ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  // Created only after the checks, so a refused start leaves nothing behind.
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const events = openEventLog(join(dataDir, "events.ndjson"));
  const opened: { close(): void }[] = [];
  try {
    const usage = openUsageLog(join(dataDir, "usage.db"));
    opened.push(usage);
    const store = openStore(join(dataDir, "session.db"));
    opened.push(store);
    const policy: EgressPolicy = { allow: config.egress?.allow ?? [] };
    const llm = await createLlm({ config: config.llm, fetch: createEgress(policy).fetch, secrets, usage, ...(options.models ? { models: options.models } : {}) });
    const session = createSession({ store, events, llm, systemPrompt: SYSTEM_PROMPT, ...(config.limits ? { limits: config.limits } : {}) });
    events.write({ type: "daemon.start" });
    let closing: Promise<void> | undefined;
    return {
      session,
      // Lets a running turn settle, then closes the stores.
      // Safe to call twice, for example on SIGINT then SIGTERM.
      close: () =>
        (closing ??= session.idle().then(() => {
          events.write({ type: "daemon.stop" });
          opened.forEach((handle) => handle.close());
        })),
    };
  } catch (error) {
    opened.forEach((handle) => handle.close());
    throw error;
  }
}
