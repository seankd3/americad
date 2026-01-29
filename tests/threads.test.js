/**
 * Ameri-CAD Thread Operations Tests
 * Tests for thread creation: external, internal, cosmetic
 */

import { KernelBridge } from '../src/kernel/bridge.js';
import {
  METRIC_THREADS,
  IMPERIAL_THREADS,
  parseThreadSpec,
  getThreadParams,
  listThreadSizes,
  getThreadDepth,
} from '../src/data/thread-standards.js';

// Create a shared kernel instance
let kernel;

// ==================== Test Utilities ====================

/**
 * Get bounding box from mesh data
 */
function _getBoundingBox(mesh) {
  const vertices = mesh.vertices;
  if (!vertices || vertices.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (let i = 0; i < vertices.length; i += 3) {
    minX = Math.min(minX, vertices[i]);
    minY = Math.min(minY, vertices[i + 1]);
    minZ = Math.min(minZ, vertices[i + 2]);
    maxX = Math.max(maxX, vertices[i]);
    maxY = Math.max(maxY, vertices[i + 1]);
    maxZ = Math.max(maxZ, vertices[i + 2]);
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
  };
}

/**
 * Check mesh validity
 */
function isValidMesh(mesh) {
  return (
    mesh &&
    mesh.vertices instanceof Float32Array &&
    mesh.normals instanceof Float32Array &&
    mesh.indices instanceof Uint32Array &&
    mesh.vertices.length > 0 &&
    mesh.indices.length % 3 === 0
  );
}

/**
 * Approximate check if a value is within tolerance
 */
function approxEqual(a, b, tolerance = 0.01) {
  return Math.abs(a - b) < tolerance;
}

// ==================== Test Suites ====================

/**
 * Test results container
 */
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
};

function assert(condition, message) {
  if (!condition) {
    testResults.failed++;
    testResults.errors.push(message);
    console.error('❌ FAIL:', message);
    return false;
  }
  testResults.passed++;
  console.log('✓', message);
  return true;
}

async function runTest(name, testFn) {
  console.log(`\n--- ${name} ---`);
  try {
    await testFn();
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`${name}: ${error.message}`);
    console.error(`❌ ERROR in ${name}:`, error.message);
  }
}

// ==================== Thread Standards Data Tests ====================

