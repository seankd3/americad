/**
 * Ameri-CAD Sketch Manager
 *
 * Manages 2D sketches on construction planes.
 * Sketches are the foundation for parametric modeling -
 * they can be extruded, revolved, lofted, etc.
 */

import * as THREE from 'three';
import { snapManager } from '../ui/snap-manager.js';

// Sketch modes
export const SketchMode = {
  NONE: 'none',
  SELECT: 'select',
  LINE: 'line',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  ARC: 'arc',
  POINT: 'point',
  SPLINE: 'spline',
  DIMENSION: 'dimension',
  CONSTRAINT: 'constraint',
};

// Constraint types - Complete professional constraint set
export const ConstraintType = {
  // Geometric Constraints
  HORIZONTAL: 'horizontal', // Line is horizontal
  VERTICAL: 'vertical', // Line is vertical
  COINCIDENT: 'coincident', // Points/endpoints share location
  PERPENDICULAR: 'perpendicular', // Lines are 90° to each other
  PARALLEL: 'parallel', // Lines are parallel
  TANGENT: 'tangent', // Curves are tangent at connection
  EQUAL: 'equal', // Lines/circles have equal length/radius
  CONCENTRIC: 'concentric', // Circles/arcs share center
  COLINEAR: 'colinear', // Lines on same infinite line

  // Positional Constraints
  FIXED: 'fixed', // Lock entity in place
  FIX: 'fix', // Alias for FIXED
  MIDPOINT: 'midpoint', // Point at midpoint of line
  SYMMETRIC: 'symmetric', // Entities symmetric about line

  // Dimensional Constraints
  DISTANCE: 'distance', // Distance between points
  LENGTH: 'length', // Line length constraint (dimension)
  ANGLE: 'angle', // Angle between lines
  RADIUS: 'radius', // Circle/arc radius
  DIAMETER: 'diameter', // Circle diameter (2 * radius)
};

/**
 * A 2D point in sketch space
 */
export class SketchPoint {
  constructor(x = 0, y = 0) {
    this.id = generateSketchId('pt');
    this.x = x;
    this.y = y;
    this.fixed = false;
    this.construction = false;
    this.constraints = [];
  }

  distanceTo(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  clone() {
    const p = new SketchPoint(this.x, this.y);
    p.fixed = this.fixed;
    p.construction = this.construction;
    return p;
  }

  toArray() {
    return [this.x, this.y];
  }
}

/**
 * A 2D line segment in sketch space
 */
export class SketchLine {
  constructor(start, end) {
    this.id = generateSketchId('ln');
    this.start = start; // SketchPoint
    this.end = end; // SketchPoint
    this.construction = false;
    this.constraints = [];
  }

  get length() {
    return this.start.distanceTo(this.end);
  }

  get midpoint() {
    return new SketchPoint((this.start.x + this.end.x) / 2, (this.start.y + this.end.y) / 2);
  }

  get angle() {
    return Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x);
  }

  isHorizontal(tolerance = 0.001) {
    return Math.abs(this.end.y - this.start.y) < tolerance;
  }

  isVertical(tolerance = 0.001) {
    return Math.abs(this.end.x - this.start.x) < tolerance;
  }
}

/**
 * A circle in sketch space
 */
export class SketchCircle {
  constructor(center, radius) {
    this.id = generateSketchId('cr');
    this.center = center; // SketchPoint
    this.radius = radius;
    this.construction = false;
    this.constraints = [];
  }

  get circumference() {
    return 2 * Math.PI * this.radius;
  }

  get area() {
    return Math.PI * this.radius * this.radius;
  }

  containsPoint(point) {
    return this.center.distanceTo(point) <= this.radius;
  }
}

/**
 * An arc in sketch space (three-point arc)
 */
export class SketchArc {
  constructor(start, mid, end) {
    this.id = generateSketchId('ar');
    // Store the three defining points
    this.start = start; // SketchPoint - start of arc
    this.mid = mid; // SketchPoint - point on arc
    this.end = end; // SketchPoint - end of arc
    this.construction = false;
    this.constraints = [];

    // Compute center and radius from three points
    this._computeCircle();
  }

