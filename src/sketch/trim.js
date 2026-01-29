/**
 * Ameri-CAD Sketch Trim Operations
 *
 * Provides trim functionality for sketch entities.
 * Trim removes the clicked portion of an entity between intersections.
 */

import { SketchLine, SketchArc } from './sketch-manager.js';
import { findAllIntersections, getLineParameter, pointToLineDistance } from './intersections.js';

const EPSILON = 1e-10;

/**
 * Trim an entity at the clicked point
 * Removes the segment containing the click point, keeps the rest
 *
 * @param {SketchLine|SketchArc} entity - The entity to trim
 * @param {{x: number, y: number}} clickPoint - Where the user clicked
 * @param {Sketch} sketch - The parent sketch
 * @returns {{success: boolean, removed: object, kept: Array<object>, error?: string}}
 */
export function trimEntity(entity, clickPoint, sketch) {
  if (entity instanceof SketchLine) {
    return trimLine(entity, clickPoint, sketch);
  } else if (entity instanceof SketchArc) {
    return trimArc(entity, clickPoint, sketch);
  }

  return {
    success: false,
    error: `Cannot trim entity of type ${entity.constructor.name}`,
  };
}

/**
 * Trim a line at intersections
 */
function trimLine(line, clickPoint, sketch) {
  // Find all intersections
  const intersections = findAllIntersections(line, sketch);

  if (intersections.length === 0) {
    return {
      success: false,
      error: 'No intersections found to trim at',
    };
  }

  // Add virtual intersections at line endpoints (t=0 and t=1)
  const allPoints = [
    { x: line.start.x, y: line.start.y, t: 0, isEndpoint: true },
    ...intersections,
    { x: line.end.x, y: line.end.y, t: 1, isEndpoint: true },
  ];

  // Sort by parameter t
  allPoints.sort((a, b) => a.t - b.t);

  // Remove duplicates (very close points)
  const uniquePoints = [allPoints[0]];
  for (let i = 1; i < allPoints.length; i++) {
    const prev = uniquePoints[uniquePoints.length - 1];
    const curr = allPoints[i];
    const dist = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
    if (dist > 0.001) {
      uniquePoints.push(curr);
    }
  }

  // Find the parameter of the click point on the line
  const clickT = getLineParameter(line, clickPoint);

  // Find which segment contains the click point
  let clickedSegmentIndex = -1;
  for (let i = 0; i < uniquePoints.length - 1; i++) {
    const t1 = uniquePoints[i].t;
    const t2 = uniquePoints[i + 1].t;
    if (clickT >= t1 - EPSILON && clickT <= t2 + EPSILON) {
      clickedSegmentIndex = i;
      break;
    }
  }

  if (clickedSegmentIndex === -1) {
    // Click was outside the line - find nearest segment
    clickedSegmentIndex = 0;
    let minDist = Infinity;
    for (let i = 0; i < uniquePoints.length - 1; i++) {
      const midT = (uniquePoints[i].t + uniquePoints[i + 1].t) / 2;
      const midX = line.start.x + midT * (line.end.x - line.start.x);
      const midY = line.start.y + midT * (line.end.y - line.start.y);
      const dist = Math.sqrt(Math.pow(clickPoint.x - midX, 2) + Math.pow(clickPoint.y - midY, 2));
      if (dist < minDist) {
        minDist = dist;
        clickedSegmentIndex = i;
      }
    }
  }

  // Build the segments to keep (all except the clicked one)
  const keptSegments = [];

  for (let i = 0; i < uniquePoints.length - 1; i++) {
    if (i === clickedSegmentIndex) continue;

    const p1 = uniquePoints[i];
    const p2 = uniquePoints[i + 1];

    // Create a new line segment
    const newLine = sketch.addLine(p1.x, p1.y, p2.x, p2.y);
    newLine.construction = line.construction;
    keptSegments.push(newLine);
  }

  // Store info about the removed segment
  const removed = {
    startT: uniquePoints[clickedSegmentIndex].t,
    endT: uniquePoints[clickedSegmentIndex + 1].t,
    start: { x: uniquePoints[clickedSegmentIndex].x, y: uniquePoints[clickedSegmentIndex].y },
    end: { x: uniquePoints[clickedSegmentIndex + 1].x, y: uniquePoints[clickedSegmentIndex + 1].y },
  };

  // Remove the original line
  removeEntityFromSketch(line, sketch);

  return {
    success: true,
    removed,
    kept: keptSegments,
    intersectionCount: intersections.length,
  };
}

