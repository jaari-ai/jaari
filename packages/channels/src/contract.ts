// The shared channel contract suite (ADR-084). A plugin calls `channelContract` from its own tests, with its
// adapter and a fake of its transport. Types cannot check behaviour such as "the same key sends once"; this can.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseManifest } from "@jaari/capabilities";
import { describe, expect, it } from "vitest";
import { isInboundMessage, type ChannelAdapter, type ChannelContext, type ChannelManifest, type InboundMessage, type OutboundMessage } from "./types.js";

// One adapter wired to a fake transport. The suite builds a new one for each test.
export type ContractHarness = {
  adapter: ChannelAdapter;
  // The transport gets one message from the owner. Before `start`, it is a message that was already
  // there when the channel first connects (a transport with no history may do nothing).
  receive(text: string): Promise<void>;
  // The texts the transport was asked to carry.
  sent(): Promise<string[]>;
  // The transport's next send ends without telling whether the message went out. Leave it out when the
  // transport always knows.
  ambiguous?(): void;
  cleanup?(): Promise<void>;
};

export type ContractOptions = {
  manifest: unknown; // the `jaari` key of the plugin's package.json
  sources: string; // the plugin's source folder, read for forbidden imports
  create(): ContractHarness | Promise<ContractHarness>;
};

// A plugin never sees the session, memory, the gate, secrets other than its own, or a tool (ARCHITECTURE.md).
const FORBIDDEN = /from\s+["']@jaari\/(core|memory|gate|llm|persona|secrets|web|computer|integrations|mcp)(\/[^"']*)?["']/;

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : /\.[cm]?[jt]s$/.test(entry.name) ? [join(dir, entry.name)] : []);

export function channelContract(options: ContractOptions): void {
  describe("channel contract (ADR-084)", () => {
    const checked = parseManifest(options.manifest);
    const manifest = (checked.ok ? checked.manifest : undefined) as ChannelManifest | undefined;

    // Starts the adapter the way the host does. `emitted` fills as the adapter hands messages to ingress.
    async function started() {
      const harness = await options.create();
      const emitted: InboundMessage[] = [];
      const asked: string[] = [];
      const abort = new AbortController();
      const context: ChannelContext = {
        manifest: manifest!,
        emit: async (message) => void emitted.push(message),
        secrets: {
          async get(name) {
            asked.push(name);
            if (!manifest!.secrets?.includes(name)) throw new Error(`secret "${name}" is not declared in the manifest`);
            return "contract-suite-value";
          },
        },
        log: { info() {}, warn() {}, error() {} },
        signal: abort.signal,
      };
      const stop = async () => {
        abort.abort();
        await harness.adapter.stop();
        await harness.cleanup?.();
      };
      return { harness, emitted, asked, context, abort, stop };
    }
    const outbound = (text: string, idempotencyKey: string): OutboundMessage => ({ channel: manifest!.id, conversationId: "contract", text, idempotencyKey });

    it("declares a valid channel manifest", () => {
      expect(checked).toMatchObject({ ok: true, manifest: { kind: "channel" } });
    });

    it("replays nothing on its first start, then hands over what arrives", async () => {
      const run = await started();
      await run.harness.receive("sent before the channel was connected");
      await run.harness.adapter.start(run.context);
      const position = await run.harness.adapter.cursor();
      expect(position).toEqual(expect.any(String));
      expect(run.emitted).toEqual([]); // an early build of a reference agent texted 21 stale messages to its owner
      await run.harness.receive("hello");
      await expect.poll(() => run.emitted.length).toBe(1);
      expect(isInboundMessage(run.emitted[0])).toBe(true);
      expect(run.emitted[0]).toMatchObject({ channel: manifest!.id, text: "hello" });
      await run.stop();
    });

    it("stops on stop and on abort, and hands over nothing afterwards", async () => {
      const run = await started();
      await run.harness.adapter.start(run.context);
      run.abort.abort(); // the host aborts first; `stop` must still settle
      await run.harness.adapter.stop();
      await run.harness.adapter.stop(); // a second stop is harmless
      await run.harness.receive("after stop").catch(() => {}); // a closed transport may refuse
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(run.emitted).toEqual([]);
      await run.harness.cleanup?.();
    });

    it("sends once for one idempotency key", async () => {
      const run = await started();
      await run.harness.adapter.start(run.context);
      const first = await run.harness.adapter.send(outbound("one", "key-1"));
      const again = await run.harness.adapter.send(outbound("one", "key-1"));
      expect(first).toMatchObject({ status: "confirmed", providerMessageId: expect.any(String) });
      expect(again).toEqual(first);
      const other = await run.harness.adapter.send(outbound("two", "key-2"));
      expect(other).toMatchObject({ status: "confirmed" });
      expect((other as { providerMessageId: string }).providerMessageId).not.toBe((first as { providerMessageId: string }).providerMessageId);
      expect(await run.harness.sent()).toEqual(["one", "two"]);
      await run.stop();
    });

    it("reports an unknown result as ambiguous", async ({ skip }) => {
      const run = await started();
      if (!run.harness.ambiguous) return skip("the transport always knows whether a message went out");
      await run.harness.adapter.start(run.context);
      run.harness.ambiguous();
      expect(await run.harness.adapter.send(outbound("maybe", "key-3"))).toMatchObject({ status: "ambiguous" });
      await run.stop();
    });

    it("asks only for the secrets it declares", async () => {
      const run = await started();
      await run.harness.adapter.start(run.context); // an undeclared name rejects here
      await run.harness.adapter.send(outbound("x", "key-4"));
      expect(run.asked.filter((name) => !manifest!.secrets?.includes(name))).toEqual([]);
      await run.stop();
    });

    it("imports nothing a plugin must not reach", () => {
      const found = files(options.sources).filter((path) => FORBIDDEN.test(readFileSync(path, "utf8")));
      expect(found).toEqual([]);
    });
  });
}
