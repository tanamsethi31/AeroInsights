// src/app/components/maintenance/MaintenanceEventLog.tsx
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { MaintenanceEvent, ComponentImpact } from "../../utils/maintenanceEvents";

const COMPONENT_NAMES = ["Airframe HSI", "Engine PR", "LLPs", "Landing Gear", "APU"] as const;

const EVENT_TYPE_LABELS: Record<MaintenanceEvent["eventType"], string> = {
  shop_visit:          "Shop Visit",
  aog:                 "AOG",
  llp_replacement:     "LLP Replacement",
  supplemental_claim:  "Supplemental Claim",
  note:                "Note",
};

const EVENT_TYPE_COLORS: Record<MaintenanceEvent["eventType"], { bg: string; color: string }> = {
  shop_visit:          { bg: "#DBEAFE", color: "#1D4ED8" },
  aog:                 { bg: "#FEE2E2", color: "#B91C1C" },
  llp_replacement:     { bg: "#FEF3C7", color: "#B45309" },
  supplemental_claim:  { bg: "#FEF3C7", color: "#B45309" },
  note:                { bg: "#F1F5F9", color: "#475569" },
};

interface ImpactDraft {
  component:      string;
  costPaid:       string;
  remainingAfter: string;
}

interface Props {
  events:      MaintenanceEvent[];
  saving:      boolean;
  logEvent:    (data: Omit<MaintenanceEvent, "id">) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  leaseId:     string;
}

function emptyImpact(): ImpactDraft {
  return { component: COMPONENT_NAMES[0], costPaid: "", remainingAfter: "" };
}

