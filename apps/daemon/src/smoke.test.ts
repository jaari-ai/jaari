// The tier-1 smoke test (ADR-041): boots the real daemon on pi-ai's scripted provider, with no API calls.
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
// eslint-disable-next-line no-restricted-imports -- the test plays `jaari chat`, so it dials the daemon's local socket
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createModels, fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { startDaemon, type DaemonConfig } from "./daemon.js";

// A terminal on the daemon's socket, as `jaari chat` would attach.
async function terminal(path: string) {
  const socket = createConnection({ path });
  const lines: Record<string, unknown>[] = [];
  let pending = "";
  socket.on("data", (chunk) => {
    pending += chunk.toString("utf8");
    for (let end = pending.indexOf("\n"); end !== -1; end = pending.indexOf("\n")) {
      lines.push(JSON.parse(pending.slice(0, end)) as Record<string, unknown>);
      pending = pending.slice(end + 1);
    }
  });
  socket.write(JSON.stringify({ hello: { versions: [1] } }) + "\n");
  await expect.poll(() => lines.length).toBe(1);
  let count = 0;
  const say = (text: string, replyTo?: string) => {
    const id = `t-${++count}`;
    socket.write(JSON.stringify({ type: "message", id, text, ...(replyTo ? { replyTo } : {}) }) + "\n");
    return id;
  };
  const messages = () => lines.filter((line) => line.type === "message") as { id: string; text: string; replyTo?: string }[];
  return { socket, say, messages };
}

const config: DaemonConfig = {
  secrets: { zero: "host-credential" },
  llm: { providers: { faux: { apiKey: "secretRef:llm.faux" } }, tiers: { small: ["faux/a"] }, roles: { main: "small", summarize: "small" } },
};

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "jaari-smoke-"));
  const credentialsDir = join(root, "credentials");
  await mkdir(credentialsDir, { mode: 0o700 });
  await writeFile(join(credentialsDir, "llm.faux"), "scripted-key\n", { mode: 0o600 });
  const faux = fauxProvider({ provider: "faux", models: [{ id: "a", contextWindow: 100_000 }] });
  const boot = () => {
    const models = createModels();
    models.setProvider(faux.provider);
    return startDaemon({ config, dataDir: join(root, "data"), credentialsDir, models });
  };
  return { root, credentialsDir, faux, boot };
}

