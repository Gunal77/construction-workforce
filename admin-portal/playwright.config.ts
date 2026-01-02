import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright Configuration for Construction Workforce Admin Portal
 * 
 * Features:
 * - Headless browser testing with Chromium
 * - Screenshot and video recording on failure
 * - CI-ready configuration
 * - Auth state persistence for authenticated tests
 */

// Load environment variables
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Test timeout - increased for auth flows
  timeout: 60 * 1000,

  // Expect timeout
  expect: {
    timeout: 10 * 1000,
  },

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI (for stability)
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],

  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL,

    // Collect trace on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording on failure
    video: 'on-first-retry',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors (useful for local dev)
    ignoreHTTPSErrors: true,

    // Action timeout
    actionTimeout: 15 * 1000,

    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },

  // Configure projects for different roles
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Admin tests with authenticated state
    {
      name: 'admin',
      testMatch: /admin\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'tests', '.auth', 'admin.json'),
      },
    },

    // Supervisor tests with authenticated state
    {
      name: 'supervisor',
      testMatch: /supervisor\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'tests', '.auth', 'supervisor.json'),
      },
    },

    // Worker tests with authenticated state
    {
      name: 'worker',
      testMatch: /worker\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'tests', '.auth', 'worker.json'),
      },
    },

    // Auth tests (no dependency, no pre-authenticated state)
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // Chromium only tests (default)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [
        /admin\.spec\.ts/,
        /supervisor\.spec\.ts/,
        /worker\.spec\.ts/,
        /auth\.spec\.ts/,
      ],
    },
  ],

  // Output folder for test artifacts
  outputDir: 'test-results',

  // Run local dev server before starting tests (if not already running)
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

