// src/app/pages/CashFlow.tsx
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/ui/KpiCard";
import { useCashFlow } from "../hooks/useCashFlow";
import { usePortfolioData } from "../hooks/usePortfolioData";
import type { CashEvent, CashEventType, NewCashEvent } from "../utils/cashFlowForecast";
import type { Lease, Lessee } from "../types/portfolio";

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<CashEventType, string> = {
  rent:              "Rent",
  mr_draw:           "MR Draw",
  sd_posted:         "SD Posted",
  sd_draw:           "SD Draw",
  sd_refund:         "SD Refund",
  eol_comp:          "EOL Comp",
  remarketing:       "Remarketing",
  ferry_fee:         "Ferry Fee",
  supplemental_rent: "Suppl. Rent",
  insurance:         "Insurance",
  other:             "Other",
};

const ALL_EVENT_TYPES: CashEventType[] = [
  "rent", "mr_draw", "sd_posted", "sd_draw", "sd_refund",
  "eol_comp", "remarketing", "ferry_fee", "supplemental_rent", "insurance", "other",
];

function pillColor(type: CashEventType): string {
  if (type === "mr_draw") return "#92400E";
  if (type === "sd_refund") return "#991B1B";
  return "#14532D";
}
function pillBg(type: CashEventType): string {
  if (type === "mr_draw") return "#FEF3C7";
  if (type === "sd_refund") return "#FEE2E2";
  return "#DCFCE7";
}

function fmtCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
    notation: Math.abs(amount) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(amount) >= 1_000_000 ? 1 : 0,
  }).format(amount);
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}

