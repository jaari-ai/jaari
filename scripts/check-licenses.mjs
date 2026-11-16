// Fails if any installed npm package has a licence outside the ADR-014 allowlist (ADR-043).
import { execFileSync } from "node:child_process";

// ADR-014 list; BlueOak-1.0.0 added 2026-11-16 (permissive, MIT-compatible; used by minimatch).
const ALLOWED = new Set([
  "MIT", "ISC", "0BSD", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "MPL-2.0", "BlueOak-1.0.0",
]);

// shortcut: compound SPDX expressions such as "(MIT OR CC0-1.0)" fail closed; parse them when one shows up.
const byLicense = JSON.parse(execFileSync("pnpm", ["licenses", "list", "--json"], { encoding: "utf8" }));
const bad = Object.entries(byLicense).filter(([license]) => !ALLOWED.has(license));

for (const [license, pkgs] of bad) {
  console.error(`${license}: ${pkgs.map((p) => `${p.name}@${p.versions.join(",")}`).join(", ")}`);
}
if (bad.length > 0) {
  console.error("Licences above are not on the ADR-014 allowlist (scripts/check-licenses.mjs).");
  process.exit(1);
}
console.log(`Licences OK: ${Object.keys(byLicense).sort().join(", ")}`);
