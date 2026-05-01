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
  EllipsisVertical,
  LogOut,
  CircleUser,
  Bell,
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
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
  useSidebar,
} from "../ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
} from "../ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

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
          { title: "Lease Register", url: "/portfolio", icon: Layers },
          { title: "Analytics", url: "/portfolio", icon: TrendingUp },
          { title: "Aircraft Mix", url: "/portfolio", icon: PlaneTakeoff },
        ],
      },
      {
        title: "Scenarios",
        url: "/scenarios",
        icon: Target,
        items: [
          { title: "Library", url: "/scenarios", icon: Library },
          { title: "Run Config", url: "/scenarios", icon: Play },
          { title: "Run History", url: "/scenarios", icon: History },
        ],
      },
      {
        title: "Risk & ECL",
        url: "/risk-ecl",
        icon: AlertTriangle,
        items: [
          { title: "ECL Summary", url: "/risk-ecl", icon: BarChart2 },
          { title: "Migration Matrix", url: "/risk-ecl", icon: ArrowLeftRight },
          { title: "Waterfall", url: "/risk-ecl", icon: Droplets },
        ],
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "Counterparties", url: "/counterparties", icon: Handshake },
      { title: "Jurisdictions", url: "/jurisdictions", icon: Globe },
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
          { title: "Templates", url: "/reports", icon: LayoutTemplate },
          { title: "Scheduled", url: "/reports", icon: CalendarClock },
          { title: "Export Log", url: "/reports", icon: Download },
        ],
      },
      {
        title: "Settings",
        url: "/settings",
        icon: Settings,
        items: [
          { title: "Firm Profile", url: "/settings", icon: Building2 },
          { title: "Users & Access", url: "/settings", icon: Users },
          { title: "Data Sources", url: "/settings", icon: DatabaseZap },
          { title: "ECL Parameters", url: "/settings", icon: SlidersHorizontal },
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

function NavFlatItem({ item }: { item: NavItem }) {
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
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ─── User footer ───────────────────────────────────────────────────────────────

function NavUser() {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: "#002147", color: "#FFFFFF" }}
              >
                AJ
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium text-sidebar-accent-foreground">
                  Alex Johnson
                </span>
                <span className="truncate text-xs" style={{ color: "#64748B" }}>
                  alex@aerinsights.com
                </span>
              </div>
              <EllipsisVertical className="ml-auto size-4 text-sidebar-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: "#002147", color: "#FFFFFF" }}
                >
                  AJ
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Alex Johnson</span>
                  <span className="truncate text-xs text-muted-foreground">
                    alex@aerinsights.com
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate("/settings")}
              >
                <CircleUser className="mr-2 size-4" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate("/settings")}
              >
                <Bell className="mr-2 size-4" />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// ─── Main sidebar component ────────────────────────────────────────────────────

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate();

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
                style={{ background: "#002147" }}
              >
                <BarChart3 size={18} className="text-white" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-sidebar-accent-foreground">
                  Aerinsights
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
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) =>
                item.items ? (
                  <NavGroupItem
                    key={item.title}
                    item={item as NavItem & { items: SubItem[] }}
                  />
                ) : (
                  <NavFlatItem key={item.title} item={item} />
                )
              )}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}