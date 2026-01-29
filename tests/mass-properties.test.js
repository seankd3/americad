/**
 * Ameri-CAD Mass Properties Tests
 * Tests for mass properties calculation using OpenCASCADE kernel
 */

import { KernelBridge } from '../src/kernel/bridge.js';

// Create a shared kernel instance for all tests
let kernel;

// ==================== Test Utilities ====================

/**
 * Approximate equality check with tolerance
 */
function approxEqual(actual, expected, tolerance = 0.01) {
  const ratio = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-10);
  return ratio <= tolerance;
}

/**
 * Assert approximate equality with descriptive error
 */
function assertApprox(actual, expected, tolerance, message) {
  if (!approxEqual(actual, expected, tolerance)) {
    throw new Error(
      `${message}: expected ${expected}, got ${actual} (tolerance: ${tolerance * 100}%)`
    );
  }
}

// ==================== Initialization ====================

console.log('='.repeat(60));
console.log('MASS PROPERTIES TESTS');
console.log('='.repeat(60));

// Initialize kernel before running tests
async function initKernel() {
  kernel = new KernelBridge();
  const initResult = await kernel.init();
  if (!initResult) {
    throw new Error('Kernel initialization failed');
  }
  console.log('[Test] Kernel initialized successfully');
  return kernel;
}

// ==================== Test Cases ====================

/**
 * Test: Box volume calculation
 * A 10x10x10 box should have volume = 1000 mm³
 */
async function testBoxVolume() {
  console.log('\n[Test] Box Volume...');

  const result = await kernel.createBox(10, 10, 10);
  const props = await kernel.getMassProperties(result.id);

  const expectedVolume = 10 * 10 * 10; // 1000 mm³
  assertApprox(props.volume, expectedVolume, 0.001, 'Box volume');

  console.log(`  Volume: ${props.volume.toFixed(2)} mm³ (expected: ${expectedVolume})`);
  console.log('  ✓ PASSED');
}

/**
 * Test: Box surface area calculation
 * A 10x10x10 box should have surface area = 6 * 100 = 600 mm²
 */
async function testBoxSurfaceArea() {
  console.log('\n[Test] Box Surface Area...');

  const result = await kernel.createBox(10, 10, 10);
  const props = await kernel.getMassProperties(result.id);

  const expectedArea = 6 * (10 * 10); // 600 mm²
  assertApprox(props.surfaceArea, expectedArea, 0.001, 'Box surface area');

  console.log(`  Surface Area: ${props.surfaceArea.toFixed(2)} mm² (expected: ${expectedArea})`);
  console.log('  ✓ PASSED');
}

/**
 * Test: Sphere volume calculation
 * V = (4/3) * π * r³
 */
async function testSphereVolume() {
  console.log('\n[Test] Sphere Volume...');

  const radius = 10;
  const result = await kernel.createSphere(radius);
  const props = await kernel.getMassProperties(result.id);

  const expectedVolume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  assertApprox(props.volume, expectedVolume, 0.01, 'Sphere volume');

  console.log(`  Volume: ${props.volume.toFixed(2)} mm³ (expected: ${expectedVolume.toFixed(2)})`);
  console.log('  ✓ PASSED');
}

/**
 * Test: Sphere surface area calculation
 * A = 4 * π * r²
 */
async function testSphereSurfaceArea() {
  console.log('\n[Test] Sphere Surface Area...');

  const radius = 10;
  const result = await kernel.createSphere(radius);
  const props = await kernel.getMassProperties(result.id);

  const expectedArea = 4 * Math.PI * Math.pow(radius, 2);
  assertApprox(props.surfaceArea, expectedArea, 0.01, 'Sphere surface area');

  console.log(
    `  Surface Area: ${props.surfaceArea.toFixed(2)} mm² (expected: ${expectedArea.toFixed(2)})`
  );
  console.log('  ✓ PASSED');
}

