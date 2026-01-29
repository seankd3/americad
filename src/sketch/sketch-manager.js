/**
 * Ameri-CAD Sketch Manager
 * 
 * Manages 2D sketches on construction planes.
 * Sketches are the foundation for parametric modeling - 
 * they can be extruded, revolved, lofted, etc.
 */

import * as THREE from 'three';

// Sketch modes
export const SketchMode = {
    NONE: 'none',
    SELECT: 'select',
    LINE: 'line',
    RECTANGLE: 'rectangle',
    CIRCLE: 'circle',
    ARC: 'arc',
    POINT: 'point',
    DIMENSION: 'dimension',
    CONSTRAINT: 'constraint'
};

// Constraint types
export const ConstraintType = {
    HORIZONTAL: 'horizontal',
    VERTICAL: 'vertical',
    COINCIDENT: 'coincident',
    PERPENDICULAR: 'perpendicular',
    PARALLEL: 'parallel',
    TANGENT: 'tangent',
    EQUAL: 'equal',
    FIXED: 'fixed',
    DISTANCE: 'distance',
    ANGLE: 'angle',
    RADIUS: 'radius'
};

/**
 * A 2D point in sketch space
 */
export class SketchPoint {
    constructor(x = 0, y = 0) {
        this.id = generateSketchId('pt');
        this.x = x;
        this.y = y;
        this.fixed = false;
        this.construction = false;
        this.constraints = [];
    }
    
    distanceTo(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    clone() {
        const p = new SketchPoint(this.x, this.y);
        p.fixed = this.fixed;
        p.construction = this.construction;
        return p;
    }
    
    toArray() {
        return [this.x, this.y];
    }
}

/**
 * A 2D line segment in sketch space
 */
export class SketchLine {
    constructor(start, end) {
        this.id = generateSketchId('ln');
        this.start = start; // SketchPoint
        this.end = end;     // SketchPoint
        this.construction = false;
        this.constraints = [];
    }
    
    get length() {
        return this.start.distanceTo(this.end);
    }
    
    get midpoint() {
        return new SketchPoint(
            (this.start.x + this.end.x) / 2,
            (this.start.y + this.end.y) / 2
        );
    }
    
    get angle() {
        return Math.atan2(
            this.end.y - this.start.y,
            this.end.x - this.start.x
        );
    }
    
    isHorizontal(tolerance = 0.001) {
        return Math.abs(this.end.y - this.start.y) < tolerance;
    }
    
    isVertical(tolerance = 0.001) {
        return Math.abs(this.end.x - this.start.x) < tolerance;
    }
}

/**
 * A circle in sketch space
 */
export class SketchCircle {
    constructor(center, radius) {
        this.id = generateSketchId('cr');
        this.center = center; // SketchPoint
        this.radius = radius;
        this.construction = false;
        this.constraints = [];
    }
    
    get circumference() {
        return 2 * Math.PI * this.radius;
    }
    
    get area() {
        return Math.PI * this.radius * this.radius;
    }
    
    containsPoint(point) {
        return this.center.distanceTo(point) <= this.radius;
    }
}

/**
 * An arc in sketch space
 */
export class SketchArc {
    constructor(center, radius, startAngle, endAngle) {
        this.id = generateSketchId('ar');
        this.center = center; // SketchPoint
        this.radius = radius;
        this.startAngle = startAngle; // radians
        this.endAngle = endAngle;     // radians
        this.construction = false;
        this.constraints = [];
    }
    
    get sweepAngle() {
        let sweep = this.endAngle - this.startAngle;
        if (sweep < 0) sweep += 2 * Math.PI;
        return sweep;
    }
    
    get arcLength() {
        return this.radius * this.sweepAngle;
    }
    
    get startPoint() {
        return new SketchPoint(
            this.center.x + this.radius * Math.cos(this.startAngle),
            this.center.y + this.radius * Math.sin(this.startAngle)
        );
    }
    
