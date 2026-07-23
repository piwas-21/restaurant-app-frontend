module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  // Stale per-session git worktrees (gitignored, local-only) duplicate the
  // whole tree; their test copies resolve `@/` aliases against the MAIN tree
  // and go red on any API change. CI never has them — ignore them locally too.
  testPathIgnorePatterns: ['/node_modules/', String.raw`/\.claude/`],
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  transform: {
    '^.+\.(js|jsx|ts|tsx)$': [
      'babel-jest',
      {
        presets: [
          [
            'next/babel',
            {
              'preset-react': {
                runtime: 'automatic',
              },
            },
          ],
        ],
      },
    ],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
    '^@/config/(.*)$': '<rootDir>/src/config/$1',
    '^@/contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/schemas/(.*)$': '<rootDir>/src/schemas/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/design-system/(.*)$': '<rootDir>/src/design-system/$1',
    // Tenant UI template alias (ADR-006). Jest always resolves to `classic`,
    // matching the tsconfig type-source; templates get covered by the
    // per-template Playwright screenshot suite, not unit tests.
    '^@active-template$': '<rootDir>/src/templates/classic',
    '^@active-template/(.*)$': '<rootDir>/src/templates/classic/$1',
    'next/router': '<rootDir>/__mocks__/nextRouterMock.js',
  },
  transformIgnorePatterns: ['/node_modules/', String.raw`^.+\.module\.(css|sass|scss)$`],
  collectCoverage: false,
  collectCoverageFrom: [
    'src/components/**/*.tsx',
    'src/app/**/*.tsx',
    'src/services/formFieldConfigService.ts',
    'src/hooks/useCustomerFormFields.ts',
    'src/hooks/admin/useCustomerFormsAdmin.ts',
    'src/utils/reservationForm.ts',
    'src/utils/productTypeFilter.ts',
    'src/utils/productEditorDefaults.ts',
    'src/lib/tableCanvasGeometry.ts',
    'src/components/admin/product/productFormUtils.ts',
    '!src/**/*.test.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.spec.tsx',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  // Coverage gate — PER-FILE thresholds for the files that actually have
  // tests today. The global threshold is intentionally NOT set (PR #79
  // review, gemini): a global floor at sub-1% is fragile — any large
  // untested file added to the tree drops the average and redlines the
  // gate independently of test quality, so the gate's behaviour ends up
  // driven by file size rather than the thing we care about (regressions
  // in covered code).
  //
  // Shape of the gate instead:
  //   - Each file that has a unit test gets a per-file threshold pinned
  //     just below its current actual coverage (actual − ~1pt, "floor
  //     minus a hair", same pattern as backend coverlet — see workspace
  //     CLAUDE.md §7). A real regression on that file (deleted test,
  //     new untested branch) fails the build.
  //   - Untested files don't drag down a global average because there
  //     is no global average being enforced. They just sit at 0% until
  //     somebody ships a test for them.
  //
  // To add a new file to the gate:
  //   1. Ship the *.test.{ts,tsx} alongside the source file.
  //   2. Run `npm test -- --coverage` and read the per-file pct.
  //   3. Add a row below pinned at actual − 1pt (or 99 if the file is
  //      at 100%). Same MR — test + gate row together.
  //
  // To ratchet a row up: after a test-improvement MR raises the actual
  // pct, bump the row in a chore: MR and link the run that proves it.
  coverageThreshold: {
    // B2 (cart instructions) — the /cart special-instructions editor is now the single owner of
    // item notes for EVERY item (the gate that hid it for customized items on prod is gone), and
    // the customizations summary no longer duplicates the notes line. The editor's display/edit/
    // save/cancel paths are pinned; the customizations summary pins its ingredient/side structure.
    './src/components/cart/cart-page/CartItemInstructionsEditor.tsx': {
      statements: 99,
      branches: 80,
      functions: 99,
      lines: 99,
    },
    './src/components/cart/cart-page/CartItemCustomizations.tsx': {
      statements: 87,
      branches: 58,
      functions: 66,
      lines: 87,
    },
    // Slice 7 PR2d — the unified admin editor. `productEditorDefaults` is the pure
    // fetched-product → form-state mapping (the load-bearing half, incl. the real
    // primary-category resolution); `ProductEditorPage` is the composition + the single
    // Save. `BundlePanel` sits lower because its file-picker and section-change handlers
    // are not exercised — the panel's kind-specific *structure* is what the tests pin.
    './src/utils/productEditorDefaults.ts': {
      statements: 95,
      branches: 61,
      functions: 99,
      lines: 99,
    },
    './src/components/admin/product-editor/ProductEditorPage.tsx': {
      statements: 92,
      branches: 80,
      functions: 74,
      lines: 92,
    },
    './src/components/admin/product-editor/BundlePanel.tsx': {
      statements: 49,
      branches: 39,
      functions: 32,
      lines: 49,
    },
    // Slice 7 PR2e — existing-image management, migrated to immediate per-image endpoint
    // calls (no rival Save), self-managing its list so an op never discards the form's edits.
    // Set-primary, sort-on-blur, delete, and the failure path are all pinned.
    './src/components/admin/product-editor/ImageGallery.tsx': {
      statements: 92,
      branches: 82,
      functions: 95,
      lines: 97,
    },
    './src/components/admin/product-editor/ImageActions.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // Slice 7 PR2e — the "New product" type chooser (create entry). Fully covered.
    './src/components/admin/menu-management/NewProductTypeModal.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // Slice 7 — the admin write path. These tests pin the create/update endpoint
    // dispatch on both halves (a bundle must go to /api/Menus, an item to
    // /api/Products) and the shared menu-definition mapping. PR2e's create route now
    // exercises the create half too; the global-ingredient reconciliation and the
    // error branches are the untested remainder.
    './src/components/admin/product/productFormUtils.ts': {
      statements: 42,
      branches: 35,
      functions: 56,
      lines: 40,
    },
    // Slice 7 PR2b — the admin catalog's type filter. `productTypeFilter` is pure and
    // fully covered; `ProductsTable`'s uncovered branches are the loading/error early
    // returns, not the per-row type logic the tests pin.
    './src/utils/productTypeFilter.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/admin/menu-management/ProductsTable.tsx': {
      statements: 82,
      branches: 69,
      functions: 99,
      lines: 99,
    },
    './src/components/design-system/AlertDialog.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/design-system/BaseModal.tsx': {
      statements: 89,
      branches: 77,
      functions: 87,
      lines: 94,
    },
    './src/components/design-system/FormField.tsx': {
      statements: 99,
      branches: 82,
      functions: 99,
      lines: 99,
    },
    './src/components/design-system/StatusBadge.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // reservationForm helpers ship at 100% (see reservationForm.test.ts); pinned
    // at 99 per the "at 100% → 99" rule above.
    './src/utils/reservationForm.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // Reservations floor-plan core (B1) — the shared canvas-geometry contract
    // (600x500, centre-anchored marker maths) at 100% → 99; the customer map's
    // marker interaction/entrance-fallback paths at 100% → 99; the docket at
    // 100% stmts (branches 85.71 → 84); the time-chip selector measured
    // 79.16/83.33/54.54/82.6 → pinned at actual − ~1pt.
    './src/lib/tableCanvasGeometry.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/reservation/VisualTableLayout.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/reservation/SelectedTableInfo.tsx': {
      statements: 99,
      branches: 84,
      functions: 99,
      lines: 99,
    },
    './src/components/reservation/DateTimeSelector.tsx': {
      statements: 78,
      branches: 82,
      functions: 53,
      lines: 81,
    },
    // Reservations revamp D2 — configurable customer form fields. The service
    // (fetch/update shapes), the admin page + tri-state hook (locked
    // immutability, whole-form save), and the FormField-migrated reservation
    // guest-details form are at 100% → 99. The two hooks' uncovered remainder
    // is console.error noise + the fresh-cache fast path / unknown-form guard,
    // pinned at actual − ~1pt.
    './src/services/formFieldConfigService.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/hooks/useCustomerFormFields.ts': {
      statements: 94,
      branches: 84,
      functions: 99,
      lines: 99,
    },
    './src/hooks/admin/useCustomerFormsAdmin.ts': {
      statements: 93,
      branches: 79,
      functions: 99,
      lines: 99,
    },
    './src/app/admin/customer-forms/page.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/reservation/CustomerDetailsForm.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
  },
};
