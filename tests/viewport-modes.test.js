/**
 * Ameri-CAD Viewport Display Modes Tests
 * Tests for viewport shading modes: Solid, Wireframe, X-Ray, Hidden Line
 */

import { ViewportModeManager, ViewportMode, ViewportModeLabels } from '../src/ui/viewport-modes.js';

describe('Viewport Display Modes', function() {
    
    let THREE;
    let manager;
    let testObjects;
    let modeChangeCalls;
    
    before(function() {
        THREE = window.THREE;
        if (!THREE) {
            throw new Error('THREE.js not loaded');
        }
    });
    
    beforeEach(function() {
        modeChangeCalls = [];
        testObjects = [];
        
        // Create test meshes
        for (let i = 0; i < 3; i++) {
            const geometry = new THREE.BoxGeometry(10, 10, 10);
            const material = new THREE.MeshStandardMaterial({
                color: 0x808080,
                metalness: 0.4,
                roughness: 0.6
            });
            const mesh = new THREE.Mesh(geometry, material);
            
            // Add edge lines like the real app
            const edges = new THREE.EdgesGeometry(geometry, 15);
            const edgeMat = new THREE.LineBasicMaterial({ 
                color: 0x000000, 
                transparent: true, 
                opacity: 0.3 
            });
            mesh.add(new THREE.LineSegments(edges, edgeMat));
            
            mesh.userData = { name: `BODY_00${i + 1}`, id: `test-${i}` };
            testObjects.push(mesh);
        }
        
        // Create manager
        manager = new ViewportModeManager({
            THREE: THREE,
            getObjects: () => testObjects,
            onModeChange: (mode, label, previous) => {
                modeChangeCalls.push({ mode, label, previous });
            }
        });
    });
    
    afterEach(function() {
        // Clean up
        testObjects.forEach(mesh => {
            mesh.geometry.dispose();
            mesh.material.dispose();
            mesh.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        });
        testObjects = [];
    });
    
    describe('Mode Enumeration', function() {
        
        it('should have four viewport modes defined', function() {
            expect(ViewportMode.SOLID).to.equal('solid');
            expect(ViewportMode.WIREFRAME).to.equal('wireframe');
            expect(ViewportMode.XRAY).to.equal('xray');
            expect(ViewportMode.HIDDEN).to.equal('hidden');
        });
        
        it('should have display labels for all modes', function() {
            expect(ViewportModeLabels[ViewportMode.SOLID]).to.equal('SHADED');
            expect(ViewportModeLabels[ViewportMode.WIREFRAME]).to.equal('WIREFRAME');
            expect(ViewportModeLabels[ViewportMode.XRAY]).to.equal('X-RAY');
            expect(ViewportModeLabels[ViewportMode.HIDDEN]).to.equal('HIDDEN LINE');
        });
    });
    
    describe('Mode Manager Initialization', function() {
        
        it('should initialize with solid mode as default', function() {
            expect(manager.getMode()).to.equal(ViewportMode.SOLID);
        });
        
        it('should return correct mode label', function() {
            expect(manager.getModeLabel()).to.equal('SHADED');
        });
        
        it('should have default X-Ray opacity of 0.5', function() {
            expect(manager.xrayOpacity).to.equal(0.5);
        });
    });
    
    describe('Mode Setting', function() {
        
        it('should set wireframe mode', function() {
            manager.setMode(ViewportMode.WIREFRAME);
            expect(manager.getMode()).to.equal(ViewportMode.WIREFRAME);
            expect(manager.getModeLabel()).to.equal('WIREFRAME');
        });
        
        it('should set x-ray mode', function() {
            manager.setMode(ViewportMode.XRAY);
            expect(manager.getMode()).to.equal(ViewportMode.XRAY);
            expect(manager.getModeLabel()).to.equal('X-RAY');
        });
        
        it('should set hidden line mode', function() {
            manager.setMode(ViewportMode.HIDDEN);
            expect(manager.getMode()).to.equal(ViewportMode.HIDDEN);
            expect(manager.getModeLabel()).to.equal('HIDDEN LINE');
        });
        
        it('should call onModeChange callback with correct arguments', function() {
            manager.setMode(ViewportMode.WIREFRAME);
            
            expect(modeChangeCalls.length).to.equal(1);
            expect(modeChangeCalls[0].mode).to.equal(ViewportMode.WIREFRAME);
            expect(modeChangeCalls[0].label).to.equal('WIREFRAME');
            expect(modeChangeCalls[0].previous).to.equal(ViewportMode.SOLID);
        });
        
        it('should ignore invalid mode values', function() {
            manager.setMode('invalid-mode');
            expect(manager.getMode()).to.equal(ViewportMode.SOLID);
            expect(modeChangeCalls.length).to.equal(0);
        });
    });
    
    describe('Mode Cycling (Z Key)', function() {
        
        it('should cycle through modes in order', function() {
            expect(manager.getMode()).to.equal(ViewportMode.SOLID);
            
            manager.cycleMode();
            expect(manager.getMode()).to.equal(ViewportMode.WIREFRAME);
            
            manager.cycleMode();
            expect(manager.getMode()).to.equal(ViewportMode.XRAY);
            
            manager.cycleMode();
            expect(manager.getMode()).to.equal(ViewportMode.HIDDEN);
            
            manager.cycleMode();
            expect(manager.getMode()).to.equal(ViewportMode.SOLID);
        });
        
        it('should return the new mode when cycling', function() {
            const newMode = manager.cycleMode();
            expect(newMode).to.equal(ViewportMode.WIREFRAME);
        });
        
        it('should wrap around from last mode to first', function() {
            manager.setMode(ViewportMode.HIDDEN);
            const newMode = manager.cycleMode();
            expect(newMode).to.equal(ViewportMode.SOLID);
        });
    });
    
    describe('Solid Mode Rendering', function() {
        
        it('should set wireframe to false in solid mode', function() {
            manager.setMode(ViewportMode.SOLID);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.wireframe).to.equal(false);
            });
        });
        
        it('should set opacity to 1.0 in solid mode', function() {
            manager.setMode(ViewportMode.SOLID);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.opacity).to.equal(1.0);
            });
        });
        
        it('should enable depth write in solid mode', function() {
            manager.setMode(ViewportMode.SOLID);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.depthWrite).to.equal(true);
            });
        });
    });
    
    describe('Wireframe Mode Rendering', function() {
        
        it('should set wireframe to true in wireframe mode', function() {
            manager.setMode(ViewportMode.WIREFRAME);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.wireframe).to.equal(true);
            });
        });
        
        it('should hide edge line segments in wireframe mode', function() {
            manager.setMode(ViewportMode.WIREFRAME);
            
            testObjects.forEach(mesh => {
                mesh.children.forEach(child => {
                    if (child.isLineSegments) {
                        expect(child.visible).to.equal(false);
                    }
                });
            });
        });
        
        it('should enable depth write in wireframe mode', function() {
            manager.setMode(ViewportMode.WIREFRAME);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.depthWrite).to.equal(true);
            });
        });
    });
    
    describe('X-Ray Mode Rendering', function() {
        
        it('should make materials transparent in x-ray mode', function() {
            manager.setMode(ViewportMode.XRAY);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.transparent).to.equal(true);
            });
        });
        
        it('should set opacity to xrayOpacity value', function() {
            manager.setXRayOpacity(0.6);
            manager.setMode(ViewportMode.XRAY);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.opacity).to.equal(0.6);
            });
        });
        
        it('should disable depth write for see-through effect', function() {
            manager.setMode(ViewportMode.XRAY);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.depthWrite).to.equal(false);
            });
        });
        
        it('should render double-sided for x-ray', function() {
            manager.setMode(ViewportMode.XRAY);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.side).to.equal(THREE.DoubleSide);
            });
        });
        
        it('should set wireframe to false in x-ray mode', function() {
            manager.setMode(ViewportMode.XRAY);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.wireframe).to.equal(false);
            });
        });
    });
    
    describe('Hidden Line Mode Rendering', function() {
        
        it('should set face color to near-white in hidden line mode', function() {
            manager.setMode(ViewportMode.HIDDEN);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.color.getHex()).to.equal(0xfafafa);
            });
        });
        
        it('should set metalness to 0 for flat look', function() {
            manager.setMode(ViewportMode.HIDDEN);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.metalness).to.equal(0);
            });
        });
        
        it('should set roughness to 1 for flat look', function() {
            manager.setMode(ViewportMode.HIDDEN);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.roughness).to.equal(1);
            });
        });
        
        it('should make edge lines visible and fully opaque', function() {
            manager.setMode(ViewportMode.HIDDEN);
            
            testObjects.forEach(mesh => {
                mesh.children.forEach(child => {
                    if (child.isLineSegments) {
                        expect(child.visible).to.equal(true);
                        expect(child.material.opacity).to.equal(1.0);
                    }
                });
            });
        });
        
        it('should store and restore original color', function() {
            const originalColor = testObjects[0].material.color.getHex();
            
            manager.setMode(ViewportMode.HIDDEN);
            expect(testObjects[0].userData._originalColor).to.equal(originalColor);
            
            manager.setMode(ViewportMode.SOLID);
            expect(testObjects[0].material.color.getHex()).to.equal(originalColor);
        });
    });
    
    describe('X-Ray Opacity Control', function() {
        
        it('should clamp opacity to minimum of 0.1', function() {
            manager.setXRayOpacity(0);
            expect(manager.xrayOpacity).to.equal(0.1);
        });
        
        it('should clamp opacity to maximum of 1.0', function() {
            manager.setXRayOpacity(1.5);
            expect(manager.xrayOpacity).to.equal(1.0);
        });
        
        it('should update materials when opacity changes in x-ray mode', function() {
            manager.setMode(ViewportMode.XRAY);
            manager.setXRayOpacity(0.8);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.opacity).to.equal(0.8);
            });
        });
        
        it('should not update materials when opacity changes in other modes', function() {
            manager.setMode(ViewportMode.SOLID);
            manager.setXRayOpacity(0.3);
            
            testObjects.forEach(mesh => {
                expect(mesh.material.opacity).to.equal(1.0);
            });
        });
    });
    
    describe('Original Material Restoration', function() {
        
        it('should restore original properties when switching to solid', function() {
            const originalColor = testObjects[0].material.color.getHex();
            const originalMetalness = testObjects[0].material.metalness;
            
            manager.setMode(ViewportMode.HIDDEN);
            manager.setMode(ViewportMode.SOLID);
            
            expect(testObjects[0].material.color.getHex()).to.equal(originalColor);
            expect(testObjects[0].material.metalness).to.equal(originalMetalness);
        });
        
        it('should restore wireframe state correctly', function() {
            manager.setMode(ViewportMode.WIREFRAME);
            expect(testObjects[0].material.wireframe).to.equal(true);
            
            manager.setMode(ViewportMode.SOLID);
            expect(testObjects[0].material.wireframe).to.equal(false);
        });
        
        it('should restore transparency state correctly', function() {
            manager.setMode(ViewportMode.XRAY);
            expect(testObjects[0].material.transparent).to.equal(true);
            
            manager.setMode(ViewportMode.SOLID);
            expect(testObjects[0].material.transparent).to.equal(false);
        });
    });
    
    describe('New Object Integration', function() {
        
        it('should apply current mode to newly added mesh', function() {
            manager.setMode(ViewportMode.WIREFRAME);
            
            // Create new mesh
            const geometry = new THREE.BoxGeometry(5, 5, 5);
            const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            const newMesh = new THREE.Mesh(geometry, material);
            testObjects.push(newMesh);
            
            // Apply mode to new mesh
            manager.applyModeToMesh(newMesh);
            
            expect(newMesh.material.wireframe).to.equal(true);
            
            // Cleanup
            geometry.dispose();
            material.dispose();
        });
        
        it('should store original material for new mesh', function() {
            manager.setMode(ViewportMode.HIDDEN);
            
            const geometry = new THREE.BoxGeometry(5, 5, 5);
            const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
            const newMesh = new THREE.Mesh(geometry, material);
            
            manager.applyModeToMesh(newMesh);
            
            // Original color should be stored
            expect(newMesh.userData._originalColor).to.equal(0x00ff00);
            
            // Cleanup
            geometry.dispose();
            material.dispose();
        });
    });
    
    describe('Reset Functionality', function() {
        
        it('should reset mode to solid', function() {
            manager.setMode(ViewportMode.XRAY);
            manager.reset();
            expect(manager.getMode()).to.equal(ViewportMode.SOLID);
        });
        
        it('should restore all materials to original state', function() {
            const originalColor = testObjects[0].material.color.getHex();
            
            manager.setMode(ViewportMode.HIDDEN);
            manager.reset();
            
            expect(testObjects[0].material.color.getHex()).to.equal(originalColor);
            expect(testObjects[0].material.wireframe).to.equal(false);
        });
    });
    
    describe('Selection Compatibility', function() {
        
        it('should allow selection in solid mode', function() {
            manager.setMode(ViewportMode.SOLID);
            
            // Material should not block raycast
            testObjects.forEach(mesh => {
                expect(mesh.material.visible !== false).to.equal(true);
            });
        });
        
        it('should allow selection in wireframe mode', function() {
            manager.setMode(ViewportMode.WIREFRAME);
            
            // Wireframe objects should still be selectable
            testObjects.forEach(mesh => {
                expect(mesh.material.visible !== false).to.equal(true);
            });
        });
        
        it('should allow selection through objects in x-ray mode', function() {
            manager.setMode(ViewportMode.XRAY);
            
            // With depthWrite false, objects behind can be selected
            testObjects.forEach(mesh => {
                expect(mesh.material.depthWrite).to.equal(false);
            });
        });
    });
    
    describe('Performance', function() {
        
        it('should handle mode switch on many objects efficiently', function() {
            // Create 100 objects
            const manyObjects = [];
            for (let i = 0; i < 100; i++) {
                const geo = new THREE.BoxGeometry(1, 1, 1);
                const mat = new THREE.MeshStandardMaterial({ color: 0x808080 });
                manyObjects.push(new THREE.Mesh(geo, mat));
            }
            
            const largeManager = new ViewportModeManager({
                THREE: THREE,
                getObjects: () => manyObjects
            });
            
            const start = performance.now();
            largeManager.setMode(ViewportMode.XRAY);
            const elapsed = performance.now() - start;
            
            // Should complete in under 50ms for 100 objects
            expect(elapsed).to.be.below(50);
            
            // Cleanup
            manyObjects.forEach(m => {
                m.geometry.dispose();
                m.material.dispose();
            });
        });
    });
});