/**
 * Trim an arc at intersections
 */
function trimArc(arc, clickPoint, sketch) {
  // Find all intersections
  const intersections = findAllIntersections(arc, sketch);

  if (intersections.length === 0) {
    return {
      success: false,
      error: 'No intersections found to trim at',
    };
  }

  // Calculate angle parameters for all points
  const getAngleParam = (x, y) => {
    const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
    // Normalize relative to start angle
    let param = angle - arc.startAngle;
    while (param < 0) param += 2 * Math.PI;
    while (param > 2 * Math.PI) param -= 2 * Math.PI;

    // Convert to 0-1 parameter
    return param / arc.sweepAngle;
  };

  // Build list of all division points
  const allPoints = [
    { x: arc.start.x, y: arc.start.y, t: 0, isEndpoint: true },
    ...intersections.map(int => ({
      x: int.x,
      y: int.y,
      t: getAngleParam(int.x, int.y),
    })),
    { x: arc.end.x, y: arc.end.y, t: 1, isEndpoint: true },
  ];

  // Sort by parameter
  allPoints.sort((a, b) => a.t - b.t);

  // Remove duplicates
  const uniquePoints = [allPoints[0]];
  for (let i = 1; i < allPoints.length; i++) {
    const prev = uniquePoints[uniquePoints.length - 1];
    const curr = allPoints[i];
    if (Math.abs(curr.t - prev.t) > 0.001) {
      uniquePoints.push(curr);
    }
  }

  // Find click point parameter
  const clickT = getAngleParam(clickPoint.x, clickPoint.y);

  // Find which segment was clicked
  let clickedSegmentIndex = -1;
  for (let i = 0; i < uniquePoints.length - 1; i++) {
    const t1 = uniquePoints[i].t;
    const t2 = uniquePoints[i + 1].t;
    if (clickT >= t1 - EPSILON && clickT <= t2 + EPSILON) {
      clickedSegmentIndex = i;
      break;
    }
  }

  if (clickedSegmentIndex === -1) {
    // Find nearest segment
    clickedSegmentIndex = 0;
    let minDist = Infinity;
    for (let i = 0; i < uniquePoints.length - 1; i++) {
      const midT = (uniquePoints[i].t + uniquePoints[i + 1].t) / 2;
      const dist = Math.abs(midT - clickT);
      if (dist < minDist) {
        minDist = dist;
        clickedSegmentIndex = i;
      }
    }
  }

  // Create kept arc segments
  const keptSegments = [];

  for (let i = 0; i < uniquePoints.length - 1; i++) {
    if (i === clickedSegmentIndex) continue;

    const p1 = uniquePoints[i];
    const p2 = uniquePoints[i + 1];

    // Calculate midpoint for three-point arc
    const midT = (p1.t + p2.t) / 2;
    const midAngle = arc.startAngle + midT * arc.sweepAngle;
    const midX = arc.center.x + arc.radius * Math.cos(midAngle);
    const midY = arc.center.y + arc.radius * Math.sin(midAngle);

    const newArc = sketch.addArc(p1.x, p1.y, midX, midY, p2.x, p2.y);
    newArc.construction = arc.construction;
    keptSegments.push(newArc);
  }

  // Store removed segment info
  const removed = {
    startT: uniquePoints[clickedSegmentIndex].t,
    endT: uniquePoints[clickedSegmentIndex + 1].t,
  };

  // Remove original arc
  removeEntityFromSketch(arc, sketch);

  return {
    success: true,
    removed,
    kept: keptSegments,
    intersectionCount: intersections.length,
  };
}

