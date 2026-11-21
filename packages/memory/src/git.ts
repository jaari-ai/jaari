// Runs the git program on the memory repo (ADR-132). The repo is a folder the owner may edit by hand, and a git config
// or hook in it can make git run programs, so every call turns hooks, fsmonitor, and commit signing off, reads no system or global
// config, and runs git by its full path with a fixed environment.
import { execFile } from "node:child_process";

export const GIT = "/usr/bin/git";

const SAFE = ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-c", "commit.gpgSign=false", "-c", "core.quotePath=false", "-c", "user.name=Jaari", "-c", "user.email=jaari@localhost"];
const ENV = { PATH: "/usr/bin:/bin", HOME: "/nonexistent", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" };

export type Git = (args: string[], input?: string) => Promise<string>;

// A git that fails rejects with its stderr, so the reason reaches the caller.
export const gitIn = (dir: string): Git => (args, input) =>
  new Promise((done, fail) => {
    const child = execFile(GIT, [...SAFE, "-C", dir, ...args], { env: ENV, maxBuffer: 64 * 1024 * 1024, timeout: 60_000 }, (error, stdout, stderr) =>
      error ? fail(new Error(`git ${args[0]}: ${stderr.trim() || error.message}`)) : done(stdout),
    );
    if (input !== undefined) child.stdin!.end(input);
  });
