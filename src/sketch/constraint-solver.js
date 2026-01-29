/**
 * Ameri-CAD Sketch Constraint Solver
 *
 * Full iterative relaxation solver for 2D sketch constraints with
 * Degrees of Freedom (DOF) tracking and constraint status detection.
 *
 * Constraint States:
 * - Under-constrained (blue): Geometry can still move
 * - Fully constrained (green/black): Exactly defined
 * - Over-constrained (red): Conflicting constraints
 */

import { ConstraintType, SketchPoint, SketchLine, SketchCircle } from './sketch-manager.js';

const DEFAULT_OPTIONS = {
  maxIterations: 60,
  tolerance: 1e-3,
  relax: 0.5,
};

const EPS = 1e-6;

/**
 * Constraint status enumeration
 */
export const ConstraintStatus = {
  UNDER: 'under-constrained',
  OVER: 'over-constrained',
  FULLY: 'fully-constrained',
};

/**
 * Entity constraint state for visual feedback
 */
export const EntityState = {
  UNDER_CONSTRAINED: 'under-constrained',
  FULLY_CONSTRAINED: 'fully-constrained',
  OVER_CONSTRAINED: 'over-constrained',
};

const normalizeAngle = angle => {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

const toRadians = value => {
  if (typeof value !== 'number') return 0;
  if (Math.abs(value) > Math.PI * 2 + 1e-3) {
    return (value * Math.PI) / 180;
  }
  return value;
};

const isPoint = entity => entity instanceof SketchPoint;
const isLine = entity => entity instanceof SketchLine;
const isCircle = entity => entity instanceof SketchCircle;

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

const enforceFixedPositions = (sketch, fixedMap) => {
  if (!fixedMap.size) return;
  fixedMap.forEach((pos, id) => {
    const point = sketch.points.get(id);
    if (point) {
      point.x = pos.x;
      point.y = pos.y;
    }
  });
};

/**
 * Get DOF contribution for an entity type
 * @param {Object} entity - Sketch entity
 * @returns {number} DOF contribution
 */
export const getEntityDOF = entity => {
  if (isPoint(entity)) {
    // A point has 2 DOF (x, y position)
    return 2;
  }
  if (isLine(entity)) {
    // A line's DOF is counted through its endpoints (4 DOF total)
    // But since points are tracked separately, line adds 0
    return 0;
  }
  if (isCircle(entity)) {
    // Circle center counted as point (2 DOF) + radius (1 DOF)
    return 1; // Just radius, center is a point
  }
  return 0;
};

/**
 * Get DOF removed by a constraint type
 * @param {Object} constraint - Sketch constraint
 * @returns {number} DOF removed
 */
export const getConstraintDOF = constraint => {
  switch (constraint.type) {
    // Positional constraints that fully lock position
    case ConstraintType.FIXED:
    case 'fix': // Alias for FIXED
      // Fixed removes 2 DOF (both coordinates)
      return 2;

    // Single-DOF orientation constraints
    case ConstraintType.HORIZONTAL:
    case ConstraintType.VERTICAL:
      // Removes 1 DOF (one coordinate relationship)
      return 1;

    // Positional constraints that lock both coordinates
    case ConstraintType.COINCIDENT:
    case ConstraintType.CONCENTRIC:
      // Makes two points/centers the same - removes 2 DOF
      return 2;

    // Dimensional constraints
    case ConstraintType.LENGTH:
    case ConstraintType.DISTANCE:
    case ConstraintType.RADIUS:
    case ConstraintType.DIAMETER:
      // Distance/length removes 1 DOF
      return 1;

    // Angular relationship constraints
    case ConstraintType.PARALLEL:
    case ConstraintType.PERPENDICULAR:
    case ConstraintType.ANGLE:
      // Angle relationship removes 1 DOF
      return 1;

    // Length equality constraint
    case ConstraintType.EQUAL:
    case ConstraintType.TANGENT:
      // Equal length/radius or tangent removes 1 DOF
      return 1;

    // Complex positional constraints
    case ConstraintType.MIDPOINT:
      // Midpoint locks point to line's midpoint - removes 2 DOF
      return 2;

    case ConstraintType.SYMMETRIC:
      // Symmetric about an axis - removes 2 DOF (position relative to axis)
      return 2;

    case ConstraintType.COLINEAR:
      // Colinear: parallel (1) + on same line (1) = 2 DOF
      return 2;

    default:
      return 0;
  }
};

/**
 * Calculate total DOF for a sketch
 * @param {Object} sketch - Sketch object
 * @param {Map} fixedMap - Map of fixed point positions
 * @returns {Object} DOF analysis result
 */
export const calculateDOF = (sketch, fixedMap = new Map()) => {
  let totalDOF = 0;
  const entityDOF = new Map();

  // Calculate DOF for all points
  sketch.points.forEach(point => {
    if (!isFixedPoint(point, fixedMap)) {
      const dof = 2;
      entityDOF.set(point.id, dof);
      totalDOF += dof;
    } else {
      entityDOF.set(point.id, 0);
    }
  });

  // Add DOF for circles (radius)
  sketch.circles.forEach(circle => {
    const dof = 1;
    entityDOF.set(circle.id, dof);
    totalDOF += dof;
  });

  // Calculate DOF removed by constraints
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

/**
 * Analyze constraint status per entity
 * @param {Object} sketch - Sketch object
 * @param {Map} fixedMap - Map of fixed point positions
 * @returns {Map} Entity ID -> EntityState mapping
 */
export const analyzeEntityStates = (sketch, fixedMap = new Map()) => {
  const states = new Map();
  const constraintCountByEntity = new Map();

  // Count constraints per entity
  sketch.constraints.forEach(constraint => {
    constraint.entities.forEach(entityId => {
      const count = constraintCountByEntity.get(entityId) || 0;
      constraintCountByEntity.set(entityId, count + 1);
    });
  });

  // Analyze points
  sketch.points.forEach(point => {
    if (isFixedPoint(point, fixedMap)) {
      states.set(point.id, EntityState.FULLY_CONSTRAINED);
      return;
    }

    const constraintCount = constraintCountByEntity.get(point.id) || 0;
    // A point needs 2 DOF removed to be fully constrained
    // This is a simplified heuristic - full analysis would trace constraint dependencies
    if (constraintCount >= 2) {
      states.set(point.id, EntityState.FULLY_CONSTRAINED);
    } else if (constraintCount > 0) {
      states.set(point.id, EntityState.UNDER_CONSTRAINED);
    } else {
      states.set(point.id, EntityState.UNDER_CONSTRAINED);
    }
  });

  // Analyze lines (based on endpoint states)
  sketch.lines.forEach(line => {
    const startState = states.get(line.start.id) || EntityState.UNDER_CONSTRAINED;
    const endState = states.get(line.end.id) || EntityState.UNDER_CONSTRAINED;
    const lineConstraints = constraintCountByEntity.get(line.id) || 0;

    // Check if line has orientation constraints
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
      // Partially constrained
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

  // Analyze circles
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

/**
 * Detect over-constrained situations and conflicts
 * @param {Object} sketch - Sketch object
 * @param {Object} solverResult - Result from solver iterations
 * @returns {Array} List of conflicting constraint IDs
 */
export const detectConflicts = (sketch, solverResult) => {
  const conflicts = [];

  // Check for constraints that didn't converge
  sketch.constraints.forEach(constraint => {
    if (!constraint.satisfied && solverResult.iterations >= DEFAULT_OPTIONS.maxIterations - 1) {
      conflicts.push(constraint.id);
    }
  });

  // Check for redundant constraints (simplified heuristic)
  const constraintsByEntity = new Map();
  sketch.constraints.forEach(constraint => {
    constraint.entities.forEach(entityId => {
      if (!constraintsByEntity.has(entityId)) {
        constraintsByEntity.set(entityId, []);
      }
      constraintsByEntity.get(entityId).push(constraint);
    });
  });

  // Find entities with potentially conflicting constraints
  constraintsByEntity.forEach((constraints, entityId) => {
    // Multiple orientation constraints on same line
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

    // Multiple length/radius constraints on same entity
    const dimensionConstraints = constraints.filter(
      c => c.type === ConstraintType.LENGTH || c.type === ConstraintType.RADIUS
    );
    if (dimensionConstraints.length > 1) {
      // Check if values conflict
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

    // Get entity for additional checks
    const entity = sketch.getEntity(entityId);

    // Over-constrained point check: more than 2 fixed/coincident constraints
    if (isPoint(entity)) {
      const positionConstraints = constraints.filter(
        c => c.type === ConstraintType.FIXED || c.type === ConstraintType.COINCIDENT
      );
      if (positionConstraints.length > 1) {
        positionConstraints.slice(1).forEach(c => {
          if (!conflicts.includes(c.id)) {
            conflicts.push(c.id);
          }
        });
      }
    }
  });

  return conflicts;
};

/**
 * Generate human-readable status message
 * @param {Object} sketch - Sketch object
 * @param {Object} dofResult - DOF calculation result
 * @param {Map} entityStates - Entity state mapping
 * @returns {Object} Status object with message and details
 */
export const generateStatusMessage = (sketch, dofResult, entityStates) => {
  const status = {
    overallStatus: ConstraintStatus.UNDER,
    dofRemaining: dofResult.remainingDOF,
    message: '',
    details: [],
  };

  if (dofResult.remainingDOF === 0) {
    status.overallStatus = ConstraintStatus.FULLY;
    status.message = 'Sketch is fully constrained';
  } else if (dofResult.remainingDOF < 0) {
    status.overallStatus = ConstraintStatus.OVER;
    status.message = `Sketch is over-constrained (${Math.abs(dofResult.remainingDOF)} redundant DOF)`;
  } else {
    status.overallStatus = ConstraintStatus.UNDER;
    status.message = `Sketch is under-constrained (${dofResult.remainingDOF} DOF remaining)`;
  }

  // Generate details for under-constrained entities
  entityStates.forEach((state, entityId) => {
    if (state === EntityState.UNDER_CONSTRAINED) {
      const entity = sketch.getEntity(entityId);
      if (!entity) return;

      let entityType = 'Entity';
      let suggestion = '';

      if (isPoint(entity)) {
        entityType = 'Point';
        suggestion = 'needs position constraint (fixed or coincident)';
      } else if (isLine(entity)) {
        entityType = 'Line';
        const hasLength = Array.from(sketch.constraints.values()).some(
          c => c.entities.includes(entityId) && c.type === ConstraintType.LENGTH
        );
        const hasOrientation = Array.from(sketch.constraints.values()).some(
          c =>
            c.entities.includes(entityId) &&
            (c.type === ConstraintType.HORIZONTAL || c.type === ConstraintType.VERTICAL)
        );
        if (!hasOrientation) {
          suggestion = 'needs horizontal, vertical, or angle constraint';
        } else if (!hasLength) {
          suggestion = 'needs length constraint';
        } else {
          suggestion = 'endpoints need position constraints';
        }
      } else if (isCircle(entity)) {
        entityType = 'Circle';
        suggestion = 'needs center position or radius constraint';
      }

      status.details.push({
        entityId,
        entityType,
        suggestion,
      });
    }
  });

  return status;
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

const applyDistance = (p1, p2, target, fixedMap, relax) => {
  if (!p1 || !p2) return 0;
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < EPS) {
    dist = EPS;
    dx = 1;
    dy = 0;
  }
  const error = dist - target;
  const ux = dx / dist;
  const uy = dy / dist;
  const startFixed = isFixedPoint(p1, fixedMap);
  const endFixed = isFixedPoint(p2, fixedMap);
  if (startFixed && endFixed) return Math.abs(error);
  if (startFixed) {
    movePoint(p2, -ux * error * relax, -uy * error * relax, fixedMap);
    return Math.abs(error);
  }
  if (endFixed) {
    movePoint(p1, ux * error * relax, uy * error * relax, fixedMap);
    return Math.abs(error);
  }
  const correction = error * 0.5 * relax;
  movePoint(p1, ux * correction, uy * correction, fixedMap);
  movePoint(p2, -ux * correction, -uy * correction, fixedMap);
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

const applyAngle = (line1, line2, targetAngle, fixedMap, relax) => {
  if (!line1 || !line2) return 0;
  const target = normalizeAngle(toRadians(targetAngle));
  const diff = normalizeAngle(line2.angle - line1.angle);
  const error = normalizeAngle(diff - target);
  const delta = error * relax;
  const moved1 = rotateLine(line1, delta * 0.5, fixedMap);
  const moved2 = rotateLine(line2, -delta * 0.5, fixedMap);
  if (!moved1 && moved2) rotateLine(line2, -delta, fixedMap);
  if (!moved2 && moved1) rotateLine(line1, delta, fixedMap);
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

  if (isLine1 && isCircle2) {
    const target = (entity1.length + entity2.radius) * 0.5;
    const err = adjustLineLength(entity1, target, fixedMap, relax);
    entity2.radius += (target - entity2.radius) * relax;
    return Math.max(err, Math.abs(entity2.radius - target));
  }

  if (isCircle1 && isLine2) {
    const target = (entity2.length + entity1.radius) * 0.5;
    const err = adjustLineLength(entity2, target, fixedMap, relax);
    entity1.radius += (target - entity1.radius) * relax;
    return Math.max(err, Math.abs(entity1.radius - target));
  }

  return 0;
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

/**
 * Apply tangent constraint between a line and a circle
 * Makes the line tangent to the circle
 */
const applyTangent = (entity1, entity2, fixedMap, relax) => {
  if (!entity1 || !entity2) return 0;

  // Determine which is line and which is circle
  let line, circle;
  if (isLine(entity1) && isCircle(entity2)) {
    line = entity1;
    circle = entity2;
  } else if (isCircle(entity1) && isLine(entity2)) {
    line = entity2;
    circle = entity1;
  } else if (isCircle(entity1) && isCircle(entity2)) {
    // Circle-circle tangent: make them touch at one point
    const c1 = entity1;
    const c2 = entity2;
    const dx = c2.center.x - c1.center.x;
    const dy = c2.center.y - c1.center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < EPS) return c1.radius + c2.radius;

    // Target distance for external tangent
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

  // Line-circle tangent: adjust line to be tangent to circle
  // Calculate distance from circle center to infinite line
  const A = line.end.y - line.start.y;
  const B = line.start.x - line.end.x;
  const C = line.end.x * line.start.y - line.start.x * line.end.y;
  const lineLen = Math.sqrt(A * A + B * B);
  if (lineLen < EPS) return circle.radius;

  const dist = (A * circle.center.x + B * circle.center.y + C) / lineLen;
  const error = Math.abs(dist) - circle.radius;

  if (Math.abs(error) < EPS) return 0;

  // Move line perpendicular to itself to achieve tangency
  const perpX = A / lineLen;
  const perpY = B / lineLen;
  const sign = dist >= 0 ? 1 : -1;

  const startFixed = isFixedPoint(line.start, fixedMap);
  const endFixed = isFixedPoint(line.end, fixedMap);
  const centerFixed = isFixedPoint(circle.center, fixedMap);

  if (startFixed && endFixed && centerFixed) return Math.abs(error);

  if (!startFixed && !endFixed) {
    // Move line toward/away from circle
    movePoint(line.start, sign * perpX * error * relax, sign * perpY * error * relax, fixedMap);
    movePoint(line.end, sign * perpX * error * relax, sign * perpY * error * relax, fixedMap);
  } else if (!centerFixed) {
    // Move circle center
    movePoint(
      circle.center,
      -sign * perpX * error * relax,
      -sign * perpY * error * relax,
      fixedMap
    );
  }

  return Math.abs(error);
};

/**
 * Apply concentric constraint between two circles/arcs
 * Makes them share the same center point
 */
const applyConcentric = (entity1, entity2, fixedMap, relax) => {
  if (!entity1 || !entity2) return 0;
  if (!isCircle(entity1) || !isCircle(entity2)) return 0;

  const c1 = entity1.center;
  const c2 = entity2.center;

  return applyCoincident(c1, c2, fixedMap, relax);
};

/**
 * Apply midpoint constraint
 * Makes a point sit at the midpoint of a line
 */
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
  const startFixed = isFixedPoint(line.start, fixedMap);
  const endFixed = isFixedPoint(line.end, fixedMap);

  if (pointFixed && startFixed && endFixed) return error;

  if (!pointFixed) {
    // Move point to midpoint
    movePoint(point, dx * relax, dy * relax, fixedMap);
  } else {
    // Point is fixed, adjust line endpoints symmetrically around point
    if (!startFixed && !endFixed) {
      // Move both endpoints to make point the new midpoint
      const newMidX = point.x;
      const newMidY = point.y;
      const halfDx = (line.end.x - line.start.x) / 2;
      const halfDy = (line.end.y - line.start.y) / 2;

      const targetStartX = newMidX - halfDx;
      const targetStartY = newMidY - halfDy;
      const targetEndX = newMidX + halfDx;
      const targetEndY = newMidY + halfDy;

      movePoint(
        line.start,
        (targetStartX - line.start.x) * relax,
        (targetStartY - line.start.y) * relax,
        fixedMap
      );
      movePoint(
        line.end,
        (targetEndX - line.end.x) * relax,
        (targetEndY - line.end.y) * relax,
        fixedMap
      );
    } else if (!startFixed) {
      // Only start can move
      const targetStartX = 2 * point.x - line.end.x;
      const targetStartY = 2 * point.y - line.end.y;
      movePoint(
        line.start,
        (targetStartX - line.start.x) * relax,
        (targetStartY - line.start.y) * relax,
        fixedMap
      );
    } else if (!endFixed) {
      // Only end can move
      const targetEndX = 2 * point.x - line.start.x;
      const targetEndY = 2 * point.y - line.start.y;
      movePoint(
        line.end,
        (targetEndX - line.end.x) * relax,
        (targetEndY - line.end.y) * relax,
        fixedMap
      );
    }
  }

  return error;
};

/**
 * Apply symmetric constraint
 * Makes entities symmetric about a line (mirror axis)
 */
const applySymmetric = (entity1, entity2, axisLine, fixedMap, relax) => {
  if (!entity1 || !entity2 || !axisLine) return 0;
  if (!isLine(axisLine)) return 0;

  // Get the axis line parameters
  const ax = axisLine.end.x - axisLine.start.x;
  const ay = axisLine.end.y - axisLine.start.y;
  const axisLen = Math.sqrt(ax * ax + ay * ay);
  if (axisLen < EPS) return 0;

  // Normalized axis direction
  const ux = ax / axisLen;
  const uy = ay / axisLen;

  // Helper to reflect a point across the axis
  const reflectPoint = p => {
    // Vector from axis start to point
    const vx = p.x - axisLine.start.x;
    const vy = p.y - axisLine.start.y;

    // Project onto axis
    const dot = vx * ux + vy * uy;
    const projX = axisLine.start.x + dot * ux;
    const projY = axisLine.start.y + dot * uy;

    // Reflect
    return {
      x: 2 * projX - p.x,
      y: 2 * projY - p.y,
    };
  };

  let totalError = 0;

  if (isPoint(entity1) && isPoint(entity2)) {
    // Two points symmetric about axis
    const reflected1 = reflectPoint(entity1);
    const dx = reflected1.x - entity2.x;
    const dy = reflected1.y - entity2.y;
    const error = Math.sqrt(dx * dx + dy * dy);
    totalError = error;

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
  } else if (isLine(entity1) && isLine(entity2)) {
    // Two lines symmetric about axis - check both endpoints
    const errStart = applySymmetric(entity1.start, entity2.start, axisLine, fixedMap, relax);
    const errEnd = applySymmetric(entity1.end, entity2.end, axisLine, fixedMap, relax);
    totalError = Math.max(errStart, errEnd);
  }

  return totalError;
};

/**
 * Apply colinear constraint
 * Makes two lines lie on the same infinite line
 */
const applyColinear = (line1, line2, fixedMap, relax) => {
  if (!line1 || !line2) return 0;
  if (!isLine(line1) || !isLine(line2)) return 0;

  // First, make lines parallel
  const parallelError = applyParallel(line1, line2, fixedMap, relax);

  // Then move line2 to be on the same infinite line as line1
  // Calculate distance from line2's midpoint to line1's infinite extension
  const A = line1.end.y - line1.start.y;
  const B = line1.start.x - line1.end.x;
  const C = line1.end.x * line1.start.y - line1.start.x * line1.end.y;
  const lineLen = Math.sqrt(A * A + B * B);

  if (lineLen < EPS) return parallelError;

  const mid2X = (line2.start.x + line2.end.x) / 2;
  const mid2Y = (line2.start.y + line2.end.y) / 2;
  const dist = (A * mid2X + B * mid2Y + C) / lineLen;

  if (Math.abs(dist) < EPS) return parallelError;

  // Move line2 perpendicular to itself to lie on line1
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

/**
 * Apply fix constraint
 * Locks an entity in place (same as FIXED)
 */
const applyFix = (entity, fixedMap) => {
  if (!entity) return 0;

  if (isPoint(entity)) {
    const pos = fixedMap.get(entity.id);
    if (pos) {
      entity.x = pos.x;
      entity.y = pos.y;
    } else {
      // Add to fixed map if not already there
      fixedMap.set(entity.id, { x: entity.x, y: entity.y });
    }
    return 0;
  }

  if (isLine(entity)) {
    // Fix both endpoints
    applyFix(entity.start, fixedMap);
    applyFix(entity.end, fixedMap);
    return 0;
  }

  if (isCircle(entity)) {
    // Fix center
    applyFix(entity.center, fixedMap);
    return 0;
  }

  return 0;
};

const applyConstraint = (sketch, constraint, fixedMap, options) => {
  const entities = constraint.entities.map(id => sketch.getEntity(id));
  switch (constraint.type) {
    case ConstraintType.HORIZONTAL:
      return applyHorizontal(entities[0], fixedMap, options.relax);
    case ConstraintType.VERTICAL:
      return applyVertical(entities[0], fixedMap, options.relax);
    case ConstraintType.COINCIDENT:
      return applyCoincident(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.PERPENDICULAR:
      return applyPerpendicular(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.PARALLEL:
      return applyParallel(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.DISTANCE:
      return applyDistance(
        entities[0],
        entities[1],
        constraint.value || 0,
        fixedMap,
        options.relax
      );
    case ConstraintType.LENGTH:
      return applyLength(entities[0], constraint.value || 0, fixedMap, options.relax);
    case ConstraintType.ANGLE:
      return applyAngle(entities[0], entities[1], constraint.value || 0, fixedMap, options.relax);
    case ConstraintType.FIXED:
      if (isPoint(entities[0])) {
        const point = entities[0];
        const pos = fixedMap.get(point.id);
        if (pos) {
          point.x = pos.x;
          point.y = pos.y;
        }
        return 0;
      }
      return 0;
    case ConstraintType.EQUAL:
      return applyEqual(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.RADIUS:
      if (isCircle(entities[0])) {
        return applyLength(entities[0], constraint.value || 0, fixedMap, options.relax);
      }
      return 0;
    case ConstraintType.TANGENT:
      return applyTangent(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.CONCENTRIC:
      return applyConcentric(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.MIDPOINT:
      return applyMidpoint(entities[0], entities[1], fixedMap, options.relax);
    case ConstraintType.SYMMETRIC:
      // Symmetric requires 3 entities: two to be symmetric and the axis line
      return applySymmetric(entities[0], entities[1], entities[2], fixedMap, options.relax);
    case ConstraintType.COLINEAR:
      return applyColinear(entities[0], entities[1], fixedMap, options.relax);
    case 'fix': // Alias for FIXED
      return applyFix(entities[0], fixedMap);
    default:
      return 0;
  }
};

const collectFixedPoints = sketch => {
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
  return fixedMap;
};

/**
 * Solve all constraints for a sketch with full DOF tracking.
 * @param {Object} sketch - Sketch to solve
 * @param {Object} options - Solver options
 * @returns {Object} Comprehensive result with status, DOF, entity states, and conflicts
 */
export const solveSketch = (sketch, options = {}) => {
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
      statusMessage: null,
    };
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  const constraints = Array.from(sketch.constraints.values());
  const fixedMap = collectFixedPoints(sketch);

  let converged = false;
  let iterations = 0;
  let maxError = 0;

  // Iterative solving
  for (let i = 0; i < config.maxIterations; i += 1) {
    maxError = 0;
    constraints.forEach(constraint => {
      const error = applyConstraint(sketch, constraint, fixedMap, config);
      constraint.satisfied = Math.abs(error) <= config.tolerance;
      if (Math.abs(error) > maxError) {
        maxError = Math.abs(error);
      }
    });

    enforceFixedPositions(sketch, fixedMap);
    iterations = i + 1;

    if (maxError <= config.tolerance) {
      converged = true;
      break;
    }
  }

  // Calculate DOF analysis
  const dofAnalysis = calculateDOF(sketch, fixedMap);

  // Analyze entity states
  const entityStates = analyzeEntityStates(sketch, fixedMap);

  // Determine overall status
  let status = ConstraintStatus.UNDER;
  if (dofAnalysis.remainingDOF === 0 && converged) {
    status = ConstraintStatus.FULLY;
  } else if (dofAnalysis.remainingDOF < 0 || !converged) {
    status = ConstraintStatus.OVER;
  }

  // Detect conflicts
  const conflicts = detectConflicts(sketch, { iterations, maxError, converged });

  // Update status if conflicts found
  if (conflicts.length > 0) {
    status = ConstraintStatus.OVER;
    // Mark conflicting constraints' entities as over-constrained
    conflicts.forEach(constraintId => {
      const constraint = sketch.constraints.get(constraintId);
      if (constraint) {
        constraint.entities.forEach(entityId => {
          entityStates.set(entityId, EntityState.OVER_CONSTRAINED);
        });
      }
    });
  }

  // Generate status message
  const statusMessage = generateStatusMessage(sketch, dofAnalysis, entityStates);

  // Update sketch state
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
    statusMessage,
  };
};

/**
 * Get a formatted status string for display
 * @param {Object} result - Result from solveSketch
 * @returns {string} Formatted status string
 */
export const getStatusString = result => {
  if (!result || !result.statusMessage) {
    return 'No sketch loaded';
  }

  let output = result.statusMessage.message;

  if (result.statusMessage.details.length > 0) {
    output += '\n\nUnder-constrained entities:';
    result.statusMessage.details.forEach(detail => {
      output += `\n  - ${detail.entityType} (${detail.entityId}): ${detail.suggestion}`;
    });
  }

  if (result.conflicts.length > 0) {
    output += `\n\nConflicting constraints: ${result.conflicts.join(', ')}`;
  }

  return output;
};
