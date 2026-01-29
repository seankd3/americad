/**
 * Advanced Sketch Constraint Tests
 *
 * Tests for advanced geometric constraints:
 * - Coincident: points share location
 * - Tangent: curves tangent at connection
 * - Perpendicular: lines at 90°
 * - Parallel: lines are parallel
 * - Equal: equal length/radius
 * - Concentric: circles share center
 * - Midpoint: point at line midpoint
 * - Symmetric: entities symmetric about axis
 * - Colinear: lines on same infinite line
 * - Fix: lock entity in place
 */

// Inline minimal implementations for testing (matching project patterns)
const ConstraintType = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
  COINCIDENT: 'coincident',
  PERPENDICULAR: 'perpendicular',
  PARALLEL: 'parallel',
  TANGENT: 'tangent',
  EQUAL: 'equal',
  FIXED: 'fixed',
  FIX: 'fix',
  DISTANCE: 'distance',
  LENGTH: 'length',
  ANGLE: 'angle',
  RADIUS: 'radius',
  CONCENTRIC: 'concentric',
  MIDPOINT: 'midpoint',
  SYMMETRIC: 'symmetric',
  COLINEAR: 'colinear',
};

const EPS = 1e-6;

let idCounter = 0;
const genId = prefix => `${prefix}_${++idCounter}`;

class SketchPoint {
  constructor(x = 0, y = 0) {
    this.id = genId('pt');
    this.x = x;
    this.y = y;
    this.fixed = false;
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
    return p;
  }
}

class SketchLine {
  constructor(start, end) {
    this.id = genId('ln');
    this.start = start;
    this.end = end;
    this.constraints = [];
  }
  get length() {
    return this.start.distanceTo(this.end);
  }
  get angle() {
    return Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x);
  }
}

class SketchCircle {
  constructor(center, radius) {
    this.id = genId('cr');
    this.center = center;
    this.radius = radius;
    this.constraints = [];
  }
}

class SketchConstraint {
  constructor(type, entities, value = null) {
    this.id = genId('cn');
    this.type = type;
    this.entities = entities;
    this.value = value;
    this.satisfied = false;
  }
}

class Sketch {
  constructor(name) {
    this.id = genId('sk');
    this.name = name;
    this.points = new Map();
    this.lines = new Map();
    this.circles = new Map();
    this.arcs = new Map();
    this.splines = new Map();
    this.rectangles = new Map();
    this.constraints = new Map();
    this.fullyConstrained = false;
  }

  addPoint(x, y) {
    const point = new SketchPoint(x, y);
    this.points.set(point.id, point);
    return point;
  }

  addLine(startX, startY, endX, endY) {
    const start = this.addPoint(startX, startY);
    const end = this.addPoint(endX, endY);
    const line = new SketchLine(start, end);
    this.lines.set(line.id, line);
    return line;
  }

  addCircle(centerX, centerY, radius) {
    const center = this.addPoint(centerX, centerY);
    const circle = new SketchCircle(center, radius);
    this.circles.set(circle.id, circle);
    return circle;
  }

  addConstraint(type, entityIds, value = null) {
    const constraint = new SketchConstraint(type, entityIds, value);
    this.constraints.set(constraint.id, constraint);
    return constraint;
  }

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
}

// === Solver Implementation ===

const DEFAULT_OPTIONS = { maxIterations: 100, tolerance: 1e-3, relax: 0.5 };

const isPoint = entity => entity instanceof SketchPoint;
const isLine = entity => entity instanceof SketchLine;
const isCircle = entity => entity instanceof SketchCircle;

const isFixedPoint = (point, fixedMap) => {
  if (!point) return false;
  return point.fixed || fixedMap.has(point.id);
};

const movePoint = (point, dx, dy, fixedMap) => {
  if (!point || isFixedPoint(point, fixedMap)) return false;
  point.x += dx;
  point.y += dy;
  return true;
};

const normalizeAngle = angle => {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

const getMidpoint = line => ({
  x: (line.start.x + line.end.x) * 0.5,
  y: (line.start.y + line.end.y) * 0.5,
});

const rotatePoint = (point, pivot, angle) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  point.x = pivot.x + dx * cos - dy * sin;
  point.y = pivot.y + dx * sin + dy * cos;
};