  /**
   * Compute the circle (center, radius) from three points
   */
  _computeCircle() {
    const p1 = this.start;
    const p2 = this.mid;
    const p3 = this.end;

    // Calculate the center using perpendicular bisectors
    const ax = (p1.x + p2.x) / 2;
    const ay = (p1.y + p2.y) / 2;
    const bx = (p2.x + p3.x) / 2;
    const by = (p2.y + p3.y) / 2;

    // Direction vectors of chords
    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;
    const d2x = p3.x - p2.x;
    const d2y = p3.y - p2.y;

    // Perpendicular directions
    const n1x = -d1y;
    const n1y = d1x;
    const n2x = -d2y;
    const n2y = d2x;

    // Find intersection of perpendicular bisectors
    const det = n1x * n2y - n1y * n2x;

    if (Math.abs(det) < 1e-10) {
      // Points are collinear - use midpoint as center (degenerate)
      this._center = new SketchPoint((p1.x + p3.x) / 2, (p1.y + p3.y) / 2);
      this._radius = p1.distanceTo(this._center);
    } else {
      const t = ((bx - ax) * n2y - (by - ay) * n2x) / det;
      const cx = ax + t * n1x;
      const cy = ay + t * n1y;

      this._center = new SketchPoint(cx, cy);
      this._radius = p1.distanceTo(this._center);
    }

    // Compute start and end angles
    this._startAngle = Math.atan2(p1.y - this._center.y, p1.x - this._center.x);
    this._endAngle = Math.atan2(p3.y - this._center.y, p3.x - this._center.x);

    // Determine arc direction (ensure mid point is on the arc)
    const midAngle = Math.atan2(p2.y - this._center.y, p2.x - this._center.x);

    // Check if we need to go the other way around
    let sweep = this._endAngle - this._startAngle;
    if (sweep < 0) sweep += 2 * Math.PI;

    let midSweep = midAngle - this._startAngle;
    if (midSweep < 0) midSweep += 2 * Math.PI;

    if (midSweep > sweep) {
      // Mid point is not on the short arc, need to go the long way
      this._clockwise = true;
    } else {
      this._clockwise = false;
    }
  }

  get center() {
    return this._center;
  }

  get radius() {
    return this._radius;
  }

  get startAngle() {
    return this._startAngle;
  }

  get endAngle() {
    return this._endAngle;
  }

  get sweepAngle() {
    let sweep = this._endAngle - this._startAngle;
    if (this._clockwise) {
      if (sweep > 0) sweep -= 2 * Math.PI;
    } else {
      if (sweep < 0) sweep += 2 * Math.PI;
    }
    return Math.abs(sweep);
  }

  get arcLength() {
    return this._radius * this.sweepAngle;
  }

  get startPoint() {
    return this.start;
  }

  get endPoint() {
    return this.end;
  }
}

/**
 * A spline/bezier curve in sketch space
 * Uses Catmull-Rom interpolation for smooth curves through control points
 */
export class SketchSpline {
  constructor(controlPoints = []) {
    this.id = generateSketchId('sp');
    this.controlPoints = controlPoints; // Array of SketchPoint
    this.degree = 3; // Cubic bezier/spline
    this.closed = false;
    this.construction = false;
    this.constraints = [];
  }

  /**
   * Get points array as [[x,y], [x,y], ...]
   */
  get points() {
    return this.controlPoints.map(p => [p.x, p.y]);
  }

  /**
   * Add a control point
   */
  addPoint(point) {
    this.controlPoints.push(point);
  }

  /**
   * Remove last control point
   */
  removeLastPoint() {
    if (this.controlPoints.length > 0) {
      return this.controlPoints.pop();
    }
    return null;
  }

  /**
   * Close the spline into a loop
   */
  close() {
    this.closed = true;
  }

  /**
   * Get the number of control points
   */
  get pointCount() {
    return this.controlPoints.length;
  }

  /**
   * Evaluate point on curve at parameter t (0-1)
   * Uses Catmull-Rom spline interpolation
   */
  evaluate(t) {
    const points = this.controlPoints;
    const n = points.length;

    if (n === 0) return null;
    if (n === 1) return { x: points[0].x, y: points[0].y };
    if (n === 2) {
      // Linear interpolation for 2 points
      return {
        x: points[0].x + t * (points[1].x - points[0].x),
        y: points[0].y + t * (points[1].y - points[0].y),
      };
    }

    // Catmull-Rom spline for 3+ points
    const segmentCount = this.closed ? n : n - 1;
    const scaledT = t * segmentCount;
    const segment = Math.min(Math.floor(scaledT), segmentCount - 1);
    const localT = scaledT - segment;

    // Get 4 control points for this segment
    let p0, p1, p2, p3;

    if (this.closed) {
      p0 = points[(segment - 1 + n) % n];
      p1 = points[segment % n];
      p2 = points[(segment + 1) % n];
      p3 = points[(segment + 2) % n];
    } else {
      p0 = points[Math.max(0, segment - 1)];
      p1 = points[segment];
      p2 = points[Math.min(n - 1, segment + 1)];
      p3 = points[Math.min(n - 1, segment + 2)];
    }

    // Catmull-Rom basis functions
    const t2 = localT * localT;
    const t3 = t2 * localT;

    const c0 = -0.5 * t3 + t2 - 0.5 * localT;
    const c1 = 1.5 * t3 - 2.5 * t2 + 1;
    const c2 = -1.5 * t3 + 2 * t2 + 0.5 * localT;
    const c3 = 0.5 * t3 - 0.5 * t2;

    return {
      x: c0 * p0.x + c1 * p1.x + c2 * p2.x + c3 * p3.x,
      y: c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y,
    };
  }

