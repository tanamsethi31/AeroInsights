// api/_lib/aiGateway.ts
//
// T-6.4 — Vercel AI Gateway proxy. The Gateway exposes an
// OpenAI-compatible REST surface at https://ai-gateway.vercel.sh/v1/
// so the existing OpenAI-shape request bodies used by api/ai/chat.ts
// and api/ai/narrative.ts pass through unchanged — we only rewrite
// the URL, swap auth header, and inject the provider/model string.
//
// Benefits over the direct Azure OpenAI path:
//   • Single dashboard for usage + cost across all providers.
//   • Provider fallback chains (e.g. anthropic/claude-3.5-sonnet →
//     openai/gpt-4o) configurable in the Vercel dashboard.
//   • Zero data retention by default.
//   • No PII to Azure-specific config — operators can rotate
//     providers without redeploying.
//
// Falls back to Azure when AI_GATEWAY_API_KEY isn't set so existing
// deployments keep working until operators flip the switch.

const GATEWAY_URL   = "https://ai-gateway.vercel.sh/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";

export interface AiUpstreamConfig {
  /** True when AI_GATEWAY_API_KEY is set — caller can decide to use
   *  streaming or other Gateway-specific features. */
  useGateway: boolean;
  url:        string;
  headers:    Record<string, string>;
  /** When using the Gateway, the caller MUST inject this model string
   *  into the request body. We expose it so the per-route prompt
   *  builders can override (e.g. switch to a cheaper model for the
   *  narrative endpoint). */
  defaultModel: string;
}

/** Resolve the upstream config based on env. */
export function resolveAiUpstream(): AiUpstreamConfig | null {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    return {
      useGateway:   true,
      url:          GATEWAY_URL,
      headers:      {
        Authorization:  `Bearer ${gatewayKey}`,
        "Content-Type": "application/json",
      },
      defaultModel: process.env.AI_GATEWAY_MODEL ?? DEFAULT_MODEL,
    };
  }
  const azureUrl = process.env.AZURE_OPENAI_URL;
  const azureKey = process.env.AZURE_OPENAI_KEY;
  if (azureUrl && azureKey) {
    return {
      useGateway:   false,
      url:          azureUrl,
      headers:      {
        "api-key":      azureKey,
        "Content-Type": "application/json",
      },
      // Azure URL already encodes the deployment/model — defaultModel
      // unused on this path; callers leave the body's `model` field
      // alone.
      defaultModel: "",
    };
  }
  return null;
}

/**
 * Add the model field to an OpenAI-shape request body. Idempotent —
 * if the body already includes a `model`, we trust the caller's choice
 * and leave it alone. Returns a new object; doesn't mutate input.
 */
export function withModel(body: unknown, model: string): Record<string, unknown> {
  const b = (body && typeof body === "object") ? body as Record<string, unknown> : {};
  if (typeof b.model === "string" && b.model.length > 0) return b;
  return { ...b, model };
}
