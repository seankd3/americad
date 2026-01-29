/**
 * Ameri-CAD Loft Operation Tests
 * Tests for the loft operation that creates solids by connecting multiple profiles
 *
 * Loft uses OpenCASCADE's BRepOffsetAPI_ThruSections to create smooth transitions
 * between cross-sectional profiles (wires or faces).
 */

import { KernelBridge } from '../src/kernel/bridge.js';
import {
  getBoundingBox,
  isValidSolid,
  hasValidNormals,
  hasValidIndices,
} from './kernel-primitives.test.js';

let kernel;

// ==================== Test Utilities ====================

/**
 * Create a square wire (closed polygon) on XY plane at given Z height
 * @param {number} size - Side length of square
 * @param {number} z - Z coordinate
 * @param {{x: number, y: number}} center - Center offset
 * @returns {Promise<{id: string}>}
 */
async function createSquareWire(size, z, center = { x: 0, y: 0 }) {
  const half = size / 2;
  const points = [
    { x: center.x - half, y: center.y - half, z },
    { x: center.x + half, y: center.y - half, z },
    { x: center.x + half, y: center.y + half, z },
    { x: center.x - half, y: center.y + half, z },
  ];
  return kernel.createWireFromPolygon(points);
}

/**
 * Create a triangular wire (closed polygon) on XY plane at given Z height
 * @param {number} size - Base and height of triangle
 * @param {number} z - Z coordinate
 * @param {{x: number, y: number}} center - Center offset
 * @returns {Promise<{id: string}>}
 */
async function createTriangleWire(size, z, center = { x: 0, y: 0 }) {
  const half = size / 2;
  const points = [
    { x: center.x, y: center.y + half, z }, // top
    { x: center.x - half, y: center.y - half, z }, // bottom left
    { x: center.x + half, y: center.y - half, z }, // bottom right
  ];
  return kernel.createWireFromPolygon(points);
}

// ==================== Test Suite ====================

