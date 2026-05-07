import { createContext, useContext, useState, type ReactNode } from "react";

const STORAGE_KEY = "aeroinsights:executive_mode";

interface ViewModeContextType {
  isExecutiveMode: boolean;
  setIsExecutiveMode: (v: boolean) => void;
}

const ViewModeContext = createContext<ViewModeContextType>({
  isExecutiveMode: false,
  setIsExecutiveMode: () => {},
});

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [isExecutiveMode, setIsExecutiveModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  function setIsExecutiveMode(v: boolean) {
    setIsExecutiveModeState(v);
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      // localStorage unavailable — no-op
    }
  }

  return (
    <ViewModeContext.Provider value={{ isExecutiveMode, setIsExecutiveMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
