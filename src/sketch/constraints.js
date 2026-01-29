/**
 * Ameri-CAD Advanced Sketch Constraints
 *
 * Professional constraint system for 2D sketches including:
 * - Geometric constraints (coincident, tangent, perpendicular, parallel, etc.)
 * - Dimensional constraints (length, radius, distance, angle)
 * - Positional constraints (fix, midpoint, symmetric)
 *
 * This module provides the constraint type definitions and auto-detection logic.
 */

/**
 * Complete constraint type enumeration
 */
export const ConstraintTypes = {
  // Geometric Constraints
  COINCIDENT: 'coincident', // Points/endpoints share location
  TANGENT: 'tangent', // Curves are tangent at connection
  PERPENDICULAR: 'perpendicular', // Lines are 90° to each other
  PARALLEL: 'parallel', // Lines are parallel
  EQUAL: 'equal', // Lines/circles have equal length/radius
  CONCENTRIC: 'concentric', // Circles/arcs share center
  COLINEAR: 'colinear', // Lines on same infinite line

  // Orientation Constraints
  HORIZONTAL: 'horizontal', // Line is horizontal
  VERTICAL: 'vertical', // Line is vertical

  // Positional Constraints
  MIDPOINT: 'midpoint', // Point at midpoint of line
  SYMMETRIC: 'symmetric', // Entities symmetric about a line
  FIX: 'fix', // Lock entity in place (alias for FIXED)
  FIXED: 'fixed', // Lock entity in place

  // Dimensional Constraints
  LENGTH: 'length', // Line length
  DISTANCE: 'distance', // Distance between points
  RADIUS: 'radius', // Circle/arc radius
  ANGLE: 'angle', // Angle between lines
  DIAMETER: 'diameter', // Circle diameter (2 * radius)
};

/**
 * Constraint symbols for visual display
 */
export const ConstraintSymbols = {
  [ConstraintTypes.COINCIDENT]: '•', // Dot
  [ConstraintTypes.TANGENT]: 'T', // T symbol
  [ConstraintTypes.PERPENDICULAR]: '⊥', // Perpendicular symbol
  [ConstraintTypes.PARALLEL]: '∥', // Parallel symbol
  [ConstraintTypes.EQUAL]: '=', // Equal symbol
  [ConstraintTypes.CONCENTRIC]: '◎', // Concentric circles
  [ConstraintTypes.COLINEAR]: '—', // Colinear (dash)
  [ConstraintTypes.HORIZONTAL]: 'H', // Horizontal
  [ConstraintTypes.VERTICAL]: 'V', // Vertical
  [ConstraintTypes.MIDPOINT]: 'M', // Midpoint
  [ConstraintTypes.SYMMETRIC]: '⧫', // Symmetric diamond
  [ConstraintTypes.FIX]: '📌', // Pin/anchor
  [ConstraintTypes.FIXED]: '📌', // Pin/anchor
};

/**
 * DOF removed by each constraint type
 */
export const ConstraintDOF = {
  [ConstraintTypes.COINCIDENT]: 2,
  [ConstraintTypes.TANGENT]: 1,
  [ConstraintTypes.PERPENDICULAR]: 1,
  [ConstraintTypes.PARALLEL]: 1,
  [ConstraintTypes.EQUAL]: 1,
  [ConstraintTypes.CONCENTRIC]: 2,
  [ConstraintTypes.COLINEAR]: 2,
  [ConstraintTypes.HORIZONTAL]: 1,
  [ConstraintTypes.VERTICAL]: 1,
  [ConstraintTypes.MIDPOINT]: 2,
  [ConstraintTypes.SYMMETRIC]: 2,
  [ConstraintTypes.FIX]: 2,
  [ConstraintTypes.FIXED]: 2,
  [ConstraintTypes.LENGTH]: 1,
  [ConstraintTypes.DISTANCE]: 1,
  [ConstraintTypes.RADIUS]: 1,
  [ConstraintTypes.DIAMETER]: 1,
  [ConstraintTypes.ANGLE]: 1,
};

/**
 * Tolerance values for auto-constraint detection
 */
