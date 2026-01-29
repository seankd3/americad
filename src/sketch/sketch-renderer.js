/**
 * Ameri-CAD Sketch Renderer
 * 
 * Renders 2D sketches as Three.js objects on construction planes.
 * Handles:
 * - Sketch geometry (lines, circles, arcs, points)
 * - Preview entities during drawing
 * - Selection highlighting
 * - Constraint visualization
 */

import * as THREE from 'three';
import { SketchMode } from './sketch-manager.js';

// Sketch colors - distinctive blue/cyan for sketch mode
const Colors = {
    GEOMETRY: 0x00aaff,        // Bright blue - normal sketch geometry
    CONSTRUCTION: 0x666688,    // Muted gray-blue - construction geometry
    SELECTED: 0xff6600,        // Orange - selected
    PREVIEW: 0x00ffff,         // Cyan - preview while drawing
    POINT: 0xffff00,           // Yellow - points/vertices
    POINT_SNAP: 0xff00ff,      // Magenta - snap indicator
    CONSTRAINED: 0x00ff88,     // Green-cyan - fully constrained
    UNDER_CONSTRAINED: 0x00aaff, // Blue - under constrained
    ERROR: 0xff4444,           // Red - over constrained / error
    GRID: 0x2a2a4e,            // Dark blue - sketch grid
    GRID_MAJOR: 0x3a3a5e,      // Slightly lighter - major grid lines
    PLANE: 0x1a1a3e,           // Very dark blue - construction plane
    AXIS_X: 0xff4444,          // Red - X axis
    AXIS_Y: 0x44ff44           // Green - Y axis
};

/**
 * Creates Three.js objects for sketch visualization
 */
export class SketchRenderer {
    constructor(scene) {
        this.scene = scene;
        
        // Root group for all sketch objects
        this.sketchGroup = new THREE.Group();
        this.sketchGroup.name = 'sketch-group';
        this.sketchGroup.visible = false;
        scene.add(this.sketchGroup);
        
        // Sub-groups
        this.planeGroup = new THREE.Group();
        this.gridGroup = new THREE.Group();
        this.geometryGroup = new THREE.Group();
        this.previewGroup = new THREE.Group();
        this.pointsGroup = new THREE.Group();
        this.constraintGroup = new THREE.Group();
        
        this.sketchGroup.add(this.planeGroup);
        this.sketchGroup.add(this.gridGroup);
        this.sketchGroup.add(this.geometryGroup);
        this.sketchGroup.add(this.previewGroup);
        this.sketchGroup.add(this.pointsGroup);
        this.sketchGroup.add(this.constraintGroup);
        
        // Materials
        this.materials = {
            line: new THREE.LineBasicMaterial({ color: Colors.GEOMETRY, linewidth: 2 }),
            construction: new THREE.LineBasicMaterial({ color: Colors.CONSTRUCTION, linewidth: 1, transparent: true, opacity: 0.5 }),
            preview: new THREE.LineBasicMaterial({ color: Colors.PREVIEW, linewidth: 2, transparent: true, opacity: 0.7 }),
            selected: new THREE.LineBasicMaterial({ color: Colors.SELECTED, linewidth: 3 }),
            point: new THREE.PointsMaterial({ color: Colors.POINT, size: 8, sizeAttenuation: false }),
            grid: new THREE.LineBasicMaterial({ color: Colors.GRID, transparent: true, opacity: 0.3 }),
            plane: new THREE.MeshBasicMaterial({ color: Colors.PLANE, transparent: true, opacity: 0.1, side: THREE.DoubleSide })
        };
        
        // Settings
        this.gridSize = 5;
        this.gridExtent = 200;
        
        // Current state
        this.activeSketch = null;
        this.selectedIds = new Set();
    }
    
    /**
     * Show sketch editing mode
     */
    enterSketch(sketch) {
        this.activeSketch = sketch;
        this.sketchGroup.visible = true;
        
        // Set up plane orientation
        this.setupPlane(sketch.plane);
        
        // Create grid
        this.createGrid(sketch.plane);
        
        // Render existing geometry
        this.renderSketch(sketch);
    }
    
    /**
     * Exit sketch editing mode
     */
    exitSketch() {
        this.activeSketch = null;
        this.sketchGroup.visible = false;
        this.clearAll();
    }
    
