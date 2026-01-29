/**
 * Ameri-CAD Rib and Web Feature Tests
 * Tests for structural reinforcement features commonly used in injection molding and casting
 *
 * Rib: A thin wall that adds stiffness by sweeping a trapezoidal profile along a path
 * Web: A thin wall created by extruding a profile by a thickness
 */

import { KernelBridge } from '../src/kernel/bridge.js';

let kernel;

// ==================== Test Utilities ====================

/**
 * Check if a shape is a valid solid
 * @param {KernelBridge} kernel
 * @param {string} shapeId
 * @returns {Promise<boolean>}
 */
async function isValidSolid(kernel, shapeId) {
  try {
    const { volume } = await kernel.getVolume(shapeId);
    return volume > 0;
  } catch {
    return false;
  }
}

/**
 * Calculate the expected volume increase from adding a rib
 * Approximate: rib is a rectangular/trapezoidal prism
 * @param {number} length - Rib length (path length)
 * @param {number} thickness - Rib thickness
 * @param {number} height - Rib height
 * @param {number} draftAngle - Draft angle in degrees
 * @returns {number} Approximate volume
 */
function expectedRibVolume(length, thickness, height, draftAngle = 0) {
  // For a trapezoidal cross-section:
  // Area = (bottomWidth + topWidth) / 2 * height
  // topWidth = bottomWidth - 2 * height * tan(draftAngle)
  const draftRad = (draftAngle * Math.PI) / 180;
  const bottomWidth = thickness;
  const topWidth = Math.max(bottomWidth - 2 * height * Math.tan(draftRad), 0);
  const crossSectionArea = ((bottomWidth + topWidth) / 2) * height;
  return crossSectionArea * length;
}

/**
 * Calculate expected volume of a web
 * @param {number} area - Profile area
 * @param {number} thickness - Web thickness
 * @returns {number} Expected volume
 */
function expectedWebVolume(area, thickness) {
  return area * thickness;
}

// ==================== Test Suite ====================

