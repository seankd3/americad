/**
 * Ameri-CAD Kernel Primitives Tests
 * Tests for OpenCASCADE kernel primitive operations
 * 
 * These tests exercise the actual B-Rep kernel, not THREE.js approximations
 */

import { KernelBridge, meshToThreeGeometry } from '../src/kernel/bridge.js';

// Create a shared kernel instance for all tests
let kernel;

// ==================== Test Utilities ====================

/**
 * Get bounding box from mesh data
 * @param {Object} mesh - Mesh data with vertices Float32Array
 * @returns {{min: {x,y,z}, max: {x,y,z}, size: {x,y,z}}}
 */
function getBoundingBox(mesh) {
    const vertices = mesh.vertices;
    
    if (!vertices || vertices.length === 0) {
        return null;
    }
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        const z = vertices[i + 2];
        
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
    }
    
    return {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
        size: { 
            x: maxX - minX, 
            y: maxY - minY, 
            z: maxZ - minZ 
        }
    };
}

/**
 * Count topological faces from mesh faceIds
 * @param {Object} mesh - Mesh data with faceIds array
 * @returns {number} Number of unique B-Rep faces
 */
function countFaces(mesh) {
    if (!mesh.faceIds || mesh.faceIds.length === 0) {
        return 0;
    }
    
    const uniqueFaces = new Set(mesh.faceIds);
    return uniqueFaces.size;
}

/**
 * Count edges from a shape using kernel API
 * @param {KernelBridge} kernel 
 * @param {string} shapeId 
 * @returns {Promise<number>}
 */
async function countEdges(kernel, shapeId) {
    const result = await kernel.getEdges(shapeId);
    return result.edgeIds.length;
}

/**
 * Count vertices in mesh (unique positions)
 * @param {Object} mesh - Mesh data
 * @returns {number}
 */
function countVertices(mesh) {
    // Note: This counts tessellation vertices, not topological vertices
    return mesh.vertices.length / 3;
}

/**
 * Check if a shape is a valid solid using kernel volume
 * @param {KernelBridge} kernel 
 * @param {string} shapeId 
 * @returns {Promise<boolean>}
 */
async function isValidSolid(kernel, shapeId) {
    try {
        const { volume } = await kernel.getVolume(shapeId);
        return volume > 0;
    } catch (e) {
        return false;
    }
}

/**
 * Check mesh has valid normals (non-zero, normalized)
 * @param {Object} mesh 
 * @returns {boolean}
 */
function hasValidNormals(mesh) {
    const normals = mesh.normals;
    if (!normals || normals.length === 0) return false;
    
    for (let i = 0; i < normals.length; i += 3) {
        const nx = normals[i];
        const ny = normals[i + 1];
        const nz = normals[i + 2];
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        
        // Check normalized (within tolerance)
        if (Math.abs(len - 1.0) > 0.01) {
            return false;
        }
    }
    
    return true;
}

/**
 * Check mesh has valid indices
 * @param {Object} mesh 
 * @returns {boolean}
 */
function hasValidIndices(mesh) {
    const indices = mesh.indices;
    const vertexCount = mesh.vertices.length / 3;
    
    if (!indices || indices.length === 0) return false;
    
    // Indices should be divisible by 3 (triangles)
    if (indices.length % 3 !== 0) return false;
    
    // All indices should be within vertex bounds
    for (let i = 0; i < indices.length; i++) {
        if (indices[i] >= vertexCount) {
            return false;
        }
    }
    
    return true;
}

// ==================== Test Suite ====================

