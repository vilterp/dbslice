module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server', '<rootDir>/client'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'server/**/*.ts',
    'client/**/*.ts',
    '!server/**/*.d.ts',
    '!server/dist/**',
    '!client/build/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Jest 28 cannot resolve the `node:` prefix for experimental builtins like
  // node:sqlite. Map it to a shim that uses eval to bypass the module resolver.
  moduleNameMapper: {
    '^node:sqlite$': '<rootDir>/__mocks__/node_sqlite.js',
  },
  extensionsToTreatAsEsm: [],
  globals: {
    'ts-jest': {
      useESM: false,
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }
  }
};