/**
 * Ameri-CAD Reference Geometry
 *
 * Construction planes, axes, and points for complex modeling.
 * Reference geometry enables:
 * - Sketching on any plane, not just XY/XZ/YZ
 * - Creating patterns around custom axes
 * - Mirroring across angled planes
 * - Building complex assemblies
 */

import * as THREE from 'three';

// Unique ID generator for reference geometry
let nextRefId = 1;
function generateRefId(prefix) {
  return `${prefix}_${nextRefId++}`;
}

/**
 * Reset the reference ID counter (used when loading documents)
 * @param {number} startFrom - Next ID to use
 */
export function resetRefIdCounter(startFrom = 1) {
  nextRefId = startFrom;
}

/**
 * Reference Plane - a construction plane for sketching and mirroring
 */
export class ReferencePlane {
  /**
   * Create a reference plane
   * @param {number[]} origin - [x, y, z] origin point
   * @param {number[]} normal - [nx, ny, nz] plane normal (will be normalized)
   * @param {string} name - Display name
   * @param {Object} options - Additional options
   */
  constructor(origin, normal, name, options = {}) {
    this.id = generateRefId('plane');
    this.type = 'plane';
    this.origin = [...origin];
    this.normal = normalizeVector(normal);
    this.name = name || `Plane_${this.id}`;
    this.visible = options.visible ?? true;
    this.size = options.size ?? 100; // Display size
    this.color = options.color ?? 0x4488ff;
    this.opacity = options.opacity ?? 0.3;
    this.createdAt = Date.now();
    this.modifiedAt = Date.now();

    // For angle-based planes, store the reference
    this.baseplane = options.baseplane ?? null;
    this.angle = options.angle ?? 0;
  }

  /**
   * Get the U direction vector (in-plane, perpendicular to normal)
   * @returns {number[]} U direction vector
   */
  getUDirection() {
    // Choose a vector not parallel to normal
    const up = Math.abs(this.normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    // U = up × normal (cross product)
    return normalizeVector(cross(up, this.normal));
  }

  /**
   * Get the V direction vector (in-plane, perpendicular to U and normal)
   * @returns {number[]} V direction vector
   */
  getVDirection() {
    const u = this.getUDirection();
    // V = normal × U
    return normalizeVector(cross(this.normal, u));
  }

  /**
   * Project a 3D point onto this plane
   * @param {number[]} point - [x, y, z] point to project
   * @returns {number[]} Projected point
   */
  projectPoint(point) {
    const d = dot(sub(point, this.origin), this.normal);
    return sub(point, scale(this.normal, d));
  }

  /**
   * Get signed distance from a point to this plane
   * @param {number[]} point - [x, y, z] point
   * @returns {number} Signed distance (positive if in front of plane)
   */
  distanceToPoint(point) {
    return dot(sub(point, this.origin), this.normal);
  }

  /**
   * Get Three.js mesh for visualization
   * @returns {THREE.Mesh} Plane visualization mesh
   */
  toMesh() {
    const geometry = new THREE.PlaneGeometry(this.size, this.size);
    const material = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: this.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Position at origin
    mesh.position.set(...this.origin);

    // Orient to normal using quaternion
    const up = new THREE.Vector3(0, 0, 1);
    const normalVec = new THREE.Vector3(...this.normal);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, normalVec);
    mesh.quaternion.copy(quaternion);

    // Add border for visibility
    const borderGeometry = new THREE.EdgesGeometry(geometry);
    const borderMaterial = new THREE.LineBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.8,
    });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    mesh.add(border);

    // Store reference for interaction
    mesh.userData.refGeometry = this;
    mesh.visible = this.visible;

    return mesh;
  }

  /**
   * Serialize to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      origin: this.origin,
      normal: this.normal,
      name: this.name,
      visible: this.visible,
      size: this.size,
      color: this.color,
      opacity: this.opacity,
      baseplane: this.baseplane,
      angle: this.angle,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
    };
  }

  /**
   * Create from JSON
   * @param {Object} json - JSON data
   * @returns {ReferencePlane} Plane instance
   */
  static fromJSON(json) {
    const plane = new ReferencePlane(json.origin, json.normal, json.name, {
      visible: json.visible,
      size: json.size,
      color: json.color,
      opacity: json.opacity,
      baseplane: json.baseplane,
      angle: json.angle,
    });
    plane.id = json.id;
    plane.createdAt = json.createdAt;
    plane.modifiedAt = json.modifiedAt;
    return plane;
  }
}

