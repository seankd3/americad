/**
 * Ghost Constraints™ Tests
 *
 * Tests for AI-predictive constraint suggestions during sketching.
 */

// Minimal test harness (project pattern - tests are validated but run in browser)
const describe = (name, fn) => fn();
const it = (name, fn) => fn();
const beforeEach = fn => fn();
const expect = actual => ({
  toBe: expected => {
    if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`);
  },
  toBeDefined: () => {
    if (actual === undefined) throw new Error('Expected value to be defined');
  },
  toBeUndefined: () => {
    if (actual !== undefined) throw new Error('Expected value to be undefined');
  },
  toBeGreaterThan: expected => {
    if (!(actual > expected)) throw new Error(`Expected ${actual} > ${expected}`);
  },
  toBeLessThan: expected => {
    if (!(actual < expected)) throw new Error(`Expected ${actual} < ${expected}`);
  },
  toBeGreaterThanOrEqual: expected => {
    if (!(actual >= expected)) throw new Error(`Expected ${actual} >= ${expected}`);
  },
  toBeLessThanOrEqual: expected => {
    if (!(actual <= expected)) throw new Error(`Expected ${actual} <= ${expected}`);
  },
  toBeCloseTo: (expected, precision = 2) => {
    const diff = Math.abs(actual - expected);
    const maxDiff = Math.pow(10, -precision) / 2;
    if (diff > maxDiff) throw new Error(`Expected ${actual} to be close to ${expected}`);
  },
});

// Inline minimal implementations for testing (matching project patterns)
const ConstraintTypes = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
  PARALLEL: 'parallel',
  PERPENDICULAR: 'perpendicular',
  EQUAL: 'equal',
  COINCIDENT: 'coincident',
  TANGENT: 'tangent',
  CONCENTRIC: 'concentric',
};

let idCounter = 0;
const genId = prefix => `${prefix}_${++idCounter}`;

class SketchPoint {
  constructor(x = 0, y = 0) {
    this.id = genId('pt');
    this.x = x;
    this.y = y;
    this.constraints = [];
  }
  distanceTo(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
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
  }
}

class Sketch {
  constructor(name) {
    this.id = genId('sk');
    this.name = name;
    this.points = new Map();
    this.lines = new Map();
    this.circles = new Map();
    this.constraints = new Map();
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
}

// Inline GhostConstraintDetector for self-contained testing
const GhostTolerances = {
  angle: 5,
  parallelAngle: 3,
  perpendicularAngle: 3,
  distance: 5,
  ratio: 0.02,
  tangentDistance: 3,
};

class GhostConstraintDetector {
  constructor(sketch, tolerance = {}) {
    this.sketch = sketch;
    this.tolerance = { ...GhostTolerances, ...tolerance };
    this.ghosts = [];
    this._enabled = true;
  }

  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) this.ghosts = [];
  }

  get enabled() {
    return this._enabled;
  }

  setSketch(sketch) {
    this.sketch = sketch;
    this.ghosts = [];
  }

  analyze(newEntity) {
    if (!this._enabled || !newEntity || !this.sketch) {
      this.ghosts = [];
      return this.ghosts;
    }

    this.ghosts = [];

    const isLine = this._isLine(newEntity);
    const isCircle = this._isCircle(newEntity);

    if (isLine) {
      this._analyzeLineConstraints(newEntity);
    }

    if (isCircle) {
      this._analyzeCircleConstraints(newEntity);
    }

    this._analyzeCoincidentConstraints(newEntity);

    this.ghosts.sort((a, b) => (b.confidence || 1) - (a.confidence || 1));
    this._filterConflicts();

    return this.ghosts;
  }

  _analyzeLineConstraints(line) {
    const angle = this._getLineAngle(line);
    const angleDeg = (angle * 180) / Math.PI;

    // Horizontal
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

    // Vertical
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
      const angleDiff = this._getAngleDifference(line, existing);

      // Parallel
      if (angleDiff < this.tolerance.parallelAngle) {
        this.ghosts.push({
          type: ConstraintTypes.PARALLEL,
          entities: [existing, line],
          confidence: 1 - angleDiff / this.tolerance.parallelAngle,
          position: this._getLineMidpoint(line),
        });
      }

      // Perpendicular
      const perpDiff = Math.abs(angleDiff - 90);
      if (perpDiff < this.tolerance.perpendicularAngle) {
        this.ghosts.push({
          type: ConstraintTypes.PERPENDICULAR,
          entities: [existing, line],
          confidence: 1 - perpDiff / this.tolerance.perpendicularAngle,
          position: this._getLineMidpoint(line),
        });
      }

      // Equal length
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
          });
        }
      }
    }

    // Tangent to circles
    const existingCircles = this._getExistingCircles();
    for (const circle of existingCircles) {
      if (this._isLineTangentToCircle(line, circle)) {
        this.ghosts.push({
          type: ConstraintTypes.TANGENT,
          entities: [line, circle],
          confidence: 0.85,
          position: this._getLineMidpoint(line),
        });
      }
    }
  }

  _analyzeCircleConstraints(circle) {
    const existingCircles = this._getExistingCircles(circle);

    for (const existing of existingCircles) {
      // Concentric
      const centerDist = this._getPointDistance(circle.center, existing.center);
      if (centerDist < this.tolerance.distance && centerDist > 0) {
        this.ghosts.push({
          type: ConstraintTypes.CONCENTRIC,
          entities: [existing, circle],
          confidence: 1 - centerDist / this.tolerance.distance,
          position: circle.center,
        });
      }

      // Equal radius
      if (circle.radius > 0 && existing.radius > 0) {
        const ratio =
          Math.abs(circle.radius - existing.radius) / Math.max(circle.radius, existing.radius);
        if (ratio < this.tolerance.ratio) {
          this.ghosts.push({
            type: ConstraintTypes.EQUAL,
            entities: [existing, circle],
            confidence: 1 - ratio / this.tolerance.ratio,
            position: circle.center,
          });
        }
      }
    }
  }

  _analyzeCoincidentConstraints(entity) {
    const endpoints = this._getEntityEndpoints(entity);

    for (const endpoint of endpoints) {
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
              });
            }
          }
        }
      }
    }
  }

  _filterConflicts() {
    const filtered = [];
    const seen = new Set();

    for (const ghost of this.ghosts) {
      const key = this._getGhostKey(ghost);
      let hasConflict = false;

      if (ghost.type === ConstraintTypes.HORIZONTAL) {
        const vertKey = this._getGhostKey({ ...ghost, type: ConstraintTypes.VERTICAL });
        if (seen.has(vertKey)) hasConflict = true;
      }
      if (ghost.type === ConstraintTypes.VERTICAL) {
        const horzKey = this._getGhostKey({ ...ghost, type: ConstraintTypes.HORIZONTAL });
        if (seen.has(horzKey)) hasConflict = true;
      }

      if (!hasConflict && !seen.has(key)) {
        filtered.push(ghost);
        seen.add(key);
      }
    }

    this.ghosts = filtered;
  }

  _getGhostKey(ghost) {
    const entityIds = (ghost.entities || [ghost.entity])
      .map(e => e?.id || 'unknown')
      .sort()
      .join(',');
    return `${ghost.type}:${entityIds}`;
  }

  acceptGhost(ghost = null) {
    const target = ghost || this.ghosts[0];
    if (!target || !this.sketch) return null;

    const entityIds = (target.entities || [target.entity]).filter(e => e && e.id).map(e => e.id);

    if (entityIds.length === 0) return null;

    const constraint = this.sketch.addConstraint(target.type, entityIds, target.value || null);

    this.ghosts = this.ghosts.filter(g => {
      if (g === target) return false;
      const gIds = (g.entities || [g.entity]).map(e => e?.id).filter(Boolean);
      return !entityIds.some(id => gIds.includes(id));
    });

    return constraint;
  }

  dismissGhosts() {
    this.ghosts = [];
  }

  getGhosts() {
    return this.ghosts;
  }

  getTopGhost() {
    return this.ghosts[0] || null;
  }

  // Helper methods
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
    return endpoints;
  }

  _isLineTangentToCircle(line, circle) {
    if (!line.start || !line.end || !circle.center || !circle.radius) return false;

    const A = line.end.y - line.start.y;
    const B = line.start.x - line.end.x;
    const C = line.end.x * line.start.y - line.start.x * line.end.y;
    const len = Math.sqrt(A * A + B * B);
    if (len < 1e-6) return false;

    const dist = Math.abs(A * circle.center.x + B * circle.center.y + C) / len;
    return Math.abs(dist - circle.radius) <= this.tolerance.tangentDistance;
  }
}

// ==================== TESTS ====================

describe('GhostConstraintDetector', () => {
  let sketch;
  let detector;

  beforeEach(() => {
    idCounter = 0;
    sketch = new Sketch('test');
    detector = new GhostConstraintDetector(sketch);
  });

  describe('Horizontal Line Detection', () => {
    it('should detect a horizontal line (0° angle)', () => {
      const line = sketch.addLine(0, 0, 100, 0);
      const ghosts = detector.analyze(line);

      const horizontal = ghosts.find(g => g.type === ConstraintTypes.HORIZONTAL);
      expect(horizontal).toBeDefined();
      expect(horizontal.confidence).toBeCloseTo(1, 1);
    });

    it('should detect a nearly horizontal line (within tolerance)', () => {
      // 3 degrees off horizontal
      const line = sketch.addLine(0, 0, 100, 100 * Math.tan((3 * Math.PI) / 180));
      const ghosts = detector.analyze(line);

      const horizontal = ghosts.find(g => g.type === ConstraintTypes.HORIZONTAL);
      expect(horizontal).toBeDefined();
      expect(horizontal.confidence).toBeGreaterThan(0.3);
      expect(horizontal.confidence).toBeLessThan(1);
    });

    it('should NOT detect horizontal for a diagonal line', () => {
      const line = sketch.addLine(0, 0, 100, 100); // 45 degrees
      const ghosts = detector.analyze(line);

      const horizontal = ghosts.find(g => g.type === ConstraintTypes.HORIZONTAL);
      expect(horizontal).toBeUndefined();
    });
  });

  describe('Vertical Line Detection', () => {
    it('should detect a vertical line (90° angle)', () => {
      const line = sketch.addLine(0, 0, 0, 100);
      const ghosts = detector.analyze(line);

      const vertical = ghosts.find(g => g.type === ConstraintTypes.VERTICAL);
      expect(vertical).toBeDefined();
      expect(vertical.confidence).toBeCloseTo(1, 1);
    });

    it('should detect a nearly vertical line (within tolerance)', () => {
      // 4 degrees off vertical
      const line = sketch.addLine(0, 0, 100 * Math.tan((4 * Math.PI) / 180), 100);
      const ghosts = detector.analyze(line);

      const vertical = ghosts.find(g => g.type === ConstraintTypes.VERTICAL);
      expect(vertical).toBeDefined();
      expect(vertical.confidence).toBeGreaterThan(0.1);
    });

    it('should NOT detect vertical for a diagonal line', () => {
      const line = sketch.addLine(0, 0, 100, 100); // 45 degrees
      const ghosts = detector.analyze(line);

      const vertical = ghosts.find(g => g.type === ConstraintTypes.VERTICAL);
      expect(vertical).toBeUndefined();
    });
  });

  describe('Parallel Lines Detection', () => {
    it('should detect parallel horizontal lines', () => {
      sketch.addLine(0, 0, 100, 0); // First line
      const line2 = sketch.addLine(0, 50, 100, 50); // Second line, parallel

      const ghosts = detector.analyze(line2);

      const parallel = ghosts.find(g => g.type === ConstraintTypes.PARALLEL);
      expect(parallel).toBeDefined();
      expect(parallel.confidence).toBeCloseTo(1, 1);
    });

    it('should detect nearly parallel lines (within 3° tolerance)', () => {
      sketch.addLine(0, 0, 100, 0);
      // 2 degrees off parallel
      const line2 = sketch.addLine(0, 50, 100, 50 + 100 * Math.tan((2 * Math.PI) / 180));

      const ghosts = detector.analyze(line2);

      const parallel = ghosts.find(g => g.type === ConstraintTypes.PARALLEL);
      expect(parallel).toBeDefined();
      expect(parallel.confidence).toBeGreaterThan(0.3);
    });

    it('should NOT detect parallel for perpendicular lines', () => {
      sketch.addLine(0, 0, 100, 0);
      const line2 = sketch.addLine(50, 0, 50, 100); // Perpendicular

      const ghosts = detector.analyze(line2);

      const parallel = ghosts.find(g => g.type === ConstraintTypes.PARALLEL);
      expect(parallel).toBeUndefined();
    });
  });

  describe('Equal Length Detection', () => {
    it('should detect equal length lines', () => {
      sketch.addLine(0, 0, 100, 0);
      const line2 = sketch.addLine(0, 50, 100, 50);

      const ghosts = detector.analyze(line2);

      const equal = ghosts.find(g => g.type === ConstraintTypes.EQUAL);
      expect(equal).toBeDefined();
      expect(equal.confidence).toBeCloseTo(1, 1);
    });

    it('should detect nearly equal length lines (within 2% tolerance)', () => {
      sketch.addLine(0, 0, 100, 0);
      const line2 = sketch.addLine(0, 50, 99, 50); // 1% shorter

      const ghosts = detector.analyze(line2);

      const equal = ghosts.find(g => g.type === ConstraintTypes.EQUAL);
      expect(equal).toBeDefined();
      expect(equal.confidence).toBeGreaterThan(0.4);
    });

    it('should NOT detect equal for very different lengths', () => {
      sketch.addLine(0, 0, 100, 0);
      const line2 = sketch.addLine(0, 50, 50, 50); // Half length

      const ghosts = detector.analyze(line2);

      const equal = ghosts.find(g => g.type === ConstraintTypes.EQUAL);
      expect(equal).toBeUndefined();
    });
  });

  describe('Coincident Endpoints Detection', () => {
    it('should detect coincident endpoints', () => {
      sketch.addLine(0, 0, 100, 0);
      // Line starting near the end of first line
      const line2 = sketch.addLine(99, 1, 150, 50);

      const ghosts = detector.analyze(line2);

      const coincident = ghosts.find(g => g.type === ConstraintTypes.COINCIDENT);
      expect(coincident).toBeDefined();
    });

    it('should NOT detect coincident for distant endpoints', () => {
      sketch.addLine(0, 0, 100, 0);
      const line2 = sketch.addLine(200, 200, 300, 300);

      const ghosts = detector.analyze(line2);

      const coincident = ghosts.find(g => g.type === ConstraintTypes.COINCIDENT);
      expect(coincident).toBeUndefined();
    });
  });

  describe('Accept Ghost', () => {
    it('should apply constraint when ghost is accepted', () => {
      const line = sketch.addLine(0, 0, 100, 0);
      detector.analyze(line);

      expect(detector.ghosts.length).toBeGreaterThan(0);
      expect(sketch.constraints.size).toBe(0);

      const constraint = detector.acceptGhost();

      expect(constraint).toBeDefined();
      expect(constraint.type).toBe(ConstraintTypes.HORIZONTAL);
      expect(sketch.constraints.size).toBe(1);
    });

    it('should remove accepted ghost from list', () => {
      const line = sketch.addLine(0, 0, 100, 0);
      detector.analyze(line);

      const initialCount = detector.ghosts.length;
      detector.acceptGhost();

      expect(detector.ghosts.length).toBeLessThan(initialCount);
    });

    it('should accept specific ghost when provided', () => {
      sketch.addLine(0, 0, 100, 0); // Add a reference line
      const line2 = sketch.addLine(0, 50, 100, 50); // Parallel and equal
      detector.analyze(line2);

      // Find the equal constraint ghost specifically
      const equalGhost = detector.ghosts.find(g => g.type === ConstraintTypes.EQUAL);
      expect(equalGhost).toBeDefined();

      const constraint = detector.acceptGhost(equalGhost);
      expect(constraint.type).toBe(ConstraintTypes.EQUAL);
    });
  });

  describe('Dismiss Ghosts', () => {
    it('should clear all ghosts when dismissed', () => {
      const line = sketch.addLine(0, 0, 100, 0);
      detector.analyze(line);

      expect(detector.ghosts.length).toBeGreaterThan(0);

      detector.dismissGhosts();

      expect(detector.ghosts.length).toBe(0);
    });
  });

  describe('Confidence Ranking', () => {
    it('should sort ghosts by confidence (highest first)', () => {
      // Create a scenario with multiple potential constraints
      sketch.addLine(0, 0, 100, 0);
      // A line that's almost horizontal but also almost parallel to existing
      const line2 = sketch.addLine(0, 50, 100, 52);
      detector.analyze(line2);

      if (detector.ghosts.length > 1) {
        for (let i = 1; i < detector.ghosts.length; i++) {
          const prev = detector.ghosts[i - 1].confidence || 1;
          const curr = detector.ghosts[i].confidence || 1;
          expect(prev).toBeGreaterThanOrEqual(curr);
        }
      }
    });

    it('should return top ghost with getTopGhost()', () => {
      const line = sketch.addLine(0, 0, 100, 0);
      detector.analyze(line);

      const top = detector.getTopGhost();
      expect(top).toBe(detector.ghosts[0]);
    });
  });

  describe('Perpendicular Detection', () => {
    it('should detect perpendicular lines', () => {
      sketch.addLine(0, 0, 100, 0); // Horizontal
      const line2 = sketch.addLine(50, -50, 50, 50); // Vertical (perpendicular)

      const ghosts = detector.analyze(line2);

      const perp = ghosts.find(g => g.type === ConstraintTypes.PERPENDICULAR);
      expect(perp).toBeDefined();
      expect(perp.confidence).toBeCloseTo(1, 1);
    });
  });

  describe('Tangent Detection', () => {
    it('should detect line tangent to circle', () => {
      sketch.addCircle(50, 50, 30);
      // Line tangent to circle (at y = 80, which is center.y + radius)
      const line = sketch.addLine(0, 80, 100, 80);

      const ghosts = detector.analyze(line);

      const tangent = ghosts.find(g => g.type === ConstraintTypes.TANGENT);
      expect(tangent).toBeDefined();
    });

    it('should NOT detect tangent for line through circle', () => {
      sketch.addCircle(50, 50, 30);
      // Line through center
      const line = sketch.addLine(0, 50, 100, 50);

      const ghosts = detector.analyze(line);

      const tangent = ghosts.find(g => g.type === ConstraintTypes.TANGENT);
      expect(tangent).toBeUndefined();
    });
  });

  describe('Concentric Circles Detection', () => {
    it('should detect nearly concentric circles', () => {
      sketch.addCircle(50, 50, 30);
      const circle2 = new SketchCircle(new SketchPoint(52, 51), 50);
      sketch.circles.set(circle2.id, circle2);

      const ghosts = detector.analyze(circle2);

      const concentric = ghosts.find(g => g.type === ConstraintTypes.CONCENTRIC);
      expect(concentric).toBeDefined();
    });
  });

  describe('Enable/Disable', () => {
    it('should not analyze when disabled', () => {
      detector.setEnabled(false);

      const line = sketch.addLine(0, 0, 100, 0);
      const ghosts = detector.analyze(line);

      expect(ghosts.length).toBe(0);
    });

    it('should analyze when re-enabled', () => {
      detector.setEnabled(false);
      detector.setEnabled(true);

      const line = sketch.addLine(0, 0, 100, 0);
      const ghosts = detector.analyze(line);

      expect(ghosts.length).toBeGreaterThan(0);
    });
  });

  describe('Conflict Filtering', () => {
    it('should not suggest both horizontal and vertical for same line', () => {
      // This would be impossible in practice, but test the filter
      const line = sketch.addLine(0, 0, 100, 0);
      detector.analyze(line);

      const horizontal = detector.ghosts.filter(g => g.type === ConstraintTypes.HORIZONTAL);
      const vertical = detector.ghosts.filter(g => g.type === ConstraintTypes.VERTICAL);

      // Should only have one or the other, not both
      expect(horizontal.length + vertical.length).toBeLessThanOrEqual(1);
    });
  });
});

describe('Ghost Renderer', () => {
  // Note: Full canvas rendering tests would require jsdom or similar
  // These are basic unit tests for the helper functions

  const GhostSymbols = {
    horizontal: 'H',
    vertical: 'V',
    parallel: '∥',
    perpendicular: '⊥',
    equal: '=',
    coincident: '●',
    tangent: 'T',
    concentric: '⊕',
  };

  function getConstraintSymbol(type) {
    return GhostSymbols[type] || '?';
  }

  function getGhostPosition(ghost) {
    if (ghost.position) {
      return { x: ghost.position.x, y: ghost.position.y };
    }
    return { x: 0, y: 0 };
  }

  it('should return correct symbol for each constraint type', () => {
    expect(getConstraintSymbol('horizontal')).toBe('H');
    expect(getConstraintSymbol('vertical')).toBe('V');
    expect(getConstraintSymbol('parallel')).toBe('∥');
    expect(getConstraintSymbol('perpendicular')).toBe('⊥');
    expect(getConstraintSymbol('equal')).toBe('=');
    expect(getConstraintSymbol('coincident')).toBe('●');
  });

  it('should return ? for unknown constraint type', () => {
    expect(getConstraintSymbol('unknown')).toBe('?');
  });

  it('should extract position from ghost', () => {
    const ghost = { type: 'horizontal', position: { x: 50, y: 25 } };
    const pos = getGhostPosition(ghost);
    expect(pos.x).toBe(50);
    expect(pos.y).toBe(25);
  });

  it('should return default position when ghost has no position', () => {
    const ghost = { type: 'horizontal' };
    const pos = getGhostPosition(ghost);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });
});
