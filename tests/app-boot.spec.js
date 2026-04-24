// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Ameri-CAD app boot', () => {
  test('loads the main app module without page errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.AmericaD), null, { timeout: 30000 });

    expect(pageErrors).toEqual([]);
  });
});
