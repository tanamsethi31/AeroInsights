// src/app/contexts/OnboardingContext.tsx
import { createContext, useContext, useState, type ReactNode } from "react";

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  link: string;
  completed: boolean;
}

interface OnboardingState {
  isNewTenant: boolean;               // true after first import completes
  importSummary: { leaseCount: number; lesseeCount: number } | null;
  checklist: ChecklistItem[];
  checklistDismissed: boolean;
}

interface OnboardingContextType extends OnboardingState {
  markImportComplete: (leaseCount: number, lesseeCount: number) => void;
  toggleItem: (id: string) => void;
  dismissChecklist: () => void;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  {
    id: "sicr",
    label: "Set your SICR triggers",
    description: "Configure Stage 2 thresholds: days past due, PD increase multiplier, rating notch downgrade.",
    link: "/settings/ecl",
    completed: false,
  },
  {
    id: "scenario-weights",
    label: "Configure scenario weights",
    description: "Baseline / Adverse / Severe must sum to 100%. Default is 60/25/15.",
    link: "/settings/ecl",
    completed: false,
  },
  {
    id: "review-lessees",
    label: "Review 3 flagged lessees",
    description: "Watchlist has surfaced lessees with elevated risk scores. Review and set mitigations.",
    link: "/counterparties",
    completed: false,
  },
  {
    id: "stress-test",
    label: "Run your first stress test",
    description: "Open the Scenario Builder and run a Fuel Spike or COVID Replay stress test.",
    link: "/scenarios/run",
    completed: false,
  },
];

const STORAGE_KEY = "aero_onboarding";

function loadFromStorage(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as OnboardingState;
  } catch {
    // ignore corrupt storage
  }
  return {
    isNewTenant: false,
    importSummary: null,
    checklist: DEFAULT_CHECKLIST,
    checklistDismissed: false,
  };
}

function saveToStorage(state: OnboardingState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

const OnboardingContext = createContext<OnboardingContextType>({
  isNewTenant: false,
  importSummary: null,
  checklist: DEFAULT_CHECKLIST,
  checklistDismissed: false,
  markImportComplete: () => {},
  toggleItem: () => {},
  dismissChecklist: () => {},
});

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(loadFromStorage);

  function update(next: OnboardingState) {
    setState(next);
    saveToStorage(next);
  }

  function markImportComplete(leaseCount: number, lesseeCount: number) {
    update({
      ...state,
      isNewTenant: true,
      importSummary: { leaseCount, lesseeCount },
    });
  }

  function toggleItem(id: string) {
    update({
      ...state,
      checklist: state.checklist.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      ),
    });
  }

  function dismissChecklist() {
    update({ ...state, checklistDismissed: true });
  }

  return (
    <OnboardingContext.Provider
      value={{ ...state, markImportComplete, toggleItem, dismissChecklist }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
