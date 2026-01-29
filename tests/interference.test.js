/**
 * Ameri-CAD Interference Detection Tests
 * Tests for detecting overlapping/intersecting bodies
 */

import { KernelBridge } from '../src/kernel/bridge.js';
import { isValidSolid } from './kernel-primitives.test.js';

let kernel;

describe('Interference Detection', function() {
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
    
    // ==================== Basic Detection ====================
    
    describe('Basic Detection', function() {
        
        it('detects two overlapping boxes', async function() {
            // Two 10x10x10 boxes, offset by 5 in X (50% overlap)
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            const result = await kernel.detectInterference([box1.id, box2.id]);
            
            expect(result.interferences).to.have.lengthOf(1);
            expect(result.interferences[0].body1).to.equal(box1.id);
            expect(result.interferences[0].body2).to.equal(box2.id);
            expect(result.interferences[0].volume).to.be.greaterThan(0);
            expect(result.interferences[0].intersectionShapeId).to.be.a('string');
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.interferences[0].intersectionShapeId);
        });
        
        it('reports no interference for non-overlapping boxes', async function() {
            // Two boxes far apart
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 50, y: 0, z: 0 });
            
            const result = await kernel.detectInterference([box1.id, box2.id]);
            
            expect(result.interferences).to.have.lengthOf(0);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
        });
        
        it('does not flag touching faces (zero volume intersection)', async function() {
            // Two boxes touching at a face (no volumetric overlap)
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 10, y: 0, z: 0 });
            
            const result = await kernel.detectInterference([box1.id, box2.id]);
            
            // Should have no interferences (just touching, no overlap)
            expect(result.interferences).to.have.lengthOf(0);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
        });
    });
    
    // ==================== Volume Accuracy ====================
    
    describe('Volume Accuracy', function() {
        
        it('calculates correct interference volume for overlapping boxes', async function() {
            // Two 10x10x10 boxes, offset by 5 in X
            // Overlap region: 5x10x10 = 500 mm³
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            const result = await kernel.detectInterference([box1.id, box2.id]);
            
            expect(result.interferences).to.have.lengthOf(1);
            
            const expectedVolume = 5 * 10 * 10; // 500
            expect(result.interferences[0].volume).to.be.closeTo(expectedVolume, expectedVolume * 0.01);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.interferences[0].intersectionShapeId);
        });
        
        it('calculates correct volume for partial overlap', async function() {
            // Large box with small box partially inside
            const bigBox = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
            const smallBox = await kernel.createBox(10, 10, 10, { x: 10, y: 0, z: 0 });
            
            // Only half of small box overlaps (x from 5 to 10 = 5, y,z full 10x10)
            // Overlap: 5 * 10 * 10 = 500
            const result = await kernel.detectInterference([bigBox.id, smallBox.id]);
            
            expect(result.interferences).to.have.lengthOf(1);
            const expectedVolume = 5 * 10 * 10;
            expect(result.interferences[0].volume).to.be.closeTo(expectedVolume, expectedVolume * 0.05);
            
            // Cleanup
            await kernel.deleteShape(bigBox.id);
            await kernel.deleteShape(smallBox.id);
            await kernel.deleteShape(result.interferences[0].intersectionShapeId);
        });
        
        it('handles complete containment (small inside large)', async function() {
            // Small box completely inside large box
            const bigBox = await kernel.createBox(30, 30, 30, { x: 0, y: 0, z: 0 });
            const smallBox = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            
            const result = await kernel.detectInterference([bigBox.id, smallBox.id]);
            
            expect(result.interferences).to.have.lengthOf(1);
            
            // Interference volume = entire small box = 1000
            const expectedVolume = 10 * 10 * 10;
            expect(result.interferences[0].volume).to.be.closeTo(expectedVolume, expectedVolume * 0.01);
            
            // Cleanup
            await kernel.deleteShape(bigBox.id);
            await kernel.deleteShape(smallBox.id);
            await kernel.deleteShape(result.interferences[0].intersectionShapeId);
        });
    });
    
    // ==================== Multiple Interferences ====================
    
    describe('Multiple Interferences', function() {
        
        it('finds multiple interferences in a set of bodies', async function() {
            // Three overlapping boxes in a row
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            const box3 = await kernel.createBox(10, 10, 10, { x: 10, y: 0, z: 0 });
            
            const result = await kernel.detectInterference([box1.id, box2.id, box3.id]);
            
            // box1 overlaps box2, box2 overlaps box3, box1 may not overlap box3
            expect(result.interferences.length).to.be.at.least(2);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(box3.id);
            for (const i of result.interferences) {
                try {
                    await kernel.deleteShape(i.intersectionShapeId);
                } catch (e) { /* may already be deleted */ }
            }
        });
        
        it('handles mixed interference scenarios', async function() {
            // 4 boxes: A overlaps B, C overlaps D, but {A,B} far from {C,D}
            const boxA = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const boxB = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            const boxC = await kernel.createBox(10, 10, 10, { x: 100, y: 0, z: 0 });
            const boxD = await kernel.createBox(10, 10, 10, { x: 105, y: 0, z: 0 });
            
            const result = await kernel.detectInterference([boxA.id, boxB.id, boxC.id, boxD.id]);
            
            // Should find exactly 2 interferences
            expect(result.interferences).to.have.lengthOf(2);
            
            // Cleanup
            await kernel.deleteShape(boxA.id);
            await kernel.deleteShape(boxB.id);
            await kernel.deleteShape(boxC.id);
            await kernel.deleteShape(boxD.id);
            for (const i of result.interferences) {
                try {
                    await kernel.deleteShape(i.intersectionShapeId);
                } catch (e) { /* may already be deleted */ }
            }
        });
    });
    
    // ==================== Mixed Primitive Types ====================
    
    describe('Mixed Primitive Types', function() {
        
        it('detects interference between box and cylinder', async function() {
            const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
            const cylinder = await kernel.createCylinder(5, 30, { x: 0, y: 0, z: 0 });
            
            const result = await kernel.detectInterference([box.id, cylinder.id]);
            
            expect(result.interferences).to.have.lengthOf(1);
            
            // Interference = cylinder volume that's inside the box
            // Cylinder goes from z=0 to z=30, box from z=-10 to z=10
            // So intersection is cylinder from z=0 to z=10, height=10
            // Volume = π * 5² * 10 ≈ 785
            const expectedVolume = Math.PI * 25 * 10;
            expect(result.interferences[0].volume).to.be.closeTo(expectedVolume, expectedVolume * 0.05);
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(cylinder.id);
            await kernel.deleteShape(result.interferences[0].intersectionShapeId);
        });
        
        it('detects interference between two spheres', async function() {
            // Two spheres with radius 10, centers 15 apart
            const sphere1 = await kernel.createSphere(10, { x: 0, y: 0, z: 0 });
            const sphere2 = await kernel.createSphere(10, { x: 15, y: 0, z: 0 });
            
            const result = await kernel.detectInterference([sphere1.id, sphere2.id]);
            
            expect(result.interferences).to.have.lengthOf(1);
            expect(result.interferences[0].volume).to.be.greaterThan(0);
            
            // Cleanup
            await kernel.deleteShape(sphere1.id);
            await kernel.deleteShape(sphere2.id);
            await kernel.deleteShape(result.interferences[0].intersectionShapeId);
        });
        
        it('detects no interference for non-overlapping mixed types', async function() {
            const box = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const sphere = await kernel.createSphere(5, { x: 50, y: 50, z: 50 });
            
            const result = await kernel.detectInterference([box.id, sphere.id]);
            
            expect(result.interferences).to.have.lengthOf(0);
            
            // Cleanup
            await kernel.deleteShape(box.id);
            await kernel.deleteShape(sphere.id);
        });
    });
    
    // ==================== Interference Shape Extraction ====================
    
    describe('Interference Shape Extraction', function() {
        
        it('returns valid intersection shape ID', async function() {
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            const result = await kernel.detectInterference([box1.id, box2.id]);
            
            expect(result.interferences).to.have.lengthOf(1);
            const intersectionId = result.interferences[0].intersectionShapeId;
            
            // Verify the intersection shape is valid
            const valid = await isValidSolid(kernel, intersectionId);
            expect(valid).to.be.true;
            
            // Verify its volume matches reported volume
            const { volume } = await kernel.getVolume(intersectionId);
            expect(volume).to.be.closeTo(result.interferences[0].volume, 1);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(intersectionId);
        });
        
        it('returns mesh for interference visualization', async function() {
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 5, y: 0, z: 0 });
            
            const result = await kernel.detectInterference([box1.id, box2.id]);
            
            expect(result.interferences).to.have.lengthOf(1);
            const interference = result.interferences[0];
            
            // Should have mesh data for visualization
            expect(interference.mesh).to.exist;
            expect(interference.mesh.vertices).to.be.instanceOf(Float32Array);
            expect(interference.mesh.vertices.length).to.be.greaterThan(0);
            expect(interference.mesh.normals).to.be.instanceOf(Float32Array);
            expect(interference.mesh.indices).to.be.instanceOf(Uint32Array);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(interference.intersectionShapeId);
        });
    });
    
    // ==================== Edge Cases ====================
    
    describe('Edge Cases', function() {
        
        it('handles single shape (no pairs to check)', async function() {
            const box = await kernel.createBox(10, 10, 10);
            
            const result = await kernel.detectInterference([box.id]);
            
            expect(result.interferences).to.have.lengthOf(0);
            
            // Cleanup
            await kernel.deleteShape(box.id);
        });
        
        it('handles empty shape list', async function() {
            const result = await kernel.detectInterference([]);
            
            expect(result.interferences).to.have.lengthOf(0);
        });
        
        it('handles identical shapes at same position', async function() {
            // Two boxes in exact same position
            const box1 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            const box2 = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
            
            const result = await kernel.detectInterference([box1.id, box2.id]);
            
            // Complete overlap = full box volume
            expect(result.interferences).to.have.lengthOf(1);
            expect(result.interferences[0].volume).to.be.closeTo(1000, 10);
            
            // Cleanup
            await kernel.deleteShape(box1.id);
            await kernel.deleteShape(box2.id);
            await kernel.deleteShape(result.interferences[0].intersectionShapeId);
        });
        
        it('skips invalid shape IDs gracefully', async function() {
            const box = await kernel.createBox(10, 10, 10);
            
            // Include a non-existent shape ID
            const result = await kernel.detectInterference([box.id, 'nonexistent_shape_id']);
            
            // Should return empty (can't compute intersection with missing shape)
            expect(result.interferences).to.have.lengthOf(0);
            
            // Cleanup
            await kernel.deleteShape(box.id);
        });
    });
});
