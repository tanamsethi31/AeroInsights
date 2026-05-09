// src/app/App.tsx
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { PortfolioProvider } from "./contexts/PortfolioContext";
import { ViewModeProvider } from "./contexts/ViewModeContext";
import { OnboardingProvider } from "./contexts/OnboardingContext";
import { DataProvider } from "./contexts/DataContext";

export default function App() {
  return (
    <OnboardingProvider>
      <DataProvider>
        <PortfolioProvider>
          <ViewModeProvider>
            <RouterProvider router={router} />
          </ViewModeProvider>
        </PortfolioProvider>
      </DataProvider>
    </OnboardingProvider>
  );
}
