// What a command talks to, so tests can pass streams in place of a terminal.
import type { Readable, Writable } from "node:stream";

export type Io = {
  input: Readable & { setRawMode?: (raw: boolean) => unknown };
  output: Writable;
  isTTY: boolean; // a person is at the keyboard
};

// A command gets the arguments after its name and returns the process exit code.
export type Command = (args: string[], io: Io) => Promise<number>;