async function testThreadStandardsData() {
  console.log('\n========== Thread Standards Data Tests ==========');

  await runTest('Metric thread sizes exist', async () => {
    const sizes = Object.keys(METRIC_THREADS);
    assert(sizes.includes('M3'), 'M3 thread exists');
    assert(sizes.includes('M5'), 'M5 thread exists');
    assert(sizes.includes('M8'), 'M8 thread exists');
    assert(sizes.includes('M10'), 'M10 thread exists');
    assert(sizes.includes('M12'), 'M12 thread exists');
  });

  await runTest('Metric thread pitches are correct', async () => {
    assert(approxEqual(METRIC_THREADS['M5'].pitch, 0.8, 0.01), 'M5 pitch = 0.8mm');
    assert(approxEqual(METRIC_THREADS['M10'].pitch, 1.5, 0.01), 'M10 pitch = 1.5mm');
    assert(approxEqual(METRIC_THREADS['M8'].pitch, 1.25, 0.01), 'M8 pitch = 1.25mm');
  });

  await runTest('Metric thread major diameters are correct', async () => {
    assert(approxEqual(METRIC_THREADS['M5'].majorDia, 5, 0.01), 'M5 major diameter = 5mm');
    assert(approxEqual(METRIC_THREADS['M10'].majorDia, 10, 0.01), 'M10 major diameter = 10mm');
    assert(approxEqual(METRIC_THREADS['M12'].majorDia, 12, 0.01), 'M12 major diameter = 12mm');
  });

  await runTest('Imperial thread sizes exist', async () => {
    const sizes = Object.keys(IMPERIAL_THREADS);
    assert(sizes.includes('1/4-20'), '1/4-20 thread exists');
    assert(sizes.includes('5/16-18'), '5/16-18 thread exists');
    assert(sizes.includes('3/8-16'), '3/8-16 thread exists');
  });

  await runTest('Imperial thread TPI values are correct', async () => {
    assert(IMPERIAL_THREADS['1/4-20'].tpi === 20, '1/4-20 has 20 TPI');
    assert(IMPERIAL_THREADS['5/16-18'].tpi === 18, '5/16-18 has 18 TPI');
    assert(IMPERIAL_THREADS['1/2-13'].tpi === 13, '1/2-13 has 13 TPI');
  });

  await runTest('parseThreadSpec works for metric threads', async () => {
    const m10 = parseThreadSpec('M10');
    assert(m10.metric === true, 'M10 is metric');
    assert(m10.nominalDiameter === 10, 'M10 nominal = 10');
    assert(approxEqual(m10.pitch, 1.5, 0.01), 'M10 pitch = 1.5');

    const m5x08 = parseThreadSpec('M5x0.8');
    assert(m5x08.pitch === 0.8, 'M5x0.8 pitch parsed correctly');
  });

  await runTest('parseThreadSpec works for imperial threads', async () => {
    const quarter20 = parseThreadSpec('1/4-20');
    assert(quarter20.metric === false, '1/4-20 is imperial');
    assert(quarter20.tpi === 20, '1/4-20 TPI = 20');
    assert(approxEqual(quarter20.nominalDiameter, 6.35, 0.1), '1/4" = 6.35mm');

    const num10 = parseThreadSpec('#10-24');
    assert(num10.metric === false, '#10-24 is imperial');
    assert(num10.tpi === 24, '#10-24 TPI = 24');
  });

  await runTest('getThreadParams returns correct values', async () => {
    const m10External = getThreadParams('M10', 'external');
    assert(approxEqual(m10External.majorDia, 10, 0.01), 'M10 major dia = 10');
    assert(approxEqual(m10External.pitch, 1.5, 0.01), 'M10 pitch = 1.5');
    assert(m10External.depth > 0, 'M10 has positive thread depth');
    assert(m10External.minorDia < m10External.majorDia, 'Minor dia < major dia');

    const m10Internal = getThreadParams('M10', 'internal');
    assert(m10Internal.tapDrill !== undefined, 'M10 has tap drill size');
  });

  await runTest('getThreadDepth calculates correctly', async () => {
    const externalDepth = getThreadDepth(1.5, true);
    const internalDepth = getThreadDepth(1.5, false);

    assert(externalDepth > 0, 'External thread depth is positive');
    assert(internalDepth > 0, 'Internal thread depth is positive');
    assert(externalDepth > internalDepth, 'External depth > internal depth');
    // ISO standard: external ≈ 0.6134 × pitch, internal ≈ 0.5413 × pitch
    assert(approxEqual(externalDepth, 1.5 * 0.6134, 0.01), 'External depth formula correct');
  });

  await runTest('listThreadSizes returns valid arrays', async () => {
    const metric = listThreadSizes(true);
    const imperial = listThreadSizes(false);

    assert(Array.isArray(metric) && metric.length > 0, 'Metric sizes available');
    assert(Array.isArray(imperial) && imperial.length > 0, 'Imperial sizes available');
    assert(metric.includes('M10'), 'Metric includes M10');
    assert(imperial.includes('1/4-20'), 'Imperial includes 1/4-20');
  });
}

// ==================== Kernel Thread Operation Tests ====================

async function testKernelThreadOperations() {
  console.log('\n========== Kernel Thread Operation Tests ==========');

  await runTest('Setup: Initialize kernel', async () => {
    kernel = new KernelBridge();
    await kernel.init();
    assert(kernel.isReady(), 'Kernel initialized');
  });

  // Create a test cylinder for external threads
  let testCylinder;

  await runTest('Setup: Create test cylinder', async () => {
    testCylinder = await kernel.createCylinder(5, 20); // radius=5 (dia=10), height=20
    assert(testCylinder.id, 'Test cylinder created');
    assert(isValidMesh(testCylinder.mesh), 'Test cylinder mesh valid');
  });

  await runTest('External thread creates geometry', async () => {
    const pitch = 1.5; // M10 pitch
    const length = 15;

    const result = await kernel.createExternalThread(testCylinder.id, pitch, length);

    assert(result.id, 'External thread created with ID');
    assert(isValidMesh(result.mesh), 'External thread mesh is valid');
    assert(result.type === 'externalThread', 'Type is externalThread');
    assert(result.threadInfo, 'Thread info provided');
    assert(approxEqual(result.threadInfo.pitch, pitch, 0.01), 'Thread pitch stored correctly');
  });

  // Create a test block for internal threads
  let testBlock;

  await runTest('Setup: Create test block for internal thread', async () => {
    testBlock = await kernel.createBox(30, 30, 20);
    assert(testBlock.id, 'Test block created');
    assert(isValidMesh(testBlock.mesh), 'Test block mesh valid');
  });

  await runTest('Internal thread creates tapped hole', async () => {
    const position = { x: 0, y: 0, z: 20 }; // Top face
    const direction = { x: 0, y: 0, z: -1 }; // Down into material
    const nominalDiameter = 10;
    const pitch = 1.5;
    const depth = 15;

    const result = await kernel.createInternalThread(
      testBlock.id,
      position,
      direction,
      nominalDiameter,
      pitch,
      depth
    );

    assert(result.id, 'Internal thread created with ID');
    assert(isValidMesh(result.mesh), 'Internal thread mesh is valid');
    assert(result.type === 'internalThread', 'Type is internalThread');
    assert(result.threadInfo, 'Thread info provided');
    assert(result.threadInfo.nominalDiameter === nominalDiameter, 'Nominal diameter stored');
    assert(result.threadInfo.tapDrillDiameter < nominalDiameter, 'Tap drill < nominal');
  });

  await runTest('Cosmetic thread stores metadata', async () => {
    const nominalDiameter = 10;
    const pitch = 1.5;
    const length = 15;
    const faceId = 'test_face_id';

    const result = await kernel.createCosmeticThread(
      testCylinder.id,
      faceId,
      nominalDiameter,
      pitch,
      length,
      'external'
    );

    assert(result.type === 'cosmeticThread', 'Type is cosmeticThread');
    assert(result.faceId === faceId, 'Face ID stored');
    assert(result.threadInfo, 'Thread info provided');
    assert(result.threadInfo.nominalDiameter === nominalDiameter, 'Nominal diameter stored');
    assert(result.threadInfo.pitch === pitch, 'Pitch stored');
    assert(result.threadInfo.length === length, 'Length stored');
    assert(result.threadInfo.threadType === 'external', 'Thread type stored');
  });

  await runTest('Threaded cylinder creates bolt body', async () => {
    const nominalDiameter = 8;
    const pitch = 1.25;
    const length = 25;

    const result = await kernel.createThreadedCylinder(nominalDiameter, pitch, length);

    assert(result.id, 'Threaded cylinder created with ID');
    assert(isValidMesh(result.mesh), 'Threaded cylinder mesh is valid');
    assert(result.type === 'threadedCylinder', 'Type is threadedCylinder');
    assert(result.threadInfo, 'Thread info provided');
    assert(result.threadInfo.nominalDiameter === nominalDiameter, 'Nominal diameter stored');
  });
}

