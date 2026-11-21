// The single writer of the memory repo (ADR-026): the only code that changes it. Changes are applied one at a time,
// each up the closure ladder: record the intent, write the files, commit with trailers, mark the intent done. The FTS
// index step joins with structured records (roadmap 1.2). Borrowed design: the closure ladder, mutation-id trailers, and
// quarantine from gajae-way (design only, refs/gajae-way/packages/gateway/src/memory/closure.ts).
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, appendFile, chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { openDatabase, type EventLog, type Migration } from "@jaari/core";
import { scrubSecrets } from "@jaari/channels";
import { GIT, gitIn } from "./git.js";

// `content` writes the whole file, `append` adds to its end (ledgers and daily logs only add, so they never conflict),
// `remove` deletes it. Paths are relative to the repo, with `/`.
export type FileChange = { path: string; content: string } | { path: string; append: string } | { path: string; remove: true };
// `base`: the commit the change was made against. A file changed since then is a conflict: the change is refused and
// redone against the new version, never force-merged (ADR-026).
export type Change = { files: FileChange[]; message: string; actor: string; session?: string; base?: string };
export type Outcome = { ok: true; commit: string; mutationId: string } | { ok: false; reason: string };
export type Memory = { submit(change: Change): Promise<Outcome>; head(): Promise<string | undefined>; close(): Promise<void> };

export const MAX_FILE_BYTES = 1024 * 1024; // ADR-100

export const MEMORY_MIGRATIONS: readonly Migration[] = [
  // 1: the intent journal. `change` is the JSON of the change while it is pending or quarantined, and empty once done.
  (db) =>
    db.exec(`CREATE TABLE intent (owner_id TEXT NOT NULL, id TEXT PRIMARY KEY, at TEXT NOT NULL, change TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('pending', 'done', 'quarantined')), reason TEXT)`),
];

// Why a path or a text may not enter the repo, or undefined. Text only, at most 1 MiB, no secret (ADR-028, ADR-100).
export function refusal(path: string, text?: string | Buffer): string | undefined {
  if (!path || path.startsWith("/") || path.includes("\\") || path.includes("\0") || normalize(path) !== path || path.split("/").some((part) => part === ".." || part === ".git" || part === ""))
    return `${JSON.stringify(path)} is not a path inside the memory repo`;
  if (text === undefined) return undefined;
  const bytes = typeof text === "string" ? Buffer.from(text) : text;
  if (bytes.includes(0)) return `${path} is a binary file; files go in the file store, not in git`;
  if (bytes.length > MAX_FILE_BYTES) return `${path} is over 1 MiB`;
  const kinds = scrubSecrets(bytes.toString("utf8")).kinds;
  return kinds.length > 0 ? `${path} contains a secret (${kinds.join(", ")}); it was not written` : undefined;
}

const trailers = (id: string, change: Change) =>
  `${change.message.trim()}\n\nJaari-Mutation-Id: ${id}\nJaari-Actor: ${change.actor}${change.session ? `\nJaari-Session: ${change.session}` : ""}\n`;

