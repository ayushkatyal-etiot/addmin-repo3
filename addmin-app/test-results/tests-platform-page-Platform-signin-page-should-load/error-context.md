# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/platform-page.spec.ts >> Platform signin page should load
- Location: tests/platform-page.spec.ts:3:1

# Error details

```
Error: expect(page).toHaveTitle(expected) failed

Expected pattern: /AddMin/i
Received string:  "404: This page could not be found."
Timeout: 5000ms

Call log:
  - Expect "toHaveTitle" with timeout 5000ms
    14 × locator resolved to <html lang="en">…</html>
       - unexpected value "404: This page could not be found."

```

```yaml
- heading "404" [level=1]
- heading "This page could not be found." [level=2]
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('Platform signin page should load', async ({ page }) => {
  4  |   // Navigate to platform signin
  5  |   await page.goto('http://localhost:3000/platform/signin');
  6  | 
  7  |   // Check if page loaded
> 8  |   await expect(page).toHaveTitle(/AddMin/i);
     |                      ^ Error: expect(page).toHaveTitle(expected) failed
  9  | 
  10 |   // Check if signin form exists
  11 |   const heading = page.locator('h1');
  12 |   await expect(heading).toContainText('Platform Operator sign in');
  13 | 
  14 |   // Check if form fields exist
  15 |   await expect(page.locator('input[type="email"]')).toBeVisible();
  16 |   await expect(page.locator('input[type="password"]')).toBeVisible();
  17 |   await expect(page.locator('input[type="text"][inputmode="numeric"]')).toBeVisible();
  18 | 
  19 |   console.log('✓ Platform signin page loaded successfully');
  20 | });
  21 | 
```