    get endPoint() {
        return new SketchPoint(
            this.center.x + this.radius * Math.cos(this.endAngle),
            this.center.y + this.radius * Math.sin(this.endAngle)
        );
    }
}

/**
 * A rectangle (4 lines with constraints)
 */
export class SketchRectangle {
    constructor(corner1, corner2) {
        this.id = generateSketchId('rc');
        
        // Create corner points
        this.p1 = corner1; // bottom-left
        this.p2 = new SketchPoint(corner2.x, corner1.y); // bottom-right
        this.p3 = corner2; // top-right
        this.p4 = new SketchPoint(corner1.x, corner2.y); // top-left
        
        // Create lines
        this.bottom = new SketchLine(this.p1, this.p2);
        this.right = new SketchLine(this.p2, this.p3);
        this.top = new SketchLine(this.p3, this.p4);
        this.left = new SketchLine(this.p4, this.p1);
        
        this.construction = false;
    }
    
    get width() {
        return Math.abs(this.p2.x - this.p1.x);
    }
    
    get height() {
        return Math.abs(this.p4.y - this.p1.y);
    }
    
    get center() {
        return new SketchPoint(
            (this.p1.x + this.p3.x) / 2,
            (this.p1.y + this.p3.y) / 2
        );
    }
    
    get lines() {
        return [this.bottom, this.right, this.top, this.left];
    }
    
    get points() {
        return [this.p1, this.p2, this.p3, this.p4];
    }
}

/**
 * A constraint between sketch entities
 */
export class SketchConstraint {
    constructor(type, entities, value = null) {
        this.id = generateSketchId('cn');
        this.type = type;           // ConstraintType
        this.entities = entities;   // Array of entity IDs
        this.value = value;         // Optional value (for distance, angle, etc.)
        this.satisfied = false;
    }
}

/**
 * A complete sketch on a construction plane
 */
export class Sketch {
    constructor(name, plane) {
        this.id = generateSketchId('sk');
        this.name = name;
        this.plane = plane; // 'xy', 'xz', 'yz', or custom plane
        
        // Sketch entities
        this.points = new Map();
        this.lines = new Map();
        this.circles = new Map();
        this.arcs = new Map();
        this.rectangles = new Map();
        
        // Constraints
        this.constraints = new Map();
        
        // State
        this.closed = false;
        this.fullyConstrained = false;
        
        // Transform from world to sketch coordinates
        this.origin = new THREE.Vector3(0, 0, 0);
        this.normal = this._getPlaneNormal(plane);
        this.xAxis = this._getPlaneXAxis(plane);
        this.yAxis = this._getPlaneYAxis(plane);
    }
    
    _getPlaneNormal(plane) {
        switch (plane) {
            case 'xy': return new THREE.Vector3(0, 0, 1);
            case 'xz': return new THREE.Vector3(0, 1, 0);
            case 'yz': return new THREE.Vector3(1, 0, 0);
            default: return new THREE.Vector3(0, 0, 1);
        }
    }
    
    _getPlaneXAxis(plane) {
        switch (plane) {
            case 'xy': return new THREE.Vector3(1, 0, 0);
            case 'xz': return new THREE.Vector3(1, 0, 0);
            case 'yz': return new THREE.Vector3(0, 0, 1);
            default: return new THREE.Vector3(1, 0, 0);
        }
    }
    
    _getPlaneYAxis(plane) {
        switch (plane) {
            case 'xy': return new THREE.Vector3(0, 1, 0);
            case 'xz': return new THREE.Vector3(0, 0, -1);
            case 'yz': return new THREE.Vector3(0, 1, 0);
            default: return new THREE.Vector3(0, 1, 0);
        }
    }
    
    /**
     * Convert 3D world point to 2D sketch coordinates
     */
    worldToSketch(worldPoint) {
        const local = worldPoint.clone().sub(this.origin);
        return new SketchPoint(
            local.dot(this.xAxis),
            local.dot(this.yAxis)
        );
    }
    
    /**
     * Convert 2D sketch point to 3D world coordinates
     */
    sketchToWorld(sketchPoint) {
        return this.origin.clone()
            .add(this.xAxis.clone().multiplyScalar(sketchPoint.x))
            .add(this.yAxis.clone().multiplyScalar(sketchPoint.y));
    }
    
    /**
     * Add a point to the sketch
     */
    addPoint(x, y) {
        const point = new SketchPoint(x, y);
        this.points.set(point.id, point);
        return point;
    }
    
    /**
     * Add a line to the sketch
     */
    addLine(startX, startY, endX, endY) {
        const start = this.addPoint(startX, startY);
        const end = this.addPoint(endX, endY);
        const line = new SketchLine(start, end);
        this.lines.set(line.id, line);
        return line;
    }
    
