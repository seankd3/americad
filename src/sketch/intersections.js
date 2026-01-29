/**
 * Ameri-CAD Sketch Intersections
 *
 * Provides intersection finding between sketch entities (lines, circles, arcs).
 * Essential for trim and extend operations.
 */

import { SketchPoint, SketchLine, SketchCircle, SketchArc } from './sketch-manager.js';

const EPSILON = 1e-10;

/**
 * Find intersection points between two sketch entities
 * @param {SketchLine|SketchCircle|SketchArc} entity1
 * @param {SketchLine|SketchCircle|SketchArc} entity2
 * @returns {Array<{x: number, y: number}>} Array of intersection points
 */
export function findIntersections(entity1, entity2) {
  // Line-Line
  if (entity1 instanceof SketchLine && entity2 instanceof SketchLine) {
    return lineLineIntersection(entity1, entity2);
  }

  // Line-Circle
  if (entity1 instanceof SketchLine && entity2 instanceof SketchCircle) {
    return lineCircleIntersection(entity1, entity2);
  }
  if (entity1 instanceof SketchCircle && entity2 instanceof SketchLine) {
    return lineCircleIntersection(entity2, entity1);
  }

  // Line-Arc
  if (entity1 instanceof SketchLine && entity2 instanceof SketchArc) {
    return lineArcIntersection(entity1, entity2);
  }
  if (entity1 instanceof SketchArc && entity2 instanceof SketchLine) {
    return lineArcIntersection(entity2, entity1);
  }

  // Circle-Circle
  if (entity1 instanceof SketchCircle && entity2 instanceof SketchCircle) {
    return circleCircleIntersection(entity1, entity2);
  }

  // Circle-Arc
  if (entity1 instanceof SketchCircle && entity2 instanceof SketchArc) {
    return circleArcIntersection(entity1, entity2);
  }
  if (entity1 instanceof SketchArc && entity2 instanceof SketchCircle) {
    return circleArcIntersection(entity2, entity1);
  }

  // Arc-Arc
  if (entity1 instanceof SketchArc && entity2 instanceof SketchArc) {
    return arcArcIntersection(entity1, entity2);
  }

  return [];
}

/**
 * Find all intersections of an entity with all other entities in a sketch
 * @param {SketchLine|SketchCircle|SketchArc} entity
 * @param {Sketch} sketch
 * @returns {Array<{x: number, y: number, t: number, otherEntity: object}>}
 */
export function findAllIntersections(entity, sketch) {
  const intersections = [];

  // Check against all lines
  for (const other of sketch.lines.values()) {
    if (other.id === entity.id) continue;
    if (other.construction) continue;

    const pts = findIntersections(entity, other);
    for (const pt of pts) {
      intersections.push({
        ...pt,
        otherEntity: other,
      });
    }
  }

  // Check against all circles
  for (const other of sketch.circles.values()) {
    if (other.id === entity.id) continue;
    if (other.construction) continue;

    const pts = findIntersections(entity, other);
    for (const pt of pts) {
      intersections.push({
        ...pt,
        otherEntity: other,
      });
    }
  }

  // Check against all arcs
  for (const other of sketch.arcs.values()) {
    if (other.id === entity.id) continue;
    if (other.construction) continue;

    const pts = findIntersections(entity, other);
    for (const pt of pts) {
      intersections.push({
        ...pt,
        otherEntity: other,
      });
    }
  }

  // Sort by parameter along the entity
  if (entity instanceof SketchLine) {
    sortIntersectionsByLineParameter(intersections, entity);
  } else if (entity instanceof SketchArc) {
    sortIntersectionsByArcParameter(intersections, entity);
  }

  return intersections;
}

/**
 * Line-Line intersection
 */
