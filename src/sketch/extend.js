/**
 * Ameri-CAD Sketch Extend Operations
 *
 * Provides extend functionality for sketch entities.
 * Extend lengthens an entity until it intersects with another entity.
 */

import { SketchLine, SketchArc } from './sketch-manager.js';
import { findExtensionIntersections } from './intersections.js';

const EPSILON = 1e-10;

/**
 * Extend an entity toward another entity
 *
 * @param {SketchLine|SketchArc} entity - The entity to extend
 * @param {{x: number, y: number}} clickPoint - Where the user clicked (determines which end)
 * @param {Sketch} sketch - The parent sketch
 * @returns {{success: boolean, extended: object, newEndpoint: {x, y}, error?: string}}
 */
export function extendEntity(entity, clickPoint, sketch) {
  if (entity instanceof SketchLine) {
    return extendLine(entity, clickPoint, sketch);
  } else if (entity instanceof SketchArc) {
    return extendArc(entity, clickPoint, sketch);
  }

  return {
    success: false,
    error: `Cannot extend entity of type ${entity.constructor.name}`,
  };
}

/**
 * Extend a line to the nearest intersecting entity
 */
function extendLine(line, clickPoint, sketch) {
  // Determine which end to extend based on click location
  const distToStart = Math.sqrt(
    Math.pow(clickPoint.x - line.start.x, 2) + Math.pow(clickPoint.y - line.start.y, 2)
  );
  const distToEnd = Math.sqrt(
    Math.pow(clickPoint.x - line.end.x, 2) + Math.pow(clickPoint.y - line.end.y, 2)
  );

  const direction = distToStart < distToEnd ? 'start' : 'end';

  // Find extension intersections
  const intersections = findExtensionIntersections(line, sketch, direction);

  if (intersections.length === 0) {
    return {
      success: false,
      error: `No boundary found to extend ${direction} to`,
    };
  }

  // Get the nearest intersection
  const nearest = intersections[0];

  // Update the line endpoint
  const oldEndpoint = direction === 'start' ? { x: line.start.x, y: line.start.y } : { x: line.end.x, y: line.end.y };

  if (direction === 'start') {
    line.start.x = nearest.x;
    line.start.y = nearest.y;
  } else {
    line.end.x = nearest.x;
    line.end.y = nearest.y;
  }

  return {
    success: true,
    extended: line,
    direction,
    oldEndpoint,
    newEndpoint: { x: nearest.x, y: nearest.y },
    boundaryEntity: nearest.otherEntity,
    distance: nearest.distance,
  };
}

/**
 * Extend an arc to the nearest intersecting entity
 */
function extendArc(arc, clickPoint, sketch) {
  // Determine which end to extend based on click location
  const distToStart = Math.sqrt(
    Math.pow(clickPoint.x - arc.start.x, 2) + Math.pow(clickPoint.y - arc.start.y, 2)
  );
  const distToEnd = Math.sqrt(
    Math.pow(clickPoint.x - arc.end.x, 2) + Math.pow(clickPoint.y - arc.end.y, 2)
  );

  const direction = distToStart < distToEnd ? 'start' : 'end';

  // For arcs, we need to find intersections along the circular path
  const intersections = findArcExtensionIntersections(arc, sketch, direction);

  if (intersections.length === 0) {
    return {
      success: false,
      error: `No boundary found to extend arc ${direction} to`,
    };
  }

  // Get the nearest intersection
  const nearest = intersections[0];

  // Store old endpoint
  const oldEndpoint =
    direction === 'start' ? { x: arc.start.x, y: arc.start.y } : { x: arc.end.x, y: arc.end.y };

  // Update the arc endpoint
  // Note: This modifies the three-point arc definition
  if (direction === 'start') {
    arc.start.x = nearest.x;
    arc.start.y = nearest.y;
    // Recompute the arc's circle parameters
    arc._computeCircle();
  } else {
    arc.end.x = nearest.x;
    arc.end.y = nearest.y;
    // Recompute the arc's circle parameters
    arc._computeCircle();
  }

  return {
    success: true,
    extended: arc,
    direction,
    oldEndpoint,
    newEndpoint: { x: nearest.x, y: nearest.y },
    boundaryEntity: nearest.otherEntity,
    angularDistance: nearest.angularDistance,
  };
}