    /**
     * Add a circle to the sketch
     */
    addCircle(centerX, centerY, radius) {
        const center = this.addPoint(centerX, centerY);
        const circle = new SketchCircle(center, radius);
        this.circles.set(circle.id, circle);
        return circle;
    }
    
    /**
     * Add a rectangle to the sketch
     */
    addRectangle(x1, y1, x2, y2) {
        const corner1 = this.addPoint(x1, y1);
        const corner2 = this.addPoint(x2, y2);
        const rect = new SketchRectangle(corner1, corner2);
        this.rectangles.set(rect.id, rect);
        
        // Also add individual lines and points
        rect.points.forEach(p => this.points.set(p.id, p));
        rect.lines.forEach(l => this.lines.set(l.id, l));
        
        return rect;
    }
    
    /**
     * Add a constraint to the sketch
     */
    addConstraint(type, entityIds, value = null) {
        const constraint = new SketchConstraint(type, entityIds, value);
        this.constraints.set(constraint.id, constraint);
        
        // Mark entities as constrained
        entityIds.forEach(id => {
            const entity = this.getEntity(id);
            if (entity && entity.constraints) {
                entity.constraints.push(constraint.id);
            }
        });
        
        return constraint;
    }
    
    /**
     * Get any entity by ID
     */
    getEntity(id) {
        return this.points.get(id) ||
               this.lines.get(id) ||
               this.circles.get(id) ||
               this.arcs.get(id) ||
               this.rectangles.get(id);
    }
    
    /**
     * Get all entities as an array
     */
    getAllEntities() {
        return [
            ...this.points.values(),
            ...this.lines.values(),
            ...this.circles.values(),
            ...this.arcs.values(),
            ...this.rectangles.values()
        ];
    }
    
    /**
     * Find point near given coordinates
     */
    findPointNear(x, y, tolerance = 2) {
        for (const point of this.points.values()) {
            if (point.distanceTo(new SketchPoint(x, y)) <= tolerance) {
                return point;
            }
        }
        return null;
    }
    
    /**
     * Clear all entities
     */
    clear() {
        this.points.clear();
        this.lines.clear();
        this.circles.clear();
        this.arcs.clear();
        this.rectangles.clear();
        this.constraints.clear();
    }
    
    /**
     * Serialize sketch to JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            plane: this.plane,
            points: Array.from(this.points.values()).map(p => ({
                id: p.id, x: p.x, y: p.y, fixed: p.fixed, construction: p.construction
            })),
            lines: Array.from(this.lines.values()).map(l => ({
                id: l.id, startId: l.start.id, endId: l.end.id, construction: l.construction
            })),
            circles: Array.from(this.circles.values()).map(c => ({
                id: c.id, centerId: c.center.id, radius: c.radius, construction: c.construction
            })),
            constraints: Array.from(this.constraints.values()).map(c => ({
                id: c.id, type: c.type, entities: c.entities, value: c.value
            }))
        };
    }
}

/**
 * Sketch Manager - handles active sketch and drawing state
 */
export class SketchManager {
    constructor() {
        this.sketches = new Map();
        this.activeSketch = null;
        this.mode = SketchMode.NONE;
        
        // Drawing state
        this.tempPoints = [];
        this.previewEntity = null;
        this.snapPoint = null;
        
        // Selection
        this.selectedEntities = new Set();
        this.hoveredEntity = null;
        
        // Settings
        this.gridSnap = true;
        this.gridSize = 5;
        this.endpointSnap = true;
        this.snapTolerance = 5;
        
        // Callbacks
        this.onSketchUpdate = null;
        this.onModeChange = null;
    }
    
    /**
     * Create a new sketch on a plane
     */
    createSketch(name, plane = 'xy') {
        const sketch = new Sketch(name, plane);
        this.sketches.set(sketch.id, sketch);
        return sketch;
    }
    
    /**
     * Enter sketch editing mode
     */
    enterSketch(sketch) {
        this.activeSketch = sketch;
        this.mode = SketchMode.SELECT;
        this.tempPoints = [];
        this.selectedEntities.clear();
        
        if (this.onModeChange) {
            this.onModeChange(this.mode, sketch);
        }
    }
    
