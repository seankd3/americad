/**
 * Ameri-CAD Snap Manager
 *
 * Intelligent snapping system for precise geometry alignment.
 * Supports multiple snap types with visual feedback.
 */

import { SketchPoint } from '../sketch/sketch-manager.js';

// Snap types with priority (lower = higher priority)
export const SnapType = {
  ENDPOINT: { name: 'Endpoint', color: 0x00ff00, priority: 1, shape: 'square' },
  MIDPOINT: { name: 'Midpoint', color: 0x00ffff, priority: 2, shape: 'triangle' },
  CENTER: { name: 'Center', color: 0xff00ff, priority: 3, shape: 'circle' },
  INTERSECTION: { name: 'Intersection', color: 0xffff00, priority: 4, shape: 'cross' },
  PERPENDICULAR: { name: 'Perpendicular', color: 0xff8800, priority: 5, shape: 'square' },
  TANGENT: { name: 'Tangent', color: 0x88ff00, priority: 6, shape: 'circle' },
  NEAREST: { name: 'Nearest', color: 0x8888ff, priority: 7, shape: 'diamond' },
  GRID: { name: 'Grid', color: 0x666666, priority: 10, shape: 'dot' },
};

/**
 * Result of a snap operation
 */
export class SnapResult {
  constructor(point, type, entity = null, distance = 0) {
    this.point = point; // SketchPoint - snapped position
    this.type = type; // SnapType
    this.entity = entity; // Reference to snapped entity (if any)
    this.distance = distance; // Distance from original point
  }
}

/**
 * Snap Manager - handles all snapping logic
 */
export class SnapManager {
  constructor() {
    // Snap type toggles
    this.enabled = {
      grid: true,
      endpoint: true,
      midpoint: true,
      center: true,
      intersection: true,
      perpendicular: false, // Can be slow, disabled by default
      tangent: false, // Can be slow, disabled by default
      nearest: true,
    };

    // Settings
    this.gridSize = 5;
    this.tolerance = 10; // Snap tolerance in screen pixels
    this.active = true; // Master toggle

    // Current snap state (for rendering)
    this.currentSnap = null;

    // Callbacks
    this.onSnapChange = null;
  }

  /**
   * Toggle all snapping on/off
   */
  setActive(active) {
    this.active = active;
    this.currentSnap = null;
    this._notifyChange();
  }

  /**
   * Toggle a specific snap type
   */
  setEnabled(type, enabled) {
    if (type in this.enabled) {
      this.enabled[type] = enabled;
      this._notifyChange();
    }
  }

  /**
   * Set grid size
   */
  setGridSize(size) {
    this.gridSize = Math.max(0.1, size);
    this._notifyChange();
  }

  /**
   * Set snap tolerance
   */
  setTolerance(tolerance) {
    this.tolerance = Math.max(1, tolerance);
  }

  /**
   * Find the best snap point for a given position
   * @param {SketchPoint} mousePos - Current mouse position in sketch coords
   * @param {Sketch} sketch - Active sketch with entities
   * @param {number} screenTolerance - Tolerance in screen units (optional override)
   * @returns {SnapResult|null} Best snap result or null
   */
  findSnapPoint(mousePos, sketch, screenTolerance = null) {
    if (!this.active || !sketch) {
      this.currentSnap = null;
      return null;
    }

    const tolerance = screenTolerance || this.tolerance;
    const candidates = [];

    // Collect all snap candidates
    if (this.enabled.endpoint) {
      candidates.push(...this._findEndpoints(mousePos, sketch, tolerance));
    }

    if (this.enabled.midpoint) {
      candidates.push(...this._findMidpoints(mousePos, sketch, tolerance));
    }

    if (this.enabled.center) {
      candidates.push(...this._findCenters(mousePos, sketch, tolerance));
    }

    if (this.enabled.intersection) {
      candidates.push(...this._findIntersections(mousePos, sketch, tolerance));
    }

    if (this.enabled.perpendicular) {
      candidates.push(...this._findPerpendiculars(mousePos, sketch, tolerance));
    }

    if (this.enabled.nearest) {
      candidates.push(...this._findNearest(mousePos, sketch, tolerance));
    }

    // Grid snap (lowest priority, fallback)
    if (this.enabled.grid && candidates.length === 0) {
      const gridSnap = this._findGridSnap(mousePos);
      if (gridSnap) {
        candidates.push(gridSnap);
      }
    }

    // Sort by priority (lower = better), then by distance
    candidates.sort((a, b) => {
      if (a.type.priority !== b.type.priority) {
        return a.type.priority - b.type.priority;
      }
      return a.distance - b.distance;
    });

    // Return best candidate
    this.currentSnap = candidates.length > 0 ? candidates[0] : null;
    return this.currentSnap;
  }

