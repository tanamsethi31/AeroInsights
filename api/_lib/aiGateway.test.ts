import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveAiUpstream, withModel } from "./aiGateway";

const ENV_KEYS = [
  "AI_GATEWAY_API_KEY",
  "VERCEL_AI_GATEWAY_API_KEY",
  "AI_GATEWAY_MODEL",
  "AZURE_OPENAI_URL",
  "AZURE_OPENAI_KEY",
] as const;

describe("aiGateway", () => {
  const orig: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) { orig[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (orig[k] === undefined) delete process.env[k];
      else process.env[k] = orig[k];
    }
  });

  it("returns null when no AI env vars are set", () => {
    expect(resolveAiUpstream()).toBeNull();
  });

  it("prefers AI Gateway when key is set", () => {
    process.env.AI_GATEWAY_API_KEY = "gw-key";
    const cfg = resolveAiUpstream();
    expect(cfg?.useGateway).toBe(true);
    expect(cfg?.url).toContain("ai-gateway.vercel.sh");
    expect(cfg?.headers.Authorization).toBe("Bearer gw-key");
    expect(cfg?.defaultModel).toBe("anthropic/claude-3.5-sonnet");
  });

  it("respects AI_GATEWAY_MODEL override", () => {
    process.env.AI_GATEWAY_API_KEY = "gw-key";
    process.env.AI_GATEWAY_MODEL   = "openai/gpt-4o";
    expect(resolveAiUpstream()?.defaultModel).toBe("openai/gpt-4o");
  });

  it("accepts VERCEL_AI_GATEWAY_API_KEY as a fallback name", () => {
    process.env.VERCEL_AI_GATEWAY_API_KEY = "vgk";
    const cfg = resolveAiUpstream();
    expect(cfg?.useGateway).toBe(true);
    expect(cfg?.headers.Authorization).toBe("Bearer vgk");
  });

  it("falls back to Azure when only Azure vars are set", () => {
    process.env.AZURE_OPENAI_URL = "https://az.example/v1/chat/completions";
    process.env.AZURE_OPENAI_KEY = "az-key";
    const cfg = resolveAiUpstream();
    expect(cfg?.useGateway).toBe(false);
    expect(cfg?.url).toBe("https://az.example/v1/chat/completions");
    expect(cfg?.headers["api-key"]).toBe("az-key");
  });

  it("Gateway wins when both are set", () => {
    process.env.AI_GATEWAY_API_KEY = "gw";
    process.env.AZURE_OPENAI_URL   = "https://az.example/v1";
    process.env.AZURE_OPENAI_KEY   = "az";
    expect(resolveAiUpstream()?.useGateway).toBe(true);
  });
});

describe("withModel", () => {
  it("injects model when missing", () => {
    expect(withModel({ messages: [] }, "x/y")).toEqual({ messages: [], model: "x/y" });
  });

  it("preserves caller-specified model", () => {
    expect(withModel({ messages: [], model: "z/q" }, "x/y").model).toBe("z/q");
  });

  it("handles non-object input safely", () => {
    expect(withModel(null, "x/y").model).toBe("x/y");
    expect(withModel(undefined, "x/y").model).toBe("x/y");
  });

  it("ignores empty-string model", () => {
    expect(withModel({ model: "" }, "x/y").model).toBe("x/y");
  });
});
