import { useState, useEffect, useRef } from "react";
import { useTransitionNavigate as useNavigate } from "../hooks/useTransitionNavigate";
import { useAuth0 } from "@auth0/auth0-react";
import { motion } from "framer-motion";
import { BarChart3, Plus, ArrowRight, Loader2, FolderOpen, Clock, Database } from "lucide-react";
import {
  usePortfolio,
  SAMPLE_PORTFOLIO,
  type Portfolio,
} from "../contexts/PortfolioContext";
import { UploadWizard } from "../components/upload/UploadWizard";
import { TemplateUploadWizard } from "../components/upload/TemplateUploadWizard";
import { ManualPortfolioWizard } from "../components/portfolio-builder/ManualPortfolioWizard";
import { useData } from "../contexts/DataContext";
import { supabase } from "../lib/supabase";

// ─── Portfolio card (for existing portfolios) ─────────────────────────────────

function PortfolioCard({
  portfolio,
  onSelect,
}: {
  portfolio: Portfolio;
  onSelect: () => void;
}) {
  const date = new Date(portfolio.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "0.875rem",
        padding: "1.5rem",
        cursor: "pointer",
        textAlign: "left",
        transition: "box-shadow 160ms cubic-bezier(0.23,1,0.32,1), border-color 160ms cubic-bezier(0.23,1,0.32,1)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow =
          "0 8px 24px rgba(0,0,0,0.10)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#CBD5E1";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow =
          "0 1px 3px rgba(0,0,0,0.06)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            background: "#EFF6FF",
            borderRadius: "0.625rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FolderOpen size={18} style={{ color: "#002147" }} />
        </div>
        <ArrowRight size={14} style={{ color: "#94A3B8", marginTop: "4px" }} />
      </div>

      <div>
        <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A", marginBottom: "0.25rem" }}>
          {portfolio.name}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "#64748B" }}>
          {portfolio.aircraft_count} aircraft
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "auto" }}>
        <Clock size={11} style={{ color: "#94A3B8" }} />
        <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>Created {date}</span>
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortfolioHub() {
  const navigate = useNavigate();
  const { user, getAccessTokenSilently, logout } = useAuth0();
  const { setActivePortfolio } = usePortfolio();
  const { orgId } = useData();

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const sampleBgRef = useRef<HTMLDivElement>(null);
  const uploadBgRef = useRef<HTMLDivElement>(null);

  // Both upload paths share the same post-import handler: hydrate the new
  // portfolio row and navigate to the dashboard with it active.
  async function handleUploadComplete(_uploadId: string, _count: number, newPortfolioId: string) {
    setShowCreateModal(false);
    setShowTemplateModal(false);
    const { data } = await supabase
      .from("portfolios")
      .select("id, name, created_at")
      .eq("id", newPortfolioId)
      .single();
    if (data) {
      setActivePortfolio({
        id: data.id,
        name: data.name,
        aircraft_count: 0,
        created_at: data.created_at,
      });
    }
    navigate("/", { replace: true });
  }

  // Fetch user's portfolios from Supabase (per ADR-002).
  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("portfolios")
        .select("id, name, created_at, kind, slug")
        .eq("org_id", orgId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn("[PortfolioHub] supabase load failed", error);
      } else if (data) {
        // Decorate with aircraft_count by counting assets per portfolio.
        // assets.portfolio_id arrives in Phase B; for now fall back to 0.
        const portfolios: Portfolio[] = data.map((p) => ({
          id: p.id,
          name: p.name,
          aircraft_count: 0,
          created_at: p.created_at,
        }));
        setPortfolios(portfolios);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  function handleSample() {
    setActivePortfolio(SAMPLE_PORTFOLIO);
    navigate("/", { replace: true });
  }

  function handleSelectPortfolio(p: Portfolio) {
    setActivePortfolio(p);
    navigate("/", { replace: true });
  }

  const displayName = user?.given_name ?? user?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      {showCreateModal && orgId && (
        <UploadWizard
          orgId={orgId}
          onClose={() => setShowCreateModal(false)}
          onComplete={handleUploadComplete}
        />
      )}

      {showTemplateModal && orgId && (
        <TemplateUploadWizard
          orgId={orgId}
          onClose={() => setShowTemplateModal(false)}
          onComplete={handleUploadComplete}
        />
      )}

      {showManualModal && orgId && (
        <ManualPortfolioWizard
          orgId={orgId}
          onClose={() => setShowManualModal(false)}
          onComplete={(result) => handleUploadComplete("manual", 0, result.portfolioId)}
        />
      )}

      <div
        style={{
          minHeight: "100vh",
          background: "#F8FAFC",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Top bar ── */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 2rem",
            height: "56px",
            background: "#FFFFFF",
            borderBottom: "1px solid #E2E8F0",
            flexShrink: 0,
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                background: "#002147",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                <path d="M4 20L14 4L24 20H4Z" stroke="#FFF" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
                <path d="M9 20L14 11L19 20" stroke="#FFF" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0F172A", letterSpacing: "-0.01em" }}>
              Aeroinsights
            </span>
          </div>

          {/* User info */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "#475569" }}>
              {user?.email}
            </span>
            <button
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin + "/login" } })}
              style={{
                fontSize: "0.8125rem",
                color: "#94A3B8",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.375rem",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "#475569")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "#94A3B8")
              }
            >
              Sign out
            </button>
          </div>
        </header>

        {/* ── Main content ── */}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "4rem 2rem",
          }}
        >
          <div style={{ width: "100%", maxWidth: "1100px" }}>
            {/* Greeting */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              style={{ marginBottom: "2.5rem" }}
            >
              <h1
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "#0F172A",
                  margin: "0 0 0.375rem",
                  letterSpacing: "-0.02em",
                }}
              >
                {greeting}, {displayName}
              </h1>
              <p style={{ fontSize: "0.9375rem", color: "#64748B", margin: 0 }}>
                {loading
                  ? "Loading your portfolios…"
                  : portfolios.length > 0
                  ? `You have ${portfolios.length} portfolio${portfolios.length > 1 ? "s" : ""}. Select one to continue.`
                  : "You don't have any portfolios yet. Choose how you'd like to get started."}
              </p>
            </motion.div>

            {/* Loading state */}
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
                <Loader2
                  size={24}
                  style={{ color: "#94A3B8", animation: "spin 1s linear infinite" }}
                />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* Existing portfolios */}
            {!loading && portfolios.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                {portfolios.map((p, pi) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: pi * 0.08, ease: [0.23, 1, 0.32, 1] }}
                  >
                    <PortfolioCard
                      portfolio={p}
                      onSelect={() => handleSelectPortfolio(p)}
                    />
                  </motion.div>
                ))}
                {/* Add new */}
                <button
                  onClick={() => orgId ? setShowCreateModal(true) : navigate("/onboarding")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.625rem",
                    border: "2px dashed #CBD5E1",
                    borderRadius: "0.875rem",
                    padding: "1.5rem",
                    cursor: "pointer",
                    background: "none",
                    color: "#94A3B8",
                    minHeight: "140px",
                    transition: "border-color 150ms, color 150ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#94A3B8";
                    (e.currentTarget as HTMLButtonElement).style.color = "#475569";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#CBD5E1";
                    (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8";
                  }}
                >
                  <Plus size={20} />
                  <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>New portfolio</span>
                </button>
              </div>
            )}

            {/* Empty state — three action cards */}
            {!loading && portfolios.length === 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "1.5rem",
                }}
              >
                {/* Card 1 — Sample portfolio */}
                <motion.button
                  onClick={handleSample}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background: "#001529",
                    border: "none",
                    borderRadius: "1rem",
                    padding: "2rem",
                    cursor: "pointer",
                    textAlign: "left",
                    minHeight: "260px",
                    overflow: "hidden",
                    transition: "box-shadow 220ms cubic-bezier(0.23,1,0.32,1), transform 220ms cubic-bezier(0.23,1,0.32,1)",
                    boxShadow: "0 4px 20px rgba(0,33,71,0.25)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "0 12px 32px rgba(0,33,71,0.30)";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                    if (sampleBgRef.current) sampleBgRef.current.style.transform = "scale(1.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "0 4px 20px rgba(0,33,71,0.25)";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                    if (sampleBgRef.current) sampleBgRef.current.style.transform = "scale(1)";
                  }}
                >
                  {/* Background image */}
                  <div
                    ref={sampleBgRef}
                    style={{
                      position: "absolute",
                      inset: "-28px",
                      backgroundImage: "url('/sample-portfolio-bg.png')",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      borderRadius: "1.5rem",
                      transform: "scale(1)",
                      transition: "transform 500ms cubic-bezier(0.23,1,0.32,1)",
                      pointerEvents: "none",
                    }}
                  />
                  {/* Gradient overlay for text legibility */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(160deg, rgba(0,21,47,0.78) 0%, rgba(0,33,71,0.60) 50%, rgba(0,10,30,0.35) 100%)",
                      borderRadius: "1rem",
                      pointerEvents: "none",
                    }}
                  />

                  {/* Content sits above overlay */}
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        background: "rgba(255,255,255,0.15)",
                        backdropFilter: "blur(6px)",
                        borderRadius: "0.625rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "1.5rem",
                        border: "1px solid rgba(255,255,255,0.20)",
                      }}
                    >
                      <BarChart3 size={22} style={{ color: "#FFFFFF" }} />
                    </div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.625rem" }}>
                      Explore Sample Portfolio
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
                      10-aircraft global fleet · Pre-built IFRS 9 ECL data · No setup required
                    </div>
                  </div>

                  <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "2rem" }}>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#FFFFFF" }}>
                      Launch now
                    </span>
                    <ArrowRight size={16} style={{ color: "#FFFFFF" }} />
                  </div>
                </motion.button>

                {/* Card 2 — Upload real portfolio */}
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
                  onClick={() => orgId ? setShowTemplateModal(true) : navigate("/onboarding", { state: { templateMode: true } })}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background: "#001529",
                    border: "none",
                    borderRadius: "1rem",
                    padding: "2rem",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "#FFFFFF",
                    minHeight: "260px",
                    overflow: "hidden",
                    transition: "box-shadow 160ms cubic-bezier(0.23,1,0.32,1), transform 160ms cubic-bezier(0.23,1,0.32,1)",
                    boxShadow: "0 4px 16px rgba(0,33,71,0.20)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "0 12px 32px rgba(0,33,71,0.30)";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                    if (uploadBgRef.current) uploadBgRef.current.style.transform = "scale(1.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "0 4px 16px rgba(0,33,71,0.20)";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                    if (uploadBgRef.current) uploadBgRef.current.style.transform = "scale(1)";
                  }}
                >
                  {/* Background image */}
                  <div
                    ref={uploadBgRef}
                    style={{
                      position: "absolute",
                      inset: "-28px",
                      backgroundImage: "url('/upload-portfolio-bg.png')",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      borderRadius: "1.5rem",
                      transform: "scale(1)",
                      transition: "transform 500ms cubic-bezier(0.23,1,0.32,1)",
                      pointerEvents: "none",
                    }}
                  />
                  {/* Gradient overlay for text legibility */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(160deg, rgba(0,21,47,0.78) 0%, rgba(0,33,71,0.60) 50%, rgba(0,10,30,0.35) 100%)",
                      borderRadius: "1rem",
                      pointerEvents: "none",
                    }}
                  />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        background: "rgba(255,255,255,0.15)",
                        backdropFilter: "blur(6px)",
                        borderRadius: "0.625rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "1.5rem",
                        border: "1px solid rgba(255,255,255,0.20)",
                      }}
                    >
                      <Database size={22} style={{ color: "#FFFFFF" }} />
                    </div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.625rem" }}>
                      Upload Your Portfolio
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
                      Download our template, fill in your fleet, and we&rsquo;ll parse it straight into your dashboard.
                    </div>
                  </div>

                  <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "2rem" }}>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#FFFFFF" }}>
                      Import now
                    </span>
                    <ArrowRight size={16} style={{ color: "#FFFFFF" }} />
                  </div>
                </motion.button>

                {/* Card 3 — Create portfolio */}
                <motion.button
                  onClick={() => orgId ? setShowManualModal(true) : navigate("/onboarding")}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, delay: 0.16, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background: "#FFFFFF",
                    border: "2px solid #E2E8F0",
                    borderRadius: "1rem",
                    padding: "2rem",
                    cursor: "pointer",
                    textAlign: "left",
                    minHeight: "260px",
                    transition: "box-shadow 160ms cubic-bezier(0.23,1,0.32,1), border-color 160ms cubic-bezier(0.23,1,0.32,1), transform 160ms cubic-bezier(0.23,1,0.32,1)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "0 8px 24px rgba(0,0,0,0.10)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#002147";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "0 1px 3px rgba(0,0,0,0.06)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  }}
                >
                  <div>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        borderRadius: "0.625rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "1.5rem",
                      }}
                    >
                      <Plus size={22} style={{ color: "#002147" }} />
                    </div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", marginBottom: "0.625rem" }}>
                      Create Custom Portfolio
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "#64748B", lineHeight: 1.6 }}>
                      Enter your portfolio step-by-step in our guided builder &mdash; no spreadsheet required.
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "2rem" }}>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#002147" }}>
                      Get started
                    </span>
                    <ArrowRight size={16} style={{ color: "#002147" }} />
                  </div>
                </motion.button>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
