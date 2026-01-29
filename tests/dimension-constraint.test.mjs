/**
 * Dimension Constraint Tests (Standalone - No module imports needed)
 * 
 * This tests the core constraint solver algorithm directly.
 */

// Inline minimal implementations for testing
const ConstraintType = {
    HORIZONTAL: 'horizontal',
    VERTICAL: 'vertical',
    LENGTH: 'length',
    RADIUS: 'radius',
    FIXED: 'fixed'
};

let idCounter = 0;
const genId = (prefix) => `${prefix}_${++idCounter}`;

class SketchPoint {
    constructor(x = 0, y = 0) {
        this.id = genId('pt');
        this.x = x;
        this.y = y;
        this.fixed = false;
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
    
    getEntity(id) {
        return this.points.get(id) || this.lines.get(id) || this.circles.get(id);
    }
}

// Solver functions
const EPS = 1e-6;

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

const applyLength = (entity, target, fixedMap, relax) => {
    if (entity instanceof SketchLine) {
        return adjustLineLength(entity, target, fixedMap, relax);
    }
    if (entity instanceof SketchCircle) {
        const error = entity.radius - target;
        entity.radius = entity.radius - error * relax;
        return Math.abs(error);
    }
    return 0;
};

const solveSketch = (sketch, options = {}) => {
    const config = { maxIterations: 60, tolerance: 1e-3, relax: 0.5, ...options };
    const constraints = Array.from(sketch.constraints.values());
    
    // Collect fixed points
    const fixedMap = new Map();
    sketch.points.forEach((point) => {
        if (point.fixed) {
            fixedMap.set(point.id, { x: point.x, y: point.y });
        }
    });
    
    let converged = false;
    let iterations = 0;
    let maxError = 0;

    for (let i = 0; i < config.maxIterations; i++) {
        maxError = 0;
        
        for (const constraint of constraints) {
            const entity = sketch.getEntity(constraint.entities[0]);
            let error = 0;
            
            switch (constraint.type) {
                case ConstraintType.LENGTH:
                    error = applyLength(entity, constraint.value || 0, fixedMap, config.relax);
                    break;
                case ConstraintType.RADIUS:
                    if (entity instanceof SketchCircle) {
                        error = applyLength(entity, constraint.value || 0, fixedMap, config.relax);
                    }
                    break;
                case ConstraintType.HORIZONTAL:
                    error = applyHorizontal(entity, fixedMap, config.relax);
                    break;
            }
            
            constraint.satisfied = Math.abs(error) <= config.tolerance;
            if (Math.abs(error) > maxError) {
                maxError = Math.abs(error);
            }
        }
        
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

    return { converged, iterations, maxError };
};

// Test runner
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

function assertApprox(actual, expected, tolerance = 0.1, message) {
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
        throw new Error(message || `Expected ${expected}, got ${actual} (diff: ${diff})`);
    }
}

// Tests
let passed = 0;
let total = 0;

console.log('\n=== Dimension Constraint Tests ===\n');

// Test 1: LENGTH constraint on a line
total++;
if (test('LENGTH constraint adjusts line to exact length', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 30, 40); // length = 50
    sketch.addConstraint(ConstraintType.LENGTH, [line.id], 100);
    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');
    assertApprox(line.length, 100, 0.1, 'Line length should be 100');
})) passed++;

// Test 2: LENGTH constraint preserves direction
total++;
if (test('LENGTH constraint preserves line direction', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 10, 0);
    const originalAngle = line.angle;
    sketch.addConstraint(ConstraintType.LENGTH, [line.id], 50);
    solveSketch(sketch);
    assertApprox(line.angle, originalAngle, 0.01, 'Line angle should be preserved');
    assertApprox(line.length, 50, 0.1, 'Line length should be 50');
})) passed++;

// Test 3: LENGTH constraint with fixed start point
total++;
if (test('LENGTH constraint respects fixed start point', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(10, 10, 20, 10);
    line.start.fixed = true;
    sketch.addConstraint(ConstraintType.LENGTH, [line.id], 30);
    solveSketch(sketch);
    assertApprox(line.start.x, 10, 0.01, 'Start X should remain at 10');
    assertApprox(line.start.y, 10, 0.01, 'Start Y should remain at 10');
    assertApprox(line.length, 30, 0.1, 'Line length should be 30');
})) passed++;

// Test 4: RADIUS constraint on a circle
total++;
if (test('RADIUS constraint adjusts circle radius', () => {
    const sketch = new Sketch('test');
    const circle = sketch.addCircle(0, 0, 15);
    sketch.addConstraint(ConstraintType.RADIUS, [circle.id], 25);
    const result = solveSketch(sketch);
    assert(result.converged, 'Solver should converge');
    assertApprox(circle.radius, 25, 0.1, 'Circle radius should be 25');
})) passed++;

// Test 5: Update existing LENGTH constraint value
total++;
if (test('Updating LENGTH constraint value updates geometry', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 10, 0);
    const constraint = sketch.addConstraint(ConstraintType.LENGTH, [line.id], 50);
    solveSketch(sketch);
    assertApprox(line.length, 50, 0.1, 'Initial length should be 50');
    constraint.value = 100;
    solveSketch(sketch);
    assertApprox(line.length, 100, 0.1, 'Updated length should be 100');
    constraint.value = 25;
    solveSketch(sketch);
    assertApprox(line.length, 25, 0.1, 'Updated length should be 25');
})) passed++;

// Test 6: Multiple LENGTH constraints
total++;
if (test('Multiple lines with different LENGTH constraints', () => {
    const sketch = new Sketch('test');
    const line1 = sketch.addLine(0, 0, 10, 0);
    const line2 = sketch.addLine(50, 0, 60, 10);
    sketch.addConstraint(ConstraintType.LENGTH, [line1.id], 75);
    sketch.addConstraint(ConstraintType.LENGTH, [line2.id], 30);
    solveSketch(sketch);
    assertApprox(line1.length, 75, 0.1, 'Line 1 should be 75');
    assertApprox(line2.length, 30, 0.1, 'Line 2 should be 30');
})) passed++;

// Test 7: Combined LENGTH and HORIZONTAL constraints
total++;
if (test('LENGTH combined with HORIZONTAL constraint', () => {
    const sketch = new Sketch('test');
    const line = sketch.addLine(0, 0, 30, 40);
    sketch.addConstraint(ConstraintType.HORIZONTAL, [line.id]);
    sketch.addConstraint(ConstraintType.LENGTH, [line.id], 60);
    solveSketch(sketch);
    assertApprox(line.start.y, line.end.y, 0.1, 'Line should be horizontal');
    assertApprox(line.length, 60, 0.1, 'Line should be 60 units long');
})) passed++;

// Summary
console.log(`\n=== Results: ${passed}/${total} tests passed ===\n`);

if (passed < total) {
    process.exit(1);
}
