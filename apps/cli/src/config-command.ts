// `jaari config <step> [--home <dir>]`: revisit one step of `jaari init` and leave the rest of the config as it is (ADR-056).
import { init, STEPS, type Step } from "./init.js";
import type { Command } from "./io.js";

export const run: Command = async (args, io) => {
  const [step, ...rest] = args;
  if (!STEPS.includes(step as Step)) {
    io.output.write(`usage: jaari config <${STEPS.join(" | ")}> [--home <dir>]\n`);
    return 2;
  }
  return init(rest, io, process.platform, step as Step);
};
