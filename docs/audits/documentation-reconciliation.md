# Documentation reconciliation report

Audit date: 2026-11-12. Base commit: `a8e9e1c` (branch `develop`). This is a dated record of
one audit. It is not an authority: the ADRs and the design docs are. Companion map:
[documentation-index.md](documentation-index.md).

## 1. Executive summary

The repository is design-only (Phase 0, no packages). Before the audit it had 78 accepted
ADRs, 0 open questions, and a one-table roadmap, and the docs check passed. The audit found
that the decisions are broadly consistent, but that three things had drifted:

- **Bookkeeping.** Many later ADRs change earlier ones without the `Extended by` line and
  `Amendments` entry that the conventions require. 43 entries were added across 31 ADRs.
- **Summaries.** `STATE.md`, the roadmap, and several design docs still described the state
  before ADR-021 to ADR-078 (for example "open" questions that were decided).
- **Hidden open questions.** "0 open" was true only for the questions that had been asked.
  The audit found 25 real undecided points: 11 conflicts between accepted ADRs, and 14 choices
  that an ADR leaves open or that the plan's ordering forces. They are now OQ-67 to OQ-91.

No accepted decision was changed, and no ADR status was changed. Where two accepted ADRs
disagree, the conflict is recorded as an open question and no winner was chosen.

## 2. Scope and coverage

- Read in full: all 78 ADRs, every file under `docs/`, `README.md`, `AGENTS.md`, `CLAUDE.md`,
  `NOTICE`, the example config, the root build config, `.github/`, `python/`, and both scripts.
- `refs/` (five repos, about 12,800 files): commits and licences checked against
  `refs/INDEX.md`; every cited path checked; not read in bulk. Nothing under `refs/` was
  changed.
- Not read: `JAARI_CONTEXT.md` (a generated copy). No binary documents exist.
- Method: one inventory; four read-only research passes in parallel (core docs and references,
  ADRs, open questions, roadmap); every consequential claim re-checked against the source
  before an edit. One research claim was wrong and was dropped (`.github/CODEOWNERS` is not
  empty; it has one line).
- Not possible here: running `pnpm`, `tsc`, `eslint`, `vitest`, or `python -m build` (nothing
  is installed, and installs were out of scope); checking GitHub, npm, or PyPI settings (no
  network use).

## 3. Major corrections applied

| Area | Change |
|---|---|
| ADRs (31 files) | Added missing `Extended by` links and `Amendments` entries where a later ADR states the change. Decision text and statuses untouched |
| `OPEN_QUESTIONS.md` | 25 new open questions with context; 8 resolved rows corrected (OQ-04, 17, 24, 29, 35, 47, 63, and the OQ-64 part row); original wording of 57 questions restored from git history |
| `ROADMAP.md` | One section per phase with item IDs, needs, status, exit criteria from the ADRs, blocking questions, and gate status |
| `STATE.md` | Rewritten: all 78 ADRs summarised by area, a "Built" section with verified facts, scheduled checks, correct date and count |
| `ACTION_PLAN.md` | Workstreams reordered by dependency (daemon before the CLI channel; open questions first); stale "config this script generates" removed |
| `ARCHITECTURE.md` | Pairing command, group-thread rule without "trust levels", package rows, packaging note for channels, six missing trust boundaries |
| `SECURITY_MODEL.md` | `repo.write` expiry, vault paragraph, pointers to the open vocabulary and egress questions |
| `THREAT_MODEL.md` | Five missing rows (code execution, voice, calendar and contacts, signing key, takeover); ADR-078 reflected; SSRF row cites ADR-016; inbound SPF/DKIM claim removed |
| Other docs | `README.md`, `AGENTS.md`, `CLAUDE.md`, `LLM.md`, `MEMORY.md`, `INTEGRATIONS.md`, `DEVELOPMENT.md`, three guides, four learning notes (pointer lines only), `01-merge-plan.md` (pointer only) |

## 4. Open questions: disposition

Before the audit: 0 open, 66 IDs resolved (OQ-01 to OQ-66). Each was tested against its ADR.

