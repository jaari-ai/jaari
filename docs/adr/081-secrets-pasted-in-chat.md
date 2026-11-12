# ADR-081: Secrets pasted in chat: scrubbed at channel ingress, never kept, rotation advised

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
ADR-028 blocks a memory write that contains a secret and asks the owner; ADR-074 writes the
owner's turns verbatim to the daily log; ADR-065 stores and backs up the transcript with no scan
stated. Only one-time codes were settled: ADR-055 replaces a pasted code with "[code used]"
before any model sees it (OQ-69).

Pally removes a pasted key before storage and suggests rotation (`docs/learning/11-pally.md`).
gajae-way scrubs outbound chat by known credential formats and by exact values it holds,
including encodings (`refs/gajae-way/docs/architecture.md`, commit `34cbd15`).

## Decision
**Scrub at channel ingress.** Every owner message is scanned when the channel adapter hands it
to the daemon, before the transcript, the raw daily log, or any model sees it. ADR-074's
verbatim capture and ADR-065's transcript store the scrubbed text. Voice notes are scanned on
their speech-to-text output, before storage.

**Detection is deterministic code**, from rules that exist: the ADR-028 pattern scan limited to
known formats (provider keys, tokens, PEM private keys, JWTs, card numbers that pass the Luhn
check); `password: …` style key-value pairs; and the ADR-016 exact-value match against values the
vault holds. Generic high-entropy rules are off, so hashes and ids stay.

**Each hit becomes `[secret removed: <kind>]`.** The value is never kept, not even to offer
saving it. In the same reply Jaari says once what it removed, deletes the owner's message where
the channel manifest supports it (otherwise it notes that the value stays in that app's
history), advises rotating the secret, and offers the panel's single-use secret-entry page
(ADR-067) for a fresh value.

**Unchanged.** ADR-055 codes during a pending code request are one case of this rule and keep
"[code used]". ADR-028's block-and-ask stays for every other memory write (derived facts,
files, imported content).

**Phase.** The ingress scan ships with the first channel (the CLI channel, Phase 0).

**Left over.** A bare password with no label cannot be recognised and is stored.

## Alternatives rejected
Blocking the message and asking (the value is already in the transcript path and the chat
app); keeping it verbatim; holding the value briefly to offer "save to vault" (it has already
leaked through the chat app, so a fresh one is safer); generic entropy rules (remove hashes and
ids).

## Consequences
_TODO: fill in as implementation reveals them._
