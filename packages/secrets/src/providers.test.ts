import { chmod, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHostCredentialProvider, createOsKeychainProvider } from "./providers.js";

const getPassword = vi.fn<() => Promise<string | null>>();
vi.mock("@napi-rs/keyring", () => ({ AsyncEntry: vi.fn(function () { return { getPassword }; }) }));

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
});