/**
 * Find intersections for arc extension
 */
function findArcExtensionIntersections(arc, sketch, direction) {
  const intersections = [];
  const center = arc.center;

  // Test against all lines
  for (const line of sketch.lines.values()) {
    if (line.construction) continue;

    const pts = arcLineExtensionIntersections(arc, line, direction);
    for (const pt of pts) {
      intersections.push({
        ...pt,
        otherEntity: line,
      });
    }
  }

  // Test against all circles
  for (const circle of sketch.circles.values()) {
    if (circle.construction) continue;

    const pts = arcCircleExtensionIntersections(arc, circle, direction);
    for (const pt of pts) {
      intersections.push({
        ...pt,
        otherEntity: circle,
      });
    }
  }

  // Test against all other arcs
  for (const other of sketch.arcs.values()) {
    if (other.id === arc.id) continue;
    if (other.construction) continue;

    const pts = arcArcExtensionIntersections(arc, other, direction);
    for (const pt of pts) {
      intersections.push({
        ...pt,
        otherEntity: other,
      });
    }
  }

  // Sort by angular distance from the arc endpoint
  const endpointAngle = direction === 'start' ? arc.startAngle : arc.endAngle;

  for (const int of intersections) {
    const intAngle = Math.atan2(int.y - center.y, int.x - center.x);
    let angularDist = intAngle - endpointAngle;

    // Normalize based on extension direction
    if (direction === 'start') {
      if (arc._clockwise) {
        while (angularDist < 0) angularDist += 2 * Math.PI;
        while (angularDist > 2 * Math.PI) angularDist -= 2 * Math.PI;
      } else {
        while (angularDist > 0) angularDist -= 2 * Math.PI;
        while (angularDist < -2 * Math.PI) angularDist += 2 * Math.PI;
        angularDist = Math.abs(angularDist);
      }
    } else {
      if (arc._clockwise) {
        while (angularDist > 0) angularDist -= 2 * Math.PI;
        while (angularDist < -2 * Math.PI) angularDist += 2 * Math.PI;
        angularDist = Math.abs(angularDist);
      } else {
        while (angularDist < 0) angularDist += 2 * Math.PI;
        while (angularDist > 2 * Math.PI) angularDist -= 2 * Math.PI;
      }
    }

    int.angularDistance = angularDist;
  }

  // Filter out points that would decrease the arc (going backwards)
  // and sort by angular distance
  intersections.sort((a, b) => a.angularDistance - b.angularDistance);

  // Only return intersections that actually extend the arc
  return intersections.filter(int => int.angularDistance > EPSILON && int.angularDistance < Math.PI);
}

/**
 * Find intersections between an arc extension and a line
 */
function arcLineExtensionIntersections(arc, line, direction) {
  const intersections = [];
  const center = arc.center;
  const radius = arc.radius;

  // Line-circle intersection
  const x1 = line.start.x - center.x;
  const y1 = line.start.y - center.y;
  const x2 = line.end.x - center.x;
  const y2 = line.end.y - center.y;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const a = dx * dx + dy * dy;
  const b = 2 * (x1 * dx + y1 * dy);
  const c = x1 * x1 + y1 * y1 - radius * radius;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) return [];

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  for (const t of [t1, t2]) {
    if (t >= -EPSILON && t <= 1 + EPSILON) {
      const x = line.start.x + t * (line.end.x - line.start.x);
      const y = line.start.y + t * (line.end.y - line.start.y);

      // Check if point is in the extension direction (not on the existing arc)
      const angle = Math.atan2(y - center.y, x - center.x);
      if (isAngleInExtension(angle, arc, direction)) {
        intersections.push({ x, y });
      }
    }
  }

  return intersections;
}

/**
 * Find intersections between an arc extension and a circle
 */
