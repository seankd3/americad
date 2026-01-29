/**
 * Ameri-CAD Math & Geometry Tests
 * Tests for actual math utilities from src/core/math.js
 * and geometry utilities from src/core/geometry-utils.js
 */

import * as MathUtils from '../src/core/math.js';
import { 
    calculateVolume, 
    validateBoundingBox, 
    checkManifold, 
    getMeshStats,
    GeometryUtils 
} from '../src/core/geometry-utils.js';

// Expose GeometryUtils globally for runner.html compatibility
window.GeometryUtils = GeometryUtils;

describe('MathUtils (src/core/math.js)', function() {
    
    describe('generateId()', function() {
        it('should generate unique IDs', function() {
            const id1 = MathUtils.generateId();
            const id2 = MathUtils.generateId();
            
            expect(id1).to.be.a('string');
            expect(id2).to.be.a('string');
            expect(id1).to.not.equal(id2);
        });
        
        it('should generate uppercase alphanumeric IDs', function() {
            const id = MathUtils.generateId();
            expect(id).to.match(/^[A-Z0-9]+$/);
        });
    });
    
    describe('clamp()', function() {
        it('should clamp value within range', function() {
            expect(MathUtils.clamp(5, 0, 10)).to.equal(5);
            expect(MathUtils.clamp(-5, 0, 10)).to.equal(0);
            expect(MathUtils.clamp(15, 0, 10)).to.equal(10);
        });
        
        it('should handle edge cases', function() {
            expect(MathUtils.clamp(0, 0, 10)).to.equal(0);
            expect(MathUtils.clamp(10, 0, 10)).to.equal(10);
        });
    });
    
    describe('lerp()', function() {
        it('should interpolate between values', function() {
            expect(MathUtils.lerp(0, 10, 0)).to.equal(0);
            expect(MathUtils.lerp(0, 10, 1)).to.equal(10);
            expect(MathUtils.lerp(0, 10, 0.5)).to.equal(5);
        });
        
        it('should extrapolate beyond range', function() {
            expect(MathUtils.lerp(0, 10, 2)).to.equal(20);
            expect(MathUtils.lerp(0, 10, -0.5)).to.equal(-5);
        });
    });
    
    describe('degToRad()', function() {
        it('should convert degrees to radians correctly', function() {
            expect(MathUtils.degToRad(0)).to.equal(0);
            expect(MathUtils.degToRad(90)).to.be.closeTo(Math.PI / 2, 0.0001);
            expect(MathUtils.degToRad(180)).to.be.closeTo(Math.PI, 0.0001);
            expect(MathUtils.degToRad(360)).to.be.closeTo(Math.PI * 2, 0.0001);
        });
    });
    
    describe('radToDeg()', function() {
        it('should convert radians to degrees correctly', function() {
            expect(MathUtils.radToDeg(0)).to.equal(0);
            expect(MathUtils.radToDeg(Math.PI / 2)).to.be.closeTo(90, 0.0001);
            expect(MathUtils.radToDeg(Math.PI)).to.be.closeTo(180, 0.0001);
            expect(MathUtils.radToDeg(Math.PI * 2)).to.be.closeTo(360, 0.0001);
        });
    });
    
    describe('snapToGrid()', function() {
        it('should snap values to grid', function() {
            expect(MathUtils.snapToGrid(7, 5)).to.equal(5);
            expect(MathUtils.snapToGrid(8, 5)).to.equal(10);
            expect(MathUtils.snapToGrid(10, 5)).to.equal(10);
        });
        
        it('should handle negative values', function() {
            expect(MathUtils.snapToGrid(-7, 5)).to.equal(-5);
            expect(MathUtils.snapToGrid(-8, 5)).to.equal(-10);
        });
    });
    
    describe('snapVector3ToGrid()', function() {
        it('should snap Vector3 to grid', function() {
            const v = new THREE.Vector3(7, 13, 22);
            const snapped = MathUtils.snapVector3ToGrid(v, 5);
            
            expect(snapped.x).to.equal(5);
            expect(snapped.y).to.equal(15);
            expect(snapped.z).to.equal(20);
        });
    });
    
    describe('computeBoundingBox()', function() {
        it('should compute bounding box for objects', function() {
            const geometry = new THREE.BoxGeometry(10, 10, 10);
            const mesh = new THREE.Mesh(geometry);
            mesh.position.set(5, 5, 5);
            mesh.updateMatrixWorld();
            
            const result = MathUtils.computeBoundingBox([mesh]);
            
            expect(result.center.x).to.be.closeTo(5, 0.001);
            expect(result.center.y).to.be.closeTo(5, 0.001);
            expect(result.center.z).to.be.closeTo(5, 0.001);
        });
        
        it('should return empty for no objects', function() {
            const result = MathUtils.computeBoundingBox([]);
            expect(result.size.x).to.equal(0);
            expect(result.size.y).to.equal(0);
            expect(result.size.z).to.equal(0);
        });
    });
    
    describe('calculateFitDistance()', function() {
        it('should calculate camera distance to fit object', function() {
            const distance = MathUtils.calculateFitDistance(10, 60);
            expect(distance).to.be.above(0);
        });
    });
    
    describe('calculateTriangleNormal()', function() {
        it('should calculate triangle normal', function() {
            const v1 = new THREE.Vector3(0, 0, 0);
            const v2 = new THREE.Vector3(1, 0, 0);
            const v3 = new THREE.Vector3(0, 1, 0);
            
            const normal = MathUtils.calculateTriangleNormal(v1, v2, v3);
            
            expect(normal.x).to.be.closeTo(0, 0.001);
            expect(normal.y).to.be.closeTo(0, 0.001);
            expect(normal.z).to.be.closeTo(1, 0.001);
        });
    });
});

