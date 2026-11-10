# ADR-028: Encryption at rest: prevent secrets in memory, encrypt every remote you do not control, purge on demand

- **Status:** Accepted
- **Date:** 2026-11-10

## Decision
**Limit stated up front.** The daemon must read memory to work, so the key is on the host
while it runs. App-level encryption on the host cannot protect against whoever controls the
running machine (including a VPS provider). It protects only against a stolen or discarded
disk or a disk snapshot, which full-disk encryption already covers.

**1. Prevention.** Every memory write goes through the ADR-016 secret scrubber and a pattern
scan for keys, tokens, card numbers, and passwords (gitleaks-style rules). A hit blocks that
write and asks the owner.

**2. Host.** Jaari relies on the host's full-disk encryption and checks for it in `jaari doctor`
where it can tell. Memory and data directories are mode 0700, files 0600. Jaari does not manage
an encrypted volume; owners who want one (for example LUKS or gocryptfs with a passphrase
unlock) set it up themselves, and the trade-offs are documented in
`docs/guides/securing-your-install.md`.

**3. Remotes, chosen per remote** (the method ADR-027 left open):
- **Age-encrypted git bundles** (default for storage the owner does not control: S3, R2, B2,
  hosted buckets). Hides contents, file names, commit messages, and history; reuses the ADR-027
  recovery key.
- **`git-remote-gcrypt`** for a hosted git provider such as GitHub or GitLab. Hides everything;
  uses GPG and re-uploads more per push.
- **Plain push** only to a remote the owner marks as their own (a NAS or device over the
  overlay network); `jaari doctor` reminds the owner once.
- `git-crypt` is not offered for third-party hosts: it leaves file names, commit messages, and
  history shape visible.

**4. Purge.** `jaari memory purge <pattern | file | commit>` runs through the single writer
(ADR-026): it rewrites history with `git filter-repo`, replaces history on every remote
(force-push, or a new bundle chain), rebuilds the FTS index, records the purge in the audit log
without the purged text, and tells the owner that clones or copies outside Jaari cannot be
reached. OQ-09 may use it for true erasure.

## Alternatives rejected
App-level encryption of memory on the host (the running daemon holds the key, so it adds
complexity without stopping a host compromise); a Jaari-managed passphrase-unlocked volume
(the owner can do it with standard tools; Jaari documents the trade-off instead); `git-crypt`
for third-party hosts (metadata leaks); unencrypted pushes to third-party storage; no purge
command (a leaked secret would stay in history and every remote).

## Consequences
_TODO: fill in as implementation reveals them._