| Class | Count | IDs |
|---|---|---|
| Resolved, nothing left over | 58 | all others (the OQ-04 row and the OQ-64 part row only had wording fixed) |
| Resolved, but part is a scheduled check or reopened as a new question | 4 | OQ-24 (models measured in Phase 1), OQ-29 (1Password check at Phase 3), OQ-33 (registration, outside trigger; row unchanged), OQ-35 (Compose sandbox → OQ-70) |
| Resolved, but a later ADR or another doc disagreed | 4 | OQ-17 (row corrected for ADR-078), OQ-32 (row unchanged; the roadmap phase was corrected), OQ-47 (row points to OQ-83), OQ-63 (row corrected for ADR-037) |
| Still open or obsolete | 0 | none |
| Newly identified | 25 | OQ-67 to OQ-91 |

After the audit: **25 open, 66 resolved**. No ID was reused; none between 01 and 66 is
missing. OQ-57 to OQ-63, OQ-65, and OQ-66 never had an open row, so no original wording exists
for them.

## 5. ADR conflicts and missing decisions

Conflicts between accepted ADRs, each now an open question (no winner chosen):

| Conflict | ADRs | Question |
|---|---|---|
| OAuth token rotation against the never-grantable vault write | 062, 013, 072 | OQ-75 |
| "Sealed" CLI engine runs that have network and a sign-in; 5-minute limit | 077, 036, 031 | OQ-76 |
| Pinned jobs with no expiry against the one grant model | 036, 072, 006, 040 | OQ-77 |
| Sensitivity level against context assembly and document routing | 023, 024, 047, 078 | OQ-78 |
| Secret-scan block against verbatim capture and the stored transcript | 028, 074, 065 | OQ-69 |
| MCP server secrets held for the server's lifetime | 034, 007, 013 | OQ-80 |
| Retention of receipts and the browser action log | 029, 032, 052, 061 | OQ-81 |
| Hosted browser "unless the owner pins it" against the placement rule | 048, 017, 005 | OQ-82 |
| Two meanings of shadow-mode logs; onboarding promise | 051, 052, 068, 070 | OQ-83 |
| Refusal handling against the pinned main session | 011, 019 | OQ-86 |
| MCP client against the single active channel | 022, 076 | OQ-88 |

Reconciled by bookkeeping, because the later ADR states the change: overlap default for
routines (064 over 025), node link (058 over 015), fetch ladder and browser layer (048 and 049
over 012), voice notes in v1 (037 over 020 and 009), hook listener exception (073 over 015 and
017), voice-note audio retention (037 over 038), commit actor `migration` (056 adds to 074),
non-Pi loops for children (077 over 001).

Low-severity items left as written and not turned into questions:

- ADR-072 lists low-risk commitments under `browser.act`; ADR-051 calls every commitment
  `browser.submit`.
- ADR-045 says "no model names in docs or code" and names models as first candidates.
- ADR-043 mentions `jaari doctor --fix`; ADR-032 says `jaari doctor` is read-only, and ADR-056
  runs migrations when a store opens.
- ADR-057's permission matrix has a row for driving the owner's Safari or Chrome; no adapter
  for that exists in ADR-048.
- ADR-076 cites ADR-021 for socket details that ADR-021 does not give; ADR-070 cites ADR-067
  for Telegram; ADR-073 cites ADR-050 for the vault (ADR-013).
- ADR-013's amendment line dates ADR-050's acceptance 2026-11-12; ADR-050 is dated 2026-11-11.
- ADR-016 and ADR-047 had body text edited in place for ADR-077 and ADR-078.
- Ten ADR bodies still point to an OQ id for something a later ADR decided (for example
  ADR-015, 017, 018, 023, 034). The *Resolved* table maps each id to its ADR, so the trace
  holds; only the false statements got an amendment entry (ADR-016, 019, 035).
- `Consequences` is still the template line in all 78 ADRs.
- ADR-038's title still says "sensitive files local-only" (ADR-078 replaced the rule). A
  title is not changed after acceptance.

Settled-sounding statements in design docs that no ADR records: the "hybrid (default)" preset
(`LLM.md`, `WEB.md`); "curiosity and canonicalize use SearXNG only" (`WEB.md`); the channel
cursor-fingerprint rule (`ARCHITECTURE.md`); per-level dial budgets (`PERSONA.md`); the memory
directory layout (`MEMORY.md`, marked "suggested"); default tier per role and the escalation
signals (`LLM.md`); the scope of `repo.write` and `publish` (OQ-91).