/**
 * Test: Cylinder volume calculation
 * V = π * r² * h
 */
async function testCylinderVolume() {
  console.log('\n[Test] Cylinder Volume...');

  const radius = 5;
  const height = 20;
  const result = await kernel.createCylinder(radius, height);
  const props = await kernel.getMassProperties(result.id);

  const expectedVolume = Math.PI * Math.pow(radius, 2) * height;
  assertApprox(props.volume, expectedVolume, 0.01, 'Cylinder volume');

  console.log(`  Volume: ${props.volume.toFixed(2)} mm³ (expected: ${expectedVolume.toFixed(2)})`);
  console.log('  ✓ PASSED');
}

/**
 * Test: Cylinder surface area calculation
 * A = 2 * π * r * (r + h) - lateral surface plus two circular ends
 */
async function testCylinderSurfaceArea() {
  console.log('\n[Test] Cylinder Surface Area...');

  const radius = 5;
  const height = 20;
  const result = await kernel.createCylinder(radius, height);
  const props = await kernel.getMassProperties(result.id);

  // Total surface = 2 * end caps + lateral surface
  const endCapsArea = 2 * Math.PI * Math.pow(radius, 2);
  const lateralArea = 2 * Math.PI * radius * height;
  const expectedArea = endCapsArea + lateralArea;

  assertApprox(props.surfaceArea, expectedArea, 0.01, 'Cylinder surface area');

  console.log(
    `  Surface Area: ${props.surfaceArea.toFixed(2)} mm² (expected: ${expectedArea.toFixed(2)})`
  );
  console.log('  ✓ PASSED');
}

/**
 * Test: Center of gravity for centered box
 * A centered box at origin should have COG at origin
 */
async function testBoxCenterOfGravity() {
  console.log('\n[Test] Box Center of Gravity...');

  const result = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
  const props = await kernel.getMassProperties(result.id);

  const cog = props.centerOfGravity;

  // COG should be at the geometric center (0, 0, 0) for a centered box
  assertApprox(cog.x, 0, 0.001, 'COG X');
  assertApprox(cog.y, 0, 0.001, 'COG Y');
  assertApprox(cog.z, 0, 0.001, 'COG Z');

  console.log(`  COG: (${cog.x.toFixed(4)}, ${cog.y.toFixed(4)}, ${cog.z.toFixed(4)})`);
  console.log('  ✓ PASSED');
}

/**
 * Test: Center of gravity for off-center box
 */
async function testBoxCenterOfGravityOffCenter() {
  console.log('\n[Test] Box Center of Gravity (Off-Center)...');

  const center = { x: 50, y: 30, z: 20 };
  const result = await kernel.createBox(10, 10, 10, center);
  const props = await kernel.getMassProperties(result.id);

  const cog = props.centerOfGravity;

  // COG should be at the specified center
  assertApprox(cog.x, center.x, 0.001, 'COG X');
  assertApprox(cog.y, center.y, 0.001, 'COG Y');
  assertApprox(cog.z, center.z, 0.001, 'COG Z');

  console.log(`  COG: (${cog.x.toFixed(4)}, ${cog.y.toFixed(4)}, ${cog.z.toFixed(4)})`);
  console.log(`  Expected: (${center.x}, ${center.y}, ${center.z})`);
  console.log('  ✓ PASSED');
}

/**
 * Test: Mass calculation with density
 * Mass = Volume * Density
 */
async function testMassWithDensity() {
  console.log('\n[Test] Mass with Density...');

  // Create a 10x10x10 box (1000 mm³ = 1 cm³)
  const result = await kernel.createBox(10, 10, 10);

  // Steel density: 7.85 g/cm³
  const steelDensity = 7.85;
  const props = await kernel.getMassProperties(result.id, steelDensity);

  // Volume = 1000 mm³ = 1 cm³
  // Mass = 1 cm³ * 7.85 g/cm³ = 7.85 g
  const expectedMass = 1 * steelDensity;

  assertApprox(props.mass, expectedMass, 0.01, 'Mass with steel density');

  console.log(`  Volume: ${props.volumeCm3.toFixed(4)} cm³`);
  console.log(`  Density: ${props.density} g/cm³`);
  console.log(`  Mass: ${props.mass.toFixed(4)} g (expected: ${expectedMass} g)`);
  console.log('  ✓ PASSED');
}

