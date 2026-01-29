#!/usr/bin/env node
/**
 * Screenshot Capture Script for Ameri-CAD Documentation
 * 
 * Usage: node scripts/capture-screenshots.js
 * 
 * Requires: playwright installed
 * npm install -D @playwright/test
 */

import { chromium } from '@playwright/test';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SCREENSHOTS_DIR = join(process.cwd(), 'docs', 'images');
const BASE_URL = 'http://localhost:8080';

// Ensure screenshots directory exists
if (!existsSync(SCREENSHOTS_DIR)) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function captureScreenshots() {
  console.log('🎬 Starting Ameri-CAD screenshot capture...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  try {
    // Wait for app to load
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000); // Wait for OpenCASCADE to init
    
    console.log('📷 Capturing: Empty workspace');
    await page.screenshot({ 
      path: join(SCREENSHOTS_DIR, 'workspace-empty.png'),
      fullPage: false 
    });
    
    // Create a box
    console.log('📷 Capturing: Box primitive');
    await page.evaluate(() => window.AmericaD?.executeCommand?.('box 50 30 20'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(SCREENSHOTS_DIR, 'primitive-box.png') });
    
    // Create sphere
    console.log('📷 Capturing: Sphere primitive');
    await page.evaluate(() => window.AmericaD?.executeCommand?.('sphere 25'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(SCREENSHOTS_DIR, 'primitive-sphere.png') });
    
    // Boolean subtract
    console.log('📷 Capturing: Boolean operation');
    await page.evaluate(() => window.AmericaD?.executeCommand?.('select all'));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.AmericaD?.executeCommand?.('subtract'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(SCREENSHOTS_DIR, 'boolean-subtract.png') });
    
    // Fillet
    console.log('📷 Capturing: Fillet');
    await page.evaluate(() => window.AmericaD?.executeCommand?.('fillet 3'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(SCREENSHOTS_DIR, 'fillet-example.png') });
    
    // Feature tree (zoom to sidebar)
    console.log('📷 Capturing: Feature tree');
    const featureTree = await page.$('.feature-tree, #feature-tree, [class*="feature"]');
    if (featureTree) {
      await featureTree.screenshot({ path: join(SCREENSHOTS_DIR, 'ui-feature-tree.png') });
    }
    
    // Property panel
    console.log('📷 Capturing: Property panel');
    const propertyPanel = await page.$('.property-panel, #property-panel, [class*="property"]');
    if (propertyPanel) {
      await propertyPanel.screenshot({ path: join(SCREENSHOTS_DIR, 'ui-property-panel.png') });
    }
    
    // Clear and show sketch mode
    console.log('📷 Capturing: Sketch mode');
    await page.evaluate(() => window.AmericaD?.executeCommand?.('new'));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.AmericaD?.executeCommand?.('sketch xy'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(SCREENSHOTS_DIR, 'sketch-mode.png') });
    
    console.log('\n✅ Screenshots captured successfully!');
    console.log(`📁 Location: ${SCREENSHOTS_DIR}`);
    
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error.message);
  } finally {
    await browser.close();
  }
}

// Run
captureScreenshots().catch(console.error);
