// The two Phase 0 providers of secret zero: os-keychain (ADR-013, ADR-018) and host-credential (ADR-079).
import { randomBytes } from "node:crypto";
import { mkdir, open, realpath, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { isSecretName, type VaultProvider } from "./secrets.js";

// macOS Keychain, Secret Service on Linux desktops, Credential Manager on Windows. The native module loads
// on first use, so a host that uses host-credential never loads it.
export function createOsKeychainProvider(service = "jaari"): Required<VaultProvider> {
  const entry = async (name: string) => new (await import("@napi-rs/keyring")).AsyncEntry(service, name);
  return {
    async resolve(name) {
      const value = await (await entry(name)).getPassword();
      if (value === null) throw new Error(`no secret "${name}" in the OS keychain (service "${service}")`);
      return value;
    },
    // A missing entry gives null; a locked or absent keychain rejects.
    async health() {
      try {
        await (await entry("jaari.health")).getPassword();
        return { ok: true };
      } catch (e) {
        return { ok: false, problem: `OS keychain unavailable: ${(e as Error).message}` };
      }
    },
    async store(name, value) {
      if (!isSecretName(name)) throw new Error(`not a secret name: "${name}"`);
      await (await entry(name)).setPassword(value);
    },
  };
}

// A path that does not exist yet takes the real path of its nearest existing parent (macOS: /var is a link).
const realOrResolved = async (p: string): Promise<string> => {
  const full = resolve(p);
  return realpath(full).catch(async () => (dirname(full) === full ? full : join(await realOrResolved(dirname(full)), basename(full))));
};
const inside = (dir: string, path: string) => {
  const rel = relative(dir, path);
  // `..data` is a sibling name, not a parent, so test for `..` plus a separator.
  return rel === "" || !(rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel));
};

// Files the service manager supplies at each start: $CREDENTIALS_DIRECTORY under systemd, /run/secrets under
// Compose. `dir` is passed in by the daemon; Jaari never reads secret zero from an environment variable.
export function createHostCredentialProvider(dir: string, dataDir: string): Required<VaultProvider> {
  return {
    async resolve(name) {
      if (!isSecretName(name)) throw new Error(`not a secret name: "${name}"`); // the path is built here, so the check is too
      const file = await realpath(join(dir, name)); // follows links, so the location check sees the real file
      if (inside(await realOrResolved(dataDir), file)) throw new Error(`credential "${name}" lies inside the Jaari data directory`);
      const handle = await open(file, "r");
      try {
        // Checked on the open file, so it cannot be swapped between the check and the read.
        const st = await handle.stat();
        if (!st.isFile()) throw new Error(`credential "${name}" is not a regular file`);
        if ((st.mode & 0o077) !== 0) throw new Error(`credential "${name}" is open to group or others (mode ${(st.mode & 0o777).toString(8)}); make it 0400 or 0600`);
        // `echo key > file` adds a newline that would break the secret.
        const value = (await handle.readFile("utf8")).replace(/\r?\n$/, "");
        if (value === "") throw new Error(`credential "${name}" is empty`);
        return value;
      } finally {
        await handle.close();
      }
    },
    // shortcut: "not in the backup set" (ADR-079) is not checked; add it when backup ships (Phase 3).
    async health() {
      const real = await realpath(dir).catch(() => null);
      if (real === null || !(await stat(real)).isDirectory()) return { ok: false, problem: `credential directory ${dir} does not exist` };
      if (inside(await realOrResolved(dataDir), real)) return { ok: false, problem: `credential directory ${dir} lies inside the Jaari data directory` };
      return { ok: true };
    },
    // Never puts the value in an error: callers print these messages.
    async store(name, value) {
      if (!isSecretName(name)) throw new Error(`not a secret name: "${name}"`);
      // resolve() drops one trailing newline, so a value with a line break would not read back the same.
      if (value === "" || /[\r\n]/.test(value)) throw new Error(`the value for "${name}" is empty or holds a line break`);
      if (inside(await realOrResolved(dataDir), await realOrResolved(dir))) throw new Error(`credential directory ${dir} lies inside the Jaari data directory`);
      const st = await stat(dir).catch((e: NodeJS.ErrnoException) => (e.code === "ENOENT" ? null : Promise.reject(e)));
      if (st === null) await mkdir(dir, { recursive: true, mode: 0o700 });
      else if (!st.isDirectory()) throw new Error(`credential directory ${dir} is not a directory`);
      else if ((st.mode & 0o077) !== 0) throw new Error(`credential directory ${dir} is open to group or others (mode ${(st.mode & 0o777).toString(8)}); run chmod 700 ${dir}`);
      // A leading dot: resolve() refuses the name, so a half-written file is never read as a secret.
      const temp = join(dir, `.${name}.${randomBytes(6).toString("hex")}`);
      const handle = await open(temp, "wx", 0o600);
      try {
        try {
          await handle.chmod(0o600); // the umask may have cleared bits of the open mode
          await handle.writeFile(value);
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(temp, join(dir, name)); // atomic: a reader sees the old value or the new one
      } catch (error) {
        await rm(temp, { force: true });
        throw error;
      }
    },
  };
}