describe('Loft Operations', function () {
  this.timeout(60000);

  before(async function () {
    kernel = new KernelBridge();
    await kernel.init();
  });

  after(function () {
    if (kernel) {
      kernel.terminate();
    }
  });

  // ==================== Basic Loft Operations ====================

  describe('Basic Loft Operations', function () {
    it('lofts two circles of different sizes (cone-like)', async function () {
      // Create two circles at different Z heights with different radii
      const bottomCircle = await kernel.createCircleWire(
        { x: 0, y: 0, z: 0 },
        20, // larger radius at bottom
        { x: 0, y: 0, z: 1 }
      );

      const topCircle = await kernel.createCircleWire(
        { x: 0, y: 0, z: 30 },
        10, // smaller radius at top
        { x: 0, y: 0, z: 1 }
      );

      // Loft between them
      const result = await kernel.loft([bottomCircle.id, topCircle.id], true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;
      expect(result.mesh.vertices.length).to.be.greaterThan(0);

      // Validate it's a solid
      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;

      // Check bounding box - should be roughly 40x40x30 (diameter × diameter × height)
      const bbox = getBoundingBox(result.mesh);
      expect(bbox.size.x).to.be.closeTo(40, 2); // diameter of larger circle
      expect(bbox.size.y).to.be.closeTo(40, 2);
      expect(bbox.size.z).to.be.closeTo(30, 1); // height between circles
    });

    it('lofts two circles of same size (cylinder-like)', async function () {
      const bottomCircle = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 15, {
        x: 0,
        y: 0,
        z: 1,
      });

      const topCircle = await kernel.createCircleWire({ x: 0, y: 0, z: 25 }, 15, {
        x: 0,
        y: 0,
        z: 1,
      });

      const result = await kernel.loft([bottomCircle.id, topCircle.id], true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;

      // Volume should be close to a cylinder: π * r² * h
      const { volume } = await kernel.getVolume(result.id);
      const expectedVolume = Math.PI * 15 * 15 * 25;
      expect(volume).to.be.closeTo(expectedVolume, expectedVolume * 0.05);
    });

    it('lofts circle to square (morphing shape)', async function () {
      // Create a circle at z=0
      const circle = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 15, { x: 0, y: 0, z: 1 });

      // Create a square at z=30
      const square = await createSquareWire(25, 30);

      const result = await kernel.loft([circle.id, square.id], true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;
      expect(result.mesh.vertices.length).to.be.greaterThan(0);

      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;

      // Check mesh validity
      expect(hasValidNormals(result.mesh)).to.be.true;
      expect(hasValidIndices(result.mesh)).to.be.true;
    });

    it('lofts two squares (box-like)', async function () {
      const bottomSquare = await createSquareWire(20, 0);
      const topSquare = await createSquareWire(20, 30);

      const result = await kernel.loft([bottomSquare.id, topSquare.id], true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;

      // Bounding box should match expected dimensions
      const bbox = getBoundingBox(result.mesh);
      expect(bbox.size.x).to.be.closeTo(20, 1);
      expect(bbox.size.y).to.be.closeTo(20, 1);
      expect(bbox.size.z).to.be.closeTo(30, 1);
    });

    it('lofts squares of different sizes (pyramid frustum-like)', async function () {
      const bottomSquare = await createSquareWire(30, 0);
      const topSquare = await createSquareWire(10, 40);

      const result = await kernel.loft([bottomSquare.id, topSquare.id], true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;

      const bbox = getBoundingBox(result.mesh);
      expect(bbox.size.x).to.be.closeTo(30, 1); // Max from bottom square
      expect(bbox.size.z).to.be.closeTo(40, 1);
    });
  });

  // ==================== Multi-Profile Lofts ====================

  describe('Multi-Profile Lofts (3+ profiles)', function () {
    it('lofts three circles (varying radii)', async function () {
      const bottom = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 20, { x: 0, y: 0, z: 1 });
      const middle = await kernel.createCircleWire({ x: 0, y: 0, z: 15 }, 10, { x: 0, y: 0, z: 1 });
      const top = await kernel.createCircleWire({ x: 0, y: 0, z: 30 }, 20, { x: 0, y: 0, z: 1 });

      const result = await kernel.loft([bottom.id, middle.id, top.id], true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;

      // Should create an hourglass-like shape
      const bbox = getBoundingBox(result.mesh);
      expect(bbox.size.z).to.be.closeTo(30, 1);
    });

    it('lofts four profiles (complex shape)', async function () {
      const p1 = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 15, { x: 0, y: 0, z: 1 });
      const p2 = await createSquareWire(25, 10);
      const p3 = await kernel.createCircleWire({ x: 0, y: 0, z: 20 }, 12, { x: 0, y: 0, z: 1 });
      const p4 = await createSquareWire(18, 30);

      const result = await kernel.loft([p1.id, p2.id, p3.id, p4.id], true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;

      expect(hasValidNormals(result.mesh)).to.be.true;
      expect(hasValidIndices(result.mesh)).to.be.true;
    });

    it('lofts five circles for a wavy column', async function () {
      const profiles = [];
      const radii = [15, 10, 18, 8, 14];
      const heights = [0, 10, 20, 30, 40];

      for (let i = 0; i < 5; i++) {
        const wire = await kernel.createCircleWire({ x: 0, y: 0, z: heights[i] }, radii[i], {
          x: 0,
          y: 0,
          z: 1,
        });
        profiles.push(wire.id);
      }

      const result = await kernel.loft(profiles, true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;

      const bbox = getBoundingBox(result.mesh);
      expect(bbox.size.z).to.be.closeTo(40, 1);
    });
  });

  // ==================== Surface vs Solid Lofts ====================

  describe('Surface vs Solid Lofts', function () {
    it('creates solid loft (default)', async function () {
      const bottom = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 10, { x: 0, y: 0, z: 1 });
      const top = await kernel.createCircleWire({ x: 0, y: 0, z: 20 }, 10, { x: 0, y: 0, z: 1 });

      const result = await kernel.loft([bottom.id, top.id], true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      // Solid should have volume
      const { volume } = await kernel.getVolume(result.id);
      expect(volume).to.be.greaterThan(0);
    });

    it('creates surface loft (solid=false)', async function () {
      const bottom = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 10, { x: 0, y: 0, z: 1 });
      const top = await kernel.createCircleWire({ x: 0, y: 0, z: 20 }, 10, { x: 0, y: 0, z: 1 });

      const result = await kernel.loft([bottom.id, top.id], false);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;
      expect(result.mesh.vertices.length).to.be.greaterThan(0);
    });
  });

  // ==================== Loft with Faces ====================

  describe('Loft with Faces', function () {
    it('lofts face profiles (extracts outer wire automatically)', async function () {
      // Create wires and convert to faces
      const bottomWire = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 15, {
        x: 0,
        y: 0,
        z: 1,
      });
      const topWire = await kernel.createCircleWire({ x: 0, y: 0, z: 25 }, 15, {
        x: 0,
        y: 0,
        z: 1,
      });

      const bottomFace = await kernel.createFaceFromWire(bottomWire.id, true);
      const topFace = await kernel.createFaceFromWire(topWire.id, true);

      const result = await kernel.loft([bottomFace.id, topFace.id], true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;
    });
  });

  // ==================== Error Handling ====================

  describe('Error Handling', function () {
    it('throws error on single profile', async function () {
      const wire = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 10, { x: 0, y: 0, z: 1 });

      try {
        await kernel.loft([wire.id], true);
        expect.fail('Should have thrown error for single profile');
      } catch (error) {
        expect(error.message).to.include('Loft');
      }
    });

    it('throws error on empty profile array', async function () {
      try {
        await kernel.loft([], true);
        expect.fail('Should have thrown error for empty profiles');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('throws error on invalid profile ID', async function () {
      const validWire = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 10, {
        x: 0,
        y: 0,
        z: 1,
      });

      try {
        await kernel.loft([validWire.id, 'invalid_id_12345'], true);
        expect.fail('Should have thrown error for invalid profile');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  // ==================== Mesh Quality ====================

  describe('Mesh Quality', function () {
    it('produces mesh with valid normals', async function () {
      const bottom = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 15, { x: 0, y: 0, z: 1 });
      const top = await kernel.createCircleWire({ x: 0, y: 0, z: 20 }, 8, { x: 0, y: 0, z: 1 });

      const result = await kernel.loft([bottom.id, top.id], true);

      expect(hasValidNormals(result.mesh)).to.be.true;
    });

    it('produces mesh with valid indices', async function () {
      const bottom = await createSquareWire(20, 0);
      const top = await createSquareWire(10, 25);

      const result = await kernel.loft([bottom.id, top.id], true);

      expect(hasValidIndices(result.mesh)).to.be.true;
    });

    it('produces watertight mesh for solid', async function () {
      const bottom = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 12, { x: 0, y: 0, z: 1 });
      const middle = await kernel.createCircleWire({ x: 0, y: 0, z: 15 }, 18, {
        x: 0,
        y: 0,
        z: 1,
      });
      const top = await kernel.createCircleWire({ x: 0, y: 0, z: 30 }, 12, { x: 0, y: 0, z: 1 });

      const result = await kernel.loft([bottom.id, middle.id, top.id], true);

      // Solid should be valid (closed/watertight)
      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;

      // Should have positive volume
      const { volume } = await kernel.getVolume(result.id);
      expect(volume).to.be.greaterThan(0);
    });
  });

  // ==================== Special Cases ====================

  describe('Special Cases', function () {
    it('handles offset profiles (not centered)', async function () {
      const bottom = await kernel.createCircleWire({ x: 10, y: 20, z: 0 }, 15, {
        x: 0,
        y: 0,
        z: 1,
      });
      const top = await kernel.createCircleWire({ x: 10, y: 20, z: 30 }, 15, { x: 0, y: 0, z: 1 });

      const result = await kernel.loft([bottom.id, top.id], true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      const bbox = getBoundingBox(result.mesh);
      // Center should be offset
      const centerX = (bbox.min.x + bbox.max.x) / 2;
      const centerY = (bbox.min.y + bbox.max.y) / 2;
      expect(centerX).to.be.closeTo(10, 1);
      expect(centerY).to.be.closeTo(20, 1);
    });

    it('handles twisted profiles (rotation between sections)', async function () {
      // Square at z=0
      const bottom = await createSquareWire(20, 0);

      // Rotated square at z=30 (45 degree rotation)
      const half = 10;
      const angle = Math.PI / 4; // 45 degrees
      const cos45 = Math.cos(angle);
      const sin45 = Math.sin(angle);

      // Rotate square by 45 degrees
      const rotatedPoints = [
        { x: -half * cos45 - -half * sin45, y: -half * sin45 + -half * cos45, z: 30 },
        { x: half * cos45 - -half * sin45, y: half * sin45 + -half * cos45, z: 30 },
        { x: half * cos45 - half * sin45, y: half * sin45 + half * cos45, z: 30 },
        { x: -half * cos45 - half * sin45, y: -half * sin45 + half * cos45, z: 30 },
      ];
      const top = await kernel.createWireFromPolygon(rotatedPoints);

      const result = await kernel.loft([bottom.id, top.id], true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;
    });

    it('handles triangle to circle loft', async function () {
      const triangle = await createTriangleWire(25, 0);
      const circle = await kernel.createCircleWire({ x: 0, y: 0, z: 25 }, 15, { x: 0, y: 0, z: 1 });

      const result = await kernel.loft([triangle.id, circle.id], true);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;
    });
  });

  // ==================== Boolean Operations on Lofted Shapes ====================

  describe('Boolean Operations on Lofted Shapes', function () {
    it('can union lofted shape with primitive', async function () {
      // Create a lofted cone-like shape
      const bottom = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 15, { x: 0, y: 0, z: 1 });
      const top = await kernel.createCircleWire({ x: 0, y: 0, z: 20 }, 8, { x: 0, y: 0, z: 1 });
      const lofted = await kernel.loft([bottom.id, top.id], true);

      // Create a box
      const box = await kernel.createBox(10, 10, 30, { x: 0, y: 0, z: 10 });

      // Union them
      const result = await kernel.union(lofted.id, box.id);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;
    });

    it('can subtract from lofted shape', async function () {
      // Create a lofted cylinder-like shape
      const bottom = await kernel.createCircleWire({ x: 0, y: 0, z: 0 }, 20, { x: 0, y: 0, z: 1 });
      const top = await kernel.createCircleWire({ x: 0, y: 0, z: 30 }, 20, { x: 0, y: 0, z: 1 });
      const lofted = await kernel.loft([bottom.id, top.id], true);

      // Create a small cylinder to subtract
      const cyl = await kernel.createCylinder(8, 40, { x: 0, y: 0, z: -5 });

      // Subtract to create a tube
      const result = await kernel.subtract(lofted.id, cyl.id);

      expect(result.id).to.be.a('string');
      expect(result.mesh).to.exist;

      const valid = await isValidSolid(kernel, result.id);
      expect(valid).to.be.true;

      // Volume should be less than original loft
      const { volume: loftedVol } = await kernel.getVolume(lofted.id);
      const { volume: resultVol } = await kernel.getVolume(result.id);
      expect(resultVol).to.be.lessThan(loftedVol);
    });
  });
});
