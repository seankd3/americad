/**
 * Ameri-CAD Offset Command Tests
 * Tests for 2D wire offset and 3D face offset operations
 *
 * 2D Offset uses BRepOffsetAPI_MakeOffset for creating parallel curves
 * 3D Offset uses BRepOffsetAPI_MakeOffsetShape for moving faces
 */

import { KernelBridge } from '../src/kernel/bridge.js';
import { isValidSolid, hasValidNormals, hasValidIndices } from './kernel-primitives.test.js';

let kernel;

// ==================== Test Suite ====================

describe('Offset Operations', function () {
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

  // ==================== 2D Wire Offset ====================

  describe('2D Wire Offset (Sketch)', function () {
    describe('Rectangle Offset', function () {
      it('offsets a rectangle outward', async function () {
        // Create a rectangle wire (10x10)
        const points = [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 10, z: 0 },
          { x: 0, y: 10, z: 0 },
        ];
        const wire = await kernel.createWireFromPolygon(points);
        expect(wire.id).to.be.a('string');

        // Offset outward by 2
        const result = await kernel.offsetWire(wire.id, 2, 'single');

        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('offsetWire');

        // Cleanup
        await kernel.deleteShape(wire.id);
        await kernel.deleteShape(result.id);
      });

      it('offsets a rectangle inward', async function () {
        // Create a rectangle wire (20x20) - larger to avoid self-intersection
        const points = [
          { x: 0, y: 0, z: 0 },
          { x: 20, y: 0, z: 0 },
          { x: 20, y: 20, z: 0 },
          { x: 0, y: 20, z: 0 },
        ];
        const wire = await kernel.createWireFromPolygon(points);

        // Offset inward by -3 (should create smaller rectangle)
        const result = await kernel.offsetWire(wire.id, -3, 'single');

        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('offsetWire');

        // Cleanup
        await kernel.deleteShape(wire.id);
        await kernel.deleteShape(result.id);
      });

      it('creates both inward and outward offsets', async function () {
        // Create a rectangle wire
        const points = [
          { x: 0, y: 0, z: 0 },
          { x: 20, y: 0, z: 0 },
          { x: 20, y: 20, z: 0 },
          { x: 0, y: 20, z: 0 },
        ];
        const wire = await kernel.createWireFromPolygon(points);

        // Offset both directions by 3
        const result = await kernel.offsetWire(wire.id, 3, 'both');

        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('offsetWireBoth');

        // Cleanup
        await kernel.deleteShape(wire.id);
        await kernel.deleteShape(result.id);
      });
    });

    describe('Circle Offset', function () {
      it('offsets a circle outward', async function () {
        // Create a circle wire
        const circle = await kernel.createCircleWire(
          { x: 0, y: 0, z: 0 },
          10,
          { x: 0, y: 0, z: 1 }
        );
        expect(circle.id).to.be.a('string');

        // Offset outward by 5
        const result = await kernel.offsetWire(circle.id, 5, 'single');

        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('offsetWire');

        // Cleanup
        await kernel.deleteShape(circle.id);
        await kernel.deleteShape(result.id);
      });

      it('offsets a circle inward', async function () {
        // Create a circle wire with radius 15
        const circle = await kernel.createCircleWire(
          { x: 0, y: 0, z: 0 },
          15,
          { x: 0, y: 0, z: 1 }
        );

        // Offset inward by -5
        const result = await kernel.offsetWire(circle.id, -5, 'single');

        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('offsetWire');

        // Cleanup
        await kernel.deleteShape(circle.id);
        await kernel.deleteShape(result.id);
      });
    });

    describe('Complex Profile Offset', function () {
      it('offsets an L-shaped profile', async function () {
        // Create an L-shaped wire
        const points = [
          { x: 0, y: 0, z: 0 },
          { x: 20, y: 0, z: 0 },
          { x: 20, y: 10, z: 0 },
          { x: 10, y: 10, z: 0 },
          { x: 10, y: 20, z: 0 },
          { x: 0, y: 20, z: 0 },
        ];
        const wire = await kernel.createWireFromPolygon(points);

        // Offset outward by 2
        const result = await kernel.offsetWire(wire.id, 2, 'single');

        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('offsetWire');

        // Cleanup
        await kernel.deleteShape(wire.id);
        await kernel.deleteShape(result.id);
      });
    });

    describe('Error Cases', function () {
      it('rejects zero offset distance', async function () {
        const points = [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 10, z: 0 },
          { x: 0, y: 10, z: 0 },
        ];
        const wire = await kernel.createWireFromPolygon(points);

        try {
          await kernel.offsetWire(wire.id, 0, 'single');
          expect.fail('Should have thrown error for zero distance');
        } catch (error) {
          expect(error.message).to.include('zero');
        }

        await kernel.deleteShape(wire.id);
      });

      it('handles self-intersecting offset gracefully', async function () {
        // Create a small rectangle
        const points = [
          { x: 0, y: 0, z: 0 },
          { x: 4, y: 0, z: 0 },
          { x: 4, y: 4, z: 0 },
          { x: 0, y: 4, z: 0 },
        ];
        const wire = await kernel.createWireFromPolygon(points);

        // Try to offset inward by more than half the smallest dimension
        // This should fail or produce degenerate result
        try {
          await kernel.offsetWire(wire.id, -3, 'single');
          // If it succeeds, the result may be degenerate
        } catch (error) {
          // Expected - self-intersection
          expect(error.message).to.include('self-intersection');
        }

        await kernel.deleteShape(wire.id);
      });
    });
  });

  // ==================== 3D Face Offset ====================

  describe('3D Face Offset', function () {
    describe('Single Face Offset', function () {
      it('offsets top face of a box outward (makes taller)', async function () {
        // Create a 20x20x20 box
        const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });

        // Get volume before
        const { volume: originalVol } = await kernel.getVolume(box.id);

        // Offset all faces outward by 2
        const result = await kernel.offsetFaces(box.id, 2, null);

        expect(result.id).to.be.a('string');
        expect(result.mesh).to.exist;
        expect(result.mesh.vertices.length).to.be.greaterThan(0);

        // Validate solid
        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Volume should increase
        const { volume: newVol } = await kernel.getVolume(result.id);
        expect(newVol).to.be.greaterThan(originalVol);

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(result.id);
      });

      it('offsets all faces inward (shrinks box)', async function () {
        // Create a 30x30x30 box (large enough for inward offset)
        const box = await kernel.createBox(30, 30, 30, { x: 0, y: 0, z: 0 });

        // Get volume before
        const { volume: originalVol } = await kernel.getVolume(box.id);

        // Offset all faces inward by -3
        const result = await kernel.offsetFaces(box.id, -3, null);

        expect(result.id).to.be.a('string');
        expect(result.mesh).to.exist;

        // Validate solid
        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Volume should decrease
        const { volume: newVol } = await kernel.getVolume(result.id);
        expect(newVol).to.be.lessThan(originalVol);

        // New dimensions should be 24x24x24 (30 - 2*3 on each axis)
        const expectedVol = 24 * 24 * 24;
        expect(newVol).to.be.closeTo(expectedVol, expectedVol * 0.05);

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(result.id);
      });
    });

    describe('Cylinder Face Offset', function () {
      it('offsets cylinder faces outward', async function () {
        // Create a cylinder
        const cyl = await kernel.createCylinder(10, 30, { x: 0, y: 0, z: 0 });

        // Get volume before
        const { volume: originalVol } = await kernel.getVolume(cyl.id);

        // Offset all faces outward by 2
        const result = await kernel.offsetFaces(cyl.id, 2, null);

        expect(result.id).to.be.a('string');
        expect(result.mesh).to.exist;

        // Validate solid
        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Volume should increase
        const { volume: newVol } = await kernel.getVolume(result.id);
        expect(newVol).to.be.greaterThan(originalVol);

        // Cleanup
        await kernel.deleteShape(cyl.id);
        await kernel.deleteShape(result.id);
      });
    });

    describe('Multiple Faces Offset', function () {
      it('offsets selected faces of a box', async function () {
        // Create a box
        const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });

        // Get face IDs
        const { faceIds } = await kernel.getFaces(box.id);
        expect(faceIds.length).to.equal(6); // Box has 6 faces

        // Select first 2 faces to offset
        const selectedFaces = faceIds.slice(0, 2);

        // Offset selected faces by 3
        const result = await kernel.offsetFaces(box.id, 3, selectedFaces);

        expect(result.id).to.be.a('string');
        expect(result.facesModified).to.equal(2);

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(result.id);
      });
    });

    describe('Error Cases', function () {
      it('rejects zero offset distance', async function () {
        const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });

        try {
          await kernel.offsetFaces(box.id, 0, null);
          expect.fail('Should have thrown error for zero distance');
        } catch (error) {
          expect(error.message).to.include('zero');
        }

        await kernel.deleteShape(box.id);
      });

      it('rejects non-existent face IDs', async function () {
        const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });

        try {
          await kernel.offsetFaces(box.id, 2, ['nonexistent_face_id']);
          expect.fail('Should have thrown error for invalid face ID');
        } catch (error) {
          expect(error.message).to.include('not found');
        }

        await kernel.deleteShape(box.id);
      });

      it('handles too-large inward offset gracefully', async function () {
        // Create a small box
        const box = await kernel.createBox(10, 10, 10, { x: 0, y: 0, z: 0 });

        try {
          // Try to offset inward by more than half the smallest dimension
          await kernel.offsetFaces(box.id, -6, null);
          // If it succeeds, result may be degenerate
        } catch (error) {
          // Expected - self-intersection or invalid geometry
          expect(error.message).to.match(/self-intersection|failed|too large/i);
        }

        await kernel.deleteShape(box.id);
      });
    });

    describe('Mesh Validity', function () {
      it('produces valid mesh with correct normals', async function () {
        const box = await kernel.createBox(20, 20, 20, { x: 0, y: 0, z: 0 });
        const result = await kernel.offsetFaces(box.id, 2, null);

        // Check mesh validity
        expect(result.mesh.vertices).to.be.instanceOf(Float32Array);
        expect(result.mesh.normals).to.be.instanceOf(Float32Array);
        expect(result.mesh.indices).to.be.instanceOf(Uint32Array);

        // Vertices and normals should have same count
        expect(result.mesh.vertices.length).to.equal(result.mesh.normals.length);

        // Check normals are valid (unit vectors)
        expect(hasValidNormals(result.mesh)).to.be.true;

        // Check indices are valid
        expect(hasValidIndices(result.mesh)).to.be.true;

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(result.id);
      });
    });
  });
});