  /**
   * Get tessellated points for rendering
   * @param {number} segments - Number of segments per control point span
   */
  tessellate(segments = 20) {
    const points = [];
    const n = this.controlPoints.length;

    if (n < 2) {
      return this.controlPoints.map(p => ({ x: p.x, y: p.y }));
    }

    const totalSegments = (this.closed ? n : n - 1) * segments;

    for (let i = 0; i <= totalSegments; i++) {
      const t = i / totalSegments;
      const pt = this.evaluate(t);
      if (pt) points.push(pt);
    }

    return points;
  }

  /**
   * Get approximate arc length
   */
  get length() {
    const tessellated = this.tessellate(10);
    let len = 0;
    for (let i = 1; i < tessellated.length; i++) {
      const dx = tessellated[i].x - tessellated[i - 1].x;
      const dy = tessellated[i].y - tessellated[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  /**
   * Get start point
   */
  get startPoint() {
    return this.controlPoints[0] || null;
  }

  /**
   * Get end point
   */
  get endPoint() {
    return this.closed
      ? this.controlPoints[0]
      : this.controlPoints[this.controlPoints.length - 1] || null;
  }
}

/**
 * A rectangle (4 lines with constraints)
 */
export class SketchRectangle {
  constructor(corner1, corner2) {
    this.id = generateSketchId('rc');

    // Create corner points
    this.p1 = corner1; // bottom-left
    this.p2 = new SketchPoint(corner2.x, corner1.y); // bottom-right
    this.p3 = corner2; // top-right
    this.p4 = new SketchPoint(corner1.x, corner2.y); // top-left

    // Create lines
    this.bottom = new SketchLine(this.p1, this.p2);
    this.right = new SketchLine(this.p2, this.p3);
    this.top = new SketchLine(this.p3, this.p4);
    this.left = new SketchLine(this.p4, this.p1);

    this.construction = false;
  }

  get width() {
    return Math.abs(this.p2.x - this.p1.x);
  }

  get height() {
    return Math.abs(this.p4.y - this.p1.y);
  }

  get center() {
    return new SketchPoint((this.p1.x + this.p3.x) / 2, (this.p1.y + this.p3.y) / 2);
  }

  get lines() {
    return [this.bottom, this.right, this.top, this.left];
  }

  get points() {
    return [this.p1, this.p2, this.p3, this.p4];
  }
}

/**
 * A constraint between sketch entities
 */
export class SketchConstraint {
  constructor(type, entities, value = null) {
    this.id = generateSketchId('cn');
    this.type = type; // ConstraintType
    this.entities = entities; // Array of entity IDs
    this.value = value; // Optional value (for distance, angle, etc.)
    this.satisfied = false;
  }
}

/**
 * A complete sketch on a construction plane
 */
export class Sketch {
  constructor(name, plane) {
    this.id = generateSketchId('sk');
    this.name = name;
    this.plane = plane; // 'xy', 'xz', 'yz', or custom plane

    // Sketch entities
    this.points = new Map();
    this.lines = new Map();
    this.circles = new Map();
    this.arcs = new Map();
    this.splines = new Map();
    this.rectangles = new Map();

    // Constraints
    this.constraints = new Map();

    // State
    this.closed = false;
    this.fullyConstrained = false;

    // Transform from world to sketch coordinates
    this.origin = new THREE.Vector3(0, 0, 0);
    this.normal = this._getPlaneNormal(plane);
    this.xAxis = this._getPlaneXAxis(plane);
    this.yAxis = this._getPlaneYAxis(plane);
  }

  _getPlaneNormal(plane) {
    switch (plane) {
      case 'xy':
        return new THREE.Vector3(0, 0, 1);
      case 'xz':
        return new THREE.Vector3(0, 1, 0);
      case 'yz':
        return new THREE.Vector3(1, 0, 0);
      default:
        return new THREE.Vector3(0, 0, 1);
    }
  }

  _getPlaneXAxis(plane) {
    switch (plane) {
      case 'xy':
        return new THREE.Vector3(1, 0, 0);
      case 'xz':
        return new THREE.Vector3(1, 0, 0);
      case 'yz':
        return new THREE.Vector3(0, 0, 1);
      default:
        return new THREE.Vector3(1, 0, 0);
    }
  }

  _getPlaneYAxis(plane) {
    switch (plane) {
      case 'xy':
        return new THREE.Vector3(0, 1, 0);
      case 'xz':
        return new THREE.Vector3(0, 0, -1);
      case 'yz':
        return new THREE.Vector3(0, 1, 0);
      default:
        return new THREE.Vector3(0, 1, 0);
    }
  }

  /**
   * Convert 3D world point to 2D sketch coordinates
   */
  worldToSketch(worldPoint) {
    const local = worldPoint.clone().sub(this.origin);
    return new SketchPoint(local.dot(this.xAxis), local.dot(this.yAxis));
  }

  /**
   * Convert 2D sketch point to 3D world coordinates
   */
  sketchToWorld(sketchPoint) {
    return this.origin
      .clone()
      .add(this.xAxis.clone().multiplyScalar(sketchPoint.x))
      .add(this.yAxis.clone().multiplyScalar(sketchPoint.y));
  }

  /**
   * Add a point to the sketch
   */
  addPoint(x, y) {
    const point = new SketchPoint(x, y);
    this.points.set(point.id, point);
    return point;
  }

  /**
   * Add a line to the sketch
   */
  addLine(startX, startY, endX, endY) {
    const start = this.addPoint(startX, startY);
    const end = this.addPoint(endX, endY);
    const line = new SketchLine(start, end);
    this.lines.set(line.id, line);
    return line;
  }

  /**
   * Add a circle to the sketch
   */
  addCircle(centerX, centerY, radius) {
    const center = this.addPoint(centerX, centerY);
    const circle = new SketchCircle(center, radius);
    this.circles.set(circle.id, circle);
    return circle;
  }

  /**
   * Add a rectangle to the sketch
   */
  addRectangle(x1, y1, x2, y2) {
    const corner1 = this.addPoint(x1, y1);
    const corner2 = this.addPoint(x2, y2);
    const rect = new SketchRectangle(corner1, corner2);
    this.rectangles.set(rect.id, rect);

    // Also add individual lines and points
    rect.points.forEach(p => this.points.set(p.id, p));
    rect.lines.forEach(l => this.lines.set(l.id, l));

    return rect;
  }

  /**
   * Add a three-point arc to the sketch
   */
  addArc(startX, startY, midX, midY, endX, endY) {
    const start = this.addPoint(startX, startY);
    const mid = this.addPoint(midX, midY);
    const end = this.addPoint(endX, endY);
    const arc = new SketchArc(start, mid, end);
    this.arcs.set(arc.id, arc);
    return arc;
  }

  /**
   * Add a spline to the sketch
   * @param {Array<{x: number, y: number}>} controlPoints - Array of control point coordinates
   * @param {boolean} closed - Whether the spline is closed
   */
  addSpline(controlPoints, closed = false) {
    const sketchPoints = controlPoints.map(p => this.addPoint(p.x, p.y));
    const spline = new SketchSpline(sketchPoints);
    spline.closed = closed;
    this.splines.set(spline.id, spline);
    return spline;
  }

  /**
   * Add a constraint to the sketch
   */
  addConstraint(type, entityIds, value = null) {
    const constraint = new SketchConstraint(type, entityIds, value);
    this.constraints.set(constraint.id, constraint);

    // Mark entities as constrained
    entityIds.forEach(id => {
      const entity = this.getEntity(id);
      if (entity && entity.constraints) {
        entity.constraints.push(constraint.id);
      }
    });

    return constraint;
  }

  /**
   * Get any entity by ID
   */
  getEntity(id) {
    return (
      this.points.get(id) ||
      this.lines.get(id) ||
      this.circles.get(id) ||
      this.arcs.get(id) ||
      this.splines.get(id) ||
      this.rectangles.get(id)
    );
  }

  /**
   * Get all entities as an array
   */
  getAllEntities() {
    return [
      ...this.points.values(),
      ...this.lines.values(),
      ...this.circles.values(),
      ...this.arcs.values(),
      ...this.splines.values(),
      ...this.rectangles.values(),
    ];
  }

  /**
   * Find point near given coordinates
   */
  findPointNear(x, y, tolerance = 2) {
    for (const point of this.points.values()) {
      if (point.distanceTo(new SketchPoint(x, y)) <= tolerance) {
        return point;
      }
    }
    return null;
  }

  /**
   * Clear all entities
   */
  clear() {
    this.points.clear();
    this.lines.clear();
    this.circles.clear();
    this.arcs.clear();
    this.splines.clear();
    this.rectangles.clear();
    this.constraints.clear();
  }

  /**
   * Serialize sketch to JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      plane: this.plane,
      points: Array.from(this.points.values()).map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        fixed: p.fixed,
        construction: p.construction,
      })),
      lines: Array.from(this.lines.values()).map(l => ({
        id: l.id,
        startId: l.start.id,
        endId: l.end.id,
        construction: l.construction,
      })),
      circles: Array.from(this.circles.values()).map(c => ({
        id: c.id,
        centerId: c.center.id,
        radius: c.radius,
        construction: c.construction,
      })),
      arcs: Array.from(this.arcs.values()).map(a => ({
        id: a.id,
        startId: a.start.id,
        midId: a.mid.id,
        endId: a.end.id,
        construction: a.construction,
      })),
      splines: Array.from(this.splines.values()).map(s => ({
        id: s.id,
        pointIds: s.controlPoints.map(p => p.id),
        degree: s.degree,
        closed: s.closed,
        construction: s.construction,
      })),
      rectangles: Array.from(this.rectangles.values()).map(r => ({
        id: r.id,
        p1Id: r.p1.id,
        p2Id: r.p2.id,
        p3Id: r.p3.id,
        p4Id: r.p4.id,
        construction: r.construction,
      })),
      constraints: Array.from(this.constraints.values()).map(c => ({
        id: c.id,
        type: c.type,
        entities: c.entities,
        value: c.value,
      })),
    };
  }

  /**
   * Convert sketch elements to a format suitable for extrusion
   * Returns array of closed profiles with their geometry
   */
  getClosedProfiles() {
    const profiles = [];

    // 1. Rectangles are always closed profiles
    for (const rect of this.rectangles.values()) {
      if (rect.construction) continue;
      profiles.push({
        type: 'rectangle',
        entity: rect,
        points: [
          { x: rect.p1.x, y: rect.p1.y },
          { x: rect.p2.x, y: rect.p2.y },
          { x: rect.p3.x, y: rect.p3.y },
          { x: rect.p4.x, y: rect.p4.y },
        ],
        width: Math.abs(rect.p2.x - rect.p1.x),
        height: Math.abs(rect.p4.y - rect.p1.y),
        center: {
          x: (rect.p1.x + rect.p3.x) / 2,
          y: (rect.p1.y + rect.p3.y) / 2,
        },
      });
    }

    // 2. Circles are closed profiles
    for (const circle of this.circles.values()) {
      if (circle.construction) continue;
      profiles.push({
        type: 'circle',
        entity: circle,
        center: { x: circle.center.x, y: circle.center.y },
        radius: circle.radius,
      });
    }

    // 3. Find closed chains of lines
    const closedChains = this._findClosedLineChains();
    for (const chain of closedChains) {
      profiles.push({
        type: 'polygon',
        points: chain.map(line => ({ x: line.start.x, y: line.start.y })),
        lines: chain,
      });
    }

    // 4. Closed splines are profiles
    for (const spline of this.splines.values()) {
      if (spline.construction) continue;
      if (spline.closed && spline.controlPoints.length >= 3) {
        profiles.push({
          type: 'spline',
          entity: spline,
          controlPoints: spline.controlPoints.map(p => ({ x: p.x, y: p.y })),
          closed: true,
        });
      }
    }

    return profiles;
  }

  /**
   * Find closed chains of connected lines
   */
  _findClosedLineChains() {
    const chains = [];
    const usedLines = new Set();
    const lines = Array.from(this.lines.values()).filter(l => !l.construction);

    // Build adjacency map (point ID -> lines that touch it)
    const adjacency = new Map();

    for (const line of lines) {
      const startId = line.start.id;
      const endId = line.end.id;

      if (!adjacency.has(startId)) adjacency.set(startId, []);
      if (!adjacency.has(endId)) adjacency.set(endId, []);

      adjacency.get(startId).push({ line, endpoint: 'start', otherPoint: line.end });
      adjacency.get(endId).push({ line, endpoint: 'end', otherPoint: line.start });
    }

    // Try to build closed chains starting from each line
    for (const startLine of lines) {
      if (usedLines.has(startLine.id)) continue;

      const chain = this._traceChain(startLine, adjacency, usedLines);
      if (chain && chain.length >= 3) {
        // Verify it's actually closed
        const firstStart = chain[0].start;
        const lastEnd = chain[chain.length - 1].end;

        if (this._pointsMatch(firstStart, lastEnd)) {
          chains.push(chain);
          chain.forEach(l => usedLines.add(l.id));
        }
      }
    }

    return chains;
  }

  /**
   * Trace a chain of connected lines
   */
  _traceChain(startLine, adjacency, usedLines, maxDepth = 100) {
    const chain = [startLine];
    let currentPoint = startLine.end;
    const startPoint = startLine.start;

    for (let i = 0; i < maxDepth; i++) {
      // Find next connected line
      const connections = adjacency.get(currentPoint.id) || [];

      let nextLine = null;
      let nextPoint = null;

      for (const conn of connections) {
        if (conn.line.id === chain[chain.length - 1].id) continue; // Skip current line
        if (usedLines.has(conn.line.id)) continue; // Skip used lines
        if (chain.some(l => l.id === conn.line.id)) continue; // Skip lines already in chain

        nextLine = conn.line;
        nextPoint = conn.otherPoint;
        break;
      }

      if (!nextLine) {
        // Dead end
        return null;
      }

      chain.push(nextLine);

      // Check if we closed the loop
      if (this._pointsMatch(nextPoint, startPoint)) {
        return chain;
      }

      currentPoint = nextPoint;
    }

    return null; // Max depth reached
  }

  /**
   * Check if two points are coincident (within tolerance)
   */
  _pointsMatch(p1, p2, tolerance = 0.001) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy) < tolerance;
  }
}

/**
 * Sketch Manager - handles active sketch and drawing state
 */
export class SketchManager {
  constructor() {
    this.sketches = new Map();
    this.activeSketch = null;
    this.mode = SketchMode.NONE;

    // Drawing state
    this.tempPoints = [];
    this.previewEntity = null;
    this.snapPoint = null;
    this.snapResult = null; // Full snap result with type info

    // Selection
    this.selectedEntities = new Set();
    this.hoveredEntity = null;

    // Legacy settings (delegated to snapManager)
    this.gridSnap = true;
    this.gridSize = 5;
    this.endpointSnap = true;
    this.snapTolerance = 10;

    // Use the global snap manager
    this.snapManager = snapManager;

    // Sync legacy settings with snap manager
    this._syncSnapSettings();

    // Callbacks
    this.onSketchUpdate = null;
    this.onModeChange = null;
    this.onSnapUpdate = null; // Callback for snap visual updates
  }