/**
 * Reference Axis - a construction line for patterns and rotations
 */
export class ReferenceAxis {
  /**
   * Create a reference axis
   * @param {number[]} origin - [x, y, z] origin point
   * @param {number[]} direction - [dx, dy, dz] axis direction (will be normalized)
   * @param {string} name - Display name
   * @param {Object} options - Additional options
   */
  constructor(origin, direction, name, options = {}) {
    this.id = generateRefId('axis');
    this.type = 'axis';
    this.origin = [...origin];
    this.direction = normalizeVector(direction);
    this.name = name || `Axis_${this.id}`;
    this.visible = options.visible ?? true;
    this.length = options.length ?? 100; // Display length
    this.color = options.color ?? 0xff4444;
    this.createdAt = Date.now();
    this.modifiedAt = Date.now();
  }

  /**
   * Get a point on the axis at parameter t
   * @param {number} t - Parameter (0 = origin, 1 = origin + direction*length)
   * @returns {number[]} Point on axis
   */
  getPoint(t) {
    return add(this.origin, scale(this.direction, t * this.length));
  }

  /**
   * Get closest point on axis to a given point
   * @param {number[]} point - [x, y, z] point
   * @returns {number[]} Closest point on axis
   */
  closestPoint(point) {
    const v = sub(point, this.origin);
    const t = dot(v, this.direction);
    return add(this.origin, scale(this.direction, t));
  }

  /**
   * Get distance from point to axis
   * @param {number[]} point - [x, y, z] point
   * @returns {number} Distance
   */
  distanceToPoint(point) {
    const closest = this.closestPoint(point);
    return length(sub(point, closest));
  }

  /**
   * Get Three.js group for visualization
   * @returns {THREE.Group} Axis visualization
   */
  toMesh() {
    const group = new THREE.Group();

    // Main line
    const halfLen = this.length / 2;
    const start = add(this.origin, scale(this.direction, -halfLen));
    const end = add(this.origin, scale(this.direction, halfLen));

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: this.color,
      linewidth: 2,
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    group.add(line);

    // Arrow head at end
    const arrowSize = this.length * 0.05;
    const arrowGeometry = new THREE.ConeGeometry(arrowSize * 0.5, arrowSize, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: this.color });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(...end);

    // Orient arrow to direction
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(...this.direction);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, dir);
    arrow.quaternion.copy(quaternion);

    group.add(arrow);

    // Store reference for interaction
    group.userData.refGeometry = this;
    group.visible = this.visible;

    return group;
  }

  /**
   * Serialize to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      origin: this.origin,
      direction: this.direction,
      name: this.name,
      visible: this.visible,
      length: this.length,
      color: this.color,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
    };
  }

  /**
   * Create from JSON
   * @param {Object} json - JSON data
   * @returns {ReferenceAxis} Axis instance
   */
  static fromJSON(json) {
    const axis = new ReferenceAxis(json.origin, json.direction, json.name, {
      visible: json.visible,
      length: json.length,
      color: json.color,
    });
    axis.id = json.id;
    axis.createdAt = json.createdAt;
    axis.modifiedAt = json.modifiedAt;
    return axis;
  }
}

/**
 * Reference Point - a construction point for constraints and measurements
 */
export class ReferencePoint {
  /**
   * Create a reference point
   * @param {number[]} position - [x, y, z] position
   * @param {string} name - Display name
   * @param {Object} options - Additional options
   */
  constructor(position, name, options = {}) {
    this.id = generateRefId('point');
    this.type = 'point';
    this.position = [...position];
    this.name = name || `Point_${this.id}`;
    this.visible = options.visible ?? true;
    this.size = options.size ?? 2; // Display size
    this.color = options.color ?? 0x44ff44;
    this.createdAt = Date.now();
    this.modifiedAt = Date.now();
  }

  /**
   * Get distance to another point
   * @param {number[]|ReferencePoint} other - Other point or coordinates
   * @returns {number} Distance
   */
  distanceTo(other) {
    const pos = other.position || other;
    return length(sub(this.position, pos));
  }