## 6. Documentation contradictions and gaps

Evidence ledger for the issues not already listed in section 5. Severity: high, medium, low.
Confidence is "confirmed" unless stated. "Applied" means corrected in this audit.

| ID | Sev. | Files | Issue | Resolution |
|---|---|---|---|---|
| D-01 | high | `STATE.md` | Dated 2026-11-10; summarised 22 of 78 ADRs; called learning notes 10 and 11 "not yet accepted" | Applied |
| D-02 | high | `ARCHITECTURE.md`, `guides/channel-plugins.md` | Channel contract predates ADR-071 (manifest, install, own process, local path) | Packaging note applied; manifest shape is OQ-85 |
| D-03 | high | `AGENTS.md`, `SECURITY_MODEL.md`, `ROADMAP.md` | "All egress through `@jaari/http`" against its Phase 4 placement | Pointer applied; OQ-68 |
| D-04 | high | `scripts/refs.sh`, `AGENTS.md`, `README.md`, `DEVELOPMENT.md` | References described as pinned but follow upstream default branches | Not changed; OQ-84 |
| D-05 | high | ADR-013, ADR-018, ADR-017, ADR-056 | No store for secret zero on a headless server or container | OQ-67 |
| D-06 | high (probable) | `python/`, `guides/namespaces.md`, `release.yml` | `python/` lacks `README.md`, `LICENSE`, and `src/jaari/`; the release build is expected to fail. Not run | Not changed (packaging is out of a docs audit); recorded in `STATE.md` and roadmap item 0.4 |
| D-07 | low | `jaari.config.example.jsonc` | No `channels`, `owner.phones`, `homeSites`, or speech roles; hybrid example with the api-only budget figure ($30, ADR-046 says $20); `web.budget.onExceeded` undefined | Not changed (config file); web budget is OQ-89 |
| D-08 | medium | `guides/namespaces.md` | Does not include enabling private vulnerability reporting (ADR-043) or a ruleset for `develop` | Not changed; needs the owner's choice of protection level |
| D-09 | medium | `THREAT_MODEL.md` | No rows for ADR-036, 037, 039, 054, 055; ADR-078 not reflected | Applied; the "left over" wording is for the owner to review |
| D-10 | medium | `SECURITY_MODEL.md`, ADR-018 | Gated effects and tools without a capability name; `takeover` class unused | Pointer applied; OQ-79 |
| D-11 | medium | `ARCHITECTURE.md` | Package table has no home for 11 decided subsystems; stale rows | Stale rows applied; homes are OQ-90 |
| D-12 | medium | `ARCHITECTURE.md` | Trust-boundary list missed six boundaries from later ADRs | Applied |
| D-13 | medium | `ARCHITECTURE.md` | `jaari channels pair` (ADR-022 says `jaari pair`); "lowest trust level" (no trust tiers in v1) | Applied |
| D-14 | medium | `guides/securing-your-install.md` | "No public ports over Tailscale (ADR-017)"; no word on the gcrypt GPG key | Applied |
| D-15 | medium | `INTEGRATIONS.md`, `LLM.md`, `README.md`, `guides/namespaces.md` | Decided questions described as open (OQ-18, 44, 22) | Applied |
| D-16 | low | `SECURITY_MODEL.md` | `repo.write` listed with the short expiry (ADR-018: only `email.send` and `publish`) | Applied |
| D-17 | low | `MEMORY.md` | Decided line conventions labelled "proposed" | Applied; the `until` suffix stays proposed |
| D-18 | low | `THREAT_MODEL.md` | Claimed inbound SPF/DKIM/DMARC checks; ADR-063 has only an outbound check | Claim removed; whether to check inbound mail is undecided |
| D-19 | low | learning notes 07, 08, 10, 11; `01-merge-plan.md` | "Open" and "proposal" lines with no pointer to the deciding ADRs | Pointer lines applied; bodies untouched |
| D-20 | low | `CLAUDE.md`, `README.md`, `AGENTS.md` | `refs/` lock overstated; layout tables missed `python/`, `.github/`; config keys incomplete | Applied |
| D-21 | low | `WEB.md` | Repeats the egress pool that `SECURITY_MODEL.md` owns (the copies agree today) | Not changed; noted in the index |