  /**
   * Sync legacy settings with the snap manager
   */
  _syncSnapSettings() {
    this.snapManager.setEnabled('grid', this.gridSnap);
    this.snapManager.setGridSize(this.gridSize);
    this.snapManager.setEnabled('endpoint', this.endpointSnap);
    this.snapManager.setTolerance(this.snapTolerance);
  }

  /**
   * Create a new sketch on a plane
   */
  createSketch(name, plane = 'xy') {
    const sketch = new Sketch(name, plane);
    this.sketches.set(sketch.id, sketch);
    return sketch;
  }

  /**
   * Enter sketch editing mode
   */
  enterSketch(sketch) {
    this.activeSketch = sketch;
    this.mode = SketchMode.SELECT;
    this.tempPoints = [];
    this.selectedEntities.clear();

    if (this.onModeChange) {
      this.onModeChange(this.mode, sketch);
    }
  }

  /**
   * Exit sketch editing mode
   */
  exitSketch() {
    this.activeSketch = null;
    this.mode = SketchMode.NONE;
    this.tempPoints = [];
    this.previewEntity = null;
    this.selectedEntities.clear();

    if (this.onModeChange) {
      this.onModeChange(this.mode, null);
    }
  }

  /**
   * Set the current drawing mode
   */
  setMode(mode) {
    this.mode = mode;
    this.tempPoints = [];
    this.previewEntity = null;

    if (this.onModeChange) {
      this.onModeChange(mode, this.activeSketch);
    }
  }

