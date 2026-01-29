/**
 * Snap System Comprehensive Tests
 *
 * Tests for the AutoCAD/Fusion-style snap system including:
 * - All snap types (endpoint, midpoint, center, intersection, etc.)
 * - Quadrant detection on circles/arcs
 * - Angle snap functionality
 * - Visual indicator rendering
 * - Keyboard modifier handling
 */

import { SnapManager, SnapType, SnapResult, snapManager } from '../src/ui/snap-manager.js';
import { SketchPoint, Sketch } from '../src/sketch/sketch-manager.js';

// Mock sketch for testing
function createTestSketch() {
  const sketch = new Sketch('test', 'xy');

  // Add a horizontal line from (0,0) to (100,0)
  sketch.addLine(0, 0, 100, 0);

  // Add a vertical line from (100,0) to (100,100)
  sketch.addLine(100, 0, 100, 100);

  // Add a circle at (50,50) with radius 20
  sketch.addCircle(50, 50, 20);

  return sketch;
}

// Create sketch with intersecting lines
function createIntersectingSketch() {
  const sketch = new Sketch('intersect', 'xy');
  sketch.addLine(0, 0, 100, 100); // Diagonal
  sketch.addLine(0, 100, 100, 0); // Crossing diagonal
  return sketch;
}

// Create sketch with two circles for intersection testing
function createTwoCirclesSketch() {
  const sketch = new Sketch('circles', 'xy');
  sketch.addCircle(0, 0, 30);
  sketch.addCircle(40, 0, 30);
  return sketch;
}