function lineLineIntersection(line1, line2) {
  const x1 = line1.start.x,
    y1 = line1.start.y;
  const x2 = line1.end.x,
    y2 = line1.end.y;
  const x3 = line2.start.x,
    y3 = line2.start.y;
  const x4 = line2.end.x,
    y4 = line2.end.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (Math.abs(denom) < EPSILON) {
    // Lines are parallel or coincident
    return [];
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  // Check if intersection is within both line segments
  if (t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON) {
    const x = x1 + t * (x2 - x1);
    const y = y1 + t * (y2 - y1);
    return [{ x, y, t1: t, t2: u }];
  }

  return [];
}

/**
 * Line-Circle intersection
 */
function lineCircleIntersection(line, circle) {
  const cx = circle.center.x,
    cy = circle.center.y;
  const r = circle.radius;

  const x1 = line.start.x - cx,
    y1 = line.start.y - cy;
  const x2 = line.end.x - cx,
    y2 = line.end.y - cy;

  const dx = x2 - x1;
  const dy = y2 - y1;

  const a = dx * dx + dy * dy;
  const b = 2 * (x1 * dx + y1 * dy);
  const c = x1 * x1 + y1 * y1 - r * r;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < -EPSILON) {
    return [];
  }

  const results = [];

  if (discriminant < EPSILON) {
    // Tangent - one intersection
    const t = -b / (2 * a);
    if (t >= -EPSILON && t <= 1 + EPSILON) {
      results.push({
        x: line.start.x + t * dx,
        y: line.start.y + t * dy,
        t,
      });
    }
  } else {
    // Two intersections
    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    if (t1 >= -EPSILON && t1 <= 1 + EPSILON) {
      results.push({
        x: line.start.x + t1 * (line.end.x - line.start.x),
        y: line.start.y + t1 * (line.end.y - line.start.y),
        t: t1,
      });
    }

    if (t2 >= -EPSILON && t2 <= 1 + EPSILON) {
      results.push({
        x: line.start.x + t2 * (line.end.x - line.start.x),
        y: line.start.y + t2 * (line.end.y - line.start.y),
        t: t2,
      });
    }
  }

  return results;
}

/**
 * Line-Arc intersection
 */
function lineArcIntersection(line, arc) {
  // First find line-circle intersections
  const tempCircle = {
    center: arc.center,
    radius: arc.radius,
  };

  // Create a minimal circle-like object for the intersection function
  const circleIntersections = lineCircleIntersection(line, tempCircle);

  // Filter to only include points actually on the arc
  return circleIntersections.filter(pt => isPointOnArc(pt, arc));
}

/**
 * Circle-Circle intersection
 */
function circleCircleIntersection(circle1, circle2) {
  const x1 = circle1.center.x,
    y1 = circle1.center.y,
    r1 = circle1.radius;
  const x2 = circle2.center.x,
    y2 = circle2.center.y,
    r2 = circle2.radius;

  const d = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));

  // No intersection cases
  if (d > r1 + r2 + EPSILON) return []; // Too far apart
  if (d < Math.abs(r1 - r2) - EPSILON) return []; // One inside the other
  if (d < EPSILON) return []; // Concentric

  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;

  if (h2 < -EPSILON) return [];

  const h = Math.sqrt(Math.max(0, h2));

  // Point P is on line between centers at distance a from circle1 center
  const px = x1 + (a * (x2 - x1)) / d;
  const py = y1 + (a * (y2 - y1)) / d;

  if (h < EPSILON) {
    // Tangent - one intersection
    return [{ x: px, y: py }];
  }

  // Two intersections
  const offsetX = (h * (y2 - y1)) / d;
  const offsetY = (h * (x2 - x1)) / d;

  return [
    { x: px + offsetX, y: py - offsetY },
    { x: px - offsetX, y: py + offsetY },
  ];
}

/**
 * Circle-Arc intersection
 */
function circleArcIntersection(circle, arc) {
  // First find circle-circle intersections treating arc as full circle
  const tempCircle = {
    center: arc.center,
    radius: arc.radius,
  };

  const circleIntersections = circleCircleIntersection(circle, tempCircle);

  // Filter to only include points actually on the arc
  return circleIntersections.filter(pt => isPointOnArc(pt, arc));
}

