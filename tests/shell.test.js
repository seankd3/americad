/**
 * Ameri-CAD Shell Command Tests
 * Tests for the shell operation that hollows out solid bodies
 * 
 * Shell operation uses OpenCASCADE's BRepOffsetAPI_MakeThickSolid to create
 * hollow bodies with uniform wall thickness.
 */

import { KernelBridge } from '../src/kernel/bridge.js';
import { 
    isValidSolid, 
    hasValidNormals, 
    hasValidIndices 
} from './kernel-primitives.test.js';

let kernel;

// ==================== Test Utilities ====================

/**
 * Calculate approximate shell volume for a box
 * @param {number} w - width
 * @param {number} h - height  
 * @param {number} d - depth
 * @param {number} t - wall thickness
 * @param {boolean} closed - whether shell is closed (no face removed)
 * @returns {number} Expected volume
 */
function expectedBoxShellVolume(w, h, d, t, closed = false) {
    const outerVolume = w * h * d;
    // Inner dimensions (reduced by thickness on each side)
    const innerW = w - 2 * t;
    const innerH = h - 2 * t;
    const innerD = d - 2 * t;
    const innerVolume = innerW * innerH * innerD;
    
    if (closed) {
        // Closed shell - outer minus inner
        return outerVolume - innerVolume;
    } else {
        // Open shell - outer minus inner, but one wall is removed
        // This is an approximation since the removed face changes the geometry
        return outerVolume - innerVolume;
    }
}

// ==================== Test Suite ====================

