import { test, expect } from '@playwright/test';

/**
 * E2E tests for the landing page.
 * These tests verify the CI/CD pipeline works for browser testing.
 *
 * Note: These tests use HTTP Basic Auth to bypass the development gating.
 * The credentials are set via BASIC_AUTH_USER and BASIC_AUTH_PASSWORD in .dev.vars
 */

// Get credentials from environment or use defaults for local development
// These should match the values in .dev.vars
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || 'admin';
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD || 'qwerty123';

test.describe('Landing page', () => {
  test.use({
    httpCredentials: {
      username: BASIC_AUTH_USER,
      password: BASIC_AUTH_PASSWORD,
    },
  });

  test('should display the hero section', async ({ page }) => {
    await page.goto('/');

    // Check for the main heading
    await expect(page.locator('h1')).toContainText('PDFs that actually read well');
  });

  test('should display the CleanEbook brand', async ({ page }) => {
    await page.goto('/');

    // Check for brand name in header
    await expect(page.locator('header')).toContainText('CleanEbook');
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/');

    // Check for navigation links (use first() since there may be multiple links to same section)
    await expect(page.locator('a[href="#features"]').first()).toBeVisible();
    await expect(page.locator('a[href="#how-it-works"]').first()).toBeVisible();
    await expect(page.locator('a[href="#pricing"]').first()).toBeVisible();
  });

  test('should have Get Started button', async ({ page }) => {
    await page.goto('/');

    // Check for CTA button
    const getStartedBtn = page.locator('a[href="/register"]').first();
    await expect(getStartedBtn).toBeVisible();
    await expect(getStartedBtn).toContainText('Get Started');
  });

  test('should display pricing section', async ({ page }) => {
    await page.goto('/');

    // Scroll to pricing
    await page.locator('#pricing').scrollIntoViewIfNeeded();

    // Check for pricing tier titles (Card.Title renders div, not heading)
    const pricingSection = page.locator('#pricing');
    await expect(pricingSection.getByText('Free', { exact: true }).first()).toBeVisible();
    await expect(pricingSection.getByText('Reader', { exact: true }).first()).toBeVisible();
    await expect(pricingSection.getByText('Collector', { exact: true }).first()).toBeVisible();
  });

  test('should display upload drop zone', async ({ page }) => {
    await page.goto('/');

    // Check for upload drop zone
    await expect(page.getByText('Drop your PDF here')).toBeVisible();
    await expect(page.getByText('or click to browse')).toBeVisible();
    await expect(page.getByText('Max 100 pages • Free • No signup required')).toBeVisible();
  });

  test('should display feature cards', async ({ page }) => {
    await page.goto('/');

    // Scroll to features
    await page.locator('#features').scrollIntoViewIfNeeded();

    // Check for feature card titles
    const featuresSection = page.locator('#features');
    await expect(featuresSection.getByText('Smart Region Detection')).toBeVisible();
    await expect(featuresSection.getByText('Figure & Code Handling')).toBeVisible();
    await expect(featuresSection.getByText('Template System')).toBeVisible();
  });

  test('should display how it works steps', async ({ page }) => {
    await page.goto('/');

    // Scroll to how it works
    await page.locator('#how-it-works').scrollIntoViewIfNeeded();

    // Check for step titles
    const howItWorksSection = page.locator('#how-it-works');
    await expect(howItWorksSection.getByText('Upload Your PDF')).toBeVisible();
    await expect(howItWorksSection.getByText('Define Regions')).toBeVisible();
    await expect(howItWorksSection.getByText('Download EPUB')).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    await page.goto('/');

    // Check for footer content
    await expect(page.locator('footer')).toContainText('CleanEbook');
    await expect(page.locator('footer')).toContainText('© 2025 CleanEbook');
  });

  test('should have mobile navigation menu', async ({ page }) => {
    await page.goto('/');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Mobile menu button should be visible
    const menuButton = page
      .locator('header button[aria-haspopup], header [data-slot="sheet-trigger"]')
      .first();
    await expect(menuButton).toBeVisible();
  });
});
