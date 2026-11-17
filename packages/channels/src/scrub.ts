// The ingress secret scrub (ADR-081): known formats only, so hashes, UUIDs and ids stay. Deterministic code, no model.
// shortcut: no exact-value match against the vault's values (ADR-016), add it when a vault provider can list them (roadmap 3.3)

// Luhn: one mistyped digit fails, so a random 16-digit id passes only one time in ten.
function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}

const END = "(?![A-Za-z0-9_-])"; // a key ends where its alphabet ends

// Order matters: whole blocks first, so a key inside a PEM block or a JWT is not reported twice.
const RULES: { kind: string; pattern: RegExp; check?: (match: string) => boolean }[] = [
  { kind: "private key", pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----/g },
  { kind: "token", pattern: new RegExp(`\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}${END}`, "g") }, // JWT
  { kind: "api key", pattern: new RegExp(`\\bsk-[A-Za-z0-9_-]{20,}${END}`, "g") }, // OpenAI, Anthropic (sk-ant-), and others
  { kind: "token", pattern: new RegExp(`\\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})${END}`, "g") },
  { kind: "token", pattern: new RegExp(`\\bxox[abpors]-[A-Za-z0-9-]{10,}${END}`, "g") }, // Slack
  { kind: "api key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g }, // AWS access key id
  { kind: "api key", pattern: new RegExp(`\\bAIza[A-Za-z0-9_-]{35}${END}`, "g") }, // Google
  { kind: "token", pattern: new RegExp(`\\b\\d{6,12}:[A-Za-z0-9_-]{35}${END}`, "g") }, // Telegram bot
  // Issuer prefixes (Visa, Mastercard, Amex, Discover, JCB, UnionPay, Diners) keep timestamps and long ids out.
  { kind: "card number", pattern: /\b\d(?:[ -]?\d){12,18}\b/g, check: (m) => /^(4|5[1-5]|2[2-7]|3[47]|6(?:011|5|4[4-9]|2)|35|30[0-5]|36|38)/.test(m.replace(/\D/g, "")) && luhn(m.replace(/\D/g, "")) },
];

// The label stays so the owner sees what was removed; a value another rule already removed is left alone.
const LABELLED = /\b(password|passwd|pwd|passphrase)(\s*[:=]\s*)(?!\[secret removed)(\S+)/gi;

const removed = (kind: string) => `[secret removed: ${kind}]`;

export function scrubSecrets(text: string): { text: string; kinds: string[] } {
  const kinds = new Set<string>();
  for (const { kind, pattern, check } of RULES) {
    text = text.replace(pattern, (match) => (check && !check(match) ? match : (kinds.add(kind), removed(kind))));
  }
  text = text.replace(LABELLED, (_, label: string, separator: string) => (kinds.add("password"), `${label}${separator}${removed("password")}`));
  return { text, kinds: [...kinds] };
}
