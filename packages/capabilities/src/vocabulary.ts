// The only capability names the model can ask for (ADR-018, ADR-034, ADR-039, ADR-095).
// Mirrors the capability table in docs/SECURITY_MODEL.md; change both together, with an ADR.
export const CAPABILITIES = {
  "web.search": "read",
  "web.fetch": "read",
  "browser.read": "read",
  "browser.act": "gated",
  "browser.submit": "gated",
  "computer.use": "gated",
  shell: "gated",
  "files.read": "read",
  "files.write": "gated",
  "email.read": "read",
  "email.send": "gated",
  "calendar.freebusy": "read",
  "calendar.read": "read",
  "calendar.write": "gated",
  publish: "reserved",
  "repo.write": "reserved",
  pay: "reserved",
  "llm.escalate": "policy",
  "mcp.read": "read",
  "mcp.act": "gated",
  "contacts.read": "read",
  "contacts.write": "gated",
  "storage.read": "read",
  "storage.write": "gated",
  "vault.write": "gated",
  "memory.read": "read",
  "memory.erase": "gated",
  "skill.read": "read",
  "takeover.request": "takeover",
} as const satisfies Record<string, CapabilityClass>;

// read runs; gated needs approval; policy is checked in code (children only);
// reserved has no executor in v1 and fails closed; takeover hands a step to the owner.
export type CapabilityClass = "read" | "gated" | "policy" | "reserved" | "takeover";
export type CapabilityName = keyof typeof CAPABILITIES;

export const CAPABILITY_NAMES = Object.keys(CAPABILITIES) as CapabilityName[];