/**
 * Arc-Arc intersection
 */
function arcArcIntersection(arc1, arc2) {
  // First find circle-circle intersections
  const tempCircle1 = {
    center: arc1.center,
    radius: arc1.radius,
  };
  const tempCircle2 = {
    center: arc2.center,
    radius: arc2.radius,
  };

  const circleIntersections = circleCircleIntersection(tempCircle1, tempCircle2);

  // Filter to only include points actually on both arcs
  return circleIntersections.filter(pt => isPointOnArc(pt, arc1) && isPointOnArc(pt, arc2));
}

/**
 * Check if a point lies on an arc
 */
function isPointOnArc(point, arc) {
  // Calculate the angle from arc center to point
  const angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);

  // Normalize angles to 0-2π
  let startAngle = arc.startAngle;
  let endAngle = arc.endAngle;
  let testAngle = angle;

  // Normalize all angles to [0, 2π)
  while (startAngle < 0) startAngle += 2 * Math.PI;
  while (startAngle >= 2 * Math.PI) startAngle -= 2 * Math.PI;
  while (endAngle < 0) endAngle += 2 * Math.PI;
  while (endAngle >= 2 * Math.PI) endAngle -= 2 * Math.PI;
  while (testAngle < 0) testAngle += 2 * Math.PI;
  while (testAngle >= 2 * Math.PI) testAngle -= 2 * Math.PI;

  // Check if angle is within arc span (handling wrap-around)
  if (arc._clockwise) {
    // Clockwise: goes from start to end going "backwards"
    if (startAngle >= endAngle) {
      return testAngle <= startAngle + EPSILON && testAngle >= endAngle - EPSILON;
    } else {
      return testAngle <= startAngle + EPSILON || testAngle >= endAngle - EPSILON;
    }
  } else {
    // Counter-clockwise: goes from start to end going "forwards"
    if (endAngle >= startAngle) {
      return testAngle >= startAngle - EPSILON && testAngle <= endAngle + EPSILON;
    } else {
      return testAngle >= startAngle - EPSILON || testAngle <= endAngle + EPSILON;
    }
  }
}

/**
 * Sort intersections by parameter along a line (0 at start, 1 at end)
 */
function sortIntersectionsByLineParameter(intersections, line) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const len2 = dx * dx + dy * dy;

  for (const intersection of intersections) {
    const ix = intersection.x - line.start.x;
    const iy = intersection.y - line.start.y;
    intersection.t = (ix * dx + iy * dy) / len2;
  }

  intersections.sort((a, b) => a.t - b.t);
}

/**
 * Sort intersections by parameter along an arc
 */
function sortIntersectionsByArcParameter(intersections, arc) {
  for (const intersection of intersections) {
    const angle = Math.atan2(intersection.y - arc.center.y, intersection.x - arc.center.x);

    // Calculate parameter as fraction along arc
    const startAngle = arc.startAngle;
    let testAngle = angle;

    // Normalize
    while (testAngle < startAngle - Math.PI) testAngle += 2 * Math.PI;
    while (testAngle > startAngle + Math.PI) testAngle -= 2 * Math.PI;

    const sweepAngle = arc.sweepAngle;
    intersection.t = (testAngle - startAngle) / sweepAngle;
  }

  intersections.sort((a, b) => a.t - b.t);
}

/**
 * Find the infinite line extension intersection with entities
 * Used for extend operations
 * @param {SketchLine} line - The line to extend
 * @param {Sketch} sketch - The sketch containing other entities
 * @param {string} direction - 'start' or 'end' indicating which end to extend
 * @returns {Array<{x: number, y: number, distance: number, otherEntity: object}>}
 */