  /**
   * Get Three.js mesh for visualization
   * @returns {THREE.Mesh} Point visualization mesh
   */
  toMesh() {
    const geometry = new THREE.SphereGeometry(this.size, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: this.color,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...this.position);

    // Store reference for interaction
    mesh.userData.refGeometry = this;
    mesh.visible = this.visible;

    return mesh;
  }

  /**
   * Serialize to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      position: this.position,
      name: this.name,
      visible: this.visible,
      size: this.size,
      color: this.color,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
    };
  }

  /**
   * Create from JSON
   * @param {Object} json - JSON data
   * @returns {ReferencePoint} Point instance
   */
  static fromJSON(json) {
    const point = new ReferencePoint(json.position, json.name, {
      visible: json.visible,
      size: json.size,
      color: json.color,
    });
    point.id = json.id;
    point.createdAt = json.createdAt;
    point.modifiedAt = json.modifiedAt;
    return point;
  }
}

// ============================================================================
// Reference Geometry Manager
// ============================================================================

/**
 * Manages all reference geometry in a document
 */
export class ReferenceGeometryManager {
  constructor() {
    this.planes = new Map();
    this.axes = new Map();
    this.points = new Map();

    // Callbacks
    this.onAdd = null;
    this.onRemove = null;
    this.onChange = null;

    // Create default origin planes and axes
    this._createDefaults();
  }

  /**
   * Create default XY, XZ, YZ planes and X, Y, Z axes
   * @private
   */
  _createDefaults() {
    // Origin planes
    this.addPlane([0, 0, 0], [0, 0, 1], 'XY Plane', { color: 0x4488ff });
    this.addPlane([0, 0, 0], [0, 1, 0], 'XZ Plane', { color: 0x44ff44 });
    this.addPlane([0, 0, 0], [1, 0, 0], 'YZ Plane', { color: 0xff4444 });

    // Origin axes
    this.addAxis([0, 0, 0], [1, 0, 0], 'X Axis', { color: 0xff4444 });
    this.addAxis([0, 0, 0], [0, 1, 0], 'Y Axis', { color: 0x44ff44 });
    this.addAxis([0, 0, 0], [0, 0, 1], 'Z Axis', { color: 0x4488ff });
  }

  /**
   * Add a reference plane
   * @param {number[]} origin - Origin point
   * @param {number[]} normal - Plane normal
   * @param {string} name - Display name
   * @param {Object} options - Additional options
   * @returns {ReferencePlane} Created plane
   */
  addPlane(origin, normal, name, options = {}) {
    const plane = new ReferencePlane(origin, normal, name, options);
    this.planes.set(plane.id, plane);
    if (this.onAdd) this.onAdd(plane);
    return plane;
  }

  /**
   * Add an offset plane
   * @param {string} basePlaneId - Base plane ID
   * @param {number} offset - Offset distance
   * @param {string} name - Display name
   * @returns {ReferencePlane|null} Created plane or null if base not found
   */
  addOffsetPlane(basePlaneId, offset, name) {
    const base = this.planes.get(basePlaneId) || this.getPlaneByName(basePlaneId);
    if (!base) return null;

    const origin = add(base.origin, scale(base.normal, offset));
    return this.addPlane(origin, base.normal, name || `${base.name} offset ${offset}`, {
      baseplane: base.id,
    });
  }

  /**
   * Add an angled plane
   * @param {string} basePlaneId - Base plane ID
   * @param {number} angleDegrees - Angle in degrees
   * @param {string} name - Display name
   * @returns {ReferencePlane|null} Created plane or null if base not found
   */
  addAngledPlane(basePlaneId, angleDegrees, name) {
    const base = this.planes.get(basePlaneId) || this.getPlaneByName(basePlaneId);
    if (!base) return null;

    // Rotate normal around U direction
    const angleRad = (angleDegrees * Math.PI) / 180;
    const u = base.getUDirection();
    const newNormal = rotateAroundAxis(base.normal, u, angleRad);

    return this.addPlane(base.origin, newNormal, name || `${base.name} @${angleDegrees}°`, {
      baseplane: base.id,
      angle: angleDegrees,
    });
  }