  /**
   * Handle click in sketch
   */
  handleClick(worldPoint) {
    if (!this.activeSketch) return;

    // Convert to sketch coordinates
    const sketchPoint = this.activeSketch.worldToSketch(worldPoint);

    // Apply snapping
    const snapped = this.applySnap(sketchPoint);

    switch (this.mode) {
      case SketchMode.LINE:
        return this.handleLineClick(snapped);
      case SketchMode.RECTANGLE:
        return this.handleRectangleClick(snapped);
      case SketchMode.CIRCLE:
        return this.handleCircleClick(snapped);
      case SketchMode.ARC:
        return this.handleArcClick(snapped);
      case SketchMode.SPLINE:
        return this.handleSplineClick(snapped);
      case SketchMode.POINT:
        return this.handlePointClick(snapped);
      case SketchMode.SELECT:
        return this.handleSelectClick(snapped);
    }
  }

  /**
   * Handle double-click in sketch (for finishing splines, etc.)
   */
  handleDoubleClick(_worldPoint) {
    if (!this.activeSketch) return;

    if (this.mode === SketchMode.SPLINE) {
      return this.finishSpline();
    }
  }

  /**
   * Handle mouse move in sketch
   */
  handleMove(worldPoint) {
    if (!this.activeSketch) return;

    const sketchPoint = this.activeSketch.worldToSketch(worldPoint);
    const snapped = this.applySnap(sketchPoint);

    // Update preview based on mode
    switch (this.mode) {
      case SketchMode.LINE:
        if (this.tempPoints.length === 1) {
          this.previewEntity = new SketchLine(this.tempPoints[0], snapped);
        }
        break;
      case SketchMode.RECTANGLE:
        if (this.tempPoints.length === 1) {
          this.previewEntity = new SketchRectangle(this.tempPoints[0], snapped);
        }
        break;
      case SketchMode.CIRCLE:
        if (this.tempPoints.length === 1) {
          const radius = this.tempPoints[0].distanceTo(snapped);
          this.previewEntity = new SketchCircle(this.tempPoints[0], radius);
        }
        break;
      case SketchMode.ARC:
        if (this.tempPoints.length === 1) {
          // Show line from start to current
          this.previewEntity = new SketchLine(this.tempPoints[0], snapped);
        } else if (this.tempPoints.length === 2) {
          // Show arc preview through three points
          try {
            this.previewEntity = new SketchArc(this.tempPoints[0], this.tempPoints[1], snapped);
          } catch {
            // Points might be collinear
            this.previewEntity = new SketchLine(this.tempPoints[0], snapped);
          }
        }
        break;
      case SketchMode.SPLINE:
        // Show spline preview with current points plus cursor position
        if (this.tempPoints.length >= 1) {
          const previewPoints = [...this.tempPoints, snapped];
          this.previewEntity = new SketchSpline(previewPoints);
          this.previewEntity._isPreview = true;
        }
        break;
    }

    if (this.onSketchUpdate) {
      this.onSketchUpdate(this.activeSketch, this.previewEntity);
    }
  }

