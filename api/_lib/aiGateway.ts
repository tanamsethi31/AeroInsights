// api/_lib/aiGateway.ts
//
// Upstream LLM provider resolver. Returns the first configured path in
// priority order:
//
//   1. CEREBRAS_API_KEY      — Cerebras Cloud direct (OpenAI-compatible).
//                              Llama 3.3 70B on dedicated silicon. Free
//                              tier: 64K TPM / 60 RPM / 1M TPD — about
//                              13× Groq's TPM headroom, large enough for
//                              the agent's tool-heavy 4-5K-token-per-call
//                              shape. Production path as of 2026-06.
//
//   2. GROQ_API_KEY          — Groq direct. Free tier 30 RPM but only
//                              5K TPM — kept as safety-net fallback in
//                              case Cerebras ever errors.
//
//   3. GEMINI_API_KEY        — Google AI Studio direct. Gated by project-
//                              level billing config; left wired but rarely
//                              used (prepay snags). Fallback below Groq.
//
//   4. AI_GATEWAY_API_KEY    — Vercel AI Gateway. Multi-provider proxy.
//
//   5. AZURE_OPENAI_*        — Legacy Azure OpenAI deployment.
//
// All five speak the OpenAI chat-completions JSON shape, so api/ai/chat.ts
// and api/ai/narrative.ts pass through unchanged — this module only swaps
// URL + auth header + injected model name.

const CEREBRAS_URL   = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "llama-3.3-70b";

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

/**
 * Resolve ALL configured upstream providers in priority order, so the
 * caller can try each in turn until one succeeds. Used for runtime
 * fallback: if Cerebras is up the first call wins; if it's blocked by
 * Cloudflare or rate-limited, the caller retries against Groq without
 * telling the user anything went wrong.
 */
export function resolveAiUpstreams(): AiUpstreamConfig[] {
  const configs: AiUpstreamConfig[] = [];

  // ─── Path 1: Cerebras (direct, OpenAI-compat) ─────────────────────────
  // NB: Cerebras's free-tier endpoint sits behind a Cloudflare WAF that
  //     can block cloud-IP traffic (Vercel Edge gets flagged as bots).
  //     Sending an explicit User-Agent + Accept header makes the request
  //     look more like a real client. If CF still 403s, the caller falls
  //     back to Groq automatically.
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  if (cerebrasKey) {
    configs.push({
      useGateway:   true,
      url:          CEREBRAS_URL,
      headers:      {
        Authorization:  `Bearer ${cerebrasKey}`,
        "Content-Type": "application/json",
        "Accept":       "application/json, text/event-stream",
        "User-Agent":   "aeroinsights/1.0 (+https://aeroinsights.vercel.app)",
      },
      defaultModel: process.env.CEREBRAS_MODEL ?? CEREBRAS_MODEL,
    });
  }

  // ─── Path 2: Groq (direct, OpenAI-compat) — safety-net fallback ───────
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    configs.push({
      useGateway:   true,
      url:          GROQ_URL,
      headers:      {
        Authorization:  `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      defaultModel: process.env.GROQ_MODEL ?? GROQ_MODEL,
    });
  }

  // ─── Path 3: Google AI Studio (direct Gemini via OpenAI-compat) ───────
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    configs.push({
      useGateway:   true,
      url:          GEMINI_URL,
      headers:      {
        Authorization:  `Bearer ${geminiKey}`,
        "Content-Type": "application/json",
      },
      defaultModel: process.env.GEMINI_MODEL ?? GEMINI_MODEL,
    });
  }

  // ─── Path 4: Vercel AI Gateway (multi-provider proxy) ─────────────────
  const gatewayKey = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    configs.push({
      useGateway:   true,
      url:          GATEWAY_URL,
      headers:      {
        Authorization:  `Bearer ${gatewayKey}`,
        "Content-Type": "application/json",
      },
      defaultModel: process.env.AI_GATEWAY_MODEL ?? DEFAULT_MODEL,
    });
  }

  // ─── Path 5: Legacy Azure OpenAI ──────────────────────────────────────
  const azureUrl = process.env.AZURE_OPENAI_URL;
  const azureKey = process.env.AZURE_OPENAI_KEY;
  if (azureUrl && azureKey) {
    configs.push({
      useGateway:   false,
      url:          azureUrl,
      headers:      {
        "api-key":      azureKey,
        "Content-Type": "application/json",
      },
      defaultModel: "",
    });
  }

  return configs;
}

/** Back-compat single-resolver — returns the highest-priority configured upstream. */
export function resolveAiUpstream(): AiUpstreamConfig | null {
  return resolveAiUpstreams()[0] ?? null;
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