  /**
   * Add a plane through 3 points
   * @param {number[]} p1 - First point
   * @param {number[]} p2 - Second point
   * @param {number[]} p3 - Third point
   * @param {string} name - Display name
   * @returns {ReferencePlane} Created plane
   */
  addPlaneThrough3Points(p1, p2, p3, name) {
    const v1 = sub(p2, p1);
    const v2 = sub(p3, p1);
    const normal = normalizeVector(cross(v1, v2));

    return this.addPlane(p1, normal, name || '3-Point Plane');
  }

  /**
   * Add a reference axis
   * @param {number[]} origin - Origin point
   * @param {number[]} direction - Axis direction
   * @param {string} name - Display name
   * @param {Object} options - Additional options
   * @returns {ReferenceAxis} Created axis
   */
  addAxis(origin, direction, name, options = {}) {
    const axis = new ReferenceAxis(origin, direction, name, options);
    this.axes.set(axis.id, axis);
    if (this.onAdd) this.onAdd(axis);
    return axis;
  }

  /**
   * Add an axis through 2 points
   * @param {number[]} p1 - First point
   * @param {number[]} p2 - Second point
   * @param {string} name - Display name
   * @returns {ReferenceAxis} Created axis
   */
  addAxisThrough2Points(p1, p2, name) {
    const direction = normalizeVector(sub(p2, p1));
    return this.addAxis(p1, direction, name || '2-Point Axis');
  }

  /**
   * Add a reference point
   * @param {number[]} position - Position
   * @param {string} name - Display name
   * @param {Object} options - Additional options
   * @returns {ReferencePoint} Created point
   */
  addPoint(position, name, options = {}) {
    const point = new ReferencePoint(position, name, options);
    this.points.set(point.id, point);
    if (this.onAdd) this.onAdd(point);
    return point;
  }

  /**
   * Get a plane by ID or name
   * @param {string} idOrName - Plane ID or name
   * @returns {ReferencePlane|undefined} Plane or undefined
   */
  getPlane(idOrName) {
    return this.planes.get(idOrName) || this.getPlaneByName(idOrName);
  }

  /**
   * Get a plane by name
   * @param {string} name - Plane name
   * @returns {ReferencePlane|undefined} Plane or undefined
   */
  getPlaneByName(name) {
    const lower = name.toLowerCase();
    for (const plane of this.planes.values()) {
      if (plane.name.toLowerCase() === lower) return plane;
    }
    return undefined;
  }

  /**
   * Get an axis by ID or name
   * @param {string} idOrName - Axis ID or name
   * @returns {ReferenceAxis|undefined} Axis or undefined
   */
  getAxis(idOrName) {
    return this.axes.get(idOrName) || this.getAxisByName(idOrName);
  }

  /**
   * Get an axis by name
   * @param {string} name - Axis name
   * @returns {ReferenceAxis|undefined} Axis or undefined
   */
  getAxisByName(name) {
    const lower = name.toLowerCase();
    for (const axis of this.axes.values()) {
      if (axis.name.toLowerCase() === lower) return axis;
    }
    return undefined;
  }

  /**
   * Get a point by ID or name
   * @param {string} idOrName - Point ID or name
   * @returns {ReferencePoint|undefined} Point or undefined
   */
  getPoint(idOrName) {
    return this.points.get(idOrName) || this.getPointByName(idOrName);
  }

  /**
   * Get a point by name
   * @param {string} name - Point name
   * @returns {ReferencePoint|undefined} Point or undefined
   */
  getPointByName(name) {
    const lower = name.toLowerCase();
    for (const point of this.points.values()) {
      if (point.name.toLowerCase() === lower) return point;
    }
    return undefined;
  }

  /**
   * Remove a reference geometry item
   * @param {string} id - Item ID
   * @returns {boolean} True if removed
   */
  remove(id) {
    let item = this.planes.get(id);
    if (item) {
      this.planes.delete(id);
      if (this.onRemove) this.onRemove(item);
      return true;
    }

    item = this.axes.get(id);
    if (item) {
      this.axes.delete(id);
      if (this.onRemove) this.onRemove(item);
      return true;
    }

    item = this.points.get(id);
    if (item) {
      this.points.delete(id);
      if (this.onRemove) this.onRemove(item);
      return true;
    }

    return false;
  }

