import { describe, expect, it } from "vitest";
import { checkLlmConfig, isLocal, type LlmConfig } from "./config.js";

// The llm section of jaari.config.example.jsonc, without its comments.
const example = (): LlmConfig => ({
  providers: {
    local: { api: "openai-completions", baseUrl: "http://localhost:11434/v1" },
    anthropic: { apiKey: "secretRef:llm.anthropic" },
    openrouter: { apiKey: "secretRef:llm.openrouter" },
  },
  tiers: {
    small: ["local/<small-model>", "openrouter/<cheap-model>"],
    medium: ["local/<mid-model>", "anthropic/<mid-model>"],
    large: ["anthropic/<frontier-model>", "openrouter/<frontier-model>"],
  },
  roles: {
    main: "large", child: "medium", canonicalize: "medium", curiosity: "small", classify: "small", summarize: "small",
    title: "small", reader: "small", vision: { capability: "image" }, stt: "local/whisper.cpp", tts: "local/piper",
  },
  budget: { monthlyUsd: 20 },
  escalation: { allowRequest: ["child"] },
});

describe("checkLlmConfig", () => {
  it("accepts the example config", () => {
    expect(() => checkLlmConfig(example())).not.toThrow();
  });

  it.each<[string, (c: LlmConfig) => void, string]>([
    ["a built-in provider without apiKey", (c) => delete c.providers.anthropic!.apiKey, "a built-in provider needs apiKey"],
    ["api without baseUrl", (c) => delete c.providers.local!.baseUrl, "api and baseUrl go together"],
    ["a plaintext key", (c) => (c.providers.anthropic!.apiKey = "sk-live"), "/providers/anthropic/apiKey"],
    ["an unknown provider in a tier", (c) => c.tiers.small!.push("nowhere/x"), 'unknown provider in "nowhere/x"'],
    ["a role naming no tier", (c) => (c.roles.title = "huge"), '"huge" is neither a tier nor a provider/model'],
    ["an unknown field", (c) => Object.assign(c, { extra: 1 }), "invalid llm config"],
    ["a local-only role that reaches an API", (c) => (c.privacy = { localOnly: ["canonicalize"] }), "local-only but reaches anthropic/<mid-model>"],
  ])("refuses %s", (_, change, message) => {
    const config = example();
    change(config);
    expect(() => checkLlmConfig(config)).toThrow(message);
  });

  it("accepts a local-only role whose tier is all local", () => {
    const config = example();
    config.tiers.private = ["local/<mid-model>"];
    config.roles.canonicalize = "private";
    config.privacy = { localOnly: ["canonicalize"] };
    expect(() => checkLlmConfig(config)).not.toThrow();
  });
});

describe("isLocal", () => {
  it.each([
    ["http://localhost:11434/v1", true], ["http://127.0.0.1:1234", true], ["http://192.168.1.5:8080", true],
    ["http://[::1]:11434", true], ["http://ollama:11434/v1", true],
    ["https://api.example.com/v1", false], ["http://8.8.8.8/v1", false], [undefined, false],
  ])("%s is local: %s", (baseUrl, expected) => {
    expect(isLocal(baseUrl ? { api: "openai-completions", baseUrl } : {})).toBe(expected);
  });
});
