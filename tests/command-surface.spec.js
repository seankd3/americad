// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Ameri-CAD command surface', () => {
  test('exposes public command execution and creates geometry', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', message => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.goto('/');
    await page.waitForFunction(() => typeof window.AmericaD?.executeCommand === 'function', null, {
      timeout: 30000,
    });
    await page.waitForFunction(() => window.AmericaD.app?.document, null, { timeout: 30000 });
    await expect(page.locator('#command-hint')).toContainText('DOCUMENT MODEL READY');

    await page.evaluate(() => window.AmericaD.executeCommand('clear'));
    await page.waitForFunction(() => window.AmericaD.System.objects.length === 0);

    await page.evaluate(() => window.AmericaD.executeCommand('box 12 14 16'));
    await page.waitForFunction(() => window.AmericaD.System.objects.length === 1);

    const created = await page.evaluate(() => {
      const mesh = window.AmericaD.System.objects[0];
      return {
        type: mesh.userData?.type,
        bodyType: mesh.userData?.bodyType,
        selected: window.AmericaD.selectionManager.getSelected()?.uuid === mesh.uuid,
        featureCount: window.AmericaD.document?.features?.size ?? 0,
        inspectorName: document.querySelector('#prop-name')?.value,
        inspectorType: document.querySelector('#prop-type')?.textContent,
        inspectorEmptyVisible:
          getComputedStyle(document.querySelector('#prop-empty')).display !== 'none',
      };
    });

    expect(created.type).toBe('body');
    expect(created.bodyType).toBe('box');
    expect(created.selected).toBe(true);
    expect(created.featureCount).toBeGreaterThan(0);
    expect(created.inspectorName).toContain('BODY_');
    expect(created.inspectorType).toBe('BOX / SOLID');
    expect(created.inspectorEmptyVisible).toBe(false);
    expect(consoleErrors).toEqual([]);
  });
});