  /**
   * Set visibility of a reference geometry item
   * @param {string} id - Item ID
   * @param {boolean} visible - Visibility state
   */
  setVisibility(id, visible) {
    const item = this.planes.get(id) || this.axes.get(id) || this.points.get(id);
    if (item) {
      item.visible = visible;
      item.modifiedAt = Date.now();
      if (this.onChange) this.onChange(item);
    }
  }

  /**
   * Get all reference geometry as flat array
   * @returns {Array} All planes, axes, and points
   */
  getAll() {
    return [
      ...Array.from(this.planes.values()),
      ...Array.from(this.axes.values()),
      ...Array.from(this.points.values()),
    ];
  }

  /**
   * Clear all reference geometry (except defaults)
   * @param {boolean} includeDefaults - Also clear default planes/axes
   */
  clear(includeDefaults = false) {
    if (includeDefaults) {
      this.planes.clear();
      this.axes.clear();
      this.points.clear();
    } else {
      // Keep only the first 3 planes (XY, XZ, YZ) and first 3 axes (X, Y, Z)
      const planesToKeep = Array.from(this.planes.values()).slice(0, 3);
      const axesToKeep = Array.from(this.axes.values()).slice(0, 3);

      this.planes.clear();
      this.axes.clear();
      this.points.clear();

      planesToKeep.forEach((p) => this.planes.set(p.id, p));
      axesToKeep.forEach((a) => this.axes.set(a.id, a));
    }
    resetRefIdCounter(7); // After 3 planes + 3 axes
  }

  /**
   * Serialize to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      planes: Array.from(this.planes.values()).map((p) => p.toJSON()),
      axes: Array.from(this.axes.values()).map((a) => a.toJSON()),
      points: Array.from(this.points.values()).map((p) => p.toJSON()),
    };
  }

  /**
   * Load from JSON
   * @param {Object} json - JSON data
   */
  fromJSON(json) {
    this.planes.clear();
    this.axes.clear();
    this.points.clear();

    let maxId = 0;

    if (json.planes) {
      for (const data of json.planes) {
        const plane = ReferencePlane.fromJSON(data);
        this.planes.set(plane.id, plane);
        const num = parseInt(plane.id.split('_')[1]) || 0;
        if (num > maxId) maxId = num;
      }
    }

    if (json.axes) {
      for (const data of json.axes) {
        const axis = ReferenceAxis.fromJSON(data);
        this.axes.set(axis.id, axis);
        const num = parseInt(axis.id.split('_')[1]) || 0;
        if (num > maxId) maxId = num;
      }
    }

    if (json.points) {
      for (const data of json.points) {
        const point = ReferencePoint.fromJSON(data);
        this.points.set(point.id, point);
        const num = parseInt(point.id.split('_')[1]) || 0;
        if (num > maxId) maxId = num;
      }
    }

    resetRefIdCounter(maxId + 1);
  }
}

// ============================================================================
// Vector Math Utilities (for internal use)
// ============================================================================

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function length(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function normalizeVector(v) {
  const len = length(v);
  if (len === 0) return [0, 0, 1];
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Rotate a vector around an axis using Rodrigues' rotation formula
 * @param {number[]} v - Vector to rotate
 * @param {number[]} axis - Rotation axis (normalized)
 * @param {number} angle - Rotation angle in radians
 * @returns {number[]} Rotated vector
 */
function rotateAroundAxis(v, axis, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const k = axis;

  // Rodrigues' formula: v_rot = v*cos(θ) + (k×v)*sin(θ) + k*(k·v)*(1-cos(θ))
  const kCrossV = cross(k, v);
  const kDotV = dot(k, v);

  return [
    v[0] * cos + kCrossV[0] * sin + k[0] * kDotV * (1 - cos),
    v[1] * cos + kCrossV[1] * sin + k[1] * kDotV * (1 - cos),
    v[2] * cos + kCrossV[2] * sin + k[2] * kDotV * (1 - cos),
  ];
}

// Global manager instance
export const referenceGeometry = new ReferenceGeometryManager();

export default {
  ReferencePlane,
  ReferenceAxis,
  ReferencePoint,
  ReferenceGeometryManager,
  referenceGeometry,
  resetRefIdCounter,
};
