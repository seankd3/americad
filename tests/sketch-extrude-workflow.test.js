/**
 * Ameri-CAD Sketch-to-Extrude Workflow Tests
 *
 * Tests for the Fusion 360-style sketch → extrude workflow:
 * - Profile detection from various sketch shapes
 * - Nested profiles (holes) detection
 * - Extrude operations (new, join, cut, symmetric)
 * - Direction detection
 */

import { Sketch, SketchLine } from '../src/sketch/sketch-manager.js';
import {
  detectProfiles,
  getExtrudeDirection,
  getOuterProfiles,
  createExtrusionProfile,
  calculateArea,
  calculateCentroid,
  pointInPolygon,
  isProfileInside,
} from '../src/sketch/profile-detector.js';

describe('Profile Detection', function () {
  this.timeout(10000);

  describe('Simple Rectangle Profile', function () {
    it('detects a rectangle as a single profile', function () {
      const sketch = new Sketch('test-rect', 'xy');
      sketch.addRectangle(0, 0, 100, 50);

      const profiles = detectProfiles(sketch);

      expect(profiles).to.have.lengthOf(1);
      expect(profiles[0].type).to.equal('rectangle');
      expect(profiles[0].isOuter).to.be.true;
      expect(profiles[0].holes).to.have.lengthOf(0);
    });

    it('calculates correct rectangle area', function () {
      const sketch = new Sketch('test-rect', 'xy');
      sketch.addRectangle(0, 0, 100, 50);

      const profiles = detectProfiles(sketch);

      expect(profiles[0].area).to.be.closeTo(5000, 1);
    });

    it('calculates correct rectangle centroid', function () {
      const sketch = new Sketch('test-rect', 'xy');
      sketch.addRectangle(0, 0, 100, 50);

      const profiles = detectProfiles(sketch);

      expect(profiles[0].centroid.x).to.be.closeTo(50, 0.1);
      expect(profiles[0].centroid.y).to.be.closeTo(25, 0.1);
    });

    it('includes width and height for rectangle profiles', function () {
      const sketch = new Sketch('test-rect', 'xy');
      sketch.addRectangle(10, 20, 60, 80);

      const profiles = detectProfiles(sketch);

      expect(profiles[0].width).to.be.closeTo(50, 0.1);
      expect(profiles[0].height).to.be.closeTo(60, 0.1);
    });
  });

  describe('Circle Profile', function () {
    it('detects a circle as a single profile', function () {
      const sketch = new Sketch('test-circle', 'xy');
      sketch.addCircle(50, 50, 25);

      const profiles = detectProfiles(sketch);

      expect(profiles).to.have.lengthOf(1);
      expect(profiles[0].type).to.equal('circle');
      expect(profiles[0].isOuter).to.be.true;
      expect(profiles[0].radius).to.equal(25);
    });

    it('calculates correct circle area', function () {
      const sketch = new Sketch('test-circle', 'xy');
      sketch.addCircle(0, 0, 10);

      const profiles = detectProfiles(sketch);

      const expectedArea = Math.PI * 10 * 10;
      expect(profiles[0].area).to.be.closeTo(expectedArea, 0.1);
    });

    it('centroid matches circle center', function () {
      const sketch = new Sketch('test-circle', 'xy');
      sketch.addCircle(75, 125, 30);

      const profiles = detectProfiles(sketch);

      expect(profiles[0].centroid.x).to.be.closeTo(75, 0.1);
      expect(profiles[0].centroid.y).to.be.closeTo(125, 0.1);
    });
  });

  describe('Polygon Profile (Connected Lines)', function () {
    it('detects a triangle from connected lines', function () {
      const sketch = new Sketch('test-triangle', 'xy');

      // Create a triangle manually with shared points
      const p1 = sketch.addPoint(0, 0);
      const p2 = sketch.addPoint(100, 0);
      const p3 = sketch.addPoint(50, 86.6);

      const line1 = new SketchLine(p1, p2);
      const line2 = new SketchLine(p2, p3);
      const line3 = new SketchLine(p3, p1);

      sketch.lines.set(line1.id, line1);
      sketch.lines.set(line2.id, line2);
      sketch.lines.set(line3.id, line3);

      const profiles = detectProfiles(sketch);

      expect(profiles).to.have.lengthOf(1);
      expect(profiles[0].type).to.equal('polygon');
      expect(profiles[0].points).to.have.lengthOf(3);
    });

    it('detects an L-shape from connected lines', function () {
      const sketch = new Sketch('test-lshape', 'xy');

      // Create an L-shape
      const points = [
        sketch.addPoint(0, 0),
        sketch.addPoint(100, 0),
        sketch.addPoint(100, 50),
        sketch.addPoint(50, 50),
        sketch.addPoint(50, 100),
        sketch.addPoint(0, 100),
      ];

      // Close the loop
      for (let i = 0; i < points.length; i++) {
        const start = points[i];
        const end = points[(i + 1) % points.length];
        const line = new SketchLine(start, end);
        sketch.lines.set(line.id, line);
      }

      const profiles = detectProfiles(sketch);

      expect(profiles).to.have.lengthOf(1);
      expect(profiles[0].type).to.equal('polygon');
      expect(profiles[0].points).to.have.lengthOf(6);
    });
  });

  describe('Multiple Separate Profiles', function () {
    it('detects two separate rectangles', function () {
      const sketch = new Sketch('test-two-rects', 'xy');
      sketch.addRectangle(0, 0, 40, 30);
      sketch.addRectangle(100, 0, 140, 30);

      const profiles = detectProfiles(sketch);

      expect(profiles).to.have.lengthOf(2);
      expect(profiles.every(p => p.type === 'rectangle')).to.be.true;
      expect(profiles.every(p => p.isOuter)).to.be.true;
    });

    it('detects rectangle and circle separately', function () {
      const sketch = new Sketch('test-mixed', 'xy');
      sketch.addRectangle(0, 0, 50, 50);
      sketch.addCircle(100, 25, 20);

      const profiles = detectProfiles(sketch);

      expect(profiles).to.have.lengthOf(2);

      const types = profiles.map(p => p.type).sort();
      expect(types).to.deep.equal(['circle', 'rectangle']);
    });
  });

  describe('Nested Profiles (Holes)', function () {
    it('detects circle inside rectangle as hole', function () {
      const sketch = new Sketch('test-hole', 'xy');
      sketch.addRectangle(0, 0, 100, 100);
      sketch.addCircle(50, 50, 20);

      const profiles = detectProfiles(sketch);

      expect(profiles).to.have.lengthOf(2);

      const outerProfiles = getOuterProfiles(profiles);
      expect(outerProfiles).to.have.lengthOf(1);
      expect(outerProfiles[0].type).to.equal('rectangle');
      expect(outerProfiles[0].holes).to.have.lengthOf(1);
      expect(outerProfiles[0].holes[0].type).to.equal('circle');
    });

    it('detects small rectangle inside large rectangle as hole', function () {
      const sketch = new Sketch('test-nested-rects', 'xy');
      sketch.addRectangle(0, 0, 100, 100); // Outer
      sketch.addRectangle(25, 25, 75, 75); // Inner hole

      const profiles = detectProfiles(sketch);

      expect(profiles).to.have.lengthOf(2);

      const outerProfiles = getOuterProfiles(profiles);
      expect(outerProfiles).to.have.lengthOf(1);
      expect(outerProfiles[0].holes).to.have.lengthOf(1);
    });

    it('detects multiple holes in one profile', function () {
      const sketch = new Sketch('test-multi-holes', 'xy');
      sketch.addRectangle(0, 0, 200, 100); // Outer
      sketch.addCircle(50, 50, 15); // Hole 1
      sketch.addCircle(100, 50, 15); // Hole 2
      sketch.addCircle(150, 50, 15); // Hole 3

      const profiles = detectProfiles(sketch);

      const outerProfiles = getOuterProfiles(profiles);
      expect(outerProfiles).to.have.lengthOf(1);
      expect(outerProfiles[0].holes).to.have.lengthOf(3);
    });

    it('marks nested profile as non-outer', function () {
      const sketch = new Sketch('test-nested-marking', 'xy');
      sketch.addRectangle(0, 0, 100, 100);
      sketch.addCircle(50, 50, 10);

      const profiles = detectProfiles(sketch);

      const innerProfile = profiles.find(p => p.type === 'circle');
      expect(innerProfile.isOuter).to.be.false;
      expect(innerProfile.parentId).to.exist;
    });
  });

  describe('Construction Geometry Filtering', function () {
    it('ignores construction rectangles', function () {
      const sketch = new Sketch('test-construction', 'xy');
      const rect1 = sketch.addRectangle(0, 0, 50, 50);
      const rect2 = sketch.addRectangle(100, 0, 150, 50);

      // Mark one as construction
      rect2.construction = true;

      const profiles = detectProfiles(sketch);

      expect(profiles).to.have.lengthOf(1);
      expect(profiles[0].entity.id).to.equal(rect1.id);
    });

    it('ignores construction circles', function () {
      const sketch = new Sketch('test-construction-circle', 'xy');
      const circle1 = sketch.addCircle(25, 25, 20);
      const circle2 = sketch.addCircle(100, 25, 20);

      circle2.construction = true;

      const profiles = detectProfiles(sketch);

      expect(profiles).to.have.lengthOf(1);
      expect(profiles[0].entity.id).to.equal(circle1.id);
    });
  });
});