export const AutoConstraintTolerances = {
  ANGLE_DEGREES: 3.0, // Degrees tolerance for H/V detection
  COINCIDENT_DISTANCE: 2.0, // Units for point coincidence
  TANGENT_DISTANCE: 2.0, // Units for tangent detection
  PARALLEL_ANGLE_DEGREES: 2.0, // Degrees for parallel detection
  PERPENDICULAR_ANGLE_DEGREES: 2.0, // Degrees for perpendicular detection
  EQUAL_LENGTH_PERCENT: 0.02, // 2% tolerance for equal length
  MIDPOINT_PERCENT: 0.03, // 3% tolerance for midpoint detection
};

const EPS = 1e-6;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Check if an angle is near horizontal
 * @param {number} angle - Angle in radians
 * @param {number} toleranceDeg - Tolerance in degrees
 * @returns {boolean}
 */
export const isNearHorizontal = (angle, toleranceDeg = AutoConstraintTolerances.ANGLE_DEGREES) => {
  const normalized = Math.abs(((angle % Math.PI) + Math.PI) % Math.PI);
  const tolerance = toleranceDeg * DEG_TO_RAD;
  return normalized < tolerance || Math.abs(normalized - Math.PI) < tolerance;
};

/**
 * Check if an angle is near vertical
 * @param {number} angle - Angle in radians
 * @param {number} toleranceDeg - Tolerance in degrees
 * @returns {boolean}
 */
export const isNearVertical = (angle, toleranceDeg = AutoConstraintTolerances.ANGLE_DEGREES) => {
  const normalized = ((angle % Math.PI) + Math.PI) % Math.PI;
  const tolerance = toleranceDeg * DEG_TO_RAD;
  return Math.abs(normalized - Math.PI / 2) < tolerance;
};

/**
 * Check if two points are coincident
 * @param {Object} p1 - First point {x, y}
 * @param {Object} p2 - Second point {x, y}
 * @param {number} tolerance - Distance tolerance
 * @returns {boolean}
 */
export const isNearPoint = (
  p1,
  p2,
  tolerance = AutoConstraintTolerances.COINCIDENT_DISTANCE
) => {
  if (!p1 || !p2) return false;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy) <= tolerance;
};

/**
 * Check if two lines are parallel
 * @param {Object} line1 - First line with angle property
 * @param {Object} line2 - Second line with angle property
 * @param {number} toleranceDeg - Tolerance in degrees
 * @returns {boolean}
 */
export const isNearParallel = (
  line1,
  line2,
  toleranceDeg = AutoConstraintTolerances.PARALLEL_ANGLE_DEGREES
) => {
  if (!line1 || !line2) return false;
  const diff = Math.abs(line1.angle - line2.angle) % Math.PI;
  const tolerance = toleranceDeg * DEG_TO_RAD;
  return diff < tolerance || Math.abs(diff - Math.PI) < tolerance;
};

/**
 * Check if two lines are perpendicular
 * @param {Object} line1 - First line with angle property
 * @param {Object} line2 - Second line with angle property
 * @param {number} toleranceDeg - Tolerance in degrees
 * @returns {boolean}
 */
export const isNearPerpendicular = (
  line1,
  line2,
  toleranceDeg = AutoConstraintTolerances.PERPENDICULAR_ANGLE_DEGREES
) => {
  if (!line1 || !line2) return false;
  const diff = Math.abs(line1.angle - line2.angle) % Math.PI;
  const tolerance = toleranceDeg * DEG_TO_RAD;
  return Math.abs(diff - Math.PI / 2) < tolerance;
};

/**
 * Check if two lengths are approximately equal
 * @param {number} len1 - First length
 * @param {number} len2 - Second length
 * @param {number} percentTolerance - Tolerance as decimal (0.02 = 2%)
 * @returns {boolean}
 */
export const isNearEqualLength = (
  len1,
  len2,
  percentTolerance = AutoConstraintTolerances.EQUAL_LENGTH_PERCENT
) => {
  if (len1 < EPS || len2 < EPS) return false;
  const diff = Math.abs(len1 - len2);
  const avg = (len1 + len2) / 2;
  return diff / avg <= percentTolerance;
};

