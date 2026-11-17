// Questions on a line-based input, for setup commands: the current value in brackets, an empty answer keeps it.
import { createInterface } from "node:readline";
import type { Io } from "./io.js";

// The input ended (Ctrl+D, or a pipe ran out) before the answer came.
export class InputEnded extends Error {
  constructor() {
    super("the input ended");
    this.name = "InputEnded";
  }
}

export type AskOptions = { current?: string; allowed?: readonly string[]; check?: (answer: string) => string | undefined };

export function createPrompter(io: Io) {
  const reader = createInterface({ input: io.input, terminal: false });
  // The iterator queues lines, so answers that arrive in one chunk wait for their question.
  const lines = reader[Symbol.asyncIterator]();
  return {
    async ask(question: string, { current, allowed, check }: AskOptions = {}): Promise<string> {
      for (;;) {
        io.output.write(current === undefined ? `${question}: ` : `${question} [${current}]: `);
        const line = await lines.next();
        if (line.done) throw new InputEnded();
        const answer = (line.value as string).trim() || (current ?? "");
        const reason = allowed && !allowed.includes(answer) ? `answer one of: ${allowed.join(", ")}` : check?.(answer);
        if (reason === undefined) return answer;
        io.output.write(`${reason}\n`);
      }
    },
    close: () => reader.close(),
  };
}
