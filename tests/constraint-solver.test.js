/**
 * Constraint Solver Tests - DOF Tracking and Constraint Status
 *
 * Tests for the full constraint solver with degrees of freedom tracking,
 * entity state detection, and conflict detection.
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
  DISTANCE: 'distance',
  LENGTH: 'length',
  ANGLE: 'angle',
  RADIUS: 'radius',
};

const ConstraintStatus = {
  UNDER: 'under-constrained',
  OVER: 'over-constrained',
  FULLY: 'fully-constrained',
};

const EntityState = {
  UNDER_CONSTRAINED: 'under-constrained',
  FULLY_CONSTRAINED: 'fully-constrained',
  OVER_CONSTRAINED: 'over-constrained',
};

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

// === Solver Implementation (extracted core logic for testing) ===

const EPS = 1e-6;
const DEFAULT_OPTIONS = { maxIterations: 60, tolerance: 1e-3, relax: 0.5 };

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

const _getEntityDOF = entity => {
  if (isPoint(entity)) return 2;
  if (isLine(entity)) return 0;
  if (isCircle(entity)) return 1;
  return 0;
};

const getConstraintDOF = constraint => {
  switch (constraint.type) {
    case ConstraintType.FIXED:
      return 2;
    case ConstraintType.HORIZONTAL:
    case ConstraintType.VERTICAL:
      return 1;
    case ConstraintType.COINCIDENT:
      return 2;
    case ConstraintType.LENGTH:
    case ConstraintType.DISTANCE:
    case ConstraintType.RADIUS:
      return 1;
    case ConstraintType.PARALLEL:
    case ConstraintType.PERPENDICULAR:
    case ConstraintType.ANGLE:
    case ConstraintType.EQUAL:
      return 1;
    default:
      return 0;
  }
};

const calculateDOF = (sketch, fixedMap = new Map()) => {
  let totalDOF = 0;
  const entityDOF = new Map();

  sketch.points.forEach(point => {
    if (!isFixedPoint(point, fixedMap)) {
      const dof = 2;
      entityDOF.set(point.id, dof);
      totalDOF += dof;
    } else {
      entityDOF.set(point.id, 0);
    }
  });

  sketch.circles.forEach(circle => {
    const dof = 1;
    entityDOF.set(circle.id, dof);
    totalDOF += dof;
  });

  let constraintDOF = 0;
  const constraintContributions = new Map();

  sketch.constraints.forEach(constraint => {
    const dof = getConstraintDOF(constraint);
    constraintContributions.set(constraint.id, dof);
    constraintDOF += dof;
  });

  const remainingDOF = Math.max(0, totalDOF - constraintDOF);

  return {
    totalDOF,
    constraintDOF,
    remainingDOF,
    entityDOF,
    constraintContributions,
  };
};

const analyzeEntityStates = (sketch, fixedMap = new Map()) => {
  const states = new Map();
  const constraintCountByEntity = new Map();

  sketch.constraints.forEach(constraint => {
    constraint.entities.forEach(entityId => {
      const count = constraintCountByEntity.get(entityId) || 0;
      constraintCountByEntity.set(entityId, count + 1);
    });
  });

  sketch.points.forEach(point => {
    if (isFixedPoint(point, fixedMap)) {
      states.set(point.id, EntityState.FULLY_CONSTRAINED);
      return;
    }
    const constraintCount = constraintCountByEntity.get(point.id) || 0;
    if (constraintCount >= 2) {
      states.set(point.id, EntityState.FULLY_CONSTRAINED);
    } else {
      states.set(point.id, EntityState.UNDER_CONSTRAINED);
    }
  });

  sketch.lines.forEach(line => {
    const startState = states.get(line.start.id) || EntityState.UNDER_CONSTRAINED;
    const endState = states.get(line.end.id) || EntityState.UNDER_CONSTRAINED;
    const lineConstraints = constraintCountByEntity.get(line.id) || 0;

    const hasOrientationConstraint = Array.from(sketch.constraints.values()).some(
      c =>
        c.entities.includes(line.id) &&
        (c.type === ConstraintType.HORIZONTAL || c.type === ConstraintType.VERTICAL)
    );

    if (
      startState === EntityState.FULLY_CONSTRAINED &&
      endState === EntityState.FULLY_CONSTRAINED
    ) {
      states.set(line.id, EntityState.FULLY_CONSTRAINED);
    } else if (lineConstraints > 0 || hasOrientationConstraint) {
      if (
        startState === EntityState.FULLY_CONSTRAINED ||
        endState === EntityState.FULLY_CONSTRAINED
      ) {
        states.set(line.id, EntityState.FULLY_CONSTRAINED);
      } else {
        states.set(line.id, EntityState.UNDER_CONSTRAINED);
      }
    } else {
      states.set(line.id, EntityState.UNDER_CONSTRAINED);
    }
  });

  sketch.circles.forEach(circle => {
    const centerState = states.get(circle.center.id) || EntityState.UNDER_CONSTRAINED;
    const hasRadiusConstraint = Array.from(sketch.constraints.values()).some(
      c =>
        c.entities.includes(circle.id) &&
        (c.type === ConstraintType.RADIUS || c.type === ConstraintType.LENGTH)
    );

    if (centerState === EntityState.FULLY_CONSTRAINED && hasRadiusConstraint) {
      states.set(circle.id, EntityState.FULLY_CONSTRAINED);
    } else {
      states.set(circle.id, EntityState.UNDER_CONSTRAINED);
    }
  });

  return states;
};

const detectConflicts = (sketch, solverResult) => {
  const conflicts = [];

  sketch.constraints.forEach(constraint => {
    if (!constraint.satisfied && solverResult.iterations >= DEFAULT_OPTIONS.maxIterations - 1) {
      conflicts.push(constraint.id);
    }
  });

  const constraintsByEntity = new Map();
  sketch.constraints.forEach(constraint => {
    constraint.entities.forEach(entityId => {
      if (!constraintsByEntity.has(entityId)) {
        constraintsByEntity.set(entityId, []);
      }
      constraintsByEntity.get(entityId).push(constraint);
    });
  });

  constraintsByEntity.forEach((constraints, _entityId) => {
    const orientationConstraints = constraints.filter(
      c => c.type === ConstraintType.HORIZONTAL || c.type === ConstraintType.VERTICAL
    );
    if (orientationConstraints.length > 1) {
      orientationConstraints.forEach(c => {
        if (!conflicts.includes(c.id)) {
          conflicts.push(c.id);
        }
      });
    }

    const dimensionConstraints = constraints.filter(
      c => c.type === ConstraintType.LENGTH || c.type === ConstraintType.RADIUS
    );
    if (dimensionConstraints.length > 1) {
      const values = dimensionConstraints.map(c => c.value);
      const allSame = values.every(v => Math.abs(v - values[0]) < EPS);
      if (!allSame) {
        dimensionConstraints.forEach(c => {
          if (!conflicts.includes(c.id)) {
            conflicts.push(c.id);
          }
        });
      }
    }
  });

  return conflicts;
};

// Constraint application functions
const applyHorizontal = (line, fixedMap, relax) => {
  if (!line) return 0;
  const dy = line.end.y - line.start.y;
  const startFixed = isFixedPoint(line.start, fixedMap);
  const endFixed = isFixedPoint(line.end, fixedMap);
  if (startFixed && endFixed) return Math.abs(dy);
  if (startFixed) {
    movePoint(line.end, 0, -dy * relax, fixedMap);
    return Math.abs(dy);
  }
  if (endFixed) {
    movePoint(line.start, 0, dy * relax, fixedMap);
    return Math.abs(dy);
  }
  const correction = dy * 0.5 * relax;
  movePoint(line.start, 0, correction, fixedMap);
  movePoint(line.end, 0, -correction, fixedMap);
  return Math.abs(dy);
};

const applyVertical = (line, fixedMap, relax) => {
  if (!line) return 0;
  const dx = line.end.x - line.start.x;
  const startFixed = isFixedPoint(line.start, fixedMap);
  const endFixed = isFixedPoint(line.end, fixedMap);
  if (startFixed && endFixed) return Math.abs(dx);
  if (startFixed) {
    movePoint(line.end, -dx * relax, 0, fixedMap);
    return Math.abs(dx);
  }
  if (endFixed) {
    movePoint(line.start, dx * relax, 0, fixedMap);
    return Math.abs(dx);
  }
  const correction = dx * 0.5 * relax;
  movePoint(line.start, correction, 0, fixedMap);
  movePoint(line.end, -correction, 0, fixedMap);
  return Math.abs(dx);
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

const applyLength = (entity, target, fixedMap, relax) => {
  if (isLine(entity)) {
    return adjustLineLength(entity, target, fixedMap, relax);
  }
  if (isCircle(entity)) {
    const error = entity.radius - target;
    entity.radius = entity.radius - error * relax;
    return Math.abs(error);
  }
  return 0;
};

const solveSketch = (sketch, options = {}) => {
  if (!sketch) {
    return {
      status: ConstraintStatus.UNDER,
      converged: false,
      iterations: 0,
      maxError: 0,
      degreesOfFreedom: 0,
      equationCount: 0,
      dofAnalysis: null,
      entityStates: new Map(),
      conflicts: [],
    };
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  const constraints = Array.from(sketch.constraints.values());

  const fixedMap = new Map();
  sketch.points.forEach(point => {
    if (point.fixed) {
      fixedMap.set(point.id, { x: point.x, y: point.y });
    }
  });
  sketch.constraints.forEach(constraint => {
    if (constraint.type !== ConstraintType.FIXED) return;
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
      const entity = sketch.getEntity(constraint.entities[0]);
      let error = 0;

      switch (constraint.type) {
        case ConstraintType.HORIZONTAL:
          error = applyHorizontal(entity, fixedMap, config.relax);
          break;
        case ConstraintType.VERTICAL:
          error = applyVertical(entity, fixedMap, config.relax);
          break;
        case ConstraintType.LENGTH:
          error = applyLength(entity, constraint.value || 0, fixedMap, config.relax);
          break;
        case ConstraintType.RADIUS:
          if (isCircle(entity)) {
            error = applyLength(entity, constraint.value || 0, fixedMap, config.relax);
          }
          break;
        case ConstraintType.FIXED:
          if (isPoint(entity)) {
            const pos = fixedMap.get(entity.id);
            if (pos) {
              entity.x = pos.x;
              entity.y = pos.y;
            }
          }
          error = 0;
          break;
      }

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

  const dofAnalysis = calculateDOF(sketch, fixedMap);
  const entityStates = analyzeEntityStates(sketch, fixedMap);

  let status = ConstraintStatus.UNDER;
  if (dofAnalysis.remainingDOF === 0 && converged) {
    status = ConstraintStatus.FULLY;
  } else if (dofAnalysis.remainingDOF < 0 || !converged) {
    status = ConstraintStatus.OVER;
  }

  const conflicts = detectConflicts(sketch, { iterations, maxError, converged });
  if (conflicts.length > 0) {
    status = ConstraintStatus.OVER;
  }

  sketch.fullyConstrained = status === ConstraintStatus.FULLY;

  return {
    status,
    converged,
    iterations,
    maxError,
    degreesOfFreedom: dofAnalysis.remainingDOF,
    equationCount: dofAnalysis.constraintDOF,
    dofAnalysis,
    entityStates,
    conflicts,
  };
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

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertApprox(actual, expected, tolerance = 0.1, message) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(message || `Expected ${expected}, got ${actual} (diff: ${diff})`);
  }
}

// === Tests ===

let passed = 0;
let total = 0;

console.log('\n=== DOF Tracking Tests ===\n');

// Test: DOF calculation for single point
total++;
if (
  test('Single point has 2 DOF', () => {
    const sketch = new Sketch('test');
    sketch.addPoint(0, 0);
    const dof = calculateDOF(sketch);
    assertEqual(dof.totalDOF, 2, 'Total DOF should be 2');
    assertEqual(dof.remainingDOF, 2, 'Remaining DOF should be 2');
  })
)
  passed++;

// Test: DOF for line (2 points = 4 DOF)
total++;
if (
  test('Line (2 points) has 4 DOF', () => {
    const sketch = new Sketch('test');
    sketch.addLine(0, 0, 10, 10);
    const dof = calculateDOF(sketch);
    assertEqual(dof.totalDOF, 4, 'Total DOF should be 4');
  })
)
  passed++;

// Test: FIXED constraint removes 2 DOF
total++;
if (
  test('FIXED constraint removes 2 DOF', () => {
    const sketch = new Sketch('test');
    const point = sketch.addPoint(0, 0);
    sketch.addConstraint(ConstraintType.FIXED, [point.id]);
    const dof = calculateDOF(sketch);
    assertEqual(dof.constraintDOF, 2, 'Constraint DOF should be 2');
    assertEqual(dof.remainingDOF, 0, 'Remaining DOF should be 0');
  })
)
  passed++;

// Test: HORIZONTAL constraint removes 1 DOF
total++;
if (
  test('HORIZONTAL constraint removes 1 DOF', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 10, 5);
    sketch.addConstraint(ConstraintType.HORIZONTAL, [line.id]);
    const dof = calculateDOF(sketch);
    assertEqual(dof.constraintDOF, 1, 'Constraint DOF should be 1');
    assertEqual(dof.remainingDOF, 3, 'Remaining DOF should be 3 (4-1)');
  })
)
  passed++;

// Test: LENGTH constraint removes 1 DOF
total++;
if (
  test('LENGTH constraint removes 1 DOF', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 10, 0);
    sketch.addConstraint(ConstraintType.LENGTH, [line.id], 50);
    const dof = calculateDOF(sketch);
    assertEqual(dof.constraintDOF, 1, 'Constraint DOF should be 1');
  })
)
  passed++;

// Test: Circle has DOF for radius
total++;
if (
  test('Circle has center (2 DOF) + radius (1 DOF)', () => {
    const sketch = new Sketch('test');
    sketch.addCircle(0, 0, 10);
    const dof = calculateDOF(sketch);
    // Center point: 2 DOF, Circle radius: 1 DOF
    assertEqual(dof.totalDOF, 3, 'Total DOF should be 3');
  })
)
  passed++;

console.log('\n=== Constraint Status Tests ===\n');

// Test: Unconstrained sketch is under-constrained
total++;
if (
  test('Unconstrained sketch reports under-constrained', () => {
    const sketch = new Sketch('test');
    sketch.addLine(0, 0, 10, 10);
    const result = solveSketch(sketch);
    assertEqual(result.status, ConstraintStatus.UNDER, 'Should be under-constrained');
  })
)
  passed++;

// Test: Fully constrained line (fixed start, horizontal, length)
total++;
if (
  test('Fully constrained line detected correctly', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 10, 5);
    line.start.fixed = true;
    sketch.addConstraint(ConstraintType.HORIZONTAL, [line.id]);
    sketch.addConstraint(ConstraintType.LENGTH, [line.id], 50);
    const result = solveSketch(sketch);
    // Fixed point (2) + horizontal (1) + length (1) = 4, which equals 4 DOF for line
    assertEqual(result.status, ConstraintStatus.FULLY, 'Should be fully constrained');
    assert(result.converged, 'Should converge');
  })
)
  passed++;

console.log('\n=== Entity State Analysis Tests ===\n');

// Test: Free point is under-constrained
total++;
if (
  test('Free point is under-constrained', () => {
    const sketch = new Sketch('test');
    const point = sketch.addPoint(10, 10);
    const states = analyzeEntityStates(sketch);
    assertEqual(
      states.get(point.id),
      EntityState.UNDER_CONSTRAINED,
      'Point should be under-constrained'
    );
  })
)
  passed++;

// Test: Fixed point is fully constrained
total++;
if (
  test('Fixed point is fully constrained', () => {
    const sketch = new Sketch('test');
    const point = sketch.addPoint(10, 10);
    point.fixed = true;
    const fixedMap = new Map([[point.id, { x: point.x, y: point.y }]]);
    const states = analyzeEntityStates(sketch, fixedMap);
    assertEqual(
      states.get(point.id),
      EntityState.FULLY_CONSTRAINED,
      'Point should be fully constrained'
    );
  })
)
  passed++;

// Test: Line with fully constrained endpoints is fully constrained
total++;
if (
  test('Line with fixed endpoints is fully constrained', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 10, 10);
    line.start.fixed = true;
    line.end.fixed = true;
    const fixedMap = new Map([
      [line.start.id, { x: line.start.x, y: line.start.y }],
      [line.end.id, { x: line.end.x, y: line.end.y }],
    ]);
    const states = analyzeEntityStates(sketch, fixedMap);
    assertEqual(
      states.get(line.id),
      EntityState.FULLY_CONSTRAINED,
      'Line should be fully constrained'
    );
  })
)
  passed++;

console.log('\n=== Conflict Detection Tests ===\n');

// Test: Multiple orientation constraints on same line detected as conflict
total++;
if (
  test('Conflicting orientation constraints detected', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 10, 10);
    sketch.addConstraint(ConstraintType.HORIZONTAL, [line.id]);
    sketch.addConstraint(ConstraintType.VERTICAL, [line.id]);
    const result = solveSketch(sketch);
    assert(result.conflicts.length > 0, 'Should detect conflicts');
  })
)
  passed++;

// Test: Conflicting length constraints detected
total++;
if (
  test('Conflicting length constraints detected', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 10, 0);
    sketch.addConstraint(ConstraintType.LENGTH, [line.id], 50);
    sketch.addConstraint(ConstraintType.LENGTH, [line.id], 100); // Different value
    const result = solveSketch(sketch);
    assert(result.conflicts.length >= 2, 'Should detect both conflicting constraints');
  })
)
  passed++;

console.log('\n=== Solver Integration Tests ===\n');

// Test: Solver applies HORIZONTAL constraint
total++;
if (
  test('Solver applies HORIZONTAL constraint correctly', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 10, 5);
    sketch.addConstraint(ConstraintType.HORIZONTAL, [line.id]);
    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');
    assertApprox(line.start.y, line.end.y, 0.01, 'Line endpoints should have same Y');
  })
)
  passed++;

// Test: Solver applies LENGTH constraint
total++;
if (
  test('Solver applies LENGTH constraint correctly', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 10, 0);
    sketch.addConstraint(ConstraintType.LENGTH, [line.id], 50);
    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');
    assertApprox(line.length, 50, 0.1, 'Line length should be 50');
  })
)
  passed++;

// Test: Solver applies RADIUS constraint
total++;
if (
  test('Solver applies RADIUS constraint correctly', () => {
    const sketch = new Sketch('test');
    const circle = sketch.addCircle(0, 0, 10);
    sketch.addConstraint(ConstraintType.RADIUS, [circle.id], 25);
    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');
    assertApprox(circle.radius, 25, 0.1, 'Circle radius should be 25');
  })
)
  passed++;

// Test: Combined constraints work together
total++;
if (
  test('Combined HORIZONTAL + LENGTH constraints work together', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 30, 40);
    sketch.addConstraint(ConstraintType.HORIZONTAL, [line.id]);
    sketch.addConstraint(ConstraintType.LENGTH, [line.id], 60);
    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');
    assertApprox(line.start.y, line.end.y, 0.1, 'Line should be horizontal');
    assertApprox(line.length, 60, 0.1, 'Line should be 60 units long');
  })
)
  passed++;

// Test: Fixed point respected during solving
total++;
if (
  test('Fixed point position maintained during solve', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(10, 20, 40, 50);
    line.start.fixed = true;
    sketch.addConstraint(ConstraintType.HORIZONTAL, [line.id]);
    sketch.addConstraint(ConstraintType.LENGTH, [line.id], 30);
    solveSketch(sketch);
    assertApprox(line.start.x, 10, 0.01, 'Fixed start X should stay at 10');
    assertApprox(line.start.y, 20, 0.01, 'Fixed start Y should stay at 20');
  })
)
  passed++;

console.log('\n=== Complex Scenario Tests ===\n');

// Test: Rectangle-like shape with 4 points
total++;
if (
  test('Rectangle DOF calculation (4 points = 8 DOF)', () => {
    const sketch = new Sketch('test');
    sketch.addPoint(0, 0);
    sketch.addPoint(10, 0);
    sketch.addPoint(10, 10);
    sketch.addPoint(0, 10);
    const dof = calculateDOF(sketch);
    assertEqual(dof.totalDOF, 8, 'Total DOF should be 8');
  })
)
  passed++;

// Test: Partially constrained complex sketch
total++;
if (
  test('Partially constrained sketch returns correct DOF', () => {
    const sketch = new Sketch('test');
    const line1 = sketch.addLine(0, 0, 10, 0);
    const line2 = sketch.addLine(10, 0, 10, 10);
    // Constrain line1 to be horizontal and 10 units
    sketch.addConstraint(ConstraintType.HORIZONTAL, [line1.id]);
    sketch.addConstraint(ConstraintType.LENGTH, [line1.id], 10);
    // Constrain line2 to be vertical
    sketch.addConstraint(ConstraintType.VERTICAL, [line2.id]);
    const result = solveSketch(sketch);
    // 8 DOF (4 points) - 3 constraints = 5 remaining
    assertEqual(result.degreesOfFreedom, 5, 'Should have 5 DOF remaining');
    assertEqual(result.status, ConstraintStatus.UNDER, 'Should be under-constrained');
  })
)
  passed++;

// Summary
console.log(`\n=== Results: ${passed}/${total} tests passed ===\n`);

if (passed < total) {
  process.exit(1);
}
