import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import sonarjs from 'eslint-plugin-sonarjs';

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
    ignores: ['e2e/**', 'playwright-report/**', 'test-results/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Cognitive complexity, enforced LOCALLY (SonarCloud's S3776). Sonar has caught
    // this rule post-PR on four separate slices — S4-scene, S6-foundation, S6a and
    // S6b-3 — each costing a merge-gate round trip on a finding that a pre-commit
    // lint could have shown in seconds. Same threshold Sonar uses (15), so the two
    // agree instead of arguing.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: { sonarjs },
    rules: { 'sonarjs/cognitive-complexity': ['error', 15] },
  },
  {
    // BASELINE — the 15 files already over the line when the rule was switched on,
    // with their measured complexity. New code is guarded from here on; this list
    // only shrinks. Mirrors the backend's .editorconfig baseline convention
    // (backend CLAUDE.md §7): when a file drops under 15, delete its line, and when
    // the list empties, delete this block. Do NOT add to it — a new violation means
    // the function wants splitting, which is the entire point of the rule.
    files: [
      'src/components/admin/PointRuleForm.tsx', // 43
      'src/templates/classic/HomePage.tsx', // 32
      'src/templates/craft/HomePage.tsx', // 30
      'src/components/admin/product/productFormUtils.ts', // 28
      'src/hooks/useProductDetails.ts', // 28
      'src/utils/apiClient.ts', // 28
      'src/app/app-internal-layout.tsx', // 25
      'src/components/RoleNavLinks.tsx', // 22
      'src/app/account/page.tsx', // 20
      'src/templates/classic/chrome/CustomerChrome.tsx', // 20
      'src/services/cashierService.ts', // 19
      'src/utils/templates/kitchenReceipt.ts', // 19
      'src/utils/templates/simpleReceipt.ts', // 19
      'src/components/admin/EditCategoryModal.tsx', // 16
      'src/utils/customerDiscountForm.ts', // 16
    ],
    rules: { 'sonarjs/cognitive-complexity': 'off' },
  },
  {
    rules: {
      // Disable TypeScript-specific rules that are too strict
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-unused-expressions': 'off',

      // Next.js specific rules
      '@next/next/no-img-element': 'warn',

      // Other helpful rules to disable during development
      'no-unused-vars': 'off', // Turn off base rule as it can conflict with @typescript-eslint/no-unused-vars
      'no-unused-expressions': 'off',
      // Permit console.warn/error (legitimate production signals) but flag
      // console.log as noise. console.debug/info follow the same rationale
      // as .log — they're typically dev-time scaffolding and shouldn't ship.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];

export default eslintConfig;
