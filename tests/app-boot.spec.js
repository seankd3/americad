// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Ameri-CAD app boot', () => {
  test('loads the main app without runtime errors or fallback mode', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
    page.on('console', message => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.AmericaD), null, { timeout: 30000 });
    await page.waitForTimeout(1000);

    const statusText = await page.locator('#command-hint').textContent();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(statusText).not.toContain('FALLBACK');
  });

  test('fits the core workspace in a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.AmericaD), null, { timeout: 30000 });
    await page.waitForTimeout(1000);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );

    expect(hasHorizontalOverflow).toBe(false);
  });
});
