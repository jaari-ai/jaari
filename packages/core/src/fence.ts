// The prompt-injection floor (ADR-104, ADR-120): `fence()` wraps a block that is not the owner's own words in a
// marker that content cannot forge, `defuse()` cleans the block first, `stripMarkers()` is the reply marker filter,
// and `leak()` finds the canary or the fence id in text that is about to leave. Deterministic code, no model.
import { randomInt } from "node:crypto";

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
// `length` random base32 characters, 5 bits each.
export const randomMarker = (length: number): string => Array.from({ length }, () => BASE32[randomInt(32)]).join("");

export const AUTHORITIES = ["owner", "owner-config", "on-behalf", "information"] as const;
export type Authority = (typeof AUTHORITIES)[number];

// Format characters (zero-width, joiners, the byte order mark, tag characters) and variation selectors: a wider
// set than ADR-104 lists, so a character Unicode adds later is covered too (ADR-120).
const INVISIBLE = /[\p{Cf}\p{Variation_Selector}\u{E0000}-\u{E007F}]/gu;
// Every bracket that can pass for the opener of a marker; \u27E6 and \u27E7 themselves are always replaced.
const BRACKET = /[\u27E6\u27E7[\uFF3B\u3010\u3016\u3014\u3018\u301A\u27EC\u298B\u2045\u2772{\uFF5B<\uFF1C]/g;
const MARKER_NAME = /^\s*\/?\s*jaari/i;

// Named steps, in order, so a test can remove one at a time and prove that each is needed (ADR-104 section 8).
export const DEFUSE_STEPS: readonly { name: string; apply(text: string): string }[] = [
  // Before "invisible": bidi controls are format characters too, and they become a space, not nothing.
  { name: "bidi and line separators", apply: (text) => text.replace(/[\u202A-\u202E\u2066-\u2069\u2028\u2029]/g, " ") },
  { name: "invisible", apply: (text) => text.replace(INVISIBLE, "") },
  { name: "control", apply: (text) => text.replace(/[^\P{Cc}\n\t]/gu, " ") }, // every control character but \n and \t
  {
    // After "invisible", so a zero-width character cannot split the word "jaari". NFKC folds full-width letters for the
    // comparison only; the text keeps its own letters.
    name: "marker brackets",
    apply: (text) =>
      text.replace(BRACKET, (bracket, at: number) =>
        bracket === "\u27E6" ? "(" : bracket === "\u27E7" ? ")" : MARKER_NAME.test(text.slice(at + 1, at + 16).normalize("NFKC")) ? "(" : bracket),
  },
];

export const defuse = (body: string, steps = DEFUSE_STEPS): string => steps.reduce((text, step) => step.apply(text), body);

// The reply marker filter: a whole echoed block goes, then any marker left alone, closed or not.
const BLOCK = /\u27E6jaari:[^\u27E7\n]*\u27E7[\s\S]*?\u27E6\/jaari:[^\u27E7\n]*\u27E7\n?/g;
const LONE = /\u27E6\/?jaari:[^\u27E7\n]*\u27E7?/g;
export const stripMarkers = (text: string): string => text.replace(BLOCK, "").replace(LONE, "");

const TOKEN = /^[a-z0-9][a-z0-9._:-]{0,63}$/; // `from` and `kind` are set by code; a value from content would be refused here
const decoded = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text; // not percent-encoded as a whole; the raw form is still checked
  }
};

// One per daemon run: the fence id is new at every start, and the canary is the install's (ADR-120).
export function createMarkers(canary: string, fenceId = randomMarker(8)) {
  if (canary.length < 16 || fenceId.length < 8) throw new Error("the canary needs 16 characters and the fence id 8: a short marker is found by accident");
  const hidden = [["canary", canary.toLowerCase()], ["fence-id", fenceId.toLowerCase()]] as const;
  return {
    canary,
    fenceId,
    // The body is one JSON string, so no line of it can start like an owner's line or like a marker.
    fence(source: { from: string; kind: string }, authority: Authority, body: string): string {
      if (!TOKEN.test(source.from) || !TOKEN.test(source.kind)) throw new Error(`a fence's "from" and "kind" are short lowercase names set by code, not ${JSON.stringify(source)}`);
      if (!AUTHORITIES.includes(authority)) throw new Error(`unknown authority ${JSON.stringify(authority)}`);
      return `\u27E6jaari:${fenceId} from=${source.from} kind=${source.kind} authority=${authority}\u27E7\n${JSON.stringify(defuse(body))}\n\u27E6/jaari:${fenceId}\u27E7`;
    },
    // Which marker the text carries, if any. Found as written, in another case, percent-encoded, or split by
    // invisible characters.
    // shortcut: a base64, compressed, or reworded leak passes (THREAT_MODEL.md), add encodings when a tool can produce them (roadmap 4.x)
    leak(text: string): "canary" | "fence-id" | undefined {
      const plain = text.replace(INVISIBLE, "").toLowerCase();
      const forms = [plain, decoded(plain)];
      return hidden.find(([, marker]) => forms.some((form) => form.includes(marker)))?.[0];
    },
  };
}
export type Markers = ReturnType<typeof createMarkers>;
