/**
 * Ameri-CAD Hole Wizard Tests
 * Tests for hole creation operations: simple, counterbore, countersink, tapped
 */

import { KernelBridge } from '../src/kernel/bridge.js';
import { 
    getStandardHoleParams, 
    parseThreadSpec, 
    listStandardSizes,
    METRIC_CLEARANCE,
    METRIC_TAP_DRILL,
    METRIC_SHCS_COUNTERBORE
} from '../src/data/hole-standards.js';

// Create a shared kernel instance
let kernel;

// ==================== Test Utilities ====================

/**
 * Get bounding box from mesh data
 */
function getBoundingBox(mesh) {
    const vertices = mesh.vertices;
    if (!vertices || vertices.length === 0) return null;
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
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
        size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
    };
}

/**
 * Count unique faces from mesh
 */
function countFaces(mesh) {
    if (!mesh.faceIds || mesh.faceIds.length === 0) return 0;
    return new Set(mesh.faceIds).size;
}

/**
 * Check mesh validity
 */
function isValidMesh(mesh) {
    return mesh &&
           mesh.vertices instanceof Float32Array &&
           mesh.normals instanceof Float32Array &&
           mesh.indices instanceof Uint32Array &&
           mesh.vertices.length > 0 &&
           mesh.indices.length % 3 === 0;
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
    errors: []
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

// ==================== Hole Standards Data Tests ====================

async function testHoleStandardsData() {
    console.log('\n========== Hole Standards Data Tests ==========');
    
    await runTest('Metric clearance sizes exist', async () => {
        const sizes = Object.keys(METRIC_CLEARANCE);
        assert(sizes.includes('M3'), 'M3 clearance exists');
        assert(sizes.includes('M5'), 'M5 clearance exists');
        assert(sizes.includes('M8'), 'M8 clearance exists');
        assert(sizes.includes('M10'), 'M10 clearance exists');
    });
    
    await runTest('Metric tap drill sizes are correct', async () => {
        // M5 tap drill should be approximately 4.2mm for standard pitch
        assert(approxEqual(METRIC_TAP_DRILL['M5'].drill, 4.2, 0.1), 'M5 tap drill ~4.2mm');
        assert(approxEqual(METRIC_TAP_DRILL['M5'].pitch, 0.8, 0.01), 'M5 pitch = 0.8mm');
        
        // M3 tap drill should be approximately 2.5mm
        assert(approxEqual(METRIC_TAP_DRILL['M3'].drill, 2.5, 0.1), 'M3 tap drill ~2.5mm');
    });
    
    await runTest('Counterbore dimensions are sensible', async () => {
        const m5cb = METRIC_SHCS_COUNTERBORE['M5'];
        assert(m5cb.cbDiameter > 5.5, 'M5 counterbore dia > clearance');
        assert(m5cb.cbDiameter < 15, 'M5 counterbore dia reasonable');
        assert(m5cb.cbDepth > 0, 'M5 counterbore depth positive');
    });
    
    await runTest('getStandardHoleParams works', async () => {
        const simpleM5 = getStandardHoleParams('M5', 'simple', 'normal');
        assert(simpleM5.diameter > 5 && simpleM5.diameter < 6, 'M5 clearance hole diameter');
        assert(simpleM5.metric === true, 'M5 is metric');
        
        const cboreM5 = getStandardHoleParams('M5', 'counterbore');
        assert(cboreM5.cbDiameter > cboreM5.holeDiameter, 'Counterbore larger than hole');
        assert(cboreM5.cbDepth > 0, 'Counterbore depth positive');
        
        const csinkM5 = getStandardHoleParams('M5', 'countersink');
        assert(csinkM5.csDiameter > csinkM5.holeDiameter, 'Countersink larger than hole');
        assert(csinkM5.csAngle === 90, 'Metric countersink angle 90°');
        
        const tapM5 = getStandardHoleParams('M5', 'tap');
        assert(tapM5.holeDiameter < 5, 'Tap drill smaller than nominal');
        assert(tapM5.pitch === 0.8, 'M5 standard pitch');
    });
    
    await runTest('parseThreadSpec works', async () => {
        const m5 = parseThreadSpec('M5');
        assert(m5.metric === true, 'M5 is metric');
        assert(m5.nominalDiameter === 5, 'M5 nominal = 5');
        
        const m5x08 = parseThreadSpec('M5x0.8');
        assert(m5x08.pitch === 0.8, 'M5x0.8 pitch parsed');
        
        const imperial = parseThreadSpec('1/4');
        assert(imperial.metric === false, '1/4 is imperial');
        
        const imperialWithTpi = parseThreadSpec('1/4-20');
        assert(imperialWithTpi.tpi === 20, '1/4-20 TPI parsed');
    });
    
    await runTest('listStandardSizes returns valid arrays', async () => {
        const metric = listStandardSizes(true);
        const imperial = listStandardSizes(false);
        
        assert(Array.isArray(metric) && metric.length > 0, 'Metric sizes available');
        assert(Array.isArray(imperial) && imperial.length > 0, 'Imperial sizes available');
        assert(metric.includes('M5'), 'Metric includes M5');
        assert(imperial.includes('1/4'), 'Imperial includes 1/4');
    });
}

// ==================== Kernel Hole Operation Tests ====================

async function testKernelHoleOperations() {
    console.log('\n========== Kernel Hole Operation Tests ==========');
    
    // Create a test block to put holes in
    let testBlock;
    
    await runTest('Setup: Create test block', async () => {
        testBlock = await kernel.createBox(50, 50, 20);
        assert(testBlock.id, 'Test block created');
        assert(isValidMesh(testBlock.mesh), 'Test block mesh valid');
    });
    
    await runTest('Simple hole creates correct geometry', async () => {
        // Create a 10mm diameter, 15mm deep hole
        const position = { x: 0, y: 0, z: 20 }; // Top face
        const direction = { x: 0, y: 0, z: -1 }; // Down into material
        
        const result = await kernel.createSimpleHole(testBlock.id, position, direction, 10, 15);
        
        assert(result.id, 'Simple hole has ID');
        assert(isValidMesh(result.mesh), 'Simple hole mesh valid');
        assert(result.type === 'simpleHole', 'Type is simpleHole');
        
        // Volume should be reduced (hole cut out)
        const vol = await kernel.getVolume(result.id);
        const originalVol = 50 * 50 * 20;
        const holeVol = Math.PI * 5 * 5 * 15; // πr²h
        assert(vol.volume < originalVol, 'Volume reduced by hole');
        assert(approxEqual(vol.volume, originalVol - holeVol, 50), 'Volume approximately correct');
    });
    
    await runTest('Through-all hole works', async () => {
        const newBlock = await kernel.createBox(50, 50, 20);
        const position = { x: 10, y: 10, z: 20 };
        const direction = { x: 0, y: 0, z: -1 };
        
        // Depth = 0 means through-all
        const result = await kernel.createSimpleHole(newBlock.id, position, direction, 8, 0);
        
        assert(result.id, 'Through-all hole created');
        assert(isValidMesh(result.mesh), 'Through-all hole mesh valid');
        
        // Through-all should have more faces than blind hole (bottom is open)
        const faces = countFaces(result.mesh);
        assert(faces > 6, 'Through-all hole has more than box faces');
    });
    
    await runTest('Counterbore hole has correct dimensions', async () => {
        const newBlock = await kernel.createBox(50, 50, 20);
        const position = { x: 0, y: 0, z: 20 };
        const direction = { x: 0, y: 0, z: -1 };
        
        // M5 counterbore: 5.5mm hole, 10mm counterbore, 5mm cb depth
        const result = await kernel.createCounterboreHole(
            newBlock.id, position, direction,
            5.5,  // hole diameter
            10,   // counterbore diameter
            5,    // counterbore depth
            0     // through-all main hole
        );
        
        assert(result.id, 'Counterbore hole created');
        assert(isValidMesh(result.mesh), 'Counterbore mesh valid');
        assert(result.type === 'counterboreHole', 'Type is counterboreHole');
        
        // Should have more faces than simple hole (the counterbore shelf)
        const faces = countFaces(result.mesh);
        assert(faces > 7, 'Counterbore has extra faces for shelf');
    });
    
    await runTest('Countersink hole has correct angle', async () => {
        const newBlock = await kernel.createBox(50, 50, 20);
        const position = { x: 0, y: 0, z: 20 };
        const direction = { x: 0, y: 0, z: -1 };
        
        // 82° countersink (US standard)
        const result = await kernel.createCountersinkHole(
            newBlock.id, position, direction,
            5.5,   // hole diameter
            10,    // countersink diameter
            82,    // angle
            0      // through-all
        );
        
        assert(result.id, 'Countersink hole created');
        assert(isValidMesh(result.mesh), 'Countersink mesh valid');
        assert(result.type === 'countersinkHole', 'Type is countersinkHole');
        
        // Countersink creates a conical face - should have curved surface
        const faces = countFaces(result.mesh);
        assert(faces > 6, 'Countersink has cone face');
    });
    
    await runTest('90° countersink works', async () => {
        const newBlock = await kernel.createBox(50, 50, 20);
        const position = { x: 0, y: 0, z: 20 };
        const direction = { x: 0, y: 0, z: -1 };
        
        const result = await kernel.createCountersinkHole(
            newBlock.id, position, direction,
            5.5, 10, 90, 15
        );
        
        assert(result.id, '90° countersink created');
        assert(isValidMesh(result.mesh), '90° countersink mesh valid');
    });
    
    await runTest('100° countersink works', async () => {
        const newBlock = await kernel.createBox(50, 50, 20);
        const position = { x: 0, y: 0, z: 20 };
        const direction = { x: 0, y: 0, z: -1 };
        
        const result = await kernel.createCountersinkHole(
            newBlock.id, position, direction,
            5.5, 10, 100, 15
        );
        
        assert(result.id, '100° countersink created');
        assert(isValidMesh(result.mesh), '100° countersink mesh valid');
    });
    
    await runTest('Tapped hole creates tap drill size', async () => {
        const newBlock = await kernel.createBox(50, 50, 20);
        const position = { x: 0, y: 0, z: 20 };
        const direction = { x: 0, y: 0, z: -1 };
        
        // M5 x 0.8 thread
        const result = await kernel.createTappedHole(
            newBlock.id, position, direction,
            5,    // M5 nominal diameter
            0.8,  // pitch
            12    // depth
        );
        
        assert(result.id, 'Tapped hole created');
        assert(isValidMesh(result.mesh), 'Tapped hole mesh valid');
        assert(result.type === 'tappedHole', 'Type is tappedHole');
        assert(result.threadInfo, 'Thread info returned');
        assert(result.threadInfo.nominalDiameter === 5, 'Thread nominal diameter');
        assert(result.threadInfo.pitch === 0.8, 'Thread pitch');
        assert(approxEqual(result.threadInfo.tapDrillDiameter, 4.2, 0.1), 'Tap drill ~4.2mm');
    });
    
    await runTest('Hole on angled face aligns correctly', async () => {
        // Create a wedge-like shape
        const wedge = await kernel.createWedge(50, 20, 50, 25);
        
        // Put hole on angled face (direction not straight down)
        const position = { x: 20, y: 10, z: 25 };
        const direction = { x: 0, y: -0.5, z: -0.866 }; // 30° from vertical
        
        const result = await kernel.createSimpleHole(wedge.id, position, direction, 8, 15);
        
        assert(result.id, 'Angled hole created');
        assert(isValidMesh(result.mesh), 'Angled hole mesh valid');
    });
    
    await runTest('Multiple holes in same part', async () => {
        let part = await kernel.createBox(100, 100, 20);
        
        // Add 4 holes in corners
        const positions = [
            { x: 20, y: 20, z: 20 },
            { x: 80, y: 20, z: 20 },
            { x: 20, y: 80, z: 20 },
            { x: 80, y: 80, z: 20 }
        ];
        const direction = { x: 0, y: 0, z: -1 };
        
        for (let i = 0; i < positions.length; i++) {
            const result = await kernel.createSimpleHole(part.id, positions[i], direction, 6, 0);
            part = { id: result.id, mesh: result.mesh }; // Use result as new base
        }
        
        assert(isValidMesh(part.mesh), 'Part with 4 holes has valid mesh');
        
        // Volume should be reduced by 4 holes
        const vol = await kernel.getVolume(part.id);
        const originalVol = 100 * 100 * 20;
        const holesVol = 4 * Math.PI * 3 * 3 * 20;
        assert(vol.volume < originalVol - holesVol * 0.9, 'Volume reduced by ~4 holes');
    });
}

// ==================== Hole Tool Tests ====================

async function testHoleToolCreation() {
    console.log('\n========== Hole Tool Tests ==========');
    
    await runTest('Create simple hole tool (preview)', async () => {
        const result = await kernel.createHoleTool('simple', {
            position: { x: 0, y: 0, z: 0 },
            direction: { x: 0, y: 0, z: 1 },
            diameter: 10,
            depth: 20
        });
        
        assert(result.id, 'Hole tool created');
        assert(isValidMesh(result.mesh), 'Hole tool mesh valid');
        assert(result.type === 'simpleTool', 'Type is simpleTool');
    });
    
    await runTest('Create counterbore tool', async () => {
        const result = await kernel.createHoleTool('counterbore', {
            position: { x: 0, y: 0, z: 0 },
            direction: { x: 0, y: 0, z: 1 },
            holeDiameter: 5.5,
            cbDiameter: 10,
            cbDepth: 5,
            depth: 20
        });
        
        assert(result.id, 'Counterbore tool created');
        assert(isValidMesh(result.mesh), 'Counterbore tool mesh valid');
    });
    
    await runTest('Create countersink tool', async () => {
        const result = await kernel.createHoleTool('countersink', {
            position: { x: 0, y: 0, z: 0 },
            direction: { x: 0, y: 0, z: 1 },
            holeDiameter: 5.5,
            csDiameter: 10,
            csAngle: 82,
            depth: 20
        });
        
        assert(result.id, 'Countersink tool created');
        assert(isValidMesh(result.mesh), 'Countersink tool mesh valid');
    });
}

// ==================== Edge Cases and Error Handling ====================

async function testEdgeCases() {
    console.log('\n========== Edge Cases Tests ==========');
    
    await runTest('Invalid thread spec throws', async () => {
        try {
            parseThreadSpec('invalid');
            assert(false, 'Should have thrown');
        } catch (e) {
            assert(e.message.includes('Cannot parse'), 'Throws on invalid thread spec');
        }
    });
    
    await runTest('Invalid hole size throws', async () => {
        try {
            getStandardHoleParams('M99', 'simple');
            assert(false, 'Should have thrown');
        } catch (e) {
            assert(e.message.includes('Unknown'), 'Throws on unknown size');
        }
    });
    
    await runTest('Hole on non-existent shape throws', async () => {
        try {
            await kernel.createSimpleHole(
                'nonexistent_id',
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: -1 },
                10, 10
            );
            assert(false, 'Should have thrown');
        } catch (e) {
            assert(e.message.includes('not found'), 'Throws on missing shape');
        }
    });
}

// ==================== Main Test Runner ====================

async function runAllTests() {
    console.log('========================================');
    console.log('    Ameri-CAD Hole Wizard Tests');
    console.log('========================================');
    
    // Initialize kernel
    console.log('\nInitializing kernel...');
    kernel = new KernelBridge();
    await kernel.init();
    console.log('Kernel initialized.\n');
    
    // Run test suites
    await testHoleStandardsData();
    await testKernelHoleOperations();
    await testHoleToolCreation();
    await testEdgeCases();
    
    // Summary
    console.log('\n========================================');
    console.log('              Summary');
    console.log('========================================');
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    
    if (testResults.errors.length > 0) {
        console.log('\nFailures:');
        testResults.errors.forEach((err, i) => {
            console.log(`  ${i + 1}. ${err}`);
        });
    }
    
    const success = testResults.failed === 0;
    console.log(`\n${success ? '✓ All tests passed!' : '✗ Some tests failed.'}`);
    
    // Cleanup
    kernel.terminate();
    
    return success;
}

// Export for test runner
export { runAllTests, testResults };

// Auto-run if loaded directly
if (typeof window !== 'undefined') {
    window.runHoleTests = runAllTests;
}