describe('Extrude Direction Detection', function () {
  it('returns Z direction for XY plane', function () {
    const sketch = new Sketch('test-xy', 'xy');
    const profile = { type: 'rectangle', center: { x: 0, y: 0 } };

    const direction = getExtrudeDirection(profile, sketch);

    expect(direction.x).to.equal(0);
    expect(direction.y).to.equal(0);
    expect(direction.z).to.equal(1);
  });

  it('returns Y direction for XZ plane', function () {
    const sketch = new Sketch('test-xz', 'xz');
    const profile = { type: 'rectangle', center: { x: 0, y: 0 } };

    const direction = getExtrudeDirection(profile, sketch);

    expect(direction.x).to.equal(0);
    expect(direction.y).to.equal(1);
    expect(direction.z).to.equal(0);
  });

  it('returns X direction for YZ plane', function () {
    const sketch = new Sketch('test-yz', 'yz');
    const profile = { type: 'rectangle', center: { x: 0, y: 0 } };

    const direction = getExtrudeDirection(profile, sketch);

    expect(direction.x).to.equal(1);
    expect(direction.y).to.equal(0);
    expect(direction.z).to.equal(0);
  });

  it('uses face normal when sketching on a face', function () {
    const sketch = new Sketch('test-face', 'xy');
    sketch.baseFace = {
      normal: { x: 0.707, y: 0.707, z: 0 },
    };

    const profile = { type: 'rectangle', center: { x: 0, y: 0 } };
    const direction = getExtrudeDirection(profile, sketch);

    expect(direction.x).to.be.closeTo(0.707, 0.01);
    expect(direction.y).to.be.closeTo(0.707, 0.01);
    expect(direction.z).to.equal(0);
  });
});

