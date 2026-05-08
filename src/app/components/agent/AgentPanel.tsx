// src/app/components/agent/AgentPanel.tsx
import * as React from "react";
import { useLocation } from "react-router";
import { Zap, X, Minus, Send, ChevronDown } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { useAgent } from "../../contexts/AgentContext";
import { streamAgentResponse } from "../../services/agentService";
import { AgentMessage, type ActionCard } from "./AgentMessage";
import { AgentSuggestions } from "./AgentSuggestions";

// Per-user daily limit shown in the UI. Must match AI_USER_DAILY_LIMIT on the server.
const USAGE_LIMIT = Math.max(
  1,
  parseInt((import.meta.env.VITE_AI_DAILY_LIMIT as string | undefined) ?? "5", 10),
);
const USAGE_WARN = Math.max(1, USAGE_LIMIT - 1); // warn at 1 remaining

// ─── Pending action tracker ─────────────────────────────────────────────────────

interface PendingAction {
  messageId: string;
  path: string;
  params?: Record<string, number>;
}

// ─── Actions quick-send menu ────────────────────────────────────────────────────

const ACTION_PRESETS = [
  {
    label: "Run Scenario",
    text: "Pre-populate the Custom Builder with today's market data and open it for me",
  },
  {
    label: "Generate Report",
    text: "Guide me to generate a Board report for this quarter",
  },
  {
    label: "Export Data",
    text: "How do I export my ECL data to Excel?",
  },
];

