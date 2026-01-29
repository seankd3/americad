/**
 * Ameri-CAD Sketch Entities Tests
 * 
 * Comprehensive test coverage for sketch line, rect, circle, arc, spline.
 * Tests geometry properties, constraint application, and serialization.
 */

import {
    Sketch,
    SketchPoint,
    SketchLine,
    SketchCircle,
    SketchArc,
    SketchSpline,
    SketchRectangle,
    ConstraintType
} from '../src/sketch/sketch-manager.js';

import { solveSketch } from '../src/sketch/constraint-solver.js';

describe('Sketch Entities', function() {
    
    // ============================================================
    // LINE TESTS
    // ============================================================
    describe('SketchLine', function() {
        
        it('should create line with two points', function() {
            const sketch = new Sketch('test', 'xy');
            const line = sketch.addLine(0, 0, 10, 0);
            
            expect(line).to.be.instanceOf(SketchLine);
            expect(line.start).to.be.instanceOf(SketchPoint);
            expect(line.end).to.be.instanceOf(SketchPoint);
            expect(line.start.x).to.equal(0);
            expect(line.start.y).to.equal(0);
            expect(line.end.x).to.equal(10);
            expect(line.end.y).to.equal(0);
        });
        
        it('should have correct length', function() {
            const sketch = new Sketch('test', 'xy');
            
            // Horizontal line
            const horizontal = sketch.addLine(0, 0, 10, 0);
            expect(horizontal.length).to.equal(10);
            
            // Vertical line
            const vertical = sketch.addLine(0, 0, 0, 5);
            expect(vertical.length).to.equal(5);
            
            // Diagonal line (3-4-5 triangle)
            const diagonal = sketch.addLine(0, 0, 3, 4);
            expect(diagonal.length).to.equal(5);
            
            // Negative coords
            const negative = sketch.addLine(-5, -5, 5, 5);
            expect(negative.length).to.be.closeTo(Math.sqrt(200), 0.0001);
        });
        
        it('should apply horizontal constraint making y values equal', function() {
            const sketch = new Sketch('test', 'xy');
            
            // Create a diagonal line
            const line = sketch.addLine(0, 0, 10, 5);
            
            // Verify line is not horizontal initially
            expect(line.start.y).to.not.equal(line.end.y);
            
            // Add horizontal constraint
            sketch.addConstraint(ConstraintType.HORIZONTAL, [line.id]);
            
            // Solve the sketch
            const result = solveSketch(sketch);
            
            expect(result.converged).to.be.true;
            // Y values should be equal after solving
            expect(line.start.y).to.be.closeTo(line.end.y, 0.01);
        });
        
        it('should apply vertical constraint making x values equal', function() {
            const sketch = new Sketch('test', 'xy');
            
            // Create a diagonal line
            const line = sketch.addLine(0, 0, 5, 10);
            
            // Verify line is not vertical initially
            expect(line.start.x).to.not.equal(line.end.x);
            
            // Add vertical constraint
            sketch.addConstraint(ConstraintType.VERTICAL, [line.id]);
            
            // Solve the sketch
            const result = solveSketch(sketch);
            
            expect(result.converged).to.be.true;
            // X values should be equal after solving
            expect(line.start.x).to.be.closeTo(line.end.x, 0.01);
        });
        
        it('should compute midpoint correctly', function() {
            const start = new SketchPoint(0, 0);
            const end = new SketchPoint(10, 20);
            const line = new SketchLine(start, end);
            
            const mid = line.midpoint;
            expect(mid.x).to.equal(5);
            expect(mid.y).to.equal(10);
        });
        
        it('should compute angle correctly', function() {
            const start = new SketchPoint(0, 0);
            
            // Horizontal line (angle = 0)
            const horizontal = new SketchLine(start, new SketchPoint(10, 0));
            expect(horizontal.angle).to.be.closeTo(0, 0.0001);
            
            // Vertical line (angle = π/2)
            const vertical = new SketchLine(start, new SketchPoint(0, 10));
            expect(vertical.angle).to.be.closeTo(Math.PI / 2, 0.0001);
            
            // 45° line (angle = π/4)
            const diagonal = new SketchLine(start, new SketchPoint(10, 10));
            expect(diagonal.angle).to.be.closeTo(Math.PI / 4, 0.0001);
        });
        
        it('should detect horizontal and vertical lines', function() {
            // Horizontal line
            const h = new SketchLine(new SketchPoint(0, 5), new SketchPoint(10, 5));
            expect(h.isHorizontal()).to.be.true;
            expect(h.isVertical()).to.be.false;
            
            // Vertical line
            const v = new SketchLine(new SketchPoint(5, 0), new SketchPoint(5, 10));
            expect(v.isHorizontal()).to.be.false;
            expect(v.isVertical()).to.be.true;
            
            // Diagonal line
            const d = new SketchLine(new SketchPoint(0, 0), new SketchPoint(10, 10));
            expect(d.isHorizontal()).to.be.false;
            expect(d.isVertical()).to.be.false;
        });
        
        it('should apply length constraint', function() {
            const sketch = new Sketch('test', 'xy');
            const line = sketch.addLine(0, 0, 10, 0);
            
            // Initial length is 10
            expect(line.length).to.equal(10);
            
            // Add length constraint of 20
            sketch.addConstraint(ConstraintType.LENGTH, [line.id], 20);
            
            const result = solveSketch(sketch);
            expect(result.converged).to.be.true;
            expect(line.length).to.be.closeTo(20, 0.01);
        });
    });
    
    // ============================================================
    // RECTANGLE TESTS
    // ============================================================
    describe('SketchRectangle', function() {
        
        it('should create rectangle with two corners', function() {
            const sketch = new Sketch('test', 'xy');
            const rect = sketch.addRectangle(0, 0, 20, 10);
            
            expect(rect).to.be.instanceOf(SketchRectangle);
            expect(rect.p1.x).to.equal(0);
            expect(rect.p1.y).to.equal(0);
            expect(rect.p3.x).to.equal(20);
            expect(rect.p3.y).to.equal(10);
        });
        
        it('should have 4 lines', function() {
            const sketch = new Sketch('test', 'xy');
            const rect = sketch.addRectangle(0, 0, 20, 10);
            
            const lines = rect.lines;
            expect(lines).to.have.length(4);
            expect(lines[0]).to.be.instanceOf(SketchLine); // bottom
            expect(lines[1]).to.be.instanceOf(SketchLine); // right
            expect(lines[2]).to.be.instanceOf(SketchLine); // top
            expect(lines[3]).to.be.instanceOf(SketchLine); // left
        });
        
        it('should have connected lines (closed shape)', function() {
            const sketch = new Sketch('test', 'xy');
            const rect = sketch.addRectangle(0, 0, 20, 10);
            
            // Check that lines share endpoints
            // bottom.end should equal right.start
            expect(rect.bottom.end.id).to.equal(rect.right.start.id);
            // right.end should equal top.start
            expect(rect.right.end.id).to.equal(rect.top.start.id);
            // top.end should equal left.start
            expect(rect.top.end.id).to.equal(rect.left.start.id);
            // left.end should equal bottom.start
            expect(rect.left.end.id).to.equal(rect.bottom.start.id);
        });
        
        it('should have correct dimensions', function() {
            const sketch = new Sketch('test', 'xy');
            const rect = sketch.addRectangle(5, 5, 25, 15);
            
            expect(rect.width).to.equal(20);
            expect(rect.height).to.equal(10);
        });
        
        it('should have 4 corner points', function() {
            const sketch = new Sketch('test', 'xy');
            const rect = sketch.addRectangle(0, 0, 10, 5);
            
            const points = rect.points;
            expect(points).to.have.length(4);
            
            // Verify corners
            expect(points[0].x).to.equal(0);  // p1 - bottom-left
            expect(points[0].y).to.equal(0);
            expect(points[1].x).to.equal(10); // p2 - bottom-right
            expect(points[1].y).to.equal(0);
            expect(points[2].x).to.equal(10); // p3 - top-right
            expect(points[2].y).to.equal(5);
            expect(points[3].x).to.equal(0);  // p4 - top-left
            expect(points[3].y).to.equal(5);
        });
        
        it('should compute center correctly', function() {
            const sketch = new Sketch('test', 'xy');
            const rect = sketch.addRectangle(0, 0, 20, 10);
            
            const center = rect.center;
            expect(center.x).to.equal(10);
            expect(center.y).to.equal(5);
        });
        
        it('should work with negative coordinates', function() {
            const sketch = new Sketch('test', 'xy');
            const rect = sketch.addRectangle(-10, -10, 10, 10);
            
            expect(rect.width).to.equal(20);
            expect(rect.height).to.equal(20);
            expect(rect.center.x).to.equal(0);
            expect(rect.center.y).to.equal(0);
        });
    });
    
    // ============================================================
    // CIRCLE TESTS
    // ============================================================
    describe('SketchCircle', function() {
        
        it('should create circle with center and radius', function() {
            const sketch = new Sketch('test', 'xy');
            const circle = sketch.addCircle(10, 10, 5);
            
            expect(circle).to.be.instanceOf(SketchCircle);
            expect(circle.center).to.be.instanceOf(SketchPoint);
            expect(circle.center.x).to.equal(10);
            expect(circle.center.y).to.equal(10);
            expect(circle.radius).to.equal(5);
        });
        
        it('should have correct radius', function() {
            const sketch = new Sketch('test', 'xy');
            const circle = sketch.addCircle(0, 0, 15);
            
            expect(circle.radius).to.equal(15);
        });
        
        it('should be a closed curve (implicit)', function() {
            const sketch = new Sketch('test', 'xy');
            const circle = sketch.addCircle(0, 0, 10);
            
            // Circle is implicitly closed - it has no start/end points
            // We verify by checking circumference and area
            expect(circle.circumference).to.be.closeTo(2 * Math.PI * 10, 0.0001);
            expect(circle.area).to.be.closeTo(Math.PI * 100, 0.0001);
        });
        
        it('should compute circumference correctly', function() {
            const center = new SketchPoint(0, 0);
            const circle = new SketchCircle(center, 7);
            
            expect(circle.circumference).to.be.closeTo(2 * Math.PI * 7, 0.0001);
        });
        
        it('should compute area correctly', function() {
            const center = new SketchPoint(0, 0);
            const circle = new SketchCircle(center, 5);
            
            // Area = π * r²
            expect(circle.area).to.be.closeTo(Math.PI * 25, 0.0001);
        });
        
        it('should detect point containment', function() {
            const center = new SketchPoint(0, 0);
            const circle = new SketchCircle(center, 10);
            
            // Point inside
            const inside = new SketchPoint(3, 4); // distance = 5
            expect(circle.containsPoint(inside)).to.be.true;
            
            // Point on edge
            const onEdge = new SketchPoint(10, 0);
            expect(circle.containsPoint(onEdge)).to.be.true;
            
            // Point outside
            const outside = new SketchPoint(15, 0);
            expect(circle.containsPoint(outside)).to.be.false;
        });
        
        it('should apply radius constraint', function() {
            const sketch = new Sketch('test', 'xy');
            const circle = sketch.addCircle(0, 0, 10);
            
            // Add radius constraint to change to 25
            sketch.addConstraint(ConstraintType.RADIUS, [circle.id], 25);
            
            const result = solveSketch(sketch);
            expect(result.converged).to.be.true;
            expect(circle.radius).to.be.closeTo(25, 0.01);
        });
    });
    
    // ============================================================
    // ARC TESTS
    // ============================================================
    describe('SketchArc', function() {
        
        it('should create arc with 3 points', function() {
            const sketch = new Sketch('test', 'xy');
            const arc = sketch.addArc(0, 0, 5, 5, 10, 0);
            
            expect(arc).to.be.instanceOf(SketchArc);
            expect(arc.start).to.be.instanceOf(SketchPoint);
            expect(arc.mid).to.be.instanceOf(SketchPoint);
            expect(arc.end).to.be.instanceOf(SketchPoint);
        });
        
        it('should have correct start and end points', function() {
            const sketch = new Sketch('test', 'xy');
            const arc = sketch.addArc(0, 0, 5, 5, 10, 0);
            
            expect(arc.start.x).to.equal(0);
            expect(arc.start.y).to.equal(0);
            expect(arc.end.x).to.equal(10);
            expect(arc.end.y).to.equal(0);
            
            expect(arc.startPoint.x).to.equal(0);
            expect(arc.startPoint.y).to.equal(0);
            expect(arc.endPoint.x).to.equal(10);
            expect(arc.endPoint.y).to.equal(0);
        });
        
        it('should pass through midpoint', function() {
            const sketch = new Sketch('test', 'xy');
            const arc = sketch.addArc(0, 0, 5, 5, 10, 0);
            
            // The midpoint should be on the arc
            expect(arc.mid.x).to.equal(5);
            expect(arc.mid.y).to.equal(5);
            
            // The midpoint should be at radius distance from center
            const center = arc.center;
            const radius = arc.radius;
            const distToMid = Math.sqrt(
                Math.pow(arc.mid.x - center.x, 2) +
                Math.pow(arc.mid.y - center.y, 2)
            );
            expect(distToMid).to.be.closeTo(radius, 0.01);
        });
        
        it('should compute center and radius correctly', function() {
            // Create a 90° arc (quarter circle)
            // Points: (10, 0), (10/√2, 10/√2 ≈ 7.07, 7.07), (0, 10)
            // This should have center at origin and radius 10
            const sketch = new Sketch('test', 'xy');
            const arc = sketch.addArc(10, 0, 7.071, 7.071, 0, 10);
            
            expect(arc.center.x).to.be.closeTo(0, 0.1);
            expect(arc.center.y).to.be.closeTo(0, 0.1);
            expect(arc.radius).to.be.closeTo(10, 0.1);
        });
        
        it('should compute arc length', function() {
            // Create a semicircle (180°)
            const sketch = new Sketch('test', 'xy');
            // Points on a circle of radius 5, from (-5,0) through (0,5) to (5,0)
            const arc = sketch.addArc(-5, 0, 0, 5, 5, 0);
            
            // Arc length of semicircle = π * r
            expect(arc.arcLength).to.be.closeTo(Math.PI * 5, 0.1);
        });
        
        it('should handle collinear points gracefully', function() {
            const sketch = new Sketch('test', 'xy');
            // Three collinear points
            const arc = sketch.addArc(0, 0, 5, 0, 10, 0);
            
            // Should not throw, should have some reasonable values
            expect(arc.center).to.exist;
            expect(arc.radius).to.be.a('number');
            expect(isNaN(arc.radius)).to.be.false;
        });
    });
    
    // ============================================================
    // SPLINE TESTS
    // ============================================================
    describe('SketchSpline', function() {
        
        it('should create spline with control points', function() {
            const sketch = new Sketch('test', 'xy');
            const controlPoints = [
                { x: 0, y: 0 },
                { x: 10, y: 5 },
                { x: 20, y: 0 },
                { x: 30, y: 5 }
            ];
            const spline = sketch.addSpline(controlPoints);
            
            expect(spline).to.be.instanceOf(SketchSpline);
            expect(spline.controlPoints).to.have.length(4);
            expect(spline.pointCount).to.equal(4);
        });
        
        it('should pass near control points', function() {
            const sketch = new Sketch('test', 'xy');
            const controlPoints = [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 },
                { x: 30, y: 10 }
            ];
            const spline = sketch.addSpline(controlPoints);
            
            // Start point should be exactly at first control point
            const startEval = spline.evaluate(0);
            expect(startEval.x).to.be.closeTo(0, 0.01);
            expect(startEval.y).to.be.closeTo(0, 0.01);
            
            // End point should be near last control point
            const endEval = spline.evaluate(1);
            expect(endEval.x).to.be.closeTo(30, 0.5);
            expect(endEval.y).to.be.closeTo(10, 0.5);
            
            // Middle points should be influenced by control points
            const midEval = spline.evaluate(0.5);
            // Should be somewhere in the middle x-range
            expect(midEval.x).to.be.within(10, 20);
        });
        
        it('should have smooth interpolation (Catmull-Rom)', function() {
            const sketch = new Sketch('test', 'xy');
            const controlPoints = [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 }
            ];
            const spline = sketch.addSpline(controlPoints);
            
            // Sample many points and check for smoothness (no sharp jumps)
            const samples = [];
            for (let t = 0; t <= 1; t += 0.1) {
                const pt = spline.evaluate(t);
                samples.push(pt);
            }
            
            // Check that consecutive points don't have huge jumps
            for (let i = 1; i < samples.length; i++) {
                const dx = Math.abs(samples[i].x - samples[i-1].x);
                const dy = Math.abs(samples[i].y - samples[i-1].y);
                // Changes should be smooth, not jumping wildly
                expect(dx).to.be.lessThan(5);
                expect(dy).to.be.lessThan(5);
            }
        });
        
        it('should support closed splines', function() {
            const sketch = new Sketch('test', 'xy');
            const controlPoints = [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 }
            ];
            const spline = sketch.addSpline(controlPoints, true);
            
            expect(spline.closed).to.be.true;
            
            // For closed spline, start and end should be at the same point
            expect(spline.startPoint.x).to.equal(spline.endPoint.x);
            expect(spline.startPoint.y).to.equal(spline.endPoint.y);
        });
        
        it('should compute approximate length', function() {
            const sketch = new Sketch('test', 'xy');
            // Approximately straight line
            const straightPoints = [
                { x: 0, y: 0 },
                { x: 10, y: 0 }
            ];
            const straightSpline = sketch.addSpline(straightPoints);
            
            // Length should be close to 10
            expect(straightSpline.length).to.be.closeTo(10, 0.5);
        });
        
        it('should tessellate for rendering', function() {
            const sketch = new Sketch('test', 'xy');
            const controlPoints = [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 }
            ];
            const spline = sketch.addSpline(controlPoints);
            
            const tessellated = spline.tessellate(10);
            
            // Should return array of points
            expect(tessellated).to.be.an('array');
            expect(tessellated.length).to.be.greaterThan(10);
            
            // Each point should have x and y
            tessellated.forEach(pt => {
                expect(pt).to.have.property('x');
                expect(pt).to.have.property('y');
            });
        });
        
        it('should add and remove control points', function() {
            const spline = new SketchSpline([]);
            
            spline.addPoint(new SketchPoint(0, 0));
            expect(spline.pointCount).to.equal(1);
            
            spline.addPoint(new SketchPoint(10, 10));
            expect(spline.pointCount).to.equal(2);
            
            spline.addPoint(new SketchPoint(20, 0));
            expect(spline.pointCount).to.equal(3);
            
            const removed = spline.removeLastPoint();
            expect(removed.x).to.equal(20);
            expect(spline.pointCount).to.equal(2);
        });
        
        it('should handle single point gracefully', function() {
            const spline = new SketchSpline([new SketchPoint(5, 5)]);
            
            const pt = spline.evaluate(0.5);
            expect(pt.x).to.equal(5);
            expect(pt.y).to.equal(5);
        });
        
        it('should handle two points (linear interpolation)', function() {
            const spline = new SketchSpline([
                new SketchPoint(0, 0),
                new SketchPoint(10, 10)
            ]);
            
            const mid = spline.evaluate(0.5);
            expect(mid.x).to.equal(5);
            expect(mid.y).to.equal(5);
        });
    });
    
    // ============================================================
    // PROFILE DETECTION TESTS
    // ============================================================
    describe('Profile Detection', function() {
        
        it('should detect closed rectangle as profile', function() {
            const sketch = new Sketch('test', 'xy');
            sketch.addRectangle(0, 0, 20, 10);
            
            const profiles = sketch.getClosedProfiles();
            
            expect(profiles).to.have.length(1);
            expect(profiles[0].type).to.equal('rectangle');
            expect(profiles[0].width).to.equal(20);
            expect(profiles[0].height).to.equal(10);
        });
        
        it('should not detect open lines as profile', function() {
            const sketch = new Sketch('test', 'xy');
            
            // Add three disconnected lines (not forming a closed shape)
            sketch.addLine(0, 0, 10, 0);
            sketch.addLine(20, 0, 30, 0);
            sketch.addLine(40, 0, 50, 0);
            
            const profiles = sketch.getClosedProfiles();
            
            // No closed profiles should be detected from open lines
            expect(profiles).to.have.length(0);
        });
        
        it('should detect circle as closed profile', function() {
            const sketch = new Sketch('test', 'xy');
            sketch.addCircle(10, 10, 5);
            
            const profiles = sketch.getClosedProfiles();
            
            expect(profiles).to.have.length(1);
            expect(profiles[0].type).to.equal('circle');
            expect(profiles[0].radius).to.equal(5);
        });
        
        it('should detect multiple closed regions', function() {
            const sketch = new Sketch('test', 'xy');
            
            // Add two rectangles
            sketch.addRectangle(0, 0, 10, 10);
            sketch.addRectangle(20, 0, 30, 10);
            
            // Add a circle
            sketch.addCircle(50, 5, 3);
            
            const profiles = sketch.getClosedProfiles();
            
            expect(profiles).to.have.length(3);
            
            // Count by type
            const rects = profiles.filter(p => p.type === 'rectangle');
            const circles = profiles.filter(p => p.type === 'circle');
            
            expect(rects).to.have.length(2);
            expect(circles).to.have.length(1);
        });
        
        it('should detect closed chain of connected lines', function() {
            const sketch = new Sketch('test', 'xy');
            
            // Create a triangle manually with connected lines
            // We need lines to share actual point objects
            const p1 = sketch.addPoint(0, 0);
            const p2 = sketch.addPoint(10, 0);
            const p3 = sketch.addPoint(5, 10);
            
            const line1 = new SketchLine(p1, p2);
            const line2 = new SketchLine(p2, p3);
            const line3 = new SketchLine(p3, p1);
            
            sketch.lines.set(line1.id, line1);
            sketch.lines.set(line2.id, line2);
            sketch.lines.set(line3.id, line3);
            
            const profiles = sketch.getClosedProfiles();
            
            // Should detect the triangle as a polygon profile
            const polygons = profiles.filter(p => p.type === 'polygon');
            expect(polygons).to.have.length(1);
            expect(polygons[0].lines).to.have.length(3);
        });
        
        it('should detect closed spline as profile', function() {
            const sketch = new Sketch('test', 'xy');
            const controlPoints = [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 }
            ];
            sketch.addSpline(controlPoints, true); // closed = true
            
            const profiles = sketch.getClosedProfiles();
            
            const splineProfiles = profiles.filter(p => p.type === 'spline');
            expect(splineProfiles).to.have.length(1);
            expect(splineProfiles[0].closed).to.be.true;
        });
        
        it('should not detect open spline as profile', function() {
            const sketch = new Sketch('test', 'xy');
            const controlPoints = [
                { x: 0, y: 0 },
                { x: 10, y: 5 },
                { x: 20, y: 0 }
            ];
            sketch.addSpline(controlPoints, false); // open spline
            
            const profiles = sketch.getClosedProfiles();
            
            const splineProfiles = profiles.filter(p => p.type === 'spline');
            expect(splineProfiles).to.have.length(0);
        });
        
        it('should skip construction geometry', function() {
            const sketch = new Sketch('test', 'xy');
            
            // Add normal rectangle
            const rect = sketch.addRectangle(0, 0, 10, 10);
            
            // Add construction circle
            const circle = sketch.addCircle(20, 5, 3);
            circle.construction = true;
            
            const profiles = sketch.getClosedProfiles();
            
            expect(profiles).to.have.length(1);
            expect(profiles[0].type).to.equal('rectangle');
        });
    });
    
    // ============================================================
    // SERIALIZATION / ROUND-TRIP TESTS
    // ============================================================
    describe('Serialization', function() {
        
        it('should serialize sketch to JSON', function() {
            const sketch = new Sketch('test-sketch', 'xy');
            sketch.addLine(0, 0, 10, 10);
            sketch.addCircle(5, 5, 3);
            sketch.addRectangle(20, 0, 30, 10);
            
            const json = sketch.toJSON();
            
            expect(json).to.have.property('id');
            expect(json).to.have.property('name', 'test-sketch');
            expect(json).to.have.property('plane', 'xy');
            expect(json).to.have.property('points');
            expect(json).to.have.property('lines');
            expect(json).to.have.property('circles');
            expect(json).to.have.property('constraints');
            
            expect(json.points).to.be.an('array');
            expect(json.lines).to.be.an('array');
            expect(json.circles).to.be.an('array');
        });
        
        it('should serialize lines with point references', function() {
            const sketch = new Sketch('test', 'xy');
            const line = sketch.addLine(0, 0, 10, 10);
            
            const json = sketch.toJSON();
            
            expect(json.lines).to.have.length(1);
            expect(json.lines[0]).to.have.property('startId');
            expect(json.lines[0]).to.have.property('endId');
            expect(json.lines[0].startId).to.equal(line.start.id);
            expect(json.lines[0].endId).to.equal(line.end.id);
        });
        
        it('should serialize circles with center reference', function() {
            const sketch = new Sketch('test', 'xy');
            const circle = sketch.addCircle(5, 5, 3);
            
            const json = sketch.toJSON();
            
            expect(json.circles).to.have.length(1);
            expect(json.circles[0]).to.have.property('centerId');
            expect(json.circles[0]).to.have.property('radius', 3);
        });
        
        it('should serialize arcs with three point references', function() {
            const sketch = new Sketch('test', 'xy');
            const arc = sketch.addArc(0, 0, 5, 5, 10, 0);
            
            const json = sketch.toJSON();
            
            expect(json.arcs).to.have.length(1);
            expect(json.arcs[0]).to.have.property('startId');
            expect(json.arcs[0]).to.have.property('midId');
            expect(json.arcs[0]).to.have.property('endId');
        });
        
        it('should serialize splines with control point references', function() {
            const sketch = new Sketch('test', 'xy');
            const spline = sketch.addSpline([
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 20, y: 0 }
            ], true);
            
            const json = sketch.toJSON();
            
            expect(json.splines).to.have.length(1);
            expect(json.splines[0]).to.have.property('pointIds');
            expect(json.splines[0].pointIds).to.have.length(3);
            expect(json.splines[0]).to.have.property('closed', true);
        });
        
        it('should serialize constraints', function() {
            const sketch = new Sketch('test', 'xy');
            const line = sketch.addLine(0, 0, 10, 5);
            sketch.addConstraint(ConstraintType.HORIZONTAL, [line.id]);
            sketch.addConstraint(ConstraintType.LENGTH, [line.id], 15);
            
            const json = sketch.toJSON();
            
            expect(json.constraints).to.have.length(2);
            
            const hConstraint = json.constraints.find(c => c.type === ConstraintType.HORIZONTAL);
            const lConstraint = json.constraints.find(c => c.type === ConstraintType.LENGTH);
            
            expect(hConstraint).to.exist;
            expect(hConstraint.entities).to.include(line.id);
            
            expect(lConstraint).to.exist;
            expect(lConstraint.value).to.equal(15);
        });
        
        it('should preserve construction flag in serialization', function() {
            const sketch = new Sketch('test', 'xy');
            const line = sketch.addLine(0, 0, 10, 10);
            line.construction = true;
            
            const circle = sketch.addCircle(5, 5, 2);
            circle.construction = true;
            
            const json = sketch.toJSON();
            
            expect(json.lines[0].construction).to.be.true;
            expect(json.circles[0].construction).to.be.true;
        });
        
        it('should preserve point fixed flag in serialization', function() {
            const sketch = new Sketch('test', 'xy');
            const point = sketch.addPoint(5, 5);
            point.fixed = true;
            
            const json = sketch.toJSON();
            
            const serializedPoint = json.points.find(p => p.id === point.id);
            expect(serializedPoint.fixed).to.be.true;
        });
    });
    
    // ============================================================
    // CONSTRAINT SOLVER INTEGRATION TESTS  
    // ============================================================
    describe('Constraint Solver Integration', function() {
        
        it('should solve parallel constraint', function() {
            const sketch = new Sketch('test', 'xy');
            const line1 = sketch.addLine(0, 0, 10, 0);  // Horizontal
            const line2 = sketch.addLine(0, 10, 10, 12); // Slight angle
            
            sketch.addConstraint(ConstraintType.PARALLEL, [line1.id, line2.id]);
            
            const result = solveSketch(sketch);
            
            expect(result.converged).to.be.true;
            
            // Angles should be equal (or differ by π)
            const angle1 = line1.angle;
            const angle2 = line2.angle;
            const diff = Math.abs(angle1 - angle2);
            expect(diff).to.be.closeTo(0, 0.05);
        });
        
        it('should solve perpendicular constraint', function() {
            const sketch = new Sketch('test', 'xy');
            const line1 = sketch.addLine(0, 0, 10, 0);  // Horizontal
            const line2 = sketch.addLine(5, 5, 7, 6);   // Random angle
            
            sketch.addConstraint(ConstraintType.PERPENDICULAR, [line1.id, line2.id]);
            
            const result = solveSketch(sketch);
            
            expect(result.converged).to.be.true;
            
            // Angle difference should be π/2 (90°)
            const angle1 = line1.angle;
            const angle2 = line2.angle;
            const diff = Math.abs(Math.abs(angle1 - angle2) - Math.PI / 2);
            expect(diff).to.be.closeTo(0, 0.05);
        });
        
        it('should solve coincident constraint', function() {
            const sketch = new Sketch('test', 'xy');
            const line1 = sketch.addLine(0, 0, 10, 0);
            const line2 = sketch.addLine(12, 2, 22, 2);
            
            // Make line1.end coincident with line2.start
            sketch.addConstraint(ConstraintType.COINCIDENT, [line1.end.id, line2.start.id]);
            
            const result = solveSketch(sketch);
            
            expect(result.converged).to.be.true;
            
            // Points should be at same location
            expect(line1.end.x).to.be.closeTo(line2.start.x, 0.01);
            expect(line1.end.y).to.be.closeTo(line2.start.y, 0.01);
        });
        
        it('should solve equal length constraint', function() {
            const sketch = new Sketch('test', 'xy');
            const line1 = sketch.addLine(0, 0, 10, 0);  // length 10
            const line2 = sketch.addLine(0, 10, 20, 10); // length 20
            
            sketch.addConstraint(ConstraintType.EQUAL, [line1.id, line2.id]);
            
            const result = solveSketch(sketch);
            
            expect(result.converged).to.be.true;
            expect(line1.length).to.be.closeTo(line2.length, 0.1);
        });
        
        it('should handle fixed point constraint', function() {
            const sketch = new Sketch('test', 'xy');
            const line = sketch.addLine(0, 0, 10, 0);
            
            // Fix the start point
            line.start.fixed = true;
            const originalX = line.start.x;
            const originalY = line.start.y;
            
            // Add another constraint that would normally move it
            sketch.addConstraint(ConstraintType.LENGTH, [line.id], 20);
            
            const result = solveSketch(sketch);
            
            expect(result.converged).to.be.true;
            
            // Start should stay fixed
            expect(line.start.x).to.equal(originalX);
            expect(line.start.y).to.equal(originalY);
            
            // Length should be 20
            expect(line.length).to.be.closeTo(20, 0.1);
        });
        
        it('should report constraint status', function() {
            const sketch = new Sketch('test', 'xy');
            sketch.addLine(0, 0, 10, 0);
            
            const result = solveSketch(sketch);
            
            expect(result).to.have.property('status');
            expect(result).to.have.property('converged');
            expect(result).to.have.property('iterations');
            expect(result).to.have.property('maxError');
            expect(result).to.have.property('degreesOfFreedom');
            expect(result).to.have.property('equationCount');
        });
    });
    
    // ============================================================
    // SKETCH POINT TESTS
    // ============================================================
    describe('SketchPoint', function() {
        
        it('should create point with coordinates', function() {
            const point = new SketchPoint(5, 10);
            
            expect(point.x).to.equal(5);
            expect(point.y).to.equal(10);
            expect(point.id).to.be.a('string');
        });
        
        it('should calculate distance to another point', function() {
            const p1 = new SketchPoint(0, 0);
            const p2 = new SketchPoint(3, 4);
            
            expect(p1.distanceTo(p2)).to.equal(5);
        });
        
        it('should clone correctly', function() {
            const original = new SketchPoint(5, 10);
            original.fixed = true;
            original.construction = true;
            
            const clone = original.clone();
            
            expect(clone.x).to.equal(5);
            expect(clone.y).to.equal(10);
            expect(clone.fixed).to.be.true;
            expect(clone.construction).to.be.true;
            expect(clone.id).to.not.equal(original.id); // New ID
        });
        
        it('should convert to array', function() {
            const point = new SketchPoint(7, 9);
            const arr = point.toArray();
            
            expect(arr).to.deep.equal([7, 9]);
        });
    });
});
