import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // `next lint` already restricts to src/pages/app by default so the local
  // `npm run lint` gate never touches e2e/. Whole-tree analyzers (historically
  // Qodana, retired 2026-07) trip on e2e files no flat-config block matches.
  // Ignore e2e here so all surfaces are consistent. (E2E files are typed via
  // tsconfig + checked by Playwright.)
  {
    ignores: ["e2e/**", "playwright-report/**", "test-results/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Disable TypeScript-specific rules that are too strict
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-unused-expressions": "off",

      // Next.js specific rules
      "@next/next/no-img-element": "warn",

      // Other helpful rules to disable during development
      "no-unused-vars": "off", // Turn off base rule as it can conflict with @typescript-eslint/no-unused-vars
      "no-unused-expressions": "off",
      // Permit console.warn/error (legitimate production signals) but flag
      // console.log as noise. console.debug/info follow the same rationale
      // as .log — they're typically dev-time scaffolding and shouldn't ship.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];

export default eslintConfig;