  /**
   * Find endpoint snaps (vertices of lines, arcs, etc.)
   */
  _findEndpoints(mousePos, sketch, tolerance) {
    const results = [];

    // Check all points
    for (const point of sketch.points.values()) {
      const dist = this._distance(mousePos, point);
      if (dist <= tolerance) {
        results.push(
          new SnapResult(new SketchPoint(point.x, point.y), SnapType.ENDPOINT, point, dist)
        );
      }
    }

    return results;
  }

  /**
   * Find midpoint snaps
   */
  _findMidpoints(mousePos, sketch, tolerance) {
    const results = [];

    // Line midpoints
    for (const line of sketch.lines.values()) {
      const midX = (line.start.x + line.end.x) / 2;
      const midY = (line.start.y + line.end.y) / 2;
      const mid = new SketchPoint(midX, midY);

      const dist = this._distance(mousePos, mid);
      if (dist <= tolerance) {
        results.push(new SnapResult(mid, SnapType.MIDPOINT, line, dist));
      }
    }

    // Arc midpoints (point at middle of arc)
    for (const arc of sketch.arcs.values()) {
      if (arc.center && arc.radius) {
        const midAngle = arc._clockwise
          ? arc.startAngle - arc.sweepAngle / 2
          : arc.startAngle + arc.sweepAngle / 2;

        const midX = arc.center.x + arc.radius * Math.cos(midAngle);
        const midY = arc.center.y + arc.radius * Math.sin(midAngle);
        const mid = new SketchPoint(midX, midY);

        const dist = this._distance(mousePos, mid);
        if (dist <= tolerance) {
          results.push(new SnapResult(mid, SnapType.MIDPOINT, arc, dist));
        }
      }
    }

    return results;
  }

  /**
   * Find center snaps (circle/arc centers)
   */
  _findCenters(mousePos, sketch, tolerance) {
    const results = [];

    // Circle centers
    for (const circle of sketch.circles.values()) {
      const dist = this._distance(mousePos, circle.center);
      if (dist <= tolerance) {
        results.push(
          new SnapResult(
            new SketchPoint(circle.center.x, circle.center.y),
            SnapType.CENTER,
            circle,
            dist
          )
        );
      }
    }

    // Arc centers
    for (const arc of sketch.arcs.values()) {
      if (arc.center) {
        const dist = this._distance(mousePos, arc.center);
        if (dist <= tolerance) {
          results.push(
            new SnapResult(new SketchPoint(arc.center.x, arc.center.y), SnapType.CENTER, arc, dist)
          );
        }
      }
    }

    // Rectangle centers
    for (const rect of sketch.rectangles.values()) {
      const centerX = (rect.p1.x + rect.p3.x) / 2;
      const centerY = (rect.p1.y + rect.p3.y) / 2;
      const center = new SketchPoint(centerX, centerY);

      const dist = this._distance(mousePos, center);
      if (dist <= tolerance) {
        results.push(new SnapResult(center, SnapType.CENTER, rect, dist));
      }
    }

    return results;
  }

