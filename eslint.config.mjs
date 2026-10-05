import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const dbImports = {
  group: ["@/db", "@/db/*", "dexie", "dexie-react-hooks", "**/db", "**/db/*"],
  message: "Read through data/ hooks and write through repo/ functions (BRIEF.md §3.2.1).",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // §3.2.1: components never touch the database directly.
  {
    files: ["app/**", "components/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [dbImports] }] },
  },
  // §3.2.5: lib/ is pure logic. No database, no repo, no React.
  {
    files: ["lib/**"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            dbImports,
            { group: ["@/repo", "@/repo/*", "@/data", "@/data/*", "react", "react-dom"], message: "lib/ holds pure functions only." },
          ],
        },
      ],
    },
  },
  // Plain Node scripts (CommonJS).
  { files: ["**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
