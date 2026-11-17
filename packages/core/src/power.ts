// The laptop host (ADR-057, ADR-082, ADR-121): detects sleep by a clock gap, reads the power source, keeps the
// machine awake while Jaari works, and reports a network change. It only detects and emits; what reacts to an
// event (catch-up, paused background work, reconnects) ships with its own feature and listens to `emit`.
import { execFile, spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { promisify } from "node:util";

export type StayAwake = "working" | "never" | "always";
export type PowerSource = { onBattery: boolean; percent: number };
export type PowerEvent =
  | { type: "power.wake"; gapMs: number }
  | { type: "power.source"; onBattery: boolean; percent: number }
  | { type: "power.battery.low"; percent: number }
  | { type: "power.hold.failed" }
  | { type: "network.change" };

export type PowerDeps = {
  wall(): number;
  mono(): number;
  read(): Promise<PowerSource | undefined>; // undefined: no battery, or it cannot be read
  // Asks the OS to stay awake; returns the release. `failed` is called if the OS tool is missing or exits by itself.
  hold(failed: () => void): () => void;
  addresses(): string;
};

// `pmset -g batt`: "Now drawing from 'AC Power'" then, on a laptop, a line with "96%; charging". A desktop has no "%".
export function parsePmset(text: string): PowerSource | undefined {
  const percent = /(\d+)%/.exec(text);
  return percent ? { onBattery: text.includes("'Battery Power'"), percent: Number(percent[1]) } : undefined;
}

// Linux: the first battery of the machine itself; `scope` "Device" is a mouse or a keyboard.
// shortcut: one battery; a laptop with two reports the first, add them up when someone has one.
export async function readSysfs(dir = "/sys/class/power_supply"): Promise<PowerSource | undefined> {
  const text = (path: string) => readFile(path, "utf8").then((value) => value.trim(), () => "");
  for (const name of await readdir(dir).catch(() => [])) {
    if ((await text(`${dir}/${name}/type`)) !== "Battery" || (await text(`${dir}/${name}/scope`)) === "Device") continue;
    const capacity = await text(`${dir}/${name}/capacity`);
    if (/^\d+$/.test(capacity)) return { onBattery: (await text(`${dir}/${name}/status`)) === "Discharging", percent: Number(capacity) };
  }
  return undefined;
}

// OS tools, no native helper (ADR-121). Both hold commands end by themselves when the daemon dies, however it dies.
// Neither stops the sleep of a closed lid: only idle sleep is held.
const HOLD: Partial<Record<NodeJS.Platform, (pid: string) => string[]>> = {
  darwin: (pid) => ["caffeinate", "-i", "-w", pid], // -i: no idle sleep; -w: until this pid exits
  linux: (pid) => ["systemd-inhibit", "--what=idle", "--who=Jaari", "--why=Jaari is working", "tail", `--pid=${pid}`, "-f", "/dev/null"],
};

export function systemPowerDeps(platform = process.platform): PowerDeps {
  return {
    wall: Date.now,
    mono: () => performance.now(),
    read: platform === "darwin"
      ? () => promisify(execFile)("pmset", ["-g", "batt"], { timeout: 5_000 }).then(({ stdout }) => parsePmset(stdout), () => undefined)
      : platform === "linux" ? () => readSysfs() : () => Promise.resolve(undefined),
    hold(failed) {
      const command = HOLD[platform]?.(String(process.pid));
      if (!command) return (failed(), () => {});
      const child = spawn(command[0]!, command.slice(1), { stdio: "ignore" });
      child.on("error", failed); // the tool is not installed
      child.on("exit", (code) => void (code && failed())); // it refused; `code` is null when we killed it
      return () => void child.kill();
    },
    // Link-local addresses are left out: they do not change with the network.
    addresses: () => Object.entries(networkInterfaces())
      .flatMap(([name, list]) => (list ?? []).filter((a) => !a.internal && !a.address.startsWith("fe80:")).map((a) => `${name}=${a.address}`)).sort().join(" "),
  };
}

export type PowerOptions = {
  emit(event: PowerEvent): void;
  stayAwake: StayAwake;
  batteryPausePercent?: number; // background work pauses below this on battery (ADR-057: 20)
  sleepGapMs?: number;
  tickMs?: number;
  deps?: Partial<PowerDeps>;
};

export function createPowerWatch(options: PowerOptions) {
  const { emit, stayAwake } = options;
  const deps = { ...systemPowerDeps(), ...options.deps };
  const threshold = options.batteryPausePercent ?? 20;
  const sleepGap = options.sleepGapMs ?? 120_000;
  let wall = deps.wall();
  let mono = deps.mono();
  let network = deps.addresses();
  let source: PowerSource | undefined;
  let low = false; // reported in this battery cycle; a cycle ends on mains power
  let working = 0;
  let release: (() => void) | undefined;
  let holdFailed = false;

  // "working" holds only on mains power, or when the machine has no battery (ADR-057).
  function sync() {
    const want = !holdFailed && (stayAwake === "always" || (stayAwake === "working" && working > 0 && !source?.onBattery));
    if (want && !release) {
      // shortcut: after one failure no hold is tried again until the daemon restarts; `jaari doctor` reports it (roadmap 0.12)
      release = deps.hold(() => {
        if (!holdFailed) emit({ type: "power.hold.failed" });
        holdFailed = true;
      });
    } else if (!want && release) {
      release();
      release = undefined;
    }
  }

  async function tick() {
    const [nowWall, nowMono] = [deps.wall(), deps.mono()];
    // The larger gap: the monotonic clock stops during sleep on Linux and may count it on macOS, and the wall
    // clock can be set back. A frozen process or a wall clock set forward looks the same and is reported too.
    const gap = Math.max(nowWall - wall, nowMono - mono);
    [wall, mono] = [nowWall, nowMono];
    if (gap > sleepGap) emit({ type: "power.wake", gapMs: Math.round(gap) });
    const addresses = deps.addresses();
    if (addresses !== network) emit({ type: "network.change" });
    network = addresses;
    const next = await deps.read();
    if (next && next.onBattery !== source?.onBattery) emit({ type: "power.source", ...next });
    source = next;
    if (!source?.onBattery) low = false;
    else if (source.percent < threshold && !low) {
      low = true;
      emit({ type: "power.battery.low", percent: source.percent });
    }
    sync();
  }

  // A failed tick (a full disk under `emit`) must not stop the next one. The timer does not keep the process alive.
  const timer = setInterval(() => void tick().catch(() => {}), options.tickMs ?? 30_000);
  timer.unref();

  return {
    tick, // the daemon runs one at start, so the power source is known before the first turn
    // Call when work starts; call the result when it ends. Calls nest.
    working(): () => void {
      working++;
      sync();
      let done = false;
      return () => {
        if (done) return;
        done = true;
        working--;
        sync();
      };
    },
    // For background work, when it exists (roadmap 1.4 and later): the main session never pauses for the battery.
    backgroundPaused: () => source?.onBattery === true && source.percent < threshold,
    stop() {
      clearInterval(timer);
      release?.();
      release = undefined;
    },
  };
}