const rotateLine = (line, angle, fixedMap) => {
  if (!line || Math.abs(angle) < EPS) return false;
  const startFixed = isFixedPoint(line.start, fixedMap);
  const endFixed = isFixedPoint(line.end, fixedMap);

  if (startFixed && endFixed) return false;

  if (startFixed || endFixed) {
    const pivot = startFixed ? line.start : line.end;
    const target = startFixed ? line.end : line.start;
    rotatePoint(target, pivot, angle);
    return true;
  }

  const mid = getMidpoint(line);
  rotatePoint(line.start, mid, angle);
  rotatePoint(line.end, mid, angle);
  return true;
};

// Constraint solvers
const applyCoincident = (p1, p2, fixedMap, relax) => {
  if (!p1 || !p2) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const startFixed = isFixedPoint(p1, fixedMap);
  const endFixed = isFixedPoint(p2, fixedMap);
  if (startFixed && endFixed) return Math.sqrt(dx * dx + dy * dy);
  if (startFixed) {
    movePoint(p2, -dx * relax, -dy * relax, fixedMap);
    return Math.sqrt(dx * dx + dy * dy);
  }
  if (endFixed) {
    movePoint(p1, dx * relax, dy * relax, fixedMap);
    return Math.sqrt(dx * dx + dy * dy);
  }
  const correctionX = dx * 0.5 * relax;
  const correctionY = dy * 0.5 * relax;
  movePoint(p1, correctionX, correctionY, fixedMap);
  movePoint(p2, -correctionX, -correctionY, fixedMap);
  return Math.sqrt(dx * dx + dy * dy);
};

const applyParallel = (line1, line2, fixedMap, relax) => {
  if (!line1 || !line2) return 0;
  const diff = normalizeAngle(line2.angle - line1.angle);
  const adjustedDiff =
    diff > Math.PI / 2 ? diff - Math.PI : diff < -Math.PI / 2 ? diff + Math.PI : diff;
  const error = adjustedDiff;
  const delta = error * relax;
  const moved1 = rotateLine(line1, delta * 0.5, fixedMap);
  const moved2 = rotateLine(line2, -delta * 0.5, fixedMap);
  if (!moved1 && moved2) rotateLine(line2, -delta, fixedMap);
  if (!moved2 && moved1) rotateLine(line1, delta, fixedMap);
  return Math.abs(error);
};

const applyPerpendicular = (line1, line2, fixedMap, relax) => {
  if (!line1 || !line2) return 0;
  const diff = normalizeAngle(line2.angle - line1.angle);
  const target = diff >= 0 ? Math.PI / 2 : -Math.PI / 2;
  const error = diff - target;
  const delta = error * relax;
  const moved1 = rotateLine(line1, delta * 0.5, fixedMap);
  const moved2 = rotateLine(line2, -delta * 0.5, fixedMap);
  if (!moved1 && moved2) rotateLine(line2, -delta, fixedMap);
  if (!moved2 && moved1) rotateLine(line1, delta, fixedMap);
  return Math.abs(error);
};

const adjustLineLength = (line, target, fixedMap, relax) => {
  if (!line) return 0;
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < EPS) return Math.abs(target);
  const ux = dx / length;
  const uy = dy / length;
  const error = length - target;
  const correction = error * 0.5 * relax;

  const startFixed = isFixedPoint(line.start, fixedMap);
  const endFixed = isFixedPoint(line.end, fixedMap);

  if (startFixed && endFixed) return Math.abs(error);

  if (startFixed) {
    movePoint(line.end, -ux * error * relax, -uy * error * relax, fixedMap);
    return Math.abs(error);
  }

  if (endFixed) {
    movePoint(line.start, ux * error * relax, uy * error * relax, fixedMap);
    return Math.abs(error);
  }

  movePoint(line.start, ux * correction, uy * correction, fixedMap);
  movePoint(line.end, -ux * correction, -uy * correction, fixedMap);
  return Math.abs(error);
};