  /**
   * Handle line mode click
   */
  handleLineClick(point) {
    if (this.tempPoints.length === 0) {
      // First click - start point
      this.tempPoints.push(point.clone());
    } else {
      // Second click - create line
      const line = this.activeSketch.addLine(
        this.tempPoints[0].x,
        this.tempPoints[0].y,
        point.x,
        point.y
      );

      // Continue line from this point
      this.tempPoints = [point.clone()];
      this.previewEntity = null;

      if (this.onSketchUpdate) {
        this.onSketchUpdate(this.activeSketch);
      }

      return line;
    }
  }

  /**
   * Handle rectangle mode click
   */
  handleRectangleClick(point) {
    if (this.tempPoints.length === 0) {
      this.tempPoints.push(point.clone());
    } else {
      const rect = this.activeSketch.addRectangle(
        this.tempPoints[0].x,
        this.tempPoints[0].y,
        point.x,
        point.y
      );

      // Auto-add horizontal/vertical constraints
      this.activeSketch.addConstraint(ConstraintType.HORIZONTAL, [rect.bottom.id]);
      this.activeSketch.addConstraint(ConstraintType.HORIZONTAL, [rect.top.id]);
      this.activeSketch.addConstraint(ConstraintType.VERTICAL, [rect.left.id]);
      this.activeSketch.addConstraint(ConstraintType.VERTICAL, [rect.right.id]);

      this.tempPoints = [];
      this.previewEntity = null;

      if (this.onSketchUpdate) {
        this.onSketchUpdate(this.activeSketch);
      }

      return rect;
    }
  }

