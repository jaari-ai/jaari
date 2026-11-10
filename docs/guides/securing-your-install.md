# Securing your install: what Jaari protects, what it cannot, and your choices

For owners running Jaari on a VPS, a remote server, home hardware, or a laptop (ADR-017).
This page explains the trade-offs behind the defaults so you can decide how far to go. Design
decisions: [SECURITY_MODEL.md](../SECURITY_MODEL.md), ADR-027 (backup), ADR-028 (encryption).

## What runs where, and who can read it

| Where Jaari runs | Who else could read your memory | What helps |
|---|---|---|
| Home hardware you own | Anyone with physical access to the box | Full-disk encryption; a locked room; the box on the overlay network only |
| Laptop | Anyone who gets the laptop unlocked, or the disk if unencrypted | FileVault or BitLocker or LUKS (usually on by default on recent laptops) |
| VPS or rented server | The provider can technically read the VM's disk and memory | Pick a provider you trust; full-disk encryption protects only against disk snapshots and discarded drives, not a running-host compromise |

The daemon must read your memory to do its work, so the key is on the machine while Jaari
runs. No setting inside Jaari changes that. If that is not acceptable for your data, run
Jaari on hardware you own.

## Encrypting the host disk

Jaari relies on full-disk encryption and `jaari doctor` reports whether it can see it.

**Optional: an encrypted data folder with a passphrase unlock** (for example LUKS on a separate
volume, or gocryptfs for one folder). Jaari does not set this up for you. Trade-offs if you do:

| You gain | You give up |
|---|---|
| A VPS disk snapshot or a stolen drive shows nothing, even if the provider's disk encryption is weak | Jaari cannot start unattended: after every reboot, crash, or provider maintenance you must unlock the folder before the daemon runs |
| Protection when the machine is off | Missed routines and reminders while it waits (ADR-025 catch-up covers up to the configured window) |
| | One more passphrase to keep safe; losing it loses the data that has not been backed up |

Point Jaari's data directory at the unlocked mount and start the daemon after unlocking.

## Backups and remotes

| Remote mode | What the storage provider can see | Use it for |
|---|---|---|
| Age-encrypted bundles (default) | Nothing but encrypted blobs and their size | S3, Cloudflare R2, Backblaze B2, MinIO, any bucket |
| `git-remote-gcrypt` | Nothing but encrypted objects | GitHub, GitLab, or another hosted git provider |
| Plain git push | Everything | Only a NAS or device you own, over Tailscale or your LAN |

`git-crypt` is not offered for hosted remotes: it hides file contents but leaves file names
(`people/dr-smith.md`), commit messages, and history visible.

## Your recovery key

`jaari init` creates an age key for backups. Keep it outside Jaari: on paper, or in your own
password manager (not the vault Jaari reads from). Without it no backup can be opened, by you
or anyone else. Two copies in different places is sensible.

## If a secret ends up in memory

Jaari scans every memory write for keys, tokens, card numbers, and passwords and asks before
storing a hit. If something still gets through, `jaari memory purge` rewrites history locally
and on every remote. It cannot reach clones or copies made outside Jaari, so rotate the secret
as well.

## Checklist

- [ ] Full-disk encryption on the host (`jaari doctor` shows it).
- [ ] At least one backup off the host (ADR-027); `jaari doctor` warns otherwise.
- [ ] Recovery key stored in two places outside Jaari.
- [ ] Remotes you do not own use encrypted bundles or gcrypt.
- [ ] No public ports; the panel reached over Tailscale (ADR-017).
