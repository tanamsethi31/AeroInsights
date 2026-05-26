// vitest.config.ts
//
// T-6.1 — coverage thresholds enforced via v8. Scope: api/_lib (pure
// server-side helpers) + src/app/utils (pure frontend utils). Other
// code lives in components/hooks/pages and is exercised by Playwright
// once T-6.2 lands.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "api/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      include:  [
        "api/_lib/**/*.ts",
        "src/app/utils/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "**/index.ts",
        // Bulk Excel + PDF helpers that need heavy fixture set-up to
        // exercise meaningfully. Tracked for follow-up coverage:
        "src/app/utils/excelParser.ts",
        "src/app/utils/scenarioExport.ts",
        "src/app/utils/sdmrHelpers.ts",
      ],
      thresholds: {
        lines:      60,
        functions:  60,
        statements: 60,
        branches:   55,
      },
    },
  },
});
