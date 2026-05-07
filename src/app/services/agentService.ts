// src/app/services/agentService.ts
import { AGENT_TOOL_DEFINITIONS, executeTool } from "../components/agent/agentTools";
import { buildPortfolioSummary } from "../components/agent/portfolioSummary";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AgentEvent =
  | { type: "token"; text: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_done" }
  | { type: "action"; path: string; params?: Record<string, number> }
  | { type: "done" }
  | { type: "error"; msg: string };

interface ApiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// ─── Static prompt content ──────────────────────────────────────────────────────

const PLATFORM_SITEMAP = `Dashboard (/): portfolio KPIs, ECL trend, market signals strip, recent scenarios.
Portfolio (/portfolio/analytics): concentration analysis, covenant headroom.
Portfolio > Leases (/portfolio/register): full lease register.
Scenarios (/scenarios/run): Custom Builder — scenario parameter form with sliders.
Deals (/deals/generator): lease pricing and deal analysis.
Risk & ECL (/risk-ecl): ECL overview, stage migration, sensitivity.
Aero Intelligence (/intelligence): macro signals, lessee radar, deal feed, jurisdiction watch.
Counterparties (/counterparties): lessee watchlist, behaviour scores, profile panels.
Jurisdictions (/jurisdictions): Cape Town scores, enforcement data.
Settings > Model Params (/settings/ecl): SICR triggers, concentration policy rules.
Reports (/reports): report templates, export history.`;

const KNOWLEDGE_BASE = `IFRS 9: Stage 1 = performing, 12-month ECL, EIR on gross carrying amount. Stage 2 = SICR triggered, lifetime ECL, EIR on gross. Stage 3 = credit-impaired, lifetime ECL, EIR on net (amortised cost). SICR indicators: 30+ DPD rebuttable presumption, significant PD increase vs origination, watchlist elevation, covenant breach. ECL = PD × LGD × EAD, discounted at original EIR.
IAS 36 VIU: discount rate = pre-tax rate reflecting current market assessment of time value of money and asset-specific risks. ECB deposit rate relevant for EUR-denominated lease streams.
Cape Town Convention: IDERA allows lessor to de-register and export aircraft on lessee default without court order, in ratifying states. CTC score reflects ratification quality + enforcement track record. Ireland, Singapore, UAE: strong. India: improved post-2024 IBC amendments. Brazil, Sri Lanka: moderate with caveats.
Maintenance reserves: typically $150–300/FH and $200–500/cycle for narrowbody aircraft, held by lessor, returned on qualifying shop visit. Security deposits: typically 2–3 months rent, applied on default.
Lease rate factor (LRF): monthly rent ÷ aircraft NBV, typically 0.7–1.1% for narrowbody, 0.55–0.85% for widebody. Revenue/lease ratio: annual lease cost ÷ annual revenue, >8.5% signals stress for most carrier cost structures.`;

function buildSystemPrompt(pageContext: string): string {
  const portfolioSummary = buildPortfolioSummary();
  return [
    `You are Aeroinsights Intelligence, a domain-expert AI analyst embedded in an aircraft lessor portfolio management platform. You have deep knowledge of IFRS 9 ECL methodology, IAS 36 VIU, Cape Town Convention repossession practice, and aviation finance. You only discuss topics within this domain. For regulatory or tax questions, always note "consult your auditor/advisor." For investment decisions, present options with trade-offs — never make a direct recommendation. Respond concisely — prefer tables for comparative data, bullets for lists. When uncertain about specific portfolio data, call the appropriate tool rather than guessing.`,
    ``,
    portfolioSummary,
    ``,
    `User is currently viewing: ${pageContext}`,
    ``,
    `PLATFORM SITEMAP:`,
    PLATFORM_SITEMAP,
    ``,
    `KNOWLEDGE BASE:`,
    KNOWLEDGE_BASE,
    ``,
    `HARD CONSTRAINTS:`,
    `- Never discuss topics outside aviation finance, IFRS 9/16/IAS 36, Cape Town Convention, and this platform's functionality.`,
    `- Never make specific investment recommendations.`,
    `- Always caveat regulatory/tax guidance with "consult your auditor/advisor".`,
    `- For navigate_and_prepopulate: always confirm before executing — the UI will show a confirmation card to the user.`,
    `- When uncertain about specific portfolio data, call the appropriate tool rather than guessing.`,
  ].join("\n");
}

// ─── Azure OpenAI config ────────────────────────────────────────────────────────

function getEndpoint(): string | null {
  return (import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string | undefined) ?? null;
}

function getApiKey(): string | null {
  return (import.meta.env.VITE_AZURE_OPENAI_KEY as string | undefined) ?? null;
}

function getDeployment(): string | null {
  return (
    (import.meta.env.VITE_AZURE_OPENAI_AGENT_DEPLOYMENT as string | undefined) ??
    (import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT as string | undefined) ??
    null
  );
}

export function isConfigured(): boolean {
  return !!(getEndpoint() && getApiKey() && getDeployment());
}

// ─── Core streaming fetch ───────────────────────────────────────────────────────

async function* fetchStream(
  messages: ApiMessage[],
  signal?: AbortSignal
): AsyncGenerator<AgentEvent> {
  const endpoint = getEndpoint()!;
  const apiKey = getApiKey()!;
  const deployment = getDeployment()!;
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        messages,
        tools: AGENT_TOOL_DEFINITIONS,
        tool_choice: "auto",
        stream: true,
        max_tokens: 1024,
        temperature: 0.3,
      }),
      signal,
    });
  } catch (e) {
    yield { type: "error", msg: e instanceof Error ? e.message : "Network error" };
    return;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    yield { type: "error", msg: `API error ${res.status}: ${body}` };
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Accumulate tool call fragments across SSE chunks
  const toolCallAcc: Record<number, { id: string; name: string; args: string }> = {};
  let finishReason: string | null = null;

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") break outer;

      let chunk: {
        choices?: Array<{
          delta?: {
            content?: string;
            tool_calls?: Array<{
              index: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          finish_reason?: string | null;
        }>;
      };
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      if (choice.finish_reason) finishReason = choice.finish_reason;

      const delta = choice.delta;
      if (!delta) continue;

      // Yield text tokens
      if (delta.content) {
        yield { type: "token", text: delta.content };
      }

      // Accumulate tool call fragments
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallAcc[tc.index]) {
            toolCallAcc[tc.index] = {
              id: tc.id ?? "",
              name: tc.function?.name ?? "",
              args: "",
            };
          }
          if (tc.id) toolCallAcc[tc.index].id = tc.id;
          if (tc.function?.name) toolCallAcc[tc.index].name = tc.function.name;
          if (tc.function?.arguments) toolCallAcc[tc.index].args += tc.function.arguments;
        }
      }
    }
  }

  // Execute accumulated tool calls and make second pass
  if (finishReason === "tool_calls" && Object.keys(toolCallAcc).length > 0) {
    const toolCalls: OpenAIToolCall[] = Object.values(toolCallAcc).map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.name, arguments: tc.args },
    }));

    const assistantMsg: ApiMessage = {
      role: "assistant",
      content: null,
      tool_calls: toolCalls,
    };

    const toolResultMsgs: ApiMessage[] = [];

    for (const tc of toolCalls) {
      const toolName = tc.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      if (toolName === "navigate_and_prepopulate") {
        // Yield action event — panel renders confirmation card
        yield { type: "tool_start", name: toolName };
        const path = args.path as string;
        const params = args.params as Record<string, number> | undefined;
        yield { type: "action", path, params };
        toolResultMsgs.push({
          role: "tool",
          content: JSON.stringify({ status: "pending_user_confirmation", path, params }),
          tool_call_id: tc.id,
          name: toolName,
        });
      } else {
        yield { type: "tool_start", name: toolName };
        const result = executeTool(toolName, args);
        yield { type: "tool_done" };
        toolResultMsgs.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: tc.id,
          name: toolName,
        });
      }
    }

    // Recurse: second fetch with tool results appended
    yield* fetchStream([...messages, assistantMsg, ...toolResultMsgs], signal);
    return;
  }

  yield { type: "done" };
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export async function* streamAgentResponse(
  conversationMessages: Array<{ role: "user" | "assistant"; content: string }>,
  pageContext: string,
  signal?: AbortSignal
): AsyncGenerator<AgentEvent> {
  if (!isConfigured()) {
    yield {
      type: "error",
      msg: "Agent not configured. Set VITE_AZURE_OPENAI_ENDPOINT, VITE_AZURE_OPENAI_KEY, and VITE_AZURE_OPENAI_AGENT_DEPLOYMENT in your .env file.",
    };
    return;
  }

  const systemMsg: ApiMessage = {
    role: "system",
    content: buildSystemPrompt(pageContext),
  };

  const apiMessages: ApiMessage[] = [
    systemMsg,
    ...conversationMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  yield* fetchStream(apiMessages, signal);
}
