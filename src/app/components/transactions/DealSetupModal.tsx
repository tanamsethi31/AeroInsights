// src/app/components/transactions/DealSetupModal.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import type { AbsDeal, NoteClass } from "../../utils/absWaterfall";
import { usePortfolioData } from "../../hooks/usePortfolioData";

interface Props {
  open:     boolean;
  onClose:  () => void;
  onCreate: (payload: Omit<AbsDeal, "id" | "createdAt" | "orgId">) => Promise<void>;
}

interface FormState {
  dealName:                string;
  closingDate:             string;
  currency:                string;
  paymentFrequency:        "monthly" | "quarterly";
  classABalance:           string;
  classACoupon:            string;
  classAPrincipal:         string;
  classBBalance:           string;
  classBCoupon:            string;
  classBPrincipal:         string;
  classCBalance:           string;
  classCCoupon:            string;
  classCPrincipal:         string;
  lrTarget:                string;
  lrBalance:               string;
  dscrTrigger:             string;
  ltvTrigger:              string;
  servicerFeePct:          string;
  trusteeFee:              string;
  adminFee:                string;
  selectedAircraftIds:     string[];
}

const EMPTY: FormState = {
  dealName: "", closingDate: "", currency: "USD", paymentFrequency: "quarterly",
  classABalance: "", classACoupon: "5.5", classAPrincipal: "",
  classBBalance: "", classBCoupon: "7.5", classBPrincipal: "",
  classCBalance: "", classCCoupon: "9.5", classCPrincipal: "",
  lrTarget: "15", lrBalance: "15",
  dscrTrigger: "1.15", ltvTrigger: "75",
  servicerFeePct: "0.5", trusteeFee: "0.05", adminFee: "0.02",
  selectedAircraftIds: [],
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px",
  border: "1px solid #334155", background: "#0F172A", color: "#F8FAFC",
  fontSize: "0.875rem", outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.75rem", color: "#94A3B8",
  marginBottom: "0.25rem", fontWeight: 500,
};