const applyEqual = (entity1, entity2, fixedMap, relax) => {
  if (!entity1 || !entity2) return 0;
  const isLine1 = isLine(entity1);
  const isLine2 = isLine(entity2);
  const isCircle1 = isCircle(entity1);
  const isCircle2 = isCircle(entity2);

  if (isLine1 && isLine2) {
    const len1 = entity1.length;
    const len2 = entity2.length;
    const target = (len1 + len2) * 0.5;
    const err1 = adjustLineLength(entity1, target, fixedMap, relax);
    const err2 = adjustLineLength(entity2, target, fixedMap, relax);
    return Math.max(err1, err2);
  }

  if (isCircle1 && isCircle2) {
    const target = (entity1.radius + entity2.radius) * 0.5;
    entity1.radius += (target - entity1.radius) * relax;
    entity2.radius += (target - entity2.radius) * relax;
    return Math.abs(entity1.radius - entity2.radius);
  }

  return 0;
};

const applyTangent = (entity1, entity2, fixedMap, relax) => {
  if (!entity1 || !entity2) return 0;

  let line, circle;
  if (isLine(entity1) && isCircle(entity2)) {
    line = entity1;
    circle = entity2;
  } else if (isCircle(entity1) && isLine(entity2)) {
    line = entity2;
    circle = entity1;
  } else if (isCircle(entity1) && isCircle(entity2)) {
    // Circle-circle tangent
    const c1 = entity1;
    const c2 = entity2;
    const dx = c2.center.x - c1.center.x;
    const dy = c2.center.y - c1.center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < EPS) return c1.radius + c2.radius;

    const targetDist = c1.radius + c2.radius;
    const error = dist - targetDist;
    const ux = dx / dist;
    const uy = dy / dist;

    const c1Fixed = isFixedPoint(c1.center, fixedMap);
    const c2Fixed = isFixedPoint(c2.center, fixedMap);

    if (c1Fixed && c2Fixed) return Math.abs(error);

    if (c1Fixed) {
      movePoint(c2.center, -ux * error * relax, -uy * error * relax, fixedMap);
    } else if (c2Fixed) {
      movePoint(c1.center, ux * error * relax, uy * error * relax, fixedMap);
    } else {
      const correction = error * 0.5 * relax;
      movePoint(c1.center, ux * correction, uy * correction, fixedMap);
      movePoint(c2.center, -ux * correction, -uy * correction, fixedMap);
    }
    return Math.abs(error);
  } else {
    return 0;
  }

  // Line-circle tangent
  const A = line.end.y - line.start.y;
  const B = line.start.x - line.end.x;
  const C = line.end.x * line.start.y - line.start.x * line.end.y;
  const lineLen = Math.sqrt(A * A + B * B);
  if (lineLen < EPS) return circle.radius;

  const dist = (A * circle.center.x + B * circle.center.y + C) / lineLen;
  const error = Math.abs(dist) - circle.radius;

  if (Math.abs(error) < EPS) return 0;

  const perpX = A / lineLen;
  const perpY = B / lineLen;
  const sign = dist >= 0 ? 1 : -1;

  const startFixed = isFixedPoint(line.start, fixedMap);
  const endFixed = isFixedPoint(line.end, fixedMap);
  const centerFixed = isFixedPoint(circle.center, fixedMap);

  if (startFixed && endFixed && centerFixed) return Math.abs(error);

  if (!startFixed && !endFixed) {
    movePoint(line.start, sign * perpX * error * relax, sign * perpY * error * relax, fixedMap);
    movePoint(line.end, sign * perpX * error * relax, sign * perpY * error * relax, fixedMap);
  } else if (!centerFixed) {
    movePoint(
      circle.center,
      -sign * perpX * error * relax,
      -sign * perpY * error * relax,
      fixedMap
    );
  }

  return Math.abs(error);
};

const applyConcentric = (entity1, entity2, fixedMap, relax) => {
  if (!entity1 || !entity2) return 0;
  if (!isCircle(entity1) || !isCircle(entity2)) return 0;
  return applyCoincident(entity1.center, entity2.center, fixedMap, relax);
};