Learning-note recommendations that no ADR adopted or rejected (not turned into questions):
node selection when several nodes offer one capability, and naming the node on the approval
card; an "asleep or offline" node state; receipt states `confirmed`, `acknowledged`,
`ambiguous`; per-routine cadence display and hourly cap; how the audit records a commitment the
owner makes during a takeover; `pi-codemode` for tool-orchestration scripts; the source of the
"cannot change tools mid-conversation" model flag; the embedding model; Windows support.

## 7. Roadmap changes and phase mapping

Phase numbers 0 to 8 and "Later" are unchanged. The old roadmap had no item IDs, so no
references needed remapping. The new file's last section lists every move. In short:

- Moved to match an ADR: `jaari llm eval` qualification fixtures, Phase 8 → 1 (ADR-019,
  ADR-045); `mobile` and `residential-proxy` providers, Phase 7 → 6, with `vpn` added (ADR-053).
- Added with the phase the ADR states: CI and the tier-1 smoke test, crash drills, receipts,
  third-party packages, browser signing, container isolation.
- Added where no ADR states a phase (marked *Placement*): daemon and core, namespaces and
  release, correct and forget, owner authentication, Telegram, erase.
- Status: every item is Planned except 0.1 and 0.4 (In progress: files exist), 3.13 (Delivered:
  the threat model), and five items marked Blocked by an open question (0.11, 1.5, 2.9, 4.7,
  6.8). No item is Implemented or Verified; no gate has passed.
- Exit criteria were taken only from statements the ADRs already make. Phase 7 has none
  documented, and the roadmap says so.
- Dependencies that run against the phase order were not resolved by moving items, because an
  accepted ADR states the phase or the choice is the owner's. They are OQ-68 and OQ-71 to OQ-74.

## 8. Security and architecture risks

Before Phase 3 the deny-all gate stub refuses every gated effect (ADR-018), so none of these
allows an unapproved external action. The risks are in ordering and in undecided rules:

1. No place for secret zero on the main hosting target (OQ-67).
2. Network calls in Phases 0 to 3 have no checked egress path (OQ-68).
3. The agent loop, scheduler, and canonicalize run for up to three phases with no pause,
   limits, usage log, secret scan, or backup (OQ-71).
4. A secret typed in chat may be stored and backed up verbatim (OQ-69).
5. The sandbox that code execution, MCP, parsing, and CLI engines rely on has no chosen
   backend on the default install (OQ-70).
6. Three approval rules conflict (OQ-75, OQ-76, OQ-77), and the capability vocabulary has no
   names for some gated effects (OQ-79).
7. Reference commits that citations depend on are not pinned (OQ-84).

## 9. Decisions that need the owner

All 25 are in [OPEN_QUESTIONS.md](../OPEN_QUESTIONS.md) with options and evidence. Suggested
order: first the eight that block Phase 0 (OQ-67, 68, 69, 74, 84, 85, 86, 90); then the
phasing questions (OQ-71, 72, 73); then the approval and privacy conflicts (OQ-75 to OQ-78);
then the rest by blocked phase. Two follow-ups are tasks, not questions: fix `python/` (D-06)
and extend the namespaces guide (D-08).

## 10. Validation

| Check | Result |
|---|---|
| `python3 scripts/merge_docs.py --check` (links, ADR tables, OQ ids and counts) | passes |
| Extra cross-reference script (ADR numbers exist, link text matches target, anchors, `Extended by` equals `Amendments`) | passes; it also lists amendments where the later ADR does not cite the earlier one by number, which are amendments by substance |
| `git diff --check` | clean |
| Diff review: only `docs/`, `README.md`, `AGENTS.md`, `CLAUDE.md` changed; no file under `refs/`, no code, no config | confirmed |
| ADR decision text and statuses unchanged (diff of `docs/adr/` shows only `Extended by` lines and `Amendments` entries) | confirmed |
| Independent read-only review of the result against the task (2026-11-12) | 14 findings (2 medium, 12 low, none high); all fixed, then the checks above were run again |

Limits: no build, lint, or test could run; outside facts (domain, registries, GitHub settings)
were not checked; the exit criteria are quoted from the ADRs and are not yet tied to tests.
