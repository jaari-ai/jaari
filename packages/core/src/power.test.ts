import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPowerWatch, parsePmset, readSysfs, type PowerEvent, type PowerSource, type StayAwake } from "./power.js";

function watch(stayAwake: StayAwake = "working") {
  const state = { wall: 1_000_000, mono: 5_000, source: undefined as PowerSource | undefined, addresses: "en0=10.0.0.2", holds: 0, held: 0, fail: undefined as (() => void) | undefined };
  const events: PowerEvent[] = [];
  const power = createPowerWatch({
    emit: (event) => events.push(event),
    stayAwake,
    tickMs: 3_600_000,
    deps: {
      wall: () => state.wall,
      mono: () => state.mono,
      read: () => Promise.resolve(state.source),
      addresses: () => state.addresses,
      hold: (failed) => (state.holds++, state.held++, (state.fail = failed), () => void state.held--),
    },
  });
  const pass = (wallMs: number, monoMs = wallMs) => ((state.wall += wallMs), (state.mono += monoMs), power.tick());
  return { state, events, power, pass };
}
const types = (events: PowerEvent[]) => events.map((event) => event.type);

describe("sleep detection (ADR-057)", () => {
  it("reports a gap over 2 minutes as a wake, and a normal tick as nothing", async () => {
    const { events, pass, power } = watch();
    await pass(30_000);
    await pass(120_000); // exactly the limit is not sleep
    expect(events).toEqual([]);
    await pass(180_000, 30_000); // Linux: the monotonic clock stood still during sleep
    await pass(30_000, 180_000); // the wall clock was set back while the machine slept
    expect(events).toEqual([{ type: "power.wake", gapMs: 180_000 }, { type: "power.wake", gapMs: 180_000 }]);
    await pass(30_000); // the gap is measured from the last tick, so one sleep is one wake
    expect(events).toHaveLength(2);
    power.stop();
  });
});

describe("battery (ADR-057)", () => {
  it("reports the source when it changes and a low battery once per cycle", async () => {
    const { state, events, pass, power } = watch();
    state.source = { onBattery: false, percent: 15 };
    await pass(30_000);
    expect(power.backgroundPaused()).toBe(false); // low, but on mains
    state.source = { onBattery: true, percent: 20 };
    await pass(30_000);
    expect(power.backgroundPaused()).toBe(false); // "below 20%": 20 is not below
    state.source = { onBattery: true, percent: 19 };
    await pass(30_000);
    state.source = { onBattery: true, percent: 12 };
    await pass(30_000);
    expect(power.backgroundPaused()).toBe(true);
    expect(types(events)).toEqual(["power.source", "power.source", "power.battery.low"]);
    state.source = { onBattery: false, percent: 12 };
    await pass(30_000);
    state.source = { onBattery: true, percent: 12 };
    await pass(30_000);
    expect(types(events).filter((type) => type === "power.battery.low")).toHaveLength(2); // a new cycle, a new report
    power.stop();
  });

  it("reads pmset and the Linux power_supply folder", async () => {
    expect(parsePmset("Now drawing from 'AC Power'\n -InternalBattery-0 (id=1)\t96%; charging; 0:26 remaining present: true\n")).toEqual({ onBattery: false, percent: 96 });
    expect(parsePmset("Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t7%; discharging; 0:20 remaining present: true\n")).toEqual({ onBattery: true, percent: 7 });
    expect(parsePmset("Now drawing from 'AC Power'\n")).toBeUndefined(); // a desktop

    const dir = await mkdtemp(join(tmpdir(), "jaari-power-"));
    const supply = async (name: string, files: Record<string, string>) => {
      await mkdir(join(dir, name));
      for (const [file, value] of Object.entries(files)) await writeFile(join(dir, name, file), value + "\n");
    };
    await supply("AC", { type: "Mains", online: "0" });
    await supply("ABmouse", { type: "Battery", scope: "Device", capacity: "3", status: "Discharging" });
    await supply("BAT0", { type: "Battery", capacity: "41", status: "Discharging" });
    expect(await readSysfs(dir)).toEqual({ onBattery: true, percent: 41 });
    expect(await readSysfs(join(dir, "missing"))).toBeUndefined();
  });
});

describe("staying awake (ADR-057)", () => {
  it("working: holds while work runs on mains, once for nested work, and not on battery", async () => {
    const { state, pass, power } = watch("working");
    await pass(30_000);
    expect(state.held).toBe(0);
    const first = power.working();
    const second = power.working();
    expect([state.holds, state.held]).toEqual([1, 1]);
    first();
    first(); // a second call of the same release changes nothing
    expect(state.held).toBe(1);
    state.source = { onBattery: true, percent: 80 };
    await pass(30_000); // unplugged during the work: released at the next tick
    expect(state.held).toBe(0);
    state.source = { onBattery: false, percent: 80 };
    await pass(30_000);
    expect(state.held).toBe(1);
    second();
    expect(state.held).toBe(0);
    power.stop();
  });

  it("never holds nothing, always holds from the first tick until stop, also on battery", async () => {
    const never = watch("never");
    never.power.working();
    await never.pass(30_000);
    expect(never.state.holds).toBe(0);
    never.power.stop();

    const always = watch("always");
    always.state.source = { onBattery: true, percent: 50 };
    await always.pass(30_000);
    expect(always.state.held).toBe(1);
    always.power.stop();
    expect(always.state.held).toBe(0);
  });

  it("reports a failed hold once and does not try again", async () => {
    const { state, events, pass, power } = watch("working");
    const done = power.working();
    state.fail!();
    state.fail!();
    done();
    power.working();
    await pass(30_000);
    expect(types(events)).toEqual(["power.hold.failed"]);
    expect(state.holds).toBe(1);
    power.stop();
  });
});

describe("network (ADR-057)", () => {
  it("reports a change of addresses once", async () => {
    const { state, events, pass, power } = watch();
    await pass(30_000);
    state.addresses = "en0=192.168.1.7";
    await pass(30_000);
    await pass(30_000);
    expect(types(events)).toEqual(["network.change"]);
    power.stop();
  });
});
