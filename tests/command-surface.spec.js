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
    await expect(page.locator('.timeline-counter')).toHaveText('0 / 0');
    await expect(page.locator('#body-count')).toHaveText('0');
    await expect(page.locator('#selection-status')).toHaveText('NONE');
    await page.locator('[data-tab="materials"]').click();
    await expect(page.locator('#materials-empty')).toContainText('NO MATERIALS IN DOCUMENT');
    await page.locator('[data-tab="properties"]').click();

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
        materialName: document.querySelector('.material-name')?.textContent,
        materialDetail: document.querySelector('.material-detail')?.textContent,
        materialSummary: document.querySelector('#materials-summary')?.textContent,
        timelineCounter: document.querySelector('.timeline-counter')?.textContent,
        timelineProgress: document.querySelector('.timeline-progress')?.style.width,
        bodyCount: document.querySelector('#body-count')?.textContent,
        selectionStatus: document.querySelector('#selection-status')?.textContent,
      };
    });

    expect(created.type).toBe('body');
    expect(created.bodyType).toBe('box');
    expect(created.selected).toBe(true);
    expect(created.featureCount).toBeGreaterThan(0);
    expect(created.inspectorName).toContain('BODY_');
    expect(created.inspectorType).toBe('BOX / SOLID');
    expect(created.inspectorEmptyVisible).toBe(false);
    expect(created.materialName).toBe('Generic');
    expect(created.materialDetail).toContain('selected');
    expect(created.materialSummary).toBe('1 BODY / 1 MATERIAL');
    expect(created.timelineCounter).toBe('1 / 1');
    expect(created.timelineProgress).toBe('100%');
    expect(created.bodyCount).toBe('1');
    expect(created.selectionStatus).toContain('BODY_');

    await page.locator('[data-tab="browser"]').click();
    await expect(page.locator('#panel-browser')).toHaveClass(/active/);
    await page.locator('#feature-tree .tree-node').first().click({ button: 'right' });
    await page.locator('#feature-context-menu [data-action="edit"]').click();
    await expect(page.locator('#panel-properties')).toHaveClass(/active/);
    await expect(page.locator('#prop-name')).toHaveValue(/BODY_/);

    await page.locator('[data-tab="browser"]').click();
    await page.locator('#feature-tree .tree-node').first().click({ button: 'right' });
    await page.locator('#feature-context-menu [data-action="delete"]').click();
    await page.waitForFunction(() => window.AmericaD.System.objects.length === 0);
    await expect(page.locator('#body-count')).toHaveText('0');
    await expect(page.locator('#selection-status')).toHaveText('NONE');
    await expect(page.locator('.timeline-counter')).toHaveText('0 / 0');
    expect(consoleErrors).toEqual([]);
  });
});