/**
 * Test: Bounding box dimensions
 */
async function testBoundingBoxDimensions() {
  console.log('\n[Test] Bounding Box Dimensions...');

  const width = 20,
    height = 30,
    depth = 40;
  const result = await kernel.createBox(width, height, depth);
  const props = await kernel.getMassProperties(result.id);

  const bbox = props.boundingBox;

  assertApprox(bbox.dimensions.x, width, 0.001, 'BBox width');
  assertApprox(bbox.dimensions.y, height, 0.001, 'BBox height');
  assertApprox(bbox.dimensions.z, depth, 0.001, 'BBox depth');

  console.log(
    `  Dimensions: ${bbox.dimensions.x.toFixed(2)} x ${bbox.dimensions.y.toFixed(2)} x ${bbox.dimensions.z.toFixed(2)} mm`
  );
  console.log('  ✓ PASSED');
}

/**
 * Test: Moments of inertia for a box
 * For a rectangular box centered at origin:
 * Ixx = (1/12) * V * (h² + d²)
 * Iyy = (1/12) * V * (w² + d²)
 * Izz = (1/12) * V * (w² + h²)
 */
async function testBoxMomentsOfInertia() {
  console.log('\n[Test] Box Moments of Inertia...');

  const w = 10,
    h = 10,
    d = 10;
  const result = await kernel.createBox(w, h, d);
  const props = await kernel.getMassProperties(result.id);

  const moi = props.momentsOfInertia;

  // Note: These are volume-based moments (not mass-based)
  // For a cube centered at origin, all diagonal moments should be equal
  // Ixx = Iyy = Izz for a symmetric cube
  assertApprox(moi.Ixx, moi.Iyy, 0.01, 'Cube Ixx ≈ Iyy');
  assertApprox(moi.Iyy, moi.Izz, 0.01, 'Cube Iyy ≈ Izz');

  console.log(`  Ixx: ${moi.Ixx.toFixed(2)}`);
  console.log(`  Iyy: ${moi.Iyy.toFixed(2)}`);
  console.log(`  Izz: ${moi.Izz.toFixed(2)}`);
  console.log('  ✓ PASSED');
}

/**
 * Test: Cone volume calculation
 * V = (1/3) * π * r² * h for a pointed cone (radius2 = 0)
 */
async function testConeVolume() {
  console.log('\n[Test] Cone Volume...');

  const radius1 = 10; // base radius
  const radius2 = 0; // tip (pointed)
  const height = 20;

  const result = await kernel.createCone(radius1, radius2, height);
  const props = await kernel.getMassProperties(result.id);

  const expectedVolume = (1 / 3) * Math.PI * Math.pow(radius1, 2) * height;
  assertApprox(props.volume, expectedVolume, 0.01, 'Cone volume');

  console.log(`  Volume: ${props.volume.toFixed(2)} mm³ (expected: ${expectedVolume.toFixed(2)})`);
  console.log('  ✓ PASSED');
}

/**
 * Test: Truncated cone (frustum) volume calculation
 * V = (1/3) * π * h * (r1² + r1*r2 + r2²)
 */
async function testFrustumVolume() {
  console.log('\n[Test] Frustum (Truncated Cone) Volume...');

  const radius1 = 10; // base radius
  const radius2 = 5; // top radius
  const height = 20;

  const result = await kernel.createCone(radius1, radius2, height);
  const props = await kernel.getMassProperties(result.id);

  const expectedVolume =
    (1 / 3) * Math.PI * height * (Math.pow(radius1, 2) + radius1 * radius2 + Math.pow(radius2, 2));

  assertApprox(props.volume, expectedVolume, 0.01, 'Frustum volume');

  console.log(`  Volume: ${props.volume.toFixed(2)} mm³ (expected: ${expectedVolume.toFixed(2)})`);
  console.log('  ✓ PASSED');
}

