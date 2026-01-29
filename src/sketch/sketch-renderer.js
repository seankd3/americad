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
import { ConstraintType } from './sketch-manager.js';
import { EntityState } from './constraint-solver.js';
import { SnapType } from '../ui/snap-manager.js';

// Sketch colors - distinctive blue/cyan for sketch mode
const Colors = {
  GEOMETRY: 0x00aaff, // Bright blue - normal sketch geometry
  CONSTRUCTION: 0x666688, // Muted gray-blue - construction geometry
  SELECTED: 0xff6600, // Orange - selected
  PREVIEW: 0x00ffff, // Cyan - preview while drawing
  POINT: 0xffff00, // Yellow - points/vertices
  POINT_SNAP: 0xff00ff, // Magenta - snap indicator (legacy)
  CONSTRAINED: 0x00ff88, // Green-cyan - fully constrained
  UNDER_CONSTRAINED: 0x00aaff, // Blue - under constrained
  OVER_CONSTRAINED: 0xff4444, // Red - over constrained
  ERROR: 0xff4444, // Red - over constrained / error
  GRID: 0x2a2a4e, // Dark blue - sketch grid
  GRID_MAJOR: 0x3a3a5e, // Slightly lighter - major grid lines
  PLANE: 0x1a1a3e, // Very dark blue - construction plane
  AXIS_X: 0xff4444, // Red - X axis
  AXIS_Y: 0x44ff44, // Green - Y axis

  // Snap indicator colors (per type)
  SNAP_ENDPOINT: 0x00ff00, // Green - endpoint snap
  SNAP_MIDPOINT: 0x00ffff, // Cyan - midpoint snap
  SNAP_CENTER: 0xff00ff, // Magenta - center snap
  SNAP_INTERSECTION: 0xffff00, // Yellow - intersection snap
  SNAP_PERPENDICULAR: 0xff8800, // Orange - perpendicular snap
  SNAP_NEAREST: 0x8888ff, // Light blue - nearest point snap
  SNAP_GRID: 0x666666, // Gray - grid snap
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
    this.statusGroup = new THREE.Group(); // For constraint status indicators

    this.sketchGroup.add(this.planeGroup);
    this.sketchGroup.add(this.gridGroup);
    this.sketchGroup.add(this.geometryGroup);
    this.sketchGroup.add(this.previewGroup);
    this.sketchGroup.add(this.pointsGroup);
    this.sketchGroup.add(this.constraintGroup);
    this.sketchGroup.add(this.statusGroup);

    // Materials
    this.materials = {
      line: new THREE.LineBasicMaterial({ color: Colors.GEOMETRY, linewidth: 2 }),
      construction: new THREE.LineBasicMaterial({
        color: Colors.CONSTRUCTION,
        linewidth: 1,
        transparent: true,
        opacity: 0.5,
      }),
      preview: new THREE.LineBasicMaterial({
        color: Colors.PREVIEW,
        linewidth: 2,
        transparent: true,
        opacity: 0.7,
      }),
      selected: new THREE.LineBasicMaterial({ color: Colors.SELECTED, linewidth: 3 }),
      point: new THREE.PointsMaterial({ color: Colors.POINT, size: 8, sizeAttenuation: false }),
      grid: new THREE.LineBasicMaterial({ color: Colors.GRID, transparent: true, opacity: 0.3 }),
      plane: new THREE.MeshBasicMaterial({
        color: Colors.PLANE,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
      }),
      // Constraint state materials
      underConstrained: new THREE.LineBasicMaterial({
        color: Colors.UNDER_CONSTRAINED,
        linewidth: 2,
      }),
      fullyConstrained: new THREE.LineBasicMaterial({ color: Colors.CONSTRAINED, linewidth: 2 }),
      overConstrained: new THREE.LineBasicMaterial({
        color: Colors.OVER_CONSTRAINED,
        linewidth: 3,
      }),
    };

    // Settings
    this.gridSize = 5;
    this.gridExtent = 200;

    // Current state
    this.activeSketch = null;
    this.selectedIds = new Set();
    this.entityStates = new Map(); // Entity constraint states for coloring
    this.showConstraintColors = true; // Toggle for constraint-based coloring
  }

  /**
   * Set entity constraint states for color coding
   * @param {Map} states - Map of entity ID to EntityState
   */
  setEntityStates(states) {
    this.entityStates = states || new Map();
  }

  /**
   * Get the color for an entity based on its constraint state
   * @param {string} entityId - Entity ID
   * @param {boolean} isConstruction - Whether entity is construction geometry
   * @returns {number} Color hex value
   */
  getEntityColor(entityId, isConstruction = false) {
    if (isConstruction) {
      return Colors.CONSTRUCTION;
    }

    if (!this.showConstraintColors || !this.entityStates.has(entityId)) {
      return Colors.GEOMETRY;
    }

    const state = this.entityStates.get(entityId);
    switch (state) {
      case EntityState.FULLY_CONSTRAINED:
        return Colors.CONSTRAINED;
      case EntityState.OVER_CONSTRAINED:
        return Colors.OVER_CONSTRAINED;
      case EntityState.UNDER_CONSTRAINED:
      default:
        return Colors.UNDER_CONSTRAINED;
    }
  }

  /**
   * Get material for an entity based on its constraint state
   * @param {string} entityId - Entity ID
   * @param {boolean} isConstruction - Whether entity is construction geometry
   * @returns {THREE.Material} Material to use
   */
  getEntityMaterial(entityId, isConstruction = false) {
    if (isConstruction) {
      return this.materials.construction;
    }

    if (!this.showConstraintColors || !this.entityStates.has(entityId)) {
      return this.materials.line;
    }

    const state = this.entityStates.get(entityId);
    switch (state) {
      case EntityState.FULLY_CONSTRAINED:
        return this.materials.fullyConstrained;
      case EntityState.OVER_CONSTRAINED:
        return this.materials.overConstrained;
      case EntityState.UNDER_CONSTRAINED:
      default:
        return this.materials.underConstrained;
    }
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
   * Create the sketch grid with major/minor lines
   */
  createGrid(planeName) {
    this.gridGroup.clear();

    const extent = this.gridExtent;
    const minorStep = this.gridSize;
    const majorStep = minorStep * 10; // Major grid every 10 minor steps

    // Minor grid lines
    const minorLines = [];
    for (let i = -extent; i <= extent; i += minorStep) {
      if (i % majorStep === 0) continue; // Skip major lines
      minorLines.push(i, -extent);
      minorLines.push(i, extent);
      minorLines.push(-extent, i);
      minorLines.push(extent, i);
    }

    // Major grid lines
    const majorLines = [];
    for (let i = -extent; i <= extent; i += majorStep) {
      majorLines.push(i, -extent);
      majorLines.push(i, extent);
      majorLines.push(-extent, i);
      majorLines.push(extent, i);
    }

    // Helper to convert 2D to 3D
    const to3D = lines2D => {
      const positions = new Float32Array(lines2D.length * 1.5);
      for (let i = 0; i < lines2D.length; i += 2) {
        const x2d = lines2D[i];
        const y2d = lines2D[i + 1];
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
      return positions;
    };

    // Create minor grid
    if (minorLines.length > 0) {
      const minorGeom = new THREE.BufferGeometry();
      minorGeom.setAttribute('position', new THREE.BufferAttribute(to3D(minorLines), 3));
      const minorGrid = new THREE.LineSegments(minorGeom, this.materials.grid);
      minorGrid.name = 'sketch-grid-minor';
      this.gridGroup.add(minorGrid);
    }

    // Create major grid
    if (majorLines.length > 0) {
      const majorGeom = new THREE.BufferGeometry();
      majorGeom.setAttribute('position', new THREE.BufferAttribute(to3D(majorLines), 3));
      const majorMat = new THREE.LineBasicMaterial({
        color: Colors.GRID_MAJOR,
        transparent: true,
        opacity: 0.5,
      });
      const majorGrid = new THREE.LineSegments(majorGeom, majorMat);
      majorGrid.name = 'sketch-grid-major';
      this.gridGroup.add(majorGrid);
    }

    // Add axis indicators
    this.addAxisIndicators(planeName);

    // Add origin crosshair
    this.addOriginCrosshair(planeName);
  }

  /**
   * Add origin crosshair indicator
   */
  addOriginCrosshair(planeName) {
    const size = 10;
    const hMat = new THREE.LineBasicMaterial({ color: Colors.AXIS_X, linewidth: 2 });
    const vMat = new THREE.LineBasicMaterial({ color: Colors.AXIS_Y, linewidth: 2 });

    let hPos, vPos;

    switch (planeName) {
      case 'xy':
        hPos = new Float32Array([-size, 0, 0.1, size, 0, 0.1]);
        vPos = new Float32Array([0, -size, 0.1, 0, size, 0.1]);
        break;
      case 'xz':
        hPos = new Float32Array([-size, 0.1, 0, size, 0.1, 0]);
        vPos = new Float32Array([0, 0.1, -size, 0, 0.1, size]);
        break;
      case 'yz':
        hPos = new Float32Array([0.1, 0, -size, 0.1, 0, size]);
        vPos = new Float32Array([0.1, -size, 0, 0.1, size, 0]);
        break;
    }

    const hGeom = new THREE.BufferGeometry();
    hGeom.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
    const hLine = new THREE.Line(hGeom, hMat);
    hLine.name = 'origin-h';

    const vGeom = new THREE.BufferGeometry();
    vGeom.setAttribute('position', new THREE.BufferAttribute(vPos, 3));
    const vLine = new THREE.Line(vGeom, vMat);
    vLine.name = 'origin-v';

    this.gridGroup.add(hLine);
    this.gridGroup.add(vLine);
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
   * Render a sketch with constraint-aware coloring
   */
  renderSketch(sketch, selectedIds = new Set()) {
    this.geometryGroup.clear();
    this.pointsGroup.clear();
    this.constraintGroup.clear();
    this.statusGroup.clear();
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

    // Render splines
    for (const spline of sketch.splines.values()) {
      this.renderSpline(spline, sketch);
    }

    // Render points
    for (const point of sketch.points.values()) {
      this.renderPoint(point, sketch);
    }

    // Render constraint indicators
    this.renderConstraintIndicators(sketch);
  }

  /**
   * Render a line with constraint-aware coloring
   */
  renderLine(line, sketch) {
    const start3d = sketch.sketchToWorld(line.start);
    const end3d = sketch.sketchToWorld(line.end);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([start3d.x, start3d.y, start3d.z, end3d.x, end3d.y, end3d.z]),
        3
      )
    );

    const isSelected = this.selectedIds.has(line.id);
    let material;
    if (isSelected) {
      material = this.materials.selected;
    } else if (line.construction) {
      material = this.materials.construction;
    } else {
      material = this.getEntityMaterial(line.id, line.construction);
    }

    const lineObj = new THREE.Line(geometry, material);
    lineObj.userData.sketchEntity = line;
    lineObj.userData.constraintState = this.entityStates.get(line.id);
    lineObj.name = `sketch-line-${line.id}`;

    this.geometryGroup.add(lineObj);
  }

  /**
   * Render a circle with constraint-aware coloring
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
    let material;
    if (isSelected) {
      material = this.materials.selected;
    } else if (circle.construction) {
      material = this.materials.construction;
    } else {
      material = this.getEntityMaterial(circle.id, circle.construction);
    }

    const circleObj = new THREE.Line(geometry, material);
    circleObj.userData.sketchEntity = circle;
    circleObj.userData.constraintState = this.entityStates.get(circle.id);
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
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([start3d.x, start3d.y, start3d.z, end3d.x, end3d.y, end3d.z]),
          3
        )
      );
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
    const material = isSelected
      ? this.materials.selected
      : arc.construction
        ? this.materials.construction
        : this.materials.line;

    const arcObj = new THREE.Line(geometry, material);
    arcObj.userData.sketchEntity = arc;
    arcObj.name = `sketch-arc-${arc.id}`;

    this.geometryGroup.add(arcObj);
  }

  /**
   * Render a spline curve
   */
  renderSpline(spline, sketch) {
    if (!spline.controlPoints || spline.controlPoints.length < 2) return;

    // Get tessellated points from the spline
    const tessellated = spline.tessellate(20);
    const points = tessellated.map(p => sketch.sketchToWorld(p));

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const isSelected = this.selectedIds.has(spline.id);
    const material = isSelected
      ? this.materials.selected
      : spline.construction
        ? this.materials.construction
        : this.materials.line;

    const splineObj = new THREE.Line(geometry, material);
    splineObj.userData.sketchEntity = spline;
    splineObj.name = `sketch-spline-${spline.id}`;

    this.geometryGroup.add(splineObj);

    // Also render control points as smaller indicators
    const ctrlPositions = [];
    for (const cp of spline.controlPoints) {
      const p3d = sketch.sketchToWorld(cp);
      ctrlPositions.push(p3d.x, p3d.y, p3d.z);
    }

    const ctrlGeom = new THREE.BufferGeometry();
    ctrlGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(ctrlPositions), 3)
    );

    const ctrlMat = new THREE.PointsMaterial({
      color: isSelected ? Colors.SELECTED : 0x00ff88,
      size: 6,
      sizeAttenuation: false,
    });
    const ctrlPoints = new THREE.Points(ctrlGeom, ctrlMat);
    ctrlPoints.name = `spline-ctrl-${spline.id}`;

    this.geometryGroup.add(ctrlPoints);
  }

  /**
   * Render a point with constraint-aware coloring
   */
  renderPoint(point, sketch) {
    const point3d = sketch.sketchToWorld(point);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([point3d.x, point3d.y, point3d.z]), 3)
    );

    const isSelected = this.selectedIds.has(point.id);
    let material;

    if (isSelected) {
      material = new THREE.PointsMaterial({
        color: Colors.SELECTED,
        size: 12,
        sizeAttenuation: false,
      });
    } else if (this.showConstraintColors && this.entityStates.has(point.id)) {
      const state = this.entityStates.get(point.id);
      let color;
      switch (state) {
        case EntityState.FULLY_CONSTRAINED:
          color = Colors.CONSTRAINED;
          break;
        case EntityState.OVER_CONSTRAINED:
          color = Colors.OVER_CONSTRAINED;
          break;
        case EntityState.UNDER_CONSTRAINED:
        default:
          color = Colors.UNDER_CONSTRAINED;
          break;
      }
      material = new THREE.PointsMaterial({ color, size: 8, sizeAttenuation: false });
    } else {
      material = this.materials.point;
    }

    const pointObj = new THREE.Points(geometry, material);
    pointObj.userData.sketchEntity = point;
    pointObj.userData.constraintState = this.entityStates.get(point.id);
    pointObj.name = `sketch-point-${point.id}`;

    this.pointsGroup.add(pointObj);
  }

  /**
   * Render constraint indicators for all constraint types
   * Supports: H/V, tangent, perpendicular, parallel, equal, concentric, midpoint, symmetric, fix, colinear
   */
  renderConstraintIndicators(sketch) {
    if (!sketch || !sketch.constraints) return;

    const constraintColor = Colors.CONSTRAINED;
    const dimensionColor = 0x66ffcc; // Light teal for dimensions

    for (const constraint of sketch.constraints.values()) {
      if (
        constraint.type === ConstraintType.HORIZONTAL ||
        constraint.type === ConstraintType.VERTICAL
      ) {
        // Get the constrained line
        const lineId = constraint.entities[0];
        const line = sketch.lines.get(lineId);
        if (!line) continue;

        // Calculate midpoint of the line
        const midX = (line.start.x + line.end.x) / 2;
        const midY = (line.start.y + line.end.y) / 2;

        // Offset the symbol slightly from the line
        const offsetX = constraint.type === ConstraintType.HORIZONTAL ? 0 : 3;
        const offsetY = constraint.type === ConstraintType.HORIZONTAL ? 3 : 0;

        const symbolPos = sketch.sketchToWorld({
          x: midX + offsetX,
          y: midY + offsetY,
        });

        // Draw the constraint symbol (H or V)
        const symbol = this.createConstraintSymbol(
          constraint.type === ConstraintType.HORIZONTAL ? 'H' : 'V',
          symbolPos,
          constraintColor,
          sketch.plane
        );

        symbol.name = `constraint-${constraint.id}`;
        symbol.userData.constraintId = constraint.id;
        this.constraintGroup.add(symbol);
      } else if (constraint.type === ConstraintType.LENGTH) {
        // Render dimension for line length
        const lineId = constraint.entities[0];
        const line = sketch.lines.get(lineId);
        if (!line) continue;

        const dimensionObj = this.createLineDimension(
          line,
          constraint.value,
          sketch,
          dimensionColor
        );

        if (dimensionObj) {
          dimensionObj.name = `dimension-${constraint.id}`;
          dimensionObj.userData.constraintId = constraint.id;
          dimensionObj.userData.constraintType = 'length';
          dimensionObj.userData.entityId = lineId;
          this.constraintGroup.add(dimensionObj);
        }
      } else if (constraint.type === ConstraintType.RADIUS) {
        // Render dimension for circle radius
        const circleId = constraint.entities[0];
        const circle = sketch.circles.get(circleId);
        if (!circle) continue;

        const dimensionObj = this.createRadiusDimension(
          circle,
          constraint.value,
          sketch,
          dimensionColor
        );

        if (dimensionObj) {
          dimensionObj.name = `dimension-${constraint.id}`;
          dimensionObj.userData.constraintId = constraint.id;
          dimensionObj.userData.constraintType = 'radius';
          dimensionObj.userData.entityId = circleId;
          this.constraintGroup.add(dimensionObj);
        }
      } else if (constraint.type === ConstraintType.COINCIDENT) {
        // Coincident: dot at the shared point location
        const entity1 = sketch.getEntity(constraint.entities[0]);
        if (!entity1) continue;

        const pos = entity1.x !== undefined ? entity1 : entity1.center || entity1.start;
        if (!pos) continue;

        const symbolPos = sketch.sketchToWorld({ x: pos.x, y: pos.y });
        const symbol = this.createAdvancedConstraintSymbol('•', symbolPos, constraintColor, sketch.plane);
        symbol.name = `constraint-${constraint.id}`;
        symbol.userData.constraintId = constraint.id;
        this.constraintGroup.add(symbol);
      } else if (constraint.type === ConstraintType.TANGENT) {
        // Tangent: T symbol between the two entities
        const entity1 = sketch.getEntity(constraint.entities[0]);
        const entity2 = sketch.getEntity(constraint.entities[1]);
        if (!entity1 || !entity2) continue;

        // Find connection point (approximate center between entities)
        const pos = this.getConstraintMidpoint(entity1, entity2, sketch);
        if (!pos) continue;

        const symbol = this.createAdvancedConstraintSymbol('T', pos, constraintColor, sketch.plane);
        symbol.name = `constraint-${constraint.id}`;
        symbol.userData.constraintId = constraint.id;
        this.constraintGroup.add(symbol);
      } else if (constraint.type === ConstraintType.PERPENDICULAR) {
        // Perpendicular: ⊥ symbol
        const entity1 = sketch.getEntity(constraint.entities[0]);
        const entity2 = sketch.getEntity(constraint.entities[1]);
        if (!entity1 || !entity2) continue;

        const pos = this.getConstraintMidpoint(entity1, entity2, sketch);
        if (!pos) continue;

        const symbol = this.createAdvancedConstraintSymbol('⊥', pos, constraintColor, sketch.plane);
        symbol.name = `constraint-${constraint.id}`;
        symbol.userData.constraintId = constraint.id;
        this.constraintGroup.add(symbol);
      } else if (constraint.type === ConstraintType.PARALLEL) {
        // Parallel: ∥ symbol
        const entity1 = sketch.getEntity(constraint.entities[0]);
        const entity2 = sketch.getEntity(constraint.entities[1]);
        if (!entity1 || !entity2) continue;

        const pos = this.getConstraintMidpoint(entity1, entity2, sketch);
        if (!pos) continue;

        const symbol = this.createAdvancedConstraintSymbol('∥', pos, constraintColor, sketch.plane);
        symbol.name = `constraint-${constraint.id}`;
        symbol.userData.constraintId = constraint.id;
        this.constraintGroup.add(symbol);
      } else if (constraint.type === ConstraintType.EQUAL) {
        // Equal: = symbol on each entity
        for (const entityId of constraint.entities) {
          const entity = sketch.getEntity(entityId);
          if (!entity) continue;

          const pos = this.getEntityCenter(entity, sketch);
          if (!pos) continue;

          const symbol = this.createAdvancedConstraintSymbol('=', pos, constraintColor, sketch.plane);
          symbol.name = `constraint-${constraint.id}-${entityId}`;
          symbol.userData.constraintId = constraint.id;
          this.constraintGroup.add(symbol);
        }
      } else if (constraint.type === ConstraintType.CONCENTRIC) {
        // Concentric: ◎ symbol at shared center
        const circle1 = sketch.getEntity(constraint.entities[0]);
        if (!circle1 || !circle1.center) continue;

        const symbolPos = sketch.sketchToWorld({ x: circle1.center.x, y: circle1.center.y });
        const symbol = this.createAdvancedConstraintSymbol('◎', symbolPos, constraintColor, sketch.plane);
        symbol.name = `constraint-${constraint.id}`;
        symbol.userData.constraintId = constraint.id;
        this.constraintGroup.add(symbol);
      } else if (constraint.type === ConstraintType.MIDPOINT) {
        // Midpoint: M symbol at the point
        const point = sketch.getEntity(constraint.entities[0]);
        if (!point || point.x === undefined) continue;

        const symbolPos = sketch.sketchToWorld({ x: point.x, y: point.y });
        const symbol = this.createAdvancedConstraintSymbol('M', symbolPos, constraintColor, sketch.plane);
        symbol.name = `constraint-${constraint.id}`;
        symbol.userData.constraintId = constraint.id;
        this.constraintGroup.add(symbol);
      } else if (constraint.type === ConstraintType.SYMMETRIC) {
        // Symmetric: ⧫ symbol between symmetric entities
        const entity1 = sketch.getEntity(constraint.entities[0]);
        const entity2 = sketch.getEntity(constraint.entities[1]);
        if (!entity1 || !entity2) continue;

        const pos = this.getConstraintMidpoint(entity1, entity2, sketch);
        if (!pos) continue;

        const symbol = this.createAdvancedConstraintSymbol('⧫', pos, constraintColor, sketch.plane);
        symbol.name = `constraint-${constraint.id}`;
        symbol.userData.constraintId = constraint.id;
        this.constraintGroup.add(symbol);
      } else if (constraint.type === ConstraintType.FIXED || constraint.type === 'fix') {
        // Fix: pin/anchor icon at entity location
        const entity = sketch.getEntity(constraint.entities[0]);
        if (!entity) continue;

        const pos = this.getEntityCenter(entity, sketch);
        if (!pos) continue;

        const symbol = this.createAdvancedConstraintSymbol('⚓', pos, 0xff6600, sketch.plane);
        symbol.name = `constraint-${constraint.id}`;
        symbol.userData.constraintId = constraint.id;
        this.constraintGroup.add(symbol);
      } else if (constraint.type === ConstraintType.COLINEAR) {
        // Colinear: dash symbol between lines
        const line1 = sketch.getEntity(constraint.entities[0]);
        const line2 = sketch.getEntity(constraint.entities[1]);
        if (!line1 || !line2) continue;

        const pos = this.getConstraintMidpoint(line1, line2, sketch);
        if (!pos) continue;

        const symbol = this.createAdvancedConstraintSymbol('—', pos, constraintColor, sketch.plane);
        symbol.name = `constraint-${constraint.id}`;
        symbol.userData.constraintId = constraint.id;
        this.constraintGroup.add(symbol);
      }
    }
  }

  /**
   * Get the center position of an entity for symbol placement
   */
  getEntityCenter(entity, sketch) {
    if (!entity) return null;

    if (entity.x !== undefined && entity.y !== undefined) {
      // It's a point
      return sketch.sketchToWorld({ x: entity.x, y: entity.y });
    }

    if (entity.start && entity.end) {
      // It's a line
      const midX = (entity.start.x + entity.end.x) / 2;
      const midY = (entity.start.y + entity.end.y) / 2;
      return sketch.sketchToWorld({ x: midX, y: midY + 3 }); // Offset slightly
    }

    if (entity.center) {
      // It's a circle or arc
      return sketch.sketchToWorld({ x: entity.center.x, y: entity.center.y + entity.radius + 3 });
    }

    return null;
  }

  /**
   * Get a midpoint between two entities for constraint symbol placement
   */
  getConstraintMidpoint(entity1, entity2, sketch) {
    const center1 = this.getEntityCenterCoords(entity1);
    const center2 = this.getEntityCenterCoords(entity2);

    if (!center1 || !center2) return null;

    const midX = (center1.x + center2.x) / 2;
    const midY = (center1.y + center2.y) / 2;

    return sketch.sketchToWorld({ x: midX, y: midY });
  }

  /**
   * Get center coordinates of an entity (2D, not world)
   */
  getEntityCenterCoords(entity) {
    if (!entity) return null;

    if (entity.x !== undefined && entity.y !== undefined) {
      return { x: entity.x, y: entity.y };
    }

    if (entity.start && entity.end) {
      return {
        x: (entity.start.x + entity.end.x) / 2,
        y: (entity.start.y + entity.end.y) / 2,
      };
    }

    if (entity.center) {
      return { x: entity.center.x, y: entity.center.y };
    }

    return null;
  }

  /**
   * Create an advanced constraint symbol using canvas text
   */
  createAdvancedConstraintSymbol(symbol, position, color, _plane) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 64;
    canvas.height = 64;

    // Background circle
    ctx.fillStyle = 'rgba(26, 26, 62, 0.85)';
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();

    // Border
    const hexColor = '#' + color.toString(16).padStart(6, '0');
    ctx.strokeStyle = hexColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Symbol text
    ctx.fillStyle = hexColor;
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 32, 32);

    // Create sprite
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.position.z += 0.3;
    sprite.scale.set(4, 4, 1);

    return sprite;
  }

  /**
   * Create a linear dimension display for a line
   * Standard CAD dimension style: extension lines + dimension line + arrows + value
   */
  createLineDimension(line, value, sketch, color) {
    const group = new THREE.Group();

    const start = line.start;
    const end = line.end;

    // Calculate line properties
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy);
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    // Calculate perpendicular offset direction
    const perpX = -dy / lineLength;
    const perpY = dx / lineLength;
    const offset = 8; // Distance from line to dimension

    // Dimension line endpoints (offset from the actual line)
    const dimStart = { x: start.x + perpX * offset, y: start.y + perpY * offset };
    const dimEnd = { x: end.x + perpX * offset, y: end.y + perpY * offset };
    const dimMid = { x: midX + perpX * offset, y: midY + perpY * offset };

    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 1,
      transparent: true,
      opacity: 0.9,
    });

    // Extension lines (from geometry to dimension line)
    const extOffset = 2; // Small gap from geometry
    const extLength = offset + 2; // Extend slightly past dimension line

    // Start extension line
    const ext1Start = sketch.sketchToWorld({
      x: start.x + perpX * extOffset,
      y: start.y + perpY * extOffset,
    });
    const ext1End = sketch.sketchToWorld({
      x: start.x + perpX * extLength,
      y: start.y + perpY * extLength,
    });
    const ext1Geom = new THREE.BufferGeometry();
    ext1Geom.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([ext1Start.x, ext1Start.y, ext1Start.z, ext1End.x, ext1End.y, ext1End.z]),
        3
      )
    );
    group.add(new THREE.Line(ext1Geom, material));

    // End extension line
    const ext2Start = sketch.sketchToWorld({
      x: end.x + perpX * extOffset,
      y: end.y + perpY * extOffset,
    });
    const ext2End = sketch.sketchToWorld({
      x: end.x + perpX * extLength,
      y: end.y + perpY * extLength,
    });
    const ext2Geom = new THREE.BufferGeometry();
    ext2Geom.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([ext2Start.x, ext2Start.y, ext2Start.z, ext2End.x, ext2End.y, ext2End.z]),
        3
      )
    );
    group.add(new THREE.Line(ext2Geom, material));

    // Dimension line (with gap for text)
    const dimStart3D = sketch.sketchToWorld(dimStart);
    const dimEnd3D = sketch.sketchToWorld(dimEnd);

    // Draw dimension line in two parts with gap for text
    const gapSize = Math.min(12, lineLength * 0.4);
    const dirX = dx / lineLength;
    const dirY = dy / lineLength;

    // Left part of dimension line
    const dimLeftEnd = sketch.sketchToWorld({
      x: dimMid.x - (dirX * gapSize) / 2,
      y: dimMid.y - (dirY * gapSize) / 2,
    });
    const dimLineLeft = new THREE.BufferGeometry();
    dimLineLeft.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          dimStart3D.x,
          dimStart3D.y,
          dimStart3D.z,
          dimLeftEnd.x,
          dimLeftEnd.y,
          dimLeftEnd.z,
        ]),
        3
      )
    );
    group.add(new THREE.Line(dimLineLeft, material));

    // Right part of dimension line
    const dimRightStart = sketch.sketchToWorld({
      x: dimMid.x + (dirX * gapSize) / 2,
      y: dimMid.y + (dirY * gapSize) / 2,
    });
    const dimLineRight = new THREE.BufferGeometry();
    dimLineRight.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          dimRightStart.x,
          dimRightStart.y,
          dimRightStart.z,
          dimEnd3D.x,
          dimEnd3D.y,
          dimEnd3D.z,
        ]),
        3
      )
    );
    group.add(new THREE.Line(dimLineRight, material));

    // Arrows at ends
    const arrowSize = 2;
    group.add(this.createArrow(dimStart3D, dirX, dirY, arrowSize, sketch.plane, color));
    group.add(this.createArrow(dimEnd3D, -dirX, -dirY, arrowSize, sketch.plane, color));

    // Value text (using sprites for always-facing text)
    const dimMid3D = sketch.sketchToWorld(dimMid);
    const textSprite = this.createDimensionText(value.toFixed(1), dimMid3D, color);
    group.add(textSprite);

    return group;
  }

  /**
   * Create a radius dimension display for a circle
   */
  createRadiusDimension(circle, value, sketch, color) {
    const group = new THREE.Group();

    const center = circle.center;
    const radius = value;

    // Draw radius line from center to edge at 45 degrees
    const angle = Math.PI / 4; // 45 degrees
    const edgeX = center.x + radius * Math.cos(angle);
    const edgeY = center.y + radius * Math.sin(angle);

    const centerPos = sketch.sketchToWorld(center);
    const edgePos = sketch.sketchToWorld({ x: edgeX, y: edgeY });

    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 1,
      transparent: true,
      opacity: 0.9,
    });

    // Radius line
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([centerPos.x, centerPos.y, centerPos.z, edgePos.x, edgePos.y, edgePos.z]),
        3
      )
    );
    group.add(new THREE.Line(lineGeom, material));

    // Arrow at edge
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    group.add(this.createArrow(edgePos, -dirX, -dirY, 2, sketch.plane, color));

    // Text at midpoint of radius line
    const midX = center.x + radius * 0.6 * Math.cos(angle);
    const midY = center.y + radius * 0.6 * Math.sin(angle);
    const textPos = sketch.sketchToWorld({ x: midX, y: midY });
    const textSprite = this.createDimensionText('R' + value.toFixed(1), textPos, color);
    group.add(textSprite);

    return group;
  }

  /**
   * Create an arrow for dimension lines
   */
  createArrow(position, dirX, dirY, size, plane, color) {
    const group = new THREE.Group();

    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 1,
    });

    // Arrow head lines
    const arrowAngle = Math.PI / 6; // 30 degrees

    // Calculate arrow head points
    const cos = Math.cos(arrowAngle);
    const sin = Math.sin(arrowAngle);

    // Rotate direction for arrow wings
    const wing1X = dirX * cos - dirY * sin;
    const wing1Y = dirX * sin + dirY * cos;
    const wing2X = dirX * cos + dirY * sin;
    const wing2Y = -dirX * sin + dirY * cos;

    // Create arrow geometry based on plane
    const getOffset = (dx, dy) => {
      switch (plane) {
        case 'xy':
          return { x: dx, y: dy, z: 0.1 };
        case 'xz':
          return { x: dx, y: 0.1, z: dy };
        case 'yz':
          return { x: 0.1, y: dy, z: dx };
        default:
          return { x: dx, y: dy, z: 0.1 };
      }
    };

    const tip = getOffset(0, 0);
    const w1 = getOffset(wing1X * size, wing1Y * size);
    const w2 = getOffset(wing2X * size, wing2Y * size);

    const arrowGeom = new THREE.BufferGeometry();
    arrowGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          position.x + w1.x,
          position.y + w1.y,
          position.z + w1.z,
          position.x + tip.x,
          position.y + tip.y,
          position.z + tip.z,
          position.x + w2.x,
          position.y + w2.y,
          position.z + w2.z,
        ]),
        3
      )
    );

    const arrow = new THREE.Line(arrowGeom, material);
    group.add(arrow);

    return group;
  }

  /**
   * Create dimension text using a sprite
   */
  createDimensionText(text, position, _color) {
    // Create canvas for text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 128;
    canvas.height = 64;

    // Background
    ctx.fillStyle = 'rgba(26, 26, 62, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = '#66ffcc';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    // Text
    ctx.fillStyle = '#66ffcc';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    // Create sprite
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.position.z += 0.5; // Slightly above plane
    sprite.scale.set(8, 4, 1);

    return sprite;
  }

  /**
   * Create a constraint symbol (H or V letter)
   */
  createConstraintSymbol(letter, position, color, plane) {
    const group = new THREE.Group();
    const size = 2.5; // Symbol size

    // Create lines that form the letter
    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
    });

    let letterPoints;

    if (letter === 'H') {
      // Draw an "H" shape
      letterPoints = [
        // Left vertical
        [
          { x: -size / 2, y: -size / 2 },
          { x: -size / 2, y: size / 2 },
        ],
        // Right vertical
        [
          { x: size / 2, y: -size / 2 },
          { x: size / 2, y: size / 2 },
        ],
        // Horizontal crossbar
        [
          { x: -size / 2, y: 0 },
          { x: size / 2, y: 0 },
        ],
      ];
    } else if (letter === 'V') {
      // Draw a "V" shape
      letterPoints = [
        // Left diagonal
        [
          { x: -size / 2, y: size / 2 },
          { x: 0, y: -size / 2 },
        ],
        // Right diagonal
        [
          { x: 0, y: -size / 2 },
          { x: size / 2, y: size / 2 },
        ],
      ];
    }

    for (const segment of letterPoints) {
      const positions = [];
      for (const pt of segment) {
        // Transform based on sketch plane
        let x3d, y3d, z3d;
        switch (plane) {
          case 'xy':
            x3d = position.x + pt.x;
            y3d = position.y + pt.y;
            z3d = position.z + 0.2; // Slightly above plane
            break;
          case 'xz':
            x3d = position.x + pt.x;
            y3d = position.y + 0.2;
            z3d = position.z + pt.y;
            break;
          case 'yz':
            x3d = position.x + 0.2;
            y3d = position.y + pt.y;
            z3d = position.z + pt.x;
            break;
          default:
            x3d = position.x + pt.x;
            y3d = position.y + pt.y;
            z3d = position.z + 0.2;
        }
        positions.push(x3d, y3d, z3d);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

      const lineObj = new THREE.Line(geometry, material);
      group.add(lineObj);
    }

    // Add a small background circle for better visibility
    const bgGeometry = new THREE.CircleGeometry(size * 0.8, 16);
    const bgMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a1a3e,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const bgCircle = new THREE.Mesh(bgGeometry, bgMaterial);

    // Position and orient the background circle
    switch (plane) {
      case 'xy':
        bgCircle.position.set(position.x, position.y, position.z + 0.1);
        break;
      case 'xz':
        bgCircle.position.set(position.x, position.y + 0.1, position.z);
        bgCircle.rotation.x = -Math.PI / 2;
        break;
      case 'yz':
        bgCircle.position.set(position.x + 0.1, position.y, position.z);
        bgCircle.rotation.y = Math.PI / 2;
        break;
    }

    group.add(bgCircle);

    return group;
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
    } else if (entity.start && entity.end && !entity.mid) {
      // Line preview (has start and end but no mid - distinguishes from arc)
      const start3d = sketch.sketchToWorld(entity.start);
      const end3d = sketch.sketchToWorld(entity.end);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([start3d.x, start3d.y, start3d.z, end3d.x, end3d.y, end3d.z]),
          3
        )
      );

      const line = new THREE.Line(geometry, this.materials.preview);
      this.previewGroup.add(line);
    } else if (entity.center && entity.radius && !entity._center) {
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
    } else if (entity.p1 && entity.p3) {
      // Rectangle preview
      const corners = [
        sketch.sketchToWorld(entity.p1),
        sketch.sketchToWorld(entity.p2),
        sketch.sketchToWorld(entity.p3),
        sketch.sketchToWorld(entity.p4),
        sketch.sketchToWorld(entity.p1), // close
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(corners);
      const rect = new THREE.Line(geometry, this.materials.preview);
      this.previewGroup.add(rect);
    } else if (entity.controlPoints && entity._isPreview) {
      // Spline preview
      if (entity.controlPoints.length >= 2) {
        const tessellated = entity.tessellate(20);
        const points = tessellated.map(p => sketch.sketchToWorld(p));

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const spline = new THREE.Line(geometry, this.materials.preview);
        this.previewGroup.add(spline);

        // Show control points
        this.showPreviewPoints(entity.controlPoints, sketch);
      }
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

    const pointsMat = new THREE.PointsMaterial({
      color: 0xff00ff,
      size: 10,
      sizeAttenuation: false,
    });
    const pointsObj = new THREE.Points(geometry, pointsMat);
    this.previewGroup.add(pointsObj);
  }

  /**
   * Show snap indicator (legacy - point only)
   */
  showSnapIndicator(point, sketch) {
    this.showSnapResult(point ? { point, type: SnapType.ENDPOINT } : null, sketch);
  }

  /**
   * Show snap indicator with full SnapResult info
   * Displays different shapes/colors for different snap types
   */
  showSnapResult(snapResult, sketch, showLabel = true) {
    // Remove existing indicators
    const existing = this.previewGroup.getObjectByName('snap-indicator');
    if (existing) this.previewGroup.remove(existing);
    const existingLabel = this.previewGroup.getObjectByName('snap-label');
    if (existingLabel) this.previewGroup.remove(existingLabel);

    if (!snapResult || !sketch) return;

    const point3d = sketch.sketchToWorld(snapResult.point);
    const snapType = snapResult.type || SnapType.ENDPOINT;
    const color = snapType.color || 0xff00ff;
    const size = 4;

    const group = new THREE.Group();
    group.name = 'snap-indicator';

    // Draw different shapes based on snap type
    const shape = snapType.shape || 'square';
    const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });

    let positions;

    switch (shape) {
      case 'square':
        // Square for endpoints
        positions = new Float32Array([
          point3d.x - size,
          point3d.y - size,
          point3d.z + 0.1,
          point3d.x + size,
          point3d.y - size,
          point3d.z + 0.1,
          point3d.x + size,
          point3d.y + size,
          point3d.z + 0.1,
          point3d.x - size,
          point3d.y + size,
          point3d.z + 0.1,
          point3d.x - size,
          point3d.y - size,
          point3d.z + 0.1,
        ]);
        break;

      case 'triangle':
        // Triangle for midpoints
        positions = new Float32Array([
          point3d.x,
          point3d.y + size * 1.2,
          point3d.z + 0.1,
          point3d.x - size,
          point3d.y - size * 0.6,
          point3d.z + 0.1,
          point3d.x + size,
          point3d.y - size * 0.6,
          point3d.z + 0.1,
          point3d.x,
          point3d.y + size * 1.2,
          point3d.z + 0.1,
        ]);
        break;

      case 'circle':
        // Circle for centers
        const segments = 16;
        const circlePositions = [];
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          circlePositions.push(
            point3d.x + size * Math.cos(angle),
            point3d.y + size * Math.sin(angle),
            point3d.z + 0.1
          );
        }
        positions = new Float32Array(circlePositions);
        break;

      case 'cross':
        // Cross (X) for intersections
        positions = new Float32Array([
          point3d.x - size,
          point3d.y - size,
          point3d.z + 0.1,
          point3d.x + size,
          point3d.y + size,
          point3d.z + 0.1,
          point3d.x + size,
          point3d.y - size,
          point3d.z + 0.1, // Move pen
          point3d.x + size,
          point3d.y - size,
          point3d.z + 0.1,
          point3d.x - size,
          point3d.y + size,
          point3d.z + 0.1,
        ]);
        break;

      case 'diamond':
        // Diamond for nearest point
        positions = new Float32Array([
          point3d.x,
          point3d.y - size,
          point3d.z + 0.1,
          point3d.x + size,
          point3d.y,
          point3d.z + 0.1,
          point3d.x,
          point3d.y + size,
          point3d.z + 0.1,
          point3d.x - size,
          point3d.y,
          point3d.z + 0.1,
          point3d.x,
          point3d.y - size,
          point3d.z + 0.1,
        ]);
        break;

      case 'dot':
      default:
        // Small dot for grid snap
        const dotSegs = 8;
        const dotPositions = [];
        for (let i = 0; i <= dotSegs; i++) {
          const angle = (i / dotSegs) * Math.PI * 2;
          dotPositions.push(
            point3d.x + size * 0.5 * Math.cos(angle),
            point3d.y + size * 0.5 * Math.sin(angle),
            point3d.z + 0.1
          );
        }
        positions = new Float32Array(dotPositions);
        break;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const indicator = new THREE.Line(geometry, material);
    group.add(indicator);

    // Add a highlight point in the center
    const centerGeom = new THREE.BufferGeometry();
    centerGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([point3d.x, point3d.y, point3d.z + 0.15]), 3)
    );
    const centerMat = new THREE.PointsMaterial({
      color,
      size: 6,
      sizeAttenuation: false,
    });
    const centerPoint = new THREE.Points(centerGeom, centerMat);
    group.add(centerPoint);

    this.previewGroup.add(group);

    // Add label if enabled (optional, can be toggled)
    if (showLabel && snapType.name && snapType !== SnapType.GRID) {
      this._showSnapLabel(snapType.name, point3d, color, sketch.plane);
    }
  }

  /**
   * Show snap type label near indicator
   */
  _showSnapLabel(text, position, color, plane) {
    // Create a simple text sprite or use existing constraint symbol approach
    // For now, we'll create a minimal indicator group
    const labelGroup = new THREE.Group();
    labelGroup.name = 'snap-label';

    // Create small text-like geometry using lines
    // This is a simplified approach - in production you'd use TextGeometry or sprites
    const offsetX = 6;
    const offsetY = 6;

    // Position label offset from snap point
    let labelPos;
    switch (plane) {
      case 'xy':
        labelPos = new THREE.Vector3(position.x + offsetX, position.y + offsetY, position.z + 0.2);
        break;
      case 'xz':
        labelPos = new THREE.Vector3(position.x + offsetX, position.y + 0.2, position.z + offsetY);
        break;
      case 'yz':
        labelPos = new THREE.Vector3(position.x + 0.2, position.y + offsetY, position.z + offsetX);
        break;
      default:
        labelPos = new THREE.Vector3(position.x + offsetX, position.y + offsetY, position.z + 0.2);
    }

    // Draw a small connecting line from indicator to label area
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          position.x,
          position.y,
          position.z + 0.15,
          labelPos.x - 2,
          labelPos.y - 2,
          labelPos.z,
        ]),
        3
      )
    );

    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 });
    const line = new THREE.Line(lineGeom, lineMat);
    labelGroup.add(line);

    // Add a small dot at label position
    const dotGeom = new THREE.BufferGeometry();
    dotGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([labelPos.x, labelPos.y, labelPos.z]), 3)
    );
    const dotMat = new THREE.PointsMaterial({ color, size: 4, sizeAttenuation: false });
    labelGroup.add(new THREE.Points(dotGeom, dotMat));

    this.previewGroup.add(labelGroup);
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
    this.statusGroup.clear();
    this.entityStates.clear();
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
