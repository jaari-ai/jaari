# ADR-116: Owner commands are read by code in the owner's languages; a stop word pauses, and a repeated one stops the turn

- **Status:** Accepted
- **Date:** 2026-11-16

## Context
OQ-94 asked what a bare "stop" and "wait" do: ADR-065 names them, ADR-031 defines only "pause",
"stop everything", and "stop now". The discussion widened to typos, other languages, indirect
wording, and frustration ("stop" typed several times). A study of the five references and the
commercial agents (learning/17) found that every one keeps the brake out of a model's hands: code
words, a button, or a key. None reads stop intent with a model, and the two small models that do
exist (OpenMausBot's decider, gajae-way's judge) can only route or veto, and fall back to a code rule.

## Decision
- **Code reads the owner's commands, before any model and with every model down** (ADR-031,
  ADR-059). The text is normalised (NFC, lower case, punctuation dropped) and split into words.
- **Exact ADR-031 phrases keep their meaning:** "stop now" is the emergency stop; "pause" and
  "stop everything" pause; "resume" (and OpenMausBot's "retomar", "retome") resumes.
- **The stop-word rule, borrowed from OpenMausBot:** a message is a brake when it holds at least
  one brake word and every word is a brake word or a filler. "Stop, please", "arrête tout", and
  "停止" match; "stop the emails" and "don't stop" go to the model. The word sets cover the
  languages of OpenMausBot's Stop buttons, plus Jaari's pause words ("wait", "hold on", and their
  forms in the filler languages) and the command forms people type ("arrête", "basta", "enough").
- **A stop word pauses** (nothing is lost; the running step finishes; nothing new runs).
  **A second stop word within 10 seconds is the emergency stop** (`repeatStopMs`, configurable).
  A pause word only pauses. This answers OQ-94: a bare "stop" pauses, "wait" pauses.
- **Everything else goes to the main model,** steered into a running turn at its next step, as
  before (ADR-065). Approvals stay read by code or a tap (ADR-035).
- **Reuse:** the word sets and the rule come from `refs/openmausbot/server/room-holds.ts`
  (Apache-2.0, ADR-016), with the attribution in `NOTICE` and the licence in
  `third_party/openmausbot/LICENSE`.

## Alternatives rejected
- **A model reads every message during a turn:** no reference or commercial agent does it, the
  brake would depend on a model (ADR-059), and small models report confidence badly until measured.
  Left open as OQ-95, with the cases code cannot cover.
- **A stop word cuts the turn at once, as in OpenMausBot:** a misread would cut work; the repeat
  rule gives the fast brake when the owner insists.
- **Pause only, no repeat rule:** a frustrated owner who types "stop" twice should not have to know
  the exact phrase "stop now".

## Consequences
- Indirect wording ("ugh, not that one"), typos ("stpo"), swearing, and languages outside the word
  sets are not brakes. The main model reads them at the next step; during a long tool step nothing
  reads them until the step ends. OQ-95 records this gap.
- A bare "stop" when nothing runs also pauses, so proactive messages stop too (ADR-031); "resume"
  ends it.
