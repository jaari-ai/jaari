# ADR-125: Windows is a host from Phase 0: Credential Manager, a named pipe, a per-user scheduled task, ACLs, and no shell

- **Status:** Accepted
- **Extended by:** [ADR-128](128-docker-first.md)
- **Date:** 2026-11-20

## Context
[ADR-057](057-laptop-host-and-node.md) said "Windows comes later", and the roadmap listed Windows
after v1. The owner decided on 2026-11-20 that the daemon runs on Linux, macOS, and Windows, and
that Windows support is a Phase 0 follow-up, so that every later feature covers it from the start.

Phase 0 has no Windows code. The parts that assume Unix are: the chat socket (a Unix socket guarded
by mode `0600`, ADR-021), the service (launchd and systemd, ADR-122), the stay-awake hold and the
battery reading (`caffeinate`, `systemd-inhibit`, `pmset`, ADR-121), the owner-only checks (file
modes, ADR-028, ADR-079), the version link and the npm layout of `jaari update` (ADR-124), and
`jaari doctor`. The facts below come from the Node.js 26 and npm 11 documentation:
- A local socket on Windows is a named pipe under `\\?\pipe\` or `\\.\pipe\`, in one flat
  namespace for all accounts, and it ends when the daemon exits (Node `net`, IPC paths).
- `chmod` on Windows changes only the write permission (Node `fs.chmod`). Unix mode checks such as
  "not readable by group or others" cannot work there.
- A junction (`fs.symlink(target, path, "junction")`) needs no administrator rights, points only to
  a folder, and has an absolute target (Node `fs.symlink`).
- A global npm install puts packages in `{prefix}\node_modules` and the commands in `{prefix}`,
  not in `lib\node_modules` and `bin` (npm `folders`).
- `@napi-rs/keyring` (ADR-112) ships builds for `win32-x64`, `win32-arm64`, and `win32-ia32`.

## Decision
1.  **What is supported.** Windows 11 and Windows 10 22H2, on x64 and arm64, with Node 26, installed
    with npm. The targets are `laptop` and `home`. The Compose image stays Linux only (ADR-123).
2.  **Secrets.** `os-keychain` uses Windows Credential Manager through the ADR-112 library.
    `host-credential` is refused on Windows: its owner-only check rests on Unix modes, and a Windows
    server is not a Phase 0 target.
3.  **The Jaari folder is private through its ACL, not its mode.** `jaari init` and the daemon set
    the folder's access list to the owner's account, `SYSTEM`, and `Administrators`, with inheritance
    from the profile removed (`icacls <dir> /inheritance:r /grant:r …`). `jaari doctor` fails when
    any other account or group has an entry. Code that writes mode `0600` or `0700` keeps doing so;
    on Windows the mode is ignored and the ACL is what protects the files. The ADR-079 and ADR-122
    mode checks run on Linux and macOS only.
4.  **The chat channel is a named pipe:** `\\.\pipe\jaari-<the first 16 hex of the SHA-256 of the
    data folder's real path>`, so two accounts or two Jaari folders never share one. The pipe is
    not a file, so no mode guards it. The default security of a named pipe gives full control to the
    creating account, `SYSTEM`, and `Administrators`, and read access to everyone. The daemon
    writes nothing to a client before it has read the client's hello, so a client that can only read
    receives nothing, and it cannot write a message. A test checks this on a Windows machine of the
    owner's; if the test shows that another account can write, the pipe gets an explicit access list
    before Windows ships.
5.  **The service is a scheduled task for the owner's account,** `\Jaari\daemon`, made with
    `schtasks /Create /XML`, with no administrator rights and no stored password: it starts at the
    owner's log-on and runs only while the owner is logged on, like the launchd agent. Its settings
    are written explicitly, because the defaults would stop or slow the daemon: no time limit
    (`ExecutionTimeLimit` `PT0S`; the default is three days), start and keep running on battery
    (`DisallowStartIfOnBatteries` and `StopIfGoingOnBatteries` `false`), restart on failure every
    minute, and priority 5, normal (the default, 7, is below normal: the same mistake as the launchd
    `Background` job). `jaari update` stops and starts it with `schtasks /End` and `/Run`, and waits
    for the daemon as under launchd: 120 seconds by default, `--wait <seconds>` to change it.
6.  **Power.** The stay-awake hold is a child `powershell.exe -NoProfile -NonInteractive` process
    that calls `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)` and exits when the
    daemon's process exits, as `caffeinate -w` does. The battery is read with `Get-CimInstance
    Win32_Battery`. Sleep is still a clock gap (ADR-121), which needs no OS tool.
7.  **No shell, and OS tools by full path.** Node refuses to run a `.cmd` or `.bat` file without a
    shell. Jaari runs no shell. It starts its own programs and npm as `node <script>`
    (`process.execPath` with the script path), never through the `jaari.cmd` or `npm.cmd` shims, and
    it runs the Windows tools by full path under `%SystemRoot%\System32` (`tar.exe`, `schtasks.exe`,
    `icacls.exe`, and `WindowsPowerShell\v1.0\powershell.exe`), so a program earlier on `PATH`
    cannot stand in for one.
8.  **Versions.** The npm layout differs (`{prefix}\node_modules`, commands in `{prefix}`), and the
    `current` link is a junction with an absolute target. When the Jaari folder is moved, the junction
    points to the old place: the launcher finds no active version there, says so, and runs its own
    version (ADR-124, point 7), and the next `jaari update` makes the link again.
9.  **`jaari doctor` on Windows** checks the folder ACL (FAIL on another account), the scheduled task
    and its settings, the pipe, and BitLocker on the data folder's drive, read without administrator
    rights through the Shell's `System.Volume.BitLockerProtection` property (a warning when off).
10. **The tests and `scripts/check-update.mjs` run on a Windows machine of the owner's** before 0.19
    is Verified. CI keeps its one `ubuntu-latest` runner. A Windows runner waits for the milestone
    that the owner names; there is no new CI job until then.
11. **Not in this item:** what later features need on Windows (screen capture and the permission
    matrix of ADR-057, computer use, the node). Each ADR that adds a host-facing feature states its
    Windows behaviour from now on.

## Alternatives rejected
- **Windows after v1 (ADR-057):** every feature built until then would need a second pass.
- **A Windows Service:** it needs administrator rights to install and a stored password or a service
  account, and it cannot reach the owner's Credential Manager entries. The per-user task matches the
  launchd agent; a Windows server can be decided when one is a target.
- **WSL only:** the daemon would not see the owner's Windows keychain, power state, or files.
- **A native addon for the power hold:** one more binary per platform; the PowerShell child uses a
  tool every supported Windows has.
- **Running the `.cmd` shims with `shell: true`:** a shell parses the arguments, which reopens the
  injection that Node closed.

## Amendments
- **ADR-128:** Windows is On request: it is not part of the Phase 0 gate, and its tasks are kept in `docs/HOSTS.md` until the owner asks for it.

## Consequences
- Roadmap 0.19 builds this. Phase 0 is not finished until it is Verified.
- The threat model gains rows for the named pipe and for `Administrators`, which on Windows play the
  part of root on the host.
- Amends ADR-057 (Windows is a Phase 0 host), ADR-112 (the Windows backend is used), ADR-121 (the
  Windows power tools), ADR-122 (the Windows service and doctor checks), and ADR-124 (the npm layout
  and the junction).
