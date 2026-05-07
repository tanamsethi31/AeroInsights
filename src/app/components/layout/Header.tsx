import { useState, useRef, useEffect, useCallback } from "react";
import * as React from "react";
import { AgentButton } from "../agent/AgentButton";
import { Bell, Search, Mail, ChevronDown, LogOut, CircleUser, LayoutDashboard, FileText, Plane } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router";
import { SidebarTrigger } from "../ui/sidebar";
import { Separator } from "../ui/separator";
import { search, type SearchResult } from "../../data/searchIndex";
import { AlertsPanel } from "../alerts/AlertsPanel";
import { AlertRulesConfig } from "../alerts/AlertRulesConfig";
import { EmailReportModal } from "../reports/EmailReportModal";
import { getUnreadCount } from "../../services/alertService";

const CATEGORY_ICON: Record<SearchResult["category"], React.ReactNode> = {
  Page:     <LayoutDashboard size={13} style={{ color: "#94A3B8" }} />,
  Lease:    <FileText        size={13} style={{ color: "#94A3B8" }} />,
  Aircraft: <Plane           size={13} style={{ color: "#94A3B8" }} />,
  Lessee:   <CircleUser      size={13} style={{ color: "#94A3B8" }} />,
};

export function Header() {
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery]                 = useState("");
  const [results, setResults]             = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx]         = useState(-1);
  const [menuOpen, setMenuOpen]           = useState(false);
  const [picError, setPicError]           = useState(false);

  const menuRef   = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const bellRef   = useRef<HTMLDivElement>(null);

  const [alertsOpen, setAlertsOpen] = React.useState(false);
  const [rulesOpen, setRulesOpen]   = React.useState(false);
  const [emailOpen, setEmailOpen]   = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(getUnreadCount);

  const { user, logout } = useAuth0();
  const navigate = useNavigate();

  // ── Close menus on outside click ──────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]);
        setActiveIdx(-1);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setAlertsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── ⌘K / Ctrl+K global shortcut ───────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Live search ────────────────────────────────────────────────────────────
  const handleQuery = useCallback((val: string) => {
    setQuery(val);
    setActiveIdx(-1);
    setResults(val.trim() ? search(val) : []);
  }, []);

  // ── Keyboard navigation inside dropdown ───────────────────────────────────
  function handleKeyUp(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      pick(results[activeIdx]);
    } else if (e.key === "Escape") {
      setResults([]);
      inputRef.current?.blur();
    }
  }

  function pick(r: SearchResult) {
    navigate(r.url);
    setQuery("");
    setResults([]);
    setActiveIdx(-1);
    inputRef.current?.blur();
  }

  // ── Auth0 user display ────────────────────────────────────────────────────
  const displayName = user?.name ?? user?.email ?? "User";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const showDropdown = searchFocused && results.length > 0;

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex w-full items-center gap-1 px-4">
        {/* Sidebar toggle */}
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

        {/* Search bar */}
        <div ref={searchRef} style={{ position: "relative" }} className="hidden md:block">
          <div
            className="flex items-center gap-2 px-3 transition-all duration-200"
            style={{
              width: "320px",
              height: "36px",
              background: "#F8FAFC",
              border: searchFocused ? "1px solid #002147" : "1px solid var(--border)",
              borderRadius: showDropdown ? "0.5rem 0.5rem 0 0" : "0.5rem",
              boxShadow: searchFocused ? "0 0 0 3px rgba(0,33,71,0.08)" : "none",
            }}
          >
            <Search size={14} style={{ color: "#94A3B8", flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder="Search MSN, Lessee, Lease ID…"
              onChange={(e) => handleQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={handleKeyUp}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "0.8125rem",
                color: "#0F172A",
                width: "100%",
                fontFamily: "'Inter', sans-serif",
              }}
            />
            <span
              style={{
                fontSize: "0.625rem",
                color: "#CBD5E1",
                border: "1px solid #E2E8F0",
                borderRadius: "0.25rem",
                padding: "1px 4px",
                whiteSpace: "nowrap",
                fontFamily: "monospace",
                lineHeight: 1.6,
                flexShrink: 0,
              }}
            >
              ⌘K
            </span>
          </div>

          {/* Results dropdown */}
          {showDropdown && (
            <div
              className="header-dropdown"
              style={{
                position: "absolute",
                top: "36px",
                left: 0,
                width: "320px",
                background: "#FFFFFF",
                border: "1px solid #002147",
                borderTop: "1px solid #E2E8F0",
                borderRadius: "0 0 0.5rem 0.5rem",
                boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                zIndex: 200,
                overflow: "hidden",
              }}
            >
              {results.map((r, i) => (
                <div
                  key={r.id}
                  onMouseDown={() => pick(r)}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    padding: "0.5rem 0.875rem",
                    cursor: "pointer",
                    background: i === activeIdx ? "#F1F5F9" : "#FFFFFF",
                    borderBottom: i < results.length - 1 ? "1px solid #F8FAFC" : "none",
                  }}
                >
                  <span style={{ flexShrink: 0 }}>{CATEGORY_ICON[r.category]}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.sublabel}
                    </div>
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "0.625rem",
                      color: "#CBD5E1",
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: "0.25rem",
                      padding: "1px 5px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {r.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent button */}
        <AgentButton />

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1">

          {/* Notifications / Alerts */}
          <div ref={bellRef} style={{ position: "relative" }}>
            <button
              className="relative flex items-center justify-center rounded-md transition-colors"
              style={{
                width: "34px",
                height: "34px",
                color: alertsOpen ? "#002147" : "#475569",
                background: alertsOpen ? "#F1F5F9" : "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { if (!alertsOpen) (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
              onMouseLeave={(e) => { if (!alertsOpen) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              onClick={() => setAlertsOpen((v) => !v)}
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1 right-1 flex items-center justify-center"
                  style={{ width: "14px", height: "14px", background: "#B91C1C", borderRadius: "50%", fontSize: "0.5rem", fontWeight: 700, color: "#FFFFFF", lineHeight: 1 }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {alertsOpen && (
              <AlertsPanel
                onClose={() => setAlertsOpen(false)}
                onOpenRules={() => { setAlertsOpen(false); setRulesOpen(true); }}
                onUnreadChange={setUnreadCount}
              />
            )}
          </div>

          {/* Email Report Distribution */}
          <div style={{ position: "relative" }}>
            <button
              className="flex items-center justify-center rounded-md transition-colors"
              style={{
                width: "34px",
                height: "34px",
                color: emailOpen ? "#002147" : "#475569",
                background: emailOpen ? "#F1F5F9" : "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { if (!emailOpen) (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
              onMouseLeave={(e) => { if (!emailOpen) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              onClick={() => setEmailOpen((v) => !v)}
              aria-label="Distribute Report"
            >
              <Mail size={18} />
            </button>
          </div>

          <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />

          {/* User pill + dropdown */}
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors"
              style={{ color: "#0F172A", background: menuOpen ? "#F1F5F9" : "transparent", border: "none", cursor: "pointer" }}
              onClick={() => setMenuOpen((v) => !v)}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9")}
              onMouseLeave={(e) => { if (!menuOpen) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {user?.picture && !picError ? (
                <img
                  src={user.picture}
                  alt={displayName}
                  style={{ width: "30px", height: "30px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  onError={() => setPicError(true)}
                />
              ) : (
                <div className="flex items-center justify-center shrink-0" style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#002147", fontSize: "0.75rem", fontWeight: 600, color: "#FFFFFF" }}>
                  {initials}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A", lineHeight: 1.2 }}>{displayName}</div>
                <div style={{ fontSize: "0.6875rem", color: "#94A3B8", lineHeight: 1.2 }}>{user?.email ?? ""}</div>
              </div>
              <ChevronDown size={13} style={{ color: "#94A3B8" }} className="hidden sm:block" />
            </button>

            {menuOpen && (
              <div
                className="header-dropdown"
                style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: "192px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.5rem", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 100, overflow: "hidden", padding: "0.25rem 0" }}>
                <button
                  onClick={() => { setMenuOpen(false); navigate("/settings/users"); }}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.5625rem 1rem", background: "transparent", border: "none", fontSize: "0.8125rem", color: "#0F172A", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                >
                  <CircleUser size={14} style={{ color: "#64748B", flexShrink: 0 }} />
                  Profile Settings
                </button>
                <button
                  onClick={() => { setMenuOpen(false); navigate("/settings"); }}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.5625rem 1rem", background: "transparent", border: "none", fontSize: "0.8125rem", color: "#0F172A", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                >
                  <Bell size={14} style={{ color: "#64748B", flexShrink: 0 }} />
                  Notifications
                </button>
                <div style={{ height: "1px", background: "#F1F5F9", margin: "0.25rem 0" }} />
                <button
                  onClick={() => logout({ logoutParams: { returnTo: window.location.origin + "/login" } })}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.5625rem 1rem", background: "transparent", border: "none", fontSize: "0.8125rem", color: "#B91C1C", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals rendered inside header so they're scoped to the layout */}
      {rulesOpen && <AlertRulesConfig onClose={() => setRulesOpen(false)} />}
      {emailOpen && <EmailReportModal onClose={() => setEmailOpen(false)} />}
    </header>
  );
}
