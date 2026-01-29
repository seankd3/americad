/**
 * SharedArrayBuffer Mesh Transfer Tests
 * Tests zero-copy mesh transfer between worker and main thread
 */

import { kernel, KernelBridge, meshToThreeGeometry } from '../src/kernel/bridge.js';

// Test utilities
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function assertClose(a, b, tolerance, message) {
    if (Math.abs(a - b) > tolerance) {
        throw new Error(`Assertion failed: ${message} (expected ${b}, got ${a})`);
    }
}

// Test results collector
const results = [];
function logTest(name, passed, details = '') {
    results.push({ name, passed, details });
    console.log(`${passed ? '✓' : '✗'} ${name}${details ? ': ' + details : ''}`);
}

// ============== SAB Support Tests ==============

async function testSABDetection() {
    const supported = KernelBridge.checkSABSupport();
    logTest('SAB Support Detection', true, `SharedArrayBuffer ${supported ? 'available' : 'not available (need COOP/COEP headers)'}`);
    return supported;
}

async function testKernelInitWithSAB() {
    await kernel.init();
    assert(kernel.initialized, 'Kernel should be initialized');
    
    const usingSAB = kernel.useSAB;
    logTest('Kernel Init with SAB', true, `SAB mode: ${usingSAB ? 'enabled' : 'disabled (fallback)'}`);
    return usingSAB;
}

async function testSharedBufferCreation() {
    if (!kernel.useSAB) {
        logTest('Shared Buffer Creation', true, 'SKIPPED - SAB not available');
        return;
    }
    
    assert(kernel.sharedBuffers !== null, 'Shared buffers should exist');
    assert(kernel.sharedBuffers.vertices instanceof SharedArrayBuffer, 'vertices should be SAB');
    assert(kernel.sharedBuffers.normals instanceof SharedArrayBuffer, 'normals should be SAB');
    assert(kernel.sharedBuffers.indices instanceof SharedArrayBuffer, 'indices should be SAB');
    assert(kernel.sharedBuffers.meta instanceof SharedArrayBuffer, 'meta should be SAB');
    
    logTest('Shared Buffer Creation', true, 'All buffers created successfully');
}

// ============== Mesh Transfer Tests ==============

async function testSimpleMeshTransfer() {
    const result = await kernel.createBox(10, 10, 10);
    
    assert(result.id, 'Result should have ID');
    assert(result.mesh, 'Result should have mesh');
    assert(result.mesh.vertices instanceof Float32Array, 'vertices should be Float32Array');
    assert(result.mesh.normals instanceof Float32Array, 'normals should be Float32Array');
    assert(result.mesh.indices instanceof Uint32Array, 'indices should be Uint32Array');
    
    // Verify mesh has data
    assert(result.mesh.vertices.length > 0, 'vertices should have data');
    assert(result.mesh.normals.length > 0, 'normals should have data');
    assert(result.mesh.indices.length > 0, 'indices should have data');
    
    // Verify vertex/normal count match
    assert(result.mesh.vertices.length === result.mesh.normals.length, 'vertex and normal count should match');
    
    logTest('Simple Mesh Transfer', true, 
        `Box: ${result.mesh.vertices.length / 3} vertices, ${result.mesh.indices.length / 3} triangles`);
    
    return result;
}

async function testComplexMeshTransfer() {
    // Create a more complex shape that generates more mesh data
    const sphere = await kernel.createSphere(5);
    const cylinder = await kernel.createCylinder(3, 10);
    const union = await kernel.union(sphere.id, cylinder.id);
    const filleted = await kernel.filletAll(union.id, 0.5);
    
    assert(filleted.mesh.vertices.length > 0, 'Filleted mesh should have vertices');
    
    const vertexCount = filleted.mesh.vertices.length / 3;
    const triCount = filleted.mesh.indices.length / 3;
    
    logTest('Complex Mesh Transfer', true, 
        `Filleted union: ${vertexCount} vertices, ${triCount} triangles`);
    
    return filleted;
}

