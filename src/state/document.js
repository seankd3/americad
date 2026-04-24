/**
 * Ameri-CAD Document Model
 * The Feature DAG (Directed Acyclic Graph) - source of truth for parametric CAD
 *
 * This model now supports Event Sourcing:
 *   Events (append-only) → Projection (DocumentModel) → Geometry Cache
 *
 * The DocumentModel can operate in two modes:
 * 1. Direct mutation (legacy) - features added/removed directly
 * 2. Event-sourced - rebuilds state by replaying events from EventStore
 */

import { EventTypes, createEvent, eventStore } from './event-store.js';

// Unique ID generator
let nextFeatureId = 1;
function generateId() {
  return `feature_${nextFeatureId++}`;
}

/**
 * Reset the ID counter (used when loading documents)
 * @param {number} startFrom - Next ID to use
 */
export function resetFeatureIdCounter(startFrom = 1) {
  nextFeatureId = startFrom;
}

/**
 * Base Feature class - all features inherit from this
 */
export class Feature {
  constructor(type, params = {}) {
    this.id = generateId();
    this.type = type;
    this.params = { ...params };
    this.dependencies = []; // IDs of features this depends on
    this.children = []; // IDs of features that depend on this
    this.kernelId = null; // ID from geometry kernel
    this.meshId = null; // ID in Three.js scene
    this.valid = true; // Whether feature evaluated successfully
    this.error = null; // Error message if invalid
    this.visible = true;
    this.suppressed = false; // Whether feature is suppressed (skipped during regeneration)
    this.name = params.name || `${type}_${this.id}`;
    this.createdAt = Date.now();
    this.modifiedAt = Date.now();
  }

  /**
   * Serialize feature to JSON
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      params: this.params,
      dependencies: this.dependencies,
      name: this.name,
      visible: this.visible,
      suppressed: this.suppressed,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
    };
  }

  /**
   * Update parameters and mark as modified
   */
  updateParams(newParams) {
    this.params = { ...this.params, ...newParams };
    this.modifiedAt = Date.now();
  }
}

/**
 * Primitive features - basic shapes
 */
export class BoxFeature extends Feature {
  constructor(params) {
    super('box', {
      width: params.width ?? 10,
      height: params.height ?? 10,
      depth: params.depth ?? 10,
      center: params.center ?? { x: 0, y: 0, z: 0 },
      ...params,
    });
  }
}

export class CylinderFeature extends Feature {
  constructor(params) {
    super('cylinder', {
      radius: params.radius ?? 5,
      height: params.height ?? 10,
      center: params.center ?? { x: 0, y: 0, z: 0 },
      ...params,
    });
  }
}

export class SphereFeature extends Feature {
  constructor(params) {
    super('sphere', {
      radius: params.radius ?? 5,
      center: params.center ?? { x: 0, y: 0, z: 0 },
      ...params,
    });
  }
}

export class ConeFeature extends Feature {
  constructor(params) {
    super('cone', {
      radius1: params.radius1 ?? 5,
      radius2: params.radius2 ?? 0,
      height: params.height ?? 10,
      center: params.center ?? { x: 0, y: 0, z: 0 },
      ...params,
    });
  }
}

/**
 * Operation features - combine/modify shapes
 */
export class BooleanFeature extends Feature {
  constructor(operation, targetId, toolId, params = {}) {
    super(`boolean_${operation}`, params);
    this.operation = operation; // 'union', 'subtract', 'intersect'
    this.dependencies = [targetId, toolId];
  }
}

export class FilletFeature extends Feature {
  constructor(targetId, edgeIds, radius, params = {}) {
    super('fillet', {
      edgeIds,
      radius,
      ...params,
    });
    this.dependencies = [targetId];
  }
}

export class ChamferFeature extends Feature {
  constructor(targetId, edgeIds, distance, params = {}) {
    super('chamfer', {
      edgeIds,
      distance,
      ...params,
    });
    this.dependencies = [targetId];
  }
}

/**
 * Transform feature - applies transformation to a shape
 */
export class TransformFeature extends Feature {
  constructor(targetId, transform, params = {}) {
    super('transform', {
      transform, // { position, rotation, scale }
      ...params,
    });
    this.dependencies = [targetId];
  }
}

/**
 * Sketch feature - 2D sketch on a plane
 */
export class SketchFeature extends Feature {
  constructor(params = {}) {
    super('sketch', {
      plane: params.plane ?? 'xy',
      origin: params.origin ?? { x: 0, y: 0, z: 0 },
      normal: params.normal ?? { x: 0, y: 0, z: 1 },
      elements: params.elements ?? [],
      ...params,
    });
    // Sketches can reference a face for "sketch on face"
    if (params.faceRef) {
      this.dependencies = [params.faceRef];
    }
  }

