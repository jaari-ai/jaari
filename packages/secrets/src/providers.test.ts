import { chmod, mkdir, mkdtemp, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHostCredentialProvider, createOsKeychainProvider } from "./providers.js";

const getPassword = vi.fn<() => Promise<string | null>>();
const setPassword = vi.fn<(value: string) => Promise<void>>();
const { AsyncEntry } = vi.hoisted(() => ({ AsyncEntry: vi.fn(function () { return { getPassword, setPassword }; }) }));
vi.mock("@napi-rs/keyring", () => ({ AsyncEntry }));
const VALUE = "value-" + "a".repeat(8);

// Each test sets its own implementation. (A beforeEach mockReset made Vitest 5.1 fail the
// locked-keychain test with the error that health() had caught; not traced further.)
describe("os-keychain", () => {
  it("returns the stored value", async () => {
    getPassword.mockResolvedValue("s3cret");
    expect(await createOsKeychainProvider().resolve("token")).toBe("s3cret");
  });

  it("fails when the entry is missing", async () => {
    getPassword.mockResolvedValue(null);
    await expect(createOsKeychainProvider().resolve("token")).rejects.toThrow('no secret "token"');
  });

  it("reports a locked keychain as unhealthy", async () => {
    getPassword.mockImplementation(async () => { throw new Error("locked"); });
    expect(await createOsKeychainProvider().health()).toEqual({ ok: false, problem: "OS keychain unavailable: locked" });
  });

  it("stores a value under the service and name", async () => {
    setPassword.mockResolvedValue(undefined);
    await createOsKeychainProvider("jaari-test").store("llm.x", VALUE);
    expect(AsyncEntry).toHaveBeenLastCalledWith("jaari-test", "llm.x");
    expect(setPassword).toHaveBeenLastCalledWith(VALUE);
  });

  it("refuses to store under a bad name", async () => {
    await expect(createOsKeychainProvider().store("../x", VALUE)).rejects.toThrow("not a secret name");
  });
});

describe("host-credential", () => {
  let root: string, creds: string, data: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "jaari-secrets-"));
    creds = join(root, "creds");
    data = join(root, "data");
    await mkdir(creds);
    await mkdir(data);
  });
  const put = async (dir: string, name: string, content: string, mode = 0o600) => {
    await writeFile(join(dir, name), content);
    await chmod(join(dir, name), mode);
  };

  it("reads an owner-only file and drops one trailing newline", async () => {
    await put(creds, "jaari-secret-zero", "s3cret\n");
    expect(await createHostCredentialProvider(creds, data).resolve("jaari-secret-zero")).toBe("s3cret");
  });

  it.each([0o640, 0o604])("refuses a file with mode %o", async (mode) => {
    await put(creds, "zero", "s3cret", mode);
    await expect(createHostCredentialProvider(creds, data).resolve("zero")).rejects.toThrow("open to group or others");
  });

  it.each(["../zero", "a/b", ".hidden"])("refuses the name %s, even when the file is owner-only", async (name) => {
    await put(root, "zero", "s3cret");
    await expect(createHostCredentialProvider(creds, data).resolve(name)).rejects.toThrow("not a secret name");
  });

  it("refuses an empty file", async () => {
    await put(creds, "zero", "\n");
    await expect(createHostCredentialProvider(creds, data).resolve("zero")).rejects.toThrow("is empty");
  });

  it("refuses a link that points into the data directory", async () => {
    await put(data, "zero", "s3cret");
    await symlink(join(data, "zero"), join(creds, "zero"));
    await expect(createHostCredentialProvider(creds, data).resolve("zero")).rejects.toThrow("inside the Jaari data directory");
  });

  it("health checks the directory exists and sits outside the data directory", async () => {
    expect(await createHostCredentialProvider(creds, data).health()).toEqual({ ok: true });
    expect(await createHostCredentialProvider(join(root, "missing"), data).health()).toMatchObject({ ok: false });
    expect(await createHostCredentialProvider(data, data).health()).toMatchObject({ ok: false, problem: expect.stringContaining("inside") });
    // A sibling whose name starts with ".." is not inside.
    await mkdir(join(root, "..data"));
    expect(await createHostCredentialProvider(join(root, "..data"), data).health()).toEqual({ ok: true });
  });

  describe("store", () => {
    const mode = async (path: string) => (await stat(path)).mode & 0o777;
    beforeEach(() => chmod(creds, 0o700));

    it("writes an owner-only file that resolve reads back, and replaces it", async () => {
      const provider = createHostCredentialProvider(creds, data);
      await provider.store("llm.x", VALUE);
      expect(await provider.resolve("llm.x")).toBe(VALUE);
      expect(await mode(join(creds, "llm.x"))).toBe(0o600);
      await provider.store("llm.x", VALUE + "b");
      expect(await provider.resolve("llm.x")).toBe(VALUE + "b");
      expect(await readdir(creds)).toEqual(["llm.x"]); // no temp file left
    });

    it("creates a missing directory with mode 0700, whatever the umask", async () => {
      const dir = join(root, "new", "creds");
      const old = process.umask(0o022);
      try {
        await createHostCredentialProvider(dir, data).store("x", VALUE);
      } finally {
        process.umask(old);
      }
      expect(await mode(dir)).toBe(0o700);
      expect(await mode(join(dir, "x"))).toBe(0o600);
    });

    it.each([["../x"], [".hidden"], ["a/b"]])("refuses the name %s", async (name) => {
      await expect(createHostCredentialProvider(creds, data).store(name, VALUE)).rejects.toThrow("not a secret name");
    });

    it.each([[""], ["line\nbreak"], ["line\rbreak"]])("refuses the value %j", async (value) => {
      await expect(createHostCredentialProvider(creds, data).store("x", value)).rejects.toThrow("empty or holds a line break");
      expect(await readdir(creds)).toEqual([]);
    });

    it("refuses a directory inside the data directory, also before it exists", async () => {
      await expect(createHostCredentialProvider(data, data).store("x", VALUE)).rejects.toThrow("inside the Jaari data directory");
      await expect(createHostCredentialProvider(join(data, "creds"), data).store("x", VALUE)).rejects.toThrow("inside the Jaari data directory");
      expect(await readdir(data)).toEqual([]);
    });

    it("refuses a directory open to group or others and leaves its mode alone", async () => {
      await chmod(creds, 0o750);
      await expect(createHostCredentialProvider(creds, data).store("x", VALUE)).rejects.toThrow("chmod 700");
      expect(await mode(creds)).toBe(0o750);
      expect(await readdir(creds)).toEqual([]);
    });

    it("leaves no temp file when the final rename fails", async () => {
      await mkdir(join(creds, "x")); // a directory in the way makes rename fail
      await expect(createHostCredentialProvider(creds, data).store("x", VALUE)).rejects.toThrow();
      expect(await readdir(creds)).toEqual(["x"]);
    });

    it("never puts the value in an error", async () => {
      await chmod(creds, 0o777);
      const error = await createHostCredentialProvider(creds, data).store("x", VALUE).catch((e: Error) => e);
      expect(String((error as Error).message)).not.toContain(VALUE);
    });
  });
});
