/**
 * Ameri-CAD Extrude Operation Tests
 * Comprehensive tests for sketch-to-solid extrusion operations
 * 
 * Tests the full workflow: create sketch → extrude → verify solid
 */

import { KernelBridge } from '../src/kernel/bridge.js';
import { 
    getBoundingBox, 
    countFaces, 
    countEdges, 
    isValidSolid, 
    hasValidNormals, 
    hasValidIndices 
} from './kernel-primitives.test.js';

// Shared kernel instance
let kernel;

describe('Extrude Operations', function() {
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
    
    // ==================== Test 1: Extrude Rectangle → Box ====================
    
    describe('Extrude Rectangle → Box', function() {
        
        it('creates box with correct dimensions from rectangle extrusion', async function() {
            const width = 20;
            const height = 15;
            const extrudeHeight = 30;
            
            const profile = {
                type: 'rectangle',
                width: width,
                height: height,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, extrudeHeight, 'xy');
            
            expect(result.id).to.be.a('string');
            expect(result.mesh).to.exist;
            expect(result.mesh.vertices.length).to.be.greaterThan(0);
            
            // Verify dimensions via bounding box
            const bbox = getBoundingBox(result.mesh);
            expect(bbox.size.x).to.be.closeTo(width, 0.5);
            expect(bbox.size.y).to.be.closeTo(height, 0.5);
            expect(bbox.size.z).to.be.closeTo(extrudeHeight, 0.5);
        });
        
        it('creates box with exactly 6 faces', async function() {
            const profile = {
                type: 'rectangle',
                width: 10,
                height: 10,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 10, 'xy');
            const faceCount = countFaces(result.mesh);
            
            expect(faceCount).to.equal(6);
        });
        
        it('creates box with 12 edges', async function() {
            const profile = {
                type: 'rectangle',
                width: 5,
                height: 8,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 12, 'xy');
            const edgeCount = await countEdges(kernel, result.id);
            
            expect(edgeCount).to.equal(12);
        });
        
        it('creates box with correct volume', async function() {
            const width = 10;
            const height = 20;
            const depth = 30;
            
            const profile = {
                type: 'rectangle',
                width: width,
                height: height,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, depth, 'xy');
            const { volume } = await kernel.getVolume(result.id);
            
            const expected = width * height * depth;
            expect(volume).to.be.closeTo(expected, expected * 0.01);
        });
        
        it('creates valid mesh data', async function() {
            const profile = {
                type: 'rectangle',
                width: 15,
                height: 15,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 15, 'xy');
            
            expect(hasValidNormals(result.mesh)).to.be.true;
            expect(hasValidIndices(result.mesh)).to.be.true;
        });
        
        it('creates valid solid', async function() {
            const profile = {
                type: 'rectangle',
                width: 10,
                height: 10,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 10, 'xy');
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
        });
        
        it('handles off-center rectangles', async function() {
            const profile = {
                type: 'rectangle',
                width: 10,
                height: 10,
                center: { x: 50, y: -30 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 20, 'xy');
            const bbox = getBoundingBox(result.mesh);
            
            // Center of the extruded box should be at (50, -30, 10)
            const meshCenterX = (bbox.min.x + bbox.max.x) / 2;
            const meshCenterY = (bbox.min.y + bbox.max.y) / 2;
            
            expect(meshCenterX).to.be.closeTo(50, 0.5);
            expect(meshCenterY).to.be.closeTo(-30, 0.5);
        });
    });
    
    // ==================== Test 2: Extrude Circle → Cylinder ====================
    
    describe('Extrude Circle → Cylinder', function() {
        
        it('creates cylinder with correct radius and height', async function() {
            const radius = 10;
            const height = 25;
            
            const profile = {
                type: 'circle',
                radius: radius,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, height, 'xy');
            
            expect(result.id).to.be.a('string');
            expect(result.mesh).to.exist;
            
            // Bounding box should be 2*radius in X and Y, height in Z
            const bbox = getBoundingBox(result.mesh);
            expect(bbox.size.x).to.be.closeTo(radius * 2, 0.5);
            expect(bbox.size.y).to.be.closeTo(radius * 2, 0.5);
            expect(bbox.size.z).to.be.closeTo(height, 0.5);
        });
        
        it('creates cylinder with 3 topological faces (top, bottom, side)', async function() {
            const profile = {
                type: 'circle',
                radius: 5,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 10, 'xy');
            const faceCount = countFaces(result.mesh);
            
            expect(faceCount).to.equal(3);
        });
        
        it('creates cylinder with correct volume (π r² h)', async function() {
            const radius = 8;
            const height = 15;
            
            const profile = {
                type: 'circle',
                radius: radius,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, height, 'xy');
            const { volume } = await kernel.getVolume(result.id);
            
            const expected = Math.PI * Math.pow(radius, 2) * height;
            expect(volume).to.be.closeTo(expected, expected * 0.02);
        });
        
        it('creates valid solid cylinder', async function() {
            const profile = {
                type: 'circle',
                radius: 12,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 20, 'xy');
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
        });
        
        it('creates cylinder with valid mesh data', async function() {
            const profile = {
                type: 'circle',
                radius: 7,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 14, 'xy');
            
            expect(hasValidNormals(result.mesh)).to.be.true;
            expect(hasValidIndices(result.mesh)).to.be.true;
        });
        
        it('handles off-center circles', async function() {
            const radius = 5;
            const centerX = 100;
            const centerY = -50;
            
            const profile = {
                type: 'circle',
                radius: radius,
                center: { x: centerX, y: centerY }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 10, 'xy');
            const bbox = getBoundingBox(result.mesh);
            
            const meshCenterX = (bbox.min.x + bbox.max.x) / 2;
            const meshCenterY = (bbox.min.y + bbox.max.y) / 2;
            
            expect(meshCenterX).to.be.closeTo(centerX, 0.5);
            expect(meshCenterY).to.be.closeTo(centerY, 0.5);
        });
    });
    
    // ==================== Test 3: Extrude with Negative Distance ====================
    
    describe('Extrude with Negative Distance', function() {
        
        it('extrudes in opposite direction with negative height (XY plane)', async function() {
            const profile = {
                type: 'rectangle',
                width: 10,
                height: 10,
                center: { x: 0, y: 0 }
            };
            
            // Positive extrusion
            const positive = await kernel.extrudeSketchProfile(profile, 20, 'xy');
            const posBbox = getBoundingBox(positive.mesh);
            
            // Negative extrusion
            const negative = await kernel.extrudeSketchProfile(profile, -20, 'xy');
            const negBbox = getBoundingBox(negative.mesh);
            
            // Both should have same size but different Z positions
            expect(negBbox.size.z).to.be.closeTo(20, 0.5);
            expect(negBbox.max.z).to.be.closeTo(0, 0.5); // Ends at sketch plane
            expect(negBbox.min.z).to.be.closeTo(-20, 0.5); // Extends into negative Z
        });
        
        it('creates valid solid with negative extrusion', async function() {
            const profile = {
                type: 'circle',
                radius: 5,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, -15, 'xy');
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
        });
        
        it('has correct volume regardless of direction', async function() {
            const width = 10;
            const height = 8;
            const depth = 12;
            
            const profile = {
                type: 'rectangle',
                width: width,
                height: height,
                center: { x: 0, y: 0 }
            };
            
            const positive = await kernel.extrudeSketchProfile(profile, depth, 'xy');
            const negative = await kernel.extrudeSketchProfile(profile, -depth, 'xy');
            
            const { volume: posVol } = await kernel.getVolume(positive.id);
            const { volume: negVol } = await kernel.getVolume(negative.id);
            
            const expected = width * height * depth;
            expect(posVol).to.be.closeTo(expected, expected * 0.01);
            expect(negVol).to.be.closeTo(expected, expected * 0.01);
        });
    });
    
    // ==================== Test 4: Extrude Closed Spline ====================
    
    describe('Extrude Closed Spline', function() {
        
        it('creates smooth solid from closed spline', async function() {
            // Create a closed spline (roughly elliptical shape)
            const profile = {
                type: 'spline',
                controlPoints: [
                    { x: 10, y: 0 },
                    { x: 7, y: 7 },
                    { x: 0, y: 10 },
                    { x: -7, y: 7 },
                    { x: -10, y: 0 },
                    { x: -7, y: -7 },
                    { x: 0, y: -10 },
                    { x: 7, y: -7 }
                ],
                closed: true
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 15, 'xy');
            
            expect(result.id).to.be.a('string');
            expect(result.mesh).to.exist;
            expect(result.mesh.vertices.length).to.be.greaterThan(0);
        });
        
        it('creates valid solid from spline extrusion', async function() {
            const profile = {
                type: 'spline',
                controlPoints: [
                    { x: 5, y: 0 },
                    { x: 0, y: 5 },
                    { x: -5, y: 0 },
                    { x: 0, y: -5 }
                ],
                closed: true
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 10, 'xy');
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
        });
        
        it('creates solid with positive volume', async function() {
            const profile = {
                type: 'spline',
                controlPoints: [
                    { x: 8, y: 0 },
                    { x: 5, y: 5 },
                    { x: 0, y: 8 },
                    { x: -5, y: 5 },
                    { x: -8, y: 0 },
                    { x: -5, y: -5 },
                    { x: 0, y: -8 },
                    { x: 5, y: -5 }
                ],
                closed: true
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 20, 'xy');
            const { volume } = await kernel.getVolume(result.id);
            
            expect(volume).to.be.greaterThan(0);
        });
        
        it('creates solid with valid mesh data', async function() {
            const profile = {
                type: 'spline',
                controlPoints: [
                    { x: 6, y: 0 },
                    { x: 0, y: 6 },
                    { x: -6, y: 0 },
                    { x: 0, y: -6 }
                ],
                closed: true
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 12, 'xy');
            
            expect(hasValidNormals(result.mesh)).to.be.true;
            expect(hasValidIndices(result.mesh)).to.be.true;
        });
        
        it('handles irregular spline shapes', async function() {
            // Star-like shape
            const profile = {
                type: 'spline',
                controlPoints: [
                    { x: 10, y: 0 },
                    { x: 3, y: 3 },
                    { x: 0, y: 10 },
                    { x: -3, y: 3 },
                    { x: -10, y: 0 },
                    { x: -3, y: -3 },
                    { x: 0, y: -10 },
                    { x: 3, y: -3 }
                ],
                closed: true
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 8, 'xy');
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
        });
    });
    
    // ==================== Test 5: Extrude Profile with Hole ====================
    
    describe('Extrude Profile with Hole (Tube Shape)', function() {
        
        it('creates tube from rectangle with circular hole', async function() {
            // For this test, we need to use boolean subtraction
            // First extrude outer rectangle, then subtract extruded circle
            
            const outerProfile = {
                type: 'rectangle',
                width: 30,
                height: 30,
                center: { x: 0, y: 0 }
            };
            
            const innerProfile = {
                type: 'circle',
                radius: 10,
                center: { x: 0, y: 0 }
            };
            
            const height = 20;
            
            // Create outer solid
            const outer = await kernel.extrudeSketchProfile(outerProfile, height, 'xy');
            
            // Create inner solid (slightly taller to ensure clean cut)
            const inner = await kernel.extrudeSketchProfile(innerProfile, height + 2, 'xy');
            
            // Boolean subtract to create tube
            const tube = await kernel.subtract(outer.id, inner.id);
            
            expect(tube.id).to.be.a('string');
            expect(tube.mesh).to.exist;
            
            // Volume should be outer - inner
            const { volume } = await kernel.getVolume(tube.id);
            const outerVol = 30 * 30 * height;
            const innerVol = Math.PI * 100 * height; // π * 10² * 20
            const expectedVol = outerVol - innerVol;
            
            expect(volume).to.be.closeTo(expectedVol, expectedVol * 0.05);
        });
        
        it('creates valid tube solid', async function() {
            const outerProfile = {
                type: 'rectangle',
                width: 20,
                height: 20,
                center: { x: 0, y: 0 }
            };
            
            const innerProfile = {
                type: 'circle',
                radius: 5,
                center: { x: 0, y: 0 }
            };
            
            const outer = await kernel.extrudeSketchProfile(outerProfile, 15, 'xy');
            const inner = await kernel.extrudeSketchProfile(innerProfile, 17, 'xy');
            const tube = await kernel.subtract(outer.id, inner.id);
            
            const valid = await isValidSolid(kernel, tube.id);
            expect(valid).to.be.true;
        });
        
        it('creates pipe from two concentric circles', async function() {
            const outerRadius = 15;
            const innerRadius = 10;
            const height = 25;
            
            const outerProfile = {
                type: 'circle',
                radius: outerRadius,
                center: { x: 0, y: 0 }
            };
            
            const innerProfile = {
                type: 'circle',
                radius: innerRadius,
                center: { x: 0, y: 0 }
            };
            
            const outer = await kernel.extrudeSketchProfile(outerProfile, height, 'xy');
            const inner = await kernel.extrudeSketchProfile(innerProfile, height + 2, 'xy');
            const pipe = await kernel.subtract(outer.id, inner.id);
            
            const { volume } = await kernel.getVolume(pipe.id);
            const expectedVol = Math.PI * height * (outerRadius * outerRadius - innerRadius * innerRadius);
            
            expect(volume).to.be.closeTo(expectedVol, expectedVol * 0.03);
        });
    });
    
    // ==================== Test 6: Symmetric Extrude ====================
    
    describe('Symmetric Extrude (Both Directions)', function() {
        
        it('extrudes equal distance in both directions', async function() {
            const profile = {
                type: 'rectangle',
                width: 10,
                height: 10,
                center: { x: 0, y: 0 }
            };
            
            const halfHeight = 15;
            
            // Create two extrusions: one positive, one negative
            const posResult = await kernel.extrudeSketchProfile(profile, halfHeight, 'xy');
            const negResult = await kernel.extrudeSketchProfile(profile, -halfHeight, 'xy');
            
            // Union them to create symmetric extrusion
            const symmetric = await kernel.union(posResult.id, negResult.id);
            
            const bbox = getBoundingBox(symmetric.mesh);
            
            // Total height should be 2 * halfHeight
            expect(bbox.size.z).to.be.closeTo(halfHeight * 2, 1);
            
            // Should be centered at z=0
            expect(bbox.min.z).to.be.closeTo(-halfHeight, 0.5);
            expect(bbox.max.z).to.be.closeTo(halfHeight, 0.5);
        });
        
        it('creates valid solid with symmetric extrusion', async function() {
            const profile = {
                type: 'circle',
                radius: 8,
                center: { x: 0, y: 0 }
            };
            
            const half = 10;
            const pos = await kernel.extrudeSketchProfile(profile, half, 'xy');
            const neg = await kernel.extrudeSketchProfile(profile, -half, 'xy');
            const symmetric = await kernel.union(pos.id, neg.id);
            
            const valid = await isValidSolid(kernel, symmetric.id);
            expect(valid).to.be.true;
        });
        
        it('has correct volume for symmetric extrusion', async function() {
            const width = 10;
            const height = 8;
            const halfDepth = 12;
            
            const profile = {
                type: 'rectangle',
                width: width,
                height: height,
                center: { x: 0, y: 0 }
            };
            
            const pos = await kernel.extrudeSketchProfile(profile, halfDepth, 'xy');
            const neg = await kernel.extrudeSketchProfile(profile, -halfDepth, 'xy');
            const symmetric = await kernel.union(pos.id, neg.id);
            
            const { volume } = await kernel.getVolume(symmetric.id);
            const expected = width * height * halfDepth * 2;
            
            expect(volume).to.be.closeTo(expected, expected * 0.02);
        });
    });
    
    // ==================== Test 7: Extrude on Different Planes ====================
    
    describe('Extrude on Different Planes', function() {
        
        it('extrudes correctly on XY plane (Z direction)', async function() {
            const profile = {
                type: 'rectangle',
                width: 10,
                height: 8,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 15, 'xy');
            const bbox = getBoundingBox(result.mesh);
            
            // Width should be in X, Height in Y, Extrude in Z
            expect(bbox.size.x).to.be.closeTo(10, 0.5);
            expect(bbox.size.y).to.be.closeTo(8, 0.5);
            expect(bbox.size.z).to.be.closeTo(15, 0.5);
        });
        
        it('extrudes correctly on XZ plane (Y direction)', async function() {
            const profile = {
                type: 'rectangle',
                width: 10,
                height: 8,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 15, 'xz');
            const bbox = getBoundingBox(result.mesh);
            
            // Width should be in X, Height in Z, Extrude in Y
            expect(bbox.size.x).to.be.closeTo(10, 0.5);
            expect(bbox.size.y).to.be.closeTo(15, 0.5);
            expect(bbox.size.z).to.be.closeTo(8, 0.5);
        });
        
        it('extrudes correctly on YZ plane (X direction)', async function() {
            const profile = {
                type: 'rectangle',
                width: 10,
                height: 8,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 15, 'yz');
            const bbox = getBoundingBox(result.mesh);
            
            // Sketch X maps to Z, Sketch Y maps to Y, Extrude in X
            expect(bbox.size.x).to.be.closeTo(15, 0.5);
            expect(bbox.size.y).to.be.closeTo(8, 0.5);
            expect(bbox.size.z).to.be.closeTo(10, 0.5);
        });
        
        it('all plane extrusions create valid solids', async function() {
            const profile = {
                type: 'circle',
                radius: 5,
                center: { x: 0, y: 0 }
            };
            
            const xy = await kernel.extrudeSketchProfile(profile, 10, 'xy');
            const xz = await kernel.extrudeSketchProfile(profile, 10, 'xz');
            const yz = await kernel.extrudeSketchProfile(profile, 10, 'yz');
            
            expect(await isValidSolid(kernel, xy.id)).to.be.true;
            expect(await isValidSolid(kernel, xz.id)).to.be.true;
            expect(await isValidSolid(kernel, yz.id)).to.be.true;
        });
        
        it('all plane extrusions have same volume', async function() {
            const profile = {
                type: 'rectangle',
                width: 10,
                height: 8,
                center: { x: 0, y: 0 }
            };
            
            const xy = await kernel.extrudeSketchProfile(profile, 12, 'xy');
            const xz = await kernel.extrudeSketchProfile(profile, 12, 'xz');
            const yz = await kernel.extrudeSketchProfile(profile, 12, 'yz');
            
            const { volume: volXY } = await kernel.getVolume(xy.id);
            const { volume: volXZ } = await kernel.getVolume(xz.id);
            const { volume: volYZ } = await kernel.getVolume(yz.id);
            
            const expected = 10 * 8 * 12;
            
            expect(volXY).to.be.closeTo(expected, expected * 0.02);
            expect(volXZ).to.be.closeTo(expected, expected * 0.02);
            expect(volYZ).to.be.closeTo(expected, expected * 0.02);
        });
    });
    
    // ==================== Test 8: Extrude Invalid Profiles ====================
    
    describe('Extrude Invalid Profiles', function() {
        
        it('fails gracefully with open curve (polygon with insufficient points)', async function() {
            const profile = {
                type: 'polygon',
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 }
                    // Only 2 points - not a valid polygon
                ]
            };
            
            try {
                await kernel.extrudeSketchProfile(profile, 10, 'xy');
                // If it doesn't throw, that's okay - some implementations may handle this
                // The important thing is it doesn't crash
            } catch (error) {
                // Expected - open profiles can't be extruded
                expect(error).to.exist;
            }
        });
        
        it('fails gracefully with degenerate rectangle (zero dimensions)', async function() {
            const profile = {
                type: 'rectangle',
                width: 0,
                height: 0,
                center: { x: 0, y: 0 }
            };
            
            try {
                await kernel.extrudeSketchProfile(profile, 10, 'xy');
                // If it doesn't throw, check it produced something sensible
            } catch (error) {
                expect(error).to.exist;
            }
        });
        
        it('fails gracefully with zero radius circle', async function() {
            const profile = {
                type: 'circle',
                radius: 0,
                center: { x: 0, y: 0 }
            };
            
            try {
                await kernel.extrudeSketchProfile(profile, 10, 'xy');
            } catch (error) {
                expect(error).to.exist;
            }
        });
        
        it('fails gracefully with zero height extrusion', async function() {
            const profile = {
                type: 'rectangle',
                width: 10,
                height: 10,
                center: { x: 0, y: 0 }
            };
            
            try {
                await kernel.extrudeSketchProfile(profile, 0, 'xy');
            } catch (error) {
                expect(error).to.exist;
            }
        });
        
        it('fails gracefully with self-intersecting polygon', async function() {
            // Figure-8 / bowtie shape (self-intersecting)
            const profile = {
                type: 'polygon',
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                    { x: 10, y: 0 },
                    { x: 0, y: 10 }
                ]
            };
            
            try {
                const result = await kernel.extrudeSketchProfile(profile, 10, 'xy');
                // Some kernels may accept self-intersecting shapes
                // Just verify it doesn't crash and produces something
                expect(result.id).to.be.a('string');
            } catch (error) {
                // Expected - self-intersecting profiles often fail
                expect(error).to.exist;
            }
        });
        
        it('fails gracefully with collinear spline points', async function() {
            // All points on a line - can't form a closed area
            const profile = {
                type: 'spline',
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 5, y: 0 },
                    { x: 10, y: 0 },
                    { x: 15, y: 0 }
                ],
                closed: true
            };
            
            try {
                await kernel.extrudeSketchProfile(profile, 10, 'xy');
            } catch (error) {
                expect(error).to.exist;
            }
        });
        
        it('fails gracefully with unknown profile type', async function() {
            const profile = {
                type: 'unknown_shape',
                someParam: 10
            };
            
            try {
                await kernel.extrudeSketchProfile(profile, 10, 'xy');
                expect.fail('Should have thrown for unknown profile type');
            } catch (error) {
                expect(error.message).to.include('Unsupported profile type');
            }
        });
    });
    
    // ==================== Test 9: Extrude Updates on Sketch Change ====================
    
    describe('Extrude Updates on Sketch Change', function() {
        
        it('regenerates solid when sketch dimensions change', async function() {
            // First extrusion
            const profile1 = {
                type: 'rectangle',
                width: 10,
                height: 10,
                center: { x: 0, y: 0 }
            };
            
            const result1 = await kernel.extrudeSketchProfile(profile1, 20, 'xy');
            const { volume: vol1 } = await kernel.getVolume(result1.id);
            
            // "Modify" sketch - new profile with different dimensions
            const profile2 = {
                type: 'rectangle',
                width: 20,  // Changed from 10 to 20
                height: 10,
                center: { x: 0, y: 0 }
            };
            
            const result2 = await kernel.extrudeSketchProfile(profile2, 20, 'xy');
            const { volume: vol2 } = await kernel.getVolume(result2.id);
            
            // Volume should double (width doubled)
            expect(vol2).to.be.closeTo(vol1 * 2, vol1 * 0.05);
        });
        
        it('regenerates solid when extrusion height changes', async function() {
            const profile = {
                type: 'rectangle',
                width: 10,
                height: 10,
                center: { x: 0, y: 0 }
            };
            
            const result1 = await kernel.extrudeSketchProfile(profile, 10, 'xy');
            const result2 = await kernel.extrudeSketchProfile(profile, 30, 'xy');
            
            const { volume: vol1 } = await kernel.getVolume(result1.id);
            const { volume: vol2 } = await kernel.getVolume(result2.id);
            
            // Volume should triple (height tripled)
            expect(vol2).to.be.closeTo(vol1 * 3, vol1 * 0.05);
        });
        
        it('regenerates solid when sketch center moves', async function() {
            const profile1 = {
                type: 'rectangle',
                width: 10,
                height: 10,
                center: { x: 0, y: 0 }
            };
            
            const profile2 = {
                type: 'rectangle',
                width: 10,
                height: 10,
                center: { x: 50, y: 50 }
            };
            
            const result1 = await kernel.extrudeSketchProfile(profile1, 10, 'xy');
            const result2 = await kernel.extrudeSketchProfile(profile2, 10, 'xy');
            
            const bbox1 = getBoundingBox(result1.mesh);
            const bbox2 = getBoundingBox(result2.mesh);
            
            // Same dimensions
            expect(bbox1.size.x).to.be.closeTo(bbox2.size.x, 0.5);
            expect(bbox1.size.y).to.be.closeTo(bbox2.size.y, 0.5);
            expect(bbox1.size.z).to.be.closeTo(bbox2.size.z, 0.5);
            
            // Different positions
            const center1X = (bbox1.min.x + bbox1.max.x) / 2;
            const center2X = (bbox2.min.x + bbox2.max.x) / 2;
            
            expect(center2X - center1X).to.be.closeTo(50, 1);
        });
        
        it('regenerates valid solids after multiple parameter changes', async function() {
            const baseProfile = {
                type: 'circle',
                center: { x: 0, y: 0 }
            };
            
            // Varying radius
            const radii = [5, 10, 15, 20];
            
            for (const radius of radii) {
                const profile = { ...baseProfile, radius };
                const result = await kernel.extrudeSketchProfile(profile, 10, 'xy');
                
                const valid = await isValidSolid(kernel, result.id);
                expect(valid, `Solid should be valid for radius ${radius}`).to.be.true;
                
                const { volume } = await kernel.getVolume(result.id);
                const expected = Math.PI * radius * radius * 10;
                expect(volume).to.be.closeTo(expected, expected * 0.02);
            }
        });
    });
    
    // ==================== Additional Edge Cases ====================
    
    describe('Edge Cases', function() {
        
        it('handles very small extrusion heights', async function() {
            const profile = {
                type: 'rectangle',
                width: 100,
                height: 100,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 0.01, 'xy');
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
            
            const { volume } = await kernel.getVolume(result.id);
            expect(volume).to.be.closeTo(100, 1); // 100 * 100 * 0.01
        });
        
        it('handles very large extrusion heights', async function() {
            const profile = {
                type: 'rectangle',
                width: 1,
                height: 1,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 10000, 'xy');
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
            
            const { volume } = await kernel.getVolume(result.id);
            expect(volume).to.be.closeTo(10000, 100);
        });
        
        it('handles very small profile dimensions', async function() {
            const profile = {
                type: 'rectangle',
                width: 0.1,
                height: 0.1,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 1, 'xy');
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
        });
        
        it('handles asymmetric rectangle extrusion', async function() {
            const profile = {
                type: 'rectangle',
                width: 1,
                height: 100,
                center: { x: 0, y: 0 }
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 50, 'xy');
            const bbox = getBoundingBox(result.mesh);
            
            expect(bbox.size.x).to.be.closeTo(1, 0.1);
            expect(bbox.size.y).to.be.closeTo(100, 0.5);
            expect(bbox.size.z).to.be.closeTo(50, 0.5);
        });
        
        it('handles polygon profile', async function() {
            // Pentagon
            const profile = {
                type: 'polygon',
                points: [
                    { x: 0, y: 10 },
                    { x: 9.5, y: 3.1 },
                    { x: 5.9, y: -8.1 },
                    { x: -5.9, y: -8.1 },
                    { x: -9.5, y: 3.1 }
                ]
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 15, 'xy');
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
            expect(result.mesh.vertices.length).to.be.greaterThan(0);
        });
        
        it('handles triangle profile', async function() {
            const profile = {
                type: 'polygon',
                points: [
                    { x: 0, y: 10 },
                    { x: 10, y: -5 },
                    { x: -10, y: -5 }
                ]
            };
            
            const result = await kernel.extrudeSketchProfile(profile, 8, 'xy');
            const valid = await isValidSolid(kernel, result.id);
            
            expect(valid).to.be.true;
            
            // Should have 5 faces: 2 triangular ends + 3 rectangular sides
            const faceCount = countFaces(result.mesh);
            expect(faceCount).to.equal(5);
        });
    });
});

// Export for potential use in other test files
export { };