function ActionsMenu({ onSelect }: { onSelect: (text: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "0 10px",
          height: "34px",
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.22)",
          borderRadius: "6px",
          fontSize: "0.8125rem",
          color: "rgba(255,255,255,0.85)",
          cursor: "pointer",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        Actions
        <ChevronDown
          size={12}
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 150ms ease",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            zIndex: 10,
            minWidth: "180px",
            overflow: "hidden",
          }}
        >
          {ACTION_PRESETS.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                onSelect(a.text);
                setOpen(false);
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
              }
              style={{
                display: "block",
                width: "100%",
                padding: "9px 14px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                fontSize: "0.8125rem",
                color: "#0F172A",
                cursor: "pointer",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────────────

export function AgentPanel() {
  const location = useLocation();
  const { getAccessTokenSilently } = useAuth0();
  const {
    isOpen,
    setIsOpen,
    isMinimized,
    setIsMinimized,
    messages,
    addMessage,
    updateMessage,
    usage,
    incrementUsage,
    pageContext,
  } = useAgent();

  const [input, setInput] = React.useState("");
  const [isThinking, setIsThinking] = React.useState(false);
  const [toolIndicators, setToolIndicators] = React.useState<Record<string, string>>({});
  const [pendingActions, setPendingActions] = React.useState<PendingAction[]>([]);
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Scroll to bottom on new message
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cancel in-flight request on unmount
  React.useEffect(() => () => { abortRef.current?.abort(); }, []);

  const atLimit = usage.count >= USAGE_LIMIT;
  const nearLimit = usage.count >= USAGE_WARN && !atLimit;

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isThinking || atLimit) return;

    setInput("");
    incrementUsage();

    const userMsgId = `u-${Date.now()}-${Math.random()}`;
    const assistantMsgId = `a-${Date.now()}-${Math.random()}`;

    addMessage({ id: userMsgId, role: "user", content, timestamp: new Date() });
    addMessage({
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    });

    setIsThinking(true);
    abortRef.current = new AbortController();
    let accText = "";

    // Get the Auth0 token to pass to the server proxy for validation.
    let token: string | undefined;
    try {
      token = await getAccessTokenSilently();
    } catch {
      // Non-fatal: proxy will still work on localhost without a token.
    }

    try {
      const history = [...messages]
        .filter((m) => m.content.trim() !== "" && !m.isStreaming)
        .concat({ role: "user" as const, content } as (typeof messages)[number])
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      for await (const event of streamAgentResponse(
        history,
        pageContext,
        abortRef.current.signal,
        token,
      )) {
        switch (event.type) {
          case "token":
            accText += event.text;
            updateMessage(assistantMsgId, { content: accText });
            break;

          case "tool_start":
            setToolIndicators((prev) => ({
              ...prev,
              [assistantMsgId]: `Looking up ${event.name.replace(/_/g, " ")}…`,
            }));
            break;

          case "tool_done":
            setToolIndicators((prev) => {
              const next = { ...prev };
              delete next[assistantMsgId];
              return next;
            });
            break;

          case "action":
            setPendingActions((prev) => [
              ...prev,
              { messageId: assistantMsgId, path: event.path, params: event.params },
            ]);
            break;

          case "done":
            updateMessage(assistantMsgId, { isStreaming: false });
            break;

          case "error":
            updateMessage(assistantMsgId, {
              content: `[!] ${event.msg}`,
              isStreaming: false,
            });
            break;
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        updateMessage(assistantMsgId, {
          content: "An unexpected error occurred. Please try again.",
          isStreaming: false,
        });
      }
    } finally {
      setIsThinking(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function getActionCard(msgId: string): ActionCard | undefined {
    const found = pendingActions.find((a) => a.messageId === msgId);
    return found ? { path: found.path, params: found.params } : undefined;
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        width: isMinimized ? "48px" : "360px",
        flexShrink: 0,
        // No explicit height — flex align-self:stretch (default) fills the row height.
        // height:100% would resolve to 'auto' if the parent has no pinned height.
        alignSelf: "stretch",
        background: "#FFFFFF",
        borderLeft: "1px solid #E2E8F0",
        boxShadow: "-4px 0 16px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "agentSlideIn 240ms cubic-bezier(0.32,0.72,0,1)",
        transition: "width 180ms ease",
      }}
    >
      <style>{`
        @keyframes agentSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        .agent-input::placeholder { color: rgba(255,255,255,0.40); }
      `}</style>

      {/* Header bar — 56px */}
      <div
        style={{
          height: "56px",
          background: "#002147",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <Zap size={16} color="#FFFFFF" />
        {!isMinimized && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#FFFFFF" }}>
              Aeroinsights Intelligence
            </div>
            <div style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.55)" }}>
              GPT-4o · EU West · Data stays in region
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: "4px", marginLeft: isMinimized ? "auto" : undefined }}>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            aria-label={isMinimized ? "Expand panel" : "Minimise panel"}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.65)",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close panel"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.65)",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Context strip — 36px — no bottom border; chat area fades in beneath it */}
          <div
            style={{
              height: "36px",
              background: "rgba(0,33,71,0.05)",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: "#94A3B8",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {pageContext}
            </span>
          </div>

          {/* Chat area — solid top border, gradient fade at bottom into input */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              paddingTop: "12px",
              paddingBottom: "20px",
              background: "rgba(0,33,71,0.07)",
              borderTop: "1px solid #E2E8F0",
              WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)",
              maskImage: "linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)",
            }}
          >
            {messages.length === 0 && (
              <AgentSuggestions
                pathname={location.pathname}
                onSelect={(t) => void handleSend(t)}
              />
            )}
            {messages.map((msg) => (
              <AgentMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                isStreaming={msg.isStreaming}
                toolIndicator={toolIndicators[msg.id]}
                actionCard={getActionCard(msg.id)}
              />
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div
            style={{
              background: "#002147",
              padding: "10px 12px",
              display: "flex",
              gap: "8px",
              alignItems: "flex-end",
              flexShrink: 0,
            }}
          >
            <ActionsMenu onSelect={(t) => void handleSend(t)} />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                atLimit
                  ? `You've used all ${USAGE_LIMIT} AI queries for today. Resets at midnight UTC.`
                  : "Ask about your portfolio…"
              }
              disabled={atLimit || isThinking}
              rows={1}
              className="agent-input"
              style={{
                flex: 1,
                resize: "none",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "8px",
                padding: "8px 10px",
                fontSize: "0.875rem",
                color: "#FFFFFF",
                fontFamily: "inherit",
                outline: "none",
                lineHeight: 1.5,
                minHeight: "36px",
                maxHeight: "120px",
                overflowY: "auto",
                background: atLimit ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.09)",
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isThinking || atLimit}
              aria-label="Send message"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background:
                  !input.trim() || isThinking || atLimit
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(255,255,255,0.92)",
                border: "none",
                cursor:
                  !input.trim() || isThinking || atLimit ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 150ms ease",
              }}
            >
              <Send
                size={15}
                color={
                  !input.trim() || isThinking || atLimit ? "rgba(255,255,255,0.35)" : "#002147"
                }
              />
            </button>
          </div>

          {/* Footer — 28px */}
          <div
            style={{
              height: "28px",
              background: "#002147",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: nearLimit ? "#FCD34D" : "rgba(255,255,255,0.45)",
                fontWeight: nearLimit ? 600 : 400,
              }}
            >
              {usage.count} / {USAGE_LIMIT} queries today
              {nearLimit && " — last query remaining"}
            </span>
            <span
              title={`Daily limit: ${USAGE_LIMIT} queries per user. Resets at midnight UTC.`}
              style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", cursor: "help" }}
            >
              ⓘ
            </span>
          </div>
        </>
      )}
    </div>
  );
}
