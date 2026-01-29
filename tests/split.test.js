/**
 * Ameri-CAD Split Body Operation Tests
 * Tests for splitting solid bodies using planes, faces, or surfaces
 *
 * Split operation uses OpenCASCADE's BOPAlgo_Splitter to divide
 * bodies into multiple pieces.
 */

import { KernelBridge } from '../src/kernel/bridge.js';
import { isValidSolid, hasValidNormals, hasValidIndices } from './kernel-primitives.test.js';

let kernel;

// ==================== Test Utilities ====================

/**
 * Sum volumes of all pieces
 * @param {Array<{volume: number}>} pieces
 * @returns {number}
 */
function totalVolume(pieces) {
  return pieces.reduce((sum, p) => sum + p.volume, 0);
}

// ==================== Test Suite ====================

describe('Split Body Operations', function () {
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

  // ==================== Basic Split with Standard Planes ====================

  describe('Split with Standard Planes', function () {
    it('splits a box with XY plane into 2 pieces', async function () {
      // Create a 20x20x20 box centered at origin
      const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
      const { volume: originalVolume } = await kernel.getVolume(box.id);

      // Split with XY plane (normal in Z direction, passes through origin)
      const result = await kernel.splitWithPlane(box.id, 'xy');

      expect(result.pieces).to.be.an('array');
      expect(result.pieces.length).to.equal(2);

      // Verify each piece has valid mesh
      for (const piece of result.pieces) {
        expect(piece.shapeId).to.be.a('string');
        expect(piece.mesh).to.exist;
        expect(piece.mesh.vertices.length).to.be.greaterThan(0);
        expect(piece.volume).to.be.greaterThan(0);

        // Validate solid
        const valid = await isValidSolid(kernel, piece.shapeId);
        expect(valid).to.be.true;
      }

      // Total volume should equal original (within tolerance)
      const total = totalVolume(result.pieces);
      expect(total).to.be.closeTo(originalVolume, 0.01);

      // Each piece should be approximately half
      const expectedHalf = originalVolume / 2;
      for (const piece of result.pieces) {
        expect(piece.volume).to.be.closeTo(expectedHalf, 0.01);
      }

      // Cleanup
      await kernel.deleteShape(box.id);
      for (const piece of result.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
    });

    it('splits a box with XZ plane into 2 pieces', async function () {
      const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
      const { volume: originalVolume } = await kernel.getVolume(box.id);

      const result = await kernel.splitWithPlane(box.id, 'xz');

      expect(result.pieces.length).to.equal(2);

      const total = totalVolume(result.pieces);
      expect(total).to.be.closeTo(originalVolume, 0.01);

      // Cleanup
      await kernel.deleteShape(box.id);
      for (const piece of result.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
    });

    it('splits a box with YZ plane into 2 pieces', async function () {
      const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
      const { volume: originalVolume } = await kernel.getVolume(box.id);

      const result = await kernel.splitWithPlane(box.id, 'yz');

      expect(result.pieces.length).to.equal(2);

      const total = totalVolume(result.pieces);
      expect(total).to.be.closeTo(originalVolume, 0.01);

      // Cleanup
      await kernel.deleteShape(box.id);
      for (const piece of result.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
    });
  });

  // ==================== Split Cylinder ====================

  describe('Split Cylinder', function () {
    it('splits a cylinder with angled plane', async function () {
      // Create a cylinder with radius 10, height 30
      const cyl = await kernel.createCylinder(10, 30, { x: 0, y: 0, z: 0 });
      const { volume: originalVolume } = await kernel.getVolume(cyl.id);

      // Split with custom angled plane (45 degree angle)
      const result = await kernel.splitWithPlane(cyl.id, 'custom', {
        origin: [0, 0, 15], // Middle of cylinder
        normal: [1, 0, 1], // 45-degree angled normal
      });

      expect(result.pieces).to.be.an('array');
      expect(result.pieces.length).to.be.greaterThanOrEqual(2);

      // Total volume should equal original
      const total = totalVolume(result.pieces);
      expect(total).to.be.closeTo(originalVolume, 0.1);

      // Each piece should be a valid solid
      for (const piece of result.pieces) {
        const valid = await isValidSolid(kernel, piece.shapeId);
        expect(valid).to.be.true;
      }

      // Cleanup
      await kernel.deleteShape(cyl.id);
      for (const piece of result.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
    });

    it('splits a cylinder horizontally', async function () {
      const cyl = await kernel.createCylinder(10, 30, { x: 0, y: 0, z: 0 });
      const { volume: originalVolume } = await kernel.getVolume(cyl.id);

      // Split with XY plane at z=15 (middle)
      const result = await kernel.splitWithPlane(cyl.id, 'xy', {
        offset: 15, // Offset from origin along Z
      });

      expect(result.pieces.length).to.equal(2);

      // Each half should be approximately equal
      const expectedHalf = originalVolume / 2;
      for (const piece of result.pieces) {
        expect(piece.volume).to.be.closeTo(expectedHalf, 0.1);
      }

      // Cleanup
      await kernel.deleteShape(cyl.id);
      for (const piece of result.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
    });
  });

  // ==================== Split with Offset Planes ====================

  describe('Split with Offset Planes', function () {
    it('splits at non-origin position using offset', async function () {
      // Create a box that is NOT centered at origin
      const box = await kernel.createBox(30, 30, 30, { x: 0, y: 0, z: 0 });
      const { volume: originalVolume } = await kernel.getVolume(box.id);

      // Split at z = 5 (not through center)
      const result = await kernel.splitWithPlane(box.id, 'xy', {
        offset: 5,
      });

      expect(result.pieces.length).to.equal(2);

      // Pieces should have different volumes (not equal halves)
      // One piece should be smaller (5mm thick), one larger (25mm thick)
      // Actually the box is from -15 to +15 in Z, so offset 5 gives pieces of 20mm and 10mm thickness

      // Total should still equal original
      const total = totalVolume(result.pieces);
      expect(total).to.be.closeTo(originalVolume, 0.01);

      // Cleanup
      await kernel.deleteShape(box.id);
      for (const piece of result.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
    });

    it('splits with custom origin point', async function () {
      const box = await kernel.createBox(20, 20, 20, { x: 10, y: 10, z: 10 });
      const { volume: originalVolume } = await kernel.getVolume(box.id);

      // Split with plane passing through box center
      const result = await kernel.splitWithPlane(box.id, 'custom', {
        origin: [10, 10, 10],
        normal: [0, 0, 1],
      });

      expect(result.pieces.length).to.equal(2);

      // Each piece should be half
      const expectedHalf = originalVolume / 2;
      for (const piece of result.pieces) {
        expect(piece.volume).to.be.closeTo(expectedHalf, 0.01);
      }

      // Cleanup
      await kernel.deleteShape(box.id);
      for (const piece of result.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
    });
  });

  // ==================== Split with Tool Shape ====================

  describe('Split with Tool Shape', function () {
    it('splits body using a manually created split plane', async function () {
      const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
      const { volume: originalVolume } = await kernel.getVolume(box.id);

      // Create a split plane manually
      const plane = await kernel.createSplitPlane([0, 0, 0], [0, 0, 1], 100);

      // Split using the plane as tool
      const result = await kernel.splitBody(box.id, plane.id);

      expect(result.pieces.length).to.equal(2);

      const total = totalVolume(result.pieces);
      expect(total).to.be.closeTo(originalVolume, 0.01);

      // Cleanup
      await kernel.deleteShape(box.id);
      await kernel.deleteShape(plane.id);
      for (const piece of result.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
    });
  });

  // ==================== Volume Conservation ====================

  describe('Volume Conservation', function () {
    it('preserves total volume when splitting sphere', async function () {
      const sphere = await kernel.createSphere(15, { x: 0, y: 0, z: 0 });
      const { volume: originalVolume } = await kernel.getVolume(sphere.id);

      const result = await kernel.splitWithPlane(sphere.id, 'xy');

      expect(result.pieces.length).to.equal(2);

      // Total volume must be conserved
      const total = totalVolume(result.pieces);
      expect(total).to.be.closeTo(originalVolume, 0.5); // Slightly larger tolerance for curved surfaces

      // Cleanup
      await kernel.deleteShape(sphere.id);
      for (const piece of result.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
    });

    it('preserves total volume when splitting cone', async function () {
      const cone = await kernel.createCone(15, 5, 30, { x: 0, y: 0, z: 0 });
      const { volume: originalVolume } = await kernel.getVolume(cone.id);

      const result = await kernel.splitWithPlane(cone.id, 'xy', { offset: 15 });

      expect(result.pieces.length).to.equal(2);

      const total = totalVolume(result.pieces);
      expect(total).to.be.closeTo(originalVolume, 0.5);

      // Cleanup
      await kernel.deleteShape(cone.id);
      for (const piece of result.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
    });
  });

  // ==================== Error Handling ====================

  describe('Error Handling', function () {
    it('throws error when plane does not intersect body', async function () {
      // Create a box at z = 50 (far from origin)
      const box = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 50 });

      // Try to split with XY plane at origin - should not intersect
      try {
        await kernel.splitWithPlane(box.id, 'xy');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('intersect');
      }

      // Cleanup
      await kernel.deleteShape(box.id);
    });

    it('throws error for invalid plane name', async function () {
      const box = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });

      try {
        await kernel.splitWithPlane(box.id, 'invalid_plane');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Unknown plane');
      }

      // Cleanup
      await kernel.deleteShape(box.id);
    });

    it('throws error when custom plane missing normal', async function () {
      const box = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });

      try {
        await kernel.splitWithPlane(box.id, 'custom', {
          origin: [0, 0, 0],
          // normal is missing
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('normal');
      }

      // Cleanup
      await kernel.deleteShape(box.id);
    });

    it('throws error for non-existent shape', async function () {
      try {
        await kernel.splitWithPlane('non_existent_shape_id', 'xy');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('not found');
      }
    });
  });

  // ==================== Mesh Validity ====================

  describe('Mesh Validity', function () {
    it('produces valid meshes for each piece', async function () {
      const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });

      const result = await kernel.splitWithPlane(box.id, 'xy');

      for (const piece of result.pieces) {
        const { mesh } = piece;

        // Check mesh structure
        expect(mesh.vertices).to.be.instanceOf(Float32Array);
        expect(mesh.normals).to.be.instanceOf(Float32Array);
        expect(mesh.indices).to.be.instanceOf(Uint32Array);

        // Check valid normals
        expect(hasValidNormals(mesh)).to.be.true;

        // Check valid indices
        expect(hasValidIndices(mesh)).to.be.true;

        // Vertices count should match normals count
        expect(mesh.vertices.length).to.equal(mesh.normals.length);
      }

      // Cleanup
      await kernel.deleteShape(box.id);
      for (const piece of result.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
    });
  });

  // ==================== Multiple Splits ====================

  describe('Multiple Splits', function () {
    it('can split a piece that was already split', async function () {
      const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
      const { volume: originalVolume } = await kernel.getVolume(box.id);

      // First split with XY plane
      const result1 = await kernel.splitWithPlane(box.id, 'xy');
      expect(result1.pieces.length).to.equal(2);

      // Split one of the pieces again with XZ plane
      const piece1 = result1.pieces[0];
      const result2 = await kernel.splitWithPlane(piece1.shapeId, 'xz');
      expect(result2.pieces.length).to.equal(2);

      // Each final piece should be ~1/4 of original
      const expectedQuarter = originalVolume / 4;
      for (const piece of result2.pieces) {
        expect(piece.volume).to.be.closeTo(expectedQuarter, 0.01);
      }

      // Cleanup
      await kernel.deleteShape(box.id);
      for (const piece of result1.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
      for (const piece of result2.pieces) {
        await kernel.deleteShape(piece.shapeId);
      }
    });
  });
});
