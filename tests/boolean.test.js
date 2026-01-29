/**
 * Ameri-CAD Boolean Operations Tests
 * Comprehensive tests for union, subtract, and intersect operations
 * 
 * These tests exercise the actual OpenCASCADE B-Rep kernel boolean operations.
 */

import { KernelBridge } from '../src/kernel/bridge.js';
import { 
    getBoundingBox, 
    countFaces, 
    isValidSolid, 
    hasValidNormals, 
    hasValidIndices 
} from './kernel-primitives.test.js';

// Create a shared kernel instance for all tests
let kernel;

// ==================== Test Utilities ====================

/**
 * Check if result has open edges (non-manifold)
 * A valid solid should have no open edges
 * @param {Object} mesh - Mesh data
 * @returns {boolean} true if topology appears valid (no obvious defects)
 */
function hasValidTopology(mesh) {
    // Basic checks: must have vertices, normals, indices
    if (!mesh.vertices || mesh.vertices.length === 0) return false;
    if (!mesh.normals || mesh.normals.length === 0) return false;
    if (!mesh.indices || mesh.indices.length === 0) return false;
    
    // Check triangle count is valid (divisible by 3)
    if (mesh.indices.length % 3 !== 0) return false;
    
    // All indices should reference valid vertices
    const vertexCount = mesh.vertices.length / 3;
    for (let i = 0; i < mesh.indices.length; i++) {
        if (mesh.indices[i] >= vertexCount) return false;
    }
    
    return true;
}

/**
 * Calculate overlap volume of two boxes analytically
 * @param {Object} box1 - {center: {x,y,z}, size: {x,y,z}}
 * @param {Object} box2 - {center: {x,y,z}, size: {x,y,z}}
 * @returns {number} Overlap volume
 */
function calculateBoxOverlap(box1, box2) {
    // Calculate min/max for each box
    const min1 = {
        x: box1.center.x - box1.size.x / 2,
        y: box1.center.y - box1.size.y / 2,
        z: box1.center.z - box1.size.z / 2
    };
    const max1 = {
        x: box1.center.x + box1.size.x / 2,
        y: box1.center.y + box1.size.y / 2,
        z: box1.center.z + box1.size.z / 2
    };
    const min2 = {
        x: box2.center.x - box2.size.x / 2,
        y: box2.center.y - box2.size.y / 2,
        z: box2.center.z - box2.size.z / 2
    };
    const max2 = {
        x: box2.center.x + box2.size.x / 2,
        y: box2.center.y + box2.size.y / 2,
        z: box2.center.z + box2.size.z / 2
    };
    
    // Calculate overlap in each dimension
    const overlapX = Math.max(0, Math.min(max1.x, max2.x) - Math.max(min1.x, min2.x));
    const overlapY = Math.max(0, Math.min(max1.y, max2.y) - Math.max(min1.y, min2.y));
    const overlapZ = Math.max(0, Math.min(max1.z, max2.z) - Math.max(min1.z, min2.z));
    
    return overlapX * overlapY * overlapZ;
}

// ==================== Test Suite ====================

