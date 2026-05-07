import { useState, useMemo, useEffect } from "react";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Search } from "lucide-react";
import { useViewMode } from "../contexts/ViewModeContext";
import { jurisdictions, precedents } from "../components/jurisdictions/jurisdictionData";
import { JurisdictionDetail } from "../components/jurisdictions/JurisdictionDetail";
import { PrecedentTable } from "../components/jurisdictions/PrecedentTable";

const ALL_TABS = ["Profiles", "Repossession Model", "Precedent Database"];
const EXEC_TABS = ["Profiles"];

export default function Jurisdictions() {
  const { isExecutiveMode } = useViewMode();
  const [selectedCode, setSelectedCode] = useState(jurisdictions[0].code);
  const [activeTab, setActiveTab] = useState("Profiles");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isExecutiveMode && !EXEC_TABS.includes(activeTab)) {
      setActiveTab("Profiles");
    }
  }, [isExecutiveMode, activeTab]);

  const selected = jurisdictions.find((j) => j.code === selectedCode) ?? jurisdictions[0];

  const filteredJurisdictions = useMemo(
    () =>
      jurisdictions.filter((j) =>
        j.country.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  const chartData = jurisdictions.filter((j) => j.repossP50 < 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Jurisdictions"
        subtitle="CTC party status, enforceability scores, repossession models — 30 jurisdictions"
      />

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #E2E8F0", display: "flex" }}>
        {(isExecutiveMode ? EXEC_TABS : ALL_TABS).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "0.75rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #002147" : "2px solid transparent",
              background: "transparent",
              color: activeTab === tab ? "#002147" : "#475569",
              cursor: "pointer",
              marginBottom: "-1px",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Profiles ── */}
      {activeTab === "Profiles" && (
        <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
          {/* Left: country list */}
          <div
            style={{
              width: "300px",
              flexShrink: 0,
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "0.75rem",
              overflow: "hidden",
            }}
          >
            {/* Search */}
            <div style={{ padding: "0.625rem 0.875rem", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Search size={13} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search jurisdictions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: "0.8125rem", color: "#0F172A", width: "100%", background: "transparent" }}
              />
            </div>

            {/* List */}
            <div style={{ maxHeight: "calc(100vh - 320px)", overflowY: "auto" }}>
              {filteredJurisdictions.length === 0 ? (
                <div style={{ padding: "1rem", color: "#94A3B8", fontSize: "0.8125rem", textAlign: "center" }}>No results</div>
              ) : (
                filteredJurisdictions.map((j, i) => {
                  const active = j.code === selectedCode;
                  return (
                    <button
                      key={j.code}
                      onClick={() => setSelectedCode(j.code)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.625rem",
                        width: "100%",
                        padding: "0.625rem 0.875rem",
                        borderLeft: active ? "3px solid #002147" : "3px solid transparent",
                        borderRight: "none",
                        borderTop: "none",
                        borderBottom: i < filteredJurisdictions.length - 1 ? "1px solid #F1F5F9" : "none",
                        background: active ? "#F8FAFC" : "#FFFFFF",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                        <span style={{ fontSize: "1.125rem", flexShrink: 0 }}>{j.flag}</span>
                        <span style={{ fontSize: "0.875rem", fontWeight: active ? 600 : 400, color: "#0F172A", truncate: "true", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {j.country}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: j.ctcScore >= 80 ? "#15803D" : j.ctcScore >= 50 ? "#B45309" : "#B91C1C", fontVariantNumeric: "tabular-nums" }}>
                          {j.ctcScore}
                        </span>
                        {j.sanctions !== "None" ? (
                          <StatusPill stage="red" label="Sanctioned" />
                        ) : j.ctcParty ? (
                          <StatusPill stage="green" label="CTC" />
                        ) : (
                          <StatusPill stage="amber" label="Non-CTC" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: detail panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <JurisdictionDetail jurisdiction={selected} precedents={precedents} />
          </div>
        </div>
      )}

      {/* ── Repossession Model ── */}
      {activeTab === "Repossession Model" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          <Card title="P50 / P90 Repossession Timeline" subtitle="Months to successful repossession by jurisdiction (excludes sanctioned/detained)">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} unit=" mo" />
                <YAxis type="category" dataKey="country" tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} width={100} />
                <Tooltip contentStyle={{ fontSize: "0.8125rem", border: "1px solid #E2E8F0", borderRadius: "0.75rem" }} />
                <Bar dataKey="repossP50" name="P50 (months)" fill="#002147" radius={[0, 3, 3, 0]} />
                <Bar dataKey="repossP90" name="P90 (months)" fill="#94A3B8" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Success Probability & Cost" subtitle="% of asset value, P50 and P90 scenarios" noPadding>
            <div style={{ overflowX: "auto", maxHeight: "460px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    {["Country", "P50 Cost", "P90 Cost", "Success Prob."].map((h) => (
                      <th key={h} style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jurisdictions.map((j, i) => (
                    <tr key={j.code} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                      <td style={{ padding: "0.625rem 1rem" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span>{j.flag}</span>
                          <span style={{ fontWeight: 600, color: "#0F172A" }}>{j.country}</span>
                        </span>
                      </td>
                      <td style={{ padding: "0.625rem 1rem", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                        {j.repossP50 >= 999 ? "N/A" : j.repossP50Cost}
                      </td>
                      <td style={{ padding: "0.625rem 1rem", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                        {j.repossP90 >= 999 ? "N/A" : j.repossP90Cost}
                      </td>
                      <td style={{ padding: "0.625rem 1rem", fontWeight: 600, color: parseInt(j.successProb) >= 80 ? "#15803D" : parseInt(j.successProb) >= 60 ? "#B45309" : "#B91C1C" }}>
                        {j.successProb}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Precedent Database ── */}
      {activeTab === "Precedent Database" && (
        <PrecedentTable precedents={precedents} jurisdictions={jurisdictions} />
      )}
    </div>
  );
}
