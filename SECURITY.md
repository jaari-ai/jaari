# Security policy

Jaari is a self-hosted agent with one owner. It runs on the owner's machine, with the owner's
accounts and secrets. Its main safety promise is that no external effect happens without the
owner's approval, and that approval is bound to a digest of the exact action
([docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md)). A report that breaks that promise is the
kind we most want to hear about.

## Report a vulnerability

Report privately. Do not open a public issue, discussion, or pull request.

1. Preferred: GitHub private vulnerability reporting, on the repository's
   [Security tab](https://github.com/jaari-ai/jaari/security/advisories/new).
2. Or email `hello@jaari.org` with "security" in the subject.

Please include:
- what the issue is and what an attacker can do with it;
- steps to reproduce, a proof of concept, or logs (remove any real secrets);
- the version, commit, and configuration you tested;
- any mitigation you know of.

## What happens next

- We acknowledge your report within 7 days.
- We aim to ship a fix or publish an advisory within 90 days.

## Scope

In scope:
- the approval gate and action digests: an effect that runs without a matching approval;
- secret handling: a `secretRef:` value that leaks into logs, prompts, memory, or the model;
- a bypass of the tool-less reader role or of the fencing around untrusted content;
- an escape from the code-execution sandbox ([ADR-036](docs/adr/036-code-execution.md));
- an authentication bypass in a channel or in the owner panel;
- the update and release chain: packages, tags, and the release workflow.

Out of scope:
- attacks that need the owner's machine to be already compromised;
- a model that says something wrong, when nothing crosses the gate;
- third-party MCP servers and skills;
- configuration the owner chose, for example turning off local-only reading.

## Supported versions

During 0.x, only the latest release receives security fixes.