describe('Kernel Primitives', function() {
    // Increase timeout for kernel initialization
    this.timeout(30000);
    
    before(async function() {
        kernel = new KernelBridge();
        await kernel.init();
    });
    
    after(function() {
        if (kernel) {
            kernel.terminate();
        }
    });
    
    // ==================== Box Tests ====================
    
    describe('Box', function() {
        
        it('creates box with correct dimensions', async function() {
            const result = await kernel.createBox(10, 20, 30);
            
            expect(result.id).to.be.a('string');
            expect(result.mesh).to.exist;
            expect(result.mesh.vertices.length).to.be.greaterThan(0);
            
            // Check bounding box matches dimensions
            const bbox = getBoundingBox(result.mesh);
            expect(bbox.size.x).to.be.closeTo(10, 0.1);
            expect(bbox.size.y).to.be.closeTo(20, 0.1);
            expect(bbox.size.z).to.be.closeTo(30, 0.1);
        });
        
        it('creates box with 6 topological faces', async function() {
            const result = await kernel.createBox(5, 5, 5);
            const faceCount = countFaces(result.mesh);
            
            expect(faceCount).to.equal(6);
        });
        
        it('creates box with 12 edges', async function() {
            const result = await kernel.createBox(5, 5, 5);
            const edgeCount = await countEdges(kernel, result.id);
            
            expect(edgeCount).to.equal(12);
        });
        
        it('creates box at specified center', async function() {
            const center = { x: 100, y: 200, z: 300 };
            const result = await kernel.createBox(10, 10, 10, center);
            
            const bbox = getBoundingBox(result.mesh);
            const meshCenter = {
                x: (bbox.min.x + bbox.max.x) / 2,
                y: (bbox.min.y + bbox.max.y) / 2,
                z: (bbox.min.z + bbox.max.z) / 2
            };
            
            expect(meshCenter.x).to.be.closeTo(center.x, 0.1);
            expect(meshCenter.y).to.be.closeTo(center.y, 0.1);
            expect(meshCenter.z).to.be.closeTo(center.z, 0.1);
        });
        
        it('creates box with correct volume', async function() {
            const result = await kernel.createBox(10, 20, 30);
            const { volume } = await kernel.getVolume(result.id);
            
            const expected = 10 * 20 * 30; // 6000
            expect(volume).to.be.closeTo(expected, expected * 0.01);
        });
        
        it('creates box with valid mesh data', async function() {
            const result = await kernel.createBox(5, 5, 5);
            
            expect(hasValidNormals(result.mesh)).to.be.true;
            expect(hasValidIndices(result.mesh)).to.be.true;
        });
        
        it('creates box that is a valid solid', async function() {
            const result = await kernel.createBox(5, 5, 5);
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
        });
    });
    
    // ==================== Sphere Tests ====================
    
    describe('Sphere', function() {
        
        it('creates sphere with correct radius', async function() {
            const radius = 15;
            const result = await kernel.createSphere(radius);
            
            expect(result.id).to.be.a('string');
            expect(result.mesh.vertices.length).to.be.greaterThan(0);
            
            // Bounding box should be 2*radius in each dimension
            const bbox = getBoundingBox(result.mesh);
            expect(bbox.size.x).to.be.closeTo(radius * 2, 0.5);
            expect(bbox.size.y).to.be.closeTo(radius * 2, 0.5);
            expect(bbox.size.z).to.be.closeTo(radius * 2, 0.5);
        });
        
        it('creates sphere with volume close to 4/3 π r³', async function() {
            const radius = 10;
            const result = await kernel.createSphere(radius);
            const { volume } = await kernel.getVolume(result.id);
            
            const expected = (4/3) * Math.PI * Math.pow(radius, 3);
            expect(volume).to.be.closeTo(expected, expected * 0.01);
        });
        
        it('creates sphere as closed solid', async function() {
            const result = await kernel.createSphere(5);
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
        });
        
        it('creates sphere at specified center', async function() {
            const center = { x: 50, y: -50, z: 100 };
            const result = await kernel.createSphere(10, center);
            
            const bbox = getBoundingBox(result.mesh);
            const meshCenter = {
                x: (bbox.min.x + bbox.max.x) / 2,
                y: (bbox.min.y + bbox.max.y) / 2,
                z: (bbox.min.z + bbox.max.z) / 2
            };
            
            expect(meshCenter.x).to.be.closeTo(center.x, 0.5);
            expect(meshCenter.y).to.be.closeTo(center.y, 0.5);
            expect(meshCenter.z).to.be.closeTo(center.z, 0.5);
        });
        
        it('creates sphere with single topological face', async function() {
            const result = await kernel.createSphere(5);
            const faceCount = countFaces(result.mesh);
            
            // A sphere has 1 continuous face in B-Rep
            expect(faceCount).to.equal(1);
        });
        
        it('creates sphere with valid mesh data', async function() {
            const result = await kernel.createSphere(10);
            
            expect(hasValidNormals(result.mesh)).to.be.true;
            expect(hasValidIndices(result.mesh)).to.be.true;
        });
    });
    
    // ==================== Cylinder Tests ====================
    
    describe('Cylinder', function() {
        
        it('creates cylinder with correct radius and height', async function() {
            const radius = 5;
            const height = 20;
            const result = await kernel.createCylinder(radius, height);
            
            expect(result.id).to.be.a('string');
            expect(result.mesh.vertices.length).to.be.greaterThan(0);
            
            const bbox = getBoundingBox(result.mesh);
            expect(bbox.size.x).to.be.closeTo(radius * 2, 0.5);
            expect(bbox.size.y).to.be.closeTo(radius * 2, 0.5);
            expect(bbox.size.z).to.be.closeTo(height, 0.5);
        });
        
        it('creates cylinder with 3 topological faces (top, bottom, side)', async function() {
            const result = await kernel.createCylinder(5, 10);
            const faceCount = countFaces(result.mesh);
            
            expect(faceCount).to.equal(3);
        });
        
        it('creates cylinder with correct volume (π r² h)', async function() {
            const radius = 5;
            const height = 20;
            const result = await kernel.createCylinder(radius, height);
            const { volume } = await kernel.getVolume(result.id);
            
            const expected = Math.PI * Math.pow(radius, 2) * height;
            expect(volume).to.be.closeTo(expected, expected * 0.01);
        });
        
        it('creates cylinder at specified center', async function() {
            const center = { x: 10, y: 20, z: 30 };
            const result = await kernel.createCylinder(5, 10, center);
            
            const bbox = getBoundingBox(result.mesh);
            // Cylinder is centered on XY at center point, Z base at center.z
            expect(bbox.min.x).to.be.closeTo(center.x - 5, 0.5);
            expect(bbox.max.x).to.be.closeTo(center.x + 5, 0.5);
        });
        
        it('creates cylinder as valid solid', async function() {
            const result = await kernel.createCylinder(5, 10);
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
        });
        
        it('creates cylinder with valid mesh data', async function() {
            const result = await kernel.createCylinder(5, 10);
            
            expect(hasValidNormals(result.mesh)).to.be.true;
            expect(hasValidIndices(result.mesh)).to.be.true;
        });
    });
    
    // ==================== Cone Tests ====================
    
    describe('Cone', function() {
        
        it('creates cone with correct radii and height', async function() {
            const radius1 = 10; // bottom
            const radius2 = 0;  // top (point)
            const height = 20;
            const result = await kernel.createCone(radius1, radius2, height);
            
            expect(result.id).to.be.a('string');
            expect(result.mesh.vertices.length).to.be.greaterThan(0);
            
            const bbox = getBoundingBox(result.mesh);
            expect(bbox.size.x).to.be.closeTo(radius1 * 2, 0.5);
            expect(bbox.size.z).to.be.closeTo(height, 0.5);
        });
        
        it('creates frustum (truncated cone) with both radii', async function() {
            const radius1 = 10;
            const radius2 = 5;
            const height = 15;
            const result = await kernel.createCone(radius1, radius2, height);
            
            const bbox = getBoundingBox(result.mesh);
            // Width should be 2 * max(r1, r2)
            expect(bbox.size.x).to.be.closeTo(radius1 * 2, 0.5);
        });
        
        it('creates pointed cone with volume 1/3 π r² h', async function() {
            const radius = 6;
            const height = 12;
            const result = await kernel.createCone(radius, 0, height);
            const { volume } = await kernel.getVolume(result.id);
            
            const expected = (1/3) * Math.PI * Math.pow(radius, 2) * height;
            expect(volume).to.be.closeTo(expected, expected * 0.02);
        });
        
        it('creates frustum with proper topology', async function() {
            const result = await kernel.createCone(10, 5, 20);
            const faceCount = countFaces(result.mesh);
            
            // Frustum: 3 faces (top, bottom, side)
            expect(faceCount).to.equal(3);
        });
        
        it('creates pointed cone with 2 faces', async function() {
            const result = await kernel.createCone(10, 0, 20);
            const faceCount = countFaces(result.mesh);
            
            // Pointed cone: 2 faces (bottom, conical side)
            expect(faceCount).to.equal(2);
        });
        
        it('creates cone as valid solid', async function() {
            const result = await kernel.createCone(8, 4, 16);
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
        });
        
        it('creates cone with valid mesh data', async function() {
            const result = await kernel.createCone(10, 5, 20);
            
            expect(hasValidNormals(result.mesh)).to.be.true;
            expect(hasValidIndices(result.mesh)).to.be.true;
        });
    });
    
    // ==================== Torus Tests ====================
    
    describe('Torus', function() {
        
        it('creates torus with correct major and minor radius', async function() {
            const majorRadius = 20;
            const minorRadius = 5;
            const result = await kernel.createTorus(majorRadius, minorRadius);
            
            expect(result.id).to.be.a('string');
            expect(result.mesh.vertices.length).to.be.greaterThan(0);
            
            const bbox = getBoundingBox(result.mesh);
            // Outer diameter = 2 * (major + minor)
            const expectedOuter = 2 * (majorRadius + minorRadius);
            expect(bbox.size.x).to.be.closeTo(expectedOuter, 1);
            expect(bbox.size.y).to.be.closeTo(expectedOuter, 1);
            // Height = 2 * minor
            expect(bbox.size.z).to.be.closeTo(minorRadius * 2, 0.5);
        });
        
        it('creates torus with volume 2π² R r²', async function() {
            const R = 15; // major
            const r = 4;  // minor
            const result = await kernel.createTorus(R, r);
            const { volume } = await kernel.getVolume(result.id);
            
            const expected = 2 * Math.PI * Math.PI * R * r * r;
            expect(volume).to.be.closeTo(expected, expected * 0.02);
        });
        
        it('creates torus as closed solid', async function() {
            const result = await kernel.createTorus(10, 3);
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
        });
        
        it('creates torus at specified center', async function() {
            const center = { x: -50, y: 100, z: 25 };
            const result = await kernel.createTorus(15, 5, center);
            
            const bbox = getBoundingBox(result.mesh);
            const meshCenter = {
                x: (bbox.min.x + bbox.max.x) / 2,
                y: (bbox.min.y + bbox.max.y) / 2,
                z: (bbox.min.z + bbox.max.z) / 2
            };
            
            expect(meshCenter.x).to.be.closeTo(center.x, 1);
            expect(meshCenter.y).to.be.closeTo(center.y, 1);
            expect(meshCenter.z).to.be.closeTo(center.z, 1);
        });
        
        it('creates torus with single topological face', async function() {
            const result = await kernel.createTorus(20, 5);
            const faceCount = countFaces(result.mesh);
            
            // Torus has 1 continuous face
            expect(faceCount).to.equal(1);
        });
        
        it('creates torus with valid mesh data', async function() {
            const result = await kernel.createTorus(15, 4);
            
            expect(hasValidNormals(result.mesh)).to.be.true;
            expect(hasValidIndices(result.mesh)).to.be.true;
        });
    });
    
    // ==================== Wedge Tests ====================
    
    describe('Wedge', function() {
        
        it('creates wedge with correct dimensions', async function() {
            const dx = 20, dy = 10, dz = 15;
            const result = await kernel.createWedge(dx, dy, dz);
            
            expect(result.id).to.be.a('string');
            expect(result.mesh.vertices.length).to.be.greaterThan(0);
            
            const bbox = getBoundingBox(result.mesh);
            expect(bbox.size.x).to.be.closeTo(dx, 0.5);
            expect(bbox.size.y).to.be.closeTo(dy, 0.5);
            expect(bbox.size.z).to.be.closeTo(dz, 0.5);
        });
        
        it('creates wedge with 5 topological faces', async function() {
            const result = await kernel.createWedge(10, 10, 10);
            const faceCount = countFaces(result.mesh);
            
            // Wedge: 5 faces (2 triangular ends, 3 rectangular sides)
            expect(faceCount).to.equal(5);
        });
        
        it('creates wedge with ltx parameter (top edge length)', async function() {
            const dx = 20, dy = 10, dz = 15, ltx = 10;
            const result = await kernel.createWedge(dx, dy, dz, ltx);
            
            expect(result.id).to.be.a('string');
            expect(result.params.ltx).to.equal(ltx);
        });
        
        it('creates wedge at specified center', async function() {
            const center = { x: 50, y: 50, z: 50 };
            const result = await kernel.createWedge(10, 10, 10, 0, center);
            
            const bbox = getBoundingBox(result.mesh);
            const meshCenter = {
                x: (bbox.min.x + bbox.max.x) / 2,
                y: (bbox.min.y + bbox.max.y) / 2,
                z: (bbox.min.z + bbox.max.z) / 2
            };
            
            expect(meshCenter.x).to.be.closeTo(center.x, 0.5);
            expect(meshCenter.y).to.be.closeTo(center.y, 0.5);
            expect(meshCenter.z).to.be.closeTo(center.z, 0.5);
        });
        
        it('creates wedge with correct volume (triangular prism)', async function() {
            const dx = 20, dy = 10, dz = 15;
            const result = await kernel.createWedge(dx, dy, dz);
            const { volume } = await kernel.getVolume(result.id);
            
            // Volume of triangular prism: (1/2 * base * height) * depth
            // For a simple wedge with ltx=0: volume = (1/2 * dx * dy) * dz
            const expected = (1/2) * dx * dy * dz;
            expect(volume).to.be.closeTo(expected, expected * 0.02);
        });
        
        it('creates wedge as valid solid', async function() {
            const result = await kernel.createWedge(10, 10, 10);
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
        });
        
        it('creates wedge with valid mesh data', async function() {
            const result = await kernel.createWedge(15, 10, 20);
            
            expect(hasValidNormals(result.mesh)).to.be.true;
            expect(hasValidIndices(result.mesh)).to.be.true;
        });
    });
    
    // ==================== Cross-Primitive Tests ====================
    
    describe('Cross-Primitive Validation', function() {
        
        it('all primitives return unique IDs', async function() {
            const ids = new Set();
            
            const box = await kernel.createBox(10, 10, 10);
            ids.add(box.id);
            
            const sphere = await kernel.createSphere(5);
            ids.add(sphere.id);
            
            const cylinder = await kernel.createCylinder(5, 10);
            ids.add(cylinder.id);
            
            const cone = await kernel.createCone(5, 2, 10);
            ids.add(cone.id);
            
            const torus = await kernel.createTorus(10, 3);
            ids.add(torus.id);
            
            const wedge = await kernel.createWedge(10, 10, 10);
            ids.add(wedge.id);
            
            expect(ids.size).to.equal(6);
        });
        
        it('all primitives have positive volume', async function() {
            const primitives = [
                await kernel.createBox(5, 5, 5),
                await kernel.createSphere(3),
                await kernel.createCylinder(3, 8),
                await kernel.createCone(4, 1, 10),
                await kernel.createTorus(8, 2),
                await kernel.createWedge(6, 4, 8)
            ];
            
            for (const prim of primitives) {
                const { volume } = await kernel.getVolume(prim.id);
                expect(volume, `Primitive ${prim.id} should have positive volume`).to.be.above(0);
            }
        });
        
        it('all primitives can be deleted', async function() {
            const box = await kernel.createBox(5, 5, 5);
            const sphere = await kernel.createSphere(3);
            
            // Delete should not throw
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(sphere.id);
            
            // Accessing deleted shape should throw
            try {
                await kernel.getVolume(box.id);
                expect.fail('Should have thrown for deleted shape');
            } catch (e) {
                // Expected
            }
        });
        
        it('kernel bounding box matches mesh bounding box', async function() {
            const result = await kernel.createBox(10, 20, 30);
            
            const meshBbox = getBoundingBox(result.mesh);
            const kernelBbox = await kernel.getBoundingBox(result.id);
            
            expect(meshBbox.size.x).to.be.closeTo(kernelBbox.max.x - kernelBbox.min.x, 0.5);
            expect(meshBbox.size.y).to.be.closeTo(kernelBbox.max.y - kernelBbox.min.y, 0.5);
            expect(meshBbox.size.z).to.be.closeTo(kernelBbox.max.z - kernelBbox.min.z, 0.5);
        });
    });
    
    // ==================== Edge Cases ====================
    
    describe('Edge Cases', function() {
        
        it('handles very small dimensions', async function() {
            const result = await kernel.createBox(0.01, 0.01, 0.01);
            
            expect(result.id).to.be.a('string');
            const { volume } = await kernel.getVolume(result.id);
            expect(volume).to.be.closeTo(0.000001, 0.0000001);
        });
        
        it('handles large dimensions', async function() {
            const result = await kernel.createBox(1000, 1000, 1000);
            
            expect(result.id).to.be.a('string');
            const { volume } = await kernel.getVolume(result.id);
            expect(volume).to.be.closeTo(1e9, 1e7);
        });
        
        it('handles asymmetric dimensions', async function() {
            const result = await kernel.createBox(1, 100, 0.5);
            
            const bbox = getBoundingBox(result.mesh);
            expect(bbox.size.x).to.be.closeTo(1, 0.1);
            expect(bbox.size.y).to.be.closeTo(100, 0.5);
            expect(bbox.size.z).to.be.closeTo(0.5, 0.1);
        });
        
        it('creates unit sphere correctly', async function() {
            const result = await kernel.createSphere(1);
            const { volume } = await kernel.getVolume(result.id);
            
            const expected = (4/3) * Math.PI; // ~4.189
            expect(volume).to.be.closeTo(expected, 0.05);
        });
    });
});

// Export utilities for other tests
export { getBoundingBox, countFaces, countEdges, isValidSolid, hasValidNormals, hasValidIndices };
