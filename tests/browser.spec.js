// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Ameri-CAD Browser Test Suite
 * Runs the Mocha test suite in a real browser and reports results
 */

test.describe('Ameri-CAD Test Suite', () => {
  test('should run all Mocha tests and pass', async ({ page }) => {
    // Navigate to the test runner
    await page.goto('/tests/runner.html');
    
    // Wait for Mocha to finish running tests
    // Mocha adds test results to #mocha-stats when complete
    await page.waitForSelector('#mocha-stats', { timeout: 60000 });
    
    // Wait for all tests to complete - stats should have passes/failures
    await page.waitForFunction(() => {
      const stats = document.getElementById('mocha-stats');
      if (!stats) return false;
      // Mocha shows duration when complete
      const duration = stats.querySelector('.duration');
      return duration && duration.textContent && duration.textContent.includes('s');
    }, { timeout: 60000 });
    
    // Small delay to ensure final render
    await page.waitForTimeout(500);
    
    // Get test results
    const stats = await page.evaluate(() => {
      const statsEl = document.getElementById('mocha-stats');
      if (!statsEl) return { passes: 0, failures: -1, total: 0 };
      
      const passesEl = statsEl.querySelector('.passes em');
      const failuresEl = statsEl.querySelector('.failures em');
      
      const passes = passesEl ? parseInt(passesEl.textContent || '0', 10) : 0;
      const failures = failuresEl ? parseInt(failuresEl.textContent || '0', 10) : 0;
      
      return { passes, failures, total: passes + failures };
    });
    
    console.log(`\n📊 Test Results: ${stats.passes} passed, ${stats.failures} failed (${stats.total} total)\n`);
    
    // If there are failures, get details
    if (stats.failures > 0) {
      const failureDetails = await page.evaluate(() => {
        const failures = document.querySelectorAll('#mocha .test.fail');
        return Array.from(failures).map(el => {
          const title = el.querySelector('h2')?.textContent || 'Unknown test';
          const error = el.querySelector('.error')?.textContent || 'No error message';
          return `❌ ${title}\n   ${error}`;
        }).join('\n\n');
      });
      console.log('Failed tests:\n' + failureDetails);
    }
    
    // Assert no failures
    expect(stats.failures, `Expected 0 failures but got ${stats.failures}`).toBe(0);
    expect(stats.total, 'Expected tests to run').toBeGreaterThan(0);
  });
  
  test('should load all test modules without errors', async ({ page }) => {
    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Navigate to test runner
    await page.goto('/tests/runner.html');
    
    // Wait for tests to start
    await page.waitForSelector('#mocha-stats', { timeout: 60000 });
    
    // Check for module load errors shown in the page
    const loadErrors = await page.evaluate(() => {
      const errorDivs = document.querySelectorAll('#mocha > div[style*="color: #ff4444"]');
      return Array.from(errorDivs).map(el => el.textContent);
    });
    
    if (loadErrors.length > 0) {
      console.log('Module load errors:', loadErrors);
    }
    
    expect(loadErrors, 'No module load errors expected').toHaveLength(0);
  });
});
