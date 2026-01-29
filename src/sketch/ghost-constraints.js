/**
 * Ameri-CAD Ghost Constraints™
 *
 * AI-predictive constraint suggestions that appear as you sketch.
 * Detects geometric relationships and offers them as "ghost" constraints
 * that can be accepted with Tab or dismissed by continuing to draw.
 *
 * Features:
 * - Real-time detection during sketching
 * - Confidence-based ranking
 * - Visual ghost markers
 * - Tab to accept, continue drawing to dismiss
 */

import {
  ConstraintTypes,
  isNearHorizontal as _isNearHorizontal,
  isNearVertical as _isNearVertical,
  isNearParallel as _isNearParallel,
  isNearPerpendicular as _isNearPerpendicular,
  isNearEqualLength as _isNearEqualLength,
  isNearPoint as _isNearPoint,
  isNearTangent as _isNearTangent,
  isNearConcentric as _isNearConcentric,
} from './constraints.js';

// Re-export for future use (silences unused import warnings)
export {
  _isNearHorizontal,
  _isNearVertical,
  _isNearParallel,
  _isNearPerpendicular,
  _isNearEqualLength,
  _isNearPoint,
  _isNearTangent,
  _isNearConcentric,
};

/**
 * Default tolerance values for ghost constraint detection
 */
export const GhostTolerances = {
  angle: 5, // Degrees for horizontal/vertical detection
  parallelAngle: 3, // Degrees for parallel detection
  perpendicularAngle: 3, // Degrees for perpendicular detection
  distance: 5, // Units for coincident/snap detection
  ratio: 0.02, // 2% tolerance for equal length
  tangentDistance: 3, // Units for tangent detection
};

/**
 * Ghost constraint types with their symbols
 */
export const GhostSymbols = {
  horizontal: 'H',
  vertical: 'V',
  parallel: '∥',
  perpendicular: '⊥',
  equal: '=',
  coincident: '●',
  tangent: 'T',
  concentric: '⊕',
  midpoint: 'M',
  colinear: '—',
};

/**
 * Ghost Constraint Detector
 *
 * Analyzes sketch entities in real-time and suggests constraints
 * based on geometric relationships.
 */
export class GhostConstraintDetector {
  /**
   * @param {Object} sketch - The active sketch
   * @param {Object} tolerance - Custom tolerance overrides
   */
  constructor(sketch, tolerance = {}) {
    this.sketch = sketch;
    this.tolerance = { ...GhostTolerances, ...tolerance };
    this.ghosts = [];
    this._enabled = true;
  }

