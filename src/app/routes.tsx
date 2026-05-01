import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Portfolio from "./pages/Portfolio";
import Scenarios from "./pages/Scenarios";
import RiskECL from "./pages/RiskECL";
import Counterparties from "./pages/Counterparties";
import Jurisdictions from "./pages/Jurisdictions";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "portfolio", Component: Portfolio },
      { path: "scenarios", Component: Scenarios },
      { path: "risk-ecl", Component: RiskECL },
      { path: "counterparties", Component: Counterparties },
      { path: "jurisdictions", Component: Jurisdictions },
      { path: "reports", Component: Reports },
      { path: "settings", Component: Settings },
    ],
  },
]);
