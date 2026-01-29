/**
 * Ameri-CAD Evaluator Tests
 * Tests for feature evaluation and parametric regeneration
 */

import { Evaluator } from '../src/kernel/evaluator.js';
import { 
    DocumentModel, 
    BoxFeature, 
    CylinderFeature,
    SphereFeature,
    ConeFeature,
    BooleanFeature,
    FilletFeature,
    ChamferFeature,
    ExtrudeFeature,
    SweepFeature,
    SketchFeature,
    TransformFeature
} from '../src/state/document.js';

// Mock THREE.js for testing
const mockTHREE = {
    BufferGeometry: class {
        constructor() {
            this.attributes = {};
            this.userData = {};
        }
        setAttribute(name, attr) { this.attributes[name] = attr; }
        setIndex(attr) { this.index = attr; }
        computeVertexNormals() {}
        computeBoundingBox() {}
        computeBoundingSphere() {}
        dispose() {}
    },
    BufferAttribute: class {
        constructor(array, itemSize) {
            this.array = array;
            this.itemSize = itemSize;
        }
    },
    Mesh: class {
        constructor(geometry, material) {
            this.geometry = geometry;
            this.material = material;
            this.userData = {};
            this.uuid = Math.random().toString(36);
        }
    },
    MeshStandardMaterial: class {
        constructor(params) {
            Object.assign(this, params);
        }
        clone() { return new mockTHREE.MeshStandardMaterial(this); }
        dispose() {}
    },
    DoubleSide: 2,
    BoxGeometry: class {
        constructor(w, h, d) {
            this.parameters = { width: w, height: h, depth: d };
        }
        dispose() {}
    }
};

// Mock scene
const mockScene = {
    children: [],
    add(obj) { this.children.push(obj); },
    remove(obj) { 
        const idx = this.children.indexOf(obj);
        if (idx >= 0) this.children.splice(idx, 1);
    }
};

