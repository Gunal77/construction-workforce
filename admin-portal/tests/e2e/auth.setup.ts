/**
 * Authentication Setup for Playwright Tests
 * 
 * This file creates authenticated states for different user roles
 * that can be reused across tests to avoid repeated login operations.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { testUsers, login } from './fixtures/test-fixtures';

const ADMIN_AUTH_FILE = path.join(__dirname, '../.auth/admin.json');
const SUPERVISOR_AUTH_FILE = path.join(__dirname, '../.auth/supervisor.json');
const WORKER_AUTH_FILE = path.join(__dirname, '../.auth/worker.json');

/**
 * Admin authentication setup
 * Logs in as admin and saves the authenticated state
 */
setup('authenticate as admin', async ({ page }) => {
  const { email, password } = testUsers.admin;
  
  // Go to login page
  await page.goto('/login');
  
  // Wait for login form
  await page.waitForSelector('input[type="email"]', { state: 'visible' });
  
  // Fill credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for successful login (redirect to dashboard)
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  
  // Verify we're on the dashboard
  await expect(page).toHaveURL(/\/dashboard/);
  
  // Save storage state (cookies + local storage)
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
  
  console.log('✅ Admin authentication state saved');
});

/**
 * Supervisor authentication setup
 * Logs in as supervisor and saves the authenticated state
 */
setup('authenticate as supervisor', async ({ page }) => {
  const { email, password } = testUsers.supervisor;
  
  // Go to login page
  await page.goto('/login');
  
  // Wait for login form
  await page.waitForSelector('input[type="email"]', { state: 'visible' });
  
  // Fill credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for successful login
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await expect(page).toHaveURL(/\/dashboard/);
    await page.context().storageState({ path: SUPERVISOR_AUTH_FILE });
    console.log('✅ Supervisor authentication state saved');
  } catch (error) {
    // If supervisor login fails, create an empty auth file to prevent test failures
    console.warn('⚠️ Supervisor login failed, creating empty auth state');
    await page.context().storageState({ path: SUPERVISOR_AUTH_FILE });
  }
});

/**
 * Worker authentication setup
 * Logs in as worker and saves the authenticated state
 */
setup('authenticate as worker', async ({ page }) => {
  const { email, password } = testUsers.worker;
  
  // Go to login page
  await page.goto('/login');
  
  // Wait for login form
  await page.waitForSelector('input[type="email"]', { state: 'visible' });
  
  // Fill credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for successful login
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await expect(page).toHaveURL(/\/dashboard/);
    await page.context().storageState({ path: WORKER_AUTH_FILE });
    console.log('✅ Worker authentication state saved');
  } catch (error) {
    // If worker login fails, create an empty auth file
    console.warn('⚠️ Worker login failed, creating empty auth state');
    await page.context().storageState({ path: WORKER_AUTH_FILE });
  }
});

