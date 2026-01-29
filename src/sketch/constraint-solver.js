/**
 * Ameri-CAD Sketch Constraint Solver
 *
 * Simple iterative relaxation solver for 2D sketch constraints.
 */

import {
    ConstraintType,
    SketchPoint,
    SketchLine,
    SketchCircle
} from './sketch-manager.js';

const DEFAULT_OPTIONS = {
    maxIterations: 60,
    tolerance: 1e-3,
    relax: 0.5
};

const EPS = 1e-6;

const STATUS = {
    UNDER: 'under-constrained',
    OVER: 'over-constrained',
    FULLY: 'fully-constrained'
};

const normalizeAngle = (angle) => {
    let a = angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
};

const toRadians = (value) => {
    if (typeof value !== 'number') return 0;
    if (Math.abs(value) > Math.PI * 2 + 1e-3) {
        return (value * Math.PI) / 180;
    }
    return value;
};

const isPoint = (entity) => entity instanceof SketchPoint;
const isLine = (entity) => entity instanceof SketchLine;
const isCircle = (entity) => entity instanceof SketchCircle;

const getMidpoint = (line) => ({
    x: (line.start.x + line.end.x) * 0.5,
    y: (line.start.y + line.end.y) * 0.5
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

const estimateDOF = (sketch, fixedMap) => {
    let dof = 0;
    sketch.points.forEach((point) => {
        if (isFixedPoint(point, fixedMap)) return;
        dof += 2;
    });
    sketch.circles.forEach(() => {
        dof += 1;
    });
    return dof;
};

const countEquations = (constraints, sketch) => {
    let count = 0;
    constraints.forEach((constraint) => {
        switch (constraint.type) {
            case ConstraintType.COINCIDENT:
                count += 2;
                break;
            case ConstraintType.FIXED: {
                const entity = sketch.getEntity(constraint.entities[0]);
                count += isPoint(entity) ? 2 : 1;
                break;
            }
            case ConstraintType.LENGTH:
            case ConstraintType.RADIUS:
            case ConstraintType.DISTANCE:
            case ConstraintType.HORIZONTAL:
            case ConstraintType.VERTICAL:
            case ConstraintType.PARALLEL:
            case ConstraintType.PERPENDICULAR:
            case ConstraintType.ANGLE:
            case ConstraintType.EQUAL:
            default:
                count += 1;
                break;
        }
    });
    return count;
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
    const adjustedDiff = diff > Math.PI / 2 ? diff - Math.PI : diff < -Math.PI / 2 ? diff + Math.PI : diff;
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
    // LENGTH constraint: set line length or circle radius to specific value
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
    const entities = constraint.entities.map((id) => sketch.getEntity(id));
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
            return applyDistance(entities[0], entities[1], constraint.value || 0, fixedMap, options.relax);
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
            // RADIUS is same as LENGTH for circles
            if (isCircle(entities[0])) {
                return applyLength(entities[0], constraint.value || 0, fixedMap, options.relax);
            }
            return 0;
        default:
            return 0;
    }
};

const collectFixedPoints = (sketch) => {
    const fixedMap = new Map();
    sketch.points.forEach((point) => {
        if (point.fixed) {
            fixedMap.set(point.id, { x: point.x, y: point.y });
        }
    });
    sketch.constraints.forEach((constraint) => {
        if (constraint.type !== ConstraintType.FIXED) return;
        constraint.entities.forEach((id) => {
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
 * Solve all constraints for a sketch.
 */
export const solveSketch = (sketch, options = {}) => {
    if (!sketch) {
        return {
            status: STATUS.UNDER,
            converged: false,
            iterations: 0,
            maxError: 0,
            degreesOfFreedom: 0,
            equationCount: 0
        };
    }

    const config = { ...DEFAULT_OPTIONS, ...options };
    const constraints = Array.from(sketch.constraints.values());
    const fixedMap = collectFixedPoints(sketch);

    let converged = false;
    let iterations = 0;
    let maxError = 0;

    for (let i = 0; i < config.maxIterations; i += 1) {
        maxError = 0;
        constraints.forEach((constraint) => {
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

    const degreesOfFreedom = estimateDOF(sketch, fixedMap);
    const equationCount = countEquations(constraints, sketch);
    let status = STATUS.UNDER;

    if (equationCount < degreesOfFreedom) {
        status = STATUS.UNDER;
    } else if (equationCount > degreesOfFreedom) {
        status = STATUS.OVER;
    } else {
        status = converged ? STATUS.FULLY : STATUS.OVER;
    }

    sketch.fullyConstrained = status === STATUS.FULLY;

    return {
        status,
        converged,
        iterations,
        maxError,
        degreesOfFreedom,
        equationCount
    };
};