export async function openMemory({ dir, dbPath, ownerId, events }: { dir: string; dbPath: string; ownerId: string; events?: EventLog }): Promise<Memory> {
  await access(GIT, constants.X_OK).catch(() => {
    throw new Error(`memory needs git at ${GIT}; install git`);
  });
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700); // a folder that exists keeps its mode otherwise; memory is private (ADR-028)
  const git = gitIn(dir);
  if (!(await stat(join(dir, ".git")).then(() => true, () => false))) await git(["init", "-q", "-b", "main"]);
  const db = openDatabase(dbPath, ownerId, MEMORY_MIGRATIONS);
  const report = (event: { type: string } & Record<string, unknown>) => events?.write(event);
  const head = () => git(["rev-parse", "HEAD"]).then((out) => out.trim(), () => undefined);

  const record = db.prepare(`INSERT INTO intent VALUES (?, ?, ?, ?, 'pending', NULL)`);
  const done = db.prepare(`UPDATE intent SET state = 'done', change = '' WHERE owner_id = ? AND id = ?`);
  const quarantine = db.prepare(`UPDATE intent SET state = 'quarantined', reason = ? WHERE owner_id = ? AND id = ?`);

  // Writes the files and commits them with the trailers. Every step can run again: a crash anywhere leaves a pending
  // intent, and running it again gives the same files.
  async function apply(id: string, change: Change): Promise<string> {
    for (const file of change.files) {
      const path = join(dir, file.path);
      if ("remove" in file) await rm(path, { force: true });
      else {
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        if ("content" in file) await writeFile(path, file.content, { mode: 0o600 });
        else await appendFile(path, file.append, { mode: 0o600 });
      }
    }
    // A removed file that git never tracked has nothing to unstage, so removals do not go through `add`.
    const removed = change.files.filter((file) => "remove" in file).map((file) => file.path);
    const written = change.files.filter((file) => !("remove" in file)).map((file) => file.path);
    if (removed.length > 0) await git(["rm", "-q", "--cached", "--ignore-unmatch", "--", ...removed]);
    if (written.length > 0) await git(["add", "--", ...written]);
    // Every mutation is a commit, even one that changes nothing, so its id can always be found in git.
    await git(["commit", "-q", "--allow-empty", "-F", "-"], trailers(id, change));
    return (await head())!;
  }

  // Changes Jaari did not make are the owner's: committed first, on their own, with `actor: owner` (ADR-026). A file
  // that may not enter git stays out of the commit and is reported; it is left where it is.
  async function commitOwnerEdits(): Promise<void> {
    const status = await git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    if (!status) return;
    const entries = status.split("\0").filter(Boolean);
    const paths: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      paths.push(entry.slice(3));
      if (entry[0] === "R" || entry[0] === "C") paths.push(entries[++i]!); // -z: a rename's old path is its own entry
    }
    const kept: string[] = [], skipped: string[] = [];
    for (const path of paths) {
      const text = await readFile(join(dir, path)).catch(() => undefined); // a deleted file has nothing to check
      const reason = refusal(path, text);
      if (!reason) {
        kept.push(path);
        continue;
      }
      skipped.push(path);
      report({ type: "memory.owner_edit_refused", path, reason });
    }
    if (kept.length === 0) return;
    await git(["add", "-A", "--", ...kept]);
    await git(["commit", "-q", "-F", "-", "--", ...kept], trailers(randomUUID(), { message: "The owner's edits", actor: "owner", files: [] }));
    report({ type: "memory.owner_edit", commit: await head(), files: kept.length, skipped: skipped.length });
  }

  async function submit(change: Change): Promise<Outcome> {
    await commitOwnerEdits();
    let reason: string | undefined;
    for (const file of change.files) {
      if ((reason = refusal(file.path, "remove" in file ? undefined : "content" in file ? file.content : file.append))) break;
      if ("append" in file) {
        const size = (await stat(join(dir, file.path)).then((s) => s.size, () => 0)) + Buffer.byteLength(file.append);
        if (size > MAX_FILE_BYTES) reason = `${file.path} would be over 1 MiB`;
      }
      if (reason) break;
    }
    if (!reason && change.base !== undefined) {
      const moved = (await git(["diff", "--name-only", change.base, "HEAD", "--", ...change.files.map((file) => file.path)])).trim();
      if (moved) reason = `conflict: ${moved.split("\n").join(", ")} changed since ${change.base.slice(0, 12)}; redo the change against the new version`;
    }
    if (reason) return (report({ type: "memory.refused", actor: change.actor, reason }), { ok: false, reason });
    const id = randomUUID();
    record.run(ownerId, id, new Date().toISOString(), JSON.stringify(change));
    const commit = await apply(id, change);
    done.run(ownerId, id);
    return { ok: true, commit, mutationId: id };
  }

  // A pending intent is one a crash cut short (ADR-026): found in git by its mutation id, completed, or quarantined.
  // Never deleted. This runs before the owner's edits are looked at, so its half-written files are not taken for theirs.
  // shortcut: an owner edit to the same file while the daemon was down is overwritten by the completed intent; check
  // the file against the intent's base when canonicalize (1.6) starts sending bases.
  for (const row of db.prepare(`SELECT id, change FROM intent WHERE owner_id = ? AND state = 'pending' ORDER BY at`).all(ownerId)) {
    const id = String(row.id);
    const found = (await git(["log", "--format=%H", "-F", `--grep=Jaari-Mutation-Id: ${id}`]).catch(() => "")).trim();
    if (found) {
      done.run(ownerId, id);
      report({ type: "memory.recovered", mutationId: id, how: "found" });
    } else {
      try {
        await apply(id, JSON.parse(String(row.change)) as Change);
        done.run(ownerId, id);
        report({ type: "memory.recovered", mutationId: id, how: "completed" });
      } catch (error) {
        const why = error instanceof Error ? error.message : String(error);
        quarantine.run(why, ownerId, id);
        report({ type: "memory.quarantined", mutationId: id, reason: why });
      }
    }
  }

  // One change at a time, in the order submitted; a failed change does not stop the ones after it.
  let tail: Promise<unknown> = Promise.resolve();
  return {
    submit: (change) => {
      const run = tail.then(() => submit(change));
      tail = run.catch(() => {});
      return run;
    },
    head,
    close: async () => {
      await tail;
      db.close();
    },
  };
}