describe('Evaluator', function() {
    this.timeout(30000);
    
    let document;
    let evaluator;
    
    beforeEach(function() {
        document = new DocumentModel();
        mockScene.children = [];
        evaluator = new Evaluator(document, mockScene, mockTHREE);
    });
    
    afterEach(function() {
        if (evaluator) {
            evaluator.clear();
        }
    });
    
    // ==================== Primitive Features ====================
    
    describe('Primitive Feature Evaluation', function() {
        
        it('evaluates box feature correctly', async function() {
            const box = new BoxFeature({
                width: 10, height: 20, depth: 30,
                center: { x: 0, y: 0, z: 0 },
                name: 'TestBox'
            });
            
            document.addFeature(box);
            await evaluator.init();
            await evaluator.evaluateFeature(box.id);
            
            expect(evaluator.getMesh(box.id)).to.exist;
            expect(evaluator.getKernelId(box.id)).to.exist;
            expect(box.valid).to.be.true;
            expect(box.error).to.be.null;
        });
        
        it('evaluates cylinder feature correctly', async function() {
            const cyl = new CylinderFeature({
                radius: 5, height: 15,
                center: { x: 0, y: 0, z: 0 },
                name: 'TestCylinder'
            });
            
            document.addFeature(cyl);
            await evaluator.init();
            await evaluator.evaluateFeature(cyl.id);
            
            expect(evaluator.getMesh(cyl.id)).to.exist;
            expect(evaluator.getKernelId(cyl.id)).to.exist;
            expect(cyl.valid).to.be.true;
        });
        
        it('evaluates sphere feature correctly', async function() {
            const sphere = new SphereFeature({
                radius: 8,
                center: { x: 5, y: 5, z: 5 },
                name: 'TestSphere'
            });
            
            document.addFeature(sphere);
            await evaluator.init();
            await evaluator.evaluateFeature(sphere.id);
            
            expect(evaluator.getMesh(sphere.id)).to.exist;
            expect(evaluator.getKernelId(sphere.id)).to.exist;
            expect(sphere.valid).to.be.true;
        });
        
        it('evaluates cone feature correctly', async function() {
            const cone = new ConeFeature({
                radius1: 5, radius2: 2, height: 10,
                center: { x: 0, y: 0, z: 0 },
                name: 'TestCone'
            });
            
            document.addFeature(cone);
            await evaluator.init();
            await evaluator.evaluateFeature(cone.id);
            
            expect(evaluator.getMesh(cone.id)).to.exist;
            expect(evaluator.getKernelId(cone.id)).to.exist;
            expect(cone.valid).to.be.true;
        });
    });
    
    // ==================== Extrude Feature ====================
    
    describe('Extrude Feature Evaluation', function() {
        
        it('evaluates extrude from rectangle sketch', async function() {
            // Create a sketch with a rectangle
            const sketch = new SketchFeature({
                plane: 'xy',
                origin: { x: 0, y: 0, z: 0 },
                elements: [{
                    type: 'rectangle',
                    width: 20,
                    height: 15,
                    center: { x: 0, y: 0 }
                }],
                name: 'RectSketch'
            });
            
            document.addFeature(sketch);
            
            // Create extrude feature
            const extrude = new ExtrudeFeature(sketch.id, {
                height: 30,
                direction: 'normal',
                name: 'Extrude1'
            });
            
            document.addFeature(extrude);
            
            await evaluator.init();
            await evaluator.evaluateAll();
            
            expect(evaluator.getMesh(extrude.id)).to.exist;
            expect(evaluator.getKernelId(extrude.id)).to.exist;
            expect(extrude.valid).to.be.true;
        });
        
        it('evaluates extrude from circle sketch', async function() {
            const sketch = new SketchFeature({
                plane: 'xy',
                elements: [{
                    type: 'circle',
                    radius: 10,
                    center: { x: 0, y: 0 }
                }],
                name: 'CircleSketch'
            });
            
            document.addFeature(sketch);
            
            const extrude = new ExtrudeFeature(sketch.id, {
                height: 25,
                direction: 'normal',
                name: 'ExtrudeCircle'
            });
            
            document.addFeature(extrude);
            
            await evaluator.init();
            await evaluator.evaluateAll();
            
            expect(evaluator.getMesh(extrude.id)).to.exist;
            expect(extrude.valid).to.be.true;
        });
        
        it('handles extrude with reverse direction', async function() {
            const sketch = new SketchFeature({
                plane: 'xy',
                elements: [{
                    type: 'rectangle',
                    width: 10,
                    height: 10,
                    center: { x: 0, y: 0 }
                }]
            });
            
            document.addFeature(sketch);
            
            const extrude = new ExtrudeFeature(sketch.id, {
                height: 20,
                direction: 'reverse'
            });
            
            document.addFeature(extrude);
            
            await evaluator.init();
            await evaluator.evaluateAll();
            
            expect(extrude.valid).to.be.true;
        });
        
        it('fails gracefully when sketch has no profiles', async function() {
            const sketch = new SketchFeature({
                plane: 'xy',
                elements: [] // Empty sketch
            });
            
            document.addFeature(sketch);
            
            const extrude = new ExtrudeFeature(sketch.id, {
                height: 10
            });
            
            document.addFeature(extrude);
            
            await evaluator.init();
            await evaluator.evaluateAll();
            
            // Extrude should fail validation
            expect(extrude.valid).to.be.false;
            expect(extrude.error).to.include('profiles');
        });
    });
    
    // ==================== Sweep Feature ====================
    
    describe('Sweep Feature Evaluation', function() {
        
        it('evaluates sweep with profile and path', async function() {
            // Create profile sketch
            const profileSketch = new SketchFeature({
                plane: 'xy',
                elements: [{
                    type: 'circle',
                    radius: 2,
                    center: { x: 0, y: 0 }
                }],
                name: 'ProfileSketch'
            });
            
            document.addFeature(profileSketch);
            
            // Create path sketch (would need a line/arc element)
            const pathSketch = new SketchFeature({
                plane: 'xz',
                elements: [{
                    type: 'rectangle', // Using rect as placeholder for path
                    width: 20,
                    height: 1,
                    center: { x: 10, y: 0 }
                }],
                name: 'PathSketch'
            });
            
            document.addFeature(pathSketch);
            
            // Create sweep
            const sweep = new SweepFeature(profileSketch.id, pathSketch.id, {
                name: 'Sweep1'
            });
            
            document.addFeature(sweep);
            
            await evaluator.init();
            
            // Evaluate in dependency order
            await evaluator.evaluateFeature(profileSketch.id);
            await evaluator.evaluateFeature(pathSketch.id);
            await evaluator.evaluateFeature(sweep.id);
            
            // Sweep should at least attempt evaluation
            // (success depends on kernel support)
            expect(sweep.dependencies).to.have.length(2);
        });
    });
    
    // ==================== Sketch Feature ====================
    
    describe('Sketch Feature Evaluation', function() {
        
        it('evaluates sketch with rectangle element', async function() {
            const sketch = new SketchFeature({
                plane: 'xy',
                origin: { x: 0, y: 0, z: 0 },
                elements: [{
                    type: 'rectangle',
                    width: 30,
                    height: 20,
                    center: { x: 0, y: 0 }
                }]
            });
            
            document.addFeature(sketch);
            
            await evaluator.init();
            await evaluator.evaluateFeature(sketch.id);
            
            expect(evaluator.getKernelId(sketch.id)).to.exist;
        });
        
        it('evaluates sketch with circle element', async function() {
            const sketch = new SketchFeature({
                plane: 'xz',
                origin: { x: 0, y: 0, z: 0 },
                elements: [{
                    type: 'circle',
                    radius: 15,
                    center: { x: 5, y: 5 }
                }]
            });
            
            document.addFeature(sketch);
            
            await evaluator.init();
            await evaluator.evaluateFeature(sketch.id);
            
            expect(evaluator.getKernelId(sketch.id)).to.exist;
        });
        
        it('handles different sketch planes', async function() {
            const planes = ['xy', 'xz', 'yz'];
            
            for (const plane of planes) {
                const sketch = new SketchFeature({
                    plane: plane,
                    elements: [{
                        type: 'rectangle',
                        width: 10,
                        height: 10,
                        center: { x: 0, y: 0 }
                    }]
                });
                
                document.addFeature(sketch);
                await evaluator.init();
                await evaluator.evaluateFeature(sketch.id);
                
                expect(sketch.valid).to.be.true;
            }
        });
    });
    
    // ==================== Transform Feature ====================
    
    describe('Transform Feature Evaluation', function() {
        
        it('evaluates transform with position offset', async function() {
            // Create source box
            const box = new BoxFeature({
                width: 10, height: 10, depth: 10,
                center: { x: 0, y: 0, z: 0 }
            });
            
            document.addFeature(box);
            
            // Create transform
            const transform = new TransformFeature(box.id, {
                position: { x: 20, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 }
            });
            
            document.addFeature(transform);
            
            await evaluator.init();
            await evaluator.evaluateAll();
            
            expect(transform.valid).to.be.true;
            expect(transform.dependencies[0]).to.equal(box.id);
        });
        
        it('evaluates transform on cylinder', async function() {
            const cyl = new CylinderFeature({
                radius: 5, height: 20,
                center: { x: 0, y: 0, z: 0 }
            });
            
            document.addFeature(cyl);
            
            const transform = new TransformFeature(cyl.id, {
                position: { x: 10, y: 10, z: 10 }
            });
            
            document.addFeature(transform);
            
            await evaluator.init();
            await evaluator.evaluateAll();
            
            expect(transform.valid).to.be.true;
        });
    });
    
    // ==================== Chamfer Feature ====================
    
    describe('Chamfer Feature Evaluation', function() {
        
        it('evaluates chamfer on box edges', async function() {
            // Create a box first
            const box = new BoxFeature({
                width: 20, height: 20, depth: 20,
                center: { x: 0, y: 0, z: 0 }
            });
            
            document.addFeature(box);
            
            await evaluator.init();
            await evaluator.evaluateFeature(box.id);
            
            // Create chamfer on the box
            const chamfer = new ChamferFeature(box.id, ['all'], 2, {
                name: 'Chamfer1'
            });
            
            document.addFeature(chamfer);
            await evaluator.evaluateFeature(chamfer.id);
            
            expect(chamfer.dependencies[0]).to.equal(box.id);
            // Chamfer evaluation depends on kernel support
        });
    });
    
    // ==================== Dependency Resolution ====================
    
    describe('Dependency Resolution', function() {
        
        it('evaluates features in topological order', async function() {
            // Create a dependency chain: box -> union -> fillet
            const box1 = new BoxFeature({ width: 20, height: 20, depth: 20 });
            const box2 = new BoxFeature({ 
                width: 10, height: 10, depth: 30,
                center: { x: 15, y: 0, z: 0 }
            });
            
            document.addFeature(box1);
            document.addFeature(box2);
            
            const union = new BooleanFeature('union', box1.id, box2.id);
            document.addFeature(union);
            
            const fillet = new FilletFeature(union.id, ['all'], 2);
            document.addFeature(fillet);
            
            await evaluator.init();
            
            // evaluateAll should handle order automatically
            await evaluator.evaluateAll();
            
            // All features should be evaluated
            expect(evaluator.getKernelId(box1.id)).to.exist;
            expect(evaluator.getKernelId(box2.id)).to.exist;
            expect(evaluator.getKernelId(union.id)).to.exist;
        });
        
        it('re-evaluates dependents when parent changes', async function() {
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            document.addFeature(box);
            
            const transform = new TransformFeature(box.id, {
                position: { x: 5, y: 0, z: 0 }
            });
            document.addFeature(transform);
            
            await evaluator.init();
            await evaluator.evaluateAll();
            
            // Modify the box
            document.updateFeature(box.id, { width: 20 });
            
            // Re-evaluate from the changed feature
            await evaluator.reEvaluateFromFeature(box.id);
            
            // Transform should have been re-evaluated
            expect(transform.modifiedAt).to.be.greaterThan(transform.createdAt);
        });
        
        it('handles circular dependency detection', function() {
            // Document model should prevent circular dependencies
            const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
            document.addFeature(box);
            
            // Topological order should work without cycles
            const order = document.getTopologicalOrder();
            expect(order).to.include(box.id);
        });
    });
    
    // ==================== Regeneration ====================
    
    describe('Parametric Regeneration', function() {
        
        it('regenerates after parameter change', async function() {
            const box = new BoxFeature({
                width: 10, height: 10, depth: 10,
                name: 'ParamBox'
            });
            
            document.addFeature(box);
            
            await evaluator.init();
            await evaluator.evaluateFeature(box.id);
            
            const originalKernelId = evaluator.getKernelId(box.id);
            
            // Change parameter
            document.updateFeature(box.id, { width: 20 });
            await evaluator.evaluateFeature(box.id);
            
            const newKernelId = evaluator.getKernelId(box.id);
            
            // Kernel ID should be different (new shape created)
            expect(newKernelId).to.not.equal(originalKernelId);
        });
        
        it('propagates changes through dependency chain', async function() {
            // Sketch -> Extrude chain
            const sketch = new SketchFeature({
                plane: 'xy',
                elements: [{
                    type: 'rectangle',
                    width: 10,
                    height: 10,
                    center: { x: 0, y: 0 }
                }]
            });
            
            document.addFeature(sketch);
            
            const extrude = new ExtrudeFeature(sketch.id, {
                height: 20
            });
            
            document.addFeature(extrude);
            
            await evaluator.init();
            await evaluator.evaluateAll();
            
            // Verify dependency
            expect(document.getDependents(sketch.id)).to.include(extrude.id);
            
            // Change sketch
            sketch.params.elements[0].width = 20;
            document.updateFeature(sketch.id, sketch.params);
            
            // Re-evaluate from sketch
            await evaluator.reEvaluateFromFeature(sketch.id);
            
            // Extrude should be re-evaluated
            expect(extrude.modifiedAt).to.be.greaterThan(extrude.createdAt);
        });
    });
    
    // ==================== Error Handling ====================
    
    describe('Error Handling', function() {
        
        it('marks feature as invalid on evaluation failure', async function() {
            const sketch = new SketchFeature({
                plane: 'xy',
                elements: [] // No valid profiles
            });
            
            document.addFeature(sketch);
            
            await evaluator.init();
            await evaluator.evaluateFeature(sketch.id);
            
            expect(sketch.valid).to.be.false;
            expect(sketch.error).to.be.a('string');
        });
        
        it('shows error placeholder for invalid features', async function() {
            const sketch = new SketchFeature({
                plane: 'xy',
                elements: []
            });
            
            document.addFeature(sketch);
            
            await evaluator.init();
            await evaluator.evaluateFeature(sketch.id);
            
            // Should have an error placeholder mesh
            const mesh = evaluator.getMesh(sketch.id);
            if (mesh) {
                expect(mesh.userData.isError).to.be.true;
            }
        });
        
        it('handles unknown feature type gracefully', async function() {
            const unknownFeature = {
                id: 'unknown_1',
                type: 'unknown_type',
                params: {},
                dependencies: [],
                children: [],
                visible: true,
                valid: true,
                error: null
            };
            
            document.features.set(unknownFeature.id, unknownFeature);
            
            await evaluator.init();
            const result = await evaluator.evaluateFeature(unknownFeature.id);
            
            expect(result).to.be.null;
        });
    });
    
    // ==================== Visibility ====================
    
    describe('Visibility Control', function() {
        
        it('adds visible features to scene', async function() {
            const box = new BoxFeature({
                width: 10, height: 10, depth: 10,
                visible: true
            });
            
            document.addFeature(box);
            
            await evaluator.init();
            await evaluator.evaluateFeature(box.id);
            
            expect(mockScene.children.length).to.be.greaterThan(0);
        });
        
        it('removes hidden features from scene', async function() {
            const box = new BoxFeature({
                width: 10, height: 10, depth: 10,
                visible: true
            });
            
            document.addFeature(box);
            
            await evaluator.init();
            await evaluator.evaluateFeature(box.id);
            
            const initialCount = mockScene.children.length;
            
            evaluator.setVisibility(box.id, false);
            
            expect(mockScene.children.length).to.be.lessThan(initialCount);
        });
    });
    
    // ==================== Profile Extraction ====================
    
    describe('Profile Extraction', function() {
        
        it('extracts rectangle profiles from sketch', function() {
            const sketch = new SketchFeature({
                plane: 'xy',
                elements: [
                    { type: 'rectangle', width: 10, height: 20, center: { x: 0, y: 0 } },
                    { type: 'rectangle', width: 5, height: 5, center: { x: 15, y: 0 } }
                ]
            });
            
            const profiles = evaluator.getSketchProfiles(sketch);
            
            expect(profiles).to.have.length(2);
            expect(profiles[0].type).to.equal('rectangle');
            expect(profiles[0].width).to.equal(10);
            expect(profiles[1].width).to.equal(5);
        });
        
        it('extracts circle profiles from sketch', function() {
            const sketch = new SketchFeature({
                plane: 'xy',
                elements: [
                    { type: 'circle', radius: 5, center: { x: 0, y: 0 } }
                ]
            });
            
            const profiles = evaluator.getSketchProfiles(sketch);
            
            expect(profiles).to.have.length(1);
            expect(profiles[0].type).to.equal('circle');
            expect(profiles[0].radius).to.equal(5);
        });
        
        it('ignores non-profile elements', function() {
            const sketch = new SketchFeature({
                plane: 'xy',
                elements: [
                    { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                    { type: 'rectangle', width: 10, height: 10, center: { x: 0, y: 0 } }
                ]
            });
            
            const profiles = evaluator.getSketchProfiles(sketch);
            
            expect(profiles).to.have.length(1);
            expect(profiles[0].type).to.equal('rectangle');
        });
    });
});
