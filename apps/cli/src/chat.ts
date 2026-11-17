// `jaari chat`: numbers every message so the owner can reply to one with `>N text` (ADR-117).
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { Connection } from "./socket.js";

export type { Connection } from "./socket.js";

// Terminals obey control codes: ESC sequences can clear the screen or, through OSC 52, set the clipboard. Model text
// may echo a web page, so every control character except line break and tab is shown as U+FFFD, never obeyed.
// eslint-disable-next-line no-control-regex -- matching control characters is the point here
export const printable = (text: string): string => text.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "\uFFFD");

export async function chat({ socket, input, output }: { socket: Connection; input: Readable; output: Writable }): Promise<void> {
  const ids: string[] = []; // message N has the id at N - 1
  const show = (id: string, who: string, text: string, replyTo?: string) => {
    const target = replyTo === undefined ? -1 : ids.indexOf(replyTo);
    ids.push(id);
    output.write(`[${ids.length}] ${who}${target === -1 ? "" : ` (re ${target + 1})`}: ${printable(text)}\n`);
  };
  const reader = createInterface({ input, terminal: false });
  reader.on("SIGINT", () => reader.close());
  const incoming = (async () => {
    for await (const line of socket.lines) {
      if (line.type === "message" && typeof line.id === "string") show(line.id, "jaari", String(line.text ?? ""), typeof line.replyTo === "string" ? line.replyTo : undefined);
      else if (typeof line.error === "string") output.write(`jaari: error: ${printable(line.error)}\n`);
    }
  })().catch(() => {}).finally(() => reader.close()); // the daemon went away: stop reading input
  for await (const typed of reader) {
    if (!typed.trim()) continue;
    const reply = /^>(\d+) +(\S.*)$/s.exec(typed);
    const replyTo = reply ? ids[Number(reply[1]) - 1] : undefined;
    if (reply && !replyTo) {
      output.write(`there is no message ${reply[1]}\n`);
      continue;
    }
    const text = reply ? reply[2]! : typed;
    const id = randomUUID();
    socket.send({ type: "message", id, text, ...(replyTo ? { replyTo } : {}) });
    show(id, "you", text, replyTo);
  }
  socket.close();
  await incoming;
}
