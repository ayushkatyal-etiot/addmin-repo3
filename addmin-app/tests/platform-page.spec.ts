import { test, expect } from '@playwright/test';

test('Platform signin page should load', async ({ page }) => {
  // Navigate to platform signin
  await page.goto('http://localhost:3000/platform/signin');

  // Check if page loaded
  await expect(page).toHaveTitle(/AddMin/i);

  // Check if signin form exists
  const heading = page.locator('h1');
  await expect(heading).toContainText('Platform Operator sign in');

  // Check if form fields exist
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('input[type="text"][inputmode="numeric"]')).toBeVisible();

  console.log('✓ Platform signin page loaded successfully');
});