  /**
   * Enable/disable ghost detection
   */
  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) {
      this.ghosts = [];
    }
  }

  /**
   * Check if ghost detection is enabled
   */
  get enabled() {
    return this._enabled;
  }

  /**
   * Update the sketch reference (when switching sketches)
   */
  setSketch(sketch) {
    this.sketch = sketch;
    this.ghosts = [];
  }

  /**
   * Analyze a new or updated entity and detect potential constraints
   * @param {Object} newEntity - The entity being drawn/modified
   * @returns {Array} Array of ghost constraint suggestions
   */
  analyze(newEntity) {
    if (!this._enabled || !newEntity || !this.sketch) {
      this.ghosts = [];
      return this.ghosts;
    }

    this.ghosts = [];

    // Detect entity type
    const isLine = this._isLine(newEntity);
    const isCircle = this._isCircle(newEntity);

    if (isLine) {
      this._analyzeLineConstraints(newEntity);
    }

    if (isCircle) {
      this._analyzeCircleConstraints(newEntity);
    }

    // Always check for coincident endpoints
    this._analyzeCoincidentConstraints(newEntity);

    // Sort by confidence (highest first)
    this.ghosts.sort((a, b) => (b.confidence || 1) - (a.confidence || 1));

    // Filter out conflicting constraints
    this._filterConflicts();

    return this.ghosts;
  }

  /**
   * Analyze constraints for a line entity
   */
  _analyzeLineConstraints(line) {
    const angle = this._getLineAngle(line);
    const angleDeg = (angle * 180) / Math.PI;

    // Check horizontal (within ±tolerance of 0° or 180°)
    const horizontalDiff = Math.min(
      Math.abs(angleDeg),
      Math.abs(angleDeg - 180),
      Math.abs(angleDeg + 180)
    );
    if (horizontalDiff < this.tolerance.angle) {
      this.ghosts.push({
        type: ConstraintTypes.HORIZONTAL,
        entity: line,
        entities: [line],
        confidence: 1 - horizontalDiff / this.tolerance.angle,
        position: this._getLineMidpoint(line),
      });
    }

    // Check vertical (within ±tolerance of 90° or -90°)
    const verticalDiff = Math.min(Math.abs(angleDeg - 90), Math.abs(angleDeg + 90));
    if (verticalDiff < this.tolerance.angle) {
      this.ghosts.push({
        type: ConstraintTypes.VERTICAL,
        entity: line,
        entities: [line],
        confidence: 1 - verticalDiff / this.tolerance.angle,
        position: this._getLineMidpoint(line),
      });
    }

    // Check against existing lines
    const existingLines = this._getExistingLines(line);
    for (const existing of existingLines) {
      // Check parallel
      const angleDiff = this._getAngleDifference(line, existing);
      if (angleDiff < this.tolerance.parallelAngle) {
        this.ghosts.push({
          type: ConstraintTypes.PARALLEL,
          entities: [existing, line],
          confidence: 1 - angleDiff / this.tolerance.parallelAngle,
          position: this._getLineMidpoint(line),
          referenceEntity: existing,
        });
      }

      // Check perpendicular
      const perpDiff = Math.abs(angleDiff - 90);
      if (perpDiff < this.tolerance.perpendicularAngle) {
        this.ghosts.push({
          type: ConstraintTypes.PERPENDICULAR,
          entities: [existing, line],
          confidence: 1 - perpDiff / this.tolerance.perpendicularAngle,
          position: this._getLineMidpoint(line),
          referenceEntity: existing,
        });
      }

      // Check equal length
      const len1 = this._getLineLength(line);
      const len2 = this._getLineLength(existing);
      if (len1 > 0 && len2 > 0) {
        const ratio = Math.abs(len1 - len2) / Math.max(len1, len2);
        if (ratio < this.tolerance.ratio) {
          this.ghosts.push({
            type: ConstraintTypes.EQUAL,
            entities: [existing, line],
            confidence: 1 - ratio / this.tolerance.ratio,
            position: this._getLineMidpoint(line),
            referenceEntity: existing,
          });
        }
      }
    }

    // Check tangent to circles
    const existingCircles = this._getExistingCircles();
    for (const circle of existingCircles) {
      if (this._isLineTangentToCircle(line, circle)) {
        this.ghosts.push({
          type: ConstraintTypes.TANGENT,
          entities: [line, circle],
          confidence: 0.85,
          position: this._getTangentPoint(line, circle),
          referenceEntity: circle,
        });
      }
    }
  }

  /**
   * Analyze constraints for a circle entity
   */
  _analyzeCircleConstraints(circle) {
    const existingCircles = this._getExistingCircles(circle);

    for (const existing of existingCircles) {
      // Check concentric
      const centerDist = this._getPointDistance(circle.center, existing.center);
      if (centerDist < this.tolerance.distance && centerDist > 0) {
        this.ghosts.push({
          type: ConstraintTypes.CONCENTRIC,
          entities: [existing, circle],
          confidence: 1 - centerDist / this.tolerance.distance,
          position: circle.center,
          referenceEntity: existing,
        });
      }

      // Check equal radius
      if (circle.radius > 0 && existing.radius > 0) {
        const ratio =
          Math.abs(circle.radius - existing.radius) / Math.max(circle.radius, existing.radius);
        if (ratio < this.tolerance.ratio) {
          this.ghosts.push({
            type: ConstraintTypes.EQUAL,
            entities: [existing, circle],
            confidence: 1 - ratio / this.tolerance.ratio,
            position: circle.center,
            referenceEntity: existing,
          });
        }
      }
    }
  }

  /**
   * Analyze coincident constraints for any entity
   */
  _analyzeCoincidentConstraints(entity) {
    const endpoints = this._getEntityEndpoints(entity);

    // Check against existing points and line endpoints
    for (const endpoint of endpoints) {
      // Check against sketch points
      if (this.sketch.points) {
        for (const [, point] of this.sketch.points) {
          const dist = this._getPointDistance(endpoint, point);
          if (dist < this.tolerance.distance && dist > 0) {
            this.ghosts.push({
              type: ConstraintTypes.COINCIDENT,
              entities: [entity, point],
              confidence: 1 - dist / this.tolerance.distance,
              position: endpoint,
              point: { x: endpoint.x, y: endpoint.y },
              referenceEntity: point,
            });
          }
        }
      }

      // Check against line endpoints
      if (this.sketch.lines) {
        for (const [, line] of this.sketch.lines) {
          if (line.id === entity.id) continue;

          for (const lineEndpoint of [line.start, line.end]) {
            const dist = this._getPointDistance(endpoint, lineEndpoint);
            if (dist < this.tolerance.distance && dist > 0) {
              this.ghosts.push({
                type: ConstraintTypes.COINCIDENT,
                entities: [entity, line],
                confidence: 1 - dist / this.tolerance.distance,
                position: endpoint,
                point: { x: endpoint.x, y: endpoint.y },
                referenceEntity: line,
              });
            }
          }
        }
      }
    }
  }

  /**
   * Filter out conflicting ghost constraints
   */
  _filterConflicts() {
    const filtered = [];
    const seen = new Set();

    for (const ghost of this.ghosts) {
      // Create a unique key for this constraint
      const key = this._getGhostKey(ghost);

      // Check for conflicts
      let hasConflict = false;

      // Horizontal and vertical conflict
      if (ghost.type === ConstraintTypes.HORIZONTAL) {
        const vertKey = this._getGhostKey({ ...ghost, type: ConstraintTypes.VERTICAL });
        if (seen.has(vertKey)) hasConflict = true;
      }
      if (ghost.type === ConstraintTypes.VERTICAL) {
        const horzKey = this._getGhostKey({ ...ghost, type: ConstraintTypes.HORIZONTAL });
        if (seen.has(horzKey)) hasConflict = true;
      }

      // Parallel and perpendicular conflict (same entity pair)
      if (ghost.type === ConstraintTypes.PARALLEL && ghost.entities?.length === 2) {
        const perpKey = `perpendicular:${ghost.entities
          .map(e => e.id)
          .sort()
          .join(',')}`;
        if (seen.has(perpKey)) hasConflict = true;
      }
      if (ghost.type === ConstraintTypes.PERPENDICULAR && ghost.entities?.length === 2) {
        const parallelKey = `parallel:${ghost.entities
          .map(e => e.id)
          .sort()
          .join(',')}`;
        if (seen.has(parallelKey)) hasConflict = true;
      }

      if (!hasConflict && !seen.has(key)) {
        filtered.push(ghost);
        seen.add(key);
      }
    }

    this.ghosts = filtered;
  }

  /**
   * Generate a unique key for a ghost constraint
   */
  _getGhostKey(ghost) {
    const entityIds = (ghost.entities || [ghost.entity])
      .map(e => e?.id || 'unknown')
      .sort()
      .join(',');
    return `${ghost.type}:${entityIds}`;
  }

  /**
   * Accept the top ghost constraint (or a specific one)
   * @param {Object} ghost - Specific ghost to accept, or null for top ghost
   * @returns {Object|null} The constraint that was applied, or null
   */
  acceptGhost(ghost = null) {
    const target = ghost || this.ghosts[0];
    if (!target || !this.sketch) return null;

    // Get entity IDs for the constraint
    const entityIds = (target.entities || [target.entity]).filter(e => e && e.id).map(e => e.id);

    if (entityIds.length === 0) return null;

    // Add the constraint to the sketch
    const constraint = this.sketch.addConstraint(target.type, entityIds, target.value || null);

    // Remove this ghost and any related ghosts
    this.ghosts = this.ghosts.filter(g => {
      if (g === target) return false;
      // Also remove ghosts that share entities with the accepted one
      const gIds = (g.entities || [g.entity]).map(e => e?.id).filter(Boolean);
      return !entityIds.some(id => gIds.includes(id));
    });

    return constraint;
  }

  /**
   * Dismiss all current ghost constraints
   */
  dismissGhosts() {
    this.ghosts = [];
  }

  /**
   * Get the current ghost constraints
   */
  getGhosts() {
    return this.ghosts;
  }

  /**
   * Get the top (highest confidence) ghost
   */
  getTopGhost() {
    return this.ghosts[0] || null;
  }

  // ============ Helper Methods ============

  _isLine(entity) {
    return entity && entity.start && entity.end && !entity.radius;
  }

  _isCircle(entity) {
    return entity && entity.center && entity.radius && !entity.start;
  }

  _getLineAngle(line) {
    if (!line.start || !line.end) return 0;
    return Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
  }

  _getLineMidpoint(line) {
    if (!line.start || !line.end) return { x: 0, y: 0 };
    return {
      x: (line.start.x + line.end.x) / 2,
      y: (line.start.y + line.end.y) / 2,
    };
  }

  _getLineLength(line) {
    if (!line.start || !line.end) return 0;
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _getAngleDifference(line1, line2) {
    const angle1 = this._getLineAngle(line1);
    const angle2 = this._getLineAngle(line2);
    let diff = Math.abs(angle1 - angle2) * (180 / Math.PI);
    // Normalize to 0-90 range (lines are the same whether pointing same or opposite)
    diff = diff % 180;
    if (diff > 90) diff = 180 - diff;
    return diff;
  }

  _getPointDistance(p1, p2) {
    if (!p1 || !p2) return Infinity;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _getExistingLines(excludeEntity = null) {
    if (!this.sketch?.lines) return [];
    return Array.from(this.sketch.lines.values()).filter(
      line => !excludeEntity || line.id !== excludeEntity.id
    );
  }

  _getExistingCircles(excludeEntity = null) {
    if (!this.sketch?.circles) return [];
    return Array.from(this.sketch.circles.values()).filter(
      circle => !excludeEntity || circle.id !== excludeEntity.id
    );
  }

  _getEntityEndpoints(entity) {
    const endpoints = [];
    if (entity.start) endpoints.push(entity.start);
    if (entity.end) endpoints.push(entity.end);
    if (entity.center && this._isCircle(entity)) {
      // For circles, we might want to check center coincidence
      endpoints.push(entity.center);
    }
    return endpoints;
  }

  _isLineTangentToCircle(line, circle) {
    if (!line.start || !line.end || !circle.center || !circle.radius) return false;

    // Calculate distance from circle center to line
    const A = line.end.y - line.start.y;
    const B = line.start.x - line.end.x;
    const C = line.end.x * line.start.y - line.start.x * line.end.y;
    const len = Math.sqrt(A * A + B * B);
    if (len < 1e-6) return false;

    const dist = Math.abs(A * circle.center.x + B * circle.center.y + C) / len;
    return Math.abs(dist - circle.radius) <= this.tolerance.tangentDistance;
  }

  _getTangentPoint(line, circle) {
    // Return the point on the circle closest to the line
    if (!line.start || !line.end || !circle.center) {
      return circle.center || { x: 0, y: 0 };
    }

    // Project center onto line
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) return circle.center;

    const t =
      ((circle.center.x - line.start.x) * dx + (circle.center.y - line.start.y) * dy) / len2;
    const px = line.start.x + t * dx;
    const py = line.start.y + t * dy;

    // Direction from center to projected point
    const dirX = px - circle.center.x;
    const dirY = py - circle.center.y;
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);

    if (dirLen < 1e-6) return { x: px, y: py };

    // Point on circle in that direction
    return {
      x: circle.center.x + (dirX / dirLen) * circle.radius,
      y: circle.center.y + (dirY / dirLen) * circle.radius,
    };
  }
}

/**
 * Factory function to create a ghost detector with default settings
 */
export function createGhostDetector(sketch, tolerances = {}) {
  return new GhostConstraintDetector(sketch, tolerances);
}

export default GhostConstraintDetector;
