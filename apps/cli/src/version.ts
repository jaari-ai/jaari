// The version of this Jaari. The release script writes it into this package's manifest (ADR-122); a checkout says 0.0.0.
import { createRequire } from "node:module";

export const VERSION = (createRequire(import.meta.url)("../package.json") as { version: string }).version;
