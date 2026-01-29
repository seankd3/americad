/**
 * AMERICA-D Document Model
 * The Feature DAG (Directed Acyclic Graph) - source of truth for parametric CAD
 */

// Unique ID generator
let nextFeatureId = 1;
function generateId() {
    return `feature_${nextFeatureId++}`;
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
        this.children = [];     // IDs of features that depend on this
        this.kernelId = null;   // ID from geometry kernel
        this.meshId = null;     // ID in Three.js scene
        this.valid = true;      // Whether feature evaluated successfully
        this.error = null;      // Error message if invalid
        this.visible = true;
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
            createdAt: this.createdAt,
            modifiedAt: this.modifiedAt
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
            ...params
        });
    }
}

export class CylinderFeature extends Feature {
    constructor(params) {
        super('cylinder', {
            radius: params.radius ?? 5,
            height: params.height ?? 10,
            center: params.center ?? { x: 0, y: 0, z: 0 },
            ...params
        });
    }
}

export class SphereFeature extends Feature {
    constructor(params) {
        super('sphere', {
            radius: params.radius ?? 5,
            center: params.center ?? { x: 0, y: 0, z: 0 },
            ...params
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
            ...params
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
            ...params
        });
        this.dependencies = [targetId];
    }
}

export class ChamferFeature extends Feature {
    constructor(targetId, edgeIds, distance, params = {}) {
        super('chamfer', {
            edgeIds,
            distance,
            ...params
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
            ...params
        });
        this.dependencies = [targetId];
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
        
        const visit = (featureId) => {
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
        
        const collect = (id) => {
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
            rootFeatures: this.rootFeatures
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
                feature = new FilletFeature(data.dependencies[0], data.params.edgeIds, data.params.radius, data.params);
                break;
            case 'chamfer':
                feature = new ChamferFeature(data.dependencies[0], data.params.edgeIds, data.params.distance, data.params);
                break;
            case 'transform':
                feature = new TransformFeature(data.dependencies[0], data.params.transform, data.params);
                break;
            default:
                feature = new Feature(data.type, data.params);
        }
        
        // Restore metadata
        feature.id = data.id;
        feature.name = data.name;
        feature.visible = data.visible ?? true;
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
}

// Global document instance
export const document = new DocumentModel();
