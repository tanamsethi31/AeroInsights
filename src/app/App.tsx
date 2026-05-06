import { RouterProvider } from "react-router";
import { router } from "./routes";
import { PortfolioProvider } from "./contexts/PortfolioContext";
import { ViewModeProvider } from "./contexts/ViewModeContext";
import { OnboardingProvider } from "./contexts/OnboardingContext";

export default function App() {
  return (
    <OnboardingProvider>
      <PortfolioProvider>
        <ViewModeProvider>
          <RouterProvider router={router} />
        </ViewModeProvider>
      </PortfolioProvider>
    </OnboardingProvider>
  );
}
