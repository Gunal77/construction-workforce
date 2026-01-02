/**
 * Jest Configuration for Construction Workforce Admin Portal
 * 
 * Features:
 * - jsdom environment for React component testing
 * - TypeScript support via Next.js
 * - Module path aliases matching tsconfig
 * - Coverage reporting
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Custom Jest configuration
const customJestConfig = {
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Test environment
  testEnvironment: 'jest-environment-jsdom',

  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
  },

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/tests/unit/**/*.test.tsx',
  ],

  // Files to collect coverage from
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],

  // Coverage thresholds
  // Note: Global thresholds are set low initially. Increase as coverage improves.
  // Target: 50% for production readiness
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
    // Enforce 80%+ coverage on tested components
    './components/Input.tsx': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './components/Modal.tsx': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './components/Table.tsx': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Coverage directory
  coverageDirectory: 'coverage',

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks automatically
  restoreMocks: true,
};

// Export configuration
module.exports = createJestConfig(customJestConfig);