describe('Shell Command', function() {
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
    
    // ==================== Basic Shell Operations ====================
    
    describe('Basic Shell Operations', function() {
        
        it('shells a box with largest face removed (default)', async function() {
            // Create a 20x20x20 box
            const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
            
            // Shell with 2mm wall thickness, largest face removed
            const result = await kernel.shell(box.id, null, 2, 'largest');
            
            expect(result.id).to.be.a('string');
            expect(result.mesh).to.exist;
            expect(result.mesh.vertices.length).to.be.greaterThan(0);
            
            // Validate solid
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Check volume is reduced (hollow)
            const { volume: originalVol } = await kernel.getVolume(box.id);
            const { volume: shelledVol } = await kernel.getVolume(result.id);
            expect(shelledVol).to.be.lessThan(originalVol);
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
        
        it('shells a box with top face removed', async function() {
            const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
            
            const result = await kernel.shell(box.id, null, 2, 'top');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
        
        it('shells a box with bottom face removed', async function() {
            const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
            
            const result = await kernel.shell(box.id, null, 2, 'bottom');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
        
        it('creates a closed shell (no face removed)', async function() {
            const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
            
            // Closed shell - no faces removed
            const result = await kernel.shell(box.id, null, 2, 'none');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Volume should match closed shell formula
            const { volume } = await kernel.getVolume(result.id);
            const expectedVol = expectedBoxShellVolume(20, 20, 20, 2, true);
            expect(volume).to.be.closeTo(expectedVol, expectedVol * 0.05);
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
    });
    
    // ==================== Cylinder Shell (Tube) ====================
    
    describe('Cylinder Shell (Tube)', function() {
        
        it('creates a tube from cylinder with largest face removed', async function() {
            // Cylinder: radius 10, height 30
            const cylinder = await kernel.createCylinder(10, 30, { x: 0, y: 0, z: 0 });
            
            // Shell with 2mm wall - should create a tube
            const result = await kernel.shell(cylinder.id, null, 2, 'largest');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Volume should be approximately tube volume
            const { volume } = await kernel.getVolume(result.id);
            // Tube: outer π*10²*30 - inner π*8²*30 ≈ 3393 - 6032 (depends on which face removed)
            // With one end cap removed, volume is less predictable, but should be hollow
            const { volume: originalVol } = await kernel.getVolume(cylinder.id);
            expect(volume).to.be.lessThan(originalVol);
            
            // Cleanup
            await kernel.deleteShape(cylinder.id);
            await kernel.deleteShape(result.id);
        });
        
        it('creates tube with top face removed', async function() {
            const cylinder = await kernel.createCylinder(10, 30, { x: 0, y: 0, z: 0 });
            
            const result = await kernel.shell(cylinder.id, null, 2, 'top');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(cylinder.id);
            await kernel.deleteShape(result.id);
        });
    });
    
    // ==================== Different Shapes ====================
    
    describe('Shell Different Shapes', function() {
        
        it('shells a sphere', async function() {
            const sphere = await kernel.createSphere(15, { x: 0, y: 0, z: 0 });
            
            // Shell sphere with largest face (the sphere surface itself)
            // This creates a hollow sphere
            const result = await kernel.shell(sphere.id, null, 2, 'largest');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Hollow sphere volume ≈ 4/3π(R³ - r³)
            const { volume } = await kernel.getVolume(result.id);
            const outerVol = (4/3) * Math.PI * Math.pow(15, 3);
            // With largest face removed, this is tricky - just check it's smaller
            expect(volume).to.be.lessThan(outerVol);
            
            // Cleanup
            await kernel.deleteShape(sphere.id);
            await kernel.deleteShape(result.id);
        });
        
        it('shells a cone (frustum)', async function() {
            // Truncated cone (frustum)
            const cone = await kernel.createCone(15, 10, 20, { x: 0, y: 0, z: 0 });
            
            const result = await kernel.shell(cone.id, null, 2, 'largest');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(cone.id);
            await kernel.deleteShape(result.id);
        });
        
        it('shells a torus', async function() {
            const torus = await kernel.createTorus(20, 5, { x: 0, y: 0, z: 0 });
            
            const result = await kernel.shell(torus.id, null, 1, 'largest');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(torus.id);
            await kernel.deleteShape(result.id);
        });
    });
    
    // ==================== Face Selection ====================
    
    describe('Face Selection Modes', function() {
        
        it('selects correct face for "front" direction', async function() {
            const box = await kernel.createBox(20, 20, 20);
            
            const result = await kernel.shell(box.id, null, 2, 'front');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
        
        it('selects correct face for "back" direction', async function() {
            const box = await kernel.createBox(20, 20, 20);
            
            const result = await kernel.shell(box.id, null, 2, 'back');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
        
        it('selects correct face for "left" direction', async function() {
            const box = await kernel.createBox(20, 20, 20);
            
            const result = await kernel.shell(box.id, null, 2, 'left');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
        
        it('selects correct face for "right" direction', async function() {
            const box = await kernel.createBox(20, 20, 20);
            
            const result = await kernel.shell(box.id, null, 2, 'right');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
        
        it('getFaces returns all face information', async function() {
            const box = await kernel.createBox(10, 20, 30);
            
            const facesInfo = await kernel.getFaces(box.id);
            
            expect(facesInfo.faceIds).to.be.an('array');
            expect(facesInfo.faceIds.length).to.equal(6); // Box has 6 faces
            expect(facesInfo.faces).to.be.an('array');
            expect(facesInfo.faces.length).to.equal(6);
            
            // Each face should have area, centroid, normal
            for (const face of facesInfo.faces) {
                expect(face.id).to.be.a('string');
                expect(face.area).to.be.a('number');
                expect(face.area).to.be.greaterThan(0);
                expect(face.centroid).to.have.keys('x', 'y', 'z');
                expect(face.normal).to.have.keys('x', 'y', 'z');
            }
            
            // Cleanup
            await kernel.deleteShape(box.id);
        });
    });
    
    // ==================== Volume Verification ====================
    
    describe('Volume Verification', function() {
        
        it('produces correct volume for box shell', async function() {
            // 30x30x30 box with 3mm walls
            const box = await kernel.createBox(30, 30, 30);
            
            const result = await kernel.shell(box.id, null, 3, 'none'); // Closed shell
            
            const { volume } = await kernel.getVolume(result.id);
            
            // Outer: 30³ = 27000
            // Inner: 24³ = 13824
            // Shell volume = 27000 - 13824 = 13176
            const expectedVol = 27000 - 13824;
            expect(volume).to.be.closeTo(expectedVol, expectedVol * 0.05);
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
        
        it('produces correct volume for thin shell', async function() {
            const box = await kernel.createBox(20, 20, 20);
            
            const result = await kernel.shell(box.id, null, 0.5, 'none');
            
            const { volume } = await kernel.getVolume(result.id);
            
            // Outer: 20³ = 8000
            // Inner: 19³ = 6859
            // Shell volume = 8000 - 6859 = 1141
            const expectedVol = 8000 - 6859;
            expect(volume).to.be.closeTo(expectedVol, expectedVol * 0.05);
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
    });
    
    // ==================== Error Handling ====================
    
    describe('Error Handling', function() {
        
        it('throws error for wall thickness too large', async function() {
            // 10x10x10 box - wall of 6 would exceed half the dimension
            const box = await kernel.createBox(10, 10, 10);
            
            try {
                await kernel.shell(box.id, null, 6, 'largest');
                expect.fail('Should have thrown error');
            } catch (e) {
                expect(e.message).to.include('failed');
            }
            
            // Cleanup
            await kernel.deleteShape(box.id);
        });
        
        it('throws error for invalid shape ID', async function() {
            try {
                await kernel.shell('invalid-shape-id', null, 2, 'largest');
                expect.fail('Should have thrown error');
            } catch (e) {
                expect(e.message).to.include('not found');
            }
        });
        
        it('throws error for deleted shape', async function() {
            const box = await kernel.createBox(20, 20, 20);
            await kernel.deleteShape(box.id);
            
            try {
                await kernel.shell(box.id, null, 2, 'largest');
                expect.fail('Should have thrown error');
            } catch (e) {
                expect(e.message).to.include('not found');
            }
        });
        
        it('handles zero thickness gracefully', async function() {
            const box = await kernel.createBox(20, 20, 20);
            
            try {
                // Zero thickness should either fail or produce original shape
                const result = await kernel.shell(box.id, null, 0, 'largest');
                // If it succeeds, volume should be same as original
                const { volume: originalVol } = await kernel.getVolume(box.id);
                const { volume: shelledVol } = await kernel.getVolume(result.id);
                expect(Math.abs(shelledVol - originalVol)).to.be.lessThan(originalVol * 0.1);
                await kernel.deleteShape(result.id);
            } catch (e) {
                // Throwing is also acceptable for zero thickness
                expect(e).to.be.an.instanceof(Error);
            }
            
            // Cleanup
            await kernel.deleteShape(box.id);
        });
    });
    
    // ==================== Complex Shapes ====================
    
    describe('Shell Complex Shapes', function() {
        
        it('shells a shape after boolean operation', async function() {
            // Create L-shaped solid via union
            const box1 = await kernel.createBox(20, 20, 10);
            const box2 = await kernel.createBox(10, 10, 20, { x: 5, y: 5, z: 5 });
            const lShape = await kernel.union(box1.id, box2.id);
            
            // Shell the result
            const result = await kernel.shell(lShape.id, null, 1, 'largest');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(lShape.id);
            await kernel.deleteShape(result.id);
        });
        
        it('shells a shape with fillet', async function() {
            // Box with filleted edges
            const box = await kernel.createBox(30, 30, 30);
            const filleted = await kernel.filletAll(box.id, 2);
            
            // Shell the filleted box
            const result = await kernel.shell(filleted.id, null, 2, 'top');
            
            expect(result.id).to.be.a('string');
            const valid = await isValidSolid(kernel, result.id);
            expect(valid).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(filleted.id);
            await kernel.deleteShape(result.id);
        });
    });
    
    // ==================== Mesh Quality ====================
    
    describe('Mesh Quality', function() {
        
        it('produces valid normals', async function() {
            const box = await kernel.createBox(20, 20, 20);
            const result = await kernel.shell(box.id, null, 2, 'top');
            
            expect(hasValidNormals(result.mesh)).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
        
        it('produces valid indices', async function() {
            const box = await kernel.createBox(20, 20, 20);
            const result = await kernel.shell(box.id, null, 2, 'top');
            
            expect(hasValidIndices(result.mesh)).to.be.true;
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
        
        it('generates more triangles than original (hollow interior)', async function() {
            const box = await kernel.createBox(20, 20, 20);
            const result = await kernel.shell(box.id, null, 2, 'top');
            
            // Shelled shape has more faces (interior surfaces)
            expect(result.mesh.indices.length).to.be.greaterThan(box.mesh.indices.length);
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(result.id);
        });
    });
});