describe('Boolean Operations', function() {
    // Increase timeout for kernel operations
    this.timeout(60000);
    
    before(async function() {
        kernel = new KernelBridge();
        await kernel.init();
    });
    
    after(function() {
        if (kernel) {
            kernel.terminate();
        }
    });
    
    // ==================== Union Tests ====================
    
    describe('Union (Fuse)', function() {
        
        it('combines two overlapping boxes into single solid', async function() {
            // Two 10x10x10 boxes, offset by 5 in X (50% overlap)
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            const result = await kernel.union(box1.id, box2.id);
            
            expect(result.id).to.be.a('string');
            expect(result.mesh).to.exist;
            expect(result.mesh.vertices.length).to.be.greaterThan(0);
            
            // Result should be valid solid
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
        });
        
        it('produces correct volume (sum minus overlap)', async function() {
            // Two 10x10x10 boxes, offset by 5 in X
            // Volume each: 1000, Overlap: 5x10x10 = 500
            // Expected union: 1000 + 1000 - 500 = 1500
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            const result = await kernel.union(box1.id, box2.id);
            const { volume } = await kernel.getVolume(result.id);
            
            const expectedVolume = 1500;
            expect(volume).to.be.closeTo(expectedVolume, expectedVolume * 0.01);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('produces correct bounding box', async function() {
            // Two 10x10x10 boxes, offset by 5 in X
            // Union bbox: X from -5 to +10 = 15, Y from -5 to +5 = 10, Z from -5 to +5 = 10
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            const result = await kernel.union(box1.id, box2.id);
            const bbox = getBoundingBox(result.mesh);
            
            expect(bbox.size.x).to.be.closeTo(15, 0.5);
            expect(bbox.size.y).to.be.closeTo(10, 0.5);
            expect(bbox.size.z).to.be.closeTo(10, 0.5);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('works via unified boolean method with "union" type', async function() {
            const box1 = await kernel.createBox(10, 10, 10);
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            const result = await kernel.boolean(box1.id, box2.id, 'union');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('accepts "fuse" and "add" as aliases', async function() {
            const box1 = await kernel.createBox(5, 5, 5);
            const box2 = await kernel.createBox(5, 5, 5, { x: 2, y: 0, z: 0 });
            const box3 = await kernel.createBox(5, 5, 5, { x: 4, y: 0, z: 0 });
            
            // Test 'fuse' alias
            const resultFuse = await kernel.boolean(box1.id, box2.id, 'fuse');
            expect(resultFuse.id).to.be.a('string');
            
            // Test 'add' alias
            const resultAdd = await kernel.boolean(box2.id, box3.id, 'add');
            expect(resultAdd.id).to.be.a('string');
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(box3.id);
            await kernel.deleteShape(resultFuse.id);
            await kernel.deleteShape(resultAdd.id);
        });
    });
    
    // ==================== Subtract Tests ====================
    
    describe('Subtract (Cut/Difference)', function() {
        
        it('cuts one shape from another', async function() {
            // Large box minus smaller box = hollow shape
            const bigBox = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
            const smallBox = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            
            const result = await kernel.subtract(bigBox.id, smallBox.id);
            
            expect(result.id).to.be.a('string');
            expect(result.mesh).to.exist;
            
            // Result should be valid solid
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(bigBox.id);
            await kernel.deleteShape(smallBox.id);
            await kernel.deleteShape(result.id);
        });
        
        it('produces correct volume (decrease)', async function() {
            // 20x20x20 box minus centered 10x10x10 box
            // Volume: 8000 - 1000 = 7000
            const bigBox = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
            const smallBox = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            
            const result = await kernel.subtract(bigBox.id, smallBox.id);
            const { volume } = await kernel.getVolume(result.id);
            
            const expectedVolume = 7000;
            expect(volume).to.be.closeTo(expectedVolume, expectedVolume * 0.01);
            
            // Cleanup
            await kernel.deleteShape(bigBox.id);
            await kernel.deleteShape(smallBox.id);
            await kernel.deleteShape(result.id);
        });
        
        it('creates through-hole correctly', async function() {
            // Box with cylinder cut through
            const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
            const cylinder = await kernel.createCylinder(5, 30, { x: 0, y: 0, z: 0 }); // Taller than box
            
            const result = await kernel.subtract(box.id, cylinder.id);
            
            // Original box volume: 8000
            // Cylinder volume: π * 5² * 20 (only the part inside box matters) ≈ 1571
            // Expected: 8000 - 1571 ≈ 6429
            const { volume } = await kernel.getVolume(result.id);
            const cylinderVolumeInBox = Math.PI * 25 * 20;
            const expectedVolume = 8000 - cylinderVolumeInBox;
            
            expect(volume).to.be.closeTo(expectedVolume, expectedVolume * 0.02);
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(cylinder.id);
            await kernel.deleteShape(result.id);
        });
        
        it('creates partial cut (notch)', async function() {
            // Box with corner cut off
            const mainBox = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
            const cutBox = await kernel.createBox(10, 10, 10, { x: 10, y: 10, z: 10 });
            
            const result = await kernel.subtract(mainBox.id, cutBox.id);
            
            // Main box: 8000
            // Only 1/8 of cut box overlaps: 125
            // Expected: 8000 - 125 = 7875
            const { volume } = await kernel.getVolume(result.id);
            const overlapVolume = 5 * 5 * 5; // Only corner overlaps
            const expectedVolume = 8000 - overlapVolume;
            
            expect(volume).to.be.closeTo(expectedVolume, expectedVolume * 0.02);
            
            // Cleanup
            await kernel.deleteShape(mainBox.id);
            await kernel.deleteShape(cutBox.id);
            await kernel.deleteShape(result.id);
        });
        
        it('works via unified boolean method with "subtract" type', async function() {
            const box1 = await kernel.createBox(20, 20, 20);
            const box2 = await kernel.createBox(10, 10, 10);
            
            const result = await kernel.boolean(box1.id, box2.id, 'subtract');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('accepts "cut" and "difference" as aliases', async function() {
            const box1 = await kernel.createBox(15, 15, 15);
            const box2 = await kernel.createBox(5, 5, 5);
            const box3 = await kernel.createBox(5, 5, 5, { x: 3, y: 0, z: 0 });
            
            // Test 'cut' alias
            const resultCut = await kernel.boolean(box1.id, box2.id, 'cut');
            expect(resultCut.id).to.be.a('string');
            
            // Test 'difference' alias  
            const resultDiff = await kernel.boolean(box1.id, box3.id, 'difference');
            expect(resultDiff.id).to.be.a('string');
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(box3.id);
            await kernel.deleteShape(resultCut.id);
            await kernel.deleteShape(resultDiff.id);
        });
    });
    
    // ==================== Intersect Tests ====================
    
    describe('Intersect (Common)', function() {
        
        it('keeps only overlapping region', async function() {
            // Two overlapping boxes
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            const result = await kernel.intersect(box1.id, box2.id);
            
            expect(result.id).to.be.a('string');
            expect(result.mesh).to.exist;
            
            // Result should be valid solid
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('produces volume equal to overlap region only', async function() {
            // Two 10x10x10 boxes, offset by 5 in X
            // Overlap: 5x10x10 = 500
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            const result = await kernel.intersect(box1.id, box2.id);
            const { volume } = await kernel.getVolume(result.id);
            
            const expectedVolume = 500; // 5 * 10 * 10
            expect(volume).to.be.closeTo(expectedVolume, expectedVolume * 0.01);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('produces correct bounding box for overlap', async function() {
            // Two 10x10x10 boxes, offset by 5 in X
            // Intersection should be 5x10x10 centered at x=2.5
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            const result = await kernel.intersect(box1.id, box2.id);
            const bbox = getBoundingBox(result.mesh);
            
            expect(bbox.size.x).to.be.closeTo(5, 0.5);
            expect(bbox.size.y).to.be.closeTo(10, 0.5);
            expect(bbox.size.z).to.be.closeTo(10, 0.5);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('works via unified boolean method with "intersect" type', async function() {
            const box1 = await kernel.createBox(10, 10, 10);
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            const result = await kernel.boolean(box1.id, box2.id, 'intersect');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('accepts "common" as alias', async function() {
            const sphere1 = await kernel.createSphere(10, { x: 0, y: 0, z: 0 });
            const sphere2 = await kernel.createSphere(10, { x: 8, y: 0, z: 0 });
            
            const result = await kernel.boolean(sphere1.id, sphere2.id, 'common');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(sphere1.id);
            await kernel.deleteShape(sphere2.id);
            await kernel.deleteShape(result.id);
        });
    });
    
    // ==================== Non-Overlapping Shapes ====================
    
    describe('Non-overlapping Shapes', function() {
        
        it('union of non-overlapping creates compound (total volume preserved)', async function() {
            // Two boxes far apart
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 50, y: 0, z: 0 });
            
            const result = await kernel.union(box1.id, box2.id);
            const { volume } = await kernel.getVolume(result.id);
            
            // Total volume = 1000 + 1000 = 2000 (no overlap)
            expect(volume).to.be.closeTo(2000, 20);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('subtract of non-overlapping leaves original unchanged', async function() {
            // Two boxes far apart
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 50, y: 0, z: 0 });
            
            const { volume: originalVolume } = await kernel.getVolume(box1.id);
            const result = await kernel.subtract(box1.id, box2.id);
            const { volume: resultVolume } = await kernel.getVolume(result.id);
            
            // Volume should be unchanged
            expect(resultVolume).to.be.closeTo(originalVolume, 1);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('intersect of non-overlapping produces empty/null result', async function() {
            // Two boxes far apart
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 50, y: 0, z: 0 });
            
            try {
                const result = await kernel.intersect(box1.id, box2.id);
                
                // If result is returned, it should have zero or negligible volume
                const { volume } = await kernel.getVolume(result.id);
                expect(volume).to.be.closeTo(0, 0.001);
                
                await kernel.deleteShape(result.id);
            } catch (e) {
                // It's also valid for the kernel to throw an error for empty intersection
                expect(e.message).to.include('empty').or.include('null').or.include('no');
            }
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
        });
    });
    
    // ==================== Coincident Faces ====================
    
    describe('Coincident Faces (Edge Cases)', function() {
        
        it('handles touching faces (no overlap, faces aligned)', async function() {
            // Two boxes touching at a face
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 10, y: 0, z: 0 }); // Touching at x=5
            
            // Union should work
            const unionResult = await kernel.union(box1.id, box2.id);
            const { volume: unionVolume } = await kernel.getVolume(unionResult.id);
            expect(unionVolume).to.be.closeTo(2000, 20); // Two full boxes
            
            // Subtract should leave original (no overlap)
            const subtractResult = await kernel.subtract(box1.id, box2.id);
            const { volume: subtractVolume } = await kernel.getVolume(subtractResult.id);
            expect(subtractVolume).to.be.closeTo(1000, 10);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(unionResult.id);
            await kernel.deleteShape(subtractResult.id);
        });
        
        it('handles exactly coincident boxes', async function() {
            // Two identical boxes in same position
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            
            // Union of identical shapes = same shape
            const unionResult = await kernel.union(box1.id, box2.id);
            const { volume: unionVolume } = await kernel.getVolume(unionResult.id);
            expect(unionVolume).to.be.closeTo(1000, 10);
            
            // Intersect of identical shapes = same shape
            const intersectResult = await kernel.intersect(box1.id, box2.id);
            const { volume: intersectVolume } = await kernel.getVolume(intersectResult.id);
            expect(intersectVolume).to.be.closeTo(1000, 10);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(unionResult.id);
            await kernel.deleteShape(intersectResult.id);
        });
        
        it('handles partial face coincidence', async function() {
            // Box flush against part of another box's face
            const box1 = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 15, y: 0, z: 0 }); // Flush at x=10
            
            const result = await kernel.union(box1.id, box2.id);
            
            // Should be valid
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Volume = 8000 + 1000 = 9000 (no overlap, just touching)
            const { volume } = await kernel.getVolume(result.id);
            expect(volume).to.be.closeTo(9000, 100);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
    });
    
    // ==================== Topology Preservation ====================
    
    describe('Topology Preservation', function() {
        
        it('union result is valid solid with no open edges', async function() {
            const box1 = await kernel.createBox(10, 10, 10);
            const box2 = await kernel.createBox(8, 8, 8, { x: 3, y: 3, z: 3 });
            
            const result = await kernel.union(box1.id, box2.id);
            
            // Check valid solid
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Check mesh topology
            expect(hasValidTopology(result.mesh)).to.be.true;
            expect(hasValidNormals(result.mesh)).to.be.true;
            expect(hasValidIndices(result.mesh)).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('subtract result is valid solid with no open edges', async function() {
            const box1 = await kernel.createBox(20, 20, 20);
            const box2 = await kernel.createBox(10, 10, 25, { x: 0, y: 0, z: 0 }); // Through-cut
            
            const result = await kernel.subtract(box1.id, box2.id);
            
            // Check valid solid
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Check mesh topology
            expect(hasValidTopology(result.mesh)).to.be.true;
            expect(hasValidNormals(result.mesh)).to.be.true;
            expect(hasValidIndices(result.mesh)).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('intersect result is valid solid with no open edges', async function() {
            const sphere1 = await kernel.createSphere(10);
            const sphere2 = await kernel.createSphere(10, { x: 8, y: 0, z: 0 });
            
            const result = await kernel.intersect(sphere1.id, sphere2.id);
            
            // Check valid solid
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Check mesh topology
            expect(hasValidTopology(result.mesh)).to.be.true;
            expect(hasValidNormals(result.mesh)).to.be.true;
            expect(hasValidIndices(result.mesh)).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(sphere1.id);
            await kernel.deleteShape(sphere2.id);
            await kernel.deleteShape(result.id);
        });
        
        it('complex boolean result has valid face count', async function() {
            // Box with cylindrical hole
            const box = await kernel.createBox(20, 20, 20);
            const cylinder = await kernel.createCylinder(5, 30);
            
            const result = await kernel.subtract(box.id, cylinder.id);
            const faceCount = countFaces(result.mesh);
            
            // Should have original 6 box faces minus 2 (top/bottom pierced) plus 1 cylindrical surface
            // Actual count depends on kernel implementation, but should be > 0
            expect(faceCount).to.be.greaterThan(0);
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(cylinder.id);
            await kernel.deleteShape(result.id);
        });
    });
    
    // ==================== Mixed Primitive Types ====================
    
    describe('Mixed Primitive Types', function() {
        
        it('box + sphere union', async function() {
            const box = await kernel.createBox(20, 20, 20);
            const sphere = await kernel.createSphere(15); // Overlaps with box
            
            const result = await kernel.union(box.id, sphere.id);
            
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Volume should be more than either alone
            const { volume: boxVol } = await kernel.getVolume(box.id);
            const { volume: sphereVol } = await kernel.getVolume(sphere.id);
            const { volume: resultVol } = await kernel.getVolume(result.id);
            
            expect(resultVol).to.be.greaterThan(boxVol);
            expect(resultVol).to.be.lessThan(boxVol + sphereVol); // Less due to overlap
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(sphere.id);
            await kernel.deleteShape(result.id);
        });
        
        it('cylinder - cylinder difference (pipe)', async function() {
            // Outer cylinder minus inner = hollow pipe
            const outer = await kernel.createCylinder(10, 30);
            const inner = await kernel.createCylinder(8, 35, { x: 0, y: 0, z: -2.5 }); // Slightly longer
            
            const result = await kernel.subtract(outer.id, inner.id);
            
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Volume = π * (10² - 8²) * 30 = π * 36 * 30 ≈ 3393
            const { volume } = await kernel.getVolume(result.id);
            const expectedVolume = Math.PI * (100 - 64) * 30;
            expect(volume).to.be.closeTo(expectedVolume, expectedVolume * 0.02);
            
            // Cleanup
            await kernel.deleteShape(outer.id);
            await kernel.deleteShape(inner.id);
            await kernel.deleteShape(result.id);
        });
        
        it('sphere ∩ box intersection', async function() {
            // Sphere intersected by box = spherical cap or segment
            const sphere = await kernel.createSphere(10);
            const box = await kernel.createBox(30, 30, 10, { x: 0, y: 0, z: 5 }); // Top half of sphere
            
            const result = await kernel.intersect(sphere.id, box.id);
            
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Volume should be roughly half a sphere
            const { volume } = await kernel.getVolume(result.id);
            const halfSphereVol = (2/3) * Math.PI * 1000; // Half of 4/3 π r³
            expect(volume).to.be.closeTo(halfSphereVol, halfSphereVol * 0.1);
            
            // Cleanup
            await kernel.deleteShape(sphere.id);
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
        
        it('cone - sphere (sculpted shape)', async function() {
            const cone = await kernel.createCone(15, 0, 30);
            const sphere = await kernel.createSphere(10, { x: 0, y: 0, z: 20 }); // Near tip
            
            const result = await kernel.subtract(cone.id, sphere.id);
            
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Should have reduced volume
            const { volume: coneVol } = await kernel.getVolume(cone.id);
            const { volume: resultVol } = await kernel.getVolume(result.id);
            expect(resultVol).to.be.lessThan(coneVol);
            
            // Cleanup
            await kernel.deleteShape(cone.id);
            await kernel.deleteShape(sphere.id);
            await kernel.deleteShape(result.id);
        });
        
        it('torus + box union', async function() {
            const torus = await kernel.createTorus(15, 5);
            const box = await kernel.createBox(10, 10, 20, { x: 15, y: 0, z: 0 });
            
            const result = await kernel.union(torus.id, box.id);
            
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(torus.id);
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
    });
    
    // ==================== Sequential Booleans ====================
    
    describe('Sequential Booleans', function() {
        
        it('A - B - C works correctly', async function() {
            // Start with large box, subtract two smaller boxes
            const A = await kernel.createBox(30, 30, 30);
            const B = await kernel.createBox(10, 10, 35, { x: -8, y: 0, z: 0 }); // Left hole
            const C = await kernel.createBox(10, 10, 35, { x: 8, y: 0, z: 0 });  // Right hole
            
            // A - B
            const AB = await kernel.subtract(A.id, B.id);
            // (A - B) - C
            const ABC = await kernel.subtract(AB.id, C.id);
            
            const valid = await isValidSolid(kernel, ABC.id);
            expect(valid).to.be.true;
            
            // Volume = 27000 - 3000 - 3000 = 21000 (approximately)
            // Note: Actual overlap of B and C with A may vary
            const { volume } = await kernel.getVolume(ABC.id);
            expect(volume).to.be.greaterThan(20000);
            expect(volume).to.be.lessThan(27000);
            
            // Cleanup
            await kernel.deleteShape(A.id);
            await kernel.deleteShape(B.id);
            await kernel.deleteShape(C.id);
            await kernel.deleteShape(AB.id);
            await kernel.deleteShape(ABC.id);
        });
        
        it('(A ∪ B) - C chain works correctly', async function() {
            // Union two boxes, then subtract from result
            const A = await kernel.createBox(10, 10, 10);
            const B = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            const C = await kernel.createBox(5, 5, 15); // Cut through union
            
            // A ∪ B
            const AB = await kernel.union(A.id, B.id);
            // (A ∪ B) - C
            const ABC = await kernel.subtract(AB.id, C.id);
            
            const valid = await isValidSolid(kernel, ABC.id);
            expect(valid).to.be.true;
            
            // Union volume ≈ 1500, minus cut volume
            const { volume } = await kernel.getVolume(ABC.id);
            expect(volume).to.be.lessThan(1500);
            expect(volume).to.be.greaterThan(1000);
            
            // Cleanup
            await kernel.deleteShape(A.id);
            await kernel.deleteShape(B.id);
            await kernel.deleteShape(C.id);
            await kernel.deleteShape(AB.id);
            await kernel.deleteShape(ABC.id);
        });
        
        it('(A - B) ∪ C chain works correctly', async function() {
            // Create hollow shape then add feature
            const A = await kernel.createBox(20, 20, 20);
            const B = await kernel.createBox(16, 16, 25); // Make hollow
            const C = await kernel.createCylinder(3, 30, { x: 10, y: 0, z: 0 }); // Add attachment
            
            // A - B (hollow box)
            const AB = await kernel.subtract(A.id, B.id);
            // (A - B) ∪ C
            const ABC = await kernel.union(AB.id, C.id);
            
            const valid = await isValidSolid(kernel, ABC.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(A.id);
            await kernel.deleteShape(B.id);
            await kernel.deleteShape(C.id);
            await kernel.deleteShape(AB.id);
            await kernel.deleteShape(ABC.id);
        });
        
        it('four consecutive operations', async function() {
            // Base block
            const base = await kernel.createBox(40, 40, 10);
            
            // Feature 1: cylindrical pocket
            const pocket1 = await kernel.createCylinder(8, 12, { x: -10, y: 10, z: 0 });
            const step1 = await kernel.subtract(base.id, pocket1.id);
            
            // Feature 2: another pocket
            const pocket2 = await kernel.createCylinder(8, 12, { x: 10, y: 10, z: 0 });
            const step2 = await kernel.subtract(step1.id, pocket2.id);
            
            // Feature 3: boss (raised feature)
            const boss = await kernel.createCylinder(5, 8, { x: 0, y: -10, z: 5 });
            const step3 = await kernel.union(step2.id, boss.id);
            
            // Feature 4: through hole
            const hole = await kernel.createCylinder(2, 20, { x: 0, y: -10, z: 0 });
            const final = await kernel.subtract(step3.id, hole.id);
            
            const valid = await isValidSolid(kernel, final.id);
            expect(valid).to.be.true;
            
            // Cleanup all intermediate shapes
            await kernel.deleteShape(base.id);
            await kernel.deleteShape(pocket1.id);
            await kernel.deleteShape(pocket2.id);
            await kernel.deleteShape(boss.id);
            await kernel.deleteShape(hole.id);
            await kernel.deleteShape(step1.id);
            await kernel.deleteShape(step2.id);
            await kernel.deleteShape(step3.id);
            await kernel.deleteShape(final.id);
        });
    });
    
    // ==================== Error Cases ====================
    
    describe('Error Handling', function() {
        
        it('throws error for invalid shape ID', async function() {
            const box = await kernel.createBox(10, 10, 10);
            
            try {
                await kernel.union(box.id, 'invalid-id-12345');
                expect.fail('Should have thrown error');
            } catch (e) {
                expect(e).to.be.an.instanceof(Error);
            }
            
            // Cleanup
            await kernel.deleteShape(box.id);
        });
        
        it('throws error for deleted shape', async function() {
            const box1 = await kernel.createBox(10, 10, 10);
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            await kernel.deleteShape(box2.id);
            
            try {
                await kernel.union(box1.id, box2.id);
                expect.fail('Should have thrown error');
            } catch (e) {
                expect(e).to.be.an.instanceof(Error);
            }
            
            // Cleanup
            await kernel.deleteShape(box1.id);
        });
        
        it('throws error for unknown boolean type', async function() {
            const box1 = await kernel.createBox(10, 10, 10);
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            try {
                await kernel.boolean(box1.id, box2.id, 'invalid-operation');
                expect.fail('Should have thrown error');
            } catch (e) {
                expect(e.message).to.include('Unknown boolean type');
            }
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
        });
    });
    
    // ==================== Performance/Stress ====================
    
    describe('Performance', function() {
        
        it('handles many sequential booleans without degradation', async function() {
            // Start with a box
            let current = await kernel.createBox(100, 100, 10);
            const toCleanup = [current.id];
            
            // Add multiple cylindrical features
            for (let i = 0; i < 5; i++) {
                const hole = await kernel.createCylinder(3, 15, { 
                    x: -40 + i * 20, 
                    y: 0, 
                    z: 0 
                });
                toCleanup.push(hole.id);
                
                const result = await kernel.subtract(current.id, hole.id);
                toCleanup.push(result.id);
                current = result;
            }
            
            // Final result should be valid
            const valid = await isValidSolid(kernel, current.id);
            expect(valid).to.be.true;
            
            // Cleanup
            for (const id of toCleanup) {
                try {
                    await kernel.deleteShape(id);
                } catch (e) {
                    // May already be deleted
                }
            }
        });
        
        it('handles complex union of multiple shapes', async function() {
            // Create grid of boxes
            const boxes = [];
            for (let x = 0; x < 3; x++) {
                for (let y = 0; y < 3; y++) {
                    const box = await kernel.createBox(8, 8, 8, { 
                        x: x * 10, 
                        y: y * 10, 
                        z: 0 
                    });
                    boxes.push(box);
                }
            }
            
            // Union all boxes sequentially
            let current = boxes[0];
            for (let i = 1; i < boxes.length; i++) {
                const result = await kernel.union(current.id, boxes[i].id);
                if (i > 1) {
                    // Delete intermediate result
                    await kernel.deleteShape(current.id);
                }
                current = result;
            }
            
            // Final result should be valid
            const valid = await isValidSolid(kernel, current.id);
            expect(valid).to.be.true;
            
            // Cleanup
            for (const box of boxes) {
                try {
                    await kernel.deleteShape(box.id);
                } catch (e) {}
            }
            await kernel.deleteShape(current.id);
        });
    });
});

// Export for potential reuse
export { hasValidTopology, calculateBoxOverlap };