    /**
     * Set up the construction plane visualization
     */
    setupPlane(planeName) {
        this.planeGroup.clear();
        
        // Create a large semi-transparent plane
        const planeGeom = new THREE.PlaneGeometry(this.gridExtent * 2, this.gridExtent * 2);
        const plane = new THREE.Mesh(planeGeom, this.materials.plane);
        
        // Orient based on plane name
        switch (planeName) {
            case 'xy':
                // Already facing Z, do nothing
                break;
            case 'xz':
                plane.rotation.x = -Math.PI / 2;
                break;
            case 'yz':
                plane.rotation.y = Math.PI / 2;
                break;
        }
        
        plane.name = 'construction-plane';
        this.planeGroup.add(plane);
    }
    
    /**
     * Create the sketch grid
     */
    createGrid(planeName) {
        this.gridGroup.clear();
        
        const lines = [];
        const extent = this.gridExtent;
        const step = this.gridSize;
        
        // Create grid lines in sketch 2D space
        for (let i = -extent; i <= extent; i += step) {
            // Vertical lines (in sketch space)
            lines.push(i, -extent);
            lines.push(i, extent);
            
            // Horizontal lines (in sketch space)
            lines.push(-extent, i);
            lines.push(extent, i);
        }
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(lines.length * 1.5); // x, y, z for each point
        
        // Convert 2D to 3D based on plane
        for (let i = 0; i < lines.length; i += 2) {
            const x2d = lines[i];
            const y2d = lines[i + 1];
            const idx = (i / 2) * 3;
            
            switch (planeName) {
                case 'xy':
                    positions[idx] = x2d;
                    positions[idx + 1] = y2d;
                    positions[idx + 2] = 0;
                    break;
                case 'xz':
                    positions[idx] = x2d;
                    positions[idx + 1] = 0;
                    positions[idx + 2] = y2d;
                    break;
                case 'yz':
                    positions[idx] = 0;
                    positions[idx + 1] = y2d;
                    positions[idx + 2] = x2d;
                    break;
            }
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const grid = new THREE.LineSegments(geometry, this.materials.grid);
        grid.name = 'sketch-grid';
        this.gridGroup.add(grid);
        
        // Add axis indicators
        this.addAxisIndicators(planeName);
    }
    
    /**
     * Add colored axis indicators on the sketch plane
     */
    addAxisIndicators(planeName) {
        const length = 50;
        
        // X axis (red)
        const xGeom = new THREE.BufferGeometry();
        const xMat = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 });
        
        // Y axis (green) - in sketch space
        const yGeom = new THREE.BufferGeometry();
        const yMat = new THREE.LineBasicMaterial({ color: 0x44ff44, linewidth: 2 });
        
        let xPositions, yPositions;
        
        switch (planeName) {
            case 'xy':
                xPositions = new Float32Array([0, 0, 0.1, length, 0, 0.1]);
                yPositions = new Float32Array([0, 0, 0.1, 0, length, 0.1]);
                break;
            case 'xz':
                xPositions = new Float32Array([0, 0.1, 0, length, 0.1, 0]);
                yPositions = new Float32Array([0, 0.1, 0, 0, 0.1, -length]);
                break;
            case 'yz':
                xPositions = new Float32Array([0.1, 0, 0, 0.1, 0, length]);
                yPositions = new Float32Array([0.1, 0, 0, 0.1, length, 0]);
                break;
        }
        
        xGeom.setAttribute('position', new THREE.BufferAttribute(xPositions, 3));
        yGeom.setAttribute('position', new THREE.BufferAttribute(yPositions, 3));
        
        const xAxis = new THREE.Line(xGeom, xMat);
        const yAxis = new THREE.Line(yGeom, yMat);
        
        xAxis.name = 'sketch-x-axis';
        yAxis.name = 'sketch-y-axis';
        
