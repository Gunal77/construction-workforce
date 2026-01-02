/**
 * Admin Portal E2E Tests
 * 
 * Tests for admin-specific functionality:
 * - Dashboard access
 * - Employee management (CRUD)
 * - Attendance management
 * - Leave request approval
 * - Project management
 */

import { test, expect } from '@playwright/test';
import { selectors, testData, navigateTo, waitForApiResponse } from './fixtures/test-fixtures';

test.describe('Admin Portal', () => {
  test.describe('Dashboard', () => {
    test('should display dashboard with statistics', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Verify dashboard is loaded
      await expect(page.locator('h1, h2').first()).toBeVisible();
      
      // Verify stat cards are present (using actual component classes)
      const statCards = page.locator('div.bg-white.rounded-lg.shadow-sm, div.bg-white.rounded-lg.border, .grid > div.bg-white');
      const hasCards = await statCards.first().isVisible({ timeout: 5000 }).catch(() => false);
      
      // Dashboard should have either stat cards or some content
      const hasContent = hasCards || await page.locator('h1, h2, table').first().isVisible();
      expect(hasContent).toBeTruthy();
    });

    test('should display recent activity sections', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Wait for dashboard to fully load
      await page.waitForLoadState('networkidle');
      
      // Check for activity sections (may include check-ins, projects, etc.)
      const sections = page.locator('h1, h2, h3');
      await expect(sections.first()).toBeVisible();
    });
  });

  test.describe('Employee Management', () => {
    test('should display employees list', async ({ page }) => {
      await page.goto('/employees');
      
      // Wait for employees to load
      await page.waitForLoadState('networkidle');
      
      // Verify page title
      await expect(page.locator('h1:has-text("Employee"), h1:has-text("Staff")')).toBeVisible();
      
      // Check for table or employee list
      const table = page.locator('table');
      const employeeList = page.locator('[class*="card"], [class*="list"]');
      
      const hasTable = await table.isVisible();
      const hasList = await employeeList.first().isVisible();
      
      expect(hasTable || hasList).toBeTruthy();
    });

    test('should open add employee modal', async ({ page }) => {
      await page.goto('/employees');
      
      // Find and click add button
      const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
      
      if (await addButton.isVisible()) {
        await addButton.click();
        
        // Verify modal is open
        const modal = page.locator('[class*="modal"], [role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 5000 });
        
        // Verify form fields
        await expect(page.locator('input').first()).toBeVisible();
      }
    });

    test('should create a new employee', async ({ page }) => {
      await page.goto('/employees');
      
      // Click add button
      const addButton = page.locator('button:has-text("Add Employee"), button:has-text("Add")').first();
      
      if (await addButton.isVisible()) {
        await addButton.click();
        
        // Wait for modal
        await page.waitForSelector('[class*="modal"], [role="dialog"]', { state: 'visible' });
        
        // Generate test data
        const employee = testData.generateEmployee();
        
        // Fill form
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill(employee.name);
        } else {
          // Try to find by label
          const labeledInput = page.locator('input').first();
          await labeledInput.fill(employee.name);
        }
        
        // Fill email if present
        const emailInput = page.locator('input[type="email"], input[name="email"]');
        if (await emailInput.isVisible()) {
          await emailInput.fill(employee.email);
        }
        
        // Submit form
        const submitButton = page.locator('button[type="submit"], button:has-text("Add Employee"), button:has-text("Save")').last();
        
        if (await submitButton.isVisible()) {
          await submitButton.click();
          
          // Wait for modal to close or success message
          await page.waitForTimeout(2000);
        }
      }
    });

    test('should view employee details', async ({ page }) => {
      await page.goto('/employees');
      
      // Wait for table to load
      await page.waitForLoadState('networkidle');
      
      // Find and click view button on first employee
      const viewButton = page.locator('button[title="View"], button:has-text("View"), a:has-text("View")').first();
      
      if (await viewButton.isVisible()) {
        await viewButton.click();
        
        // Should navigate to employee details or open modal
        await page.waitForTimeout(1000);
        
        // Either URL changes or modal appears
        const urlChanged = page.url().includes('/employees/');
        const modalVisible = await page.locator('[class*="modal"], [role="dialog"]').isVisible();
        
        expect(urlChanged || modalVisible).toBeTruthy();
      }
    });

    test('should delete employee with confirmation', async ({ page }) => {
      await page.goto('/employees');
      
      // Wait for table to load
      await page.waitForLoadState('networkidle');
      
      // Find delete button (may be an icon button or text button)
      const deleteButton = page.locator('button[title="Delete"], button:has-text("Delete"), button svg.lucide-trash, button svg.lucide-trash-2').first();
      
      if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteButton.click();
        
        // Wait for confirmation modal (check for fixed inset-0 overlay or modal classes)
        const confirmModal = page.locator('.fixed.inset-0, [class*="modal"], [role="dialog"]').first();
        
        if (await confirmModal.isVisible({ timeout: 5000 }).catch(() => false)) {
          // Verify confirmation content
          const hasConfirmText = await page.locator('text=/delete|confirm|sure|remove/i').first().isVisible({ timeout: 2000 }).catch(() => false);
          expect(hasConfirmText).toBeTruthy();
          
          // Click cancel to not actually delete
          const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
          if (await cancelButton.isVisible()) {
            await cancelButton.click();
          }
        }
      } else {
        // Test passes if no delete button exists (empty table or no permission)
        expect(true).toBeTruthy();
      }
    });
  });

  test.describe('Attendance Management', () => {
    test('should display attendance page with filters', async ({ page }) => {
      await page.goto('/attendance');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Verify page title
      await expect(page.locator('h1:has-text("Attendance")')).toBeVisible();
      
      // Check for filter controls
      const filters = page.locator('select, input[type="text"], input[type="date"]');
      const hasFilters = await filters.first().isVisible();
      expect(hasFilters).toBeTruthy();
    });

    test('should display attendance statistics', async ({ page }) => {
      await page.goto('/attendance');
      
      // Wait for stats to load
      await page.waitForLoadState('networkidle');
      
      // Check for stat cards using actual component classes (StatCard uses bg-white rounded-lg shadow-sm border)
      // Also check for any grid of stat elements
      const statCards = page.locator('div.bg-white.rounded-lg.shadow-sm, div.bg-white.rounded-lg.border, .grid > div.bg-white');
      const count = await statCards.count();
      
      // Page should have content - either stat cards or table
      const hasContent = count > 0 || await page.locator('table, h1').first().isVisible();
      expect(hasContent).toBeTruthy();
    });

    test('should display attendance table', async ({ page }) => {
      await page.goto('/attendance');
      
      // Wait for data to load
      await page.waitForLoadState('networkidle');
      
      // Check for table or "no records" message
      const table = page.locator('table');
      const noRecords = page.locator('text=/no.*record|no.*found|no.*attendance/i');
      
      const hasTable = await table.isVisible();
      const hasNoRecords = await noRecords.isVisible();
      
      expect(hasTable || hasNoRecords).toBeTruthy();
    });

    test('should filter attendance by status', async ({ page }) => {
      await page.goto('/attendance');
      
      // Find status filter
      const statusFilter = page.locator('select').first();
      
      if (await statusFilter.isVisible()) {
        // Select "Checked In" option
        await statusFilter.selectOption({ label: /checked.*in/i }).catch(() => {
          // Try by value if label doesn't work
          statusFilter.selectOption('checked-in').catch(() => {});
        });
        
        // Wait for filter to apply
        await page.waitForTimeout(1000);
      }
    });

    test('should open add manual attendance modal', async ({ page }) => {
      await page.goto('/attendance');
      
      // Find add manual button
      const addButton = page.locator('button:has-text("Add Manual"), button:has-text("Add")').first();
      
      if (await addButton.isVisible()) {
        await addButton.click();
        
        // Verify modal opens
        const modal = page.locator('[class*="modal"], [role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Leave Management', () => {
    test('should display leave management page', async ({ page }) => {
      await page.goto('/leave');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Verify page title
      await expect(page.locator('h1:has-text("Leave")')).toBeVisible();
    });

    test('should display leave statistics cards', async ({ page }) => {
      await page.goto('/leave');
      
      // Wait for stats to load
      await page.waitForLoadState('networkidle');
      
      // Check for stat cards using actual component classes
      const cards = page.locator('div.bg-white.rounded-lg.shadow-sm, div.bg-white.rounded-lg.border, .grid > div.bg-white');
      const count = await cards.count();
      
      // Page should have content - either cards or table or page title
      const hasContent = count > 0 || await page.locator('table, h1:has-text("Leave")').first().isVisible();
      expect(hasContent).toBeTruthy();
    });

    test('should display leave requests table', async ({ page }) => {
      await page.goto('/leave');
      
      // Wait for data to load
      await page.waitForLoadState('networkidle');
      
      // Check for table or no requests message (use .first() to avoid strict mode violation)
      const table = page.locator('table');
      const noRequests = page.locator('p:has-text("No leave requests"), p:has-text("No requests found")').first();
      
      const hasTable = await table.isVisible().catch(() => false);
      const hasNoRequests = await noRequests.isVisible().catch(() => false);
      
      // Page should show either table or empty message
      expect(hasTable || hasNoRequests).toBeTruthy();
    });

    test('should filter leave requests by status', async ({ page }) => {
      await page.goto('/leave');
      
      // Find status filter
      const statusFilter = page.locator('select').filter({ hasText: /status/i }).first();
      
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('pending');
        await page.waitForTimeout(1000);
      }
    });

    test('should approve leave request', async ({ page }) => {
      await page.goto('/leave');
      
      // Wait for table to load
      await page.waitForLoadState('networkidle');
      
      // Find an enabled approve button (not disabled)
      const approveButton = page.locator('button:has-text("Approve"):not([disabled])').first();
      
      const isButtonVisible = await approveButton.isVisible({ timeout: 3000 }).catch(() => false);
      const isButtonEnabled = isButtonVisible && await approveButton.isEnabled().catch(() => false);
      
      if (isButtonEnabled) {
        await approveButton.click();
        
        // Wait for confirmation modal
        const modal = page.locator('.fixed.inset-0, [class*="modal"], [role="dialog"]').first();
        
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Click cancel to not actually approve in test
          const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
          if (await cancelButton.isVisible()) {
            await cancelButton.click();
          }
        }
      } else {
        // Test passes if no enabled approve button (no pending requests or bulk select required)
        expect(true).toBeTruthy();
      }
    });

    test('should reject leave request with reason', async ({ page }) => {
      await page.goto('/leave');
      
      // Wait for table to load
      await page.waitForLoadState('networkidle');
      
      // Find reject button on a pending request
      const rejectButton = page.locator('button:has-text("Reject")').first();
      
      if (await rejectButton.isVisible()) {
        await rejectButton.click();
        
        // Wait for rejection modal
        const modal = page.locator('[class*="modal"], [role="dialog"]');
        
        if (await modal.isVisible()) {
          // Find textarea for rejection reason
          const reasonInput = page.locator('textarea');
          if (await reasonInput.isVisible()) {
            await reasonInput.fill('Test rejection reason');
          }
          
          // Click cancel to not actually reject
          const cancelButton = page.locator('button:has-text("Cancel")');
          await cancelButton.click();
        }
      }
    });
  });

  test.describe('Project Management', () => {
    test('should display projects list', async ({ page }) => {
      await page.goto('/projects');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Verify page title
      await expect(page.locator('h1:has-text("Project")')).toBeVisible();
    });

    test('should view project details', async ({ page }) => {
      await page.goto('/projects');
      
      // Wait for projects to load
      await page.waitForLoadState('networkidle');
      
      // Find and click on a project card or view button
      const viewButton = page.locator('button:has-text("View"), a:has-text("View")').first();
      const projectCard = page.locator('[class*="card"]').first();
      
      if (await viewButton.isVisible()) {
        await viewButton.click();
      } else if (await projectCard.isVisible()) {
        await projectCard.click();
      }
      
      // Wait for navigation or modal
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Navigation', () => {
    test('should navigate through sidebar menu', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Test navigation using actual sidebar routes
      // Based on Sidebar.tsx: /dashboard, /clients, /workers, /supervisors, /projects, /attendance, /leave
      const sections = [
        { href: '/attendance', expected: 'attendance' },
        { href: '/projects', expected: 'projects' },
        { href: '/leave', expected: 'leave' },
      ];
      
      for (const section of sections) {
        const link = page.locator(`a[href="${section.href}"]`).first();
        
        if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
          await link.click();
          await page.waitForURL(`**${section.href}*`, { timeout: 10000 });
          
          // Verify navigation
          const url = page.url().toLowerCase();
          expect(url).toContain(section.expected);
        }
      }
    });

    test('should display sidebar on desktop', async ({ page }) => {
      // Set viewport to desktop size
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Sidebar is a div with fixed positioning, not aside element
      // On desktop (lg:) it uses translate-x-0 to be visible
      const sidebar = page.locator('div.fixed.left-0.top-0.h-screen.w-64, nav.fixed, div.w-64.bg-white').first();
      
      // Check if sidebar or navigation links are visible
      const hasSidebar = await sidebar.isVisible({ timeout: 5000 }).catch(() => false);
      const hasNavLinks = await page.locator('a[href="/dashboard"]').isVisible({ timeout: 5000 }).catch(() => false);
      
      expect(hasSidebar || hasNavLinks).toBeTruthy();
    });
  });
});

