import React from "react";
import ReactDOM from "react-dom/client";
import TaskPane from "./TaskPane";

/**
 * main.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Entry point for the Aeroinsights Excel Add-in task pane.
 *
 * Waits for Office.onReady before mounting React so that Office.js APIs
 * (Excel.run, Office.context.ui, etc.) are available when components render.
 *
 * Note: Auth0 sign-in happens inside an Office dialog (see auth-dialog.ts).
 * This file does NOT handle OAuth callbacks — the task pane never navigates
 * away from its URL (unlike the dialog page which does the PKCE redirect).
 */

Office.onReady(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <TaskPane />
    </React.StrictMode>
  );
});
