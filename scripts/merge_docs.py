#!/usr/bin/env python3
"""merge_docs.py: merge Jaari's docs into one compact Markdown file for AI discussions.

The output (default JAARI_CONTEXT.md at the repo root) is git-ignored and overwritten on
every run. Give it to an AI agent to discuss the project with the full docs in context.

  python3 scripts/merge_docs.py                write JAARI_CONTEXT.md
  python3 scripts/merge_docs.py --out PATH     write somewhere else (PATH is overwritten)
  python3 scripts/merge_docs.py --code         also include packages/ and apps/ sources
  python3 scripts/merge_docs.py --check        only validate the docs; write nothing

--check verifies relative links, the ADR index and ACTION_PLAN table against the ADR files,
OQ-NN references, and the open-question counts in OPEN_QUESTIONS.md and STATE.md.
It exits 1 on any problem. Standard library only. It reads refs/INDEX.md and never writes
under refs/.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "JAARI_CONTEXT.md"

# Merge order: orientation first, then designs, then plan, then decisions, then history.
FIRST = [
    "README.md", "AGENTS.md",
    "docs/STATE.md", "docs/ARCHITECTURE.md", "docs/SECURITY_MODEL.md", "docs/LLM.md",
    "docs/WEB.md", "docs/MEMORY.md", "docs/PERSONA.md", "docs/INTEGRATIONS.md",
    "docs/ROADMAP.md", "docs/ACTION_PLAN.md", "docs/OPEN_QUESTIONS.md", "docs/DEVELOPMENT.md",
    "docs/adr/README.md",
]
LAST = ["docs/00-research.md", "docs/01-merge-plan.md"]
EXTRA_FILES = ["jaari.config.example.jsonc", "refs/INDEX.md"]
SKIP = {"CLAUDE.md"}  # only imports AGENTS.md
CODE_DIRS = ["packages", "apps"]
CODE_EXT = {".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".yaml", ".yml"}
CODE_SKIP_PARTS = {"node_modules", "dist", "build", ".turbo", "coverage"}
MAX_CODE_BYTES = 100_000


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def doc_files() -> list[str]:
    docs = sorted(str(p.relative_to(ROOT)) for p in (ROOT / "docs").rglob("*.md"))
    ordered = [f for f in FIRST if (ROOT / f).exists()]
    tail = [f for f in LAST if (ROOT / f).exists()]
    middle = [f for f in docs if f not in ordered and f not in tail and f not in SKIP]
    return ordered + middle + tail


# ───────────────────────────── compaction ─────────────────────────────

def compact(rel: str, text: str) -> str:
    """Drop what an agent does not need: comments, placeholders, duplicate tables, blank runs."""
    text = re.sub(r"<!--.*?-->\n?", "", text, flags=re.S)
    if re.match(r"docs/adr/\d{3}-", rel):
        text = re.sub(r"\n## Consequences\n_TODO: fill in as implementation reveals them\._\n?", "\n", text)
    if rel == "docs/ACTION_PLAN.md":
        text = re.split(r"\n## ADRs\n", text)[0] + "\n(ADR table: see docs/adr/README.md.)\n"
    lines = [ln.rstrip() for ln in text.splitlines()]
    out: list[str] = []
    in_fence = False
    for ln in lines:
        if ln.lstrip().startswith(("~~~", "```")):
            in_fence = not in_fence
        if not ln and out and not out[-1] and not in_fence:
            continue
        out.append(ln)
    return "\n".join(out).strip() + "\n"


# ───────────────────────────── repo context ─────────────────────────────

def git(*args: str) -> str:
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def repo_tree() -> list[str]:
    files = git("ls-files", "--cached", "--others", "--exclude-standard").splitlines()
    return sorted(f for f in files if f != DEFAULT_OUT.name and not f.startswith("refs/"))


def code_files() -> list[str]:
    found = []
    for d in CODE_DIRS:
        base = ROOT / d
        if not base.is_dir():
            continue
        for p in sorted(base.rglob("*")):
            rel = p.relative_to(ROOT)
            if not p.is_file() or CODE_SKIP_PARTS & set(rel.parts):
                continue
            if p.suffix in CODE_EXT and p.stat().st_size <= MAX_CODE_BYTES:
                found.append(str(rel))
    return found


def build(include_code: bool) -> str:
    sections: list[tuple[str, str]] = []
    for rel in doc_files() + [f for f in EXTRA_FILES if (ROOT / f).exists()]:
        if rel not in {s[0] for s in sections}:
            sections.append((rel, compact(rel, read(rel))))
    if include_code:
        sections += [(rel, compact(rel, read(rel))) for rel in code_files()]

    branch = git("rev-parse", "--abbrev-ref", "HEAD") or "unknown"
    commit = git("rev-parse", "--short", "HEAD") or "unknown"
    dirty = " (uncommitted changes)" if git("status", "--porcelain") else ""
    total_chars = sum(len(body) for _, body in sections)
    index = "\n".join(f"- {rel} ({len(body):,} chars)" for rel, body in sections)
    tree = "\n".join(repo_tree())
    parts = [
        f"""# Jaari: merged project context

