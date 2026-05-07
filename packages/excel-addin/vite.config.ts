import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { resolve } from "path";

/**
 * Vite config for the Aeroinsights Excel Add-in.
 *
 * Architecture note on functions.js:
 * ─────────────────────────────────
 * Office custom functions must be a single self-contained plain-JavaScript file.
 * We keep it in public/functions/functions.js so Vite copies it verbatim to dist/
 * without any bundling, hashing, or TypeScript compilation.
 *
 * src/functions/functions.html IS processed by Vite (it's an HTML entry), but the
 * <script src="/functions/functions.js"> inside it is a plain script tag (no
 * type="module"), so Vite does NOT bundle it — it stays as a URL reference.
 *
 * In both dev and production:
 *   /functions/functions.html  → built from src/functions/functions.html
 *   /functions/functions.js    → copied verbatim from public/functions/functions.js
 *
 * The auth-dialog.html entry handles the Auth0 PKCE sign-in flow inside an
 * Office dialog (opened via Office.context.ui.displayDialogAsync).
 */
export default defineConfig({
  plugins: [react(), basicSsl()],

  build: {
    rollupOptions: {
      input: {
        taskpane:    resolve(__dirname, "src/taskpane/index.html"),
        functions:   resolve(__dirname, "src/functions/functions.html"),
        authDialog:  resolve(__dirname, "src/taskpane/auth-dialog.html"),
      },
      output: {
        // Keep asset names predictable for task pane / auth-dialog bundles.
        // functions.js is NOT in rollupOptions.input — it lives in public/.
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },

  server: {
    https: true,
    port: 3100,
    // Needed so Office can reach the dev server from cross-origin frames
    cors: true,
  },

  preview: {
    https: true,
    port: 3100,
  },
});