  /**
   * Add a sketch element
   */
  addElement(element) {
    this.params.elements.push(element);
    this.modifiedAt = Date.now();
  }

  /**
   * Get all elements of a specific type
   */
  getElementsByType(type) {
    return this.params.elements.filter(el => el.type === type);
  }

  /**
   * Check if sketch has any closed profiles
   */
  hasClosedProfiles() {
    // Rectangles and circles are always closed
    const hasRect = this.params.elements.some(el => el.type === 'rectangle');
    const hasCircle = this.params.elements.some(el => el.type === 'circle');
    return hasRect || hasCircle;
  }
}

/**
 * Extrude feature - extrudes a sketch profile
 */
export class ExtrudeFeature extends Feature {
  constructor(sketchId, params = {}) {
    super('extrude', {
      height: params.height ?? 10,
      direction: params.direction ?? 'normal', // 'normal', 'both', 'reverse'
      taper: params.taper ?? 0, // taper angle in degrees
      profileIndex: params.profileIndex ?? 0, // which profile to extrude
      ...params,
    });
    this.dependencies = [sketchId];
  }
}

/**
 * Sweep feature - sweeps a profile along a path
 */
export class SweepFeature extends Feature {
  constructor(profileId, pathId, params = {}) {
    super('sweep', {
      ...params,
    });
    this.dependencies = [profileId, pathId];
  }
}

/**
 * Linear pattern feature - creates copies along one or two directions
 * Supports 1D linear patterns and 2D grid patterns
 */
export class LinearPatternFeature extends Feature {
  constructor(sourceId, params = {}) {
    super('linearPattern', {
      direction1: params.direction1 ?? [1, 0, 0], // Primary direction
      count1: params.count1 ?? 3, // Copies in first direction
      spacing1: params.spacing1 ?? 10, // Spacing in first direction
      direction2: params.direction2 ?? null, // Secondary direction (for grid)
      count2: params.count2 ?? 1, // Copies in second direction
      spacing2: params.spacing2 ?? 0, // Spacing in second direction
      ...params,
    });
    this.dependencies = [sourceId];
  }

  /**
   * Check if this is a 2D grid pattern
   */
  isGrid() {
    return this.params.count2 > 1 && this.params.direction2 !== null;
  }

  /**
   * Get total number of copies
   */
  getTotalCopies() {
    return this.params.count1 * (this.params.count2 || 1);
  }
}

/**
 * Circular pattern feature - creates copies around an axis
 * Supports full 360° and partial angle patterns
 */
export class CircularPatternFeature extends Feature {
  constructor(sourceId, params = {}) {
    super('circularPattern', {
      axisOrigin: params.axisOrigin ?? { x: 0, y: 0, z: 0 }, // Center of rotation
      axisDirection: params.axisDirection ?? [0, 0, 1], // Axis direction (default: Z)
      count: params.count ?? 6, // Number of copies (including original)
      totalAngle: params.totalAngle ?? 360, // Total angle to span in degrees
      ...params,
    });
    this.dependencies = [sourceId];
  }

  /**
   * Check if this is a full 360° pattern
   */
  isFullCircle() {
    return Math.abs(this.params.totalAngle - 360) < 0.001;
  }

  /**
   * Get angle between copies in degrees
   */
  getAngleStep() {
    return this.params.totalAngle / this.params.count;
  }
}

/**
 * Pattern along path feature - creates copies along a curve or edge
 */
export class PathPatternFeature extends Feature {
  constructor(sourceId, pathId, params = {}) {
    super('pathPattern', {
      count: params.count ?? 5, // Number of copies along path
      orientToPath: params.orientToPath ?? false, // Whether to rotate copies to follow path
      ...params,
    });
    this.dependencies = [sourceId, pathId];
  }
}

/**
 * Mirror feature - mirrors a shape across a plane
 * Can optionally keep original to create symmetric part
 */
export class MirrorFeature extends Feature {
  constructor(sourceId, params = {}) {
    super('mirror', {
      plane: params.plane ?? 'yz', // Mirror plane: 'xy', 'xz', 'yz'
      keepOriginal: params.keepOriginal ?? false, // Fuse with original for symmetric part
      ...params,
    });
    this.dependencies = [sourceId];
  }
}

/**
 * Document Model - manages the feature tree
 */
export class DocumentModel {
  constructor() {
    this.features = new Map();
    this.rootFeatures = []; // Features with no dependencies
    this.version = 1;
    this.name = 'Untitled';
    this.createdAt = Date.now();
    this.modifiedAt = Date.now();

    // Event callbacks
    this.onFeatureAdded = null;
    this.onFeatureRemoved = null;
    this.onFeatureModified = null;
    this.onDocumentChanged = null;
  }