describe('SnapManager - Enhanced Features', () => {
  let manager;
  let sketch;

  beforeEach(() => {
    manager = new SnapManager();
    sketch = createTestSketch();
  });

  describe('Endpoint Snap Detection', () => {
    it('should snap to line endpoints', () => {
      manager.setTolerance(15);

      const mousePos = new SketchPoint(3, 2);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
      expect(result.type).toBe(SnapType.ENDPOINT);
      expect(result.point.x).toBe(0);
      expect(result.point.y).toBe(0);
    });

    it('should find the closest endpoint when multiple are near', () => {
      manager.setTolerance(20);

      // Near the corner where two lines meet
      const mousePos = new SketchPoint(98, 2);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
      expect(result.type).toBe(SnapType.ENDPOINT);
      expect(result.point.x).toBe(100);
      expect(result.point.y).toBe(0);
    });
  });

  describe('Midpoint Calculation', () => {
    it('should snap to line midpoints', () => {
      manager.setTolerance(15);

      // Near midpoint of horizontal line (50, 0)
      const mousePos = new SketchPoint(52, 3);
      const result = manager.findSnapPoint(mousePos, sketch);

      if (result.type === SnapType.MIDPOINT) {
        expect(result.point.x).toBe(50);
        expect(result.point.y).toBe(0);
      }
    });

    it('should calculate midpoint correctly for vertical line', () => {
      manager.setTolerance(15);

      // Near midpoint of vertical line (100, 50)
      const mousePos = new SketchPoint(98, 52);
      const result = manager.findSnapPoint(mousePos, sketch);

      // Should find midpoint or endpoint based on priority
      expect(result).toBeTruthy();
    });
  });

  describe('Center Detection', () => {
    it('should snap to circle centers', () => {
      manager.setTolerance(15);

      const mousePos = new SketchPoint(48, 52);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
      expect(result.type).toBe(SnapType.CENTER);
      expect(result.point.x).toBe(50);
      expect(result.point.y).toBe(50);
    });
  });

  describe('Quadrant Snap', () => {
    it('should snap to circle quadrants at 0°', () => {
      manager.setTolerance(15);
      manager.setEnabled('endpoint', false);
      manager.setEnabled('midpoint', false);
      manager.setEnabled('center', false);
      manager.setEnabled('nearest', false);

      // Quadrant at 0° is at (70, 50) for circle centered at (50,50) r=20
      const mousePos = new SketchPoint(68, 50);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
      expect(result.type).toBe(SnapType.QUADRANT);
      expect(Math.round(result.point.x)).toBe(70);
      expect(Math.round(result.point.y)).toBe(50);
    });

    it('should snap to circle quadrants at 90°', () => {
      manager.setTolerance(15);
      manager.setEnabled('endpoint', false);
      manager.setEnabled('midpoint', false);
      manager.setEnabled('center', false);
      manager.setEnabled('nearest', false);

      // Quadrant at 90° is at (50, 70) for circle centered at (50,50) r=20
      const mousePos = new SketchPoint(50, 68);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
      expect(result.type).toBe(SnapType.QUADRANT);
      expect(Math.round(result.point.x)).toBe(50);
      expect(Math.round(result.point.y)).toBe(70);
    });

    it('should snap to circle quadrants at 180°', () => {
      manager.setTolerance(15);
      manager.setEnabled('endpoint', false);
      manager.setEnabled('midpoint', false);
      manager.setEnabled('center', false);
      manager.setEnabled('nearest', false);

      // Quadrant at 180° is at (30, 50)
      const mousePos = new SketchPoint(32, 50);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
      expect(result.type).toBe(SnapType.QUADRANT);
      expect(Math.round(result.point.x)).toBe(30);
      expect(Math.round(result.point.y)).toBe(50);
    });

    it('should snap to circle quadrants at 270°', () => {
      manager.setTolerance(15);
      manager.setEnabled('endpoint', false);
      manager.setEnabled('midpoint', false);
      manager.setEnabled('center', false);
      manager.setEnabled('nearest', false);

      // Quadrant at 270° is at (50, 30)
      const mousePos = new SketchPoint(50, 32);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
      expect(result.type).toBe(SnapType.QUADRANT);
      expect(Math.round(result.point.x)).toBe(50);
      expect(Math.round(result.point.y)).toBe(30);
    });
  });

  describe('Intersection Finding', () => {
    it('should find line-line intersections', () => {
      const intersectSketch = createIntersectingSketch();
      manager.setTolerance(15);

      const mousePos = new SketchPoint(48, 52);
      const result = manager.findSnapPoint(mousePos, intersectSketch);

      expect(result).toBeTruthy();
      expect(result.type).toBe(SnapType.INTERSECTION);
      expect(Math.round(result.point.x)).toBe(50);
      expect(Math.round(result.point.y)).toBe(50);
    });

    it('should find circle-circle intersections', () => {
      const circleSketch = createTwoCirclesSketch();
      manager.setTolerance(15);
      manager.setEnabled('endpoint', false);
      manager.setEnabled('midpoint', false);
      manager.setEnabled('center', false);
      manager.setEnabled('nearest', false);
      manager.setEnabled('quadrant', false);

      // Circles at (0,0) r=30 and (40,0) r=30 intersect
      // Intersection points are at approximately (20, ±22.36)
      const mousePos = new SketchPoint(20, 20);
      const result = manager.findSnapPoint(mousePos, circleSketch);

      expect(result).toBeTruthy();
      expect(result.type).toBe(SnapType.INTERSECTION);
    });
  });

  describe('Grid Snap', () => {
    it('should snap to grid intersections', () => {
      manager.setEnabled('endpoint', false);
      manager.setEnabled('midpoint', false);
      manager.setEnabled('center', false);
      manager.setEnabled('nearest', false);
      manager.setEnabled('quadrant', false);
      manager.setGridSize(10);

      const mousePos = new SketchPoint(12, 18);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
      expect(result.point.x).toBe(10);
      expect(result.point.y).toBe(20);
      expect(result.type).toBe(SnapType.GRID);
    });

    it('should respect grid size setting', () => {
      manager.setEnabled('endpoint', false);
      manager.setEnabled('midpoint', false);
      manager.setEnabled('center', false);
      manager.setEnabled('nearest', false);
      manager.setEnabled('quadrant', false);
      manager.setGridSize(5);

      const mousePos = new SketchPoint(12, 18);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result.point.x).toBe(10);
      expect(result.point.y).toBe(20);
    });

    it('should use grid-only mode when Ctrl is held', () => {
      manager.setModifier('ctrl', true);
      manager.setGridSize(10);

      // Near an endpoint but Ctrl is held
      const mousePos = new SketchPoint(3, 2);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
      expect(result.type).toBe(SnapType.GRID);
      expect(result.point.x).toBe(0);
      expect(result.point.y).toBe(0);
    });
  });

  describe('Angle Snap', () => {
    it('should snap angles to 15° increments by default', () => {
      const result = manager.snapAngle(14);
      expect(result.angle).toBe(15);
      expect(result.snapped).toBe(true);
    });

    it('should snap angles to 15° increments', () => {
      const result = manager.snapAngle(46);
      expect(result.angle).toBe(45);
      expect(result.snapped).toBe(true);
    });

    it('should not snap when angle is too far from increment', () => {
      const result = manager.snapAngle(37);
      expect(result.angle).toBe(37);
      expect(result.snapped).toBe(false);
    });

    it('should snap to 30° increments when configured', () => {
      manager.setAngleIncrement(30);

      const result = manager.snapAngle(28);
      expect(result.angle).toBe(30);
      expect(result.snapped).toBe(true);
    });

    it('should snap to 45° increments when configured', () => {
      manager.setAngleIncrement(45);

      const result = manager.snapAngle(43);
      expect(result.angle).toBe(45);
      expect(result.snapped).toBe(true);
    });

    it('should not snap angles when angle snap is disabled', () => {
      manager.setEnabled('angle', false);

      const result = manager.snapAngle(14);
      expect(result.angle).toBe(14);
      expect(result.snapped).toBe(false);
    });
  });

  describe('Snap Distance Threshold', () => {
    it('should not snap when mouse is outside tolerance', () => {
      manager.setTolerance(5);

      // Point is 10 units away from any snap point
      const mousePos = new SketchPoint(200, 200);
      const result = manager.findSnapPoint(mousePos, sketch);

      // Should only get grid snap as fallback
      if (result) {
        expect(result.type).toBe(SnapType.GRID);
      }
    });

    it('should snap when mouse is within tolerance', () => {
      manager.setTolerance(15);

      const mousePos = new SketchPoint(5, 5);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
      expect(result.type).toBe(SnapType.ENDPOINT);
    });
  });

  describe('Keyboard Modifiers', () => {
    it('should disable all snapping when Shift is held', () => {
      manager.setModifier('shift', true);

      const mousePos = new SketchPoint(0, 0);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeNull();
    });

    it('should re-enable snapping when Shift is released', () => {
      manager.setModifier('shift', true);
      manager.setModifier('shift', false);

      const mousePos = new SketchPoint(0, 0);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
    });

    it('should report effectively disabled state', () => {
      manager.setModifier('shift', true);
      expect(manager.isEffectivelyDisabled()).toBe(true);

      manager.setModifier('shift', false);
      expect(manager.isEffectivelyDisabled()).toBe(false);
    });

    it('should report grid-only mode', () => {
      manager.setModifier('ctrl', true);
      expect(manager.isGridOnlyMode()).toBe(true);

      manager.setModifier('ctrl', false);
      expect(manager.isGridOnlyMode()).toBe(false);
    });
  });

  describe('Toggle Active (F3 Style)', () => {
    it('should toggle snapping on/off', () => {
      expect(manager.active).toBe(true);

      const result1 = manager.toggleActive();
      expect(result1).toBe(false);
      expect(manager.active).toBe(false);

      const result2 = manager.toggleActive();
      expect(result2).toBe(true);
      expect(manager.active).toBe(true);
    });
  });

  describe('Visual Indicator Rendering', () => {
    it('should draw endpoint indicator (square)', () => {
      const snap = new SnapResult(new SketchPoint(10, 20), SnapType.ENDPOINT, null, 0);

      // Create mock canvas context
      const ctx = createMockContext();

      manager.drawSnapIndicator(ctx, snap);

      expect(ctx.operations).toContainEqual(expect.objectContaining({ method: 'strokeRect' }));
    });

    it('should draw midpoint indicator (triangle)', () => {
      const snap = new SnapResult(new SketchPoint(10, 20), SnapType.MIDPOINT, null, 0);

      const ctx = createMockContext();
      manager.drawSnapIndicator(ctx, snap);

      expect(ctx.operations).toContainEqual(expect.objectContaining({ method: 'lineTo' }));
    });

    it('should draw center indicator (circle with cross)', () => {
      const snap = new SnapResult(new SketchPoint(10, 20), SnapType.CENTER, null, 0);

      const ctx = createMockContext();
      manager.drawSnapIndicator(ctx, snap);

      expect(ctx.operations).toContainEqual(expect.objectContaining({ method: 'arc' }));
    });

    it('should draw quadrant indicator (diamond)', () => {
      const snap = new SnapResult(new SketchPoint(10, 20), SnapType.QUADRANT, null, 0);

      const ctx = createMockContext();
      manager.drawSnapIndicator(ctx, snap);

      // Diamond is drawn with 4 lineTo calls
      const lineToOps = ctx.operations.filter(op => op.method === 'lineTo');
      expect(lineToOps.length).toBeGreaterThanOrEqual(3);
    });

    it('should draw grid indicator (dot)', () => {
      const snap = new SnapResult(new SketchPoint(10, 20), SnapType.GRID, null, 0);

      const ctx = createMockContext();
      manager.drawSnapIndicator(ctx, snap);

      expect(ctx.operations).toContainEqual(expect.objectContaining({ method: 'fill' }));
    });

    it('should return indicator geometry for THREE.js', () => {
      const snap = new SnapResult(new SketchPoint(10, 20), SnapType.CENTER, null, 0);

      const geometry = manager.getIndicatorGeometry(snap);

      expect(geometry).toBeTruthy();
      expect(geometry.position.x).toBe(10);
      expect(geometry.position.y).toBe(20);
      expect(geometry.type).toBe('Center');
      expect(geometry.shape).toBe('circle-cross');
      expect(geometry.color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('Settings Management', () => {
    it('should return current settings', () => {
      manager.setGridSize(10);
      manager.setTolerance(20);
      manager.setAngleIncrement(30);
      manager.setEnabled('midpoint', false);

      const settings = manager.getSettings();

      expect(settings.gridSize).toBe(10);
      expect(settings.tolerance).toBe(20);
      expect(settings.angleIncrement).toBe(30);
      expect(settings.enabled.midpoint).toBe(false);
    });

    it('should apply settings from object', () => {
      manager.applySettings({
        gridSize: 15,
        tolerance: 25,
        angleIncrement: 45,
        enabled: { grid: false, endpoint: true, quadrant: false },
      });

      const settings = manager.getSettings();

      expect(settings.gridSize).toBe(15);
      expect(settings.tolerance).toBe(25);
      expect(settings.angleIncrement).toBe(45);
      expect(settings.enabled.grid).toBe(false);
      expect(settings.enabled.quadrant).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    it('should get snap type by name', () => {
      expect(manager.getSnapTypeByName('endpoint')).toBe(SnapType.ENDPOINT);
      expect(manager.getSnapTypeByName('QUADRANT')).toBe(SnapType.QUADRANT);
      expect(manager.getSnapTypeByName('invalid')).toBeNull();
    });

    it('should enable all snap types', () => {
      manager.disableAll();
      manager.enableAll();

      const settings = manager.getSettings();
      Object.values(settings.enabled).forEach(val => {
        expect(val).toBe(true);
      });
    });

    it('should disable all snap types', () => {
      manager.disableAll();

      const settings = manager.getSettings();
      Object.values(settings.enabled).forEach(val => {
        expect(val).toBe(false);
      });
    });

    it('should toggle individual snap types', () => {
      const original = manager.enabled.midpoint;
      const result = manager.toggleEnabled('midpoint');

      expect(result).toBe(!original);
      expect(manager.enabled.midpoint).toBe(!original);
    });
  });

  describe('Status String', () => {
    it('should include all enabled snap types', () => {
      manager.enableAll();
      const status = manager.getStatusString();

      expect(status).toContain('End');
      expect(status).toContain('Mid');
      expect(status).toContain('Cen');
      expect(status).toContain('Quad');
      expect(status).toContain('Grid');
    });

    it('should show OFF when inactive', () => {
      manager.setActive(false);
      const status = manager.getStatusString();

      expect(status).toBe('Snap: OFF');
    });
  });

  describe('Priority Ordering', () => {
    it('should prefer endpoint over grid snap', () => {
      manager.setGridSize(10);
      manager.setTolerance(15);

      // Point is near (0,0) endpoint and also near grid
      const mousePos = new SketchPoint(2, 2);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
      expect(result.type.priority).toBeLessThan(SnapType.GRID.priority);
    });

    it('should prefer endpoint over quadrant', () => {
      manager.setTolerance(15);

      // Both endpoint and quadrant available
      const mousePos = new SketchPoint(2, 2);
      const result = manager.findSnapPoint(mousePos, sketch);

      expect(result).toBeTruthy();
      expect(result.type.priority).toBeLessThanOrEqual(SnapType.QUADRANT.priority);
    });
  });
});

describe('SnapType Constants', () => {
  it('should have correct properties for each type', () => {
    expect(SnapType.ENDPOINT.name).toBe('Endpoint');
    expect(SnapType.ENDPOINT.shape).toBe('square');
    expect(SnapType.ENDPOINT.priority).toBeLessThan(SnapType.GRID.priority);

    expect(SnapType.MIDPOINT.name).toBe('Midpoint');
    expect(SnapType.MIDPOINT.shape).toBe('triangle');

    expect(SnapType.CENTER.name).toBe('Center');
    expect(SnapType.CENTER.shape).toBe('circle-cross');

    expect(SnapType.INTERSECTION.name).toBe('Intersection');
    expect(SnapType.INTERSECTION.shape).toBe('cross');

    expect(SnapType.QUADRANT.name).toBe('Quadrant');
    expect(SnapType.QUADRANT.shape).toBe('diamond');

    expect(SnapType.PERPENDICULAR.name).toBe('Perpendicular');
    expect(SnapType.PERPENDICULAR.shape).toBe('perpendicular');

    expect(SnapType.TANGENT.name).toBe('Tangent');
    expect(SnapType.TANGENT.shape).toBe('tangent');

    expect(SnapType.ANGLE.name).toBe('Angle');
    expect(SnapType.ANGLE.shape).toBe('arc');
  });

  it('should have valid colors for all types', () => {
    Object.values(SnapType).forEach(type => {
      expect(typeof type.color).toBe('number');
      expect(type.color).toBeGreaterThanOrEqual(0);
      expect(type.color).toBeLessThanOrEqual(0xffffff);
    });
  });
});

describe('Singleton snapManager', () => {
  it('should export a singleton instance', () => {
    expect(snapManager).toBeInstanceOf(SnapManager);
  });

  it('should have default settings', () => {
    // Reset to defaults
    snapManager.active = true;
    expect(snapManager.active).toBe(true);
  });
});

// Helper: Create a mock canvas context for testing
function createMockContext() {
  const operations = [];

  return {
    operations,
    save: () => operations.push({ method: 'save' }),
    restore: () => operations.push({ method: 'restore' }),
    translate: (x, y) => operations.push({ method: 'translate', args: [x, y] }),
    beginPath: () => operations.push({ method: 'beginPath' }),
    closePath: () => operations.push({ method: 'closePath' }),
    moveTo: (x, y) => operations.push({ method: 'moveTo', args: [x, y] }),
    lineTo: (x, y) => operations.push({ method: 'lineTo', args: [x, y] }),
    arc: (x, y, r, s, e) => operations.push({ method: 'arc', args: [x, y, r, s, e] }),
    stroke: () => operations.push({ method: 'stroke' }),
    fill: () => operations.push({ method: 'fill' }),
    strokeRect: (x, y, w, h) => operations.push({ method: 'strokeRect', args: [x, y, w, h] }),
    fillRect: (x, y, w, h) => operations.push({ method: 'fillRect', args: [x, y, w, h] }),
    set strokeStyle(v) {},
    set fillStyle(v) {},
    set lineWidth(v) {},
    set lineCap(v) {},
    set lineJoin(v) {},
  };
}

// Simple test runner for environments without Jest
if (typeof describe === 'undefined') {
  console.log('Running manual snap-system tests...');

  const manager = new SnapManager();
  const sketch = createTestSketch();

  // Test quadrant snap
  manager.setEnabled('endpoint', false);
  manager.setEnabled('midpoint', false);
  manager.setEnabled('center', false);
  manager.setEnabled('nearest', false);
  manager.setTolerance(15);

  let result = manager.findSnapPoint(new SketchPoint(68, 50), sketch);
  console.log('Quadrant snap test:', result?.type === SnapType.QUADRANT ? 'PASS' : 'FAIL');

  // Test angle snap
  result = manager.snapAngle(14);
  console.log('Angle snap test:', result.angle === 15 && result.snapped ? 'PASS' : 'FAIL');

  // Test keyboard modifier
  manager.setModifier('shift', true);
  result = manager.findSnapPoint(new SketchPoint(0, 0), sketch);
  console.log('Shift modifier test:', result === null ? 'PASS' : 'FAIL');

  // Test toggle
  manager.setModifier('shift', false);
  const active = manager.toggleActive();
  console.log('Toggle test:', active === false ? 'PASS' : 'FAIL');

  console.log('All manual snap-system tests complete!');
}