  /**
   * Handle circle mode click
   */
  handleCircleClick(point) {
    if (this.tempPoints.length === 0) {
      // First click - center
      this.tempPoints.push(point.clone());
    } else {
      // Second click - radius point
      const radius = this.tempPoints[0].distanceTo(point);
      const circle = this.activeSketch.addCircle(
        this.tempPoints[0].x,
        this.tempPoints[0].y,
        radius
      );

      this.tempPoints = [];
      this.previewEntity = null;

      if (this.onSketchUpdate) {
        this.onSketchUpdate(this.activeSketch);
      }

      return circle;
    }
  }

  /**
   * Handle arc mode click (three-point arc)
   */
  handleArcClick(point) {
    this.tempPoints.push(point.clone());

    if (this.tempPoints.length === 3) {
      // Create arc from three points
      const arc = this.activeSketch.addArc(
        this.tempPoints[0].x,
        this.tempPoints[0].y,
        this.tempPoints[1].x,
        this.tempPoints[1].y,
        this.tempPoints[2].x,
        this.tempPoints[2].y
      );

      this.tempPoints = [];
      this.previewEntity = null;

      if (this.onSketchUpdate) {
        this.onSketchUpdate(this.activeSketch);
      }

      return arc;
    }

    return null;
  }

  /**
   * Handle spline mode click
   * Each click adds a control point, double-click or Enter finishes
   */
  handleSplineClick(point) {
    // Add point to temp collection
    this.tempPoints.push(point.clone());

    // Update preview
    if (this.tempPoints.length >= 2) {
      this.previewEntity = new SketchSpline(this.tempPoints);
      this.previewEntity._isPreview = true;
    }

    if (this.onSketchUpdate) {
      this.onSketchUpdate(this.activeSketch, this.previewEntity);
    }

    return null; // Spline isn't complete yet
  }

  /**
   * Finish the current spline (called by double-click or Enter)
   */
  finishSpline(close = false) {
    if (this.tempPoints.length < 2) {
      // Need at least 2 points for a spline
      this.tempPoints = [];
      this.previewEntity = null;
      return null;
    }

    // Create the spline with all collected points
    const controlPoints = this.tempPoints.map(p => ({ x: p.x, y: p.y }));
    const spline = this.activeSketch.addSpline(controlPoints, close);

    this.tempPoints = [];
    this.previewEntity = null;

    if (this.onSketchUpdate) {
      this.onSketchUpdate(this.activeSketch);
    }

    return spline;
  }

  /**
   * Handle point mode click
   */
  handlePointClick(point) {
    const sketchPoint = this.activeSketch.addPoint(point.x, point.y);

    if (this.onSketchUpdate) {
      this.onSketchUpdate(this.activeSketch);
    }

    return sketchPoint;
  }