/**
 * Check if a point is near the midpoint of a line
 * @param {Object} point - Point {x, y}
 * @param {Object} line - Line with start and end points
 * @param {number} percentTolerance - Tolerance as decimal
 * @returns {boolean}
 */
export const isNearMidpoint = (
  point,
  line,
  percentTolerance = AutoConstraintTolerances.MIDPOINT_PERCENT
) => {
  if (!point || !line || !line.start || !line.end) return false;
  const midX = (line.start.x + line.end.x) / 2;
  const midY = (line.start.y + line.end.y) / 2;
  const lineLen = line.length || Math.sqrt(
    (line.end.x - line.start.x) ** 2 + (line.end.y - line.start.y) ** 2
  );
  const tolerance = lineLen * percentTolerance;
  const dist = Math.sqrt((point.x - midX) ** 2 + (point.y - midY) ** 2);
  return dist <= tolerance;
};

/**
 * Check if two circles are concentric
 * @param {Object} circle1 - First circle with center
 * @param {Object} circle2 - Second circle with center
 * @param {number} tolerance - Distance tolerance
 * @returns {boolean}
 */
export const isNearConcentric = (
  circle1,
  circle2,
  tolerance = AutoConstraintTolerances.COINCIDENT_DISTANCE
) => {
  if (!circle1?.center || !circle2?.center) return false;
  return isNearPoint(circle1.center, circle2.center, tolerance);
};

/**
 * Check if a line is tangent to a circle
 * @param {Object} line - Line with start, end
 * @param {Object} circle - Circle with center, radius
 * @param {number} tolerance - Distance tolerance
 * @returns {boolean}
 */
export const isNearTangent = (
  line,
  circle,
  tolerance = AutoConstraintTolerances.TANGENT_DISTANCE
) => {
  if (!line || !circle || !circle.center) return false;

  // Calculate distance from circle center to line
  const A = line.end.y - line.start.y;
  const B = line.start.x - line.end.x;
  const C = line.end.x * line.start.y - line.start.x * line.end.y;
  const len = Math.sqrt(A * A + B * B);
  if (len < EPS) return false;

  const dist = Math.abs(A * circle.center.x + B * circle.center.y + C) / len;
  return Math.abs(dist - circle.radius) <= tolerance;
};

/**
 * Check if two lines are colinear
 * @param {Object} line1 - First line
 * @param {Object} line2 - Second line
 * @param {number} tolerance - Distance tolerance
 * @returns {boolean}
 */
export const isNearColinear = (line1, line2, tolerance = 1.0) => {
  if (!line1 || !line2) return false;

  // First check if parallel
  if (!isNearParallel(line1, line2, 1.0)) return false;

  // Then check if line2 endpoints are on line1's infinite extension
  const distStart = pointToInfiniteLineDistance(line2.start, line1);
  const distEnd = pointToInfiniteLineDistance(line2.end, line1);

  return distStart <= tolerance && distEnd <= tolerance;
};

/**
 * Calculate distance from a point to an infinite line
 * @param {Object} point - Point {x, y}
 * @param {Object} line - Line with start and end
 * @returns {number} Distance
 */
const pointToInfiniteLineDistance = (point, line) => {
  const A = line.end.y - line.start.y;
  const B = line.start.x - line.end.x;
  const C = line.end.x * line.start.y - line.start.x * line.end.y;
  const len = Math.sqrt(A * A + B * B);
  if (len < EPS) return Infinity;
  return Math.abs(A * point.x + B * point.y + C) / len;
};

/**
 * Detect potential constraints for a new entity
 * @param {Object} newEntity - The new entity being drawn
 * @param {Object} sketch - The sketch containing existing entities
 * @returns {Array} Array of suggested constraint objects
 */
