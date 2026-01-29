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
    case ConstraintType.FIXED:
      // Fixed removes 2 DOF (both coordinates)
      return 2;
    case ConstraintType.HORIZONTAL:
    case ConstraintType.VERTICAL:
      // Removes 1 DOF (one coordinate relationship)
      return 1;
    case ConstraintType.COINCIDENT:
      // Makes two points the same - removes 2 DOF
      return 2;
    case ConstraintType.LENGTH:
    case ConstraintType.DISTANCE:
    case ConstraintType.RADIUS:
      // Distance/length removes 1 DOF
      return 1;
    case ConstraintType.PARALLEL:
    case ConstraintType.PERPENDICULAR:
      // Angle relationship removes 1 DOF
      return 1;
    case ConstraintType.ANGLE:
      // Specific angle removes 1 DOF
      return 1;
    case ConstraintType.EQUAL:
      // Equal length/radius removes 1 DOF
      return 1;
    case ConstraintType.TANGENT:
      // Tangent removes 1 DOF
      return 1;
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
