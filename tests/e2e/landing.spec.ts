import { test, expect } from '@playwright/test';

/**
 * E2E tests for the landing page.
 * These tests verify the CI/CD pipeline works for browser testing.
 */
test.describe('Landing page', () => {
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

		// Check for navigation links
		await expect(page.locator('a[href="#features"]')).toBeVisible();
		await expect(page.locator('a[href="#how-it-works"]')).toBeVisible();
		await expect(page.locator('a[href="#pricing"]')).toBeVisible();
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

		// Check for pricing tiers
		await expect(page.locator('text=Free')).toBeVisible();
		await expect(page.locator('text=$9')).toBeVisible();
		await expect(page.locator('text=$29')).toBeVisible();
	});
});