/**
 * Test: Different densities for common materials
 */
async function testMaterialDensities() {
  console.log('\n[Test] Material Density Calculations...');

  // 1 cm³ cube (10x10x10 mm)
  const result = await kernel.createBox(10, 10, 10);

  const materials = [
    { name: 'Water/Plastic', density: 1.0, expectedMass: 1.0 },
    { name: 'Aluminum', density: 2.7, expectedMass: 2.7 },
    { name: 'Steel', density: 7.85, expectedMass: 7.85 },
    { name: 'Copper', density: 8.96, expectedMass: 8.96 },
    { name: 'Gold', density: 19.3, expectedMass: 19.3 },
  ];

  for (const mat of materials) {
    const props = await kernel.getMassProperties(result.id, mat.density);
    assertApprox(props.mass, mat.expectedMass, 0.01, `${mat.name} mass`);
    console.log(`  ${mat.name} (ρ=${mat.density}): ${props.mass.toFixed(3)} g`);
  }

  console.log('  ✓ PASSED');
}

/**
 * Test: Volume units conversion
 */
async function testVolumeUnitsConversion() {
  console.log('\n[Test] Volume Units Conversion...');

  // 10x10x10 mm = 1000 mm³ = 1 cm³
  const result = await kernel.createBox(10, 10, 10);
  const props = await kernel.getMassProperties(result.id);

  assertApprox(props.volume, 1000, 0.001, 'Volume in mm³');
  assertApprox(props.volumeCm3, 1, 0.001, 'Volume in cm³');

  console.log(`  Volume: ${props.volume} mm³ = ${props.volumeCm3} cm³`);
  console.log('  ✓ PASSED');
}

/**
 * Test: Surface area units conversion
 */
async function testSurfaceAreaUnitsConversion() {
  console.log('\n[Test] Surface Area Units Conversion...');

  // 10x10x10 box: 6 faces * 100 mm² = 600 mm² = 6 cm²
  const result = await kernel.createBox(10, 10, 10);
  const props = await kernel.getMassProperties(result.id);

  assertApprox(props.surfaceArea, 600, 0.01, 'Surface area in mm²');
  assertApprox(props.surfaceAreaCm2, 6, 0.01, 'Surface area in cm²');

  console.log(`  Surface Area: ${props.surfaceArea} mm² = ${props.surfaceAreaCm2} cm²`);
  console.log('  ✓ PASSED');
}

// ==================== Test Runner ====================

async function runAllTests() {
  const tests = [
    testBoxVolume,
    testBoxSurfaceArea,
    testSphereVolume,
    testSphereSurfaceArea,
    testCylinderVolume,
    testCylinderSurfaceArea,
    testBoxCenterOfGravity,
    testBoxCenterOfGravityOffCenter,
    testMassWithDensity,
    testBoundingBoxDimensions,
    testBoxMomentsOfInertia,
    testConeVolume,
    testFrustumVolume,
    testMaterialDensities,
    testVolumeUnitsConversion,
    testSurfaceAreaUnitsConversion,
  ];

  let passed = 0;
  let failed = 0;

  try {
    await initKernel();
  } catch (error) {
    console.error('[Test] Failed to initialize kernel:', error);
    return;
  }

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      console.error(`\n[Test] FAILED: ${test.name}`);
      console.error(`  Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed`);
  }
}

// Export for external test runners
export { runAllTests, initKernel };

// Auto-run if in browser/worker context
if (typeof self !== 'undefined' && typeof WorkerGlobalScope === 'undefined') {
  // Main thread in browser
  runAllTests().catch(console.error);
}
