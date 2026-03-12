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
			password: BASIC_AUTH_PASSWORD
		}
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

		// Check for pricing tier headings (use exact to match h3 pricing headings, not hero h1)
		await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Reader', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Collector', exact: true })).toBeVisible();
	});
});