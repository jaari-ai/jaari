// Starts the daemon's parts in order and refuses to start on any failure: secrets, egress, model
// routing, the main session, then the channels: ingress and the CLI socket (ADR-015, ADR-021, ADR-065, ADR-079).
import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { MutableModels } from "@earendil-works/pi-ai";
import { CLI_MANIFEST, createCliChannel, createIngress, socketPath } from "@jaari/channels";
import { commandOf, createSession, openEventLog, openStore, type Config } from "@jaari/core";
import { createEgress, type EgressPolicy } from "@jaari/http";
import { checkLlmConfig, createLlm, openUsageLog } from "@jaari/llm";
import { createHostCredentialProvider, createOsKeychainProvider, resolveRef, type VaultProvider } from "@jaari/secrets";

// The sections of the owner's config (ADR-118) that the daemon reads in Phase 0. `llm` is checked by @jaari/llm.
export type DaemonConfig = Pick<Config, "secrets" | "llm" | "limits" | "events">;

export type DaemonOptions = {
  config: DaemonConfig;
  dataDir: string;
  credentialsDir?: string; // host-credential: $CREDENTIALS_DIRECTORY under systemd, /run/secrets under Compose
  models?: MutableModels; // the smoke test passes pi-ai's scripted provider here (ADR-041)
};

// shortcut: a placeholder; the locked safety section and the prompt layers come with roadmap 0.16 and 2.4.
const SYSTEM_PROMPT = "You are Jaari, the owner's personal assistant.";

// "http://localhost:11434/v1" → "localhost:11434"; the port defaults by scheme. IPv6 keeps its brackets.
const hostPort = (baseUrl: string) => {
  const url = new URL(baseUrl);
  return `${url.hostname}:${url.port || (url.protocol === "https:" ? 443 : 80)}`;
};

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
  const providers = checkLlmConfig(config.llm).providers;
  for (const [id, provider] of Object.entries(providers)) {
    if (!provider.apiKey) continue;
    await resolveRef(provider.apiKey, secrets).catch((error: unknown) => {
      throw new Error(`refusing to start: the key of provider "${id}": ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  // The built-in CLI channel. Its socket sits in the owner-only data folder, so whoever reaches it is the owner
  // (ADR-021, ADR-022). Made here because it checks the socket path's length, before anything is written.
  const cli = createCliChannel({ socketPath: socketPath(dataDir) });

  // Created only after the checks, so a refused start leaves nothing behind.
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  await chmod(dataDir, 0o700); // `mkdir` leaves a folder that already exists as it is; the transcript is private
  const events = openEventLog(join(dataDir, "events.ndjson"), config.events?.retentionDays);
  const opened: { close(): void }[] = [];
  try {
    const usage = openUsageLog(join(dataDir, "usage.db"));
    opened.push(usage);
    const store = openStore(join(dataDir, "session.db"));
    opened.push(store);
    // A model server the owner lists in config counts as allowed (ADR-080), so local models pass the egress check.
    const policy: EgressPolicy = { allow: Object.values(providers).flatMap((p) => (p.baseUrl ? [hostPort(p.baseUrl)] : [])) };
    const llm = await createLlm({ config: config.llm, fetch: createEgress(policy).fetch, secrets, usage, ...(options.models ? { models: options.models } : {}) });
    const session = createSession({ store, events, llm, systemPrompt: SYSTEM_PROMPT, ...(config.limits ? { limits: config.limits } : {}) });
    const ingress = createIngress({ session, refs: store.refs, events, isCommand: (text) => commandOf(text) !== undefined });
    const abort = new AbortController();
    opened.push({ close: () => void cli.stop() }); // before start: a start that fails after listening still removes the socket
    await cli.start({
      manifest: CLI_MANIFEST,
      emit: ingress.channel(CLI_MANIFEST, cli, { owner: true }),
      secrets: { get: async (name) => Promise.reject(new Error(`the CLI channel declares no secret "${name}"`)) },
      // A plugin's log text may quote a message, and events never carry message text (ADR-032).
      log: { info: () => {}, warn: () => events.write({ type: "channel.warn", channel: "cli" }), error: () => events.write({ type: "channel.error", channel: "cli" }) },
      signal: abort.signal,
    });
    events.write({ type: "daemon.start" });
    let closing: Promise<void> | undefined;
    return {
      session,
      socketPath: socketPath(dataDir),
      // Lets a running turn and its delivery settle, then closes the socket and the stores. The socket closes
      // last, so the owner gets the answer to a turn that was running at shutdown.
      // Safe to call twice, for example on SIGINT then SIGTERM.
      close: () =>
        (closing ??= (async () => {
          await ingress.close();
          await session.idle();
          abort.abort();
          await cli.stop();
          events.write({ type: "daemon.stop" });
          opened.forEach((handle) => handle.close());
        })()),
    };
  } catch (error) {
    opened.forEach((handle) => handle.close());
    throw error;
  }
}