        this.gridGroup.add(xAxis);
        this.gridGroup.add(yAxis);
    }
    
    /**
     * Render a sketch
     */
    renderSketch(sketch, selectedIds = new Set()) {
        this.geometryGroup.clear();
        this.pointsGroup.clear();
        this.selectedIds = selectedIds;
        
        // Render lines
        for (const line of sketch.lines.values()) {
            this.renderLine(line, sketch);
        }
        
        // Render circles
        for (const circle of sketch.circles.values()) {
            this.renderCircle(circle, sketch);
        }
        
        // Render arcs
        for (const arc of sketch.arcs.values()) {
            this.renderArc(arc, sketch);
        }
        
        // Render points
        for (const point of sketch.points.values()) {
            this.renderPoint(point, sketch);
        }
    }
    
    /**
     * Render a line
     */
    renderLine(line, sketch) {
        const start3d = sketch.sketchToWorld(line.start);
        const end3d = sketch.sketchToWorld(line.end);
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(
            new Float32Array([start3d.x, start3d.y, start3d.z, end3d.x, end3d.y, end3d.z]),
            3
        ));
        
        const isSelected = this.selectedIds.has(line.id);
        const material = isSelected ? this.materials.selected :
                        line.construction ? this.materials.construction :
                        this.materials.line;
        
        const lineObj = new THREE.Line(geometry, material);
        lineObj.userData.sketchEntity = line;
        lineObj.name = `sketch-line-${line.id}`;
        
        this.geometryGroup.add(lineObj);
    }
    
    /**
     * Render a circle
     */
    renderCircle(circle, sketch) {
        const segments = 64;
        const points = [];
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = circle.center.x + circle.radius * Math.cos(angle);
            const y = circle.center.y + circle.radius * Math.sin(angle);
            const point3d = sketch.sketchToWorld({ x, y });
            points.push(point3d);
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        const isSelected = this.selectedIds.has(circle.id);
        const material = isSelected ? this.materials.selected :
                        circle.construction ? this.materials.construction :
                        this.materials.line;
        
        const circleObj = new THREE.Line(geometry, material);
        circleObj.userData.sketchEntity = circle;
        circleObj.name = `sketch-circle-${circle.id}`;
        
        this.geometryGroup.add(circleObj);
    }
    
    /**
     * Render an arc
     */
    renderArc(arc, sketch) {
        const segments = 32;
        const points = [];
        
        // Get center and radius (computed from three points)
        const center = arc.center;
        const radius = arc.radius;
        
        if (!center || !radius || radius <= 0) {
            // Fallback: just draw a line if arc is degenerate
            const start3d = sketch.sketchToWorld(arc.start);
            const end3d = sketch.sketchToWorld(arc.end);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(
                new Float32Array([start3d.x, start3d.y, start3d.z, end3d.x, end3d.y, end3d.z]),
                3
            ));
            const line = new THREE.Line(geometry, this.materials.line);
            this.geometryGroup.add(line);
            return;
        }
        
        const startAngle = arc.startAngle;
        const sweep = arc.sweepAngle;
        const clockwise = arc._clockwise;
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            let angle;
            if (clockwise) {
                angle = startAngle - t * sweep;
            } else {
                angle = startAngle + t * sweep;
            }
            const x = center.x + radius * Math.cos(angle);
            const y = center.y + radius * Math.sin(angle);
            const point3d = sketch.sketchToWorld({ x, y });
            points.push(point3d);
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        const isSelected = this.selectedIds.has(arc.id);
        const material = isSelected ? this.materials.selected :
                        arc.construction ? this.materials.construction :
                        this.materials.line;
        
        const arcObj = new THREE.Line(geometry, material);
        arcObj.userData.sketchEntity = arc;
        arcObj.name = `sketch-arc-${arc.id}`;
        
        this.geometryGroup.add(arcObj);
    }
    
    /**
     * Render a point
     */
    renderPoint(point, sketch) {
        const point3d = sketch.sketchToWorld(point);
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(
            new Float32Array([point3d.x, point3d.y, point3d.z]),
            3
        ));
        
        const isSelected = this.selectedIds.has(point.id);
        const material = isSelected ? 
            new THREE.PointsMaterial({ color: Colors.SELECTED, size: 12, sizeAttenuation: false }) :
            this.materials.point;
        
        const pointObj = new THREE.Points(geometry, material);
        pointObj.userData.sketchEntity = point;
        pointObj.name = `sketch-point-${point.id}`;
        
        this.pointsGroup.add(pointObj);
    }
    
    /**
     * Render preview entity while drawing
     */
    renderPreview(entity, sketch) {
        this.previewGroup.clear();
        
        if (!entity || !sketch) return;
        
        // Check if it's a SketchArc (has start, mid, end points and _center)
        if (entity._center && entity._radius && entity.start && entity.mid && entity.end) {
            // Arc preview
            const segments = 32;
            const points = [];
            
            const center = entity._center;
            const radius = entity._radius;
            const startAngle = entity._startAngle;
            const sweep = entity.sweepAngle;
            const clockwise = entity._clockwise;
            
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                let angle;
                if (clockwise) {
                    angle = startAngle - t * sweep;
                } else {
                    angle = startAngle + t * sweep;
                }
                const x = center.x + radius * Math.cos(angle);
                const y = center.y + radius * Math.sin(angle);
                const point3d = sketch.sketchToWorld({ x, y });
                points.push(point3d);
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const arc = new THREE.Line(geometry, this.materials.preview);
            this.previewGroup.add(arc);
            
            // Also show the three points
            this.showPreviewPoints([entity.start, entity.mid, entity.end], sketch);
        }
        else if (entity.start && entity.end && !entity.mid) {
            // Line preview (has start and end but no mid - distinguishes from arc)
            const start3d = sketch.sketchToWorld(entity.start);
            const end3d = sketch.sketchToWorld(entity.end);
            
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(
                new Float32Array([start3d.x, start3d.y, start3d.z, end3d.x, end3d.y, end3d.z]),
                3
            ));
            
            const line = new THREE.Line(geometry, this.materials.preview);
            this.previewGroup.add(line);
        }
        else if (entity.center && entity.radius && !entity._center) {
            // Circle preview (has center.x/y directly, not _center)
            const segments = 64;
            const points = [];
            
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const x = entity.center.x + entity.radius * Math.cos(angle);
                const y = entity.center.y + entity.radius * Math.sin(angle);
                const point3d = sketch.sketchToWorld({ x, y });
                points.push(point3d);
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const circle = new THREE.Line(geometry, this.materials.preview);
            this.previewGroup.add(circle);
        }
        else if (entity.p1 && entity.p3) {
            // Rectangle preview
            const corners = [
                sketch.sketchToWorld(entity.p1),
                sketch.sketchToWorld(entity.p2),
                sketch.sketchToWorld(entity.p3),
                sketch.sketchToWorld(entity.p4),
                sketch.sketchToWorld(entity.p1) // close
            ];
            
            const geometry = new THREE.BufferGeometry().setFromPoints(corners);
            const rect = new THREE.Line(geometry, this.materials.preview);
            this.previewGroup.add(rect);
        }
    }
    
    /**
     * Show preview points (for arc drawing)
     */
    showPreviewPoints(points, sketch) {
        const positions = [];
        for (const pt of points) {
            const p3d = sketch.sketchToWorld(pt);
            positions.push(p3d.x, p3d.y, p3d.z);
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        
        const pointsMat = new THREE.PointsMaterial({ color: 0xff00ff, size: 10, sizeAttenuation: false });
        const pointsObj = new THREE.Points(geometry, pointsMat);
        this.previewGroup.add(pointsObj);
    }
    
    /**
     * Show snap indicator
     */
    showSnapIndicator(point, sketch) {
        // Remove existing indicator
        const existing = this.previewGroup.getObjectByName('snap-indicator');
        if (existing) this.previewGroup.remove(existing);
        
        if (!point) return;
        
        const point3d = sketch.sketchToWorld(point);
        
        // Create a small cross or circle at snap point
        const geometry = new THREE.BufferGeometry();
        const size = 3;
        
        // Small square indicator
        const positions = new Float32Array([
            point3d.x - size, point3d.y - size, point3d.z,
            point3d.x + size, point3d.y - size, point3d.z,
            point3d.x + size, point3d.y + size, point3d.z,
            point3d.x - size, point3d.y + size, point3d.z,
            point3d.x - size, point3d.y - size, point3d.z
        ]);
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const indicator = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xff00ff }));
        indicator.name = 'snap-indicator';
        this.previewGroup.add(indicator);
    }
    
    /**
     * Clear all sketch visualization
     */
    clearAll() {
        this.planeGroup.clear();
        this.gridGroup.clear();
        this.geometryGroup.clear();
        this.previewGroup.clear();
        this.pointsGroup.clear();
        this.constraintGroup.clear();
    }
    
    /**
     * Update selection visualization
     */
    updateSelection(selectedIds) {
        this.selectedIds = selectedIds;
        if (this.activeSketch) {
            this.renderSketch(this.activeSketch, selectedIds);
        }
    }
    
    /**
     * Set grid size
     */
    setGridSize(size) {
        this.gridSize = size;
        if (this.activeSketch) {
            this.createGrid(this.activeSketch.plane);
        }
    }
    
    /**
     * Dispose of all resources
     */
    dispose() {
        this.clearAll();
        this.scene.remove(this.sketchGroup);
        
        // Dispose materials
        Object.values(this.materials).forEach(m => m.dispose());
    }
}

export default SketchRenderer;
