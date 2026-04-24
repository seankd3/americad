// @ts-check
import { test, expect } from '@playwright/test';

async function getRects(page, selectors) {
  return page.evaluate(selectorList => {
    const rects = {};
    for (const [name, selector] of Object.entries(selectorList)) {
      const element = document.querySelector(selector);
      if (!element) {
        rects[name] = null;
        continue;
      }

      const rect = element.getBoundingClientRect();
      rects[name] = {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    }
    return rects;
  }, selectors);
}

function expectBefore(first, second, axis = 'vertical') {
  const end = axis === 'vertical' ? 'bottom' : 'right';
  const start = axis === 'vertical' ? 'top' : 'left';
  expect(first[end]).toBeLessThanOrEqual(second[start] + 1);
}

test.describe('Ameri-CAD design QA', () => {
  test('keeps desktop CAD chrome in non-overlapping regions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.AmericaD), null, { timeout: 30000 });
    await page.waitForTimeout(1000);

    const rects = await getRects(page, {
      header: '.system-header',
      workspace: '.workspace',
      toolPalette: '.tool-palette',
      viewportArea: '.viewport-area',
      viewportToolbar: '.viewport-toolbar',
      viewport: '#viewport',
      commandLine: '.command-line',
      dataPanel: '.data-panel',
      timeline: '.timeline',
      statusBar: '.status-bar',
    });

    for (const rect of Object.values(rects)) {
      expect(rect).not.toBeNull();
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
    }

    expectBefore(rects.header, rects.workspace);
    expectBefore(rects.workspace, rects.timeline);
    expectBefore(rects.timeline, rects.statusBar);
    expectBefore(rects.toolPalette, rects.viewportArea, 'horizontal');
    expectBefore(rects.viewportArea, rects.dataPanel, 'horizontal');
    expectBefore(rects.viewportToolbar, rects.viewport);
    expectBefore(rects.viewport, rects.commandLine);
  });

  test('keeps mobile workspace inside the viewport without footer collisions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.AmericaD), null, { timeout: 30000 });
    await page.waitForTimeout(1000);

    const layout = await page.evaluate(() => {
      const visibleChildrenInside = selector => {
        const parent = document.querySelector(selector);
        if (!parent) return false;
        const parentRect = parent.getBoundingClientRect();

        return Array.from(parent.children)
          .filter(child => getComputedStyle(child).display !== 'none')
          .every(child => {
            const rect = child.getBoundingClientRect();
            return (
              rect.left >= parentRect.left - 1 &&
              rect.right <= parentRect.right + 1 &&
              rect.top >= parentRect.top - 1 &&
              rect.bottom <= parentRect.bottom + 1
            );
          });
      };

      return {
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        timelineChildrenFit: visibleChildrenInside('.timeline'),
        statusChildrenFit: visibleChildrenInside('.status-bar'),
      };
    });

    expect(layout.hasHorizontalOverflow).toBe(false);
    expect(layout.timelineChildrenFit).toBe(true);
    expect(layout.statusChildrenFit).toBe(true);
  });
});