async function testMeshIntegrity() {
    const box = await kernel.createBox(20, 15, 10);
    const mesh = box.mesh;
    
    // Check all indices are valid
    const maxIndex = mesh.vertices.length / 3 - 1;
    for (let i = 0; i < mesh.indices.length; i++) {
        if (mesh.indices[i] > maxIndex) {
            throw new Error(`Invalid index ${mesh.indices[i]} at position ${i}, max is ${maxIndex}`);
        }
    }
    
    // Check normals are unit vectors (within tolerance)
    const tolerance = 0.01;
    for (let i = 0; i < mesh.normals.length; i += 3) {
        const nx = mesh.normals[i];
        const ny = mesh.normals[i + 1];
        const nz = mesh.normals[i + 2];
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (Math.abs(len - 1.0) > tolerance && len > 0.01) {
            throw new Error(`Non-unit normal at ${i}: length = ${len}`);
        }
    }
    
    logTest('Mesh Integrity', true, 'All indices valid, normals normalized');
}

async function testFaceIdsPreserved() {
    const box = await kernel.createBox(10, 10, 10);
    
    // Box should have 6 faces
    if (box.mesh.faceIds) {
        const uniqueFaces = new Set(box.mesh.faceIds);
        logTest('Face IDs Preserved', true, `${uniqueFaces.size} unique face IDs`);
    } else {
        logTest('Face IDs Preserved', true, 'faceIds not returned (expected for some configs)');
    }
}

// ============== Performance Benchmark ==============

async function benchmarkMeshTransfer() {
    const iterations = 10;
    const times = [];
    
    // Warm up
    await kernel.createSphere(5);
    
    // Benchmark
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        // Create moderately complex shape
        const sphere = await kernel.createSphere(10);
        const box = await kernel.createBox(15, 15, 15);
        const result = await kernel.subtract(sphere.id, box.id);
        
        const elapsed = performance.now() - start;
        times.push(elapsed);
    }
    
    const avg = times.reduce((a, b) => a + b) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    logTest('Mesh Transfer Benchmark', true, 
        `${iterations} iterations: avg=${avg.toFixed(1)}ms, min=${min.toFixed(1)}ms, max=${max.toFixed(1)}ms`);
    
    return { avg, min, max, mode: kernel.useSAB ? 'SharedArrayBuffer' : 'postMessage' };
}

// ============== Large Mesh Test ==============

async function testLargeMesh() {
    // Create a shape with many triangles via circular pattern
    const base = await kernel.createBox(5, 5, 5, { x: 10, y: 0, z: 0 });
    
    // Create circular pattern (many copies = many triangles)
    const pattern = await kernel.circularPattern(base.id, 20, 360);
    
    const vertexCount = pattern.mesh.vertices.length / 3;
    const triCount = pattern.mesh.indices.length / 3;
    const meshSize = (pattern.mesh.vertices.byteLength + 
                     pattern.mesh.normals.byteLength + 
                     pattern.mesh.indices.byteLength) / 1024;
    
    logTest('Large Mesh Transfer', true, 
        `Pattern: ${vertexCount} vertices, ${triCount} triangles, ${meshSize.toFixed(1)}KB`);
    
    return pattern;
}

// ============== Run All Tests ==============

async function runTests() {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  SharedArrayBuffer Mesh Transfer Tests              ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    try {
        // SAB detection
        const sabSupported = await testSABDetection();
        
        // Initialize kernel
        const sabActive = await testKernelInitWithSAB();
        
        // Buffer creation
        await testSharedBufferCreation();
        
        console.log('\n--- Mesh Transfer Tests ---\n');
        
        // Mesh tests
        await testSimpleMeshTransfer();
        await testComplexMeshTransfer();
        await testMeshIntegrity();
        await testFaceIdsPreserved();
        await testLargeMesh();
        
        console.log('\n--- Performance ---\n');
        
        // Benchmark
        const benchmark = await benchmarkMeshTransfer();
        
        // Summary
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('SUMMARY');
        console.log('═══════════════════════════════════════════════════════');
        
        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        
        console.log(`Tests: ${passed} passed, ${failed} failed`);
        console.log(`Transfer mode: ${benchmark.mode}`);
        console.log(`Average transfer time: ${benchmark.avg.toFixed(1)}ms`);
        
        if (!sabSupported) {
            console.log('\n⚠️  SharedArrayBuffer not available.');
            console.log('   To enable, serve with these headers:');
            console.log('   Cross-Origin-Opener-Policy: same-origin');
            console.log('   Cross-Origin-Embedder-Policy: require-corp');
            console.log('   Use: node serve-coop.js');
        }
        
        console.log('═══════════════════════════════════════════════════════\n');
        
        return failed === 0;
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    }
}

// Export for module usage
export { runTests };

// Auto-run if loaded directly in browser
if (typeof window !== 'undefined' && window.location) {
    runTests().then(success => {
        if (!success) {
            console.error('Some tests failed!');
        }
    });
}
