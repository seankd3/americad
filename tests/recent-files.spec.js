/**
 * Tests for RecentFilesManager and WelcomeScreen
 * @jest-environment jsdom
 */

import { test, expect } from '@playwright/test';

// Test data
const STORAGE_KEY = 'ameri-cad-recent';

test.describe('RecentFilesManager', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080/');
    await page.waitForLoadState('domcontentloaded');

    // Clear localStorage before each test
    await page.evaluate(key => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);
  });

  test('should save files to localStorage', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Import and test
      const { RecentFilesManager } = await import('./src/core/recent-files.js');
      const manager = new RecentFilesManager(10);

      // Add a file
      manager.add('/path/to/file.americad', 'Test File');

      // Check localStorage
      const saved = localStorage.getItem('ameri-cad-recent');
      const parsed = JSON.parse(saved);

      return {
        count: manager.count(),
        savedCount: parsed.length,
        fileName: parsed[0]?.name,
        filePath: parsed[0]?.path,
      };
    });

    expect(result.count).toBe(1);
    expect(result.savedCount).toBe(1);
    expect(result.fileName).toBe('Test File');
    expect(result.filePath).toBe('/path/to/file.americad');
  });

  test('should enforce max file limit', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { RecentFilesManager } = await import('./src/core/recent-files.js');
      const manager = new RecentFilesManager(5); // Max 5 files

      // Add 7 files
      for (let i = 1; i <= 7; i++) {
        manager.add(`/path/file${i}.americad`, `File ${i}`);
      }

      const files = manager.getRecent();
      return {
        count: files.length,
        firstFileName: files[0]?.name,
        lastFileName: files[files.length - 1]?.name,
      };
    });

    expect(result.count).toBe(5);
    expect(result.firstFileName).toBe('File 7'); // Most recent first
    expect(result.lastFileName).toBe('File 3'); // Oldest kept file
  });

  test('should move existing file to front when re-added', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { RecentFilesManager } = await import('./src/core/recent-files.js');
      const manager = new RecentFilesManager(10);

      // Add files in order
      manager.add('/path/file1.americad', 'File 1');
      manager.add('/path/file2.americad', 'File 2');
      manager.add('/path/file3.americad', 'File 3');

      // Re-add file 1
      manager.add('/path/file1.americad', 'File 1 Updated');

      const files = manager.getRecent();
      return {
        count: files.length,
        firstFileName: files[0]?.name,
        order: files.map(f => f.name),
      };
    });

    expect(result.count).toBe(3); // No duplicate
    expect(result.firstFileName).toBe('File 1 Updated'); // At front
    expect(result.order).toEqual(['File 1 Updated', 'File 3', 'File 2']);
  });

  test('should load files from localStorage on init', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Pre-populate localStorage
      const existingFiles = [
        { path: '/existing/file1.americad', name: 'Existing 1', timestamp: Date.now() - 1000 },
        { path: '/existing/file2.americad', name: 'Existing 2', timestamp: Date.now() - 2000 },
      ];
      localStorage.setItem('ameri-cad-recent', JSON.stringify(existingFiles));

      // Now create manager
      const { RecentFilesManager } = await import('./src/core/recent-files.js');
      const manager = new RecentFilesManager(10);

      return {
        count: manager.count(),
        files: manager.getRecent().map(f => f.name),
      };
    });

    expect(result.count).toBe(2);
    expect(result.files).toEqual(['Existing 1', 'Existing 2']);
  });

  test('should clear all files', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { RecentFilesManager } = await import('./src/core/recent-files.js');
      const manager = new RecentFilesManager(10);

      // Add files
      manager.add('/path/file1.americad', 'File 1');
      manager.add('/path/file2.americad', 'File 2');

      // Clear
      manager.clear();

      const saved = localStorage.getItem('ameri-cad-recent');
      return {
        count: manager.count(),
        isEmpty: manager.isEmpty(),
        savedEmpty: JSON.parse(saved).length === 0,
      };
    });

    expect(result.count).toBe(0);
    expect(result.isEmpty).toBe(true);
    expect(result.savedEmpty).toBe(true);
  });

  test('should remove specific file', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { RecentFilesManager } = await import('./src/core/recent-files.js');
      const manager = new RecentFilesManager(10);

      manager.add('/path/file1.americad', 'File 1');
      manager.add('/path/file2.americad', 'File 2');
      manager.add('/path/file3.americad', 'File 3');

      // Remove file 2
      manager.remove('/path/file2.americad');

      const files = manager.getRecent();
      return {
        count: files.length,
        names: files.map(f => f.name),
      };
    });

    expect(result.count).toBe(2);
    expect(result.names).toContain('File 1');
    expect(result.names).toContain('File 3');
    expect(result.names).not.toContain('File 2');
  });

  test('should get file by path', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { RecentFilesManager } = await import('./src/core/recent-files.js');
      const manager = new RecentFilesManager(10);

      manager.add('/path/file1.americad', 'File 1');
      manager.add('/path/file2.americad', 'File 2');

      const found = manager.get('/path/file1.americad');
      const notFound = manager.get('/path/nonexistent.americad');

      return {
        foundName: found?.name,
        notFoundIsNull: notFound === null,
      };
    });

    expect(result.foundName).toBe('File 1');
    expect(result.notFoundIsNull).toBe(true);
  });

  test('should call onUpdate callback', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { RecentFilesManager } = await import('./src/core/recent-files.js');
      const manager = new RecentFilesManager(10);

      let updateCount = 0;
      let lastFiles = [];
      manager.onUpdate = files => {
        updateCount++;
        lastFiles = files;
      };

      manager.add('/path/file1.americad', 'File 1');
      manager.add('/path/file2.americad', 'File 2');
      manager.remove('/path/file1.americad');

      return {
        updateCount,
        lastFilesCount: lastFiles.length,
      };
    });

    expect(result.updateCount).toBe(3); // add, add, remove
    expect(result.lastFilesCount).toBe(1);
  });
});