    /**
     * Exit sketch editing mode
     */
    exitSketch() {
        this.activeSketch = null;
        this.mode = SketchMode.NONE;
        this.tempPoints = [];
        this.previewEntity = null;
        this.selectedEntities.clear();
        
        if (this.onModeChange) {
            this.onModeChange(this.mode, null);
        }
    }
    
    /**
     * Set the current drawing mode
     */
    setMode(mode) {
        this.mode = mode;
        this.tempPoints = [];
        this.previewEntity = null;
        
        if (this.onModeChange) {
            this.onModeChange(mode, this.activeSketch);
        }
    }
    
    /**
     * Handle click in sketch
     */
    handleClick(worldPoint) {
        if (!this.activeSketch) return;
        
        // Convert to sketch coordinates
        const sketchPoint = this.activeSketch.worldToSketch(worldPoint);
        
        // Apply snapping
        const snapped = this.applySnap(sketchPoint);
        
        switch (this.mode) {
            case SketchMode.LINE:
                return this.handleLineClick(snapped);
            case SketchMode.RECTANGLE:
                return this.handleRectangleClick(snapped);
            case SketchMode.CIRCLE:
                return this.handleCircleClick(snapped);
            case SketchMode.POINT:
                return this.handlePointClick(snapped);
            case SketchMode.SELECT:
                return this.handleSelectClick(snapped);
        }
    }
    
    /**
     * Handle mouse move in sketch
     */
    handleMove(worldPoint) {
        if (!this.activeSketch) return;
        
        const sketchPoint = this.activeSketch.worldToSketch(worldPoint);
        const snapped = this.applySnap(sketchPoint);
        
        // Update preview based on mode
        switch (this.mode) {
            case SketchMode.LINE:
                if (this.tempPoints.length === 1) {
                    this.previewEntity = new SketchLine(this.tempPoints[0], snapped);
                }
                break;
            case SketchMode.RECTANGLE:
                if (this.tempPoints.length === 1) {
                    this.previewEntity = new SketchRectangle(this.tempPoints[0], snapped);
                }
                break;
            case SketchMode.CIRCLE:
                if (this.tempPoints.length === 1) {
                    const radius = this.tempPoints[0].distanceTo(snapped);
                    this.previewEntity = new SketchCircle(this.tempPoints[0], radius);
                }
                break;
        }
        
        if (this.onSketchUpdate) {
            this.onSketchUpdate(this.activeSketch, this.previewEntity);
        }
    }
    
    /**
     * Handle line mode click
     */
    handleLineClick(point) {
        if (this.tempPoints.length === 0) {
            // First click - start point
            this.tempPoints.push(point.clone());
        } else {
            // Second click - create line
            const line = this.activeSketch.addLine(
                this.tempPoints[0].x, this.tempPoints[0].y,
                point.x, point.y
            );
            
            // Continue line from this point
            this.tempPoints = [point.clone()];
            this.previewEntity = null;
            
            if (this.onSketchUpdate) {
                this.onSketchUpdate(this.activeSketch);
            }
            
            return line;
        }
    }
    
    /**
     * Handle rectangle mode click
     */
    handleRectangleClick(point) {
        if (this.tempPoints.length === 0) {
            this.tempPoints.push(point.clone());
        } else {
            const rect = this.activeSketch.addRectangle(
                this.tempPoints[0].x, this.tempPoints[0].y,
                point.x, point.y
            );
            
            // Auto-add horizontal/vertical constraints
            this.activeSketch.addConstraint(ConstraintType.HORIZONTAL, [rect.bottom.id]);
            this.activeSketch.addConstraint(ConstraintType.HORIZONTAL, [rect.top.id]);
            this.activeSketch.addConstraint(ConstraintType.VERTICAL, [rect.left.id]);
            this.activeSketch.addConstraint(ConstraintType.VERTICAL, [rect.right.id]);
            
            this.tempPoints = [];
            this.previewEntity = null;
            
            if (this.onSketchUpdate) {
                this.onSketchUpdate(this.activeSketch);
            }
            
            return rect;
        }
    }
    
    /**
     * Handle circle mode click
     */
    handleCircleClick(point) {
        if (this.tempPoints.length === 0) {
            // First click - center
            this.tempPoints.push(point.clone());
        } else {
            // Second click - radius point
            const radius = this.tempPoints[0].distanceTo(point);
            const circle = this.activeSketch.addCircle(
                this.tempPoints[0].x, this.tempPoints[0].y,
                radius
            );
            
            this.tempPoints = [];
            this.previewEntity = null;
            
            if (this.onSketchUpdate) {
                this.onSketchUpdate(this.activeSketch);
            }
            
            return circle;
        }
    }
    