export function MaintenanceEventLog({ events, saving, logEvent, deleteEvent, leaseId }: Props) {
  const [formOpen,    setFormOpen   ] = useState(false);
  const [eventDate,   setEventDate  ] = useState("");
  const [eventType,   setEventType  ] = useState<MaintenanceEvent["eventType"]>("shop_visit");
  const [notes,       setNotes      ] = useState("");
  const [impacts,     setImpacts    ] = useState<ImpactDraft[]>([emptyImpact()]);
  const [formError,   setFormError  ] = useState<string | null>(null);
  const [deletingId,  setDeletingId ] = useState<string | null>(null);

  function resetForm() {
    setEventDate(""); setEventType("shop_visit"); setNotes("");
    setImpacts([emptyImpact()]); setFormError(null);
  }

  function addImpactRow() {
    setImpacts(prev => [...prev, emptyImpact()]);
  }

  function removeImpactRow(i: number) {
    setImpacts(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateImpact(i: number, field: keyof ImpactDraft, value: string) {
    setImpacts(prev => prev.map((imp, idx) => idx === i ? { ...imp, [field]: value } : imp));
  }

  async function handleSave() {
    setFormError(null);
    if (!eventDate) { setFormError("Event date is required."); return; }

    const requiresImpacts = eventType !== "note";
    const validImpacts: ComponentImpact[] = [];

    for (const imp of impacts) {
      const cost = parseFloat(imp.costPaid);
      if (isNaN(cost) || cost <= 0) {
        if (requiresImpacts || imp.costPaid !== "") {
          setFormError("Cost paid must be a positive number for each component impact.");
          return;
        }
        continue;
      }
      const remaining = imp.remainingAfter === "" ? null : parseInt(imp.remainingAfter, 10);
      if (imp.remainingAfter !== "" && (isNaN(remaining!) || remaining! < 0)) {
        setFormError("Remaining units after must be a non-negative integer, or leave blank.");
        return;
      }
      validImpacts.push({
        component:           imp.component,
        costPaidUSD:         cost,
        remainingUnitsAfter: remaining,
      });
    }

    if (requiresImpacts && validImpacts.length === 0) {
      setFormError("At least one component impact with a cost is required.");
      return;
    }

    try {
      await logEvent({
        leaseId,
        eventDate,
        eventType,
        notes: notes.trim() || null,
        componentImpacts: validImpacts,
      });
      setFormOpen(false);
      resetForm();
    } catch {
      setFormError("Failed to save event. Please try again.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this maintenance event? This cannot be undone.")) return;
    setDeletingId(id);
    try { await deleteEvent(id); } finally { setDeletingId(null); }
  }

  const sorted = [...events].sort((a, b) => b.eventDate.localeCompare(a.eventDate)); // newest first

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "1.25rem" }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Maintenance Events
        </span>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: "0.25rem",
              padding: "0.25rem 0.75rem", background: "#002147", color: "#FFFFFF",
              border: "none", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            <Plus size={12} /> Log Event
          </button>
        )}
      </div>

      {/* ── Inline form ──────────────────────────────────────────────── */}
      {formOpen && (
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>

          {/* Row 1: date + type */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
              Event Date *
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                style={{ padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "0.8rem", background: "#FFFFFF" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
              Event Type
              <select
                value={eventType}
                onChange={e => setEventType(e.target.value as MaintenanceEvent["eventType"])}
                style={{ padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "0.8rem", background: "#FFFFFF" }}
              >
                {(Object.keys(EVENT_TYPE_LABELS) as MaintenanceEvent["eventType"][]).map(t => (
                  <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Row 2: notes */}
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
            Notes (optional)
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Describe the event..."
              style={{ padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "0.8rem", background: "#FFFFFF", resize: "vertical" }}
            />
          </label>

          {/* Row 3: component impacts */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.5rem" }}>
              Component Impacts {eventType !== "note" && <span style={{ color: "#94A3B8", fontWeight: 400 }}>(required)</span>}
            </div>
            {impacts.map((imp, i) => (
              <div key={i} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "0.5rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                  Component
                  <select
                    value={imp.component}
                    onChange={e => updateImpact(i, "component", e.target.value)}
                    style={{ padding: "0.3rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "0.78rem", background: "#FFFFFF" }}
                  >
                    {COMPONENT_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                  Cost Paid ($)
                  <input
                    type="number" min={0} value={imp.costPaid}
                    onChange={e => updateImpact(i, "costPaid", e.target.value)}
                    placeholder="e.g. 5400000"
                    style={{ padding: "0.3rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "0.78rem", width: "130px", background: "#FFFFFF" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                  Remaining Units After <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span>
                  <input
                    type="number" min={0} value={imp.remainingAfter}
                    onChange={e => updateImpact(i, "remainingAfter", e.target.value)}
                    placeholder="leave blank if no reset"
                    style={{ padding: "0.3rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "0.78rem", width: "180px", background: "#FFFFFF" }}
                  />
                </label>
                {impacts.length > 1 && (
                  <button
                    onClick={() => removeImpactRow(i)}
                    style={{ padding: "0.3rem 0.5rem", background: "none", border: "1px solid #E2E8F0", borderRadius: "6px", cursor: "pointer", color: "#94A3B8", fontSize: "0.78rem" }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addImpactRow}
              style={{ fontSize: "0.75rem", color: "#002147", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
            >
              + Add component
            </button>
          </div>

          {formError && (
            <div style={{ fontSize: "0.75rem", color: "#B91C1C", background: "#FEE2E2", padding: "0.375rem 0.625rem", borderRadius: "6px" }}>
              {formError}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.625rem" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "0.375rem 1rem", background: "#002147", color: "#FFFFFF",
                border: "none", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : "Save Event"}
            </button>
            <button
              onClick={() => { setFormOpen(false); resetForm(); }}
              style={{ padding: "0.375rem 1rem", background: "none", border: "1px solid #E2E8F0", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer", color: "#475569" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Event timeline ───────────────────────────────────────────── */}
      {sorted.length === 0 && !formOpen ? (
        <div style={{ fontSize: "0.8125rem", color: "#94A3B8", textAlign: "center", padding: "1.5rem 0" }}>
          No events logged for this aircraft.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {sorted.map(evt => {
            const badge = EVENT_TYPE_COLORS[evt.eventType];
            return (
              <div key={evt.id} style={{ border: "1px solid #F1F5F9", borderRadius: "8px", padding: "0.75rem 1rem", background: "#FAFAFA" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: evt.componentImpacts.length > 0 || evt.notes ? "0.5rem" : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>
                      {new Date(evt.eventDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "0.15rem 0.5rem", borderRadius: "999px", background: badge.bg, color: badge.color }}>
                      {EVENT_TYPE_LABELS[evt.eventType]}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(evt.id)}
                    disabled={deletingId === evt.id}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", padding: 0 }}
                    title="Delete event"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {evt.componentImpacts.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: evt.notes ? "0.375rem" : 0 }}>
                    {evt.componentImpacts.map((imp, i) => (
                      <span key={i} style={{ fontSize: "0.72rem", background: "#EFF6FF", color: "#1D4ED8", padding: "0.15rem 0.5rem", borderRadius: "999px", fontVariantNumeric: "tabular-nums" }}>
                        {imp.component} −${(imp.costPaidUSD / 1_000_000).toFixed(2)}M
                        {imp.remainingUnitsAfter !== null && ` → ${imp.remainingUnitsAfter.toLocaleString()} units`}
                      </span>
                    ))}
                  </div>
                )}
                {evt.notes && (
                  <div style={{ fontSize: "0.78rem", color: "#475569", fontStyle: "italic" }}>
                    {evt.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