export function findExtensionIntersections(line, sketch, direction) {
  const intersections = [];

  // Get line direction vector
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < EPSILON) return [];

  // Normalize direction
  const ux = dx / len;
  const uy = dy / len;

  // Create an extended line for intersection testing
  const extensionLength = 10000; // Large extension
  let extendedLine;

  if (direction === 'start') {
    // Extend backward from start
    extendedLine = {
      start: {
        x: line.start.x - ux * extensionLength,
        y: line.start.y - uy * extensionLength,
      },
      end: line.start,
    };
  } else {
    // Extend forward from end
    extendedLine = {
      start: line.end,
      end: {
        x: line.end.x + ux * extensionLength,
        y: line.end.y + uy * extensionLength,
      },
    };
  }

  // Create a temporary SketchLine for intersection testing
  const tempLine = new SketchLine(
    new SketchPoint(extendedLine.start.x, extendedLine.start.y),
    new SketchPoint(extendedLine.end.x, extendedLine.end.y)
  );

  // Test against all other entities
  for (const other of sketch.lines.values()) {
    if (other.id === line.id) continue;
    if (other.construction) continue;

    const pts = lineLineIntersection(tempLine, other);
    for (const pt of pts) {
      const dist = Math.sqrt(
        Math.pow(pt.x - (direction === 'start' ? line.start.x : line.end.x), 2) +
          Math.pow(pt.y - (direction === 'start' ? line.start.y : line.end.y), 2)
      );
      intersections.push({
        ...pt,
        distance: dist,
        otherEntity: other,
      });
    }
  }

  for (const other of sketch.circles.values()) {
    if (other.construction) continue;

    const pts = lineCircleIntersection(tempLine, other);
    for (const pt of pts) {
      // Check that the intersection is in the extension direction
      const toPoint = {
        x: pt.x - (direction === 'start' ? line.start.x : line.end.x),
        y: pt.y - (direction === 'start' ? line.start.y : line.end.y),
      };
      const dot =
        toPoint.x * (direction === 'start' ? -ux : ux) +
        toPoint.y * (direction === 'start' ? -uy : uy);

      if (dot > EPSILON) {
        const dist = Math.sqrt(toPoint.x * toPoint.x + toPoint.y * toPoint.y);
        intersections.push({
          ...pt,
          distance: dist,
          otherEntity: other,
        });
      }
    }
  }

  for (const other of sketch.arcs.values()) {
    if (other.construction) continue;

    const pts = lineArcIntersection(tempLine, other);
    for (const pt of pts) {
      const toPoint = {
        x: pt.x - (direction === 'start' ? line.start.x : line.end.x),
        y: pt.y - (direction === 'start' ? line.start.y : line.end.y),
      };
      const dot =
        toPoint.x * (direction === 'start' ? -ux : ux) +
        toPoint.y * (direction === 'start' ? -uy : uy);

      if (dot > EPSILON) {
        const dist = Math.sqrt(toPoint.x * toPoint.x + toPoint.y * toPoint.y);
        intersections.push({
          ...pt,
          distance: dist,
          otherEntity: other,
        });
      }
    }
  }

  // Sort by distance
  intersections.sort((a, b) => a.distance - b.distance);

  return intersections;
}

/**
 * Get the parameter t for a point on a line (0 = start, 1 = end)
 */
export function getLineParameter(line, point) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const len2 = dx * dx + dy * dy;

  if (len2 < EPSILON) return 0;

  const px = point.x - line.start.x;
  const py = point.y - line.start.y;

  return (px * dx + py * dy) / len2;
}

/**
 * Calculate distance from a point to a line segment
 */
export function pointToLineDistance(point, line) {
  const A = point.x - line.start.x;
  const B = point.y - line.start.y;
  const C = line.end.x - line.start.x;
  const D = line.end.y - line.start.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq > EPSILON) {
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

  return Math.sqrt((point.x - xx) * (point.x - xx) + (point.y - yy) * (point.y - yy));
}

export default {
  findIntersections,
  findAllIntersections,
  findExtensionIntersections,
  getLineParameter,
  pointToLineDistance,
};
