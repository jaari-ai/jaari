import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { service, type ServiceDeps } from "./service.js";

const LLM = '"llm":{"providers":{},"tiers":{},"roles":{}}';
const SECRET_VALUE = "fake-secret-value-123";

let root: string, home: string;
beforeEach(async () => {
  // The config is a real file in a temp folder; every system effect below is a fake.
  root = await mkdtemp(join(tmpdir(), "jaari-service-"));
  home = join(root, "jaari home");
  await mkdir(home);
  await config("host-credential");
  await mkdir(join(home, "credentials"));
  for (const name of ["llm.faux", ".llm.faux.abc123", "telegram.faux"]) await writeFile(join(home, "credentials", name), SECRET_VALUE, { mode: 0o600 });
});
const config = (zero: string) => writeFile(join(home, "config.jsonc"), `{"version":1,"secrets":{"zero":"${zero}"},${LLM}}`);

function fakes(over: Partial<ServiceDeps> = {}) {
  const files: Record<string, string> = {};
  const deps: ServiceDeps = {
    platform: "darwin",
    uid: 501,
    user: "owner",
    homedir: "/Users/owner",
    path: "/opt/bin:/usr/local/bin",
    execPath: "/opt/homebrew/Cellar/node/26.13.1/bin/node", // resolved, as process.execPath is
    cliPath: "/usr/local/lib/jaari/cli.js",
    exec: vi.fn(async () => ({ code: 0, stderr: "" })),
    writeFile: vi.fn(async (path: string, text: string) => void (files[path] = text)),
    mkdir: vi.fn(async () => {}),
    readdir: vi.fn((path: string) => readdir(path)), // only inside the temp folder
    isFile: vi.fn(async (path: string) => path === "/usr/local/bin/jaari-daemon" || path === "/usr/local/bin/node"),
    ...over,
  };
  return { deps, files, exec: deps.exec as ReturnType<typeof vi.fn> };
}

async function jaari(args: string[], deps: ServiceDeps) {
  const output = new PassThrough();
  let text = "";
  output.on("data", (d: Buffer) => (text += d.toString()));
  const code = await service(args, { input: new PassThrough(), output, isTTY: true }, deps);
  return { code, text };
}
const install = (...extra: string[]) => ["install", "--home", home, ...extra];
const nothingChanged = (deps: ServiceDeps) => {
  expect(deps.writeFile).not.toHaveBeenCalled();
  expect(deps.mkdir).not.toHaveBeenCalled();
  expect((deps.exec as ReturnType<typeof vi.fn>).mock.calls.filter(([c, a]) => !(c === "systemd-creds" && a[0] === "--version"))).toEqual([]);
};

describe("jaari service install on macOS", () => {
  it("names node and the daemon by the paths found on PATH, never resolved through links (ADR-122)", async () => {
    const found = await jaari(install("--print"), fakes().deps);
    expect(found.text).toContain("<string>/usr/local/bin/node</string>\n    <string>/usr/local/bin/jaari-daemon</string>");
    expect(found.text).not.toContain("Cellar"); // a Homebrew upgrade removes the versioned folder
    // No node on PATH: the one that runs this command, as the last resort.
    const fallback = await jaari(install("--print"), fakes({ isFile: async (path: string) => path === "/usr/local/bin/jaari-daemon" }).deps);
    expect(fallback.text).toContain("<string>/opt/homebrew/Cellar/node/26.13.1/bin/node</string>");
  });

  it("writes the launch agent and reloads it with launchctl", async () => {
    const { deps, files, exec } = fakes();
    const { code, text } = await jaari(install(), deps);
    expect(code).toBe(0);
    const plist = "/Users/owner/Library/LaunchAgents/org.jaari.daemon.plist";
    expect(deps.writeFile).toHaveBeenCalledWith(plist, expect.any(String), 0o644);
    const log = "/Users/owner/Library/Logs/jaari-daemon.log";
    expect(files[plist]).toContain(`<array>
    <string>/usr/local/bin/node</string>
    <string>/usr/local/bin/jaari-daemon</string>
    <string>--home</string>
    <string>${home}</string>
  </array>`);
    for (const part of ["<key>RunAtLoad</key>\n  <true/>", "<key>KeepAlive</key>\n  <true/>", "<key>ProcessType</key>\n  <string>Standard</string>", `<key>StandardErrorPath</key>\n  <string>${log}</string>`]) {
      expect(files[plist]).toContain(part);
    }
    expect(exec.mock.calls).toEqual([
      ["launchctl", ["bootout", "gui/501/org.jaari.daemon"]],
      ["launchctl", ["bootstrap", "gui/501", plist]],
    ]);
    expect(text).toContain("launchctl bootout gui/501/org.jaari.daemon");
  });

  it("ignores a failed bootout but reports a failed bootstrap", async () => {
    const exec = vi.fn(async (_c: string, args: string[]) => (args[0] === "bootout" ? { code: 3, stderr: "not loaded" } : { code: 5, stderr: "Bootstrap failed: 5" }));
    const { code, text } = await jaari(install(), fakes({ exec }).deps);
    expect(code).toBe(1);
    expect(text).toContain("launchctl bootstrap failed: Bootstrap failed: 5");
  });

  it("refuses a Jaari home or daemon under ~/Documents", async () => {
    const { deps } = fakes({ homedir: root });
    const docs = join(root, "Documents", "jaari");
    await mkdir(docs, { recursive: true });
    await writeFile(join(docs, "config.jsonc"), `{"version":1,${LLM}}`);
    const { code, text } = await jaari(["install", "--home", docs], deps);
    expect(code).toBe(1);
    expect(text).toContain("Documents, Desktop or Downloads");
    nothingChanged(deps);

    const daemon = fakes({ homedir: root, isFile: async () => true });
    expect((await jaari(install("--daemon", join(root, "Downloads", "jaari-daemon")), daemon.deps)).code).toBe(1);
    nothingChanged(daemon.deps);
  });

  it("--print writes the file text and changes nothing", async () => {
    const { deps } = fakes();
    const { code, text } = await jaari(install("--print"), deps);
    expect(code).toBe(0);
    expect(text).toMatch(/^<\?xml[\s\S]*<\/plist>\n$/);
    nothingChanged(deps);
  });

  it("XML-escapes paths with a space, & and <", async () => {
    const odd = join(root, "a & b <c>");
    await mkdir(odd);
    await writeFile(join(odd, "config.jsonc"), `{"version":1,${LLM}}`);
    const { text } = await jaari(["install", "--home", odd, "--print"], fakes().deps);
    expect(text).toContain(`<string>${root}/a &#38; b &#60;c&#62;</string>`);
    expect(text).not.toContain("a & b");
  });
});