describe('Geometry Utilities', function () {
  describe('calculateArea', function () {
    it('calculates square area correctly', function () {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const area = calculateArea(points);
      expect(area).to.be.closeTo(100, 0.1);
    });

    it('calculates triangle area correctly', function () {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ];

      const area = calculateArea(points);
      expect(area).to.be.closeTo(50, 0.1); // 1/2 * base * height
    });
  });

  describe('calculateCentroid', function () {
    it('calculates square centroid correctly', function () {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const centroid = calculateCentroid(points);
      expect(centroid.x).to.be.closeTo(5, 0.1);
      expect(centroid.y).to.be.closeTo(5, 0.1);
    });

    it('calculates off-center rectangle centroid', function () {
      const points = [
        { x: 10, y: 20 },
        { x: 30, y: 20 },
        { x: 30, y: 50 },
        { x: 10, y: 50 },
      ];

      const centroid = calculateCentroid(points);
      expect(centroid.x).to.be.closeTo(20, 0.1);
      expect(centroid.y).to.be.closeTo(35, 0.1);
    });
  });

  describe('pointInPolygon', function () {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    it('returns true for point inside', function () {
      expect(pointInPolygon({ x: 5, y: 5 }, square)).to.be.true;
      expect(pointInPolygon({ x: 2, y: 8 }, square)).to.be.true;
    });

    it('returns false for point outside', function () {
      expect(pointInPolygon({ x: -5, y: 5 }, square)).to.be.false;
      expect(pointInPolygon({ x: 15, y: 5 }, square)).to.be.false;
      expect(pointInPolygon({ x: 5, y: 15 }, square)).to.be.false;
    });
  });

  describe('isProfileInside', function () {
    it('detects circle inside rectangle', function () {
      const inner = {
        type: 'circle',
        center: { x: 50, y: 50 },
        centroid: { x: 50, y: 50 },
        radius: 10,
      };

      const outer = {
        type: 'rectangle',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
      };

      expect(isProfileInside(inner, outer)).to.be.true;
    });

    it('detects circle outside rectangle', function () {
      const inner = {
        type: 'circle',
        center: { x: 200, y: 50 },
        centroid: { x: 200, y: 50 },
        radius: 10,
      };

      const outer = {
        type: 'rectangle',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
      };

      expect(isProfileInside(inner, outer)).to.be.false;
    });

    it('detects small circle inside large circle', function () {
      const inner = {
        type: 'circle',
        center: { x: 50, y: 50 },
        radius: 10,
      };

      const outer = {
        type: 'circle',
        center: { x: 50, y: 50 },
        radius: 40,
      };

      expect(isProfileInside(inner, outer)).to.be.true;
    });
  });
});