  /**
   * Add a feature to the document
   */
  addFeature(feature) {
    this.features.set(feature.id, feature);

    // Update root features list
    if (feature.dependencies.length === 0) {
      this.rootFeatures.push(feature.id);
    }

    // Update parent features' children lists
    for (const depId of feature.dependencies) {
      const parent = this.features.get(depId);
      if (parent) {
        parent.children.push(feature.id);
      }
    }

    this.modifiedAt = Date.now();

    if (this.onFeatureAdded) this.onFeatureAdded(feature);
    if (this.onDocumentChanged) this.onDocumentChanged();

    return feature;
  }

  /**
   * Remove a feature and its dependents
   */
  removeFeature(featureId) {
    const feature = this.features.get(featureId);
    if (!feature) return;

    // Recursively remove children first
    for (const childId of [...feature.children]) {
      this.removeFeature(childId);
    }

    // Remove from parent's children list
    for (const depId of feature.dependencies) {
      const parent = this.features.get(depId);
      if (parent) {
        parent.children = parent.children.filter(id => id !== featureId);
      }
    }

    // Remove from root features if applicable
    this.rootFeatures = this.rootFeatures.filter(id => id !== featureId);

    // Remove feature
    this.features.delete(featureId);
    this.modifiedAt = Date.now();

    if (this.onFeatureRemoved) this.onFeatureRemoved(feature);
    if (this.onDocumentChanged) this.onDocumentChanged();

    return feature;
  }

  /**
   * Get a feature by ID
   */
  getFeature(featureId) {
    return this.features.get(featureId);
  }

  /**
   * Update feature parameters
   */
  updateFeature(featureId, params) {
    const feature = this.features.get(featureId);
    if (!feature) return null;

    feature.updateParams(params);
    this.modifiedAt = Date.now();

    if (this.onFeatureModified) this.onFeatureModified(feature);
    if (this.onDocumentChanged) this.onDocumentChanged();

    return feature;
  }

  /**
   * Get features in topological order (dependencies first)
   */
  getTopologicalOrder() {
    const visited = new Set();
    const order = [];

    const visit = featureId => {
      if (visited.has(featureId)) return;

      const feature = this.features.get(featureId);
      if (!feature) return;

      // Visit dependencies first
      for (const depId of feature.dependencies) {
        visit(depId);
      }

      visited.add(featureId);
      order.push(featureId);
    };

    // Visit all features
    for (const id of this.features.keys()) {
      visit(id);
    }

    return order;
  }

  /**
   * Get features that need re-evaluation after a feature changed
   */
  getDependents(featureId) {
    const dependents = new Set();

    const collect = id => {
      const feature = this.features.get(id);
      if (!feature) return;

      for (const childId of feature.children) {
        if (!dependents.has(childId)) {
          dependents.add(childId);
          collect(childId);
        }
      }
    };

    collect(featureId);
    return Array.from(dependents);
  }

  /**
   * Get the position of a feature in the root features list
   * @param {string} featureId - Feature ID
   * @returns {number} Position index or -1 if not found
   */
  getFeaturePosition(featureId) {
    return this.rootFeatures.indexOf(featureId);
  }

