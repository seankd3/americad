/**
 * Ameri-CAD Primitives Tests
 * Tests for shape generation and validation using real geometry utilities
 */

import { 
    calculateVolume, 
    validateBoundingBox, 
    checkManifold, 
    getMeshStats,
    GeometryUtils 
} from '../src/core/geometry-utils.js';

// Expose GeometryUtils globally for backward compatibility
window.GeometryUtils = GeometryUtils;

describe('Primitives', function() {
    
    describe('BoxGeometry', function() {
        
        it('should create box with correct dimensions', function() {
            const geometry = new THREE.BoxGeometry(10, 20, 30);
            geometry.computeBoundingBox();
            
            const size = new THREE.Vector3();
            geometry.boundingBox.getSize(size);
            
            expect(size.x).to.equal(10);
            expect(size.y).to.equal(20);
            expect(size.z).to.equal(30);
        });
        
        it('should have 24 vertices (6 faces × 4 corners)', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            
            // BoxGeometry has 24 vertices (non-indexed, 4 per face)
            expect(geometry.attributes.position.count).to.equal(24);
        });
        
        it('should have 12 triangular faces', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            
            // 24 vertices / 3 per triangle = 8... wait
            // BoxGeometry uses index, let's check
            const faceCount = geometry.index ? 
                geometry.index.count / 3 : 
                geometry.attributes.position.count / 3;
            
            expect(faceCount).to.equal(12);
        });
        
        it('should match golden mesh: 10x10x10 box', async function() {
            const response = await fetch('./golden/box_10x10x10.json');
            const golden = await response.json();
            
            const geometry = new THREE.BoxGeometry(10, 10, 10);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const stats = getMeshStats(mesh);
            
            expect(stats.volume).to.be.closeTo(golden.volume, golden.tolerance.volume);
            expect(stats.boundingBox.size.x).to.be.closeTo(golden.boundingBox.size.x, 0.001);
            expect(stats.boundingBox.size.y).to.be.closeTo(golden.boundingBox.size.y, 0.001);
            expect(stats.boundingBox.size.z).to.be.closeTo(golden.boundingBox.size.z, 0.001);
        });
    });
    
    describe('SphereGeometry', function() {
        
        it('should create sphere with correct radius', function() {
            const radius = 5;
            const geometry = new THREE.SphereGeometry(radius, 32, 16);
            geometry.computeBoundingBox();
            
            const size = new THREE.Vector3();
            geometry.boundingBox.getSize(size);
            
            // Diameter should be 2 * radius
            expect(size.x).to.be.closeTo(10, 0.1);
            expect(size.y).to.be.closeTo(10, 0.1);
            expect(size.z).to.be.closeTo(10, 0.1);
        });
        
        it('should have more vertices with higher segments', function() {
            const low = new THREE.SphereGeometry(1, 8, 4);
            const high = new THREE.SphereGeometry(1, 32, 16);
            
            expect(high.attributes.position.count).to.be.greaterThan(
                low.attributes.position.count
            );
        });
        
        it('should have volume close to 4/3 π r³', function() {
            const radius = 5;
            const geometry = new THREE.SphereGeometry(radius, 64, 32);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const volume = calculateVolume(mesh);
            const expected = (4/3) * Math.PI * Math.pow(radius, 3);
            
            // Within 1% accuracy
            expect(volume).to.be.closeTo(expected, expected * 0.01);
        });
    });
    
    describe('CylinderGeometry', function() {
        
        it('should create cylinder with correct radius and height', function() {
            const radius = 5;
            const height = 20;
            const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
            geometry.computeBoundingBox();
            
            const size = new THREE.Vector3();
            geometry.boundingBox.getSize(size);
            
            expect(size.x).to.be.closeTo(10, 0.1); // diameter
            expect(size.y).to.be.closeTo(20, 0.1); // height
            expect(size.z).to.be.closeTo(10, 0.1); // diameter
        });
        
        it('should match golden mesh: r=5, h=20 cylinder', async function() {
            const response = await fetch('./golden/cylinder_r5_h20.json');
            const golden = await response.json();
            
            const geometry = new THREE.CylinderGeometry(5, 5, 20, 64);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const stats = getMeshStats(mesh);
            
            expect(stats.volume).to.be.closeTo(golden.volume, golden.tolerance.volume);
            expect(stats.boundingBox.size.y).to.be.closeTo(golden.boundingBox.size.y, 0.001);
        });
        
        it('should create cone when radiusTop is 0', function() {
            const geometry = new THREE.CylinderGeometry(0, 5, 10, 32);
            geometry.computeBoundingBox();
            
            const size = new THREE.Vector3();
            geometry.boundingBox.getSize(size);
            
            expect(size.x).to.be.closeTo(10, 0.1); // base diameter
            expect(size.y).to.be.closeTo(10, 0.1); // height
        });
    });
    
    describe('ConeGeometry', function() {
        
        it('should create cone with correct dimensions', function() {
            const radius = 5;
            const height = 10;
            const geometry = new THREE.ConeGeometry(radius, height, 32);
            geometry.computeBoundingBox();
            
            const size = new THREE.Vector3();
            geometry.boundingBox.getSize(size);
            
            expect(size.x).to.be.closeTo(10, 0.1); // diameter
            expect(size.y).to.be.closeTo(10, 0.1); // height
        });
        
        it('should have volume close to 1/3 π r² h', function() {
            const radius = 5;
            const height = 10;
            const geometry = new THREE.ConeGeometry(radius, height, 64);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const volume = calculateVolume(mesh);
            const expected = (1/3) * Math.PI * Math.pow(radius, 2) * height;
            
            // Within 2% accuracy (cone approximation is less precise)
            expect(volume).to.be.closeTo(expected, expected * 0.02);
        });
    });
    
    describe('TorusGeometry', function() {
        
        it('should create torus with correct dimensions', function() {
            const radius = 10;
            const tube = 3;
            const geometry = new THREE.TorusGeometry(radius, tube, 16, 100);
            geometry.computeBoundingBox();
            
            const size = new THREE.Vector3();
            geometry.boundingBox.getSize(size);
            
            // Outer diameter = 2 * (radius + tube) = 26
            expect(size.x).to.be.closeTo(26, 0.5);
            // Height = 2 * tube = 6
            expect(size.y).to.be.closeTo(6, 0.5);
        });
        
        it('should have volume close to 2π² R r²', function() {
            const R = 10;  // major radius
            const r = 3;   // tube radius
            const geometry = new THREE.TorusGeometry(R, r, 32, 100);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const volume = calculateVolume(mesh);
            const expected = 2 * Math.PI * Math.PI * R * r * r;
            
            // Within 2% accuracy
            expect(volume).to.be.closeTo(expected, expected * 0.02);
        });
    });
    
    describe('Primitive Transformations', function() {
        
        it('should translate primitive correctly', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const mesh = new THREE.Mesh(geometry);
            mesh.position.set(10, 20, 30);
            mesh.updateMatrixWorld();
            
            const bbox = validateBoundingBox(mesh);
            
            expect(bbox.center.x).to.be.closeTo(10, 0.001);
            expect(bbox.center.y).to.be.closeTo(20, 0.001);
            expect(bbox.center.z).to.be.closeTo(30, 0.001);
        });
        
        it('should scale primitive correctly', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const mesh = new THREE.Mesh(geometry);
            mesh.scale.set(2, 3, 4);
            mesh.updateMatrixWorld();
            
            const bbox = validateBoundingBox(mesh);
            
            expect(bbox.size.x).to.be.closeTo(2, 0.001);
            expect(bbox.size.y).to.be.closeTo(3, 0.001);
            expect(bbox.size.z).to.be.closeTo(4, 0.001);
        });
        
        it('should rotate primitive correctly', function() {
            const geometry = new THREE.BoxGeometry(10, 1, 1);
            const mesh = new THREE.Mesh(geometry);
            mesh.rotation.z = Math.PI / 2; // 90 degrees
            mesh.updateMatrixWorld();
            
            const bbox = validateBoundingBox(mesh);
            
            // After 90° Z rotation, X size becomes Y size
            expect(bbox.size.x).to.be.closeTo(1, 0.001);
            expect(bbox.size.y).to.be.closeTo(10, 0.001);
        });
        
        it('should preserve volume after translation', function() {
            const geometry = new THREE.BoxGeometry(10, 10, 10);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const volumeBefore = calculateVolume(mesh);
            
            mesh.position.set(100, 200, 300);
            mesh.updateMatrixWorld();
            
            const volumeAfter = calculateVolume(mesh);
            
            expect(volumeAfter).to.be.closeTo(volumeBefore, 0.001);
        });
        
        it('should scale volume correctly with uniform scale', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const volumeBefore = calculateVolume(mesh);
            
            mesh.scale.set(2, 2, 2);
            mesh.updateMatrixWorld();
            
            const volumeAfter = calculateVolume(mesh);
            
            // Volume scales by factor³ = 8
            expect(volumeAfter).to.be.closeTo(volumeBefore * 8, 0.01);
        });
    });
    
    describe('Primitive Materials', function() {
        
        it('should create mesh with default material', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshStandardMaterial({ color: 0x808080 });
            const mesh = new THREE.Mesh(geometry, material);
            
            expect(mesh.material).to.exist;
            expect(mesh.material.color.getHex()).to.equal(0x808080);
        });
        
        it('should support metalness and roughness', function() {
            const material = new THREE.MeshStandardMaterial({
                color: 0x808080,
                metalness: 0.7,
                roughness: 0.3
            });
            
            expect(material.metalness).to.equal(0.7);
            expect(material.roughness).to.equal(0.3);
        });
    });
});