// ==================== Thread Geometry Tests ====================

async function testThreadGeometry() {
  console.log('\n========== Thread Geometry Tests ==========');

  await runTest('External thread reduces cylinder volume', async () => {
    // Create a plain cylinder
    const plainCyl = await kernel.createCylinder(5, 20);
    const plainVol = await kernel.getVolume(plainCyl.id);

    // Create same cylinder with threads
    const threadedCyl = await kernel.createThreadedCylinder(10, 1.5, 20);
    const threadedVol = await kernel.getVolume(threadedCyl.id);

    // Threaded should have less volume (grooves cut out)
    assert(threadedVol.volume < plainVol.volume, 'Threaded cylinder has less volume than plain');
  });

  await runTest('Internal thread creates hole in block', async () => {
    // Create a block
    const block = await kernel.createBox(30, 30, 20);
    const blockVol = await kernel.getVolume(block.id);

    // Add internal thread (tapped hole)
    const tapped = await kernel.createInternalThread(
      block.id,
      { x: 0, y: 0, z: 20 },
      { x: 0, y: 0, z: -1 },
      10,
      1.5,
      15
    );
    const tappedVol = await kernel.getVolume(tapped.id);

    // Block with hole should have less volume
    assert(tappedVol.volume < blockVol.volume, 'Tapped block has less volume than solid block');
  });

  await runTest('Thread minor diameter is less than major', async () => {
    const params = getThreadParams('M10', 'external');

    assert(params.minorDia < params.majorDia, 'Minor diameter < major diameter');

    // Check the difference is approximately 2 * thread depth
    const depthDiff = (params.majorDia - params.minorDia) / 2;
    assert(approxEqual(depthDiff, params.depth, 0.1), 'Diameter difference matches thread depth');
  });
}

// ==================== Run All Tests ====================

async function runAllTests() {
  console.log('============================================================');
  console.log('  Ameri-CAD Thread Operations Test Suite');
  console.log('============================================================');

  // Standards data tests (no kernel required)
  await testThreadStandardsData();

  // Kernel tests
  await testKernelThreadOperations();

  // Geometry validation tests
  await testThreadGeometry();

  // Summary
  console.log('\n============================================================');
  console.log('  TEST SUMMARY');
  console.log('============================================================');
  console.log(`  Passed: ${testResults.passed}`);
  console.log(`  Failed: ${testResults.failed}`);

  if (testResults.errors.length > 0) {
    console.log('\n  Errors:');
    testResults.errors.forEach((err, i) => {
      console.log(`    ${i + 1}. ${err}`);
    });
  }

  console.log('============================================================');

  // Return success/failure for CI
  return testResults.failed === 0;
}

// Export for module usage
export { runAllTests, testResults };

// Auto-run if in browser
if (typeof window !== 'undefined') {
  window.runThreadTests = runAllTests;
  console.log('Thread tests loaded. Run window.runThreadTests() to execute.');
}
