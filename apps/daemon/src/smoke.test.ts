// The tier-1 smoke test (ADR-041): boots the real daemon on pi-ai's scripted provider, with no API calls.
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createModels, fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { startDaemon, type DaemonConfig } from "./daemon.js";

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
    expect(await first.session.send("My cat is Miso.")).toEqual({ status: "done", text: "Noted." });
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

  it("refuses to start when the credential file is open to others (ADR-079)", async () => {
    const { credentialsDir, faux, boot } = await setup();
    await chmod(join(credentialsDir, "llm.faux"), 0o644);
    await expect(boot()).rejects.toThrow(/refusing to start: the key of provider "faux": .*open to group or others/);
    expect(faux.state.callCount).toBe(0);
  });

  it("refuses to start without its credential directory", async () => {
    const { root } = await setup();
    await expect(startDaemon({ config, dataDir: join(root, "data"), credentialsDir: join(root, "missing") })).rejects.toThrow("refusing to start");
    await expect(stat(join(root, "data"))).rejects.toThrow("ENOENT"); // a refused start leaves no data directory
  });
});
