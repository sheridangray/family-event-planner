module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/test/**/*.test.js',
    '**/test/unit/**/*.js',
    '**/test/integration/**/*.js',
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
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.js',
    '<rootDir>/test/security-setup.js'
  ],
  maxWorkers: 2, // Prevent database conflicts in concurrent tests
  testTimeout: 60000, // 60 seconds for security and integration tests
  verbose: true,
  collectCoverage: true,
  // Increased coverage thresholds for production readiness
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Critical components require higher coverage
    './src/automation/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/database/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/api/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/services/': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  // Module path mapping (correct option name)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};