const applyMidpoint = (point, line, fixedMap, relax) => {
  if (!point || !line) return 0;
  if (!isPoint(point) || !isLine(line)) return 0;

  const midX = (line.start.x + line.end.x) / 2;
  const midY = (line.start.y + line.end.y) / 2;

  const dx = midX - point.x;
  const dy = midY - point.y;
  const error = Math.sqrt(dx * dx + dy * dy);

  if (error < EPS) return 0;

  const pointFixed = isFixedPoint(point, fixedMap);

  if (!pointFixed) {
    movePoint(point, dx * relax, dy * relax, fixedMap);
  }

  return error;
};

const applySymmetric = (entity1, entity2, axisLine, fixedMap, relax) => {
  if (!entity1 || !entity2 || !axisLine) return 0;
  if (!isLine(axisLine)) return 0;

  const ax = axisLine.end.x - axisLine.start.x;
  const ay = axisLine.end.y - axisLine.start.y;
  const axisLen = Math.sqrt(ax * ax + ay * ay);
  if (axisLen < EPS) return 0;

  const ux = ax / axisLen;
  const uy = ay / axisLen;

  const reflectPoint = p => {
    const vx = p.x - axisLine.start.x;
    const vy = p.y - axisLine.start.y;
    const dot = vx * ux + vy * uy;
    const projX = axisLine.start.x + dot * ux;
    const projY = axisLine.start.y + dot * uy;
    return { x: 2 * projX - p.x, y: 2 * projY - p.y };
  };

  if (isPoint(entity1) && isPoint(entity2)) {
    const reflected1 = reflectPoint(entity1);
    const dx = reflected1.x - entity2.x;
    const dy = reflected1.y - entity2.y;
    const error = Math.sqrt(dx * dx + dy * dy);

    if (error < EPS) return 0;

    const fixed1 = isFixedPoint(entity1, fixedMap);
    const fixed2 = isFixedPoint(entity2, fixedMap);

    if (fixed1 && fixed2) return error;

    if (fixed1) {
      movePoint(entity2, dx * relax, dy * relax, fixedMap);
    } else if (fixed2) {
      const reflected2 = reflectPoint(entity2);
      const dx2 = reflected2.x - entity1.x;
      const dy2 = reflected2.y - entity1.y;
      movePoint(entity1, dx2 * relax, dy2 * relax, fixedMap);
    } else {
      movePoint(entity1, -dx * 0.5 * relax, -dy * 0.5 * relax, fixedMap);
      movePoint(entity2, dx * 0.5 * relax, dy * 0.5 * relax, fixedMap);
    }
    return error;
  }

  return 0;
};

const applyColinear = (line1, line2, fixedMap, relax) => {
  if (!line1 || !line2) return 0;
  if (!isLine(line1) || !isLine(line2)) return 0;

  const parallelError = applyParallel(line1, line2, fixedMap, relax);

  const A = line1.end.y - line1.start.y;
  const B = line1.start.x - line1.end.x;
  const C = line1.end.x * line1.start.y - line1.start.x * line1.end.y;
  const lineLen = Math.sqrt(A * A + B * B);

  if (lineLen < EPS) return parallelError;

  const mid2X = (line2.start.x + line2.end.x) / 2;
  const mid2Y = (line2.start.y + line2.end.y) / 2;
  const dist = (A * mid2X + B * mid2Y + C) / lineLen;

  if (Math.abs(dist) < EPS) return parallelError;

  const perpX = A / lineLen;
  const perpY = B / lineLen;

  const start2Fixed = isFixedPoint(line2.start, fixedMap);
  const end2Fixed = isFixedPoint(line2.end, fixedMap);

  if (!start2Fixed) {
    movePoint(line2.start, -perpX * dist * relax, -perpY * dist * relax, fixedMap);
  }
  if (!end2Fixed) {
    movePoint(line2.end, -perpX * dist * relax, -perpY * dist * relax, fixedMap);
  }

  return Math.max(parallelError, Math.abs(dist));
};