describe('Geometry Validation', function() {
    
    describe('Manifold Checks', function() {
        
        it('should identify all basic primitives as manifold', function() {
            const primitives = [
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.SphereGeometry(1, 16, 8),
                new THREE.CylinderGeometry(1, 1, 2, 16),
                new THREE.ConeGeometry(1, 2, 16),
                new THREE.TorusGeometry(2, 0.5, 8, 16)
            ];
            
            primitives.forEach((geometry, i) => {
                const mesh = new THREE.Mesh(geometry);
                const result = checkManifold(mesh);
                expect(result.isManifold, `Primitive ${i} should be manifold`).to.be.true;
            });
        });
    });
    
    describe('Bounding Box Validation', function() {
        
        it('should have positive size for all dimensions', function() {
            const geometry = new THREE.BoxGeometry(5, 10, 15);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const bbox = validateBoundingBox(mesh);
            
            expect(bbox.size.x).to.be.above(0);
            expect(bbox.size.y).to.be.above(0);
            expect(bbox.size.z).to.be.above(0);
        });
        
        it('should have max > min for all axes', function() {
            const geometry = new THREE.SphereGeometry(5, 16, 8);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const bbox = validateBoundingBox(mesh);
            
            expect(bbox.max.x).to.be.above(bbox.min.x);
            expect(bbox.max.y).to.be.above(bbox.min.y);
            expect(bbox.max.z).to.be.above(bbox.min.z);
        });
    });
    
    describe('Volume Validation', function() {
        
        it('should have positive volume for all closed primitives', function() {
            const primitives = [
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.SphereGeometry(1, 16, 8),
                new THREE.CylinderGeometry(1, 1, 2, 16)
            ];
            
            primitives.forEach((geometry, i) => {
                const mesh = new THREE.Mesh(geometry);
                mesh.updateMatrixWorld();
                const volume = calculateVolume(mesh);
                expect(volume, `Primitive ${i} should have positive volume`).to.be.above(0);
            });
        });
    });
});
