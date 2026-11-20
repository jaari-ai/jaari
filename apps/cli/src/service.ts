// `jaari service install [--home <dir>] [--daemon <path>] [--user <name>] [--print]`: start the daemon at login or boot
// and restart it when it dies (ADR-056): a launchd user agent on macOS, a systemd system unit on Linux (ADR-079).
import { spawn } from "node:child_process";
import { chmod, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { delimiter, isAbsolute, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { ConfigError, credentialsDirOf, jaariPaths, loadConfig } from "@jaari/core/config";
import { isSecretName } from "@jaari/secrets";
import type { Command, Io } from "./io.js";

const USAGE = "usage: jaari service install [--home <dir>] [--daemon <path>] [--user <name>] [--print]";
export const LABEL = "org.jaari.daemon";
export const UNIT = "/etc/systemd/system/jaari.service";
export const CREDSTORE = "/etc/jaari/credstore";

// Every effect on the system, so a test hands over fakes and never reaches the real launchd, systemd, or files.
export type ServiceDeps = {
  platform: NodeJS.Platform;
  uid: number;
  user: string;
  homedir: string;
  path: string; // $PATH
  execPath: string; // this node
  cliPath: string; // this `jaari` script
  exec: (command: string, args: string[], stdin?: string) => Promise<{ code: number; stderr: string }>;
  writeFile: (path: string, text: string, mode: number) => Promise<void>;
  mkdir: (path: string, mode: number) => Promise<void>;
  readdir: (path: string) => Promise<string[]>;
  isFile: (path: string) => Promise<boolean>;
};

export const systemDeps: ServiceDeps = {
  platform: process.platform,
  uid: process.getuid?.() ?? -1,
  user: userInfo().username,
  homedir: homedir(),
  path: process.env.PATH ?? "",
  execPath: process.execPath,
  cliPath: process.argv[1] ?? "jaari",
  exec: (command, args, stdin) =>
    new Promise((done) => {
      const child = spawn(command, args, { stdio: ["pipe", "ignore", "pipe"] });
      let stderr = "";
      child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      child.on("error", (error) => done({ code: 127, stderr: error.message })); // not installed
      child.on("close", (code) => done({ code: code ?? 1, stderr }));
      child.stdin.end(stdin);
    }),
  writeFile: async (path, text, mode) => {
    await writeFile(path, text, { mode });
    await chmod(path, mode); // the mode option applies only to a new file
  },
  mkdir: async (path, mode) => void (await mkdir(path, { recursive: true, mode })),
  readdir: (path) => readdir(path),
  isFile: async (path) => (await stat(path).catch(() => null))?.isFile() === true,
};

const xml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// systemd expands % specifiers everywhere and $VAR in ExecStart; inside double quotes only \ and " need a backslash.
const unitPath = (s: string) => `"${s.replace(/[\\"]/g, "\\$&").replace(/%/g, "%%")}"`;
const execArg = (s: string) => unitPath(s).replace(/\$/g, "$$$$");
const shell = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);
const isUnder = (path: string, dir: string) => {
  const rel = relative(dir, path);
  return rel === "" || !(rel.startsWith("..") || isAbsolute(rel));
};

export async function service(args: string[], io: Io, deps: ServiceDeps = systemDeps): Promise<number> {
  const say = (line: string) => io.output.write(`${line}\n`);
  let parsed;
  try {
    parsed = parseArgs({ args, allowPositionals: true, options: { home: { type: "string" }, daemon: { type: "string" }, user: { type: "string" }, print: { type: "boolean" } } });
  } catch {
    return (say(USAGE), 2);
  }
  const { values, positionals } = parsed;
  if (positionals.length !== 1 || positionals[0] !== "install") return (say(USAGE), 2);
  if (deps.platform !== "darwin" && deps.platform !== "linux") return (say(`jaari: service install is not supported on ${deps.platform}`), 1);

  const paths = jaariPaths(values.home ? resolve(values.home) : join(deps.homedir, ".jaari")); // sudo's own home is not the owner's
  let config;
  try {
    config = await loadConfig(paths.config);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    for (const problem of error.problems) say(`jaari: ${problem}`);
    return 1;
  }

  // Paths are kept as found, never resolved through links: a link is what stays stable when Homebrew upgrades Node or
  // `jaari update` moves its `current` link (ADR-122), while the folder it points to goes away.
  const onPath = async (name: string) => {
    for (const candidate of deps.path.split(delimiter).filter((dir) => isAbsolute(dir)).map((dir) => join(dir, name))) if (await deps.isFile(candidate)) return candidate;
    return undefined;
  };
  const daemon = values.daemon ? ((await deps.isFile(resolve(values.daemon))) ? resolve(values.daemon) : undefined) : await onPath("jaari-daemon");
  if (!daemon) return (say(`jaari: no jaari-daemon ${values.daemon ? `at ${values.daemon}` : "on PATH"}; pass its path with --daemon <path>`), 1);
  const node = (await onPath("node")) ?? deps.execPath; // process.execPath is already resolved: /opt/homebrew/Cellar/node/<version>/...
  // A newline in any value would add a line of its own to the generated file.
  if ([paths.home, daemon, node, values.user ?? ""].some((v) => [...v].some((c) => c < " " || c === "\x7f"))) return (say("jaari: a path or user name contains a control character"), 1);
  const command = [node, daemon, "--home", paths.home]; // absolute paths, so boot does not depend on PATH

  if (deps.platform === "darwin") {
    // ADR-057: macOS privacy protection blocks a background process from these folders.
    const guarded = ["Documents", "Desktop", "Downloads"].map((name) => join(deps.homedir, name));
    const blocked = [daemon, paths.home].find((p) => guarded.some((dir) => isUnder(p, dir)));
    if (blocked) return (say(`jaari: ${blocked} is under Documents, Desktop or Downloads, where macOS blocks a background process; move it`), 1);
    const plist = join(deps.homedir, "Library", "LaunchAgents", `${LABEL}.plist`);
    // Not in the data folder: launchd makes the file readable by others, and the data folder holds only private files (ADR-028).
    const log = join(deps.homedir, "Library", "Logs", "jaari-daemon.log");
    const text = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${command.map((a) => `    <string>${xml(a)}</string>`).join("\n")}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${xml(log)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(log)}</string>
</dict>
</plist>
`;
    if (values.print) return (io.output.write(text), 0);
    const target = `gui/${deps.uid}`;
    await deps.mkdir(join(deps.homedir, "Library", "LaunchAgents"), 0o755);
    await deps.writeFile(plist, text, 0o644);
    say(`Wrote ${plist}.`);
    await deps.exec("launchctl", ["bootout", `${target}/${LABEL}`]); // fails when not loaded yet, which is fine
    const loaded = await deps.exec("launchctl", ["bootstrap", target, plist]);
    if (loaded.code !== 0) return (say(`jaari: launchctl bootstrap failed: ${loaded.stderr.trim()}`), 1);
    say(`Loaded ${LABEL}; it starts at login and restarts when it stops.`);
    say(`Check: launchctl print ${target}/${LABEL}   Log: ${log}`);
    say(`Remove: launchctl bootout ${target}/${LABEL} && rm ${shell(plist)}`);
    return 0;
  }

  // Linux: a system unit, so the daemon starts at boot without a login session.
  const zero = config.secrets?.zero ?? "os-keychain";
  if (zero === "os-keychain") return (say('jaari: a system service has no login keychain; set "secrets": { "zero": "host-credential" } (ADR-079)'), 1);
  const user = values.user ?? (values.print ? deps.user : undefined);
  if (deps.uid !== 0 && !values.print) {
    const again = [node, deps.cliPath, "service", "install", "--home", paths.home, "--daemon", daemon, "--user", values.user ?? deps.user];
    return (say(`jaari: a system service needs root; run it with sudo: sudo ${again.map(shell).join(" ")}`), 1);
  }
  if (!user) return (say("jaari: pass --user <name>: the account the daemon runs as"), 1);

  const dir = credentialsDirOf(config, paths);
  let names;
  try {
    names = (await deps.readdir(dir)).filter(isSecretName).sort(); // skips the provider's hidden temp files
  } catch {
    return (say(`jaari: cannot read the credentials folder ${dir}; store secrets with \`jaari secret set\` first`), 1);
  }
  const encrypted = (await deps.exec("systemd-creds", ["--version"])).code === 0;
  // `LoadCredential=` takes the path as written, with no quoting, so a space or a quote would change it.
  if (!encrypted && names.length > 0 && /[\s"'\\]/.test(dir)) return (say(`jaari: without systemd-creds, the credentials folder must have no space or quote in its path: ${dir}`), 1);
  const credentials = names.map((name) =>
    encrypted ? `LoadCredentialEncrypted=${name}:${CREDSTORE}/${name}.cred` : `LoadCredential=${name}:${join(dir, name).replace(/%/g, "%%")}`);
  const text = `[Unit]
Description=Jaari personal agent daemon
After=network-online.target
Wants=network-online.target

[Service]
User=${user}
ExecStart=${command.map(execArg).join(" ")}
Restart=on-failure
RestartSec=5
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=${unitPath(paths.home)}
${credentials.map((line) => `${line}\n`).join("")}
[Install]
WantedBy=multi-user.target
`;
  if (values.print) return (io.output.write(text), 0);

  if (encrypted && names.length > 0) {
    await deps.mkdir(CREDSTORE, 0o700);
    // Only file paths go to systemd-creds; the value is never read here.
    for (const name of names) {
      const done = await deps.exec("systemd-creds", ["encrypt", `--name=${name}`, join(dir, name), `${CREDSTORE}/${name}.cred`]);
      if (done.code !== 0) return (say(`jaari: systemd-creds could not encrypt "${name}": ${done.stderr.trim()}`), 1);
    }
    say(`Encrypted ${names.length} credential(s) into ${CREDSTORE}.`);
  }
  await deps.writeFile(UNIT, text, 0o644);
  say(`Wrote ${UNIT}.`);
  for (const step of [["daemon-reload"], ["enable", "--now", "jaari.service"]]) {
    const done = await deps.exec("systemctl", step);
    if (done.code !== 0) return (say(`jaari: systemctl ${step.join(" ")} failed: ${done.stderr.trim()}`), 1);
  }
  say("Enabled and started jaari.service; it starts at boot and restarts when it fails.");
  if (names.length > 0) {
    say(encrypted
      ? `The plain files in ${dir} are still there: delete them after the first good start.`
      : `systemd-creds is not available: the files in ${dir} stay plain; make them readable by root only.`);
  }
  say("Run `jaari service install` again after every `jaari secret set`.");
  say("Check: systemctl status jaari.service   Log: journalctl -u jaari.service");
  say(`Remove: sudo systemctl disable --now jaari.service && sudo rm ${UNIT}${encrypted ? ` && sudo rm -r ${CREDSTORE}` : ""}`);
  return 0;
}

export const run: Command = (args, io) => service(args, io);