export const detectPotentialConstraints = (newEntity, sketch) => {
  const suggestions = [];

  if (!newEntity || !sketch) return suggestions;

  // Detect what type of entity this is
  const isLine = newEntity.start && newEntity.end && !newEntity.radius;
  const isCircle = newEntity.center && newEntity.radius && !newEntity.start;
  const isPoint = !isLine && !isCircle && 'x' in newEntity && 'y' in newEntity;

  if (isLine) {
    // Check for near-horizontal
    if (isNearHorizontal(newEntity.angle)) {
      suggestions.push({
        type: ConstraintTypes.HORIZONTAL,
        entities: [newEntity.id],
        confidence: 0.9,
        description: 'Line is nearly horizontal',
      });
    }

    // Check for near-vertical
    if (isNearVertical(newEntity.angle)) {
      suggestions.push({
        type: ConstraintTypes.VERTICAL,
        entities: [newEntity.id],
        confidence: 0.9,
        description: 'Line is nearly vertical',
      });
    }

    // Check for coincident endpoints with existing geometry
    for (const [, entity] of sketch.points || new Map()) {
      if (isNearPoint(newEntity.start, entity)) {
        suggestions.push({
          type: ConstraintTypes.COINCIDENT,
          entities: [newEntity.start.id, entity.id],
          confidence: 0.95,
          description: 'Start point near existing point',
        });
      }
      if (isNearPoint(newEntity.end, entity)) {
        suggestions.push({
          type: ConstraintTypes.COINCIDENT,
          entities: [newEntity.end.id, entity.id],
          confidence: 0.95,
          description: 'End point near existing point',
        });
      }
    }

    // Check against line endpoints
    for (const [, line] of sketch.lines || new Map()) {
      if (line.id === newEntity.id) continue;

      // Check coincident with line endpoints
      if (isNearPoint(newEntity.start, line.start)) {
        suggestions.push({
          type: ConstraintTypes.COINCIDENT,
          entities: [newEntity.start.id, line.start.id],
          confidence: 0.95,
          description: 'Start point coincident with line start',
        });
      }
      if (isNearPoint(newEntity.start, line.end)) {
        suggestions.push({
          type: ConstraintTypes.COINCIDENT,
          entities: [newEntity.start.id, line.end.id],
          confidence: 0.95,
          description: 'Start point coincident with line end',
        });
      }
      if (isNearPoint(newEntity.end, line.start)) {
        suggestions.push({
          type: ConstraintTypes.COINCIDENT,
          entities: [newEntity.end.id, line.start.id],
          confidence: 0.95,
          description: 'End point coincident with line start',
        });
      }
      if (isNearPoint(newEntity.end, line.end)) {
        suggestions.push({
          type: ConstraintTypes.COINCIDENT,
          entities: [newEntity.end.id, line.end.id],
          confidence: 0.95,
          description: 'End point coincident with line end',
        });
      }

      // Check for parallel lines
      if (isNearParallel(newEntity, line)) {
        suggestions.push({
          type: ConstraintTypes.PARALLEL,
          entities: [newEntity.id, line.id],
          confidence: 0.85,
          description: 'Lines are nearly parallel',
        });
      }

      // Check for perpendicular lines
      if (isNearPerpendicular(newEntity, line)) {
        suggestions.push({
          type: ConstraintTypes.PERPENDICULAR,
          entities: [newEntity.id, line.id],
          confidence: 0.85,
          description: 'Lines are nearly perpendicular',
        });
      }

      // Check for equal length
      if (isNearEqualLength(newEntity.length, line.length)) {
        suggestions.push({
          type: ConstraintTypes.EQUAL,
          entities: [newEntity.id, line.id],
          confidence: 0.7,
          description: 'Lines have nearly equal length',
        });
      }

      // Check for colinear
      if (isNearColinear(newEntity, line)) {
        suggestions.push({
          type: ConstraintTypes.COLINEAR,
          entities: [newEntity.id, line.id],
          confidence: 0.8,
          description: 'Lines are nearly colinear',
        });
      }
    }

    // Check for tangent to circles
    for (const [, circle] of sketch.circles || new Map()) {
      if (isNearTangent(newEntity, circle)) {
        suggestions.push({
          type: ConstraintTypes.TANGENT,
          entities: [newEntity.id, circle.id],
          confidence: 0.8,
          description: 'Line is tangent to circle',
        });
      }
    }
  }

  if (isCircle) {
    // Check for concentric circles
    for (const [, circle] of sketch.circles || new Map()) {
      if (circle.id === newEntity.id) continue;

      if (isNearConcentric(newEntity, circle)) {
        suggestions.push({
          type: ConstraintTypes.CONCENTRIC,
          entities: [newEntity.id, circle.id],
          confidence: 0.9,
          description: 'Circles are nearly concentric',
        });
      }

      // Check for equal radius
      if (isNearEqualLength(newEntity.radius, circle.radius)) {
        suggestions.push({
          type: ConstraintTypes.EQUAL,
          entities: [newEntity.id, circle.id],
          confidence: 0.7,
          description: 'Circles have nearly equal radius',
        });
      }
    }

    // Check for center coincident with points
    for (const [, point] of sketch.points || new Map()) {
      if (isNearPoint(newEntity.center, point)) {
        suggestions.push({
          type: ConstraintTypes.COINCIDENT,
          entities: [newEntity.center.id, point.id],
          confidence: 0.95,
          description: 'Center coincident with point',
        });
      }
    }
  }

  if (isPoint) {
    // Check for coincident with existing points
    for (const [, point] of sketch.points || new Map()) {
      if (point.id === newEntity.id) continue;
      if (isNearPoint(newEntity, point)) {
        suggestions.push({
          type: ConstraintTypes.COINCIDENT,
          entities: [newEntity.id, point.id],
          confidence: 0.95,
          description: 'Points are coincident',
        });
      }
    }

    // Check for midpoint on lines
    for (const [, line] of sketch.lines || new Map()) {
      if (isNearMidpoint(newEntity, line)) {
        suggestions.push({
          type: ConstraintTypes.MIDPOINT,
          entities: [newEntity.id, line.id],
          confidence: 0.85,
          description: 'Point is at line midpoint',
        });
      }
    }
  }

  // Sort by confidence (highest first)
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions;
};