function arcCircleExtensionIntersections(arc, circle, direction) {
  const intersections = [];
  const center1 = arc.center;
  const r1 = arc.radius;
  const center2 = circle.center;
  const r2 = circle.radius;

  const d = Math.sqrt(
    Math.pow(center2.x - center1.x, 2) + Math.pow(center2.y - center1.y, 2)
  );

  if (d > r1 + r2 + EPSILON || d < Math.abs(r1 - r2) - EPSILON || d < EPSILON) {
    return [];
  }

  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < 0) return [];

  const h = Math.sqrt(h2);

  const px = center1.x + (a * (center2.x - center1.x)) / d;
  const py = center1.y + (a * (center2.y - center1.y)) / d;

  const offsetX = (h * (center2.y - center1.y)) / d;
  const offsetY = (h * (center2.x - center1.x)) / d;

  const pts =
    h < EPSILON
      ? [{ x: px, y: py }]
      : [
          { x: px + offsetX, y: py - offsetY },
          { x: px - offsetX, y: py + offsetY },
        ];

  for (const pt of pts) {
    const angle = Math.atan2(pt.y - center1.y, pt.x - center1.x);
    if (isAngleInExtension(angle, arc, direction)) {
      intersections.push(pt);
    }
  }

  return intersections;
}

/**
 * Find intersections between an arc extension and another arc
 */
function arcArcExtensionIntersections(arc, other, direction) {
  // First find circle-circle intersections
  const circleIntersections = arcCircleExtensionIntersections(
    arc,
    { center: other.center, radius: other.radius },
    direction
  );

  // Filter to only include points actually on the other arc
  return circleIntersections.filter(pt => isPointOnArc(pt, other));
}

/**
 * Check if an angle is in the extension direction of an arc
 */
function isAngleInExtension(angle, arc, direction) {
  // Normalize angle
  const testAngle = angle;
  const startAngle = arc.startAngle;
  const endAngle = arc.endAngle;

  // Check if angle is NOT on the existing arc but IS in extension direction
  // First, normalize everything to be comparable

  // Check if angle is on the existing arc
  const isOnArc = isAngleOnArc(testAngle, arc);

  if (isOnArc) {
    return false; // Can't extend to a point already on the arc
  }

  // Check if it's in the extension direction
  if (direction === 'start') {
    // Extending from start - check if angle is "before" the start in the arc direction
    if (arc._clockwise) {
      // Clockwise: angle should be greater than startAngle
      let diff = testAngle - startAngle;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      return diff > EPSILON;
    } else {
      // Counter-clockwise: angle should be less than startAngle
      let diff = startAngle - testAngle;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      return diff > EPSILON;
    }
  } else {
    // Extending from end
    if (arc._clockwise) {
      // Clockwise: angle should be less than endAngle
      let diff = endAngle - testAngle;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      return diff > EPSILON;
    } else {
      // Counter-clockwise: angle should be greater than endAngle
      let diff = testAngle - endAngle;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      return diff > EPSILON;
    }
  }
}

/**
 * Check if an angle is on the arc's span
 */
function isAngleOnArc(angle, arc) {
  let testAngle = angle;
  const startAngle = arc.startAngle;

  // Normalize test angle relative to start
  while (testAngle < startAngle - Math.PI) testAngle += 2 * Math.PI;
  while (testAngle > startAngle + Math.PI) testAngle -= 2 * Math.PI;

  const diff = testAngle - startAngle;

  if (arc._clockwise) {
    // Clockwise means we go from startAngle decreasing to endAngle
    let sweep = startAngle - arc.endAngle;
    while (sweep < 0) sweep += 2 * Math.PI;
    return diff <= EPSILON && diff >= -sweep - EPSILON;
  } else {
    // Counter-clockwise
    const sweep = arc.sweepAngle;
    return diff >= -EPSILON && diff <= sweep + EPSILON;
  }
}

/**
 * Check if a point lies on an arc
 */
function isPointOnArc(point, arc) {
  const angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);

  // Check distance from center
  const dist = Math.sqrt(
    Math.pow(point.x - arc.center.x, 2) + Math.pow(point.y - arc.center.y, 2)
  );
  if (Math.abs(dist - arc.radius) > 0.001) return false;

  return isAngleOnArc(angle, arc);
}

/**
 * Extend a line by a fixed amount (when no boundary exists)
 * @param {SketchLine} line
 * @param {string} direction - 'start' or 'end'
 * @param {number} amount - Distance to extend
 */
export function extendLineByAmount(line, direction, amount) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < EPSILON) return null;

  const ux = dx / len;
  const uy = dy / len;

  if (direction === 'start') {
    line.start.x -= ux * amount;
    line.start.y -= uy * amount;
  } else {
    line.end.x += ux * amount;
    line.end.y += uy * amount;
  }

  return line;
}

export default {
  extendEntity,
  extendLineByAmount,
};