function isoMonth(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function monthLabel(isoDate: string): string {
  return new Date(isoDate + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

type ViewMode = "actuals" | "forecast" | "both";
type RangeMonths = 3 | 6 | 12 | 24;

// ── AddCashEventModal ─────────────────────────────────────────────────────────

interface AddCashEventModalProps {
  open:     boolean;
  initial?: Partial<NewCashEvent>;
  editId?:  string;
  leases:   Lease[];
  lessees:  Lessee[];
  onSave:   (e: NewCashEvent) => void;
  onEdit:   (id: string, patch: Partial<NewCashEvent>) => void;
  onClose:  () => void;
}

function AddCashEventModal({
  open, initial, editId, leases, lessees, onSave, onEdit, onClose,
}: AddCashEventModalProps) {
  const [eventType,  setEventType ] = useState<CashEventType>(initial?.eventType  ?? "rent");
  const [leaseId,    setLeaseId   ] = useState<string>(initial?.leaseId    ?? "");
  const [amount,     setAmount    ] = useState<string>(initial?.amount     != null ? String(initial.amount) : "");
  const [currency,   setCurrency  ] = useState<string>(initial?.currency   ?? "USD");
  const [eventDate,  setEventDate ] = useState<string>(initial?.eventDate  ?? "");
  const [isForecast, setIsForecast] = useState<boolean>(initial?.isForecast ?? false);
  const [notes,      setNotes     ] = useState<string>(initial?.notes      ?? "");
  const [leaseSearch, setLeaseSearch] = useState("");

  if (!open) return null;

  const isEdit = Boolean(editId);
  const canSave = eventType && amount.trim() !== "" && !isNaN(Number(amount)) && eventDate.trim() !== "";

  const handleSave = () => {
    if (!canSave) return;
    const payload: NewCashEvent = {
      leaseId:    leaseId || null,
      eventType,
      amount:     Number(amount),
      currency,
      eventDate,
      isForecast,
      notes:      notes.trim() || null,
    };
    if (isEdit && editId) {
      onEdit(editId, payload);
    } else {
      onSave(payload);
    }
    onClose();
  };

  // Filtered leases for searchable select
  const filteredLeases = leaseSearch
    ? leases.filter(l => {
        const lessee = lessees.find(le => le.id === l.lessee_id);
        return (
          l.id.toLowerCase().includes(leaseSearch.toLowerCase()) ||
          (lessee?.name ?? "").toLowerCase().includes(leaseSearch.toLowerCase())
        );
      })
    : leases;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0F172A",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#F8FAFC",
    fontSize: "0.875rem",
    padding: "0.5rem 0.75rem",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "#94A3B8",
    display: "block",
    marginBottom: "0.375rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        style={{
          background: "#1E293B",
          border: "1px solid #334155",
          borderRadius: "12px",
          padding: "1.5rem",
          width: "480px",
          maxWidth: "calc(100vw - 2rem)",
          maxHeight: "calc(100vh - 4rem)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontWeight: 600, fontSize: "1.0625rem", color: "#F8FAFC" }}>
            {isEdit ? "Edit Cash Event" : "Add Cash Event"}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex", alignItems: "center" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Event Type */}
        <div>
          <label style={labelStyle}>Event Type</label>
          <select
            value={eventType}
            onChange={e => setEventType(e.target.value as CashEventType)}
            style={inputStyle}
          >
            {ALL_EVENT_TYPES.map(t => (
              <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Lease (searchable) */}
        <div>
          <label style={labelStyle}>Lease (optional)</label>
          <input
            type="text"
            placeholder="Search lessee or lease ID…"
            value={leaseSearch}
            onChange={e => setLeaseSearch(e.target.value)}
            style={{ ...inputStyle, marginBottom: "0.375rem" }}
          />
          <select
            value={leaseId}
            onChange={e => setLeaseId(e.target.value)}
            style={inputStyle}
          >
            <option value="">— No lease —</option>
            {filteredLeases.map(l => {
              const lessee = lessees.find(le => le.id === l.lessee_id);
              return (
                <option key={l.id} value={l.id}>
                  {lessee?.name ?? "Unknown"} · {l.start_date} → {l.end_date}
                </option>
              );
            })}
          </select>
        </div>

        {/* Amount + Currency row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Amount</label>
            <input
              type="number"
              placeholder="e.g. 150000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              style={{ ...inputStyle, minWidth: "90px" }}
            >
              {["USD", "EUR", "GBP", "AED", "SGD"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date */}
        <div>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Is Forecast */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <input
            id="isForecast"
            type="checkbox"
            checked={isForecast}
            onChange={e => setIsForecast(e.target.checked)}
            style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#3B82F6" }}
          />
          <label htmlFor="isForecast" style={{ fontSize: "0.875rem", color: "#CBD5E1", cursor: "pointer" }}>
            Mark as forecast (not yet received/paid)
          </label>
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            placeholder="Optional notes…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {/* Footer buttons */}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "1px solid #334155",
              color: "#94A3B8", borderRadius: "8px",
              padding: "0.5rem 1.125rem", fontSize: "0.875rem",
              cursor: "pointer", fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              background: canSave ? "#3B82F6" : "#1E3A5F",
              border: "none", color: canSave ? "#FFFFFF" : "#475569",
              borderRadius: "8px", padding: "0.5rem 1.25rem",
              fontSize: "0.875rem", fontWeight: 500,
              cursor: canSave ? "pointer" : "not-allowed",
              transition: "background 150ms",
            }}
          >
            {isEdit ? "Save Changes" : "Add Event"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0F172A", border: "1px solid #334155",
      borderRadius: "8px", padding: "0.75rem 1rem",
      fontSize: "0.8125rem", color: "#F8FAFC",
    }}>
      <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: "#CBD5E1" }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", color: p.fill, marginBottom: "0.125rem" }}>
          <span style={{ color: "#94A3B8" }}>{p.name}</span>
          <span style={{ fontWeight: 500 }}>{fmtCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CashFlow() {
  const { events, actuals, loading, saving, addEvent, editEvent, deleteEvent } = useCashFlow();
  const { leases, lessees } = usePortfolioData();

  // isDemoMode: no persisted actuals → rule-based forecasts from DEMO_LEASES are driving the view
  const isDemoMode = !loading && actuals.length === 0;
  const displayEvents = events;

  const [viewMode,       setViewMode      ] = useState<ViewMode>("both");
  const [rangeMonths,    setRangeMonths   ] = useState<RangeMonths>(12);
  const [selectedLeases, setSelectedLeases] = useState<Set<string> | null>(null); // null = all
  const [clickedMonth,   setClickedMonth  ] = useState<string | null>(null);
  const [modalOpen,      setModalOpen     ] = useState(false);
  const [editTarget,     setEditTarget    ] = useState<CashEvent | null>(null);

  // ── Stable now reference ─────────────────────────────────────────────────

  const now = useMemo(() => new Date(), []);

  // ── Derived: visible events filtered by viewMode + time range ────────────

  const visibleEvents = useMemo(() => {
    const todayStr = now.toISOString().slice(0, 10);
    const rangeEnd = addMonths(now, rangeMonths);
    const rangeEndStr = rangeEnd.toISOString().slice(0, 10);

    let base: CashEvent[] = [];
    if (viewMode === "actuals")       base = displayEvents.filter(e => !e.isForecast && e.source !== "rule");
    else if (viewMode === "forecast") base = displayEvents.filter(e => e.isForecast || e.source === "rule");
    else                              base = displayEvents;

    return base.filter(e => {
      // Only filter out past dates for rule/forecast events — past actuals always appear in the ledger
      if ((e.isForecast || e.source === "rule") && e.eventDate < todayStr) return false;
      if (e.eventDate > rangeEndStr) return false;
      if (selectedLeases !== null && e.leaseId && !selectedLeases.has(e.leaseId)) return false;
      return true;
    });
  }, [displayEvents, viewMode, rangeMonths, selectedLeases, now]);

  // ── KPI calculations ──────────────────────────────────────────────────────
  const currentMonth = isoMonth(now);

  const netReceivedMTD = useMemo(() => {
    return displayEvents
      .filter(e => !e.isForecast && e.source !== "rule" && e.eventDate.slice(0, 7) === currentMonth)
      .reduce((s, e) => s + e.amount, 0);
  }, [displayEvents, currentMonth]);

  const netForecast12m = useMemo(() => {
    const horizon = addMonths(now, 12);
    return displayEvents
      .filter(e => (e.isForecast || e.source === "rule") && new Date(e.eventDate) <= horizon)
      .reduce((s, e) => s + e.amount, 0);
  }, [displayEvents, now]);

  const largestOutflow90d = useMemo(() => {
    const next90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const candidates = displayEvents.filter(
      e => (e.isForecast || e.source === "rule") && e.amount < 0 && new Date(e.eventDate) <= next90
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((min, e) => e.amount < min.amount ? e : min);
  }, [displayEvents, now]);

  const mrDraws90d = useMemo(() => {
    const next90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const candidates = displayEvents.filter(
      e => e.eventType === "mr_draw" && (e.isForecast || e.source === "rule") && new Date(e.eventDate) <= next90
    );
    return { count: candidates.length, total: candidates.reduce((s, e) => s + e.amount, 0) };
  }, [displayEvents, now]);

  // ── Chart data ────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const months: string[] = [];
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    for (let i = 0; i < rangeMonths; i++) {
      months.push(isoMonth(addMonths(start, i)));
    }

    return months.map(month => {
      const monthEvents = visibleEvents.filter(e => e.eventDate.slice(0, 7) === month);
      return {
        month,
        label: monthLabel(month),
        inflowActual:   monthEvents.filter(e => e.amount > 0 && !e.isForecast).reduce((s, e) => s + e.amount, 0),
        outflowActual:  Math.abs(monthEvents.filter(e => e.amount < 0 && !e.isForecast).reduce((s, e) => s + e.amount, 0)),
        inflowForecast:  monthEvents.filter(e => e.amount > 0 &&  e.isForecast).reduce((s, e) => s + e.amount, 0),
        outflowForecast: Math.abs(monthEvents.filter(e => e.amount < 0 &&  e.isForecast).reduce((s, e) => s + e.amount, 0)),
      };
    });
  }, [visibleEvents, rangeMonths, now]);

  // ── Ledger rows (filtered by clicked month if any) ────────────────────────

  const ledgerRows = useMemo(() => {
    if (!clickedMonth) return visibleEvents;
    return visibleEvents.filter(e => e.eventDate.slice(0, 7) === clickedMonth);
  }, [visibleEvents, clickedMonth]);

  // ── Lessee lookup ─────────────────────────────────────────────────────────

  const lesseeByLeaseId = useMemo(() => {
    const map = new Map<string, string>();
    for (const lease of leases) {
      const lessee = lessees.find(l => l.id === lease.lessee_id);
      if (lessee) map.set(lease.id, lessee.name);
    }
    return map;
  }, [leases, lessees]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleBarClick = (data: { month: string }) => {
    if (!data?.month) return;
    setClickedMonth(prev => prev === data.month ? null : data.month);
  };

  const handleOpenAdd = () => {
    setEditTarget(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (event: CashEvent) => {
    setEditTarget(event);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditTarget(null);
  };

  // ── Pill / badge helpers ──────────────────────────────────────────────────

  const sourceBadge = (source: CashEvent["source"]) => {
    if (source === "manual") return { bg: "#1E293B", border: "#475569", color: "#94A3B8", label: "Manual" };
    if (source === "recon")  return { bg: "#1E3A5F", border: "#3B82F6", color: "#93C5FD", label: "Recon" };
    return { bg: "transparent", border: "#334155", color: "#475569", label: "Rule" };
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "2rem" }}>
      <PageHeader
        title="Cash Flow"
        subtitle="Actuals, forecasts, and redelivery cash events across your portfolio"
      >
        <button
          onClick={handleOpenAdd}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            background: "#3B82F6", border: "none", color: "#FFFFFF",
            borderRadius: "8px", padding: "0.5rem 1rem",
            fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
          }}
        >
          <Plus size={15} /> Add Event
        </button>
      </PageHeader>

      {isDemoMode && (
        <div style={{ marginBottom: "0.75rem" }}>
          <span style={{
            background: "#F1F5F9",
            border: "1px solid #E2E8F0",
            color: "#94A3B8",
            borderRadius: "99px",
            padding: "0.2rem 0.625rem",
            fontSize: "0.75rem",
            fontWeight: 500,
          }}>
            DEMO DATA
          </span>
        </div>
      )}

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        <KpiCard
          label="Net Received MTD"
          value={fmtCurrency(netReceivedMTD)}
          deltaType={netReceivedMTD >= 0 ? "positive" : "negative"}
          staggerIndex={0}
        />
        <KpiCard
          label="Net Forecast 12m"
          value={fmtCurrency(netForecast12m)}
          deltaType={netForecast12m >= 0 ? "positive" : "negative"}
          staggerIndex={1}
        />
        <KpiCard
          label="Largest Outflow (90d)"
          value={largestOutflow90d ? fmtCurrency(largestOutflow90d.amount) : "—"}
          subtitle={largestOutflow90d ? EVENT_TYPE_LABELS[largestOutflow90d.eventType] : undefined}
          deltaType="negative"
          staggerIndex={2}
        />
        <KpiCard
          label="MR Draws Due (90d)"
          value={mrDraws90d.count > 0 ? `${mrDraws90d.count} draw${mrDraws90d.count !== 1 ? "s" : ""}` : "None"}
          subtitle={mrDraws90d.count > 0 ? fmtCurrency(mrDraws90d.total) : undefined}
          deltaType={mrDraws90d.count > 0 ? "negative" : "neutral"}
          staggerIndex={3}
        />
      </div>

      {/* Controls bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        marginBottom: "1rem", flexWrap: "wrap",
      }}>
        {/* View mode toggle */}
        <div style={{
          display: "flex", gap: 0, background: "#F1F5F9",
          border: "1px solid #E2E8F0", borderRadius: "8px", padding: "0.2rem",
        }}>
          {(["actuals", "forecast", "both"] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "0.3rem 0.875rem",
                background: viewMode === mode ? "#FFFFFF" : "transparent",
                border: "none", borderRadius: "6px",
                color: viewMode === mode ? "#0F172A" : "#64748B",
                fontSize: "0.8rem", fontWeight: viewMode === mode ? 500 : 400,
                cursor: "pointer", textTransform: "capitalize",
                transition: "background 150ms, color 150ms",
                boxShadow: viewMode === mode ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Range toggle */}
        <div style={{
          display: "flex", gap: 0, background: "#F1F5F9",
          border: "1px solid #E2E8F0", borderRadius: "8px", padding: "0.2rem",
        }}>
          {([3, 6, 12, 24] as RangeMonths[]).map(r => (
            <button
              key={r}
              onClick={() => setRangeMonths(r)}
              style={{
                padding: "0.3rem 0.75rem",
                background: rangeMonths === r ? "#FFFFFF" : "transparent",
                border: "none", borderRadius: "6px",
                color: rangeMonths === r ? "#0F172A" : "#64748B",
                fontSize: "0.8rem", fontWeight: rangeMonths === r ? 500 : 400,
                cursor: "pointer",
                transition: "background 150ms, color 150ms",
                boxShadow: rangeMonths === r ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {r}m
            </button>
          ))}
        </div>

        {/* Month filter chip */}
        {clickedMonth && (
          <div
            onClick={() => setClickedMonth(null)}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              borderRadius: "99px", padding: "0.25rem 0.75rem 0.25rem 0.875rem",
              fontSize: "0.8rem", color: "#1D4ED8", cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Showing {monthLabel(clickedMonth)}
            <X size={13} style={{ marginTop: "1px" }} />
          </div>
        )}

        {/* Spacer + saving indicator + add button */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {saving && (
            <span style={{ fontSize: "0.75rem", color: "#64748B" }}>Saving…</span>
          )}
          <button
            onClick={handleOpenAdd}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              background: "#3B82F6", border: "none", color: "#FFFFFF",
              borderRadius: "8px", padding: "0.45rem 0.875rem",
              fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
            }}
          >
            <Plus size={14} /> Add Event
          </button>
        </div>
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        style={{
          background: "#FFFFFF", border: "1px solid #E2E8F0",
          borderRadius: "12px", padding: "1.25rem 1.5rem",
          marginBottom: "1.25rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#475569", marginBottom: "1rem" }}>
          Cash Flow — {rangeMonths}m view
        </div>
        {loading ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
            Loading events…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={chartData}
              barCategoryGap="30%"
              barGap={2}
              onClick={(data) => {
                if (data?.activePayload?.[0]) {
                  handleBarClick(data.activePayload[0].payload as { month: string });
                }
              }}
            >
              <CartesianGrid vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => fmtCurrency(v)}
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="inflowActual"   name="Inflow (Actual)"   fill="#4ADE80" fillOpacity={1}   radius={[2, 2, 0, 0]} />
              <Bar dataKey="inflowForecast"  name="Inflow (Forecast)" fill="#4ADE80" fillOpacity={0.4} radius={[2, 2, 0, 0]} />
              <Bar dataKey="outflowActual"  name="Outflow (Actual)"  fill="#F87171" fillOpacity={1}   radius={[0, 0, 2, 2]} />
              <Bar dataKey="outflowForecast" name="Outflow (Forecast)" fill="#F87171" fillOpacity={0.4} radius={[0, 0, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Ledger table */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: [0.23, 1, 0.32, 1] }}
        style={{
          background: "#FFFFFF", border: "1px solid #E2E8F0",
          borderRadius: "12px", overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* Table header */}
        <div style={{
          padding: "0.75rem 1.25rem",
          borderBottom: "1px solid #F1F5F9",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#475569" }}>
            {clickedMonth ? `${monthLabel(clickedMonth)} — ${ledgerRows.length} event${ledgerRows.length !== 1 ? "s" : ""}` : `All Events — ${ledgerRows.length}`}
          </span>
        </div>

        <div style={{ overflowX: "auto", maxHeight: "480px", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead style={{ position: "sticky", top: 0, background: "#F8FAFC", zIndex: 1 }}>
              <tr>
                {["Date", "Type", "Lessee", "Amount", "Source", "Notes", ""].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: "0.5rem 1rem", textAlign: "left",
                      color: "#94A3B8", fontWeight: 500, fontSize: "0.75rem",
                      borderBottom: "1px solid #E2E8F0",
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledgerRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#94A3B8" }}>
                    {loading ? "Loading events…" : "No events to display"}
                  </td>
                </tr>
              ) : (
                ledgerRows.map(event => {
                  const badge = sourceBadge(event.source);
                  const lesseeName = event.leaseId ? (lesseeByLeaseId.get(event.leaseId) ?? "—") : "—";
                  const canAct = !isDemoMode && event.source !== "rule";
                  return (
                    <tr
                      key={event.id}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        transition: "background 100ms",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      {/* Date */}
                      <td style={{ padding: "0.5rem 1rem", color: "#475569", whiteSpace: "nowrap" }}>
                        {event.eventDate}
                      </td>

                      {/* Type pill */}
                      <td style={{ padding: "0.5rem 1rem" }}>
                        <span style={{
                          display: "inline-block",
                          background: pillBg(event.eventType),
                          color: pillColor(event.eventType),
                          borderRadius: "99px", padding: "0.125rem 0.625rem",
                          fontSize: "0.75rem", fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}>
                          {EVENT_TYPE_LABELS[event.eventType]}
                        </span>
                      </td>

                      {/* Lessee */}
                      <td style={{ padding: "0.5rem 1rem", color: "#0F172A", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {lesseeName}
                      </td>

                      {/* Amount */}
                      <td style={{
                        padding: "0.5rem 1rem",
                        color: event.amount >= 0 ? "#15803D" : "#B91C1C",
                        fontWeight: 500, whiteSpace: "nowrap",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {event.amount >= 0 ? "+" : ""}{fmtCurrency(event.amount, event.currency)}
                      </td>

                      {/* Source badge */}
                      <td style={{ padding: "0.5rem 1rem" }}>
                        <span style={{
                          display: "inline-block",
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.color,
                          borderRadius: "99px", padding: "0.125rem 0.5rem",
                          fontSize: "0.75rem", fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Notes */}
                      <td style={{
                        padding: "0.5rem 1rem", color: "#64748B",
                        maxWidth: "200px", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {event.notes ?? "—"}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap" }}>
                        {canAct && (
                          <div style={{ display: "flex", gap: "0.25rem" }}>
                            <button
                              onClick={() => handleOpenEdit(event)}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "#94A3B8", padding: "0.25rem",
                                borderRadius: "4px", display: "flex", alignItems: "center",
                                transition: "color 150ms",
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = "#3B82F6")}
                              onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteEvent(event.id)}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "#94A3B8", padding: "0.25rem",
                                borderRadius: "4px", display: "flex", alignItems: "center",
                                transition: "color 150ms",
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = "#EF4444")}
                              onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Modal */}
      <AddCashEventModal
        key={editTarget?.id ?? "new"}
        open={modalOpen}
        initial={editTarget ? {
          leaseId:    editTarget.leaseId,
          eventType:  editTarget.eventType,
          amount:     editTarget.amount,
          currency:   editTarget.currency,
          eventDate:  editTarget.eventDate,
          isForecast: editTarget.isForecast,
          notes:      editTarget.notes,
        } : undefined}
        editId={editTarget?.id}
        leases={leases}
        lessees={lessees}
        onSave={addEvent}
        onEdit={editEvent}
        onClose={handleModalClose}
      />
    </div>
  );
}