test.describe('formatRelativeTime', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should format relative times correctly', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { formatRelativeTime } = await import('/src/core/recent-files.js');

      const now = Date.now();

      return {
        justNow: formatRelativeTime(now - 30 * 1000), // 30 seconds ago
        minutes: formatRelativeTime(now - 5 * 60 * 1000), // 5 minutes ago
        hours: formatRelativeTime(now - 3 * 60 * 60 * 1000), // 3 hours ago
        days: formatRelativeTime(now - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        oneMinute: formatRelativeTime(now - 60 * 1000), // 1 minute ago
        oneHour: formatRelativeTime(now - 60 * 60 * 1000), // 1 hour ago
        oneDay: formatRelativeTime(now - 24 * 60 * 60 * 1000), // 1 day ago
      };
    });

    expect(result.justNow).toBe('Just now');
    expect(result.minutes).toBe('5 minutes ago');
    expect(result.hours).toBe('3 hours ago');
    expect(result.days).toBe('2 days ago');
    expect(result.oneMinute).toBe('1 minute ago');
    expect(result.oneHour).toBe('1 hour ago');
    expect(result.oneDay).toBe('1 day ago');
  });
});

test.describe('WelcomeScreen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080/');
    await page.waitForLoadState('domcontentloaded');

    // Clear localStorage
    await page.evaluate(key => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);
  });

  test('should show and hide welcome screen', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { WelcomeScreen, addWelcomeScreenStyles } = await import('./src/ui/welcome-screen.js');
      const { RecentFilesManager } = await import('./src/core/recent-files.js');

      addWelcomeScreenStyles();

      const recentFiles = new RecentFilesManager(10);
      const welcome = new WelcomeScreen({
        recentFiles,
        callbacks: {},
      });

      // Initially hidden
      const initiallyVisible = welcome.isVisible();

      // Show
      welcome.show();
      const afterShow = welcome.isVisible();
      const hasVisibleClass = welcome.element.classList.contains('visible');

      // Hide
      welcome.hide();
      const afterHide = welcome.isVisible();

      return { initiallyVisible, afterShow, hasVisibleClass, afterHide };
    });

    expect(result.initiallyVisible).toBe(false);
    expect(result.afterShow).toBe(true);
    expect(result.hasVisibleClass).toBe(true);
    expect(result.afterHide).toBe(false);
  });

  test('should display recent files', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { WelcomeScreen, addWelcomeScreenStyles } = await import('./src/ui/welcome-screen.js');
      const { RecentFilesManager } = await import('./src/core/recent-files.js');

      addWelcomeScreenStyles();

      const recentFiles = new RecentFilesManager(10);
      recentFiles.add('/path/design1.americad', 'Design 1');
      recentFiles.add('/path/design2.americad', 'Design 2');

      const welcome = new WelcomeScreen({
        recentFiles,
        callbacks: {},
      });

      welcome.show();

      const items = welcome.element.querySelectorAll('.welcome-recent-item');
      const names = Array.from(items).map(
        item => item.querySelector('.welcome-recent-name')?.textContent
      );

      return {
        itemCount: items.length,
        names,
      };
    });

    expect(result.itemCount).toBe(2);
    expect(result.names).toContain('Design 1');
    expect(result.names).toContain('Design 2');
  });

  test('should show empty state when no recent files', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { WelcomeScreen, addWelcomeScreenStyles } = await import('./src/ui/welcome-screen.js');
      const { RecentFilesManager } = await import('./src/core/recent-files.js');

      addWelcomeScreenStyles();

      const recentFiles = new RecentFilesManager(10);
      const welcome = new WelcomeScreen({
        recentFiles,
        callbacks: {},
      });

      welcome.show();

      const emptyState = welcome.element.querySelector('.welcome-recent-empty');
      const items = welcome.element.querySelectorAll('.welcome-recent-item');

      return {
        hasEmptyState: !!emptyState,
        itemCount: items.length,
      };
    });

    expect(result.hasEmptyState).toBe(true);
    expect(result.itemCount).toBe(0);
  });

  test('should call onNewDocument callback', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { WelcomeScreen, addWelcomeScreenStyles } = await import('./src/ui/welcome-screen.js');
      const { RecentFilesManager } = await import('./src/core/recent-files.js');

      addWelcomeScreenStyles();

      let callbackCalled = false;
      const recentFiles = new RecentFilesManager(10);
      const welcome = new WelcomeScreen({
        recentFiles,
        callbacks: {
          onNewDocument: () => {
            callbackCalled = true;
          },
        },
      });

      welcome.show();

      // Click new document button
      const newBtn = welcome.element.querySelector('[data-action="new"]');
      newBtn?.click();

      return { callbackCalled };
    });

    expect(result.callbackCalled).toBe(true);
  });

  test('should call onOpenFile callback', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { WelcomeScreen, addWelcomeScreenStyles } = await import('./src/ui/welcome-screen.js');
      const { RecentFilesManager } = await import('./src/core/recent-files.js');

      addWelcomeScreenStyles();

      let callbackCalled = false;
      const recentFiles = new RecentFilesManager(10);
      const welcome = new WelcomeScreen({
        recentFiles,
        callbacks: {
          onOpenFile: () => {
            callbackCalled = true;
          },
        },
      });

      welcome.show();

      // Click open file button
      const openBtn = welcome.element.querySelector('[data-action="open"]');
      openBtn?.click();

      return { callbackCalled };
    });

    expect(result.callbackCalled).toBe(true);
  });

  test('should call onOpenRecent callback with file path', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { WelcomeScreen, addWelcomeScreenStyles } = await import('./src/ui/welcome-screen.js');
      const { RecentFilesManager } = await import('./src/core/recent-files.js');

      addWelcomeScreenStyles();

      let receivedPath = null;
      const recentFiles = new RecentFilesManager(10);
      recentFiles.add('/path/mydesign.americad', 'My Design');

      const welcome = new WelcomeScreen({
        recentFiles,
        callbacks: {
          onOpenRecent: path => {
            receivedPath = path;
          },
        },
      });

      welcome.show();

      // Click on recent file
      const recentItem = welcome.element.querySelector('[data-action="open-recent"]');
      recentItem?.click();

      return { receivedPath };
    });

    expect(result.receivedPath).toBe('/path/mydesign.americad');
  });

  test('should update when recent files change', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { WelcomeScreen, addWelcomeScreenStyles } = await import('./src/ui/welcome-screen.js');
      const { RecentFilesManager } = await import('./src/core/recent-files.js');

      addWelcomeScreenStyles();

      const recentFiles = new RecentFilesManager(10);
      const welcome = new WelcomeScreen({
        recentFiles,
        callbacks: {},
      });

      welcome.show();

      // Check initial state
      const initialItems = welcome.element.querySelectorAll('.welcome-recent-item');
      const initialCount = initialItems.length;

      // Add a file
      recentFiles.add('/path/newfile.americad', 'New File');

      // Check updated state
      const updatedItems = welcome.element.querySelectorAll('.welcome-recent-item');
      const updatedCount = updatedItems.length;

      return { initialCount, updatedCount };
    });

    expect(result.initialCount).toBe(0);
    expect(result.updatedCount).toBe(1);
  });

  test('should remove file from list when remove button clicked', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { WelcomeScreen, addWelcomeScreenStyles } = await import('./src/ui/welcome-screen.js');
      const { RecentFilesManager } = await import('./src/core/recent-files.js');

      addWelcomeScreenStyles();

      const recentFiles = new RecentFilesManager(10);
      recentFiles.add('/path/file1.americad', 'File 1');
      recentFiles.add('/path/file2.americad', 'File 2');

      const welcome = new WelcomeScreen({
        recentFiles,
        callbacks: {},
      });

      welcome.show();

      const initialCount = welcome.element.querySelectorAll('.welcome-recent-item').length;

      // Click remove on first item
      const removeBtn = welcome.element.querySelector('[data-action="remove-recent"]');
      removeBtn?.click();

      const afterRemoveCount = welcome.element.querySelectorAll('.welcome-recent-item').length;
      const remainingCount = recentFiles.count();

      return { initialCount, afterRemoveCount, remainingCount };
    });

    expect(result.initialCount).toBe(2);
    expect(result.afterRemoveCount).toBe(1);
    expect(result.remainingCount).toBe(1);
  });

  test('should clean up on destroy', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { WelcomeScreen, addWelcomeScreenStyles } = await import('./src/ui/welcome-screen.js');
      const { RecentFilesManager } = await import('./src/core/recent-files.js');

      addWelcomeScreenStyles();

      const recentFiles = new RecentFilesManager(10);
      const welcome = new WelcomeScreen({
        recentFiles,
        callbacks: {},
      });

      welcome.show();

      const elementExistsBefore = !!document.querySelector('.welcome-screen-overlay');

      welcome.destroy();

      const elementExistsAfter = !!document.querySelector('.welcome-screen-overlay');
      const isVisible = welcome.isVisible();

      return { elementExistsBefore, elementExistsAfter, isVisible };
    });

    expect(result.elementExistsBefore).toBe(true);
    expect(result.elementExistsAfter).toBe(false);
    expect(result.isVisible).toBe(false);
  });
});
