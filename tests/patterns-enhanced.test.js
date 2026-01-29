/**
 * Ameri-CAD Enhanced Pattern System Tests
 *
 * Comprehensive tests for the enhanced pattern functionality:
 * - Linear patterns (single direction)
 * - Linear patterns (2D grid)
 * - Circular patterns (full 360°)
 * - Circular patterns (partial angle)
 * - Mirror across planes
 * - Mirror with fuse (symmetric parts)
 * - Pattern along path
 * - Feature-level patterns (parametric)
 */

import { KernelBridge } from '../src/kernel/bridge.js';
import {
  DocumentModel,
  LinearPatternFeature,
  CircularPatternFeature,
  PathPatternFeature,
  MirrorFeature,
  BoxFeature,
  CylinderFeature,
} from '../src/state/document.js';

// ==================== Test Utilities ====================

/**
 * Check if mesh has valid structure
 */
function isValidMesh(mesh) {
  if (!mesh) return false;
  if (!mesh.vertices || mesh.vertices.length === 0) return false;
  if (!mesh.indices || mesh.indices.length === 0) return false;
  if (mesh.indices.length % 3 !== 0) return false;
  return true;
}

/**
 * Get bounding box from mesh
 */
function getBoundingBox(mesh) {
  if (!mesh.vertices || mesh.vertices.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (let i = 0; i < mesh.vertices.length; i += 3) {
    const x = mesh.vertices[i];
    const y = mesh.vertices[i + 1];
    const z = mesh.vertices[i + 2];

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
    width: maxX - minX,
    height: maxY - minY,
    depth: maxZ - minZ,
  };
}

/**
 * Calculate approximate volume from bounding box
 */
function _getBoundingVolume(mesh) {
  const bbox = getBoundingBox(mesh);
  if (!bbox) return 0;
  return bbox.width * bbox.height * bbox.depth;
}

// ==================== Test Suite ====================

describe('Enhanced Pattern System', function () {
  // Increase timeout for kernel operations
  this.timeout(60000);

  let kernel;

  before(async function () {
    kernel = new KernelBridge();
    await kernel.init();
  });

  after(function () {
    if (kernel) {
      kernel.terminate();
    }
  });

  // ==================== Linear Pattern Tests ====================

  describe('Linear Pattern - Single Direction', function () {
    it('should create a linear pattern of 5 boxes along X axis', async function () {
      const box = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });
      expect(box.id).to.exist;

      const pattern = await kernel.linearPattern(box.id, [1, 0, 0], 5, 20);

      expect(pattern.id).to.exist;
      expect(pattern.mesh).to.exist;
      expect(isValidMesh(pattern.mesh)).to.be.true;
      expect(pattern.count).to.equal(5);
      expect(pattern.spacing).to.equal(20);

      // Verify bounding box spans the expected range
      // 5 boxes of 10mm width, spaced 20mm apart: 10 + 4*20 = 90mm total
      const bbox = getBoundingBox(pattern.mesh);
      expect(bbox.width).to.be.closeTo(90, 1);

      // Cleanup
      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should create a linear pattern along Y axis', async function () {
      const cylinder = await kernel.createCylinder(5, 20, { x: 0, y: 0, z: 0 });
      expect(cylinder.id).to.exist;

      const pattern = await kernel.linearPattern(cylinder.id, [0, 1, 0], 3, 25);

      expect(pattern.id).to.exist;
      expect(pattern.count).to.equal(3);

      const bbox = getBoundingBox(pattern.mesh);
      // 3 cylinders with diameter 10, spaced 25mm: depth = 10 + 2*25 = 60mm
      expect(bbox.height).to.be.closeTo(60, 2);

      await kernel.deleteShape(cylinder.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should create a linear pattern along Z axis', async function () {
      const box = await kernel.createBox(5, 5, 5, { x: 0, y: 0, z: 0 });

      const pattern = await kernel.linearPattern(box.id, [0, 0, 1], 4, 10);

      expect(pattern.count).to.equal(4);
      const bbox = getBoundingBox(pattern.mesh);
      // 4 boxes of 5mm depth, spaced 10mm: 5 + 3*10 = 35mm
      expect(bbox.depth).to.be.closeTo(35, 1);

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should create a linear pattern along negative direction', async function () {
      const box = await kernel.createBox(10, 10, 10, { x: 50, y: 0, z: 0 });

      const pattern = await kernel.linearPattern(box.id, [-1, 0, 0], 3, 15);

      expect(pattern.count).to.equal(3);
      const bbox = getBoundingBox(pattern.mesh);
      // Pattern extends in negative X from 50 to 50-30 = 20
      expect(bbox.min.x).to.be.lessThan(30);

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should handle diagonal direction vectors', async function () {
      const box = await kernel.createBox(5, 5, 5, { x: 0, y: 0, z: 0 });

      // 45° diagonal in XY plane
      const direction = [1, 1, 0];
      const pattern = await kernel.linearPattern(box.id, direction, 3, 10);

      expect(pattern.count).to.equal(3);
      const bbox = getBoundingBox(pattern.mesh);

      // Diagonal pattern should extend in both X and Y
      expect(bbox.width).to.be.greaterThan(10);
      expect(bbox.height).to.be.greaterThan(10);

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });
  });

  // ==================== Grid Pattern Tests ====================

  describe('Linear Pattern - 2D Grid', function () {
    it('should create a 3x4 grid pattern', async function () {
      const box = await kernel.createBox(5, 5, 5, { x: 0, y: 0, z: 0 });

      const pattern = await kernel.linearPatternGrid(
        box.id,
        [1, 0, 0], // X direction
        3, // 3 copies in X
        15, // 15mm spacing in X
        [0, 1, 0], // Y direction
        4, // 4 copies in Y
        12 // 12mm spacing in Y
      );

      expect(pattern.id).to.exist;
      expect(pattern.totalCopies).to.equal(12); // 3 * 4 = 12
      expect(pattern.count1).to.equal(3);
      expect(pattern.count2).to.equal(4);

      const bbox = getBoundingBox(pattern.mesh);
      // X: 5 + 2*15 = 35mm, Y: 5 + 3*12 = 41mm
      expect(bbox.width).to.be.closeTo(35, 2);
      expect(bbox.height).to.be.closeTo(41, 2);

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should create a 5x2 grid with different spacings', async function () {
      const cylinder = await kernel.createCylinder(3, 10, { x: 0, y: 0, z: 0 });

      const pattern = await kernel.linearPatternGrid(
        cylinder.id,
        [1, 0, 0],
        5,
        10,
        [0, 0, 1],
        2,
        20
      );

      expect(pattern.totalCopies).to.equal(10);

      await kernel.deleteShape(cylinder.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should degenerate to 1D pattern when count2 is 1', async function () {
      const box = await kernel.createBox(5, 5, 5, { x: 0, y: 0, z: 0 });

      const pattern = await kernel.linearPatternGrid(
        box.id,
        [1, 0, 0],
        4,
        10,
        null, // no second direction
        1,
        0
      );

      expect(pattern.totalCopies).to.equal(4);
      expect(pattern.count1).to.equal(4);
      expect(pattern.count2).to.equal(1);

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should handle XZ grid plane', async function () {
      const box = await kernel.createBox(5, 5, 5, { x: 0, y: 0, z: 0 });

      const pattern = await kernel.linearPatternGrid(
        box.id,
        [1, 0, 0], // X
        2,
        20,
        [0, 0, 1], // Z
        3,
        15
      );

      expect(pattern.totalCopies).to.equal(6);

      const bbox = getBoundingBox(pattern.mesh);
      expect(bbox.height).to.be.closeTo(5, 1); // Y unchanged
      expect(bbox.depth).to.be.greaterThan(30); // Z extended

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });
  });

  // ==================== Circular Pattern Tests ====================

  describe('Circular Pattern - Full 360°', function () {
    it('should create 8 copies around Z axis (full circle)', async function () {
      const box = await kernel.createBox(10, 5, 5, { x: 30, y: 0, z: 0 });

      const pattern = await kernel.circularPattern(box.id, 8, 360, [0, 0, 0], [0, 0, 1]);

      expect(pattern.id).to.exist;
      expect(pattern.copies).to.equal(8);

      // Pattern should be roughly circular
      const bbox = getBoundingBox(pattern.mesh);
      const avgRadius = (bbox.width + bbox.height) / 4;
      expect(bbox.width).to.be.closeTo(bbox.height, avgRadius * 0.2);

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should create 6 copies around Y axis', async function () {
      const cylinder = await kernel.createCylinder(3, 15, { x: 20, y: 0, z: 0 });

      const pattern = await kernel.circularPattern(cylinder.id, 6, 360, [0, 0, 0], [0, 1, 0]);

      expect(pattern.copies).to.equal(6);

      await kernel.deleteShape(cylinder.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should create 4 copies (90° apart) around X axis', async function () {
      const box = await kernel.createBox(5, 5, 5, { x: 0, y: 0, z: 20 });

      const pattern = await kernel.circularPattern(box.id, 4, 360, [0, 0, 0], [1, 0, 0]);

      expect(pattern.copies).to.equal(4);

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });
  });

  describe('Circular Pattern - Partial Angle', function () {
    it('should create 6 copies spanning 180°', async function () {
      const box = await kernel.createBox(5, 5, 5, { x: 25, y: 0, z: 0 });

      const pattern = await kernel.circularPattern(box.id, 6, 180, [0, 0, 0], [0, 0, 1]);

      expect(pattern.copies).to.equal(6);

      // Pattern should only span half the circle
      const bbox = getBoundingBox(pattern.mesh);
      // For 180°, we expect the pattern to be asymmetric
      expect(bbox).to.exist;
      expect(bbox.width).to.be.greaterThan(0);

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should create 3 copies spanning 90°', async function () {
      const cylinder = await kernel.createCylinder(3, 10, { x: 20, y: 0, z: 0 });

      const pattern = await kernel.circularPattern(cylinder.id, 3, 90, [0, 0, 0], [0, 0, 1]);

      expect(pattern.copies).to.equal(3);
      // Angle step = 90/3 = 30° between copies

      await kernel.deleteShape(cylinder.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should create 12 copies spanning 270°', async function () {
      const box = await kernel.createBox(4, 4, 4, { x: 15, y: 0, z: 0 });

      const pattern = await kernel.circularPattern(box.id, 12, 270, [0, 0, 0], [0, 0, 1]);

      expect(pattern.copies).to.equal(12);

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });
  });

  // ==================== Mirror Tests ====================

  describe('Mirror Across Planes', function () {
    it('should mirror across XY plane', async function () {
      const box = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 20 });

      const mirrored = await kernel.mirror(box.id, 'xy');

      expect(mirrored.id).to.exist;
      expect(isValidMesh(mirrored.mesh)).to.be.true;

      // Original at z=20, mirrored should be at z=-20
      const bbox = getBoundingBox(mirrored.mesh);
      expect(bbox.max.z).to.be.lessThan(0);
      expect(bbox.min.z).to.be.closeTo(-25, 1);

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(mirrored.id);
    });

    it('should mirror across XZ plane', async function () {
      const cylinder = await kernel.createCylinder(5, 20, { x: 0, y: 30, z: 0 });

      const mirrored = await kernel.mirror(cylinder.id, 'xz');

      const bbox = getBoundingBox(mirrored.mesh);
      expect(bbox.max.y).to.be.lessThan(0);

      await kernel.deleteShape(cylinder.id);
      await kernel.deleteShape(mirrored.id);
    });

    it('should mirror across YZ plane', async function () {
      const box = await kernel.createBox(10, 10, 10, { x: 25, y: 0, z: 0 });

      const mirrored = await kernel.mirror(box.id, 'yz');

      const bbox = getBoundingBox(mirrored.mesh);
      expect(bbox.max.x).to.be.lessThan(0);
      expect(bbox.min.x).to.be.closeTo(-30, 1);

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(mirrored.id);
    });
  });

  describe('Mirror with Fuse (Symmetric Parts)', function () {
    it('should create symmetric part by mirroring and fusing', async function () {
      const box = await kernel.createBox(20, 10, 10, { x: 15, y: 0, z: 0 });

      const symmetric = await kernel.mirrorSymmetric(box.id, 'yz', true);

      expect(symmetric.id).to.exist;
      expect(symmetric.type).to.equal('mirrorSymmetric');

      // Symmetric part should span both sides of YZ plane
      const bbox = getBoundingBox(symmetric.mesh);
      expect(bbox.min.x).to.be.lessThan(0);
      expect(bbox.max.x).to.be.greaterThan(0);

      // Width should be approximately double (2 * 20 + overlap)
      expect(bbox.width).to.be.greaterThan(35);

      await kernel.deleteShape(box.id);
      await kernel.deleteShape(symmetric.id);
    });

    it('should handle mirror without fuse', async function () {
      const cylinder = await kernel.createCylinder(5, 20, { x: 20, y: 0, z: 0 });

      const mirrored = await kernel.mirrorSymmetric(cylinder.id, 'yz', false);

      // Without keepOriginal, should just be the mirrored copy
      const bbox = getBoundingBox(mirrored.mesh);
      expect(bbox.max.x).to.be.lessThan(0);

      await kernel.deleteShape(cylinder.id);
      await kernel.deleteShape(mirrored.id);
    });
  });

  // ==================== Pattern Along Path Tests ====================

  describe('Pattern Along Path', function () {
    it('should pattern along a straight line path', async function () {
      // Create a line wire as path
      const path = await kernel.createLineWire({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 });
      expect(path.id).to.exist;

      // Create shape to pattern
      const box = await kernel.createBox(5, 5, 5, { x: 0, y: 0, z: 0 });

      // Pattern 5 copies along path
      const pattern = await kernel.patternAlongPath(box.id, path.id, 5, false);

      expect(pattern.id).to.exist;
      expect(pattern.copies).to.equal(5);

      const bbox = getBoundingBox(pattern.mesh);
      // Should span from 0 to 100 in X
      expect(bbox.width).to.be.closeTo(105, 5); // 100 + box width

      await kernel.deleteShape(path.id);
      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should pattern along an arc path', async function () {
      // Create an arc wire as path
      const path = await kernel.createArcWire(
        { x: 20, y: 0, z: 0 },
        { x: 0, y: 20, z: 0 },
        { x: -20, y: 0, z: 0 }
      );
      expect(path.id).to.exist;

      const sphere = await kernel.createSphere(2, { x: 0, y: 0, z: 0 });

      const pattern = await kernel.patternAlongPath(sphere.id, path.id, 7, false);

      expect(pattern.copies).to.equal(7);

      await kernel.deleteShape(path.id);
      await kernel.deleteShape(sphere.id);
      await kernel.deleteShape(pattern.id);
    });

    it('should handle single copy along path (start position)', async function () {
      const path = await kernel.createLineWire({ x: 0, y: 0, z: 0 }, { x: 50, y: 0, z: 0 });
      const box = await kernel.createBox(5, 5, 5, { x: 0, y: 0, z: 0 });

      const pattern = await kernel.patternAlongPath(box.id, path.id, 1, false);

      expect(pattern.copies).to.equal(1);

      await kernel.deleteShape(path.id);
      await kernel.deleteShape(box.id);
      await kernel.deleteShape(pattern.id);
    });
  });

  // ==================== Feature Model Tests ====================

  describe('Pattern Feature Classes', function () {
    describe('LinearPatternFeature', function () {
      it('should create with default parameters', function () {
        const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
        const pattern = new LinearPatternFeature(box.id);

        expect(pattern.type).to.equal('linearPattern');
        expect(pattern.params.direction1).to.deep.equal([1, 0, 0]);
        expect(pattern.params.count1).to.equal(3);
        expect(pattern.params.spacing1).to.equal(10);
        expect(pattern.params.count2).to.equal(1);
        expect(pattern.dependencies).to.include(box.id);
      });

      it('should identify grid patterns', function () {
        const box = new BoxFeature({});
        const linearPattern = new LinearPatternFeature(box.id, {
          direction1: [1, 0, 0],
          count1: 3,
          spacing1: 10,
        });
        expect(linearPattern.isGrid()).to.be.false;

        const gridPattern = new LinearPatternFeature(box.id, {
          direction1: [1, 0, 0],
          count1: 3,
          spacing1: 10,
          direction2: [0, 1, 0],
          count2: 4,
          spacing2: 15,
        });
        expect(gridPattern.isGrid()).to.be.true;
        expect(gridPattern.getTotalCopies()).to.equal(12);
      });
    });

    describe('CircularPatternFeature', function () {
      it('should create with default parameters', function () {
        const cylinder = new CylinderFeature({ radius: 5, height: 20 });
        const pattern = new CircularPatternFeature(cylinder.id);

        expect(pattern.type).to.equal('circularPattern');
        expect(pattern.params.axisDirection).to.deep.equal([0, 0, 1]);
        expect(pattern.params.count).to.equal(6);
        expect(pattern.params.totalAngle).to.equal(360);
        expect(pattern.dependencies).to.include(cylinder.id);
      });

      it('should identify full circle patterns', function () {
        const cylinder = new CylinderFeature({});
        const fullCircle = new CircularPatternFeature(cylinder.id, {
          count: 8,
          totalAngle: 360,
        });
        expect(fullCircle.isFullCircle()).to.be.true;

        const partial = new CircularPatternFeature(cylinder.id, {
          count: 6,
          totalAngle: 180,
        });
        expect(partial.isFullCircle()).to.be.false;
        expect(partial.getAngleStep()).to.equal(30);
      });
    });

    describe('PathPatternFeature', function () {
      it('should create with source and path dependencies', function () {
        const box = new BoxFeature({});
        const pathId = 'path_1';
        const pattern = new PathPatternFeature(box.id, pathId, {
          count: 10,
          orientToPath: true,
        });

        expect(pattern.type).to.equal('pathPattern');
        expect(pattern.params.count).to.equal(10);
        expect(pattern.params.orientToPath).to.be.true;
        expect(pattern.dependencies).to.include(box.id);
        expect(pattern.dependencies).to.include(pathId);
      });
    });

    describe('MirrorFeature', function () {
      it('should create with default plane', function () {
        const box = new BoxFeature({});
        const mirror = new MirrorFeature(box.id);

        expect(mirror.type).to.equal('mirror');
        expect(mirror.params.plane).to.equal('yz');
        expect(mirror.params.keepOriginal).to.be.false;
        expect(mirror.dependencies).to.include(box.id);
      });

      it('should support symmetric mode', function () {
        const box = new BoxFeature({});
        const mirror = new MirrorFeature(box.id, {
          plane: 'xz',
          keepOriginal: true,
        });

        expect(mirror.params.plane).to.equal('xz');
        expect(mirror.params.keepOriginal).to.be.true;
      });
    });
  });

  // ==================== Document Model Integration ====================

  describe('Document Model Pattern Features', function () {
    let doc;

    beforeEach(function () {
      doc = new DocumentModel();
    });

    it('should serialize and deserialize LinearPatternFeature', function () {
      const box = new BoxFeature({ width: 10, height: 10, depth: 10 });
      const pattern = new LinearPatternFeature(box.id, {
        direction1: [1, 0, 0],
        count1: 5,
        spacing1: 20,
      });

      doc.addFeature(box);
      doc.addFeature(pattern);

      const json = doc.toJSON();
      const restored = DocumentModel.fromJSON(json);

      const restoredPattern = restored.getFeature(pattern.id);
      expect(restoredPattern).to.exist;
      expect(restoredPattern.type).to.equal('linearPattern');
      expect(restoredPattern.params.count1).to.equal(5);
      expect(restoredPattern.params.spacing1).to.equal(20);
      expect(restoredPattern.dependencies).to.include(box.id);
    });

    it('should serialize and deserialize CircularPatternFeature', function () {
      const cylinder = new CylinderFeature({ radius: 5, height: 20 });
      const pattern = new CircularPatternFeature(cylinder.id, {
        count: 8,
        totalAngle: 180,
      });

      doc.addFeature(cylinder);
      doc.addFeature(pattern);

      const json = doc.toJSON();
      const restored = DocumentModel.fromJSON(json);

      const restoredPattern = restored.getFeature(pattern.id);
      expect(restoredPattern.type).to.equal('circularPattern');
      expect(restoredPattern.params.count).to.equal(8);
      expect(restoredPattern.params.totalAngle).to.equal(180);
    });

    it('should track pattern dependencies correctly', function () {
      const box = new BoxFeature({});
      const pattern = new LinearPatternFeature(box.id, { count1: 3 });

      doc.addFeature(box);
      doc.addFeature(pattern);

      expect(doc.getDependents(box.id)).to.include(pattern.id);
    });

    it('should update pattern when source feature is removed', function () {
      const box = new BoxFeature({});
      const pattern = new LinearPatternFeature(box.id, { count1: 3 });

      doc.addFeature(box);
      doc.addFeature(pattern);

      // Removing box should also remove the pattern
      doc.removeFeature(box.id);

      expect(doc.getFeature(box.id)).to.be.undefined;
      expect(doc.getFeature(pattern.id)).to.be.undefined;
    });
  });
});
