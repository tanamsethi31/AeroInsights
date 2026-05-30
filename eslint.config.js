// eslint.config.js
//
// Minimal flat config targeting the bug classes that broke prod:
//   • react-hooks/rules-of-hooks       — catches hooks called in conditions/loops
//   • react-hooks/exhaustive-deps      — catches the Scenarios-style TDZ where
//                                        useCallback/useMemo deps reference an
//                                        identifier declared later in the body
//
// Intentionally minimal. Add more rules incrementally; don't reactivate
// stylistic rules that would generate thousands of warnings on legacy files.

import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "api/**/*.ts"],
    ignores: [
      "node_modules",
      "dist",
      "graphify-out",
      "src/imports/pasted_text/**",
      "api/risk-engine/**",
      "api/scenarios/**",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks":  "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
