import { useState } from "react";
import { Bell, Search, Mail, ChevronDown } from "lucide-react";
import { SidebarTrigger } from "../ui/sidebar";
import { Separator } from "../ui/separator";

export function Header() {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex w-full items-center gap-1 px-4">
        {/* Sidebar toggle */}
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />

        {/* Search bar */}
        <div
          className="hidden md:flex items-center gap-2 px-3 transition-all duration-200"
          style={{
            width: "320px",
            height: "36px",
            background: "#F8FAFC",
            border: searchFocused
              ? "1px solid #002147"
              : "1px solid var(--border)",
            borderRadius: "0.5rem",
            boxShadow: searchFocused ? "0 0 0 3px rgba(0,33,71,0.08)" : "none",
          }}
        >
          <Search size={14} style={{ color: "#94A3B8", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search MSN, Lessee, Lease ID…"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
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
            }}
          >
            ⌘K
          </span>
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1">
          {/* Notifications */}
          <button
            className="relative flex items-center justify-center rounded-md transition-colors"
            style={{
              width: "34px",
              height: "34px",
              color: "#475569",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "#F1F5F9")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "transparent")
            }
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span
              className="absolute top-1 right-1 flex items-center justify-center"
              style={{
                width: "14px",
                height: "14px",
                background: "#B91C1C",
                borderRadius: "50%",
                fontSize: "0.5rem",
                fontWeight: 700,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              3
            </span>
          </button>

          {/* Messages */}
          <button
            className="flex items-center justify-center rounded-md transition-colors"
            style={{
              width: "34px",
              height: "34px",
              color: "#475569",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "#F1F5F9")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "transparent")
            }
            aria-label="Messages"
          >
            <Mail size={18} />
          </button>

          {/* Divider */}
          <Separator
            orientation="vertical"
            className="mx-1 data-[orientation=vertical]:h-5"
          />

          {/* User pill */}
          <button
            className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors"
            style={{
              color: "#0F172A",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "#F1F5F9")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "transparent")
            }
          >
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                background: "#002147",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#FFFFFF",
              }}
            >
              AJ
            </div>
            <div className="hidden sm:block text-left">
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#0F172A",
                  lineHeight: 1.2,
                }}
              >
                Alex Johnson
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 400,
                  color: "#94A3B8",
                  lineHeight: 1.2,
                }}
              >
                Risk Analyst
              </div>
            </div>
            <ChevronDown
              size={13}
              style={{ color: "#94A3B8" }}
              className="hidden sm:block"
            />
          </button>
        </div>
      </div>
    </header>
  );
}
