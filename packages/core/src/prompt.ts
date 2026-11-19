// The system prompt of Phase 0: the identity line, the locked safety section, and this run's markers (ADR-042,
// ADR-104). The safety section is a file of this package and has no override: it changes only with a release.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// The same relative path works from src/ and from the built dist/.
const file = readFileSync(new URL("../prompts/safety.md", import.meta.url), "utf8");
const versionLine = /^<!-- version: (\d+) -->\n/.exec(file);
if (!versionLine) throw new Error("packages/core/prompts/safety.md must start with its version line (ADR-042)");

// `sha256` covers the whole file, so the event log can name the exact text in force (ADR-042, tracing).
export const SAFETY = {
  version: Number(versionLine[1]),
  sha256: createHash("sha256").update(file).digest("hex"),
  text: file.slice(versionLine[0].length).trim(),
};

// The same text for every turn of a run, so the provider's prompt cache holds (ADR-024). The canary is labelled
// as an internal marker and the model is never asked to repeat it (ADR-104).
// shortcut: no persona, rules, or capability list yet; context assembly adds the layers (roadmap 1.3, 2.4)
export const systemPrompt = (markers: { fenceId: string; canary: string }): string =>
  ["You are Jaari, the owner's personal assistant.", SAFETY.text, `Fence id of this session: ${markers.fenceId}\nInternal marker, with no meaning for the conversation: ${markers.canary}`].join("\n\n");
