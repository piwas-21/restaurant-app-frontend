
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
    '!src/**/*.test.tsx',
    '!src/**/*.spec.tsx',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  // Coverage gate — pinned at the current honest floor (baseline measured
  // 2026-05: stmts 0.38 / branch 0.32 / funcs 0.43 / lines 0.32).
  // Mirrors the backend coverlet pattern (see workspace CLAUDE.md §7):
  // floor pinned slightly below current actual so a no-op refactor doesn't
  // redline the gate, then RATCHET UP as test coverage grows.
  //
  // To ratchet: after a meaningful test-coverage MR lands and
  // `npm test -- --coverage` reports a higher % across the board, raise
  // these values in a chore: MR and link the run that proves the new floor.
  coverageThreshold: {
    global: {
      // Current actuals: 0.32 / 0.43 / 0.32 / 0.38.
      // Pinned just below current so unrelated refactors don't redline,
      // but any real regression (a deleted test, a new untested branch
      // that pushes the % down) still fails the build. Raise these as
      // coverage improves.
      branches: 0.3,
      functions: 0.4,
      lines: 0.3,
      statements: 0.3,
    },
  },
};