    /**
     * Handle point mode click
     */
    handlePointClick(point) {
        const sketchPoint = this.activeSketch.addPoint(point.x, point.y);
        
        if (this.onSketchUpdate) {
            this.onSketchUpdate(this.activeSketch);
        }
        
        return sketchPoint;
    }
    
    /**
     * Handle select mode click
     */
    handleSelectClick(point) {
        // Find entity near click
        const tolerance = this.snapTolerance;
        
        // Check points first
        for (const p of this.activeSketch.points.values()) {
            if (p.distanceTo(point) <= tolerance) {
                this.toggleSelection(p);
                return p;
            }
        }
        
        // Check lines
        for (const line of this.activeSketch.lines.values()) {
            if (this.pointToLineDistance(point, line) <= tolerance) {
                this.toggleSelection(line);
                return line;
            }
        }
        
        // Check circles
        for (const circle of this.activeSketch.circles.values()) {
            const dist = Math.abs(circle.center.distanceTo(point) - circle.radius);
            if (dist <= tolerance) {
                this.toggleSelection(circle);
                return circle;
            }
        }
        
        // Clicked empty space - clear selection
        this.selectedEntities.clear();
        return null;
    }
    
    /**
     * Toggle entity selection
     */
    toggleSelection(entity) {
        if (this.selectedEntities.has(entity.id)) {
            this.selectedEntities.delete(entity.id);
        } else {
            this.selectedEntities.add(entity.id);
        }
    }
    
    /**
     * Apply snap to a point
     */
    applySnap(point) {
        let snapped = point.clone();
        
        // Grid snap
        if (this.gridSnap) {
            snapped.x = Math.round(snapped.x / this.gridSize) * this.gridSize;
            snapped.y = Math.round(snapped.y / this.gridSize) * this.gridSize;
        }
        
        // Endpoint snap
        if (this.endpointSnap && this.activeSketch) {
            const nearPoint = this.activeSketch.findPointNear(point.x, point.y, this.snapTolerance);
            if (nearPoint) {
                snapped = nearPoint.clone();
                this.snapPoint = nearPoint;
            } else {
                this.snapPoint = null;
            }
        }
        
        return snapped;
    }
    
    /**
     * Calculate distance from point to line segment
     */
    pointToLineDistance(point, line) {
        const A = point.x - line.start.x;
        const B = point.y - line.start.y;
        const C = line.end.x - line.start.x;
        const D = line.end.y - line.start.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
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
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Cancel current drawing operation
     */
    cancel() {
        this.tempPoints = [];
        this.previewEntity = null;
        
        if (this.onSketchUpdate) {
            this.onSketchUpdate(this.activeSketch);
        }
    }
    
    /**
     * Finish current drawing (double-click or Enter)
     */
    finish() {
        if (this.mode === SketchMode.LINE && this.tempPoints.length > 0) {
            // Could close the shape if near start point
            this.tempPoints = [];
            this.previewEntity = null;
        }
        
        this.setMode(SketchMode.SELECT);
    }
    
    /**
     * Delete selected entities
     */
    deleteSelected() {
        if (!this.activeSketch) return;
        
        for (const id of this.selectedEntities) {
            this.activeSketch.points.delete(id);
            this.activeSketch.lines.delete(id);
            this.activeSketch.circles.delete(id);
            this.activeSketch.arcs.delete(id);
            this.activeSketch.rectangles.delete(id);
        }
        
        this.selectedEntities.clear();
        
        if (this.onSketchUpdate) {
            this.onSketchUpdate(this.activeSketch);
        }
    }
}

// ID generator
let sketchIdCounter = 0;
function generateSketchId(prefix = 'sk') {
    return `${prefix}_${++sketchIdCounter}`;
}

// Export singleton
export const sketchManager = new SketchManager();

export default {
    SketchMode,
    ConstraintType,
    SketchPoint,
    SketchLine,
    SketchCircle,
    SketchArc,
    SketchRectangle,
    SketchConstraint,
    Sketch,
    SketchManager,
    sketchManager
};