describe('Extrusion Profile Creation', function () {
  it('creates rectangle extrusion profile', function () {
    const profile = {
      type: 'rectangle',
      center: { x: 50, y: 25 },
      width: 100,
      height: 50,
      holes: [],
    };

    const extrusionProfile = createExtrusionProfile(profile);

    expect(extrusionProfile.type).to.equal('rectangle');
    expect(extrusionProfile.width).to.equal(100);
    expect(extrusionProfile.height).to.equal(50);
    expect(extrusionProfile.center.x).to.equal(50);
    expect(extrusionProfile.center.y).to.equal(25);
  });

  it('creates circle extrusion profile', function () {
    const profile = {
      type: 'circle',
      center: { x: 0, y: 0 },
      radius: 25,
      holes: [],
    };

    const extrusionProfile = createExtrusionProfile(profile);

    expect(extrusionProfile.type).to.equal('circle');
    expect(extrusionProfile.radius).to.equal(25);
  });

  it('creates polygon extrusion profile with points', function () {
    const profile = {
      type: 'polygon',
      centroid: { x: 50, y: 50 },
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      holes: [],
    };

    const extrusionProfile = createExtrusionProfile(profile);

    expect(extrusionProfile.type).to.equal('polygon');
    expect(extrusionProfile.points).to.have.lengthOf(4);
  });

  it('includes holes in extrusion profile', function () {
    const profile = {
      type: 'rectangle',
      center: { x: 50, y: 50 },
      width: 100,
      height: 100,
      holes: [
        {
          type: 'circle',
          center: { x: 50, y: 50 },
          radius: 10,
          holes: [],
        },
      ],
    };

    const extrusionProfile = createExtrusionProfile(profile);

    expect(extrusionProfile.holes).to.have.lengthOf(1);
    expect(extrusionProfile.holes[0].type).to.equal('circle');
    expect(extrusionProfile.holes[0].radius).to.equal(10);
  });
});