/**
 * Remove an entity and its associated points from a sketch
 */
function removeEntityFromSketch(entity, sketch) {
  if (entity instanceof SketchLine) {
    // Remove associated points if not shared
    const startId = entity.start.id;
    const endId = entity.end.id;

    sketch.lines.delete(entity.id);

    // Check if points are used by other entities
    if (!isPointUsed(startId, sketch)) {
      sketch.points.delete(startId);
    }
    if (!isPointUsed(endId, sketch)) {
      sketch.points.delete(endId);
    }
  } else if (entity instanceof SketchArc) {
    const startId = entity.start.id;
    const midId = entity.mid.id;
    const endId = entity.end.id;

    sketch.arcs.delete(entity.id);

    if (!isPointUsed(startId, sketch)) {
      sketch.points.delete(startId);
    }
    if (!isPointUsed(midId, sketch)) {
      sketch.points.delete(midId);
    }
    if (!isPointUsed(endId, sketch)) {
      sketch.points.delete(endId);
    }
  }

  // Remove any constraints involving this entity
  const constraintsToRemove = [];
  sketch.constraints.forEach((constraint, id) => {
    if (constraint.entities.includes(entity.id)) {
      constraintsToRemove.push(id);
    }
  });
  constraintsToRemove.forEach(id => sketch.constraints.delete(id));
}

/**
 * Check if a point is used by any entity in the sketch
 */
function isPointUsed(pointId, sketch) {
  // Check lines
  for (const line of sketch.lines.values()) {
    if (line.start.id === pointId || line.end.id === pointId) {
      return true;
    }
  }

  // Check circles
  for (const circle of sketch.circles.values()) {
    if (circle.center.id === pointId) {
      return true;
    }
  }

  // Check arcs
  for (const arc of sketch.arcs.values()) {
    if (arc.start.id === pointId || arc.mid.id === pointId || arc.end.id === pointId) {
      return true;
    }
  }

  // Check splines
  for (const spline of sketch.splines.values()) {
    for (const pt of spline.controlPoints) {
      if (pt.id === pointId) {
        return true;
      }
    }
  }

  // Check rectangles
  for (const rect of sketch.rectangles.values()) {
    if (
      rect.p1.id === pointId ||
      rect.p2.id === pointId ||
      rect.p3.id === pointId ||
      rect.p4.id === pointId
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Find the entity nearest to a click point
 * @param {{x: number, y: number}} clickPoint
 * @param {Sketch} sketch
 * @param {number} tolerance
 * @returns {{entity: object, distance: number}|null}
 */
export function findNearestEntity(clickPoint, sketch, tolerance = 10) {
  let nearest = null;
  let minDistance = tolerance;

  // Check lines
  for (const line of sketch.lines.values()) {
    if (line.construction) continue;
    const dist = pointToLineDistance(clickPoint, line);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = { entity: line, distance: dist };
    }
  }

  // Check circles
  for (const circle of sketch.circles.values()) {
    if (circle.construction) continue;
    const dist = Math.abs(
      Math.sqrt(
        Math.pow(clickPoint.x - circle.center.x, 2) + Math.pow(clickPoint.y - circle.center.y, 2)
      ) - circle.radius
    );
    if (dist < minDistance) {
      minDistance = dist;
      nearest = { entity: circle, distance: dist };
    }
  }

  // Check arcs
  for (const arc of sketch.arcs.values()) {
    if (arc.construction) continue;
    // Check distance to arc (point must be on arc)
    const distToCenter = Math.sqrt(
      Math.pow(clickPoint.x - arc.center.x, 2) + Math.pow(clickPoint.y - arc.center.y, 2)
    );
    const distToArc = Math.abs(distToCenter - arc.radius);

    // Note: Could also verify the point is within the arc's angular span
    // but for now we use distance-based selection

    if (distToArc < minDistance) {
      minDistance = distToArc;
      nearest = { entity: arc, distance: distToArc };
    }
  }

  return nearest;
}

export default {
  trimEntity,
  findNearestEntity,
};