describe('GeometryUtils (src/core/geometry-utils.js)', function() {
    
    describe('calculateVolume()', function() {
        
        it('should calculate volume of a unit box correctly', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const volume = calculateVolume(mesh);
            
            // Unit cube volume = 1
            expect(volume).to.be.closeTo(1, 0.01);
        });
        
        it('should calculate volume of a 10x10x10 box correctly', function() {
            const geometry = new THREE.BoxGeometry(10, 10, 10);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const volume = calculateVolume(mesh);
            
            // 10x10x10 cube volume = 1000
            expect(volume).to.be.closeTo(1000, 1);
        });
        
        it('should calculate volume of a scaled box correctly', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const mesh = new THREE.Mesh(geometry);
            mesh.scale.set(2, 3, 4);
            mesh.updateMatrixWorld();
            
            const volume = calculateVolume(mesh);
            
            // 2x3x4 = 24
            expect(volume).to.be.closeTo(24, 0.1);
        });
        
        it('should calculate volume of a unit sphere correctly', function() {
            // Higher segment count for accuracy
            const geometry = new THREE.SphereGeometry(1, 64, 32);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const volume = calculateVolume(mesh);
            
            // Unit sphere volume = (4/3) * π * r³ ≈ 4.189
            expect(volume).to.be.closeTo(4.189, 0.1);
        });
        
        it('should calculate volume of a cylinder correctly', function() {
            // r=5, h=20
            const geometry = new THREE.CylinderGeometry(5, 5, 20, 64);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const volume = calculateVolume(mesh);
            
            // Cylinder volume = π * r² * h = π * 25 * 20 ≈ 1570.8
            expect(volume).to.be.closeTo(1570.8, 10);
        });
        
        it('should return 0 for mesh without geometry', function() {
            const volume = calculateVolume({});
            expect(volume).to.equal(0);
        });
        
        it('should return 0 for null mesh', function() {
            const volume = calculateVolume(null);
            expect(volume).to.equal(0);
        });
    });
    
    describe('validateBoundingBox()', function() {
        
        it('should compute correct bounding box for unit cube at origin', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const bbox = validateBoundingBox(mesh);
            
            expect(bbox.min.x).to.be.closeTo(-0.5, 0.001);
            expect(bbox.min.y).to.be.closeTo(-0.5, 0.001);
            expect(bbox.min.z).to.be.closeTo(-0.5, 0.001);
            expect(bbox.max.x).to.be.closeTo(0.5, 0.001);
            expect(bbox.max.y).to.be.closeTo(0.5, 0.001);
            expect(bbox.max.z).to.be.closeTo(0.5, 0.001);
        });
        
        it('should compute correct size for 10x10x10 box', function() {
            const geometry = new THREE.BoxGeometry(10, 10, 10);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const bbox = validateBoundingBox(mesh);
            
            expect(bbox.size.x).to.be.closeTo(10, 0.001);
            expect(bbox.size.y).to.be.closeTo(10, 0.001);
            expect(bbox.size.z).to.be.closeTo(10, 0.001);
        });
        
        it('should compute correct center for translated mesh', function() {
            const geometry = new THREE.BoxGeometry(2, 2, 2);
            const mesh = new THREE.Mesh(geometry);
            mesh.position.set(10, 20, 30);
            mesh.updateMatrixWorld();
            
            const bbox = validateBoundingBox(mesh);
            
            expect(bbox.center.x).to.be.closeTo(10, 0.001);
            expect(bbox.center.y).to.be.closeTo(20, 0.001);
            expect(bbox.center.z).to.be.closeTo(30, 0.001);
        });
        
        it('should account for mesh scale', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const mesh = new THREE.Mesh(geometry);
            mesh.scale.set(5, 10, 15);
            mesh.updateMatrixWorld();
            
            const bbox = validateBoundingBox(mesh);
            
            expect(bbox.size.x).to.be.closeTo(5, 0.001);
            expect(bbox.size.y).to.be.closeTo(10, 0.001);
            expect(bbox.size.z).to.be.closeTo(15, 0.001);
        });
        
        it('should return null for mesh without geometry', function() {
            const bbox = validateBoundingBox({});
            expect(bbox).to.be.null;
        });
    });
    
    describe('checkManifold()', function() {
        
        it('should verify box is manifold (V-E+F=2)', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const mesh = new THREE.Mesh(geometry);
            
            const result = checkManifold(mesh);
            
            // Box: 8 vertices, 12 edges, 6 faces (but each face = 2 triangles = 12 triangles)
            // For triangulated mesh: V=8, E=18, F=12 → 8-18+12=2 ✓
            expect(result.isManifold).to.be.true;
            expect(result.euler).to.equal(2);
        });
        
        it('should verify sphere is manifold', function() {
            const geometry = new THREE.SphereGeometry(1, 16, 8);
            const mesh = new THREE.Mesh(geometry);
            
            const result = checkManifold(mesh);
            
            expect(result.isManifold).to.be.true;
            expect(result.euler).to.equal(2);
        });
        
        it('should verify cylinder is manifold', function() {
            const geometry = new THREE.CylinderGeometry(1, 1, 2, 16);
            const mesh = new THREE.Mesh(geometry);
            
            const result = checkManifold(mesh);
            
            expect(result.isManifold).to.be.true;
            expect(result.euler).to.equal(2);
        });
        
        it('should return topology info (V, E, F)', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const mesh = new THREE.Mesh(geometry);
            
            const result = checkManifold(mesh);
            
            expect(result).to.have.property('vertices');
            expect(result).to.have.property('edges');
            expect(result).to.have.property('faces');
            expect(result.vertices).to.be.above(0);
            expect(result.edges).to.be.above(0);
            expect(result.faces).to.be.above(0);
        });
        
        it('should handle mesh without geometry', function() {
            const result = checkManifold({});
            
            expect(result.isManifold).to.be.false;
            expect(result.error).to.equal('No geometry');
        });
    });
    
    describe('getMeshStats()', function() {
        
        it('should return complete mesh statistics', function() {
            const geometry = new THREE.BoxGeometry(10, 10, 10);
            const mesh = new THREE.Mesh(geometry);
            mesh.updateMatrixWorld();
            
            const stats = getMeshStats(mesh);
            
            expect(stats).to.have.property('volume');
            expect(stats).to.have.property('boundingBox');
            expect(stats).to.have.property('manifold');
            expect(stats).to.have.property('vertexCount');
            expect(stats).to.have.property('faceCount');
            
            expect(stats.volume).to.be.closeTo(1000, 1);
            expect(stats.manifold.isManifold).to.be.true;
        });
    });
});