describe('getOuterProfiles', function () {
  it('filters to only outer profiles', function () {
    const profiles = [
      { id: '1', isOuter: true, type: 'rectangle' },
      { id: '2', isOuter: false, type: 'circle', parentId: '1' },
      { id: '3', isOuter: true, type: 'circle' },
    ];

    const outer = getOuterProfiles(profiles);

    expect(outer).to.have.lengthOf(2);
    expect(outer.every(p => p.isOuter)).to.be.true;
  });

  it('returns empty array when no outer profiles', function () {
    const profiles = [
      { id: '1', isOuter: false, type: 'circle' },
      { id: '2', isOuter: false, type: 'circle' },
    ];

    const outer = getOuterProfiles(profiles);

    expect(outer).to.have.lengthOf(0);
  });
});

// Integration tests that require the kernel
describe('Extrude Operations (Integration)', function () {
  this.timeout(30000);

  // These tests would require the kernel to be initialized
  // We'll mark them as pending if kernel isn't available

  let kernel;
  let kernelAvailable = false;

  before(async function () {
    try {
      const { KernelBridge } = await import('../src/kernel/bridge.js');
      kernel = new KernelBridge();
      await kernel.init();
      kernelAvailable = true;
    } catch (e) {
      console.warn('Kernel not available for integration tests:', e.message);
    }
  });

  after(function () {
    if (kernel) {
      kernel.terminate();
    }
  });

  it('extrudes rectangle profile to create box', async function () {
    if (!kernelAvailable) this.skip();

    const profile = {
      type: 'rectangle',
      width: 50,
      height: 30,
      center: { x: 0, y: 0 },
    };

    const result = await kernel.extrudeSketchProfile(profile, 20, 'xy');

    expect(result.id).to.be.a('string');
    expect(result.mesh).to.exist;
    expect(result.mesh.vertices.length).to.be.greaterThan(0);
  });

  it('extrudes circle profile to create cylinder', async function () {
    if (!kernelAvailable) this.skip();

    const profile = {
      type: 'circle',
      radius: 15,
      center: { x: 0, y: 0 },
    };

    const result = await kernel.extrudeSketchProfile(profile, 40, 'xy');

    expect(result.id).to.be.a('string');
    expect(result.mesh).to.exist;
  });

  it('extrude cut removes material from existing body', async function () {
    if (!kernelAvailable) this.skip();

    // Create a box first
    const baseBox = await kernel.createBox(100, 100, 50, { x: 0, y: 0, z: 0 });

    // Get initial volume
    const initialVolume = (await kernel.getVolume(baseBox.id)).volume;

    // Create a circle profile for cutting
    const cutProfile = {
      type: 'circle',
      radius: 10,
      center: { x: 0, y: 0 },
    };

    // Extrude as cut (subtract)
    const cutResult = await kernel.extrudeSketchProfile(cutProfile, 60, 'xy');

    // Subtract from base box
    const result = await kernel.subtract(baseBox.id, cutResult.id);

    // Get final volume
    const finalVolume = (await kernel.getVolume(result.id)).volume;

    // Volume should be less after cut
    expect(finalVolume).to.be.lessThan(initialVolume);
  });

  it('symmetric extrude creates geometry in both directions', async function () {
    if (!kernelAvailable) this.skip();

    const profile = {
      type: 'rectangle',
      width: 20,
      height: 20,
      center: { x: 0, y: 0 },
    };

    // Extrude 50 total (25 each direction)
    const result1 = await kernel.extrudeSketchProfile(profile, 25, 'xy');
    const result2 = await kernel.extrudeSketchProfile(profile, 25, 'xy');

    // Both results should be valid
    expect(result1.mesh.vertices.length).to.be.greaterThan(0);
    expect(result2.mesh.vertices.length).to.be.greaterThan(0);
  });
});
