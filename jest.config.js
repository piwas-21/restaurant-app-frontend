
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
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
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    'next/router': '<rootDir>/__mocks__/nextRouterMock.js',
  },
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\.module\.(css|sass|scss)$',
  ],
  collectCoverage: false,
  collectCoverageFrom: [
    'src/components/**/*.tsx',
    'src/app/**/*.tsx',
    'src/utils/reservationForm.ts',
    'src/utils/productCustomization.ts',
    '!src/**/*.test.tsx',
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
    // productCustomization helpers ship at 100% (see productCustomization.test.ts);
    // pinned at 99 per the "100 → 99" rule above.
    './src/utils/productCustomization.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
  },
};
