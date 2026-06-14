// src/app/components/tour/tourSteps.ts
//
// Sample-portfolio guided tour. 9 steps across 6 pages, tuned for the
// aviation-lessor risk / ECL / audit audience — the people the platform
// is actually built for. Each step is short enough to read in 5 seconds.

export interface TourStep {
  /** CSS selector — typically [data-tour="..."]. */
  selector: string;
  /** Route the element lives on. The engine navigates here if needed. */
  path: string;
  title: string;
  description: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  /**
   * "anchor" (default) — popover positions next to its selector.
   * "corner"           — popover floats above the replay-tour pill in
   *                      the bottom-right corner. Used for full-page
   *                      steps where there's no single small element
   *                      to point at; keeps the popover out of the
   *                      content the description is referring to.
   */
  placement?: "anchor" | "corner";
}

export const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="dashboard-kpis"]',
    path: "/",
    title: "Portfolio at a glance",
    description:
      "Book value, weighted PD/LGD, and total IFRS 9 ECL split across Stage 1/2/3 — the headline numbers a risk committee asks for first.",
    side: "bottom",
    align: "start",
  },
  {
    selector: '[data-tour="dashboard-ecl-trend"]',
    path: "/",
    title: "6-month ECL trajectory",
    description:
      "Where provisions are moving and which stage is driving the change. Hover any month for the Stage 1/2/3 breakdown and migration count.",
    side: "top",
    align: "center",
  },
  {
    selector: '[data-tour="dashboard-globe"]',
    path: "/",
    title: "Lessee intelligence map",
    description:
      "Risk-coloured by jurisdiction. Hover any country to inspect lessees, exposure, and recent news signals from the live feed.",
    side: "left",
    align: "center",
  },
  {
    selector: '[data-tour="portfolio-leases"]',
    path: "/portfolio/aircraft-mix",
    title: "Lease-level book",
    description:
      "Every aircraft, every lessee, every stage assignment — sortable, filterable, with one-click Excel export and Excel Add-in live link.",
    placement: "corner",
  },
  {
    selector: '[data-tour="scenarios-library"]',
    path: "/scenarios/library",
    title: "12 pre-calibrated stress scenarios",
    description:
      "Macro shocks, distress scenarios, sovereign events — each runs in seconds with Shapley-decomposed driver attribution.",
    placement: "corner",
  },
  {
    selector: '[data-tour="build-coefficients"]',
    path: "/build",
    title: "Build your own scenario",
    description:
      "20+ macro coefficients (GDP, fuel, FX, rates) feed lease-level ECL plus a 10,000-path Monte Carlo loss distribution.",
    side: "right",
    align: "start",
  },
  {
    selector: '[data-tour="risk-ecl-migration"]',
    path: "/risk-ecl/migration",
    title: "IFRS 9 staging engine",
    description:
      "Automated SICR triggers — payment delays, FX shocks, rating downgrades — with every stage transition logged to an immutable audit trail.",
    placement: "corner",
  },
  {
    selector: '[data-tour="intelligence-jx"]',
    path: "/intelligence/jx-watch",
    title: "Cape Town Convention & jurisdiction risk",
    description:
      "Repossession timelines, ratification quality, sanctions screening per country. The legal layer your ECL depends on.",
    placement: "corner",
  },
  {
    selector: '[data-tour="ai-assistant-button"]',
    path: "/",
    title: "Ask anything",
    description:
      'Plain-English Q&A grounded in your portfolio data — with citations, no fabrication. Try "what\'s our Brazil exposure under a fuel spike?"',
    side: "bottom",
    align: "end",
  },
];

export const TOUR_VERSION_KEY = "aero_tour_v1_completed";