describe("tier-1 smoke", () => {
  it("reaches a local model server listed in config through the egress check (ADR-080)", async () => {
    const { root, credentialsDir } = await setup();
    let hits = 0;
    const server = createServer((_, res) => (hits++, res.writeHead(500).end("{}")));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as { port: number };
    const local: DaemonConfig = {
      secrets: { zero: "host-credential" },
      llm: { providers: { local: { api: "openai-completions", baseUrl: `http://127.0.0.1:${port}/v1` } }, tiers: { small: ["local/m"] }, roles: { main: "small", summarize: "small" } },
    };
    const daemon = await startDaemon({ config: local, dataDir: join(root, "data"), credentialsDir });
    await daemon.session.send("hi"); // the server answers 500; what matters is that the request got there
    await daemon.close();
    server.close();
    expect(hits).toBeGreaterThan(0);
  });

  it("makes an existing data folder private (ADR-028)", async () => {
    const { root, boot } = await setup();
    await mkdir(join(root, "data"), { mode: 0o755 });
    await (await boot()).close();
    expect((await stat(join(root, "data"))).mode & 0o777).toBe(0o700);
  });

  it("closes once when two signals arrive together", async () => {
    const { root, boot } = await setup();
    const daemon = await boot();
    await Promise.all([daemon.close(), daemon.close()]);
    const log = (await readFile(join(root, "data", "events.ndjson"), "utf8")).trim().split("\n");
    expect(log.filter((line) => line.includes("daemon.stop"))).toHaveLength(1);
  });

  it("closes what it opened when a store fails to open", async () => {
    const { root, boot } = await setup();
    await mkdir(join(root, "data", "session.db"), { recursive: true }); // a directory where the database belongs
    await expect(boot()).rejects.toThrow();
  });

  it("boots, answers, survives a restart, and keeps the pause", async () => {
    const { root, faux, boot } = await setup();
    let key: string | undefined;
    let context = "";
    faux.setResponses([
      (_, options) => ((key = options?.apiKey), fauxAssistantMessage("Noted.")),
      (sent) => ((context = JSON.stringify(sent.messages)), fauxAssistantMessage("Miso.")),
    ]);

    const first = await boot();
    expect(await first.session.send("My cat is Miso.")).toEqual({ status: "done", text: "Noted.", seq: expect.any(Number) });
    expect(key).toBe("scripted-key"); // from the credential file, through secretRef, not from the environment
    first.session.pause();
    await first.close();

    const second = await boot();
    expect(second.session.paused()).toBe(true);
    expect(await second.session.send("What is my cat called?")).toEqual({ status: "held" });
    second.session.resume();
    expect((await second.session.send("What is my cat called?")).text).toBe("Miso.");
    expect(context).toContain("My cat is Miso."); // the restarted session sent the first turn to the model
    await second.close();

    const log = (await readFile(join(root, "data", "events.ndjson"), "utf8")).trim().split("\n").map((l) => JSON.parse(l).type);
    expect(log.filter((t: string) => t === "daemon.start")).toHaveLength(2);
    expect(faux.state.callCount).toBe(2);
  });

  it("talks through the CLI socket: scrubs a pasted key, keeps a stop out of the model, and quotes from its own record (0.8)", async () => {
    const { root, faux, boot } = await setup();
    const seen: string[] = [];
    faux.setResponses([
      (sent) => (seen.push(JSON.stringify(sent.messages)), fauxAssistantMessage("Two flights: 9:15 or 10:40.")),
      (sent) => (seen.push(JSON.stringify(sent.messages)), fauxAssistantMessage("Booked the 10:40.")),
    ]);
    const daemon = await boot();
    expect((await stat(daemon.socketPath)).mode & 0o777).toBe(0o600);
    const chat = await terminal(daemon.socketPath);

    chat.say("Find me a flight. My key is sk-" + "a".repeat(40));
    await expect.poll(() => chat.messages().map((m) => m.text)).toEqual(["Two flights: 9:15 or 10:40.", expect.stringMatching(/removed/i)]);
    expect(seen[0]).not.toContain("a".repeat(40)); // the model never saw the key
    expect(seen[0]).toContain("[secret removed: ");

    const offer = chat.messages()[0]!.id;
    chat.say("the later one", offer);
    await expect.poll(() => chat.messages().length).toBe(3);
    expect(chat.messages()[2]!.text).toBe("Booked the 10:40.");
    expect(seen[1]).toContain("Two flights: 9:15 or 10:40."); // quoted from the transcript, not from the terminal

    chat.say("stop");
    await expect.poll(() => chat.messages().length).toBe(4);
    expect(daemon.session.paused()).toBe(true);
    expect(faux.state.callCount).toBe(2); // the stop never reached the model
    chat.socket.destroy();
    await daemon.close();
    await expect(stat(daemon.socketPath)).rejects.toThrow("ENOENT"); // the socket goes with the daemon
    const log = await readFile(join(root, "data", "events.ndjson"), "utf8");
    expect(log).not.toContain("a".repeat(40));
  });

  it("refuses to start when the credential file is open to others (ADR-079)", async () => {
    const { credentialsDir, faux, boot } = await setup();
    await chmod(join(credentialsDir, "llm.faux"), 0o644);
    await expect(boot()).rejects.toThrow(/refusing to start: the key of provider "faux": .*open to group or others/);
    expect(faux.state.callCount).toBe(0);
  });

  it("refuses a data folder whose socket path is too long, before writing anything", async () => {
    const { root, credentialsDir } = await setup();
    const data = join(root, "d".repeat(120));
    await expect(startDaemon({ config, dataDir: data, credentialsDir })).rejects.toThrow("socket path is longer");
    await expect(stat(data)).rejects.toThrow("ENOENT");
  });

  it("refuses to start without its credential directory", async () => {
    const { root } = await setup();
    await expect(startDaemon({ config, dataDir: join(root, "data"), credentialsDir: join(root, "missing") })).rejects.toThrow("refusing to start");
    await expect(stat(join(root, "data"))).rejects.toThrow("ENOENT"); // a refused start leaves no data directory
  });
});
