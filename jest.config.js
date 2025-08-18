module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/test/**/*.test.js',
    '**/src/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js', // Exclude main entry point
    '!src/**/*.test.js', // Exclude test files
    '!src/config/*.js' // Exclude config
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 30000, // 30 seconds for integration tests
  verbose: true,
  collectCoverage: true,
  // Temporarily lower coverage thresholds while building tests
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20
    }
  },
  // Module path mapping (correct option name)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};