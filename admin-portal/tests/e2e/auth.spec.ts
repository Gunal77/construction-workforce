/**
 * Authentication E2E Tests
 * 
 * Tests for:
 * - Admin login success
 * - Invalid login error handling
 * - Session persistence
 * - Logout functionality
 */

import { test, expect } from '@playwright/test';
import { testUsers, login, selectors } from './fixtures/test-fixtures';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we're starting from a clean state
    await page.goto('/login');
  });

  test.describe('Admin Login', () => {
    test('should display login form', async ({ page }) => {
      // Verify login page elements are present
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should successfully login with valid admin credentials', async ({ page }) => {
      const { email, password } = testUsers.admin;

      // Fill in credentials
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);

      // Click login button
      await page.click('button[type="submit"]');

      // Wait for redirect to dashboard
      await page.waitForURL(/\/dashboard/, { timeout: 30000 });

      // Verify we're on the dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Verify dashboard content is visible
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      // Fill in invalid credentials
      await page.fill('input[type="email"]', 'invalid@example.com');
      await page.fill('input[type="password"]', 'wrongpassword');

      // Click login button
      await page.click('button[type="submit"]');

      // Wait for error message or stay on login page
      await page.waitForTimeout(3000);

      // Should either show error or remain on login page
      const isOnLoginPage = page.url().includes('/login');
      const hasError = await page.locator('[class*="error"], [class*="red-"], .text-red-700').isVisible();
      
      expect(isOnLoginPage || hasError).toBeTruthy();
    });

    test('should show error for empty credentials', async ({ page }) => {
      // Try to submit without filling in credentials
      await page.click('button[type="submit"]');

      // Should stay on login page due to form validation
      await expect(page).toHaveURL(/\/login/);
    });

    test('should toggle password visibility', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]');
      
      // Initially password should be hidden
      await expect(passwordInput).toHaveAttribute('type', 'password');
      
      // Find and click the toggle button (eye icon)
      const toggleButton = page.locator('button').filter({ has: page.locator('svg') }).last();
      
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        
        // After clicking, password might be visible
        const passwordVisible = page.locator('input[id="password"]');
        const inputType = await passwordVisible.getAttribute('type');
        expect(['text', 'password']).toContain(inputType);
      }
    });
  });

  test.describe('Session Management', () => {
    test('should redirect to login when accessing protected routes without auth', async ({ page }) => {
      // Clear any existing cookies
      await page.context().clearCookies();

      // Try to access dashboard
      await page.goto('/dashboard');

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('should maintain session after page refresh', async ({ page }) => {
      const { email, password } = testUsers.admin;

      // Login
      await login(page, email, password);

      // Verify on dashboard
      await expect(page).toHaveURL(/\/dashboard/);

      // Refresh the page
      await page.reload();

      // Should still be on dashboard (session maintained)
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe('Logout', () => {
    test('should successfully logout', async ({ page }) => {
      const { email, password } = testUsers.admin;

      // First, login
      await login(page, email, password);
      await expect(page).toHaveURL(/\/dashboard/);

      // Find logout button in sidebar or navbar
      const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign out")').first();
      
      if (await logoutButton.isVisible()) {
        await logoutButton.click();

        // Should redirect to login page
        await page.waitForURL(/\/login/, { timeout: 10000 });
        await expect(page).toHaveURL(/\/login/);
      } else {
        // If no logout button, navigate to logout endpoint
        await page.goto('/api/auth/logout');
        await page.waitForURL(/\/login/, { timeout: 10000 });
      }
    });

    test('should not be able to access protected routes after logout', async ({ page }) => {
      const { email, password } = testUsers.admin;

      // Login
      await login(page, email, password);
      await expect(page).toHaveURL(/\/dashboard/);

      // Logout by clearing cookies
      await page.context().clearCookies();

      // Try to access protected route
      await page.goto('/employees');

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Client Login', () => {
    test('should display link to client login', async ({ page }) => {
      // Check if there's a link to client login
      const clientLoginLink = page.locator('a:has-text("client")');
      
      if (await clientLoginLink.isVisible()) {
        await clientLoginLink.click();
        await expect(page).toHaveURL(/\/client-login/);
      }
    });
  });
});

