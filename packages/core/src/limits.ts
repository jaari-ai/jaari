// In its own file so the config schema can read the names without loading the agent loop.
// Defaults of ADR-031 and ADR-065; the owner's config may replace each one.
export const LIMITS = {
  stepsPerTurn: 25,
  stallSteps: 2, // steps in a row whose tool calls all failed
  sameErrors: 3, // identical tool errors in one turn
  watchdogMs: 300_000,
  watchdogTickMs: 5_000,
  sleepGapMs: 120_000, // a longer gap between two ticks is sleep, not a stall (ADR-057)
  reserveTokens: 16_384,
  keepRecentTokens: 20_000,
  repeatStopMs: 10_000, // a second stop word within this time cuts the turn (ADR-116)
};
export type Limits = typeof LIMITS;