/**
 * Filter constraint suggestions to remove conflicts
 * @param {Array} suggestions - Array of constraint suggestions
 * @returns {Array} Filtered suggestions
 */
export const filterConflictingConstraints = suggestions => {
  const filtered = [];
  const usedEntities = new Map(); // Track what constraints each entity has

  for (const suggestion of suggestions) {
    let hasConflict = false;

    // Check for conflicts
    for (const entityId of suggestion.entities) {
      const existing = usedEntities.get(entityId) || [];

      // Horizontal and vertical conflict
      if (
        (suggestion.type === ConstraintTypes.HORIZONTAL &&
          existing.includes(ConstraintTypes.VERTICAL)) ||
        (suggestion.type === ConstraintTypes.VERTICAL &&
          existing.includes(ConstraintTypes.HORIZONTAL))
      ) {
        hasConflict = true;
        break;
      }

      // Parallel and perpendicular conflict (on same pair)
      if (
        (suggestion.type === ConstraintTypes.PARALLEL &&
          existing.includes(ConstraintTypes.PERPENDICULAR)) ||
        (suggestion.type === ConstraintTypes.PERPENDICULAR &&
          existing.includes(ConstraintTypes.PARALLEL))
      ) {
        hasConflict = true;
        break;
      }
    }

    if (!hasConflict) {
      filtered.push(suggestion);

      // Track this constraint for each entity
      for (const entityId of suggestion.entities) {
        const existing = usedEntities.get(entityId) || [];
        existing.push(suggestion.type);
        usedEntities.set(entityId, existing);
      }
    }
  }

  return filtered;
};

export default {
  ConstraintTypes,
  ConstraintSymbols,
  ConstraintDOF,
  AutoConstraintTolerances,
  isNearHorizontal,
  isNearVertical,
  isNearPoint,
  isNearParallel,
  isNearPerpendicular,
  isNearEqualLength,
  isNearMidpoint,
  isNearConcentric,
  isNearTangent,
  isNearColinear,
  detectPotentialConstraints,
  filterConflictingConstraints,
};
