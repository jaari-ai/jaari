# ADR-118: The owner config: one JSONC file under `~/.jaari`, versioned, closed at the top, read through `@jaari/core/config`

- **Status:** Accepted
- **Date:** 2026-11-17

## Context
ADR-056 says `jaari init` writes versioned config, and ADR-088 says `jaari secret set` stores a
value in `os-keychain` or `host-credential`. Building roadmap 0.6 showed what neither decides:
where the files live, which package reads the config, how a section of a feature that is not
built yet is treated, and where `jaari secret set` writes a `host-credential` file (the provider
of ADR-079 only reads a folder that a service manager supplies).

## Decision
- **One folder per install: `~/.jaari`.** It holds `config.jsonc`, `data/` (mode 0700: the
  transcript, logs, and the CLI socket), and `credentials/`. `jaari-daemon`, `jaari init`, and
  `jaari secret set` take `--home <dir>` to use another folder; `--config`, `--data`, and
  `--credentials` still override one path each.
- **The file is JSONC**, read with `jsonc-parser` (MIT, no dependencies of its own): comments
  and trailing commas are allowed, and a syntax error names its line and column.
- **A schema version.** `version` is required. A config newer than the binary is refused
  (ADR-056); an older one is migrated forward in memory by one step per version.
- **Closed at the top, strict where it is read.** An unknown key anywhere in a checked section is
  an error that names the key. The sections this version reads (`version`, `deployment`,
  `secrets`, `limits`, `events`) are checked in full; `llm` is checked by `@jaari/llm`. A section
  of a feature that is not built yet (`owner`, `channels`, `persona`, `shadow`, `memory`, `web`,
  `egress`, `backup`, `secrets.vault`) is accepted by name and checked when its feature ships.
- **Home.** The loader is `@jaari/core/config`, a subpath of `@jaari/core` (ADR-086: no new
  package without a new process or trust boundary). The subpath lets the `jaari` command read the
  config without loading the agent loop.
- **`secrets.credentialsDir`** names the folder of `host-credential` files when no service
  manager supplies one. `jaari secret set` writes there and the daemon reads there; the default
  is `~/.jaari/credentials`, a sibling of the data folder, never inside it (ADR-079). The daemon
  takes the folder from `--credentials`, then `$CREDENTIALS_DIRECTORY` (systemd), then this key.
  Compose passes `--credentials /run/secrets`. `jaari secret set --config <file>` reads the same file the
  daemon was given, and `jaari init` refuses a folder inside the data folder before writing.
- **`jaari secret set <name>`** needs a person at a terminal (ADR-076), reads the value with no
  echo, and never takes it as an argument. For `host-credential` it writes `<folder>/<name>` at
  mode 0600 through a temporary file and a rename.
- **`jaari init` in Phase 0** asks for the target (ADR-017), where secrets are kept (ADR-079), and
  one model provider. Running it again revisits every step with the current value as the default
  and keeps the owner's comments. Later steps arrive with their features.

## Alternatives rejected
- **The XDG folders** (`~/.config/jaari`, `~/.local/share/jaari`): two places to back up and
  move, and unfamiliar on macOS.
- **A hand-written comment stripper:** it must not touch `//` inside a string such as a URL;
  the parser already handles that and reports positions.
- **A new `@jaari/config` package:** no process or trust boundary separates it from core.
- **Refusing every section not read yet:** the example config and `jaari init` could not carry
  the owner's choices forward. **Accepting any unknown key:** a typo would be silently ignored.
- **`host-credential` files inside the data folder:** a backup or a leak of the data folder would
  carry the keys (ADR-079).

## Consequences
- Not built yet, and scheduled: the check of a package's own config section against the schema in
  its manifest (ADR-109) arrives with the first package that declares one (roadmap 2.8);
  `jaari config` as its own command and the `compose.yaml` that init writes arrive with install
  (roadmap 0.12); the LLM presets, the budget question, and local-model qualification arrive with
  `jaari llm eval` (roadmap 1.9); encrypted systemd credentials are set up by `jaari service
  install` (roadmap 0.12).
- The example config is loaded by a test, so it cannot drift from the schema.