Built by `scripts/merge_docs.py` from branch `{branch}` at `{commit}`{dirty}. Untracked; overwritten on every run.
About {total_chars:,} characters (roughly {total_chars // 4:,} tokens).

## How to use this file
You are discussing the Jaari project with its owner. Everything below is the project's
documentation and design context. Treat it as the source of truth: cite ADR and OQ ids,
say when something is undecided (open question) or only a leaning, and flag any conflict
you notice between files. Each file is wrapped in `<file path="...">` tags. ADR statuses
are in docs/adr/README.md; open questions and their leanings are in docs/OPEN_QUESTIONS.md;
what is built is in docs/STATE.md (check it first). `refs/` holds read-only reference
repos that are not included here, only their pinned versions (refs/INDEX.md).

## Files included
{index}

## Repository tree (tracked and untracked, excluding refs/)
~~~text
{tree}
~~~
"""
    ]
    for rel, body in sections:
        parts.append(f'\n<file path="{rel}">\n{body}</file>\n')
    return "".join(parts)


# ───────────────────────────── checks ─────────────────────────────

def table_rows(text: str) -> list[list[str]]:
    rows = []
    for ln in text.splitlines():
        if ln.startswith("|") and not re.match(r"^\|\s*-", ln):
            rows.append([c.strip() for c in ln.strip().strip("|").split("|")])
    return rows


def check() -> list[str]:
    errors: list[str] = []
    files = doc_files() + ["CLAUDE.md"]
    texts = {f: read(f) for f in files if (ROOT / f).exists()}

    # 1. relative links resolve
    for f, t in texts.items():
        body = re.sub(r"(~~~|```).*?\1", "", t, flags=re.S)  # ignore code blocks
        body = re.sub(r"`[^`\n]*`", "", body)  # and inline code
        for m in re.finditer(r"\]\((?!https?:|mailto:|#)([^)\s#]+)", body):
            if not (ROOT / f).parent.joinpath(m.group(1)).resolve().exists():
                errors.append(f"{f}: broken link {m.group(1)}")

    # 2. ADR files vs the two index tables, titles and statuses
    adr_files = {p.name: read(f"docs/adr/{p.name}") for p in sorted((ROOT / "docs/adr").glob("[0-9][0-9][0-9]-*.md"))}
    truth = {}
    for name, t in adr_files.items():
        title = re.search(r"^# ADR-\d+: (.*)$", t, re.M)
        status = re.search(r"^- \*\*Status:\*\* (.*)$", t, re.M)
        if not title or not status:
            errors.append(f"docs/adr/{name}: missing title or status line")
            continue
        truth[name] = (title.group(1).strip(), status.group(1).strip())
    for index in ("docs/adr/README.md", "docs/ACTION_PLAN.md"):
        seen = {}
        for r in table_rows(texts[index]):
            m = re.match(r"\[(\d+)\]\(([^)]+\.md)\)", r[0]) if r else None
            if m and len(r) >= 3:
                seen[Path(m.group(2)).name] = (r[1], r[2])
        for name, ts in truth.items():
            if name not in seen:
                errors.append(f"{index}: ADR {name} missing from the table")
            elif seen[name] != ts:
                errors.append(f"{index}: {name} row {seen[name]} differs from file {ts}")
        for name in seen:
            if name not in truth:
                errors.append(f"{index}: lists {name} but the file does not exist")

    # 3. open questions: ids, references, counts
    oq = texts["docs/OPEN_QUESTIONS.md"]
    open_part, _, resolved_part = oq.partition("\n## Resolved")
    open_ids = re.findall(r"^\| (OQ-\d+) \|", open_part, re.M)
    resolved_ids = {i for i in re.findall(r"^\| (OQ-\d+)", resolved_part, re.M)}
    if len(open_ids) != len(set(open_ids)):
        errors.append("docs/OPEN_QUESTIONS.md: duplicate open question id")
    known = set(open_ids) | resolved_ids
    for f, t in texts.items():
        for m in re.finditer(r"OQ-(\d+)(?:\s+to\s+OQ-(\d+))?", t):
            lo, hi = int(m.group(1)), int(m.group(2) or m.group(1))
            for n in range(lo, hi + 1):
                if f"OQ-{n:02d}" not in known:
                    errors.append(f"{f}: references OQ-{n:02d} which is neither open nor resolved")
    m = re.search(r"Open: \*\*(\d+)\*\*", oq)
    if not m or int(m.group(1)) != len(open_ids):
        errors.append(f"docs/OPEN_QUESTIONS.md: header says {m.group(1) if m else '?'} open, found {len(open_ids)}")
    m = re.search(r"^(\d+) open\.", texts["docs/STATE.md"], re.M)
    if not m or int(m.group(1)) != len(open_ids):
        errors.append(f"docs/STATE.md: says {m.group(1) if m else '?'} open, found {len(open_ids)}")

    # 4. leftovers of the removed generator
    for f, t in texts.items():
        if "make_docs" in t:
            errors.append(f"{f}: still mentions the removed make_docs script")
    return sorted(set(errors))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output file (overwritten)")
    ap.add_argument("--code", action="store_true", help="include packages/ and apps/ sources")
    ap.add_argument("--check", action="store_true", help="validate docs only; write nothing")
    args = ap.parse_args()

    errors = check()
    for e in errors:
        print(f"error: {e}", file=sys.stderr)
    if args.check:
        print("docs check: ok" if not errors else f"docs check: {len(errors)} problem(s)")
        return 1 if errors else 0

    out = args.out if args.out.is_absolute() else Path.cwd() / args.out
    if out.resolve().is_relative_to(ROOT / "refs"):
        print("error: refusing to write under refs/", file=sys.stderr)
        return 2
    content = build(args.code)
    out.write_text(content, encoding="utf-8")
    print(f"wrote {out} ({len(content):,} chars, about {len(content) // 4:,} tokens)")
    if errors:
        print(f"warning: {len(errors)} docs problem(s) above; the file was still written", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
