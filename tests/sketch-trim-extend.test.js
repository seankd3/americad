/**
 * Ameri-CAD Sketch Trim & Extend Tests
 *
 * Tests for trim and extend operations on sketch entities.
 */

import { Sketch } from '../src/sketch/sketch-manager.js';
import {
  findIntersections,
  findAllIntersections,
  findExtensionIntersections,
  getLineParameter,
} from '../src/sketch/intersections.js';
import { trimEntity, findNearestEntity } from '../src/sketch/trim.js';
import { extendEntity, extendLineByAmount } from '../src/sketch/extend.js';

describe('Sketch Trim & Extend', function () {
  // ============================================================
  // INTERSECTION TESTS
  // ============================================================
  describe('Intersections', function () {
    describe('Line-Line Intersection', function () {
      it('should find intersection of two crossing lines', function () {
        const sketch = new Sketch('test', 'xy');

        // Horizontal line from (0,5) to (10,5)
        const line1 = sketch.addLine(0, 5, 10, 5);
        // Vertical line from (5,0) to (5,10)
        const line2 = sketch.addLine(5, 0, 5, 10);

        const intersections = findIntersections(line1, line2);

        expect(intersections.length).to.equal(1);
        expect(intersections[0].x).to.be.closeTo(5, 0.001);
        expect(intersections[0].y).to.be.closeTo(5, 0.001);
      });

      it('should return empty for parallel lines', function () {
        const sketch = new Sketch('test', 'xy');

        const line1 = sketch.addLine(0, 0, 10, 0);
        const line2 = sketch.addLine(0, 5, 10, 5);

        const intersections = findIntersections(line1, line2);

        expect(intersections.length).to.equal(0);
      });

      it('should return empty for non-intersecting lines', function () {
        const sketch = new Sketch('test', 'xy');

        // Lines that would intersect if extended, but don't overlap
        const line1 = sketch.addLine(0, 0, 5, 0);
        const line2 = sketch.addLine(10, 0, 10, 10);

        const intersections = findIntersections(line1, line2);

        expect(intersections.length).to.equal(0);
      });

      it('should find intersection at line endpoints', function () {
        const sketch = new Sketch('test', 'xy');

        const line1 = sketch.addLine(0, 0, 5, 5);
        const line2 = sketch.addLine(5, 5, 10, 0);

        const intersections = findIntersections(line1, line2);

        expect(intersections.length).to.equal(1);
        expect(intersections[0].x).to.be.closeTo(5, 0.001);
        expect(intersections[0].y).to.be.closeTo(5, 0.001);
      });

      it('should find intersection of diagonal lines', function () {
        const sketch = new Sketch('test', 'xy');

        const line1 = sketch.addLine(0, 0, 10, 10);
        const line2 = sketch.addLine(0, 10, 10, 0);

        const intersections = findIntersections(line1, line2);

        expect(intersections.length).to.equal(1);
        expect(intersections[0].x).to.be.closeTo(5, 0.001);
        expect(intersections[0].y).to.be.closeTo(5, 0.001);
      });
    });

    describe('Line-Circle Intersection', function () {
      it('should find two intersections when line passes through circle', function () {
        const sketch = new Sketch('test', 'xy');

        const line = sketch.addLine(-10, 0, 10, 0);
        const circle = sketch.addCircle(0, 0, 5);

        const intersections = findIntersections(line, circle);

        expect(intersections.length).to.equal(2);

        // Sort by x coordinate
        intersections.sort((a, b) => a.x - b.x);

        expect(intersections[0].x).to.be.closeTo(-5, 0.001);
        expect(intersections[0].y).to.be.closeTo(0, 0.001);
        expect(intersections[1].x).to.be.closeTo(5, 0.001);
        expect(intersections[1].y).to.be.closeTo(0, 0.001);
      });

      it('should find one intersection when line is tangent to circle', function () {
        const sketch = new Sketch('test', 'xy');

        // Tangent line at top of circle
        const line = sketch.addLine(-10, 5, 10, 5);
        const circle = sketch.addCircle(0, 0, 5);

        const intersections = findIntersections(line, circle);

        expect(intersections.length).to.equal(1);
        expect(intersections[0].x).to.be.closeTo(0, 0.001);
        expect(intersections[0].y).to.be.closeTo(5, 0.001);
      });

      it('should return empty when line misses circle', function () {
        const sketch = new Sketch('test', 'xy');

        const line = sketch.addLine(-10, 10, 10, 10);
        const circle = sketch.addCircle(0, 0, 5);

        const intersections = findIntersections(line, circle);

        expect(intersections.length).to.equal(0);
      });

      it('should only find intersections within line segment', function () {
        const sketch = new Sketch('test', 'xy');

        // Short line that only hits one side
        const line = sketch.addLine(-10, 0, 0, 0);
        const circle = sketch.addCircle(0, 0, 5);

        const intersections = findIntersections(line, circle);

        expect(intersections.length).to.equal(1);
        expect(intersections[0].x).to.be.closeTo(-5, 0.001);
      });
    });

    describe('findAllIntersections', function () {
      it('should find all intersections with other entities', function () {
        const sketch = new Sketch('test', 'xy');

        // Create a line that crosses multiple entities
        const mainLine = sketch.addLine(0, 5, 20, 5);

        // Add crossing lines
        sketch.addLine(5, 0, 5, 10);
        sketch.addLine(10, 0, 10, 10);
        sketch.addLine(15, 0, 15, 10);

        const intersections = findAllIntersections(mainLine, sketch);

        expect(intersections.length).to.equal(3);

        // Should be sorted by parameter t
        expect(intersections[0].x).to.be.closeTo(5, 0.001);
        expect(intersections[1].x).to.be.closeTo(10, 0.001);
        expect(intersections[2].x).to.be.closeTo(15, 0.001);
      });

      it('should ignore construction geometry', function () {
        const sketch = new Sketch('test', 'xy');

        const mainLine = sketch.addLine(0, 5, 20, 5);

        // Non-construction line at x=5
        sketch.addLine(5, 0, 5, 10);
        // Construction line at x=10 (should be ignored)
        const constructionLine = sketch.addLine(10, 0, 10, 10);
        constructionLine.construction = true;

        const intersections = findAllIntersections(mainLine, sketch);

        expect(intersections.length).to.equal(1);
        expect(intersections[0].x).to.be.closeTo(5, 0.001);
      });
    });
  });

  // ============================================================
  // TRIM TESTS
  // ============================================================
  describe('Trim', function () {
    describe('Trim Line at Single Intersection', function () {
      it('should trim line at single intersection (click before intersection)', function () {
        const sketch = new Sketch('test', 'xy');

        // Horizontal line
        const mainLine = sketch.addLine(0, 5, 20, 5);
        // Vertical crossing line
        sketch.addLine(10, 0, 10, 10);

        // Click on left portion of line (before intersection)
        const clickPoint = { x: 5, y: 5 };

        const result = trimEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.true;
        expect(result.kept.length).to.equal(1);

        // The kept segment should be from intersection to end
        const kept = result.kept[0];
        expect(kept.start.x).to.be.closeTo(10, 0.001);
        expect(kept.end.x).to.be.closeTo(20, 0.001);
      });

      it('should trim line at single intersection (click after intersection)', function () {
        const sketch = new Sketch('test', 'xy');

        const mainLine = sketch.addLine(0, 5, 20, 5);
        sketch.addLine(10, 0, 10, 10);

        // Click on right portion of line (after intersection)
        const clickPoint = { x: 15, y: 5 };

        const result = trimEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.true;
        expect(result.kept.length).to.equal(1);

        // The kept segment should be from start to intersection
        const kept = result.kept[0];
        expect(kept.start.x).to.be.closeTo(0, 0.001);
        expect(kept.end.x).to.be.closeTo(10, 0.001);
      });
    });

    describe('Trim Line Between Two Intersections', function () {
      it('should trim middle segment between two intersections', function () {
        const sketch = new Sketch('test', 'xy');

        // Horizontal line
        const mainLine = sketch.addLine(0, 5, 30, 5);
        // Two vertical crossing lines
        sketch.addLine(10, 0, 10, 10);
        sketch.addLine(20, 0, 20, 10);

        // Click in middle segment
        const clickPoint = { x: 15, y: 5 };

        const result = trimEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.true;
        expect(result.kept.length).to.equal(2);

        // Sort kept segments by x
        result.kept.sort((a, b) => a.start.x - b.start.x);

        // First segment: 0 to 10
        expect(result.kept[0].start.x).to.be.closeTo(0, 0.001);
        expect(result.kept[0].end.x).to.be.closeTo(10, 0.001);

        // Second segment: 20 to 30
        expect(result.kept[1].start.x).to.be.closeTo(20, 0.001);
        expect(result.kept[1].end.x).to.be.closeTo(30, 0.001);
      });

      it('should trim first segment when clicked', function () {
        const sketch = new Sketch('test', 'xy');

        const mainLine = sketch.addLine(0, 5, 30, 5);
        sketch.addLine(10, 0, 10, 10);
        sketch.addLine(20, 0, 20, 10);

        // Click on first segment
        const clickPoint = { x: 5, y: 5 };

        const result = trimEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.true;
        expect(result.kept.length).to.equal(2);

        // Sort kept segments by x
        result.kept.sort((a, b) => a.start.x - b.start.x);

        // First segment: 10 to 20
        expect(result.kept[0].start.x).to.be.closeTo(10, 0.001);
        expect(result.kept[0].end.x).to.be.closeTo(20, 0.001);

        // Second segment: 20 to 30
        expect(result.kept[1].start.x).to.be.closeTo(20, 0.001);
        expect(result.kept[1].end.x).to.be.closeTo(30, 0.001);
      });

      it('should trim last segment when clicked', function () {
        const sketch = new Sketch('test', 'xy');

        const mainLine = sketch.addLine(0, 5, 30, 5);
        sketch.addLine(10, 0, 10, 10);
        sketch.addLine(20, 0, 20, 10);

        // Click on last segment
        const clickPoint = { x: 25, y: 5 };

        const result = trimEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.true;
        expect(result.kept.length).to.equal(2);

        // Sort kept segments by x
        result.kept.sort((a, b) => a.start.x - b.start.x);

        // First segment: 0 to 10
        expect(result.kept[0].start.x).to.be.closeTo(0, 0.001);
        expect(result.kept[0].end.x).to.be.closeTo(10, 0.001);

        // Second segment: 10 to 20
        expect(result.kept[1].start.x).to.be.closeTo(10, 0.001);
        expect(result.kept[1].end.x).to.be.closeTo(20, 0.001);
      });
    });

    describe('Trim with Circle', function () {
      it('should trim line segment inside a circle', function () {
        const sketch = new Sketch('test', 'xy');

        // Horizontal line through circle center
        const mainLine = sketch.addLine(-20, 0, 20, 0);
        // Circle at origin
        sketch.addCircle(0, 0, 10);

        // Click inside the circle
        const clickPoint = { x: 0, y: 0 };

        const result = trimEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.true;
        expect(result.kept.length).to.equal(2);

        // Sort kept segments by x
        result.kept.sort((a, b) => a.start.x - b.start.x);

        // First segment: -20 to -10 (left of circle)
        expect(result.kept[0].start.x).to.be.closeTo(-20, 0.001);
        expect(result.kept[0].end.x).to.be.closeTo(-10, 0.001);

        // Second segment: 10 to 20 (right of circle)
        expect(result.kept[1].start.x).to.be.closeTo(10, 0.001);
        expect(result.kept[1].end.x).to.be.closeTo(20, 0.001);
      });
    });

    describe('Trim Error Cases', function () {
      it('should error when no intersections exist', function () {
        const sketch = new Sketch('test', 'xy');

        const mainLine = sketch.addLine(0, 0, 10, 0);
        // No other entities to intersect with

        const clickPoint = { x: 5, y: 0 };

        const result = trimEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.false;
        expect(result.error).to.include('No intersections');
      });
    });

    describe('findNearestEntity', function () {
      it('should find nearest line to click point', function () {
        const sketch = new Sketch('test', 'xy');

        sketch.addLine(0, 0, 10, 0);
        sketch.addLine(0, 10, 10, 10);

        // Click near first line
        const result = findNearestEntity({ x: 5, y: 1 }, sketch, 5);

        expect(result).to.not.be.null;
        expect(result.entity.start.y).to.equal(0);
      });

      it('should return null when no entity within tolerance', function () {
        const sketch = new Sketch('test', 'xy');

        sketch.addLine(0, 0, 10, 0);

        // Click far from any entity
        const result = findNearestEntity({ x: 5, y: 50 }, sketch, 10);

        expect(result).to.be.null;
      });
    });
  });

  // ============================================================
  // EXTEND TESTS
  // ============================================================
  describe('Extend', function () {
    describe('Extend Line to Another Line', function () {
      it('should extend line end to intersect another line', function () {
        const sketch = new Sketch('test', 'xy');

        // Short horizontal line
        const mainLine = sketch.addLine(0, 5, 8, 5);
        // Vertical boundary line
        sketch.addLine(10, 0, 10, 10);

        // Click near end to extend
        const clickPoint = { x: 8, y: 5 };

        const result = extendEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.true;
        expect(result.direction).to.equal('end');
        expect(result.newEndpoint.x).to.be.closeTo(10, 0.001);
        expect(result.newEndpoint.y).to.be.closeTo(5, 0.001);
      });

      it('should extend line start to intersect another line', function () {
        const sketch = new Sketch('test', 'xy');

        // Short horizontal line (not starting at 0)
        const mainLine = sketch.addLine(2, 5, 8, 5);
        // Vertical boundary line at x=0
        sketch.addLine(0, 0, 0, 10);

        // Click near start to extend
        const clickPoint = { x: 2, y: 5 };

        const result = extendEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.true;
        expect(result.direction).to.equal('start');
        expect(result.newEndpoint.x).to.be.closeTo(0, 0.001);
        expect(result.newEndpoint.y).to.be.closeTo(5, 0.001);
      });

      it('should extend diagonal line to another line', function () {
        const sketch = new Sketch('test', 'xy');

        // Diagonal line
        const mainLine = sketch.addLine(0, 0, 5, 5);
        // Vertical boundary line
        sketch.addLine(10, 0, 10, 20);

        // Click near end to extend
        const clickPoint = { x: 5, y: 5 };

        const result = extendEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.true;
        expect(result.newEndpoint.x).to.be.closeTo(10, 0.001);
        expect(result.newEndpoint.y).to.be.closeTo(10, 0.001);
      });
    });

    describe('Extend Line to Circle', function () {
      it('should extend line to intersect circle', function () {
        const sketch = new Sketch('test', 'xy');

        // Horizontal line approaching circle
        const mainLine = sketch.addLine(0, 0, 8, 0);
        // Circle at (15, 0) with radius 5
        sketch.addCircle(15, 0, 5);

        // Click near end to extend
        const clickPoint = { x: 8, y: 0 };

        const result = extendEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.true;
        expect(result.newEndpoint.x).to.be.closeTo(10, 0.001); // 15 - 5 = 10
        expect(result.newEndpoint.y).to.be.closeTo(0, 0.001);
      });
    });

    describe('Extend Error Cases', function () {
      it('should error when no boundary to extend to', function () {
        const sketch = new Sketch('test', 'xy');

        const mainLine = sketch.addLine(0, 0, 10, 0);
        // No other entities to extend to

        const clickPoint = { x: 10, y: 0 };

        const result = extendEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.false;
        expect(result.error).to.include('No boundary found');
      });

      it('should error when boundary is behind extension direction', function () {
        const sketch = new Sketch('test', 'xy');

        // Horizontal line
        const mainLine = sketch.addLine(10, 5, 20, 5);
        // Boundary is behind the start point
        sketch.addLine(0, 0, 0, 10);

        // Click near end (wrong direction for boundary)
        const clickPoint = { x: 20, y: 5 };

        const result = extendEntity(mainLine, clickPoint, sketch);

        expect(result.success).to.be.false;
      });
    });

    describe('extendLineByAmount', function () {
      it('should extend line by fixed amount from end', function () {
        const sketch = new Sketch('test', 'xy');

        const line = sketch.addLine(0, 0, 10, 0);

        extendLineByAmount(line, 'end', 5);

        expect(line.end.x).to.be.closeTo(15, 0.001);
        expect(line.end.y).to.be.closeTo(0, 0.001);
      });

      it('should extend line by fixed amount from start', function () {
        const sketch = new Sketch('test', 'xy');

        const line = sketch.addLine(5, 0, 10, 0);

        extendLineByAmount(line, 'start', 5);

        expect(line.start.x).to.be.closeTo(0, 0.001);
        expect(line.start.y).to.be.closeTo(0, 0.001);
      });

      it('should extend diagonal line by amount', function () {
        const sketch = new Sketch('test', 'xy');

        // 3-4-5 triangle direction (unit vector is 0.6, 0.8)
        const line = sketch.addLine(0, 0, 3, 4);

        extendLineByAmount(line, 'end', 5);

        expect(line.end.x).to.be.closeTo(6, 0.001);
        expect(line.end.y).to.be.closeTo(8, 0.001);
      });
    });
  });

  // ============================================================
  // HELPER FUNCTION TESTS
  // ============================================================
  describe('Helper Functions', function () {
    describe('getLineParameter', function () {
      it('should return 0 at start point', function () {
        const sketch = new Sketch('test', 'xy');
        const line = sketch.addLine(0, 0, 10, 0);

        const t = getLineParameter(line, { x: 0, y: 0 });

        expect(t).to.be.closeTo(0, 0.001);
      });

      it('should return 1 at end point', function () {
        const sketch = new Sketch('test', 'xy');
        const line = sketch.addLine(0, 0, 10, 0);

        const t = getLineParameter(line, { x: 10, y: 0 });

        expect(t).to.be.closeTo(1, 0.001);
      });

      it('should return 0.5 at midpoint', function () {
        const sketch = new Sketch('test', 'xy');
        const line = sketch.addLine(0, 0, 10, 0);

        const t = getLineParameter(line, { x: 5, y: 0 });

        expect(t).to.be.closeTo(0.5, 0.001);
      });

      it('should handle diagonal lines', function () {
        const sketch = new Sketch('test', 'xy');
        const line = sketch.addLine(0, 0, 10, 10);

        const t = getLineParameter(line, { x: 5, y: 5 });

        expect(t).to.be.closeTo(0.5, 0.001);
      });
    });

    describe('findExtensionIntersections', function () {
      it('should find intersections in extension direction', function () {
        const sketch = new Sketch('test', 'xy');

        const line = sketch.addLine(0, 5, 5, 5);
        sketch.addLine(10, 0, 10, 10);

        const intersections = findExtensionIntersections(line, sketch, 'end');

        expect(intersections.length).to.equal(1);
        expect(intersections[0].x).to.be.closeTo(10, 0.001);
      });

      it('should sort by distance', function () {
        const sketch = new Sketch('test', 'xy');

        const line = sketch.addLine(0, 5, 5, 5);
        sketch.addLine(10, 0, 10, 10);
        sketch.addLine(20, 0, 20, 10);

        const intersections = findExtensionIntersections(line, sketch, 'end');

        expect(intersections.length).to.equal(2);
        expect(intersections[0].x).to.be.closeTo(10, 0.001); // Nearest first
        expect(intersections[1].x).to.be.closeTo(20, 0.001);
      });

      it('should not find intersections in opposite direction', function () {
        const sketch = new Sketch('test', 'xy');

        const line = sketch.addLine(5, 5, 10, 5);
        sketch.addLine(0, 0, 0, 10); // Behind the start

        const intersections = findExtensionIntersections(line, sketch, 'end');

        // Should not find the line at x=0 when extending from end
        expect(intersections.length).to.equal(0);
      });
    });
  });
});
