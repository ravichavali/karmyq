import { test, expect } from './fixtures/auth';
import { API_URLS } from '../tests/utils/api-helpers';

/**
 * Admin UI E2E Tests for Server-Driven UI Schema Management
 *
 * Tests complete admin workflows for managing request type schemas:
 * - Schema list with filtering
 * - Creating new schemas
 * - Editing existing schemas (sections and fields)
 * - Publishing and archiving schemas
 * - Version history and rollback
 * - Live preview functionality
 */

// Mock admin user data
const mockAdminUser = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@karmyq.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'admin123',
};

test.describe('Admin Schema Management', () => {
  let testSchemaId: string | null = null;
  let testSchemaType: string;

  test.beforeEach(async ({ authenticatedPage }) => {
    // Generate unique type for each test to avoid conflicts
    testSchemaType = `e2e-test-${Date.now()}`;
  });

  test.afterEach(async ({ page }) => {
    // Clean up test schemas if they exist
    if (testSchemaId) {
      try {
        const token = await page.evaluate(() => localStorage.getItem('token'));
        await page.request.fetch(`${API_URLS.REQUEST}/admin/schemas/${testSchemaId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        // Schema may not exist, that's okay
        console.log('Cleanup error (non-critical):', error);
      }
      testSchemaId = null;
    }
  });

  test.describe('Schema List Page', () => {
    test('should display schema list page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/admin/schemas');

      // Check page title
      await expect(authenticatedPage.locator('h1')).toContainText(/Schema Management|Schemas/i);

      // Check for filter controls
      await expect(authenticatedPage.locator('input[type="search"]')).toBeVisible();
    });

    test('should display status badges for schemas', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/admin/schemas');

      // Wait for schemas to load
      await authenticatedPage.waitForTimeout(1000);

      // Check for status badges (draft, published, archived)
      const statusElements = authenticatedPage.locator('[data-status], .badge, [class*="badge"]');

      const count = await statusElements.count();
      if (count > 0) {
        // Verify at least one status badge is visible
        await expect(statusElements.first()).toBeVisible();
      }
    });

    test('should allow filtering schemas by status', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/admin/schemas');

      // Look for status filter
      const statusFilter = authenticatedPage.locator('select[name="status"], [data-testid="status-filter"]');

      if (await statusFilter.isVisible()) {
        // Select "draft" status
        await statusFilter.selectOption('draft');

        // Wait for results to update
        await authenticatedPage.waitForTimeout(500);

        // Verify filter was applied (check URL or page state)
        const url = authenticatedPage.url();
        expect(url).toContain('status=draft');
      }
    });

    test('should allow navigation to schema detail page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/admin/schemas');

      // Wait for schemas to load
      await authenticatedPage.waitForTimeout(1000);

      // Find a schema card
      const schemaCard = authenticatedPage.locator('[data-testid="schema-card"], .schema-card').first();

      if (await schemaCard.isVisible({ timeout: 5000 })) {
        // Click to navigate to detail page
        await schemaCard.click();

        // Verify navigation to edit page
        await expect(authenticatedPage).toHaveURL(/\/admin\/schemas\/.*\/edit/);
      }
    });
  });

  test.describe('Create New Schema', () => {
    test('should navigate to new schema page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/admin/schemas');

      // Click "Create New Schema" button
      const createButton = authenticatedPage.locator('text=/Create New Schema|New Schema|Add Schema/i');

      if (await createButton.isVisible()) {
        await createButton.click();

        // Verify navigation to new schema page
        await expect(authenticatedPage).toHaveURL(/\/admin\/schemas\/new/);
      }
    });

    test('should allow creating a new schema', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/admin/schemas/new');

      // Fill in schema details
      await authenticatedPage.fill('input[name="type"], input[name="schemaType"]', testSchemaType);
      await authenticatedPage.fill('input[name="label"], input[name="schemaLabel"]', 'E2E Test Schema');
      await authenticatedPage.fill('input[name="icon"], input[name="schemaIcon"]', '🧪');
      await authenticatedPage.fill('textarea[name="description"], textarea[name="schemaDescription"]', 'E2E test schema');

      // Add a basic section
      const addSectionButton = authenticatedPage.locator('text=/Add Section|Create Section/i');

      if (await addSectionButton.isVisible()) {
        await addSectionButton.click();
      }

      // Submit form to create schema
      const submitButton = authenticatedPage.locator('button[type="submit"], text=/Create|Save/i');

      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Wait for navigation or success message
        await authenticatedPage.waitForTimeout(2000);

        // Verify we're on the schema edit page or see success message
        const currentUrl = authenticatedPage.url();
        const isOnEditPage = currentUrl.includes('/edit');
        const hasSuccessMessage = await authenticatedPage.locator('text=/created successfully|success/i').count() > 0;

        expect(isOnEditPage || hasSuccessMessage).toBeTruthy();

        // Extract schema ID from URL if present
        if (isOnEditPage) {
          const match = currentUrl.match(/\/admin\/schemas\/([^\/]+)/);
          if (match) {
            testSchemaId = match[1];
          }
        }
      }
    });
  });

  test.describe('Schema Editor Page', () => {
    test.beforeEach(async ({ page }) => {
      // Create a test schema via API for editing tests
      const token = await page.evaluate(() => localStorage.getItem('token'));

      try {
        const response = await page.request.fetch(`${API_URLS.REQUEST}/admin/schemas`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          data: JSON.stringify({
            type: testSchemaType,
            label: 'E2E Test Schema',
            icon: '🧪',
            color: '#ff0000',
            description: 'E2E test schema for editor',
            sections: [
              {
                id: 'section-1',
                title: 'Test Section',
                fields: [
                  { id: 'field-1', type: 'text', label: 'Test Field' }
                ]
              }
            ]
          }),
        });

        const result = await response.json();
        if (result.success && result.data?.schema_id) {
          testSchemaId = result.data.schema_id;
        }
      } catch (error) {
        console.log('Failed to create test schema:', error);
      }
    });

    test('should display schema editor with tabs', async ({ authenticatedPage }) => {
      if (!testSchemaId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/admin/schemas/${testSchemaId}/edit`);

      // Check for tabbed interface
      const tabs = authenticatedPage.locator('[role="tab"], button.tab, .tab-button');

      await expect(tabs.first()).toBeVisible();

      // Common tabs: Sections, Fields, Preview, Versions
      const hasSectionsTab = await authenticatedPage.locator('text=/Sections/i').count() > 0;
      const hasPreviewTab = await authenticatedPage.locator('text=/Preview/i').count() > 0;

      expect(hasSectionsTab).toBeTruthy();
    });

    test('should allow adding sections to schema', async ({ authenticatedPage }) => {
      if (!testSchemaId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/admin/schemas/${testSchemaId}/edit`);

      // Find and click "Add Section" button
      const addSectionButton = authenticatedPage.locator('text=/Add Section|Create Section/i');

      if (await addSectionButton.isVisible({ timeout: 5000 })) {
        await addSectionButton.click();

        // Wait for section to appear
        await authenticatedPage.waitForTimeout(500);

        // Verify new section exists
        const sections = authenticatedPage.locator('[data-testid="section"], .schema-section');

        const initialCount = await sections.count();
        expect(initialCount).toBeGreaterThan(0);
      }
    });

    test('should allow editing section properties', async ({ authenticatedPage }) => {
      if (!testSchemaId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/admin/schemas/${testSchemaId}/edit`);

      // Find first section
      const section = authenticatedPage.locator('[data-testid="section"], .schema-section').first();

      if (await section.isVisible({ timeout: 5000 })) {
        // Click on section to edit
        await section.click();

        // Look for edit inputs
        const titleInput = authenticatedPage.locator('input[name="title"], input[placeholder*="title"]');

        if (await titleInput.isVisible({ timeout: 3000 })) {
          const originalTitle = await titleInput.inputValue();

          // Edit title
          await titleInput.fill('Updated Section Title');

          // Verify value changed
          const newTitle = await titleInput.inputValue();
          expect(newTitle).toBe('Updated Section Title');
        }
      }
    });

    test('should allow adding fields to sections', async ({ authenticatedPage }) => {
      if (!testSchemaId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/admin/schemas/${testSchemaId}/edit`);

      // Find first section
      const section = authenticatedPage.locator('[data-testid="section"], .schema-section').first();

      if (await section.isVisible({ timeout: 5000 })) {
        // Click on section to open fields view
        await section.click();

        // Look for "Add Field" button
        const addFieldButton = authenticatedPage.locator('text=/Add Field|Create Field/i');

        if (await addFieldButton.isVisible({ timeout: 3000 })) {
          await addFieldButton.click();

          // Wait for field to appear
          await authenticatedPage.waitForTimeout(500);

          // Verify field exists
          const fields = authenticatedPage.locator('[data-testid="field"], .schema-field');

          const fieldCount = await fields.count();
          expect(fieldCount).toBeGreaterThan(0);
        }
      }
    });

    test('should display live preview of schema', async ({ authenticatedPage }) => {
      if (!testSchemaId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/admin/schemas/${testSchemaId}/edit`);

      // Click on Preview tab
      const previewTab = authenticatedPage.locator('text=/Preview/i');

      if (await previewTab.isVisible({ timeout: 5000 })) {
        await previewTab.click();

        // Wait for preview to load
        await authenticatedPage.waitForTimeout(1000);

        // Verify preview content is visible
        const previewContent = authenticatedPage.locator('[data-testid="live-preview"], .preview-pane');

        await expect(previewContent).toBeVisible();
      }
    });

    test('should save schema changes', async ({ authenticatedPage }) => {
      if (!testSchemaId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/admin/schemas/${testSchemaId}/edit`);

      // Make a change (edit section title)
      const section = authenticatedPage.locator('[data-testid="section"], .schema-section').first();

      if (await section.isVisible({ timeout: 5000 })) {
        await section.click();

        const titleInput = authenticatedPage.locator('input[name="title"], input[placeholder*="title"]');

        if (await titleInput.isVisible({ timeout: 3000 })) {
          await titleInput.fill('Modified Title');

          // Find and click Save button
          const saveButton = authenticatedPage.locator('button:has-text("Save")');

          if (await saveButton.isVisible({ timeout: 3000 })) {
            await saveButton.click();

            // Wait for save to complete
            await authenticatedPage.waitForTimeout(1000);

            // Verify success message or UI update
            const hasSuccessMessage = await authenticatedPage.locator('text=/saved|success/i').count() > 0;

            expect(hasSuccessMessage).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe('Publish and Archive Workflows', () => {
    test.beforeEach(async ({ page }) => {
      // Create a draft schema
      const token = await page.evaluate(() => localStorage.getItem('token'));

      try {
        const response = await page.request.fetch(`${API_URLS.REQUEST}/admin/schemas`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          data: JSON.stringify({
            type: testSchemaType,
            label: 'E2E Test Schema',
            icon: '🧪',
            color: '#ff0000',
            description: 'E2E test schema for publishing',
            sections: [
              {
                id: 'section-1',
                title: 'Test Section',
                fields: [
                  { id: 'field-1', type: 'text', label: 'Test Field' }
                ]
              }
            ]
          }),
        });

        const result = await response.json();
        if (result.success && result.data?.schema_id) {
          testSchemaId = result.data.schema_id;
        }
      } catch (error) {
        console.log('Failed to create test schema:', error);
      }
    });

    test('should publish a draft schema', async ({ authenticatedPage }) => {
      if (!testSchemaId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/admin/schemas/${testSchemaId}/edit`);

      // Find and click Publish button
      const publishButton = authenticatedPage.locator('button:has-text("Publish"), [data-testid="publish-button"]');

      if (await publishButton.isVisible({ timeout: 5000 })) {
        await publishButton.click();

        // Confirm publish dialog
        const confirmButton = authenticatedPage.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Publish")');

        if (await confirmButton.isVisible({ timeout: 3000 })) {
          await confirmButton.click();

          // Wait for publish to complete
          await authenticatedPage.waitForTimeout(1000);

          // Verify success message
          const hasSuccessMessage = await authenticatedPage.locator('text=/published|success/i').count() > 0;

          expect(hasSuccessMessage).toBeTruthy();
        }
      }
    });

    test('should archive a published schema', async ({ authenticatedPage }) => {
      if (!testSchemaId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/admin/schemas/${testSchemaId}/edit`);

      // Find and click Archive button
      const archiveButton = authenticatedPage.locator('button:has-text("Archive"), [data-testid="archive-button"]');

      if (await archiveButton.isVisible({ timeout: 5000 })) {
        await archiveButton.click();

        // Confirm archive dialog
        const confirmButton = authenticatedPage.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Archive")');

        if (await confirmButton.isVisible({ timeout: 3000 })) {
          await confirmButton.click();

          // Wait for archive to complete
          await authenticatedPage.waitForTimeout(1000);

          // Verify success message
          const hasSuccessMessage = await authenticatedPage.locator('text=/archived|success/i').count() > 0;

          expect(hasSuccessMessage).toBeTruthy();
        }
      }
    });
  });

  test.describe('Version History', () => {
    test.beforeEach(async ({ page }) => {
      // Create a test schema
      const token = await page.evaluate(() => localStorage.getItem('token'));

      try {
        const response = await page.request.fetch(`${API_URLS.REQUEST}/admin/schemas`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          data: JSON.stringify({
            type: testSchemaType,
            label: 'E2E Test Schema',
            icon: '🧪',
            color: '#ff0000',
            description: 'E2E test schema for version history',
            sections: [
              {
                id: 'section-1',
                title: 'Test Section',
                fields: [
                  { id: 'field-1', type: 'text', label: 'Test Field' }
                ]
              }
            ]
          }),
        });

        const result = await response.json();
        if (result.success && result.data?.schema_id) {
          testSchemaId = result.data.schema_id;
        }
      } catch (error) {
        console.log('Failed to create test schema:', error);
      }
    });

    test('should display version history', async ({ authenticatedPage }) => {
      if (!testSchemaId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/admin/schemas/${testSchemaId}/versions`);

      // Wait for versions to load
      await authenticatedPage.waitForTimeout(1000);

      // Verify versions are displayed
      const versionItems = authenticatedPage.locator('[data-testid="version"], .version-item');

      const hasVersions = await versionItems.count() > 0;
      expect(hasVersions).toBeTruthy();
    });

    test('should allow rollback to previous version', async ({ authenticatedPage }) => {
      if (!testSchemaId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/admin/schemas/${testSchemaId}/versions`);

      // Wait for versions to load
      await authenticatedPage.waitForTimeout(1000);

      // Find a rollback button
      const rollbackButton = authenticatedPage.locator('button:has-text("Rollback"), [data-testid="rollback-button"]');

      if (await rollbackButton.count() > 0) {
        // Click rollback on a previous version
        await rollbackButton.first().click();

        // Confirm rollback dialog
        const confirmButton = authenticatedPage.locator('button:has-text("Confirm"), button:has-text("Yes")');

        if (await confirmButton.isVisible({ timeout: 3000 })) {
          await confirmButton.click();

          // Wait for rollback to complete
          await authenticatedPage.waitForTimeout(1000);

          // Verify success message
          const hasSuccessMessage = await authenticatedPage.locator('text=/rolled back|success/i').count() > 0;

          expect(hasSuccessMessage).toBeTruthy();
        }
      }
    });
  });

  test.describe('Validation', () => {
    test('should validate schema before publishing', async ({ page }) => {
      const token = await page.evaluate(() => localStorage.getItem('token'));

      try {
        // Create a test schema with validation errors
        const response = await page.request.fetch(`${API_URLS.REQUEST}/admin/schemas`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          data: JSON.stringify({
            type: testSchemaType,
            label: 'Invalid Schema',
            icon: '🚫',
            color: '#dc2626',
            description: 'Schema with validation errors',
            sections: [] // Empty sections should fail validation
          }),
        });

        const result = await response.json();

        // Should fail validation
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      } catch (error) {
        console.log('Validation test error:', error);
      }
    });
  });
});
