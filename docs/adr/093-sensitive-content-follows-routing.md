# ADR-093: Sensitive content follows the owner's routing; privacy comes from local models, not withholding

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
ADR-023 gave record types a sensitivity level that "keeps health and money on local-only
models where one qualifies", while ADR-024 puts code-computed budget and tracker values into
every main-session prompt, and the hybrid default runs the main session on an API model.
ADR-078 made documents follow the owner's routing. The marking method and the roles that read
files were not defined (OQ-78).

## Decision
**One rule.** Records, files, photos, and lines at the `sensitive` level follow the owner's
routing for the role that reads them, like documents (ADR-078). The main session sees and can
answer about any of the owner's data, whatever its level. There is no mode that withholds
sensitive content from a prompt.

**Privacy is routing.** An owner who wants sensitive data to stay on the host makes the roles
local-only, or routes content marked sensitive to a chosen model (ADR-011, ADR-066, ADR-078).
`jaari init` says this once.

**What the level still does.** Canonicalize leaves sensitive lines out of an API batch (ADR-047);
health records are never archived (ADR-023); routing rules can match the label.

**Marking.** Detection never sends content to an API model:
- record types declare their level (health, ledger and other money types, identity documents);
- deterministic rules: Luhn-valid card numbers, IBANs, identity-number formats, health and
  finance keywords, file name and MIME patterns (the ADR-081 rule set);
- the `classify` role only when it runs on a qualified local model; otherwise rules only;
- the owner marks or unmarks any file, photo, or memory line in chat or in the panel.

**Roles that read files.** `reader` for extracted text (untrusted, ADR-038), `vision` for images
and scanned pages (ADR-066), `summarize` for document summaries; all through normal routing.

## Alternatives rejected
Keeping health and money local-only by default (an API main session could not answer the
owner's own questions); a setting that withholds sensitive content from API prompts (privacy
belongs in routing, where the owner sets it once); classifying sensitivity with an API model.

## Consequences
_TODO: fill in as implementation reveals them._