describe("jaari service install on Linux", () => {
  const linux = (over: Partial<ServiceDeps> = {}) => fakes({ platform: "linux", uid: 0, homedir: "/home/owner", ...over });
  const dir = () => join(home, "credentials");

  it("encrypts each credential with systemd-creds and enables the unit", async () => {
    const { deps, files, exec } = linux();
    const { code, text } = await jaari(install("--user", "owner"), deps);
    expect(code).toBe(0);
    expect(exec.mock.calls).toEqual([
      ["systemd-creds", ["--version"]],
      ["systemd-creds", ["encrypt", "--name=llm.faux", join(dir(), "llm.faux"), "/etc/jaari/credstore/llm.faux.cred"]],
      ["systemd-creds", ["encrypt", "--name=telegram.faux", join(dir(), "telegram.faux"), "/etc/jaari/credstore/telegram.faux.cred"]],
      ["systemctl", ["daemon-reload"]],
      ["systemctl", ["enable", "--now", "jaari.service"]],
    ]);
    expect(deps.mkdir).toHaveBeenCalledWith("/etc/jaari/credstore", 0o700);
    expect(files["/etc/systemd/system/jaari.service"]).toBe(`[Unit]
Description=Jaari personal agent daemon
After=network-online.target
Wants=network-online.target

[Service]
User=owner
ExecStart="/usr/local/bin/node" "/usr/local/bin/jaari-daemon" "--home" "${home}"
Restart=on-failure
RestartSec=5
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths="${home}"
LoadCredentialEncrypted=llm.faux:/etc/jaari/credstore/llm.faux.cred
LoadCredentialEncrypted=telegram.faux:/etc/jaari/credstore/telegram.faux.cred

[Install]
WantedBy=multi-user.target
`);
    expect(text).toContain(`The plain files in ${dir()} are still there: delete them after the first good start.`);
    expect(text).toContain("Run `jaari service install` again after every `jaari secret set`.");
    // The command never reads a credential file, so a value cannot reach the output or an argument.
    expect(text + JSON.stringify(exec.mock.calls) + JSON.stringify(files)).not.toContain(SECRET_VALUE);
  });

  it("falls back to plain LoadCredential when systemd-creds is missing", async () => {
    const exec = vi.fn(async (c: string) => ({ code: c === "systemd-creds" ? 127 : 0, stderr: "" }));
    // `LoadCredential=` cannot quote a path, so a folder with a space is refused rather than written wrong.
    const spaced = linux({ exec: vi.fn(async (c: string) => ({ code: c === "systemd-creds" ? 127 : 0, stderr: "" })) });
    expect(await jaari(install("--user", "owner"), spaced.deps)).toMatchObject({ code: 1, text: expect.stringContaining("no space or quote") as string });
    expect(spaced.deps.writeFile).not.toHaveBeenCalled();
    const plain = join(root, "creds");
    await mkdir(plain);
    await writeFile(join(plain, "llm.faux"), SECRET_VALUE, { mode: 0o600 });
    await writeFile(join(home, "config.jsonc"), `{"version":1,"secrets":{"zero":"host-credential","credentialsDir":"${plain}"},${LLM}}`);
    const { deps, files } = linux({ exec });
    const { code, text } = await jaari(install("--user", "owner"), deps);
    expect(code).toBe(0);
    expect(files["/etc/systemd/system/jaari.service"]).toContain(`LoadCredential=llm.faux:${join(plain, "llm.faux")}\n`);
    expect(exec.mock.calls.filter(([c]) => c === "systemd-creds")).toEqual([["systemd-creds", ["--version"]]]);
    expect(deps.mkdir).not.toHaveBeenCalled();
    expect(text).toContain("stay plain; make them readable by root only");
  });

  it("refuses without root and says the sudo command", async () => {
    const { deps } = linux({ uid: 1000 });
    const { code, text } = await jaari(install(), deps);
    expect(code).toBe(1);
    expect(text).toContain(`run it with sudo: sudo /usr/local/bin/node /usr/local/lib/jaari/cli.js service install --home '${home}' --daemon /usr/local/bin/jaari-daemon --user owner`);
    nothingChanged(deps);
  });

  it("needs --user when run as root", async () => {
    const { deps } = linux();
    expect((await jaari(install(), deps)).text).toContain("pass --user <name>");
    nothingChanged(deps);
  });

  it("refuses os-keychain: a system service has no login keychain", async () => {
    await config("os-keychain");
    const { deps } = linux();
    const { code, text } = await jaari(install("--user", "owner"), deps);
    expect(code).toBe(1);
    expect(text).toContain("a system service has no login keychain");
    nothingChanged(deps);
  });

  it("--print as a normal user writes the unit for the current user and changes nothing", async () => {
    const { deps } = linux({ uid: 1000 });
    const { code, text } = await jaari(install("--print"), deps);
    expect(code).toBe(0);
    expect(text).toContain("User=owner\n");
    nothingChanged(deps);
  });

  it("quotes %, $ and quotes for systemd", async () => {
    const { text } = await jaari(install("--print", "--daemon", '/opt/50% $HOME "x"/jaari-daemon'), linux({ isFile: async () => true }).deps);
    expect(text).toContain(String.raw`"/opt/50%% $$HOME \"x\"/jaari-daemon"`);
  });
});

