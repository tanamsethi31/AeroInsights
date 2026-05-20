import * as React from "react";
import { useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard,
  BookOpen,
  Target,
  AlertTriangle,
  Handshake,
  Globe,
  FileText,
  Settings,
  BarChart3,
  ChevronRight,
  Layers,
  TrendingUp,
  PlaneTakeoff,
  Library,
  Play,
  History,
  BarChart2,
  ArrowLeftRight,
  Droplets,
  LayoutTemplate,
  CalendarClock,
  Download,
  Building2,
  Users,
  DatabaseZap,
  SlidersHorizontal,
  Briefcase,
  Banknote,
  FileSearch,
  Layers2,
  TrendingDown,
  FileSpreadsheet,
  Zap,
  Activity,
  Landmark,
  FolderOpen,
} from "lucide-react";

import { useViewMode } from "../../contexts/ViewModeContext";
import { usePortfolio } from "../../contexts/PortfolioContext";
import { WATCHLIST_DATA } from "../counterparties/watchlistEngine";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarFooter,
} from "../ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
} from "../ui/collapsible";

// ─── Nav data ─────────────────────────────────────────────────────────────────

type SubItem = { title: string; url: string; icon: React.ElementType };
type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  items?: SubItem[];
};
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Analysis",
    items: [
      {
        title: "Portfolio",
        url: "/portfolio",
        icon: BookOpen,
        items: [
          { title: "Leases",        url: "/portfolio/register",     icon: Layers       },
          { title: "Concentration", url: "/portfolio/analytics",    icon: TrendingUp   },
          { title: "Aircraft",      url: "/portfolio/aircraft-mix", icon: PlaneTakeoff },
        ],
      },
      {
        title: "Scenarios",
        url: "/scenarios",
        icon: Target,
        items: [
          { title: "Library",         url: "/scenarios/library", icon: Library },
          { title: "Custom Builder",  url: "/scenarios/run",     icon: Play    },
          { title: "Run History",     url: "/scenarios/history", icon: History },
        ],
      },
      {
        title: "Deals",
        url: "/deals",
        icon: Banknote,
        items: [
          { title: "Lease Generator", url: "/deals/generator",  icon: FileSearch  },
          { title: "Rack & Stack",    url: "/deals/rack-stack", icon: Layers2     },
          { title: "Exit NPV",        url: "/deals/exit-npv",   icon: TrendingDown },
        ],
      },
      {
        title: "Transactions",
        url: "/transactions",
        icon: Landmark,
        items: [
          { title: "Overview",      url: "/transactions", icon: BarChart2 },
          { title: "Run Waterfall", url: "/transactions", icon: Play      },
        ],
      },
      {
        title: "Risk & ECL",
        url: "/risk-ecl",
        icon: AlertTriangle,
        items: [
          { title: "ECL Overview",    url: "/risk-ecl/summary",   icon: BarChart2      },
          { title: "Stage Migration", url: "/risk-ecl/migration", icon: ArrowLeftRight },
          { title: "Sensitivity",     url: "/risk-ecl/waterfall", icon: Droplets       },
        ],
      },
    ],
  },
  {
    label: "Reconciliation",
    items: [
      {
        title: "Bank Statements",
        url: "/reconciliation",
        icon: FileText,
        items: [
          { title: "Statements",   url: "/reconciliation", icon: FileSpreadsheet },
          { title: "Transactions", url: "/reconciliation", icon: ArrowLeftRight  },
        ],
      },
      {
        title: "Cash Flow",
        url:   "/cash-flow",
        icon:  TrendingUp,
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        title: "Aero Intelligence",
        url: "/intelligence",
        icon: Zap,
        items: [
          { title: "Macro Signals",      url: "/intelligence/signals",      icon: TrendingUp },
          { title: "Lessee Radar",       url: "/intelligence/lessee-radar", icon: Activity   },
          { title: "Deal Feed",          url: "/intelligence/deal-feed",    icon: FileSearch  },
          { title: "Jurisdiction Watch", url: "/intelligence/jx-watch",    icon: Globe       },
        ],
      },
      { title: "Counterparties", url: "/counterparties", icon: Handshake },
      { title: "Jurisdictions",  url: "/jurisdictions",  icon: Globe     },
    ],
  },
  {
    label: "Reporting",
    items: [
      {
        title: "Reports",
        url: "/reports",
        icon: FileText,
        items: [
          { title: "Report Templates",  url: "/reports/templates",  icon: LayoutTemplate },
          { title: "Scheduled Reports", url: "/reports/scheduled",  icon: CalendarClock  },
          { title: "Export History",    url: "/reports/export-log", icon: Download       },
        ],
      },
      {
        title: "Settings",
        url: "/settings",
        icon: Settings,
        items: [
          { title: "Tenant",        url: "/settings/firm",         icon: Building2         },
          { title: "Users & RBAC",  url: "/settings/users",        icon: Users             },
          { title: "Data Sources",  url: "/settings/data-sources", icon: DatabaseZap       },
          { title: "Model Params",  url: "/settings/ecl",          icon: SlidersHorizontal },
          { title: "Excel Add-in", url: "/settings/excel",        icon: FileSpreadsheet   },
        ],
      },
    ],
  },
];

