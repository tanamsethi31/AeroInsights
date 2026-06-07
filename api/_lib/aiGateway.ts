// api/_lib/aiGateway.ts
//
// Upstream LLM provider resolver. Returns the first configured path in
// priority order:
//
//   1. GEMINI_API_KEY        — Google AI Studio direct (OpenAI-compatible).
//                              Pay-as-you-go on gemini-2.0-flash with a
//                              project-level budget cap. The production
//                              path as of 2026-06. Billing must be enabled
//                              on the GCP project the key belongs to.
//
//   2. GROQ_API_KEY          — Groq direct (OpenAI-compatible). Free tier
//                              30 req/min on llama-3.3-70b-versatile.
//                              Kept as a safety-net fallback in case
//                              Gemini ever returns an error.
//
//   3. AI_GATEWAY_API_KEY    — Vercel AI Gateway. Multi-provider, single
//                              dashboard for cost + fallback chains. Free
//                              $5 credit but requires a card on file.
//
//   4. AZURE_OPENAI_*        — Legacy Azure OpenAI deployment.
//
// All four speak the OpenAI chat-completions JSON shape, so api/ai/chat.ts
// and api/ai/narrative.ts pass through unchanged — this module only swaps
// URL + auth header + injected model name.

const GROQ_URL      = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL    = "llama-3.3-70b-versatile";

const GEMINI_URL    = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_MODEL  = "gemini-2.0-flash";

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
  // ─── Path 1: Google AI Studio (direct Gemini via OpenAI-compat) ───────
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return {
      useGateway:   true, // semantics: "caller must inject model into body"
      url:          GEMINI_URL,
      headers:      {
        Authorization:  `Bearer ${geminiKey}`,
        "Content-Type": "application/json",
      },
      defaultModel: process.env.GEMINI_MODEL ?? GEMINI_MODEL,
    };
  }

  // ─── Path 2: Groq (direct, OpenAI-compat) — safety-net fallback ───────
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      useGateway:   true,
      url:          GROQ_URL,
      headers:      {
        Authorization:  `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      defaultModel: process.env.GROQ_MODEL ?? GROQ_MODEL,
    };
  }

  // ─── Path 2: Vercel AI Gateway (multi-provider proxy) ─────────────────
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
