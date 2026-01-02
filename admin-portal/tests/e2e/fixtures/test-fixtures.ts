/**
 * Playwright Test Fixtures for Construction Workforce Admin Portal
 * 
 * Provides reusable fixtures for:
 * - Authentication helpers
 * - Page object models
 * - Test data factories
 */

import { test as base, expect, Page } from '@playwright/test';

/**
 * Test user credentials from environment variables
 * IMPORTANT: Never hardcode credentials - use environment variables
 */
export const testUsers = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'admin123',
    role: 'admin',
  },
  supervisor: {
    email: process.env.TEST_SUPERVISOR_EMAIL || 'supervisor@example.com',
    password: process.env.TEST_SUPERVISOR_PASSWORD || 'supervisor123',
    role: 'supervisor',
  },
  worker: {
    email: process.env.TEST_WORKER_EMAIL || 'worker@example.com',
    password: process.env.TEST_WORKER_PASSWORD || 'worker123',
    role: 'worker',
  },
};

/**
 * Login helper - performs login through the UI
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  
  // Wait for the login form to be visible
  await page.waitForSelector('input[type="email"]', { state: 'visible' });
  
  // Fill in credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Click submit button
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard or error message
  await Promise.race([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.waitForSelector('[class*="error"], [class*="red"]', { timeout: 15000 }),
  ]);
}

/**
 * Check if user is on dashboard page
 */
export async function isOnDashboard(page: Page): Promise<boolean> {
  return page.url().includes('/dashboard');
}

/**
 * Logout helper
 */
export async function logout(page: Page): Promise<void> {
  // Look for logout button/link in navbar or sidebar
  const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign out"), a:has-text("Sign out")');
  
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL(/\/login/);
  }
}

/**
 * Navigate to a specific section
 */
export async function navigateTo(page: Page, section: string): Promise<void> {
  const routes: Record<string, string> = {
    dashboard: '/dashboard',
    employees: '/employees',
    attendance: '/attendance',
    projects: '/projects',
    supervisors: '/supervisors',
    workers: '/workers',
    leave: '/leave',
    clients: '/clients',
    timesheets: '/timesheets',
    reports: '/reports',
  };

  const route = routes[section.toLowerCase()];
  if (route) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 10000
): Promise<any> {
  const response = await page.waitForResponse(
    (resp) =>
      typeof urlPattern === 'string'
        ? resp.url().includes(urlPattern)
        : urlPattern.test(resp.url()),
    { timeout }
  );
  return response.json();
}

/**
 * Fill form fields helper
 */
export async function fillForm(page: Page, fields: Record<string, string>): Promise<void> {
  for (const [selector, value] of Object.entries(fields)) {
    const element = page.locator(selector);
    await element.fill(value);
  }
}

/**
 * Get table rows
 */
export async function getTableRows(page: Page, tableSelector = 'table'): Promise<number> {
  await page.waitForSelector(tableSelector, { state: 'visible' });
  const rows = page.locator(`${tableSelector} tbody tr`);
  return rows.count();
}

/**
 * Extended test fixture with custom helpers
 */
export const test = base.extend<{
  loginAs: (role: 'admin' | 'supervisor' | 'worker') => Promise<void>;
  navigateTo: (section: string) => Promise<void>;
}>({
  loginAs: async ({ page }, use) => {
    const loginAsRole = async (role: 'admin' | 'supervisor' | 'worker') => {
      const user = testUsers[role];
      await login(page, user.email, user.password);
    };
    await use(loginAsRole);
  },

  navigateTo: async ({ page }, use) => {
    const navigate = async (section: string) => {
      await navigateTo(page, section);
    };
    await use(navigate);
  },
});

export { expect };

/**
 * Test selectors for stable element selection
 * Use data-testid attributes when possible
 */
export const selectors = {
  // Auth
  loginForm: 'form',
  emailInput: 'input[type="email"], input[id="email"]',
  passwordInput: 'input[type="password"], input[id="password"]',
  submitButton: 'button[type="submit"]',
  errorMessage: '[class*="error"], [class*="red-"]',
  
  // Navigation
  sidebar: '[class*="sidebar"], aside',
  navbar: 'nav, [class*="navbar"]',
  logoutButton: 'button:has-text("Logout"), a:has-text("Logout")',
  
  // Dashboard
  statCard: '[class*="stat"], [class*="card"]',
  
  // Tables
  table: 'table',
  tableRow: 'tbody tr',
  tableHeader: 'thead th',
  pagination: '[class*="pagination"]',
  
  // Modals
  modal: '[class*="modal"], [role="dialog"]',
  modalClose: 'button:has-text("Close"), button:has-text("Cancel"), [class*="close"]',
  
  // Forms
  input: 'input',
  select: 'select',
  textarea: 'textarea',
  formError: '[class*="error"]',
  
  // Buttons
  addButton: 'button:has-text("Add"), button:has-text("Create"), button:has-text("New")',
  editButton: 'button:has-text("Edit")',
  deleteButton: 'button:has-text("Delete")',
  saveButton: 'button:has-text("Save"), button[type="submit"]',
  cancelButton: 'button:has-text("Cancel")',
  
  // Actions
  approveButton: 'button:has-text("Approve")',
  rejectButton: 'button:has-text("Reject")',
  viewButton: 'button:has-text("View")',
};

/**
 * Test data generators
 */
export const testData = {
  generateEmployee: (overrides = {}) => ({
    name: `Test Employee ${Date.now()}`,
    email: `test.employee.${Date.now()}@example.com`,
    phone: '1234567890',
    role: 'Worker',
    ...overrides,
  }),

  generateProject: (overrides = {}) => ({
    name: `Test Project ${Date.now()}`,
    location: 'Test Location',
    description: 'Test project description',
    ...overrides,
  }),

  generateLeaveRequest: (overrides = {}) => ({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    reason: 'Test leave reason',
    ...overrides,
  }),
};