  /**
   * Find intersection snaps (where lines/edges cross)
   */
  _findIntersections(mousePos, sketch, tolerance) {
    const results = [];
    const lines = Array.from(sketch.lines.values());

    // Check all line pairs for intersections
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const intersection = this._lineLineIntersection(lines[i], lines[j]);
        if (intersection) {
          const dist = this._distance(mousePos, intersection);
          if (dist <= tolerance) {
            results.push(
              new SnapResult(intersection, SnapType.INTERSECTION, [lines[i], lines[j]], dist)
            );
          }
        }
      }
    }

    // Line-circle intersections
    for (const line of lines) {
      for (const circle of sketch.circles.values()) {
        const intersections = this._lineCircleIntersection(line, circle);
        for (const pt of intersections) {
          const dist = this._distance(mousePos, pt);
          if (dist <= tolerance) {
            results.push(new SnapResult(pt, SnapType.INTERSECTION, [line, circle], dist));
          }
        }
      }
    }

    return results;
  }

  /**
   * Find perpendicular snaps (perpendicular from cursor to line)
   */
  _findPerpendiculars(mousePos, sketch, tolerance) {
    const results = [];

    for (const line of sketch.lines.values()) {
      const perp = this._perpendicularPoint(mousePos, line);
      if (perp) {
        const dist = this._distance(mousePos, perp);
        if (dist <= tolerance) {
          results.push(new SnapResult(perp, SnapType.PERPENDICULAR, line, dist));
        }
      }
    }

    return results;
  }

  /**
   * Find nearest point on any edge
   */
  _findNearest(mousePos, sketch, tolerance) {
    const results = [];

    // Nearest on lines
    for (const line of sketch.lines.values()) {
      const nearest = this._nearestPointOnLine(mousePos, line);
      const dist = this._distance(mousePos, nearest);
      if (dist <= tolerance && dist > 0.01) {
        // Avoid duplicating endpoints
        // Check if it's not too close to endpoints or midpoint
        const distToStart = this._distance(nearest, line.start);
        const distToEnd = this._distance(nearest, line.end);
        const midX = (line.start.x + line.end.x) / 2;
        const midY = (line.start.y + line.end.y) / 2;
        const distToMid = this._distance(nearest, { x: midX, y: midY });

        if (
          distToStart > tolerance * 0.5 &&
          distToEnd > tolerance * 0.5 &&
          distToMid > tolerance * 0.5
        ) {
          results.push(new SnapResult(nearest, SnapType.NEAREST, line, dist));
        }
      }
    }

    // Nearest on circles
    for (const circle of sketch.circles.values()) {
      const nearest = this._nearestPointOnCircle(mousePos, circle);
      const dist = this._distance(mousePos, nearest);
      if (dist <= tolerance) {
        results.push(new SnapResult(nearest, SnapType.NEAREST, circle, dist));
      }
    }

    return results;
  }

  /**
   * Find grid snap point
   */
  _findGridSnap(mousePos) {
    const x = Math.round(mousePos.x / this.gridSize) * this.gridSize;
    const y = Math.round(mousePos.y / this.gridSize) * this.gridSize;
    const snapped = new SketchPoint(x, y);
    const dist = this._distance(mousePos, snapped);

    return new SnapResult(snapped, SnapType.GRID, null, dist);
  }

  // ========== Geometry Helpers ==========

  /**
   * Distance between two points
   */
  _distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Line-line intersection
   */
  _lineLineIntersection(line1, line2) {
    const x1 = line1.start.x,
      y1 = line1.start.y;
    const x2 = line1.end.x,
      y2 = line1.end.y;
    const x3 = line2.start.x,
      y3 = line2.start.y;
    const x4 = line2.end.x,
      y4 = line2.end.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null; // Parallel

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    // Check if intersection is within both segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return new SketchPoint(x1 + t * (x2 - x1), y1 + t * (y2 - y1));
    }

    return null;
  }

  /**
   * Line-circle intersection
   */
  _lineCircleIntersection(line, circle) {
    const results = [];

    const cx = circle.center.x;
    const cy = circle.center.y;
    const r = circle.radius;

    const x1 = line.start.x - cx;
    const y1 = line.start.y - cy;
    const x2 = line.end.x - cx;
    const y2 = line.end.y - cy;

    const dx = x2 - x1;
    const dy = y2 - y1;

    const a = dx * dx + dy * dy;
    const b = 2 * (x1 * dx + y1 * dy);
    const c = x1 * x1 + y1 * y1 - r * r;

    const discriminant = b * b - 4 * a * c;

    if (discriminant >= 0) {
      const sqrtD = Math.sqrt(discriminant);

      const t1 = (-b - sqrtD) / (2 * a);
      const t2 = (-b + sqrtD) / (2 * a);

      if (t1 >= 0 && t1 <= 1) {
        results.push(new SketchPoint(line.start.x + t1 * dx, line.start.y + t1 * dy));
      }

      if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 1e-10) {
        results.push(new SketchPoint(line.start.x + t2 * dx, line.start.y + t2 * dy));
      }
    }

    return results;
  }

  /**
   * Perpendicular point from point to line segment
   */
  _perpendicularPoint(point, line) {
    const nearest = this._nearestPointOnLine(point, line);

    // Check if perpendicular point is on the segment (not extended)
    const lineLen = this._distance(line.start, line.end);
    const distToStart = this._distance(nearest, line.start);
    const distToEnd = this._distance(nearest, line.end);

    if (distToStart > 0.01 * lineLen && distToEnd > 0.01 * lineLen) {
      return nearest;
    }

    return null;
  }

  /**
   * Nearest point on line segment to given point
   */
  _nearestPointOnLine(point, line) {
    const A = point.x - line.start.x;
    const B = point.y - line.start.y;
    const C = line.end.x - line.start.x;
    const D = line.end.y - line.start.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;

    // Clamp to segment
    param = Math.max(0, Math.min(1, param));

    return new SketchPoint(line.start.x + param * C, line.start.y + param * D);
  }

  /**
   * Nearest point on circle to given point
   */
  _nearestPointOnCircle(point, circle) {
    const dx = point.x - circle.center.x;
    const dy = point.y - circle.center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1e-10) {
      // Point is at center, return arbitrary point on circle
      return new SketchPoint(circle.center.x + circle.radius, circle.center.y);
    }

    return new SketchPoint(
      circle.center.x + (dx / dist) * circle.radius,
      circle.center.y + (dy / dist) * circle.radius
    );
  }

  /**
   * Notify change listeners
   */
  _notifyChange() {
    if (this.onSnapChange) {
      this.onSnapChange(this);
    }
  }

  /**
   * Get current settings as object
   */
  getSettings() {
    return {
      active: this.active,
      enabled: { ...this.enabled },
      gridSize: this.gridSize,
      tolerance: this.tolerance,
    };
  }

  /**
   * Apply settings from object
   */
  applySettings(settings) {
    if (settings.active !== undefined) this.active = settings.active;
    if (settings.enabled) Object.assign(this.enabled, settings.enabled);
    if (settings.gridSize) this.gridSize = settings.gridSize;
    if (settings.tolerance) this.tolerance = settings.tolerance;
    this._notifyChange();
  }

  /**
   * Get status string for display
   */
  getStatusString() {
    if (!this.active) return 'Snap: OFF';

    const active = [];
    if (this.enabled.grid) active.push('Grid');
    if (this.enabled.endpoint) active.push('End');
    if (this.enabled.midpoint) active.push('Mid');
    if (this.enabled.center) active.push('Cen');
    if (this.enabled.intersection) active.push('Int');
    if (this.enabled.nearest) active.push('Near');

    return `Snap: ${active.join(', ')} | Grid: ${this.gridSize}`;
  }
}

// Export singleton instance
export const snapManager = new SnapManager();

export default {
  SnapType,
  SnapResult,
  SnapManager,
  snapManager,
};