describe("jaari service install, common", () => {
  it("says how to pass --daemon when none is found", async () => {
    const { deps } = fakes({ isFile: async () => false });
    const { code, text } = await jaari(install(), deps);
    expect(code).toBe(1);
    expect(text).toBe("jaari: no jaari-daemon on PATH; pass its path with --daemon <path>\n");
  });

  it("prints each config problem", async () => {
    await writeFile(join(home, "config.jsonc"), `{"version":1,"bogus":1,${LLM}}`);
    const { deps } = fakes();
    const { code, text } = await jaari(install(), deps);
    expect(code).toBe(1);
    expect(text).toBe("jaari: /bogus: unknown key\n");
    nothingChanged(deps);
  });

  it("installs a second service beside the owner's under --service-name, with its own names (ADR-126)", async () => {
    const mac = fakes();
    expect((await jaari(install("--service-name", "jaari-check"), mac.deps)).code).toBe(0);
    const plist = "/Users/owner/Library/LaunchAgents/org.jaari.daemon.check.plist";
    expect(mac.files[plist]).toContain("<key>Label</key>\n  <string>org.jaari.daemon.check</string>");
    expect(mac.files[plist]).toContain("<string>/Users/owner/Library/Logs/jaari-check-daemon.log</string>");
    expect(mac.exec.mock.calls).toEqual([
      ["launchctl", ["bootout", "gui/501/org.jaari.daemon.check"]],
      ["launchctl", ["bootstrap", "gui/501", plist]],
    ]);

    const linux = fakes({ platform: "linux", uid: 0, homedir: "/home/owner" });
    expect((await jaari(install("--user", "owner", "--service-name", "jaari-check"), linux.deps)).code).toBe(0);
    expect(Object.keys(linux.files)).toEqual(["/etc/systemd/system/jaari-check.service"]);
    expect(linux.files["/etc/systemd/system/jaari-check.service"]).toContain("LoadCredentialEncrypted=llm.faux:/etc/jaari-check/credstore/llm.faux.cred");
    expect(linux.exec.mock.calls).toContainEqual(["systemctl", ["enable", "--now", "jaari-check.service"]]);

    // Without root, the sudo command it prints keeps the name.
    const user = fakes({ platform: "linux", uid: 1000, homedir: "/home/owner" });
    expect((await jaari(install("--service-name", "jaari-check"), user.deps)).text).toContain("--service-name jaari-check");
  });

  it("refuses a --service-name that is not jaari or jaari-<letters and digits>, before anything changes", async () => {
    for (const name of ["other", "jaari-", "jaari-Check", "jaari-../x", "jaari-a.b", `jaari-${"x".repeat(21)}`]) {
      const { deps } = fakes();
      const { code, text } = await jaari(install("--service-name", name), deps);
      expect(code, name).toBe(2);
      expect(text, name).toContain("--service-name is jaari or jaari-<letters and digits>");
      nothingChanged(deps);
    }
  });

  it("prints usage for anything but install, and refuses other platforms", async () => {
    expect((await jaari(["uninstall"], fakes().deps)).code).toBe(2);
    expect((await jaari([], fakes().deps)).code).toBe(2);
    const { code, text } = await jaari(install(), fakes({ platform: "win32" }).deps);
    expect(code).toBe(1);
    expect(text).toBe("jaari: service install is not supported on win32\n");
  });
});
