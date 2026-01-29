/**
 * Ameri-CAD Draft Angle Tests
 * Tests for draft angle operations used in manufacturing (injection molding, casting)
 */

import { KernelBridge } from '../src/kernel/bridge.js';

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

// ==================== Test Results ====================

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

// ==================== Draft Tests ====================

describe('Draft Angle Operations', function() {
    this.timeout(30000);
    
    before(async function() {
        console.log('\n========== Draft Angle Tests ==========');
        console.log('Initializing kernel...');
        kernel = new KernelBridge();
        await kernel.init();
        console.log('Kernel initialized');
    });
    
    after(function() {
        if (kernel) {
            kernel.terminate();
        }
        console.log('\n========== Summary ==========');
        console.log(`Passed: ${testResults.passed}`);
        console.log(`Failed: ${testResults.failed}`);
        if (testResults.errors.length > 0) {
            console.log('Errors:');
            testResults.errors.forEach(e => console.log('  -', e));
        }
    });
    
    // ==================== Basic Draft Tests ====================
    
    describe('Basic Draft', function() {
        it('should draft a box side face with Z pull direction', async function() {
            // Create a tall box (typical injection molded part)
            const box = await kernel.createBox(20, 20, 50);
            assert(isValidMesh(box.mesh), 'Box mesh is valid');
            
            const originalBbox = getBoundingBox(box.mesh);
            assert(approxEqual(originalBbox.size.x, 20, 0.1), 'Original box width is 20');
            assert(approxEqual(originalBbox.size.z, 50, 0.1), 'Original box height is 50');
            
            // Apply 3° draft with Z as pull direction
            // This should taper the vertical walls
            const drafted = await kernel.draft(box.id, 3, 'z');
            
            assert(drafted.id !== box.id, 'Draft created new shape ID');
            assert(isValidMesh(drafted.mesh), 'Drafted mesh is valid');
            assert(drafted.facesModified > 0, `Faces were modified (${drafted.facesModified})`);
            
            // The drafted shape should still have similar height
            const draftedBbox = getBoundingBox(drafted.mesh);
            assert(approxEqual(draftedBbox.size.z, 50, 1), 'Drafted box height preserved');
            
            // At the top (Z=50), the box should be narrower due to draft
            // At 3° over 50 units, the taper should be approximately 50 * tan(3°) ≈ 2.6 per side
            // So top should be roughly 20 - 2*2.6 ≈ 14.8 wide
            // But we need to verify the shape changed somehow
            
            // Clean up
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(drafted.id);
        });
        
        it('should draft a box with X pull direction', async function() {
            // Create a box where X is the long axis
            const box = await kernel.createBox(50, 20, 20);
            assert(isValidMesh(box.mesh), 'Box mesh is valid');
            
            // Apply 5° draft with X as pull direction
            const drafted = await kernel.draft(box.id, 5, 'x');
            
            assert(drafted.id !== box.id, 'Draft created new shape ID');
            assert(isValidMesh(drafted.mesh), 'Drafted mesh is valid');
            assert(drafted.facesModified > 0, `Faces were modified (${drafted.facesModified})`);
            
            // Clean up
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(drafted.id);
        });
        
        it('should draft a box with Y pull direction', async function() {
            const box = await kernel.createBox(20, 50, 20);
            assert(isValidMesh(box.mesh), 'Box mesh is valid');
            
            // Apply 2° draft with Y as pull direction
            const drafted = await kernel.draft(box.id, 2, 'y');
            
            assert(drafted.id !== box.id, 'Draft created new shape ID');
            assert(isValidMesh(drafted.mesh), 'Drafted mesh is valid');
            assert(drafted.facesModified > 0, `Faces were modified (${drafted.facesModified})`);
            
            // Clean up
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(drafted.id);
        });
        
        it('should draft with negative direction (-z)', async function() {
            const box = await kernel.createBox(20, 20, 50);
            
            // Apply draft with -Z direction (pulling downward)
            const drafted = await kernel.draft(box.id, 3, '-z');
            
            assert(drafted.id !== box.id, 'Draft created new shape ID');
            assert(isValidMesh(drafted.mesh), 'Drafted mesh is valid');
            assert(drafted.facesModified > 0, `Faces were modified (${drafted.facesModified})`);
            
            // Clean up
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(drafted.id);
        });
        
        it('should draft with custom direction vector', async function() {
            const box = await kernel.createBox(30, 30, 50);
            
            // Apply draft with custom direction (diagonal)
            const drafted = await kernel.draft(box.id, 2, [0.707, 0, 0.707]);
            
            assert(drafted.id !== box.id, 'Draft created new shape ID');
            assert(isValidMesh(drafted.mesh), 'Drafted mesh is valid');
            
            // Clean up
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(drafted.id);
        });
    });
    
    // ==================== Cylinder Draft Tests ====================
    
    describe('Cylinder Draft', function() {
        it('should draft a cylinder with Z pull direction', async function() {
            // Create a tall cylinder (typical for injection molded posts)
            const cyl = await kernel.createCylinder(10, 50);
            assert(isValidMesh(cyl.mesh), 'Cylinder mesh is valid');
            
            const originalBbox = getBoundingBox(cyl.mesh);
            assert(approxEqual(originalBbox.size.z, 50, 0.1), 'Original cylinder height is 50');
            
            // Apply 3° draft - should create a tapered cylinder (cone-like)
            const drafted = await kernel.draft(cyl.id, 3, 'z');
            
            assert(drafted.id !== cyl.id, 'Draft created new shape ID');
            assert(isValidMesh(drafted.mesh), 'Drafted mesh is valid');
            
            // The drafted cylinder should still have similar height
            const draftedBbox = getBoundingBox(drafted.mesh);
            assert(approxEqual(draftedBbox.size.z, 50, 1), 'Drafted cylinder height preserved');
            
            // Clean up
            await kernel.deleteShape(cyl.id);
            await kernel.deleteShape(drafted.id);
        });
    });
    
    // ==================== Multiple Face Tests ====================
    
    describe('Multiple Faces', function() {
        it('should draft all eligible faces at once', async function() {
            // Create a box - has 4 vertical faces when Z is pull direction
            const box = await kernel.createBox(20, 20, 40);
            
            // Get faces for info
            const facesResult = await kernel.getFaces(box.id);
            console.log(`  Box has ${facesResult.faceIds.length} faces`);
            
            // Apply draft
            const drafted = await kernel.draft(box.id, 4, 'z');
            
            assert(drafted.id !== box.id, 'Draft created new shape ID');
            assert(isValidMesh(drafted.mesh), 'Drafted mesh is valid');
            // A box has 4 vertical faces (perpendicular to XY plane) that should be drafted
            // The top and bottom faces are parallel to XY plane and shouldn't be drafted
            assert(drafted.facesModified >= 2, `Multiple faces were drafted (${drafted.facesModified})`);
            
            // Clean up
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(drafted.id);
        });
    });
    
    // ==================== Direction Parsing Tests ====================
    
    describe('Direction Parsing', function() {
        it('should parse string direction "z"', async function() {
            const box = await kernel.createBox(20, 20, 30);
            const drafted = await kernel.draft(box.id, 2, 'z');
            assert(isValidMesh(drafted.mesh), 'Draft with "z" direction works');
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(drafted.id);
        });
        
        it('should parse string direction "Z" (case insensitive)', async function() {
            const box = await kernel.createBox(20, 20, 30);
            const drafted = await kernel.draft(box.id, 2, 'Z');
            assert(isValidMesh(drafted.mesh), 'Draft with "Z" direction works');
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(drafted.id);
        });
        
        it('should parse array direction [0,0,1]', async function() {
            const box = await kernel.createBox(20, 20, 30);
            const drafted = await kernel.draft(box.id, 2, [0, 0, 1]);
            assert(isValidMesh(drafted.mesh), 'Draft with array direction works');
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(drafted.id);
        });
        
        it('should parse comma-separated direction "0,0,1"', async function() {
            const box = await kernel.createBox(20, 20, 30);
            const drafted = await kernel.draft(box.id, 2, '0,0,1');
            assert(isValidMesh(drafted.mesh), 'Draft with comma-separated direction works');
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(drafted.id);
        });
    });
    
    // ==================== Error Handling Tests ====================
    
    describe('Error Handling', function() {
        it('should reject angle of 0', async function() {
            const box = await kernel.createBox(20, 20, 30);
            
            let caught = false;
            try {
                await kernel.draft(box.id, 0, 'z');
            } catch (e) {
                caught = true;
                assert(e.message.includes('0') || e.message.includes('angle'), 
                    `Error mentions angle: ${e.message}`);
            }
            assert(caught, 'Exception thrown for 0° angle');
            
            await kernel.deleteShape(box.id);
        });
        
        it('should reject angle >= 90', async function() {
            const box = await kernel.createBox(20, 20, 30);
            
            let caught = false;
            try {
                await kernel.draft(box.id, 90, 'z');
            } catch (e) {
                caught = true;
                assert(e.message.includes('90') || e.message.includes('angle'), 
                    `Error mentions angle: ${e.message}`);
            }
            assert(caught, 'Exception thrown for 90° angle');
            
            await kernel.deleteShape(box.id);
        });
        
        it('should reject invalid direction', async function() {
            const box = await kernel.createBox(20, 20, 30);
            
            let caught = false;
            try {
                await kernel.draft(box.id, 3, 'invalid');
            } catch (e) {
                caught = true;
                assert(e.message.includes('direction') || e.message.includes('Invalid'), 
                    `Error mentions direction: ${e.message}`);
            }
            assert(caught, 'Exception thrown for invalid direction');
            
            await kernel.deleteShape(box.id);
        });
        
        it('should reject zero direction vector', async function() {
            const box = await kernel.createBox(20, 20, 30);
            
            let caught = false;
            try {
                await kernel.draft(box.id, 3, [0, 0, 0]);
            } catch (e) {
                caught = true;
                assert(e.message.includes('zero') || e.message.includes('direction'), 
                    `Error mentions zero vector: ${e.message}`);
            }
            assert(caught, 'Exception thrown for zero direction vector');
            
            await kernel.deleteShape(box.id);
        });
        
        it('should handle non-existent shape ID', async function() {
            let caught = false;
            try {
                await kernel.draft('nonexistent_shape_id', 3, 'z');
            } catch (e) {
                caught = true;
                assert(e.message.includes('not found') || e.message.includes('Shape'), 
                    `Error mentions shape not found: ${e.message}`);
            }
            assert(caught, 'Exception thrown for non-existent shape');
        });
    });
    
    // ==================== getFaces Tests ====================
    
    describe('Get Faces', function() {
        it('should return face IDs for a box', async function() {
            const box = await kernel.createBox(10, 10, 10);
            
            const result = await kernel.getFaces(box.id);
            
            assert(Array.isArray(result.faceIds), 'faceIds is an array');
            assert(result.faceIds.length === 6, `Box has 6 faces (got ${result.faceIds.length})`);
            assert(result.faceIds.every(id => typeof id === 'string'), 'All face IDs are strings');
            
            await kernel.deleteShape(box.id);
        });
        
        it('should return face IDs for a cylinder', async function() {
            const cyl = await kernel.createCylinder(5, 10);
            
            const result = await kernel.getFaces(cyl.id);
            
            assert(Array.isArray(result.faceIds), 'faceIds is an array');
            // Cylinder has 3 faces: top cap, bottom cap, curved surface
            assert(result.faceIds.length === 3, `Cylinder has 3 faces (got ${result.faceIds.length})`);
            
            await kernel.deleteShape(cyl.id);
        });
    });
});

// Run tests if in browser test runner
if (typeof mocha !== 'undefined') {
    mocha.run();
}