  /**
   * Validate if a feature can be reordered to a target position
   * @param {string} featureId - Feature ID to move
   * @param {number} targetPosition - Target position index
   * @returns {{ valid: boolean, reason?: string }} Validation result
   */
  canReorder(featureId, targetPosition) {
    const feature = this.features.get(featureId);
    if (!feature) {
      return { valid: false, reason: 'Feature not found' };
    }

    const currentPosition = this.getFeaturePosition(featureId);
    if (currentPosition === -1) {
      return { valid: false, reason: 'Feature is not a root feature' };
    }

    if (targetPosition < 0 || targetPosition >= this.rootFeatures.length) {
      return { valid: false, reason: 'Invalid target position' };
    }

    if (currentPosition === targetPosition) {
      return { valid: true }; // No-op but valid
    }

    // Can't move before dependencies
    for (const depId of feature.dependencies) {
      const depPosition = this.getFeaturePosition(depId);
      if (depPosition !== -1 && depPosition >= targetPosition) {
        const depFeature = this.features.get(depId);
        return {
          valid: false,
          reason: `Depends on ${depFeature?.name || depId}`,
        };
      }
    }

    // Can't move after dependents
    const dependents = this.getDependents(featureId);
    for (const depId of dependents) {
      const depPosition = this.getFeaturePosition(depId);
      if (depPosition !== -1 && depPosition <= targetPosition) {
        const depFeature = this.features.get(depId);
        return {
          valid: false,
          reason: `${depFeature?.name || depId} depends on this`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Reorder a feature to a new position in the root features list
   * @param {string} featureId - Feature ID to move
   * @param {number} newIndex - Target position index
   * @returns {{ success: boolean, error?: string }} Result
   */
  reorderFeature(featureId, newIndex) {
    const validation = this.canReorder(featureId, newIndex);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    const oldIndex = this.getFeaturePosition(featureId);
    if (oldIndex === newIndex) {
      return { success: true }; // No-op
    }

    // Remove from current position
    this.rootFeatures.splice(oldIndex, 1);

    // Insert at new position
    this.rootFeatures.splice(newIndex, 0, featureId);

    this.modifiedAt = Date.now();

    if (this.onFeatureModified) {
      this.onFeatureModified(this.features.get(featureId));
    }
    if (this.onDocumentChanged) {
      this.onDocumentChanged();
    }

    return { success: true, oldIndex, newIndex };
  }

  /**
   * Get all leaf features (features with no children)
   */
  getLeafFeatures() {
    return Array.from(this.features.values())
      .filter(f => f.children.length === 0)
      .map(f => f.id);
  }

  /**
   * Serialize document to JSON
   */
  toJSON() {
    return {
      version: this.version,
      name: this.name,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      features: Array.from(this.features.values()).map(f => f.toJSON()),
      rootFeatures: this.rootFeatures,
    };
  }

  /**
   * Load document from JSON
   */
  static fromJSON(json) {
    const doc = new DocumentModel();
    doc.version = json.version || 1;
    doc.name = json.name || 'Untitled';
    doc.createdAt = json.createdAt || Date.now();
    doc.modifiedAt = json.modifiedAt || Date.now();

    // Reconstruct features
    for (const featureData of json.features) {
      const feature = DocumentModel.createFeatureFromJSON(featureData);
      doc.features.set(feature.id, feature);
    }

    doc.rootFeatures = json.rootFeatures || [];

    // Rebuild children relationships
    for (const feature of doc.features.values()) {
      for (const depId of feature.dependencies) {
        const parent = doc.features.get(depId);
        if (parent && !parent.children.includes(feature.id)) {
          parent.children.push(feature.id);
        }
      }
    }

    // Update ID counter
    let maxId = 0;
    for (const id of doc.features.keys()) {
      const num = parseInt(id.split('_')[1]) || 0;
      if (num > maxId) maxId = num;
    }
    nextFeatureId = maxId + 1;

    return doc;
  }

  /**
   * Create a feature instance from JSON data
   */
  static createFeatureFromJSON(data) {
    let feature;

    switch (data.type) {
      case 'box':
        feature = new BoxFeature(data.params);
        break;
      case 'cylinder':
        feature = new CylinderFeature(data.params);
        break;
      case 'sphere':
        feature = new SphereFeature(data.params);
        break;
      case 'cone':
        feature = new ConeFeature(data.params);
        break;
      case 'boolean_union':
      case 'boolean_subtract':
      case 'boolean_intersect':
        const op = data.type.split('_')[1];
        feature = new BooleanFeature(op, data.dependencies[0], data.dependencies[1], data.params);
        break;
      case 'fillet':
        feature = new FilletFeature(
          data.dependencies[0],
          data.params.edgeIds,
          data.params.radius,
          data.params
        );
        break;
      case 'chamfer':
        feature = new ChamferFeature(
          data.dependencies[0],
          data.params.edgeIds,
          data.params.distance,
          data.params
        );
        break;
      case 'transform':
        feature = new TransformFeature(data.dependencies[0], data.params.transform, data.params);
        break;
      case 'sketch':
        feature = new SketchFeature(data.params);
        break;
      case 'extrude':
        feature = new ExtrudeFeature(data.dependencies[0], data.params);
        break;
      case 'linearPattern':
        feature = new LinearPatternFeature(data.dependencies[0], data.params);
        break;
      case 'circularPattern':
        feature = new CircularPatternFeature(data.dependencies[0], data.params);
        break;
      case 'pathPattern':
        feature = new PathPatternFeature(data.dependencies[0], data.dependencies[1], data.params);
        break;
      case 'mirror':
        feature = new MirrorFeature(data.dependencies[0], data.params);
        break;
      default:
        feature = new Feature(data.type, data.params);
    }

    // Restore metadata
    feature.id = data.id;
    feature.name = data.name;
    feature.visible = data.visible ?? true;
    feature.suppressed = data.suppressed ?? false;
    feature.createdAt = data.createdAt;
    feature.modifiedAt = data.modifiedAt;
    feature.dependencies = data.dependencies || [];

    return feature;
  }

  /**
   * Clear all features
   */
  clear() {
    this.features.clear();
    this.rootFeatures = [];
    this.modifiedAt = Date.now();
    nextFeatureId = 1;

    if (this.onDocumentChanged) this.onDocumentChanged();
  }

  /**
   * Add a body to the document (command system compatibility layer)
   *
   * This method provides backward compatibility with the command system
   * which uses addBody() instead of addFeature(). It wraps trackExternalFeature()
   * to bridge the two APIs.
   *
   * @param {string} id - Kernel/body ID
   * @param {Object} data - Body data (type, params, mesh, name)
   * @returns {Object} The created body/feature reference
   */
  addBody(id, data) {
    // Generate name if not provided
    const name =
      data.name ||
      `${(data.type || 'body').toUpperCase()}_${String(this.features.size + 1).padStart(3, '0')}`;

    // Create feature using trackExternalFeature
    const feature = this.trackExternalFeature(
      {
        id: id,
        type: data.type || 'body',
        name: name,
        kernelId: id,
        mesh: data.mesh,
      },
      true
    );

    // Store additional body data in params for compatibility
    feature.params = {
      ...feature.params,
      ...data.params,
      external: true,
      meshRef: data.mesh,
    };

    // Return a body-compatible object for legacy code
    return {
      id: feature.id,
      name: feature.name,
      type: data.type,
      params: data.params,
      mesh: data.mesh,
      feature: feature,
    };
  }

  /**
   * Get a body by ID (command system compatibility layer)
   * @param {string} id - Body/feature ID
   * @returns {Object|undefined} Body data or undefined
   */
  getBody(id) {
    const feature = this.features.get(id);
    if (!feature) return undefined;

    return {
      id: feature.id,
      name: feature.name,
      type: feature.type,
      params: feature.params,
      feature: feature,
    };
  }

  /**
   * Remove a body by ID (command system compatibility layer)
   * @param {string} id - Body/feature ID
   */
  removeBody(id) {
    this.untrackExternalFeature(id, true);
  }

  /**
   * Get all bodies (command system compatibility layer)
   * @returns {Array} Array of body objects
   */
  getAllBodies() {
    return Array.from(this.features.values()).map(feature => ({
      id: feature.id,
      name: feature.name,
      type: feature.type,
      params: feature.params,
      feature: feature,
    }));
  }

  /**
   * Get bodies filtered by type (command system compatibility layer)
   * @param {string} type - Body type to filter by
   * @returns {Array} Array of matching body objects
   */
  getBodiesByType(type) {
    return this.getAllBodies().filter(b => b.type === type);
  }

  /**
   * Track an externally-created feature (from app.js legacy path)
   * This allows gradual migration to the unified architecture
   * @param {Object} data - Feature data
   * @param {boolean} triggerCallbacks - Whether to trigger UI callbacks (default: true)
   */
  trackExternalFeature(data, triggerCallbacks = true) {
    // Create a lightweight feature reference without full evaluation
    const feature = new Feature(data.type, {
      ...(data.params || {}),
      name: data.name,
      external: true,
      meshRef: data.mesh,
    });

    // Use provided IDs to maintain sync
    if (data.id) feature.id = data.id;
    if (data.kernelId) feature.kernelId = data.kernelId;
    if (data.mesh?.uuid) feature.meshId = data.mesh.uuid;

    feature.valid = true;
    feature.visible = true;

    // Add to document without triggering evaluation
    this.features.set(feature.id, feature);
    this.rootFeatures.push(feature.id);
    this.modifiedAt = Date.now();

    // Trigger UI callbacks to update feature tree (but not evaluator)
    if (triggerCallbacks && this.onFeatureAdded) {
      this.onFeatureAdded(feature);
    }
    if (triggerCallbacks && this.onDocumentChanged) {
      this.onDocumentChanged();
    }

    return feature;
  }

  /**
   * Remove tracking for an external feature
   * @param {string} featureId - Feature ID to untrack
   * @param {boolean} triggerCallbacks - Whether to trigger UI callbacks (default: true)
   */
  untrackExternalFeature(featureId, triggerCallbacks = true) {
    const feature = this.features.get(featureId);
    if (feature?.params?.external) {
      this.features.delete(featureId);
      this.rootFeatures = this.rootFeatures.filter(id => id !== featureId);
      this.modifiedAt = Date.now();

      if (triggerCallbacks && this.onFeatureRemoved) {
        this.onFeatureRemoved(feature);
      }
      if (triggerCallbacks && this.onDocumentChanged) {
        this.onDocumentChanged();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Event Sourcing Methods
  // DocumentModel as a "projection" of events
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Apply a single event to update the document state
   * This is the core projection logic - events → state
   *
   * @param {Object} event - Event from EventStore
   * @param {boolean} triggerCallbacks - Whether to fire callbacks (default: false during rebuild)
   */
  applyEvent(event, triggerCallbacks = false) {
    const { type, payload } = event;

    switch (type) {
      case EventTypes.FEATURE_ADDED: {
        const feature = DocumentModel.createFeatureFromJSON(payload.feature);
        this.features.set(feature.id, feature);

        if (feature.dependencies.length === 0) {
          this.rootFeatures.push(feature.id);
        }

        // Update parent children lists
        for (const depId of feature.dependencies) {
          const parent = this.features.get(depId);
          if (parent && !parent.children.includes(feature.id)) {
            parent.children.push(feature.id);
          }
        }

        if (triggerCallbacks && this.onFeatureAdded) {
          this.onFeatureAdded(feature);
        }
        break;
      }

      case EventTypes.FEATURE_DELETED: {
        const featureId = payload.featureId;
        const feature = this.features.get(featureId);
        if (!feature) break;

        // Remove from parent's children lists
        for (const depId of feature.dependencies) {
          const parent = this.features.get(depId);
          if (parent) {
            parent.children = parent.children.filter(id => id !== featureId);
          }
        }

        this.rootFeatures = this.rootFeatures.filter(id => id !== featureId);
        this.features.delete(featureId);

        if (triggerCallbacks && this.onFeatureRemoved) {
          this.onFeatureRemoved(feature);
        }
        break;
      }

      case EventTypes.FEATURE_RENAMED: {
        const feature = this.features.get(payload.featureId);
        if (feature) {
          feature.name = payload.newName;
          feature.modifiedAt = event.timestamp;

          if (triggerCallbacks && this.onFeatureModified) {
            this.onFeatureModified(feature);
          }
        }
        break;
      }

      case EventTypes.PARAM_CHANGED: {
        const feature = this.features.get(payload.featureId);
        if (feature) {
          feature.params[payload.paramName] = payload.newValue;
          feature.modifiedAt = event.timestamp;

          if (triggerCallbacks && this.onFeatureModified) {
            this.onFeatureModified(feature);
          }
        }
        break;
      }

      case EventTypes.PARAMS_BATCH_CHANGED: {
        const feature = this.features.get(payload.featureId);
        if (feature) {
          Object.assign(feature.params, payload.newParams);
          feature.modifiedAt = event.timestamp;

          if (triggerCallbacks && this.onFeatureModified) {
            this.onFeatureModified(feature);
          }
        }
        break;
      }

      case EventTypes.FEATURE_VISIBILITY_CHANGED: {
        const feature = this.features.get(payload.featureId);
        if (feature) {
          feature.visible = payload.visible;
          feature.modifiedAt = event.timestamp;

          if (triggerCallbacks && this.onFeatureModified) {
            this.onFeatureModified(feature);
          }
        }
        break;
      }

      case EventTypes.FEATURE_SUPPRESSION_CHANGED: {
        const feature = this.features.get(payload.featureId);
        if (feature) {
          feature.suppressed = payload.suppressed;
          feature.modifiedAt = event.timestamp;

          if (triggerCallbacks && this.onFeatureModified) {
            this.onFeatureModified(feature);
          }
        }
        break;
      }

      case EventTypes.FEATURE_REORDERED: {
        const { featureId, newIndex } = payload;
        // Remove from old position
        const currentIdx = this.rootFeatures.indexOf(featureId);
        if (currentIdx !== -1) {
          this.rootFeatures.splice(currentIdx, 1);
        }
        // Insert at new position
        this.rootFeatures.splice(newIndex, 0, featureId);

        const feature = this.features.get(featureId);
        if (feature) {
          feature.modifiedAt = event.timestamp;
          if (triggerCallbacks && this.onFeatureModified) {
            this.onFeatureModified(feature);
          }
        }
        break;
      }

      case EventTypes.DOCUMENT_CLEARED: {
        this.features.clear();
        this.rootFeatures = [];
        resetFeatureIdCounter(1);
        break;
      }

      case EventTypes.DOCUMENT_LOADED: {
        // Full document load - clear and rebuild from payload
        this.features.clear();
        this.rootFeatures = [];

        if (payload.features) {
          for (const featureData of payload.features) {
            const feature = DocumentModel.createFeatureFromJSON(featureData);
            this.features.set(feature.id, feature);
          }
          this.rootFeatures = payload.rootFeatures || [];

          // Rebuild children relationships
          for (const feature of this.features.values()) {
            for (const depId of feature.dependencies) {
              const parent = this.features.get(depId);
              if (parent && !parent.children.includes(feature.id)) {
                parent.children.push(feature.id);
              }
            }
          }
        }

        // Update ID counter
        let maxId = 0;
        for (const id of this.features.keys()) {
          const num = parseInt(id.split('_')[1]) || 0;
          if (num > maxId) maxId = num;
        }
        resetFeatureIdCounter(maxId + 1);
        break;
      }

      default:
        console.warn(`Unknown event type: ${type}`);
    }

    this.modifiedAt = event.timestamp || Date.now();

    if (triggerCallbacks && this.onDocumentChanged) {
      this.onDocumentChanged();
    }
  }

  /**
   * Rebuild document state from a sequence of events
   * This is the full projection rebuild (used for undo/redo)
   *
   * @param {Array<Object>} events - Events to replay in order
   * @param {boolean} triggerCallbacksAtEnd - Fire onDocumentChanged once at end
   */
  rebuildFromEvents(events, triggerCallbacksAtEnd = true) {
    // Clear current state
    this.features.clear();
    this.rootFeatures = [];
    resetFeatureIdCounter(1);

    // Replay all events
    for (const event of events) {
      this.applyEvent(event, false);
    }

    // Fire final callback
    if (triggerCallbacksAtEnd && this.onDocumentChanged) {
      this.onDocumentChanged();
    }
  }

  /**
   * Sync document with an EventStore
   * Subscribes to store events and keeps document in sync
   *
   * @param {EventStore} store - EventStore instance to sync with
   */
  syncWithEventStore(store) {
    // Handle new events
    store.on('eventAppended', event => {
      this.applyEvent(event, true);
    });

    // Handle batch appends
    store.on('batchAppended', events => {
      for (const event of events) {
        this.applyEvent(event, false);
      }
      if (this.onDocumentChanged) {
        this.onDocumentChanged();
      }
    });

    // Handle undo (truncation)
    store.on('truncated', _version => {
      this.rebuildFromEvents(store.getEvents(0), true);
    });

    // Handle redo
    store.on('redone', events => {
      for (const event of events) {
        this.applyEvent(event, false);
      }
      if (this.onDocumentChanged) {
        this.onDocumentChanged();
      }
    });

    // Handle store clear
    store.on('cleared', () => {
      this.clear();
    });

    // Handle restore from snapshot
    store.on('restored', () => {
      this.rebuildFromEvents(store.getEvents(0), true);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Event-Sourced Operations (emit events instead of direct mutation)
  // These wrap the direct mutations to also emit events
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Add a feature and emit event
   * @param {Feature} feature - Feature to add
   * @param {EventStore} store - Optional EventStore to emit to
   * @returns {Feature} The added feature
   */
  addFeatureWithEvent(feature, store = eventStore) {
    const event = createEvent(EventTypes.FEATURE_ADDED, {
      featureId: feature.id,
      feature: feature.toJSON(),
    });

    store.append(event);
    return feature;
  }

  /**
   * Remove a feature and emit event
   * @param {string} featureId - ID of feature to remove
   * @param {EventStore} store - Optional EventStore to emit to
   * @returns {Feature|null} The removed feature
   */
  removeFeatureWithEvent(featureId, store = eventStore) {
    const feature = this.features.get(featureId);
    if (!feature) return null;

    const event = createEvent(EventTypes.FEATURE_DELETED, {
      featureId: featureId,
      feature: feature.toJSON(), // Include for potential redo reconstruction
    });

    store.append(event);
    return feature;
  }

  /**
   * Update feature parameters and emit event
   * @param {string} featureId - Feature ID
   * @param {Object} params - New parameter values
   * @param {EventStore} store - Optional EventStore to emit to
   * @returns {Feature|null} The updated feature
   */
  updateFeatureWithEvent(featureId, params, store = eventStore) {
    const feature = this.features.get(featureId);
    if (!feature) return null;

    // Capture old values for event
    const oldParams = {};
    for (const key of Object.keys(params)) {
      oldParams[key] = feature.params[key];
    }

    const event = createEvent(EventTypes.PARAMS_BATCH_CHANGED, {
      featureId: featureId,
      oldParams: oldParams,
      newParams: params,
    });

    store.append(event);
    return feature;
  }

  /**
   * Rename a feature and emit event
   * @param {string} featureId - Feature ID
   * @param {string} newName - New name
   * @param {EventStore} store - Optional EventStore to emit to
   * @returns {Feature|null} The renamed feature
   */
  renameFeatureWithEvent(featureId, newName, store = eventStore) {
    const feature = this.features.get(featureId);
    if (!feature) return null;

    const event = createEvent(EventTypes.FEATURE_RENAMED, {
      featureId: featureId,
      oldName: feature.name,
      newName: newName,
    });

    store.append(event);
    return feature;
  }

  /**
   * Toggle feature visibility and emit event
   * @param {string} featureId - Feature ID
   * @param {boolean} visible - New visibility state
   * @param {EventStore} store - Optional EventStore to emit to
   * @returns {Feature|null} The updated feature
   */
  setVisibilityWithEvent(featureId, visible, store = eventStore) {
    const feature = this.features.get(featureId);
    if (!feature) return null;

    const event = createEvent(EventTypes.FEATURE_VISIBILITY_CHANGED, {
      featureId: featureId,
      oldVisible: feature.visible,
      visible: visible,
    });

    store.append(event);
    return feature;
  }

  /**
   * Toggle feature suppression and emit event
   * @param {string} featureId - Feature ID
   * @param {boolean} suppressed - New suppression state
   * @param {EventStore} store - Optional EventStore to emit to
   * @returns {Feature|null} The updated feature
   */
  setSuppressionWithEvent(featureId, suppressed, store = eventStore) {
    const feature = this.features.get(featureId);
    if (!feature) return null;

    const event = createEvent(EventTypes.FEATURE_SUPPRESSION_CHANGED, {
      featureId: featureId,
      oldSuppressed: feature.suppressed,
      suppressed: suppressed,
    });

    store.append(event);
    return feature;
  }

  /**
   * Reorder a feature and emit event
   * @param {string} featureId - Feature ID to move
   * @param {number} newIndex - Target position index
   * @param {EventStore} store - Optional EventStore to emit to
   * @returns {{ success: boolean, error?: string }} Result
   */
  reorderFeatureWithEvent(featureId, newIndex, store = eventStore) {
    const validation = this.canReorder(featureId, newIndex);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    const oldIndex = this.getFeaturePosition(featureId);
    if (oldIndex === newIndex) {
      return { success: true }; // No-op
    }

    const event = createEvent(EventTypes.FEATURE_REORDERED, {
      featureId: featureId,
      oldIndex: oldIndex,
      newIndex: newIndex,
    });

    store.append(event);
    return { success: true, oldIndex, newIndex };
  }

  /**
   * Set feature suppression (direct mutation without event)
   * @param {string} featureId - Feature ID
   * @param {boolean} suppressed - New suppression state
   * @returns {Feature|null} The updated feature
   */
  setSuppression(featureId, suppressed) {
    const feature = this.features.get(featureId);
    if (!feature) return null;

    feature.suppressed = suppressed;
    feature.modifiedAt = Date.now();
    this.modifiedAt = Date.now();

    if (this.onFeatureModified) this.onFeatureModified(feature);
    if (this.onDocumentChanged) this.onDocumentChanged();

    return feature;
  }

  /**
   * Check if a feature is effectively suppressed
   * A feature is effectively suppressed if it or any of its dependencies are suppressed
   * @param {string} featureId - Feature ID
   * @returns {boolean} True if effectively suppressed
   */
  isEffectivelySuppressed(featureId) {
    const feature = this.features.get(featureId);
    if (!feature) return false;

    // Check if directly suppressed
    if (feature.suppressed) return true;

    // Check if any dependency is effectively suppressed
    for (const depId of feature.dependencies) {
      if (this.isEffectivelySuppressed(depId)) return true;
    }

    return false;
  }

  /**
   * Get all features that are effectively suppressed
   * @returns {string[]} Array of feature IDs that are effectively suppressed
   */
  getEffectivelySuppressedFeatures() {
    const suppressed = [];
    for (const id of this.features.keys()) {
      if (this.isEffectivelySuppressed(id)) {
        suppressed.push(id);
      }
    }
    return suppressed;
  }

  /**
   * Suppress all features
   */
  suppressAll() {
    for (const feature of this.features.values()) {
      feature.suppressed = true;
      feature.modifiedAt = Date.now();
    }
    this.modifiedAt = Date.now();
    if (this.onDocumentChanged) this.onDocumentChanged();
  }

  /**
   * Unsuppress all features
   */
  unsuppressAll() {
    for (const feature of this.features.values()) {
      feature.suppressed = false;
      feature.modifiedAt = Date.now();
    }
    this.modifiedAt = Date.now();
    if (this.onDocumentChanged) this.onDocumentChanged();
  }
}

// Global document instance
export const document = new DocumentModel();

// Re-export event sourcing utilities for convenience
export { EventTypes, createEvent, eventStore };
