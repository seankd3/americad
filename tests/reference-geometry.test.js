/**
 * Ameri-CAD Reference Geometry Tests
 *
 * Tests for construction planes, axes, and points.
 */

import {
  ReferencePlane,
  ReferenceAxis,
  ReferencePoint,
  ReferenceGeometryManager,
  referenceGeometry,
  resetRefIdCounter,
} from '../src/core/reference-geometry.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test Utilities
// ═══════════════════════════════════════════════════════════════════════════

const EPSILON = 1e-10;

function assertClose(actual, expected, msg) {
  const diff = Math.abs(actual - expected);
  if (diff > EPSILON) {
    throw new Error(`${msg}: expected ${expected}, got ${actual} (diff: ${diff})`);
  }
}

function assertVectorClose(actual, expected, msg) {
  for (let i = 0; i < 3; i++) {
    assertClose(actual[i], expected[i], `${msg}[${i}]`);
  }
}

function assertVectorNormalized(v, msg) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  assertClose(len, 1.0, `${msg} should be normalized`);
}

// ═══════════════════════════════════════════════════════════════════════════
// ReferencePlane Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('ReferencePlane', function () {
  beforeEach(function () {
    resetRefIdCounter(1);
  });

  describe('constructor', function () {
    it('should create a plane with origin and normal', function () {
      const plane = new ReferencePlane([0, 0, 0], [0, 0, 1], 'Test XY');

      chai.expect(plane.type).to.equal('plane');
      chai.expect(plane.name).to.equal('Test XY');
      chai.expect(plane.origin).to.deep.equal([0, 0, 0]);
      assertVectorClose(plane.normal, [0, 0, 1], 'normal');
      chai.expect(plane.visible).to.equal(true);
    });

    it('should normalize the normal vector', function () {
      const plane = new ReferencePlane([0, 0, 0], [0, 0, 5], 'Unnormalized');

      assertVectorNormalized(plane.normal, 'normal');
      assertVectorClose(plane.normal, [0, 0, 1], 'normalized normal');
    });

    it('should handle arbitrary normals', function () {
      const plane = new ReferencePlane([10, 20, 30], [1, 1, 1], 'Diagonal');

      assertVectorNormalized(plane.normal, 'diagonal normal');
      const sqrt3 = 1 / Math.sqrt(3);
      assertVectorClose(plane.normal, [sqrt3, sqrt3, sqrt3], 'diagonal normal values');
    });

    it('should accept custom options', function () {
      const plane = new ReferencePlane([0, 0, 0], [0, 1, 0], 'Custom', {
        visible: false,
        size: 200,
        color: 0xff0000,
        opacity: 0.5,
      });

      chai.expect(plane.visible).to.equal(false);
      chai.expect(plane.size).to.equal(200);
      chai.expect(plane.color).to.equal(0xff0000);
      chai.expect(plane.opacity).to.equal(0.5);
    });
  });

  describe('getUDirection and getVDirection', function () {
    it('should return perpendicular directions for XY plane', function () {
      const plane = new ReferencePlane([0, 0, 0], [0, 0, 1], 'XY');
      const u = plane.getUDirection();
      const v = plane.getVDirection();

      assertVectorNormalized(u, 'U direction');
      assertVectorNormalized(v, 'V direction');

      // U and V should be perpendicular to normal
      const dotUN = u[0] * plane.normal[0] + u[1] * plane.normal[1] + u[2] * plane.normal[2];
      const dotVN = v[0] * plane.normal[0] + v[1] * plane.normal[1] + v[2] * plane.normal[2];
      assertClose(dotUN, 0, 'U perpendicular to normal');
      assertClose(dotVN, 0, 'V perpendicular to normal');

      // U and V should be perpendicular to each other
      const dotUV = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      assertClose(dotUV, 0, 'U perpendicular to V');
    });

    it('should return perpendicular directions for YZ plane', function () {
      const plane = new ReferencePlane([0, 0, 0], [1, 0, 0], 'YZ');
      const u = plane.getUDirection();
      const v = plane.getVDirection();

      assertVectorNormalized(u, 'U direction');
      assertVectorNormalized(v, 'V direction');
    });
  });

  describe('projectPoint', function () {
    it('should project point onto XY plane', function () {
      const plane = new ReferencePlane([0, 0, 0], [0, 0, 1], 'XY');
      const projected = plane.projectPoint([5, 10, 20]);

      assertVectorClose(projected, [5, 10, 0], 'projected point');
    });

    it('should project point onto offset XZ plane', function () {
      const plane = new ReferencePlane([0, 50, 0], [0, 1, 0], 'XZ offset');
      const projected = plane.projectPoint([10, 100, 30]);

      assertVectorClose(projected, [10, 50, 30], 'projected point');
    });
  });

  describe('distanceToPoint', function () {
    it('should calculate signed distance to plane', function () {
      const plane = new ReferencePlane([0, 0, 0], [0, 0, 1], 'XY');

      assertClose(plane.distanceToPoint([0, 0, 10]), 10, 'positive distance');
      assertClose(plane.distanceToPoint([0, 0, -5]), -5, 'negative distance');
      assertClose(plane.distanceToPoint([100, 200, 0]), 0, 'on plane');
    });
  });

  describe('serialization', function () {
    it('should serialize and deserialize correctly', function () {
      const original = new ReferencePlane([10, 20, 30], [0, 1, 0], 'Test Plane', {
        visible: false,
        size: 150,
        color: 0x00ff00,
      });

      const json = original.toJSON();
      const restored = ReferencePlane.fromJSON(json);

      chai.expect(restored.id).to.equal(original.id);
      chai.expect(restored.name).to.equal(original.name);
      chai.expect(restored.origin).to.deep.equal(original.origin);
      assertVectorClose(restored.normal, original.normal, 'restored normal');
      chai.expect(restored.visible).to.equal(original.visible);
      chai.expect(restored.size).to.equal(original.size);
      chai.expect(restored.color).to.equal(original.color);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ReferenceAxis Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('ReferenceAxis', function () {
  beforeEach(function () {
    resetRefIdCounter(1);
  });

  describe('constructor', function () {
    it('should create an axis with origin and direction', function () {
      const axis = new ReferenceAxis([0, 0, 0], [1, 0, 0], 'X Axis');

      chai.expect(axis.type).to.equal('axis');
      chai.expect(axis.name).to.equal('X Axis');
      chai.expect(axis.origin).to.deep.equal([0, 0, 0]);
      assertVectorClose(axis.direction, [1, 0, 0], 'direction');
    });

    it('should normalize the direction vector', function () {
      const axis = new ReferenceAxis([0, 0, 0], [3, 4, 0], 'Diagonal');

      assertVectorNormalized(axis.direction, 'direction');
      assertVectorClose(axis.direction, [0.6, 0.8, 0], 'normalized direction');
    });
  });

  describe('getPoint', function () {
    it('should return point at parameter t', function () {
      const axis = new ReferenceAxis([0, 0, 0], [1, 0, 0], 'X', { length: 100 });

      assertVectorClose(axis.getPoint(0), [0, 0, 0], 't=0');
      assertVectorClose(axis.getPoint(0.5), [50, 0, 0], 't=0.5');
      assertVectorClose(axis.getPoint(1), [100, 0, 0], 't=1');
    });
  });

  describe('closestPoint', function () {
    it('should find closest point on axis', function () {
      const axis = new ReferenceAxis([0, 0, 0], [1, 0, 0], 'X');
      const closest = axis.closestPoint([50, 100, 0]);

      assertVectorClose(closest, [50, 0, 0], 'closest point');
    });
  });

  describe('distanceToPoint', function () {
    it('should calculate distance from point to axis', function () {
      const axis = new ReferenceAxis([0, 0, 0], [1, 0, 0], 'X');

      assertClose(axis.distanceToPoint([50, 10, 0]), 10, 'distance Y offset');
      assertClose(axis.distanceToPoint([50, 0, 20]), 20, 'distance Z offset');
      assertClose(axis.distanceToPoint([50, 0, 0]), 0, 'on axis');
    });
  });

  describe('serialization', function () {
    it('should serialize and deserialize correctly', function () {
      const original = new ReferenceAxis([5, 10, 15], [0, 0, 1], 'Z Custom', {
        length: 200,
        color: 0x0000ff,
      });

      const json = original.toJSON();
      const restored = ReferenceAxis.fromJSON(json);

      chai.expect(restored.id).to.equal(original.id);
      chai.expect(restored.name).to.equal(original.name);
      chai.expect(restored.origin).to.deep.equal(original.origin);
      assertVectorClose(restored.direction, original.direction, 'restored direction');
      chai.expect(restored.length).to.equal(original.length);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ReferencePoint Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('ReferencePoint', function () {
  beforeEach(function () {
    resetRefIdCounter(1);
  });

  describe('constructor', function () {
    it('should create a point at position', function () {
      const point = new ReferencePoint([10, 20, 30], 'Test Point');

      chai.expect(point.type).to.equal('point');
      chai.expect(point.name).to.equal('Test Point');
      chai.expect(point.position).to.deep.equal([10, 20, 30]);
    });
  });

  describe('distanceTo', function () {
    it('should calculate distance to another point', function () {
      const p1 = new ReferencePoint([0, 0, 0], 'Origin');
      const p2 = new ReferencePoint([3, 4, 0], 'Other');

      assertClose(p1.distanceTo(p2), 5, 'distance to ReferencePoint');
      assertClose(p1.distanceTo([3, 4, 0]), 5, 'distance to array');
    });
  });

  describe('serialization', function () {
    it('should serialize and deserialize correctly', function () {
      const original = new ReferencePoint([100, 200, 300], 'Far Point', {
        size: 5,
        color: 0xffff00,
      });

      const json = original.toJSON();
      const restored = ReferencePoint.fromJSON(json);

      chai.expect(restored.id).to.equal(original.id);
      chai.expect(restored.name).to.equal(original.name);
      chai.expect(restored.position).to.deep.equal(original.position);
      chai.expect(restored.size).to.equal(original.size);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ReferenceGeometryManager Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('ReferenceGeometryManager', function () {
  let manager;

  beforeEach(function () {
    resetRefIdCounter(1);
    manager = new ReferenceGeometryManager();
  });

  describe('default geometry', function () {
    it('should create default XY, XZ, YZ planes', function () {
      const xy = manager.getPlaneByName('XY Plane');
      const xz = manager.getPlaneByName('XZ Plane');
      const yz = manager.getPlaneByName('YZ Plane');

      chai.expect(xy).to.not.be.undefined;
      chai.expect(xz).to.not.be.undefined;
      chai.expect(yz).to.not.be.undefined;

      assertVectorClose(xy.normal, [0, 0, 1], 'XY normal');
      assertVectorClose(xz.normal, [0, 1, 0], 'XZ normal');
      assertVectorClose(yz.normal, [1, 0, 0], 'YZ normal');
    });

    it('should create default X, Y, Z axes', function () {
      const x = manager.getAxisByName('X Axis');
      const y = manager.getAxisByName('Y Axis');
      const z = manager.getAxisByName('Z Axis');

      chai.expect(x).to.not.be.undefined;
      chai.expect(y).to.not.be.undefined;
      chai.expect(z).to.not.be.undefined;

      assertVectorClose(x.direction, [1, 0, 0], 'X direction');
      assertVectorClose(y.direction, [0, 1, 0], 'Y direction');
      assertVectorClose(z.direction, [0, 0, 1], 'Z direction');
    });
  });

  describe('addOffsetPlane', function () {
    it('should create offset plane from XY plane', function () {
      const xy = manager.getPlaneByName('XY Plane');
      const offset = manager.addOffsetPlane(xy.id, 50);

      chai.expect(offset).to.not.be.null;
      chai.expect(offset.origin).to.deep.equal([0, 0, 50]);
      assertVectorClose(offset.normal, [0, 0, 1], 'offset normal same as base');
    });

    it('should return null for non-existent base plane', function () {
      const offset = manager.addOffsetPlane('nonexistent', 50);
      chai.expect(offset).to.be.null;
    });
  });

  describe('addAngledPlane', function () {
    it('should create angled plane at 45 degrees', function () {
      const xy = manager.getPlaneByName('XY Plane');
      const angled = manager.addAngledPlane(xy.id, 45);

      chai.expect(angled).to.not.be.null;
      chai.expect(angled.angle).to.equal(45);
      assertVectorNormalized(angled.normal, 'angled normal');

      // Normal should have rotated from [0,0,1] around the U axis
      // The exact values depend on U direction, but normal should no longer be [0,0,1]
      chai.expect(angled.normal[2]).to.be.below(1);
    });

    it('should create angled plane at 90 degrees', function () {
      const xy = manager.getPlaneByName('XY Plane');
      const angled = manager.addAngledPlane(xy.id, 90);

      chai.expect(angled).to.not.be.null;
      // At 90°, the normal should be perpendicular to original
      const dot =
        angled.normal[0] * xy.normal[0] +
        angled.normal[1] * xy.normal[1] +
        angled.normal[2] * xy.normal[2];
      assertClose(dot, 0, '90° plane normal perpendicular to base');
    });
  });

  describe('addPlaneThrough3Points', function () {
    it('should create plane through 3 points', function () {
      const plane = manager.addPlaneThrough3Points([0, 0, 0], [10, 0, 0], [0, 10, 0], 'Custom');

      chai.expect(plane).to.not.be.undefined;
      // Normal should be [0, 0, 1] or [0, 0, -1] for XY points
      chai.expect(Math.abs(plane.normal[2])).to.equal(1);
    });

    it('should handle non-axis-aligned points', function () {
      const plane = manager.addPlaneThrough3Points([0, 0, 0], [1, 1, 0], [0, 0, 1]);

      assertVectorNormalized(plane.normal, '3-point plane normal');
    });
  });

  describe('addAxisThrough2Points', function () {
    it('should create axis through 2 points', function () {
      const axis = manager.addAxisThrough2Points([0, 0, 0], [10, 0, 0]);

      chai.expect(axis).to.not.be.undefined;
      assertVectorClose(axis.direction, [1, 0, 0], 'axis direction');
    });

    it('should handle arbitrary points', function () {
      const axis = manager.addAxisThrough2Points([5, 5, 5], [10, 10, 10]);

      assertVectorNormalized(axis.direction, 'diagonal axis');
      const sqrt3 = 1 / Math.sqrt(3);
      assertVectorClose(axis.direction, [sqrt3, sqrt3, sqrt3], 'diagonal direction');
    });
  });

  describe('visibility', function () {
    it('should toggle plane visibility', function () {
      const plane = manager.addPlane([0, 0, 0], [1, 0, 0], 'Test');

      chai.expect(plane.visible).to.equal(true);

      manager.setVisibility(plane.id, false);
      chai.expect(plane.visible).to.equal(false);

      manager.setVisibility(plane.id, true);
      chai.expect(plane.visible).to.equal(true);
    });
  });

  describe('remove', function () {
    it('should remove a plane', function () {
      const plane = manager.addPlane([0, 0, 0], [1, 0, 0], 'ToRemove');
      const id = plane.id;

      chai.expect(manager.getPlane(id)).to.not.be.undefined;

      const removed = manager.remove(id);
      chai.expect(removed).to.equal(true);
      chai.expect(manager.getPlane(id)).to.be.undefined;
    });

    it('should return false for non-existent item', function () {
      const removed = manager.remove('nonexistent');
      chai.expect(removed).to.equal(false);
    });
  });

  describe('getAll', function () {
    it('should return all reference geometry', function () {
      manager.addPoint([1, 2, 3], 'P1');
      manager.addPoint([4, 5, 6], 'P2');

      const all = manager.getAll();

      // 3 default planes + 3 default axes + 2 new points
      chai.expect(all.length).to.equal(8);
    });
  });

  describe('serialization', function () {
    it('should serialize and restore manager state', function () {
      manager.addPoint([10, 20, 30], 'Custom Point');
      manager.addPlane([5, 5, 5], [1, 1, 1], 'Custom Plane');

      const json = manager.toJSON();

      // Create new manager and restore
      const restored = new ReferenceGeometryManager();
      // Clear defaults first
      restored.planes.clear();
      restored.axes.clear();
      restored.points.clear();
      restored.fromJSON(json);

      const restoredPoint = restored.getPointByName('Custom Point');
      chai.expect(restoredPoint).to.not.be.undefined;
      chai.expect(restoredPoint.position).to.deep.equal([10, 20, 30]);

      const restoredPlane = restored.getPlaneByName('Custom Plane');
      chai.expect(restoredPlane).to.not.be.undefined;
    });
  });

  describe('clear', function () {
    it('should clear custom geometry but keep defaults', function () {
      manager.addPoint([1, 2, 3], 'Custom');
      manager.addPlane([0, 0, 100], [0, 0, 1], 'Custom Plane');

      manager.clear(false);

      // Defaults should remain
      chai.expect(manager.planes.size).to.equal(3);
      chai.expect(manager.axes.size).to.equal(3);
      chai.expect(manager.points.size).to.equal(0);
    });

    it('should clear everything with includeDefaults=true', function () {
      manager.clear(true);

      chai.expect(manager.planes.size).to.equal(0);
      chai.expect(manager.axes.size).to.equal(0);
      chai.expect(manager.points.size).to.equal(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Reference Geometry Integration', function () {
  let manager;

  beforeEach(function () {
    resetRefIdCounter(1);
    manager = new ReferenceGeometryManager();
  });

  describe('sketch on reference plane workflow', function () {
    it('should support creating offset plane for sketching', function () {
      // User creates offset plane at Z=50
      const xy = manager.getPlaneByName('XY Plane');
      const workplane = manager.addOffsetPlane(xy.id, 50, 'Workplane_50');

      // Verify plane properties are suitable for sketching
      chai.expect(workplane.origin).to.deep.equal([0, 0, 50]);
      assertVectorClose(workplane.normal, [0, 0, 1], 'normal for sketching');

      // U and V directions define sketch coordinate system
      const u = workplane.getUDirection();
      const v = workplane.getVDirection();

      // U and V should form valid 2D coordinate system on plane
      assertVectorNormalized(u, 'sketch U');
      assertVectorNormalized(v, 'sketch V');

      const dotUV = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      assertClose(dotUV, 0, 'U perpendicular to V');
    });

    it('should support angled plane for swept features', function () {
      // User creates plane at 30° for a swept cut
      const xz = manager.getPlaneByName('XZ Plane');
      const angledPlane = manager.addAngledPlane(xz.id, 30, 'Angled_30');

      chai.expect(angledPlane.angle).to.equal(30);
      chai.expect(angledPlane.baseplane).to.equal(xz.id);

      // Plane should still be valid for sketching
      assertVectorNormalized(angledPlane.normal, 'angled normal');
    });
  });

  describe('pattern around reference axis workflow', function () {
    it('should support creating custom axis for circular pattern', function () {
      // User creates axis through two points for pattern
      const axis = manager.addAxisThrough2Points([50, 0, 0], [50, 0, 100], 'Pattern Axis');

      chai.expect(axis.origin).to.deep.equal([50, 0, 0]);
      assertVectorClose(axis.direction, [0, 0, 1], 'vertical axis');

      // Points around axis can be calculated
      const testPoint = [60, 0, 50]; // 10 units from axis in X
      const distance = axis.distanceToPoint(testPoint);
      assertClose(distance, 10, 'distance from axis');
    });
  });

  describe('mirror across reference plane workflow', function () {
    it('should support creating angled mirror plane', function () {
      // User creates 45° plane for mirror
      const yz = manager.getPlaneByName('YZ Plane');
      const mirrorPlane = manager.addAngledPlane(yz.id, 45, 'Mirror_45');

      // Test point reflection would use:
      // - distanceToPoint to get signed distance
      // - projectPoint to get foot of perpendicular
      // - reflection = point - 2 * distance * normal

      const testPoint = [10, 0, 0];
      const distance = mirrorPlane.distanceToPoint(testPoint);
      const projected = mirrorPlane.projectPoint(testPoint);

      // Reflected point should be equidistant on other side
      const reflected = [
        testPoint[0] - 2 * distance * mirrorPlane.normal[0],
        testPoint[1] - 2 * distance * mirrorPlane.normal[1],
        testPoint[2] - 2 * distance * mirrorPlane.normal[2],
      ];

      const reflectedDistance = mirrorPlane.distanceToPoint(reflected);
      assertClose(Math.abs(reflectedDistance), Math.abs(distance), 'symmetric distance');
    });
  });

  describe('assembly workflow with reference points', function () {
    it('should support mate points for assembly', function () {
      // User creates reference points for assembly mates
      const p1 = manager.addPoint([0, 0, 0], 'Part1_Origin');
      const p2 = manager.addPoint([100, 50, 25], 'Part2_Mate');

      // Calculate assembly offset
      const offset = [
        p2.position[0] - p1.position[0],
        p2.position[1] - p1.position[1],
        p2.position[2] - p1.position[2],
      ];

      chai.expect(offset).to.deep.equal([100, 50, 25]);

      // Distance for clearance check
      const distance = p1.distanceTo(p2);
      chai.expect(distance).to.be.above(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Global Instance Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Global referenceGeometry Instance', function () {
  it('should be accessible and functional', function () {
    chai.expect(referenceGeometry).to.be.instanceOf(ReferenceGeometryManager);

    // Should have default geometry
    chai.expect(referenceGeometry.planes.size).to.be.at.least(3);
    chai.expect(referenceGeometry.axes.size).to.be.at.least(3);
  });
});
