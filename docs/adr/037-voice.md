# ADR-037: Voice: voice notes in v1, local speech by default, owner-chosen approval strictness

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Voice notes in v1.** An inbound audio attachment on any channel is transcribed and handled as
the owner's text. The reply shows the transcript in one short line, so a misheard word is
visible.

**Speech engines are roles, routed like the LLM (ADR-011).** `stt` defaults to local whisper.cpp
(a small model on CPU; audio stays on the box), with Deepgram, OpenAI, or Groq as API options.
`tts` is local Piper or Kokoro, or ElevenLabs with the owner's key as a `secretRef` resolved on
the server. A role marked local-only fails closed and never falls back to an API.

**Spoken replies are off by default and the owner's toggle.** "Answer in voice" turns them on,
"text only" turns them off, at any time; the panel and config show the setting. When the owner
sends a voice note while voice replies are off, Jaari replies in text and suggests voice replies
once; it does not repeat the suggestion. Spoken replies go through a speech-text converter that
says the prose, names artifacts, and drops syntax (no code, paths, or tables read aloud), and
the text is always sent with the audio.

**Spoken approvals are one rendering of the ADR-035 prompt.** The answer must open the
utterance and be an unconditional yes or no; fillers and hedges are dropped, and a conditional
answer ("yes, but only…") is refused and asked again. The ADR-035 rule holds: a bare "yes"
counts only when exactly one prompt is open. Strictness for high-risk approvals (Always allow,
send, publish, host commands) is the owner's choice, offered at `jaari init` and changeable
later:
- **Hardened** (default): the code must be spoken ("yes 4821") or the prompt tapped.
- **Bare yes:** a clear yes is enough when it is the only open prompt.

Voice-note transcripts are parsed by the same fixed grammar as text.

**Live calls after v1.** Over the web panel first, then a phone number (ADR-063: not in v1); half-duplex at
first, local turn detection, and narration of tool activity so silence never reads as a dropped
call. An inbound call the owner places makes its channel active (ADR-022).

**Retention.** Voice-note audio 30 days, then deleted; the transcript stays in the raw log
(ADR-029). The owner's audio is never used to train or clone a voice.

**Jaari calling others** (ADR-063, later): each call needs its own approval and never uses a
standing grant.

Borrowed: speech text, half-duplex calls, narration, and the spoken-consent grammar from
OpenMausBot (`docs/voice-mode.md`, `shared/call-consent.ts`; learning/09); voice-note retention
from Pally (learning/11).

## Alternatives rejected
Voice deferred entirely (voice notes are most of the everyday value); API speech by default
(audio would leave the box); spoken replies on by default or whenever a voice note arrives (some
owners send voice but read replies); one fixed approval strictness for every owner; full-duplex
calls without echo cancellation (the agent hears itself).

## Consequences
_TODO: fill in as implementation reveals them._