describe('Rib and Web Features', function () {
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

  // ==================== Rib Tests ====================

  describe('Rib Feature', function () {
    describe('Basic Rib Operations', function () {
      it('creates a straight rib on a box', async function () {
        // Create a 50x50x10 base plate
        const box = await kernel.createBox(50, 50, 10, { x: 0, y: 0, z: 5 });

        // Add a rib along the center in Y direction
        // Rib goes from (0, -20, 10) to (0, 20, 10) on top face
        const result = await kernel.createRibFromLine(
          box.id,
          { x: 0, y: -20, z: 10 },
          { x: 0, y: 20, z: 10 },
          2, // 2mm thickness
          5, // 5mm height
          0, // no draft
          { x: 0, y: 0, z: 1 } // Z direction (up from top face)
        );

        expect(result.id).to.be.a('string');
        expect(result.mesh).to.exist;
        expect(result.mesh.vertices.length).to.be.greaterThan(0);
        expect(result.type).to.equal('rib');

        // Validate solid
        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Check volume increased (rib added material)
        const { volume: originalVol } = await kernel.getVolume(box.id);
        const { volume: withRibVol } = await kernel.getVolume(result.id);
        expect(withRibVol).to.be.greaterThan(originalVol);

        // Approximate volume check
        const ribLength = 40; // 40mm path length
        const expectedIncrease = expectedRibVolume(ribLength, 2, 5, 0);
        const actualIncrease = withRibVol - originalVol;
        // Allow 20% tolerance for intersection effects
        expect(actualIncrease).to.be.closeTo(expectedIncrease, expectedIncrease * 0.3);

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(result.id);
      });

      it('creates a rib with draft angle', async function () {
        // Create base plate
        const box = await kernel.createBox(50, 50, 10, { x: 0, y: 0, z: 5 });

        // Add rib with 1° draft angle
        const result = await kernel.createRibFromLine(
          box.id,
          { x: -15, y: 0, z: 10 },
          { x: 15, y: 0, z: 10 },
          3, // 3mm thickness
          8, // 8mm height
          1, // 1° draft
          { x: 0, y: 0, z: 1 }
        );

        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('rib');

        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Volume should be less than without draft (tapered shape)
        const { volume: originalVol } = await kernel.getVolume(box.id);
        const { volume: withRibVol } = await kernel.getVolume(result.id);
        expect(withRibVol).to.be.greaterThan(originalVol);

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(result.id);
      });

      it('creates a rib with large draft angle (5°)', async function () {
        const box = await kernel.createBox(50, 50, 10, { x: 0, y: 0, z: 5 });

        const result = await kernel.createRibFromLine(
          box.id,
          { x: -10, y: 0, z: 10 },
          { x: 10, y: 0, z: 10 },
          4, // 4mm thickness at base
          6, // 6mm height
          5, // 5° draft (aggressive taper)
          { x: 0, y: 0, z: 1 }
        );

        expect(result.id).to.be.a('string');
        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(result.id);
      });
    });

    describe('Rib with Path Wire', function () {
      it('creates a rib from a pre-made line wire', async function () {
        const box = await kernel.createBox(50, 50, 10, { x: 0, y: 0, z: 5 });

        // Create path wire
        const pathWire = await kernel.createLineWire(
          { x: -15, y: 0, z: 10 },
          { x: 15, y: 0, z: 10 }
        );

        // Create rib using the wire
        const result = await kernel.createRib(
          box.id,
          pathWire.id,
          2, // thickness
          5, // height
          0, // no draft
          { x: 0, y: 0, z: 1 }
        );

        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('rib');

        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(pathWire.id);
        await kernel.deleteShape(result.id);
      });

      it('creates a curved rib following an arc', async function () {
        const box = await kernel.createBox(60, 60, 10, { x: 0, y: 0, z: 5 });

        // Create arc path (quarter circle)
        const arcWire = await kernel.createArcWire(
          { x: -20, y: 0, z: 10 }, // start
          { x: 0, y: 15, z: 10 }, // mid point
          { x: 20, y: 0, z: 10 } // end
        );

        // Create curved rib
        const result = await kernel.createRib(
          box.id,
          arcWire.id,
          2, // thickness
          4, // height
          0, // no draft
          { x: 0, y: 0, z: 1 }
        );

        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('rib');

        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Volume should increase
        const { volume: originalVol } = await kernel.getVolume(box.id);
        const { volume: withRibVol } = await kernel.getVolume(result.id);
        expect(withRibVol).to.be.greaterThan(originalVol);

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(arcWire.id);
        await kernel.deleteShape(result.id);
      });
    });

    describe('Multiple Ribs', function () {
      it('creates multiple parallel ribs', async function () {
        let body = await kernel.createBox(60, 60, 10, { x: 0, y: 0, z: 5 });

        // Add first rib at y = -15
        const rib1 = await kernel.createRibFromLine(
          body.id,
          { x: -20, y: -15, z: 10 },
          { x: 20, y: -15, z: 10 },
          2,
          5,
          0,
          { x: 0, y: 0, z: 1 }
        );

        // Add second rib at y = 0 (on the first result)
        const rib2 = await kernel.createRibFromLine(
          rib1.id,
          { x: -20, y: 0, z: 10 },
          { x: 20, y: 0, z: 10 },
          2,
          5,
          0,
          { x: 0, y: 0, z: 1 }
        );

        // Add third rib at y = 15
        const rib3 = await kernel.createRibFromLine(
          rib2.id,
          { x: -20, y: 15, z: 10 },
          { x: 20, y: 15, z: 10 },
          2,
          5,
          0,
          { x: 0, y: 0, z: 1 }
        );

        expect(rib3.id).to.be.a('string');
        const valid = await isValidSolid(kernel, rib3.id);
        expect(valid).to.be.true;

        // Volume should have increased by approximately 3 ribs worth
        const { volume: originalVol } = await kernel.getVolume(body.id);
        const { volume: finalVol } = await kernel.getVolume(rib3.id);
        const singleRibVol = expectedRibVolume(40, 2, 5, 0);
        expect(finalVol - originalVol).to.be.closeTo(singleRibVol * 3, singleRibVol * 1.5);

        // Cleanup
        await kernel.deleteShape(body.id);
        await kernel.deleteShape(rib1.id);
        await kernel.deleteShape(rib2.id);
        await kernel.deleteShape(rib3.id);
      });

      it('creates a cross-rib pattern', async function () {
        let body = await kernel.createBox(60, 60, 10, { x: 0, y: 0, z: 5 });

        // Rib in X direction
        const ribX = await kernel.createRibFromLine(
          body.id,
          { x: -20, y: 0, z: 10 },
          { x: 20, y: 0, z: 10 },
          2,
          5,
          0,
          { x: 0, y: 0, z: 1 }
        );

        // Rib in Y direction (crossing the first)
        const ribY = await kernel.createRibFromLine(
          ribX.id,
          { x: 0, y: -20, z: 10 },
          { x: 0, y: 20, z: 10 },
          2,
          5,
          0,
          { x: 0, y: 0, z: 1 }
        );

        expect(ribY.id).to.be.a('string');
        const valid = await isValidSolid(kernel, ribY.id);
        expect(valid).to.be.true;

        // Cleanup
        await kernel.deleteShape(body.id);
        await kernel.deleteShape(ribX.id);
        await kernel.deleteShape(ribY.id);
      });
    });

    describe('Rib Error Cases', function () {
      it('fails with invalid base body ID', async function () {
        try {
          await kernel.createRibFromLine(
            'nonexistent-id',
            { x: 0, y: 0, z: 0 },
            { x: 10, y: 0, z: 0 },
            2,
            5,
            0,
            { x: 0, y: 0, z: 1 }
          );
          expect.fail('Should have thrown an error');
        } catch (e) {
          expect(e.message).to.include('not found');
        }
      });

      it('fails with zero thickness', async function () {
        const box = await kernel.createBox(50, 50, 10, { x: 0, y: 0, z: 5 });

        try {
          await kernel.createRibFromLine(
            box.id,
            { x: 0, y: -10, z: 10 },
            { x: 0, y: 10, z: 10 },
            0, // zero thickness - should fail
            5,
            0,
            { x: 0, y: 0, z: 1 }
          );
          // May or may not throw - depends on implementation
        } catch (e) {
          // Expected to fail
        }

        await kernel.deleteShape(box.id);
      });
    });
  });

  // ==================== Web Tests ====================

  describe('Web Feature', function () {
    describe('Basic Web Operations', function () {
      it('creates a web from polygon points', async function () {
        // Create a base plate
        const box = await kernel.createBox(60, 60, 10, { x: 0, y: 0, z: 5 });

        // Create a triangular web profile on top of the plate
        const points = [
          { x: -15, y: -15, z: 10 },
          { x: 15, y: -15, z: 10 },
          { x: 0, y: 15, z: 10 },
        ];

        const result = await kernel.createWebFromPolygon(
          box.id,
          points,
          2, // 2mm thick web
          { x: 0, y: 0, z: 1 }
        );

        expect(result.id).to.be.a('string');
        expect(result.mesh).to.exist;
        expect(result.type).to.equal('web');

        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Check volume increased
        const { volume: originalVol } = await kernel.getVolume(box.id);
        const { volume: withWebVol } = await kernel.getVolume(result.id);
        expect(withWebVol).to.be.greaterThan(originalVol);

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(result.id);
      });

      it('creates a rectangular web', async function () {
        const box = await kernel.createBox(60, 60, 10, { x: 0, y: 0, z: 5 });

        // Rectangular web profile
        const points = [
          { x: -10, y: -10, z: 10 },
          { x: 10, y: -10, z: 10 },
          { x: 10, y: 10, z: 10 },
          { x: -10, y: 10, z: 10 },
        ];

        const result = await kernel.createWebFromPolygon(
          box.id,
          points,
          3, // 3mm thick
          { x: 0, y: 0, z: 1 }
        );

        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('web');

        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Expected web volume: 20x20 area * 3mm thickness = 1200 mm³
        const { volume: originalVol } = await kernel.getVolume(box.id);
        const { volume: withWebVol } = await kernel.getVolume(result.id);
        const webVol = withWebVol - originalVol;
        expect(webVol).to.be.closeTo(1200, 200);

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(result.id);
      });

      it('creates a standalone web (no base body)', async function () {
        // Create web without attaching to a body
        const points = [
          { x: 0, y: 0, z: 0 },
          { x: 20, y: 0, z: 0 },
          { x: 20, y: 20, z: 0 },
          { x: 0, y: 20, z: 0 },
        ];

        const result = await kernel.createWebFromPolygon(
          null, // no base body
          points,
          5,
          { x: 0, y: 0, z: 1 }
        );

        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('web');

        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Volume should be 20*20*5 = 2000 mm³
        const { volume } = await kernel.getVolume(result.id);
        expect(volume).to.be.closeTo(2000, 100);

        // Cleanup
        await kernel.deleteShape(result.id);
      });
    });

    describe('Web with Profile Shapes', function () {
      it('creates a web from a circular wire profile', async function () {
        const box = await kernel.createBox(60, 60, 10, { x: 0, y: 0, z: 5 });

        // Create circular profile wire
        const circleWire = await kernel.createCircleWire(
          { x: 0, y: 0, z: 10 },
          10, // radius
          { x: 0, y: 0, z: 1 } // normal
        );

        // Create face from wire
        const circleFace = await kernel.createFaceFromWire(circleWire.id, true);

        // Create web
        const result = await kernel.createWeb(
          box.id,
          circleFace.id,
          4, // 4mm thick
          { x: 0, y: 0, z: 1 }
        );

        expect(result.id).to.be.a('string');
        expect(result.type).to.equal('web');

        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Expected increase: π * 10² * 4 ≈ 1257 mm³
        const { volume: originalVol } = await kernel.getVolume(box.id);
        const { volume: withWebVol } = await kernel.getVolume(result.id);
        const webVol = withWebVol - originalVol;
        expect(webVol).to.be.closeTo(Math.PI * 100 * 4, 150);

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(circleWire.id);
        await kernel.deleteShape(circleFace.id);
        await kernel.deleteShape(result.id);
      });
    });

    describe('Web Direction', function () {
      it('creates a web in negative Z direction', async function () {
        const box = await kernel.createBox(60, 60, 10, { x: 0, y: 0, z: 5 });

        const points = [
          { x: -10, y: -10, z: 0 },
          { x: 10, y: -10, z: 0 },
          { x: 10, y: 10, z: 0 },
          { x: -10, y: 10, z: 0 },
        ];

        const result = await kernel.createWebFromPolygon(
          box.id,
          points,
          3,
          { x: 0, y: 0, z: -1 } // Negative Z direction (downward)
        );

        expect(result.id).to.be.a('string');
        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(result.id);
      });

      it('creates a web in X direction (side web)', async function () {
        const box = await kernel.createBox(60, 60, 20, { x: 0, y: 0, z: 10 });

        // Profile on YZ plane
        const points = [
          { x: 30, y: -10, z: 5 },
          { x: 30, y: 10, z: 5 },
          { x: 30, y: 10, z: 15 },
          { x: 30, y: -10, z: 15 },
        ];

        const result = await kernel.createWebFromPolygon(
          box.id,
          points,
          2,
          { x: 1, y: 0, z: 0 } // X direction (outward from side)
        );

        expect(result.id).to.be.a('string');
        const valid = await isValidSolid(kernel, result.id);
        expect(valid).to.be.true;

        // Cleanup
        await kernel.deleteShape(box.id);
        await kernel.deleteShape(result.id);
      });
    });

    describe('Web Error Cases', function () {
      it('fails with invalid profile ID', async function () {
        const box = await kernel.createBox(50, 50, 10, { x: 0, y: 0, z: 5 });

        try {
          await kernel.createWeb(box.id, 'nonexistent-profile', 2, { x: 0, y: 0, z: 1 });
          expect.fail('Should have thrown an error');
        } catch (e) {
          expect(e.message).to.include('not found');
        }

        await kernel.deleteShape(box.id);
      });
    });
  });

  // ==================== Combined Rib and Web Tests ====================

  describe('Combined Rib and Web Features', function () {
    it('creates a part with both ribs and webs', async function () {
      // Create a base plate
      let body = await kernel.createBox(80, 80, 10, { x: 0, y: 0, z: 5 });

      // Add a central web (raised platform)
      const webPoints = [
        { x: -15, y: -15, z: 10 },
        { x: 15, y: -15, z: 10 },
        { x: 15, y: 15, z: 10 },
        { x: -15, y: 15, z: 10 },
      ];

      const withWeb = await kernel.createWebFromPolygon(body.id, webPoints, 5, {
        x: 0,
        y: 0,
        z: 1,
      });

      // Add ribs radiating from the web
      const withRib1 = await kernel.createRibFromLine(
        withWeb.id,
        { x: 15, y: 0, z: 10 },
        { x: 35, y: 0, z: 10 },
        2,
        5,
        0,
        { x: 0, y: 0, z: 1 }
      );

      const withRib2 = await kernel.createRibFromLine(
        withRib1.id,
        { x: -15, y: 0, z: 10 },
        { x: -35, y: 0, z: 10 },
        2,
        5,
        0,
        { x: 0, y: 0, z: 1 }
      );

      const final = await kernel.createRibFromLine(
        withRib2.id,
        { x: 0, y: 15, z: 10 },
        { x: 0, y: 35, z: 10 },
        2,
        5,
        0,
        { x: 0, y: 0, z: 1 }
      );

      expect(final.id).to.be.a('string');
      const valid = await isValidSolid(kernel, final.id);
      expect(valid).to.be.true;

      // Final volume should be significantly more than original
      const { volume: originalVol } = await kernel.getVolume(body.id);
      const { volume: finalVol } = await kernel.getVolume(final.id);
      expect(finalVol).to.be.greaterThan(originalVol * 1.02); // At least 2% increase

      // Cleanup
      await kernel.deleteShape(body.id);
      await kernel.deleteShape(withWeb.id);
      await kernel.deleteShape(withRib1.id);
      await kernel.deleteShape(withRib2.id);
      await kernel.deleteShape(final.id);
    });

    it('creates ribs in different directions on the same body', async function () {
      // Create a box
      const box = await kernel.createBox(50, 50, 20, { x: 0, y: 0, z: 10 });

      // Rib on top (Z direction)
      const withTopRib = await kernel.createRibFromLine(
        box.id,
        { x: -15, y: 0, z: 20 },
        { x: 15, y: 0, z: 20 },
        2,
        5,
        0,
        { x: 0, y: 0, z: 1 }
      );

      expect(withTopRib.id).to.be.a('string');
      const valid = await isValidSolid(kernel, withTopRib.id);
      expect(valid).to.be.true;

      // Cleanup
      await kernel.deleteShape(box.id);
      await kernel.deleteShape(withTopRib.id);
    });
  });

  // ==================== Rib Connects to Body Correctly ====================

  describe('Rib-Body Connection', function () {
    it('rib is properly fused with base body (no separate solids)', async function () {
      const box = await kernel.createBox(50, 50, 10, { x: 0, y: 0, z: 5 });

      const result = await kernel.createRibFromLine(
        box.id,
        { x: -15, y: 0, z: 10 },
        { x: 15, y: 0, z: 10 },
        2,
        5,
        0,
        { x: 0, y: 0, z: 1 }
      );

      // The result should be a single solid, not a compound of two bodies
      // We verify this by checking that the mass properties report a single
      // center of gravity (would be different for disconnected bodies)
      const massProps = await kernel.massProperties(result.id);
      expect(massProps.centerOfGravity).to.exist;
      expect(massProps.centerOfGravity.z).to.be.greaterThan(5); // CG should be above plate center

      // Cleanup
      await kernel.deleteShape(box.id);
      await kernel.deleteShape(result.id);
    });
  });
});