describe('Vector Math', function() {
    
    describe('THREE.Vector3', function() {
        
        it('should correctly calculate cross product', function() {
            const a = new THREE.Vector3(1, 0, 0);
            const b = new THREE.Vector3(0, 1, 0);
            const cross = new THREE.Vector3().crossVectors(a, b);
            
            expect(cross.x).to.equal(0);
            expect(cross.y).to.equal(0);
            expect(cross.z).to.equal(1);
        });
        
        it('should correctly calculate dot product', function() {
            const a = new THREE.Vector3(1, 2, 3);
            const b = new THREE.Vector3(4, 5, 6);
            const dot = a.dot(b);
            
            // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
            expect(dot).to.equal(32);
        });
        
        it('should correctly calculate vector length', function() {
            const v = new THREE.Vector3(3, 4, 0);
            
            // 3-4-5 triangle
            expect(v.length()).to.equal(5);
        });
        
        it('should correctly normalize vector', function() {
            const v = new THREE.Vector3(3, 4, 0).normalize();
            
            expect(v.length()).to.be.closeTo(1, 0.0001);
            expect(v.x).to.be.closeTo(0.6, 0.0001);
            expect(v.y).to.be.closeTo(0.8, 0.0001);
        });
    });
    
    describe('THREE.Matrix4', function() {
        
        it('should correctly compose translation matrix', function() {
            const matrix = new THREE.Matrix4();
            const position = new THREE.Vector3(10, 20, 30);
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3(1, 1, 1);
            
            matrix.compose(position, quaternion, scale);
            
            const extractedPos = new THREE.Vector3();
            extractedPos.setFromMatrixPosition(matrix);
            
            expect(extractedPos.x).to.equal(10);
            expect(extractedPos.y).to.equal(20);
            expect(extractedPos.z).to.equal(30);
        });
        
        it('should correctly apply scale transformation', function() {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            geometry.computeBoundingBox();
            
            const matrix = new THREE.Matrix4().makeScale(2, 3, 4);
            geometry.applyMatrix4(matrix);
            geometry.computeBoundingBox();
            
            const size = new THREE.Vector3();
            geometry.boundingBox.getSize(size);
            
            expect(size.x).to.be.closeTo(2, 0.001);
            expect(size.y).to.be.closeTo(3, 0.001);
            expect(size.z).to.be.closeTo(4, 0.001);
        });
    });
});

describe('Angle Conversions', function() {
    
    it('should convert degrees to radians correctly', function() {
        expect(THREE.MathUtils.degToRad(0)).to.equal(0);
        expect(THREE.MathUtils.degToRad(90)).to.be.closeTo(Math.PI / 2, 0.0001);
        expect(THREE.MathUtils.degToRad(180)).to.be.closeTo(Math.PI, 0.0001);
        expect(THREE.MathUtils.degToRad(360)).to.be.closeTo(Math.PI * 2, 0.0001);
    });
    
    it('should convert radians to degrees correctly', function() {
        expect(THREE.MathUtils.radToDeg(0)).to.equal(0);
        expect(THREE.MathUtils.radToDeg(Math.PI / 2)).to.be.closeTo(90, 0.0001);
        expect(THREE.MathUtils.radToDeg(Math.PI)).to.be.closeTo(180, 0.0001);
        expect(THREE.MathUtils.radToDeg(Math.PI * 2)).to.be.closeTo(360, 0.0001);
    });
});