const applyConstraint = (sketch, constraint, fixedMap, options) => {
  const entities = constraint.entities.map(id => sketch.getEntity(id));
  switch (constraint.type) {
    case ConstraintType.COINCIDENT:
      return applyCoincident(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.PERPENDICULAR:
      return applyPerpendicular(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.PARALLEL:
      return applyParallel(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.EQUAL:
      return applyEqual(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.TANGENT:
      return applyTangent(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.CONCENTRIC:
      return applyConcentric(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.MIDPOINT:
      return applyMidpoint(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.SYMMETRIC:
      return applySymmetric(entities[0], entities[1], entities[2], fixedMap, options.relax);
    case ConstraintType.COLINEAR:
      return applyColinear(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.FIXED:
    case ConstraintType.FIX:
      if (isPoint(entities[0])) {
        const pos = fixedMap.get(entities[0].id);
        if (pos) {
          entities[0].x = pos.x;
          entities[0].y = pos.y;
        }
      }
      return 0;
    default:
      return 0;
  }
};

const solveSketch = (sketch, options = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const constraints = Array.from(sketch.constraints.values());

  const fixedMap = new Map();
  sketch.points.forEach(point => {
    if (point.fixed) {
      fixedMap.set(point.id, { x: point.x, y: point.y });
    }
  });
  sketch.constraints.forEach(constraint => {
    if (constraint.type !== ConstraintType.FIXED && constraint.type !== ConstraintType.FIX) return;
    constraint.entities.forEach(id => {
      const entity = sketch.getEntity(id);
      if (isPoint(entity)) {
        entity.fixed = true;
        fixedMap.set(entity.id, { x: entity.x, y: entity.y });
      }
    });
  });

  let converged = false;
  let iterations = 0;
  let maxError = 0;

  for (let i = 0; i < config.maxIterations; i += 1) {
    maxError = 0;
    constraints.forEach(constraint => {
      const error = applyConstraint(sketch, constraint, fixedMap, config);
      constraint.satisfied = Math.abs(error) <= config.tolerance;
      if (Math.abs(error) > maxError) {
        maxError = Math.abs(error);
      }
    });

    // Enforce fixed positions
    fixedMap.forEach((pos, id) => {
      const point = sketch.points.get(id);
      if (point) {
        point.x = pos.x;
        point.y = pos.y;
      }
    });

    iterations = i + 1;

    if (maxError <= config.tolerance) {
      converged = true;
      break;
    }
  }

  return { converged, iterations, maxError };
};

// === Test Runner ===

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    return true;
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(`  ${e.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertApprox(actual, expected, tolerance = 0.5, message) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(message || `Expected ${expected}, got ${actual} (diff: ${diff})`);
  }
}

// === Tests ===

let passed = 0;
let total = 0;

console.log('\n=== Coincident Constraint Tests ===\n');

total++;
if (
  test('Coincident constraint joins two points', () => {
    const sketch = new Sketch('test');
    const p1 = sketch.addPoint(0, 0);
    const p2 = sketch.addPoint(10, 10);
    sketch.addConstraint(ConstraintType.COINCIDENT, [p1.id, p2.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');
    assertApprox(p1.distanceTo(p2), 0, 0.1, 'Points should be coincident');
  })
)
  passed++;

total++;
if (
  test('Coincident respects fixed point', () => {
    const sketch = new Sketch('test');
    const p1 = sketch.addPoint(0, 0);
    const p2 = sketch.addPoint(10, 10);
    p1.fixed = true;
    sketch.addConstraint(ConstraintType.COINCIDENT, [p1.id, p2.id]);

    solveSketch(sketch);
    assertApprox(p1.x, 0, 0.01, 'Fixed point X should not move');
    assertApprox(p1.y, 0, 0.01, 'Fixed point Y should not move');
    assertApprox(p2.x, 0, 0.1, 'Moving point should go to fixed point');
    assertApprox(p2.y, 0, 0.1, 'Moving point should go to fixed point');
  })
)
  passed++;

console.log('\n=== Tangent Constraint Tests ===\n');

total++;
if (
  test('Tangent line to circle', () => {
    const sketch = new Sketch('test');
    const circle = sketch.addCircle(0, 0, 10);
    const line = sketch.addLine(15, -20, 15, 20); // Vertical line to the right

    sketch.addConstraint(ConstraintType.TANGENT, [line.id, circle.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');

    // Calculate distance from circle center to line
    const A = line.end.y - line.start.y;
    const B = line.start.x - line.end.x;
    const C = line.end.x * line.start.y - line.start.x * line.end.y;
    const lineLen = Math.sqrt(A * A + B * B);
    const dist = Math.abs(A * circle.center.x + B * circle.center.y + C) / lineLen;

    assertApprox(dist, circle.radius, 0.5, 'Line should be tangent to circle');
  })
)
  passed++;

total++;
if (
  test('Two circles tangent (external)', () => {
    const sketch = new Sketch('test');
    const c1 = sketch.addCircle(0, 0, 10);
    const c2 = sketch.addCircle(25, 0, 5);
    c1.center.fixed = true;

    sketch.addConstraint(ConstraintType.TANGENT, [c1.id, c2.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');

    const dist = c1.center.distanceTo(c2.center);
    const expectedDist = c1.radius + c2.radius;
    assertApprox(dist, expectedDist, 0.5, 'Circles should be externally tangent');
  })
)
  passed++;

console.log('\n=== Perpendicular Constraint Tests ===\n');

total++;
if (
  test('Perpendicular lines at 90 degrees', () => {
    const sketch = new Sketch('test');
    const line1 = sketch.addLine(0, 0, 10, 0); // Horizontal
    const line2 = sketch.addLine(5, -5, 8, 5); // Angled

    sketch.addConstraint(ConstraintType.PERPENDICULAR, [line1.id, line2.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');

    const angleDiff = Math.abs(normalizeAngle(line2.angle - line1.angle));
    assertApprox(angleDiff, Math.PI / 2, 0.1, 'Lines should be perpendicular (90°)');
  })
)
  passed++;

console.log('\n=== Parallel Constraint Tests ===\n');

total++;
if (
  test('Parallel lines same angle', () => {
    const sketch = new Sketch('test');
    const line1 = sketch.addLine(0, 0, 10, 5); // Angled line
    const line2 = sketch.addLine(0, 10, 8, 12); // Different angle

    sketch.addConstraint(ConstraintType.PARALLEL, [line1.id, line2.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');

    const angleDiff = Math.abs(normalizeAngle(line2.angle - line1.angle));
    assert(angleDiff < 0.1 || Math.abs(angleDiff - Math.PI) < 0.1, 'Lines should be parallel');
  })
)
  passed++;

console.log('\n=== Equal Constraint Tests ===\n');

total++;
if (
  test('Equal length lines', () => {
    const sketch = new Sketch('test');
    const line1 = sketch.addLine(0, 0, 20, 0); // Length 20
    const line2 = sketch.addLine(0, 10, 10, 10); // Length 10

    sketch.addConstraint(ConstraintType.EQUAL, [line1.id, line2.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');
    assertApprox(line1.length, line2.length, 0.5, 'Lines should have equal length');
  })
)
  passed++;

total++;
if (
  test('Equal radius circles', () => {
    const sketch = new Sketch('test');
    const c1 = sketch.addCircle(0, 0, 20);
    const c2 = sketch.addCircle(50, 0, 10);

    sketch.addConstraint(ConstraintType.EQUAL, [c1.id, c2.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');
    assertApprox(c1.radius, c2.radius, 0.5, 'Circles should have equal radius');
  })
)
  passed++;

console.log('\n=== Concentric Constraint Tests ===\n');

total++;
if (
  test('Concentric circles share center', () => {
    const sketch = new Sketch('test');
    const c1 = sketch.addCircle(0, 0, 10);
    const c2 = sketch.addCircle(5, 5, 20);

    sketch.addConstraint(ConstraintType.CONCENTRIC, [c1.id, c2.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');

    const centerDist = c1.center.distanceTo(c2.center);
    assertApprox(centerDist, 0, 0.1, 'Circle centers should be coincident');
  })
)
  passed++;

console.log('\n=== Midpoint Constraint Tests ===\n');

total++;
if (
  test('Midpoint constraint places point at line center', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 20, 0);
    const point = sketch.addPoint(5, 5); // Not at midpoint

    sketch.addConstraint(ConstraintType.MIDPOINT, [point.id, line.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');

    const midX = (line.start.x + line.end.x) / 2;
    const midY = (line.start.y + line.end.y) / 2;

    assertApprox(point.x, midX, 0.5, 'Point X should be at line midpoint');
    assertApprox(point.y, midY, 0.5, 'Point Y should be at line midpoint');
  })
)
  passed++;

console.log('\n=== Symmetric Constraint Tests ===\n');

total++;
if (
  test('Symmetric points about vertical axis', () => {
    const sketch = new Sketch('test');
    // Vertical axis at x=10
    const axis = sketch.addLine(10, -10, 10, 10);
    const p1 = sketch.addPoint(5, 5);
    const p2 = sketch.addPoint(20, 5); // Should move to x=15

    p1.fixed = true;
    sketch.addConstraint(ConstraintType.SYMMETRIC, [p1.id, p2.id, axis.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');

    // p1 is at x=5, axis is at x=10, so p2 should be at x=15
    assertApprox(p2.x, 15, 0.5, 'Symmetric point X should be reflected');
    assertApprox(p2.y, 5, 0.5, 'Symmetric point Y should match');
  })
)
  passed++;

console.log('\n=== Colinear Constraint Tests ===\n');

total++;
if (
  test('Colinear lines on same infinite line', () => {
    const sketch = new Sketch('test');
    const line1 = sketch.addLine(0, 0, 10, 0); // Horizontal at y=0
    const line2 = sketch.addLine(15, 5, 25, 3); // Slightly off

    line1.start.fixed = true;
    line1.end.fixed = true;

    sketch.addConstraint(ConstraintType.COLINEAR, [line1.id, line2.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');

    // Both lines should be on y=0 (same as line1)
    assertApprox(line2.start.y, 0, 0.5, 'Line2 start should be on line1');
    assertApprox(line2.end.y, 0, 0.5, 'Line2 end should be on line1');
  })
)
  passed++;

console.log('\n=== Fix Constraint Tests ===\n');

total++;
if (
  test('Fix constraint locks point position', () => {
    const sketch = new Sketch('test');
    const p1 = sketch.addPoint(5, 10);
    const p2 = sketch.addPoint(20, 20);

    sketch.addConstraint(ConstraintType.FIX, [p1.id]);
    sketch.addConstraint(ConstraintType.COINCIDENT, [p1.id, p2.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');

    assertApprox(p1.x, 5, 0.01, 'Fixed point X should not move');
    assertApprox(p1.y, 10, 0.01, 'Fixed point Y should not move');
    assertApprox(p2.x, 5, 0.1, 'Other point should move to fixed point');
    assertApprox(p2.y, 10, 0.1, 'Other point should move to fixed point');
  })
)
  passed++;

console.log('\n=== Complex Scenario Tests ===\n');

total++;
if (
  test('Multiple constraints work together', () => {
    const sketch = new Sketch('test');
    const line1 = sketch.addLine(0, 0, 10, 3);
    const line2 = sketch.addLine(10, 3, 20, 0);

    line1.start.fixed = true;

    // Make lines perpendicular and equal length
    sketch.addConstraint(ConstraintType.COINCIDENT, [line1.end.id, line2.start.id]);
    sketch.addConstraint(ConstraintType.PERPENDICULAR, [line1.id, line2.id]);
    sketch.addConstraint(ConstraintType.EQUAL, [line1.id, line2.id]);

    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');

    // Verify coincident
    const dist = line1.end.distanceTo(line2.start);
    assertApprox(dist, 0, 0.2, 'Connection point should be coincident');

    // Verify perpendicular
    const angleDiff = Math.abs(normalizeAngle(line2.angle - line1.angle));
    assertApprox(angleDiff, Math.PI / 2, 0.2, 'Lines should be perpendicular');

    // Verify equal length
    assertApprox(line1.length, line2.length, 0.5, 'Lines should have equal length');
  })
)
  passed++;

// Summary
console.log(`\n=== Results: ${passed}/${total} tests passed ===\n`);

if (passed < total) {
  process.exit(1);
}