export function DealSetupModal({ open, onClose, onCreate }: Props) {
  const { assets } = usePortfolioData();
  const [step, setStep]     = useState<1 | 2 | 3>(1);
  const [form, setForm]     = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (open) { setStep(1); setForm(EMPTY); setSaving(false); setError(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const set = (k: keyof FormState, v: string | string[]) =>
    setForm(f => ({ ...f, [k]: v }));

  const canNext1 = form.dealName.trim() !== "" && form.closingDate !== "";
  const canNext2 =
    form.classABalance !== "" && form.classACoupon !== "" && form.classAPrincipal !== "" &&
    form.classBBalance !== "" && form.classBCoupon !== "" && form.classBPrincipal !== "" &&
    form.classCBalance !== "" && form.classCCoupon !== "" && form.classCPrincipal !== "" &&
    form.dscrTrigger !== "" && form.ltvTrigger !== "" && form.servicerFeePct !== "";

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const noteClasses: NoteClass[] = [
        { label: "A", outstandingBalance: parseFloat(form.classABalance), couponRate: parseFloat(form.classACoupon) / 100, scheduledPrincipal: parseFloat(form.classAPrincipal) },
        { label: "B", outstandingBalance: parseFloat(form.classBBalance), couponRate: parseFloat(form.classBCoupon) / 100, scheduledPrincipal: parseFloat(form.classBPrincipal) },
        { label: "C", outstandingBalance: parseFloat(form.classCBalance), couponRate: parseFloat(form.classCCoupon) / 100, scheduledPrincipal: parseFloat(form.classCPrincipal) },
      ];
      await onCreate({
        dealName:     form.dealName.trim(),
        closingDate:  form.closingDate,
        currency:     form.currency,
        noteClasses,
        reserveAccounts: {
          liquidityReserve: { target: parseFloat(form.lrTarget || "0"), balance: parseFloat(form.lrBalance || "0") },
          cashTrap: { balance: 0 },
        },
        coverageTests: {
          dscrTrigger: parseFloat(form.dscrTrigger),
          ltvTrigger:  parseFloat(form.ltvTrigger) / 100,
        },
        seniorExpenses: {
          servicerFeePct:   parseFloat(form.servicerFeePct) / 100,
          trusteeFee:        parseFloat(form.trusteeFee || "0"),
          adminFee:          parseFloat(form.adminFee || "0"),
          paymentFrequency: form.paymentFrequency,
        },
        aircraftIds: form.selectedAircraftIds,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create deal");
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = form.selectedAircraftIds.length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            style={{ background: "#1E293B", borderRadius: "12px", padding: "1.5rem",
              width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto",
              border: "1px solid #334155" }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ margin: 0, color: "#F8FAFC", fontSize: "1.125rem", fontWeight: 600 }}>
                  New ABS Deal
                </h2>
                <p style={{ margin: "0.25rem 0 0", color: "#94A3B8", fontSize: "0.8125rem" }}>
                  Step {step} of 3
                </p>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: "0.25rem" }}>
                <X size={18} />
              </button>
            </div>

            {/* Step 1: Deal Info */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={labelStyle}>Deal Name</label>
                  <input style={inputStyle} value={form.dealName} onChange={e => set("dealName", e.target.value)} placeholder='e.g. "ATLAS 2024-1"' />
                </div>
                <div>
                  <label style={labelStyle}>Closing Date</label>
                  <input style={inputStyle} type="date" value={form.closingDate} onChange={e => set("closingDate", e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={labelStyle}>Currency</label>
                    <select style={inputStyle} value={form.currency} onChange={e => set("currency", e.target.value)}>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Payment Frequency</label>
                    <select style={inputStyle} value={form.paymentFrequency} onChange={e => set("paymentFrequency", e.target.value as "monthly" | "quarterly")}>
                      <option value="quarterly">Quarterly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Note Classes & Reserves */}
            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {(["A", "B", "C"] as const).map(cls => {
                  const balKey = `class${cls}Balance` as keyof FormState;
                  const cpnKey = `class${cls}Coupon` as keyof FormState;
                  const priKey = `class${cls}Principal` as keyof FormState;
                  return (
                    <div key={cls}>
                      <p style={{ margin: "0 0 0.5rem", color: "#CBD5E1", fontSize: "0.875rem", fontWeight: 600 }}>
                        Class {cls} Notes
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                        <div>
                          <label style={labelStyle}>Outstanding ($M)</label>
                          <input style={inputStyle} type="number" min="0" step="0.1"
                            value={form[balKey] as string} onChange={e => set(balKey, e.target.value)} />
                        </div>
                        <div>
                          <label style={labelStyle}>Coupon (%)</label>
                          <input style={inputStyle} type="number" min="0" step="0.1"
                            value={form[cpnKey] as string} onChange={e => set(cpnKey, e.target.value)} />
                        </div>
                        <div>
                          <label style={labelStyle}>Sched. Principal ($M)</label>
                          <input style={inputStyle} type="number" min="0" step="0.1"
                            value={form[priKey] as string} onChange={e => set(priKey, e.target.value)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ borderTop: "1px solid #334155", paddingTop: "1rem" }}>
                  <p style={{ margin: "0 0 0.75rem", color: "#CBD5E1", fontSize: "0.875rem", fontWeight: 600 }}>Coverage Tests & Expenses</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label style={labelStyle}>DSCR Trigger (×)</label>
                      <input style={inputStyle} type="number" step="0.01" value={form.dscrTrigger} onChange={e => set("dscrTrigger", e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>LTV Trigger (%)</label>
                      <input style={inputStyle} type="number" step="0.01" value={form.ltvTrigger} onChange={e => set("ltvTrigger", e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Servicer Fee (%)</label>
                      <input style={inputStyle} type="number" step="0.01" value={form.servicerFeePct} onChange={e => set("servicerFeePct", e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Trustee Fee ($M)</label>
                      <input style={inputStyle} type="number" step="0.01" value={form.trusteeFee} onChange={e => set("trusteeFee", e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Admin Fee ($M)</label>
                      <input style={inputStyle} type="number" step="0.01" value={form.adminFee} onChange={e => set("adminFee", e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>LR Target ($M)</label>
                      <input style={inputStyle} type="number" step="0.1" value={form.lrTarget} onChange={e => set("lrTarget", e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>LR Balance ($M)</label>
                      <input style={inputStyle} type="number" step="0.1" value={form.lrBalance} onChange={e => set("lrBalance", e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Aircraft Selection */}
            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <p style={{ margin: "0 0 0.5rem", color: "#94A3B8", fontSize: "0.8125rem" }}>
                  Select aircraft in the deal pool. {selectedCount} aircraft selected.
                </p>
                <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {assets.map(a => {
                    const checked = form.selectedAircraftIds.includes(a.id);
                    return (
                      <label key={a.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem",
                        padding: "0.5rem 0.75rem", borderRadius: "6px", cursor: "pointer",
                        background: checked ? "#1E3A5F" : "#0F172A",
                        border: `1px solid ${checked ? "#3B82F6" : "#334155"}` }}>
                        <input type="checkbox" checked={checked}
                          onChange={e => {
                            const ids = form.selectedAircraftIds;
                            set("selectedAircraftIds", e.target.checked ? [...ids, a.id] : ids.filter(x => x !== a.id));
                          }}
                        />
                        <span style={{ color: "#F8FAFC", fontSize: "0.8125rem" }}>
                          {a.msn} — {a.aircraft_type}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p style={{ margin: "0.75rem 0 0", color: "#F87171", fontSize: "0.8125rem" }}>{error}</p>
            )}

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
              {step > 1 ? (
                <button onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
                  style={{ display: "flex", alignItems: "center", gap: "0.375rem",
                    background: "none", border: "1px solid #334155", color: "#CBD5E1",
                    borderRadius: "6px", padding: "0.5rem 1rem", cursor: "pointer", fontSize: "0.875rem" }}>
                  <ChevronLeft size={15} /> Back
                </button>
              ) : <div />}

              {step < 3 ? (
                <button
                  disabled={step === 1 ? !canNext1 : !canNext2}
                  onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)}
                  style={{ display: "flex", alignItems: "center", gap: "0.375rem",
                    background: "#3B82F6", border: "none", color: "#FFF", borderRadius: "6px",
                    padding: "0.5rem 1rem", fontSize: "0.875rem",
                    cursor: (step === 1 ? canNext1 : canNext2) ? "pointer" : "not-allowed",
                    opacity: (step === 1 ? canNext1 : canNext2) ? 1 : 0.5 }}>
                  Next <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  disabled={saving}
                  onClick={handleCreate}
                  style={{ display: "flex", alignItems: "center", gap: "0.375rem",
                    background: "#16A34A", border: "none", color: "#FFF", borderRadius: "6px",
                    padding: "0.5rem 1rem", cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.6 : 1, fontSize: "0.875rem" }}>
                  {saving ? "Creating…" : <><Check size={15} /> Create Deal</>}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