  /**
   * Handle select mode click
   */
  handleSelectClick(point) {
    // Find entity near click
    const tolerance = this.snapTolerance;

    // Check points first
    for (const p of this.activeSketch.points.values()) {
      if (p.distanceTo(point) <= tolerance) {
        this.toggleSelection(p);
        return p;
      }
    }

    // Check lines
    for (const line of this.activeSketch.lines.values()) {
      if (this.pointToLineDistance(point, line) <= tolerance) {
        this.toggleSelection(line);
        return line;
      }
    }

    // Check circles
    for (const circle of this.activeSketch.circles.values()) {
      const dist = Math.abs(circle.center.distanceTo(point) - circle.radius);
      if (dist <= tolerance) {
        this.toggleSelection(circle);
        return circle;
      }
    }

    // Clicked empty space - clear selection
    this.selectedEntities.clear();
    return null;
  }

  /**
   * Toggle entity selection
   */
  toggleSelection(entity) {
    if (this.selectedEntities.has(entity.id)) {
      this.selectedEntities.delete(entity.id);
    } else {
      this.selectedEntities.add(entity.id);
    }
  }

  /**
   * Apply snap to a point using the comprehensive snap manager
   */
  applySnap(point) {
    // Use the comprehensive snap manager
    const result = this.snapManager.findSnapPoint(point, this.activeSketch, this.snapTolerance);

    if (result) {
      this.snapResult = result;
      this.snapPoint = result.point;

      // Notify listeners for visual feedback
      if (this.onSnapUpdate) {
        this.onSnapUpdate(result);
      }

      return result.point.clone();
    }

    // No snap - clear snap state
    this.snapResult = null;
    this.snapPoint = null;

    if (this.onSnapUpdate) {
      this.onSnapUpdate(null);
    }

    return point.clone();
  }

  /**
   * Legacy apply snap (fallback method)
   */
  applySnapLegacy(point) {
    let snapped = point.clone();

    // Grid snap
    if (this.gridSnap) {
      snapped.x = Math.round(snapped.x / this.gridSize) * this.gridSize;
      snapped.y = Math.round(snapped.y / this.gridSize) * this.gridSize;
    }

    // Endpoint snap
    if (this.endpointSnap && this.activeSketch) {
      const nearPoint = this.activeSketch.findPointNear(point.x, point.y, this.snapTolerance);
      if (nearPoint) {
        snapped = nearPoint.clone();
        this.snapPoint = nearPoint;
      } else {
        this.snapPoint = null;
      }
    }

    return snapped;
  }

  /**
   * Calculate distance from point to line segment
   */
  pointToLineDistance(point, line) {
    const A = point.x - line.start.x;
    const B = point.y - line.start.y;
    const C = line.end.x - line.start.x;
    const D = line.end.y - line.start.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = line.start.x;
      yy = line.start.y;
    } else if (param > 1) {
      xx = line.end.x;
      yy = line.end.y;
    } else {
      xx = line.start.x + param * C;
      yy = line.start.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Cancel current drawing operation
   */
  cancel() {
    this.tempPoints = [];
    this.previewEntity = null;

    if (this.onSketchUpdate) {
      this.onSketchUpdate(this.activeSketch);
    }
  }

  /**
   * Finish current drawing (double-click or Enter)
   */
  finish() {
    if (this.mode === SketchMode.SPLINE && this.tempPoints.length >= 2) {
      // Finish the spline
      this.finishSpline();
      return;
    }

    if (this.mode === SketchMode.LINE && this.tempPoints.length > 0) {
      // Could close the shape if near start point
      this.tempPoints = [];
      this.previewEntity = null;
    }

    this.setMode(SketchMode.SELECT);
  }

  /**
   * Delete selected entities
   */
  deleteSelected() {
    if (!this.activeSketch) return;

    for (const id of this.selectedEntities) {
      this.activeSketch.points.delete(id);
      this.activeSketch.lines.delete(id);
      this.activeSketch.circles.delete(id);
      this.activeSketch.arcs.delete(id);
      this.activeSketch.splines.delete(id);
      this.activeSketch.rectangles.delete(id);
    }

    this.selectedEntities.clear();

    if (this.onSketchUpdate) {
      this.onSketchUpdate(this.activeSketch);
    }
  }
}

// ID generator
let sketchIdCounter = 0;
function generateSketchId(prefix = 'sk') {
  return `${prefix}_${++sketchIdCounter}`;
}

// Export singleton
export const sketchManager = new SketchManager();

export default {
  SketchMode,
  ConstraintType,
  SketchPoint,
  SketchLine,
  SketchCircle,
  SketchArc,
  SketchSpline,
  SketchRectangle,
  SketchConstraint,
  Sketch,
  SketchManager,
  sketchManager,
};