// ─── Collapsible nav group item ────────────────────────────────────────────────

function NavGroupItem({ item }: { item: NavItem & { items: SubItem[] } }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive =
    location.pathname === item.url ||
    location.pathname.startsWith(item.url + "/");
  const [open, setOpen] = React.useState(isActive);

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={item.title}
          isActive={isActive}
          onClick={() => navigate(item.url)}
          className="cursor-pointer"
        >
          <item.icon />
          <span>{item.title}</span>
          {/* Arrow toggle — stops propagation so the nav click doesn't also fire */}
          <span
            className="ml-auto flex items-center justify-center p-0.5 rounded hover:bg-sidebar-accent"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((prev) => !prev);
            }}
          >
            <ChevronRight
              className={`size-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            />
          </span>
        </SidebarMenuButton>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((sub) => (
              <SidebarMenuSubItem key={sub.title}>
                <SidebarMenuSubButton
                  onClick={() => navigate(sub.url)}
                  className="cursor-pointer"
                >
                  <sub.icon />
                  <span>{sub.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ─── Flat nav item ─────────────────────────────────────────────────────────────

function NavFlatItem({ item, badge }: { item: NavItem; badge?: number }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive =
    item.url === "/"
      ? location.pathname === "/"
      : location.pathname === item.url ||
        location.pathname.startsWith(item.url + "/");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.title}
        isActive={isActive}
        onClick={() => navigate(item.url)}
        className="cursor-pointer"
      >
        <item.icon />
        <span>{item.title}</span>
        {badge != null && badge > 0 && (
          <span
            style={{
              marginLeft: "auto",
              background: "#B91C1C",
              color: "#FFFFFF",
              borderRadius: "9999px",
              fontSize: "0.625rem",
              fontWeight: 700,
              padding: "0 0.3rem",
              minWidth: "16px",
              height: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            {badge}
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ─── Main sidebar component ────────────────────────────────────────────────────

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate();
  const { isExecutiveMode, setIsExecutiveMode } = useViewMode();
  const { setActivePortfolio } = usePortfolio();

  /** Count of non-green lessees — shown as badge on the Counterparties nav item */
  const alertCount = React.useMemo(
    () => Object.values(WATCHLIST_DATA).filter(e => e.status !== "green").length,
    []
  );

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      {/* Header / Logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={() => navigate("/")}
              className="cursor-pointer"
            >
              <div
                className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "#002147", padding: "5px" }}
              >
                <img
                  src="/logo.png"
                  alt="Aeroinsights"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-sidebar-accent-foreground">
                  Aeroinsights
                </span>
                <span
                  className="truncate text-xs"
                  style={{ color: "#64748B" }}
                >
                  Decision Platform
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="gap-0">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) =>
                item.items ? (
                  <NavGroupItem
                    key={item.title}
                    item={item as NavItem & { items: SubItem[] }}
                  />
                ) : (
                  <NavFlatItem
                    key={item.title}
                    item={item}
                    badge={item.title === "Counterparties" ? alertCount : undefined}
                  />
                )
              )}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer / Controls */}
      <SidebarFooter style={{ borderTop: "1px solid #1e293b", paddingTop: "0.5rem" }}>
          <SidebarMenu>
            {/* Switch Portfolio */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  setActivePortfolio(null);
                  navigate("/portfolios");
                }}
                className="cursor-pointer"
                tooltip="Switch Portfolio"
              >
                <FolderOpen size={18} />
                <span>Switch Portfolio</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Executive Mode toggle */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setIsExecutiveMode(!isExecutiveMode)}
                className="cursor-pointer"
                tooltip="Executive Mode"
              >
                <Briefcase size={18} />
                <span>Executive Mode</span>
                {/* Toggle pill */}
                <div
                  style={{
                    marginLeft: "auto",
                    width: "36px",
                    height: "20px",
                    borderRadius: "10px",
                    background: isExecutiveMode ? "#16A34A" : "#2d3f55",
                    position: "relative",
                    flexShrink: 0,
                    transition: "background 200ms cubic-bezier(0.23,1,0.32,1)",
                    pointerEvents: "none",
                    boxShadow: isExecutiveMode
                      ? "0 0 0 2px rgba(22,163,74,0.25)"
                      : "none",
                  }}
                >
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      position: "absolute",
                      top: "2px",
                      left: isExecutiveMode ? "18px" : "2px",
                      transition: "left 200ms cubic-bezier(0.23,1,0.32,1)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.30)",
                    }}
                  />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}