// Owner commands read by code, so the brake works with every model down (ADR-031, ADR-059, ADR-116).
//
// STOP_WORDS, the filler words marked below, RESUME_WORDS, and the rule in `commandOf` ("at least one brake
// word, and every word is a brake word or a filler") are derived from OpenMausBot,
// refs/openmausbot/server/room-holds.ts at commit b802268 (Apache-2.0; see NOTICE and
// third_party/openmausbot/LICENSE). Changes: Jaari's pause words and fillers, the exact ADR-031 phrases,
// and the mapping to pause and stop.

export type Command = "pause" | "stop" | "resume" | "brake";

// OpenMausBot's set: the words of its Stop buttons in its language packs.
const STOP_WORDS = new Set(["stop", "halt", "cancel", "abort", "stopp", "stoppen", "detener", "arrêter", "रोकें", "interrompi", "ferma", "停止",
  "중지", "멈추기", "zatrzymaj", "parar", "стоп", "остановить", "durdur", "зупинити", "dừng",
  // Jaari's: the command forms people type (the set above has the button labels), and "enough".
  "arrête", "arrêtez", "detente", "detén", "fermati", "basta", "pare", "enough"]);

// Jaari's: "wait" and "hold on" in the languages of the filler set.
const PAUSE_WORDS = new Set(["pause", "wait", "hold", "attends", "attendez", "warte", "warten", "espera", "espere", "esperad", "aspetta",
  "aspettate", "pausa", "czekaj", "pauza", "подожди", "подождите", "пауза", "зачекай", "зачекайте", "bekle", "chờ"]);

const FILLERS = new Set([
  // OpenMausBot's set.
  "now", "please", "right", "immediately", "asap", "it", "that", "this", "everything", "all", "alles", "bitte", "sofort", "jetzt",
  "todo", "ahora", "tout", "maintenant", "tutto", "ora", "subito", "tudo", "agora", "wszystko", "teraz", "всё", "все", "сейчас", "пожалуйста", "зараз",
  "hepsini", "şimdi", "lütfen",
  // Jaari's: "hold on", "wait a sec", "pls".
  "on", "up", "a", "sec", "second", "minute", "pls",
]);

// OpenMausBot's set. English "continue" is left out on purpose: it is often an instruction to the model.
const RESUME_WORDS = new Set(["resume", "retomar", "retome"]);

// ADR-031's exact phrases keep their own meaning.
const PHRASES: Record<string, Command> = { "stop now": "stop", "stop everything": "pause", pause: "pause" };

// "Stop now!", "STOP, please" and "arrête tout" match; "stop the emails" and "don't stop" do not.
// `brake`: a stop word that pauses, and stops the turn when repeated (ADR-116).
export function commandOf(text: string): Command | undefined {
  const words = text.normalize("NFC").toLowerCase().match(/[\p{L}\p{M}\p{N}_-]+/gu) ?? [];
  if (words.length === 0) return undefined;
  const phrase = PHRASES[words.join(" ")];
  if (phrase) return phrase;
  if (words.length === 1 && RESUME_WORDS.has(words[0]!)) return "resume";
  if (!words.every((word) => STOP_WORDS.has(word) || PAUSE_WORDS.has(word) || FILLERS.has(word))) return undefined;
  if (words.some((word) => STOP_WORDS.has(word))) return "brake";
  if (words.some((word) => PAUSE_WORDS.has(word))) return "pause";
  return undefined;
}
