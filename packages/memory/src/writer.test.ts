import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openMemory, type Change } from "./writer.js";

const OWNER = "11111111-1111-4111-8111-111111111111";
let root: string, dir: string, dbPath: string, seen: { type: string }[];
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "jaari-memory-"));
  dir = join(root, "memory");
  dbPath = join(root, "memory.db");
  seen = [];
});
afterEach(() => rm(root, { recursive: true, force: true }));

const open = () => openMemory({ dir, dbPath, ownerId: OWNER, events: { write: (event) => void seen.push(event) } });
const git = (...args: string[]) => execFileSync("/usr/bin/git", ["-C", dir, ...args], { encoding: "utf8" }).trim();
const fact = (text: string, extra: Partial<Change> = {}): Change => ({ files: [{ path: "profile/owner.md", content: text }], message: "Note a fact", actor: "capture", session: "s-1", ...extra });
const intents = () => {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare("SELECT id, state, change, reason FROM intent ORDER BY at").all() as { id: string; state: string; change: string; reason: string | null }[];
  } finally {
    db.close();
  }
};

describe("the memory writer (ADR-026)", () => {
  it("commits a change with its trailers, keeps the files private, and marks the intent done", async () => {
    const memory = await open();
    const outcome = await memory.submit(fact("- Likes tea (2026-11-21, s-1)\n"));
    expect(outcome).toMatchObject({ ok: true });
    if (!outcome.ok) return;
    expect(await readFile(join(dir, "profile/owner.md"), "utf8")).toBe("- Likes tea (2026-11-21, s-1)\n");
    expect(git("log", "-1", "--format=%B")).toBe(`Note a fact\n\nJaari-Mutation-Id: ${outcome.mutationId}\nJaari-Actor: capture\nJaari-Session: s-1`);
    expect(outcome.commit).toBe(git("rev-parse", "HEAD"));
    expect((await stat(dir)).mode & 0o777).toBe(0o700);
    expect((await stat(join(dir, "profile/owner.md"))).mode & 0o777).toBe(0o600);
    expect(intents()).toEqual([{ id: outcome.mutationId, state: "done", change: "", reason: null }]); // the payload is dropped once done
    await memory.close();
  });

  it("appends, removes, and applies changes one at a time in the order they came", async () => {
    const memory = await open();
    const day = (line: string): Change => ({ files: [{ path: "daily/2026-11-21.md", append: line }], message: "Log", actor: "capture" });
    const all = await Promise.all(["a\n", "b\n", "c\n"].map((line) => memory.submit(day(line))));
    expect(all.every((outcome) => outcome.ok)).toBe(true);
    expect(await readFile(join(dir, "daily/2026-11-21.md"), "utf8")).toBe("a\nb\nc\n");
    expect(await memory.submit({ files: [{ path: "daily/2026-11-21.md", remove: true }, { path: "never/was.md", remove: true }], message: "Drop", actor: "audit" })).toMatchObject({ ok: true });
    expect(git("ls-files")).toBe("");
    await memory.close();
  });

  it("refuses a secret, a binary file, a file over 1 MiB, and a path outside the repo, and writes nothing (ADR-028, ADR-100)", async () => {
    const memory = await open();
    const cases: [Change, string][] = [
      [fact("The key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789\n"), "contains a secret (api key)"],
      [fact("password: hunter2 is the wifi\n"), "contains a secret (password)"],
      [fact("PNG\0\0\0"), "is a binary file"],
      [fact("x".repeat(1024 * 1024 + 1)), "is over 1 MiB"],
      [{ ...fact(""), files: [{ path: "../outside.md", content: "x" }] }, "is not a path inside the memory repo"],
      [{ ...fact(""), files: [{ path: ".git/config", content: "x" }] }, "is not a path inside the memory repo"],
      [{ ...fact(""), files: [{ path: "/etc/passwd", content: "x" }] }, "is not a path inside the memory repo"],
    ];
    for (const [change, why] of cases) {
      const outcome = await memory.submit(change);
      expect(outcome).toMatchObject({ ok: false });
      expect(!outcome.ok && outcome.reason).toContain(why);
    }
    expect(await memory.head()).toBeUndefined(); // no commit at all
    expect(intents()).toEqual([]); // refused before an intent is recorded
    expect(seen.filter((event) => event.type === "memory.refused")).toHaveLength(7);
    // An append that would grow a file past the limit is refused too.
    await memory.submit({ files: [{ path: "daily/big.md", content: "x".repeat(1024 * 1024 - 1) }], message: "Big", actor: "capture" });
    expect(await memory.submit({ files: [{ path: "daily/big.md", append: "yy" }], message: "More", actor: "capture" })).toMatchObject({ ok: false, reason: "daily/big.md would be over 1 MiB" });
    await memory.close();
  });

  it("commits the owner's own edits first, as the owner, and leaves out a file that may not enter git", async () => {
    const memory = await open();
    await memory.submit(fact("- Likes tea\n"));
    await writeFile(join(dir, "profile/owner.md"), "- Likes coffee\n"); // the owner corrects it by hand
    await mkdir(join(dir, "files"));
    await writeFile(join(dir, "files/photo.jpg"), Buffer.from([0xff, 0xd8, 0, 0]));
    expect(await memory.submit({ files: [{ path: "people/sam.md", content: "- Sam is a friend\n" }], message: "Note Sam", actor: "capture" })).toMatchObject({ ok: true });
    expect(git("log", "--format=%s|%(trailers:key=Jaari-Actor,valueonly)").split("\n").map((line) => line.trim()).filter(Boolean)).toEqual(["Note Sam|capture", "The owner's edits|owner", "Note a fact|capture"]);
    expect(git("show", "HEAD~1:profile/owner.md")).toBe("- Likes coffee");
    expect(git("ls-files")).not.toContain("photo.jpg");
    expect(seen).toContainEqual(expect.objectContaining({ type: "memory.owner_edit_refused", path: "files/photo.jpg" }));
    await memory.close();
  });

  it("refuses a change made against a commit when one of its files changed since, so it is redone, not merged", async () => {
    const memory = await open();
    const first = await memory.submit(fact("- Likes tea\n"));
    if (!first.ok) throw new Error("setup");
    await memory.submit(fact("- Likes green tea\n"));
    const late = await memory.submit(fact("- Likes tea, folded\n", { base: first.commit, actor: "canonicalize" }));
    expect(late).toMatchObject({ ok: false });
    expect(!late.ok && late.reason).toMatch(/^conflict: profile\/owner.md changed since /);
    expect(await readFile(join(dir, "profile/owner.md"), "utf8")).toBe("- Likes green tea\n");
    // Another file is not a conflict.
    expect(await memory.submit({ files: [{ path: "people/sam.md", content: "x\n" }], message: "Sam", actor: "canonicalize", base: first.commit })).toMatchObject({ ok: true });
    await memory.close();
  });

  it("after a crash, finds a committed intent by its mutation id, completes one that was not, and quarantines one that cannot be done, never deleting it", async () => {
    const memory = await open();
    const committed = await memory.submit(fact("- Likes tea\n"));
    await memory.close();
    if (!committed.ok) throw new Error("setup");
    // Three crashes, written as the journal would hold them: after the commit, before it, and a change that cannot apply.
    const db = new DatabaseSync(dbPath);
    db.prepare("UPDATE intent SET state = 'pending', change = ? WHERE id = ?").run(JSON.stringify(fact("- Likes tea\n")), committed.mutationId);
    db.prepare("INSERT INTO intent VALUES (?, 'b-pending', '2026-11-21T10:00:01Z', ?, 'pending', NULL)").run(OWNER, JSON.stringify({ files: [{ path: "people/sam.md", content: "- Sam\n" }], message: "Note Sam", actor: "capture" }));
    db.prepare("INSERT INTO intent VALUES (?, 'c-broken', '2026-11-21T10:00:02Z', ?, 'pending', NULL)").run(OWNER, JSON.stringify({ files: [{ path: "profile/owner.md/inside", content: "x" }], message: "Bad", actor: "capture" }));
    db.close();
    await writeFile(join(dir, "people-half.md"), ""); // nothing here is Jaari's: it must not be taken into a recovered commit

    const again = await open();
    const rows = Object.fromEntries(intents().map((row) => [row.id, row]));
    expect(rows[committed.mutationId]).toMatchObject({ state: "done" });
    expect(rows["b-pending"]).toMatchObject({ state: "done" });
    expect(rows["c-broken"]).toMatchObject({ state: "quarantined" });
    expect(rows["c-broken"]!.change).toContain("profile/owner.md/inside"); // kept, with what it wanted to write
    expect(git("log", "--format=%s")).toBe("Note Sam\nNote a fact"); // the found one was not committed twice
    expect(git("show", "HEAD", "--name-only", "--format=")).toBe("people/sam.md");
    expect(seen.map((event) => event.type).sort()).toEqual(["memory.quarantined", "memory.recovered", "memory.recovered"]);
    await again.close();
  });

  it("never runs a hook, an fsmonitor, or a signing program that the repo's own config names (ADR-132)", async () => {
    const memory = await open();
    await memory.submit(fact("- first\n"));
    const marker = join(root, "ran");
    const script = join(root, "evil.sh");
    await writeFile(script, `#!/bin/sh\ntouch ${marker}\n`);
    await chmod(script, 0o755);
    await writeFile(join(dir, ".git/hooks/pre-commit"), `#!/bin/sh\ntouch ${marker}\n`);
    await chmod(join(dir, ".git/hooks/pre-commit"), 0o755);
    git("config", "core.fsmonitor", script);
    git("config", "core.hooksPath", join(dir, ".git/hooks"));
    git("config", "commit.gpgSign", "true"); // signing would run gpg.program at every commit
    git("config", "gpg.program", script);
    await writeFile(join(dir, "profile/owner.md"), "- edited by hand\n"); // so status and an owner commit run too
    expect(await memory.submit(fact("- second\n"))).toMatchObject({ ok: true });
    expect(await stat(marker).then(() => true, () => false)).toBe(false);
    await memory.close();
  });
});
