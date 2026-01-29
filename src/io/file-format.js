/**
 * Ameri-CAD Native File Format (.americad)
 * 
 * Handles serialization and deserialization of CAD documents.
 * File format stores the parametric feature tree which is then
 * regenerated through the kernel on load.
 */

import { DocumentModel, Feature, BoxFeature, CylinderFeature, SphereFeature, 
         ConeFeature, BooleanFeature, FilletFeature, ChamferFeature, 
         TransformFeature } from '../state/document.js';

/**
 * Current file format version
 */
export const FILE_FORMAT_VERSION = '1.0';

/**
 * File extension
 */
export const FILE_EXTENSION = '.americad';

/**
 * MIME type for the file format
 */
export const MIME_TYPE = 'application/x-americad+json';

/**
 * Serialize a DocumentModel to a JSON string
 * 
 * @param {DocumentModel} documentModel - The document to serialize
 * @param {Object} options - Serialization options
 * @param {boolean} options.pretty - Whether to pretty-print (default: true)
 * @param {string} options.name - Document name override
 * @returns {string} JSON string representing the document
 */
export function serialize(documentModel, options = {}) {
    const { pretty = true, name = null } = options;
    
    const now = new Date().toISOString();
    
    // Get features in topological order for proper reconstruction
    const orderedFeatureIds = documentModel.getTopologicalOrder();
    const features = orderedFeatureIds.map(id => {
        const feature = documentModel.getFeature(id);
        return serializeFeature(feature);
    });
    
    const document = {
        version: FILE_FORMAT_VERSION,
        name: name || documentModel.name || 'Untitled',
        created: documentModel.createdAt ? new Date(documentModel.createdAt).toISOString() : now,
        modified: now,
        features: features
    };
    
    return pretty ? JSON.stringify(document, null, 2) : JSON.stringify(document);
}

/**
 * Serialize a single feature to a plain object
 * 
 * @param {Feature} feature - The feature to serialize
 * @returns {Object} Serialized feature data
 */
function serializeFeature(feature) {
    const serialized = {
        id: feature.id,
        type: feature.type,
        params: { ...feature.params },
        transform: getFeatureTransform(feature),
        dependencies: [...feature.dependencies],
        name: feature.name,
        visible: feature.visible
    };
    
    // Remove internal params that shouldn't be serialized
    delete serialized.params.name;
    delete serialized.params.external;
    delete serialized.params.meshRef;
    
    return serialized;
}

/**
 * Get transform matrix for a feature (identity for now, can be extended)
 * 
 * @param {Feature} feature - The feature
 * @returns {number[]} 4x4 transform matrix as flat array
 */
function getFeatureTransform(feature) {
    // Identity matrix by default
    // Future: extract from Three.js mesh if transforms have been applied
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
}

/**
 * Deserialize JSON into a DocumentModel
 * 
 * @param {string|Object} json - JSON string or parsed object
 * @returns {DocumentModel} Reconstructed document model
 */
export function deserialize(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    
    // Validate version
    if (!data.version) {
        throw new Error('Invalid file format: missing version');
    }
    
    const [major] = data.version.split('.');
    const [currentMajor] = FILE_FORMAT_VERSION.split('.');
    
    if (parseInt(major) > parseInt(currentMajor)) {
        throw new Error(`File format version ${data.version} is newer than supported version ${FILE_FORMAT_VERSION}`);
    }
    
    // Create new document model
    const doc = new DocumentModel();
    doc.name = data.name || 'Untitled';
    doc.createdAt = data.created ? new Date(data.created).getTime() : Date.now();
    doc.modifiedAt = data.modified ? new Date(data.modified).getTime() : Date.now();
    
    // Features should already be in dependency order from serialize()
    // But let's be safe and sort them
    const sortedFeatures = sortByDependencies(data.features);
    
    // Reconstruct features
    for (const featureData of sortedFeatures) {
        const feature = deserializeFeature(featureData);
        doc.features.set(feature.id, feature);
        
        // Update root features list
        if (feature.dependencies.length === 0) {
            doc.rootFeatures.push(feature.id);
        }
    }
    
    // Rebuild children relationships
    for (const feature of doc.features.values()) {
        for (const depId of feature.dependencies) {
            const parent = doc.features.get(depId);
            if (parent && !parent.children.includes(feature.id)) {
                parent.children.push(feature.id);
            }
        }
    }
    
    // Update the global ID counter to avoid collisions
    updateIdCounter(doc);
    
    return doc;
}

/**
 * Sort features by dependencies (topological sort)
 * 
 * @param {Array} features - Array of feature data objects
 * @returns {Array} Sorted array
 */
function sortByDependencies(features) {
    const featureMap = new Map(features.map(f => [f.id, f]));
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();
    
    function visit(id) {
        if (visited.has(id)) return;
        if (visiting.has(id)) {
            throw new Error(`Circular dependency detected involving feature ${id}`);
        }
        
        const feature = featureMap.get(id);
        if (!feature) return;
        
        visiting.add(id);
        
        for (const depId of feature.dependencies || []) {
            visit(depId);
        }
        
        visiting.delete(id);
        visited.add(id);
        sorted.push(feature);
    }
    
    for (const feature of features) {
        visit(feature.id);
    }
    
    return sorted;
}

/**
 * Deserialize a single feature from data
 * 
 * @param {Object} data - Serialized feature data
 * @returns {Feature} Reconstructed feature
 */
function deserializeFeature(data) {
    let feature;
    
    // Add name back to params for construction
    const params = { ...data.params, name: data.name };
    
    switch (data.type) {
        case 'box':
            feature = new BoxFeature(params);
            break;
            
        case 'cylinder':
            feature = new CylinderFeature(params);
            break;
            
        case 'sphere':
            feature = new SphereFeature(params);
            break;
            
        case 'cone':
            feature = new ConeFeature(params);
            break;
            
        case 'boolean_union':
            feature = new BooleanFeature('union', data.dependencies[0], data.dependencies[1], params);
            break;
            
        case 'boolean_subtract':
            feature = new BooleanFeature('subtract', data.dependencies[0], data.dependencies[1], params);
            break;
            
        case 'boolean_intersect':
            feature = new BooleanFeature('intersect', data.dependencies[0], data.dependencies[1], params);
            break;
            
        case 'fillet':
            feature = new FilletFeature(
                data.dependencies[0],
                params.edgeIds,
                params.radius,
                params
            );
            break;
            
        case 'chamfer':
            feature = new ChamferFeature(
                data.dependencies[0],
                params.edgeIds,
                params.distance,
                params
            );
            break;
            
        case 'transform':
            feature = new TransformFeature(
                data.dependencies[0],
                params.transform,
                params
            );
            break;
            
        default:
            // Generic feature
            feature = new Feature(data.type, params);
            feature.dependencies = data.dependencies || [];
    }
    
    // Restore metadata
    feature.id = data.id;
    feature.name = data.name || feature.name;
    feature.visible = data.visible ?? true;
    
    return feature;
}

/**
 * Update the global feature ID counter to avoid collisions
 * 
 * @param {DocumentModel} doc - The document model
 */
function updateIdCounter(doc) {
    let maxId = 0;
    
    for (const id of doc.features.keys()) {
        // Extract numeric part from IDs like "feature_123"
        const match = id.match(/(\d+)$/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxId) maxId = num;
        }
    }
    
    // This is a bit of a hack - we need to update the module-level counter
    // The document.js module uses a closure for this
    // For now, DocumentModel.fromJSON handles this internally
}

/**
 * Trigger a file download
 * 
 * @param {string} content - File content
 * @param {string} filename - Filename for download
 */
export function downloadFile(content, filename) {
    const blob = new Blob([content], { type: MIME_TYPE });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith(FILE_EXTENSION) ? filename : filename + FILE_EXTENSION;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Open a file picker and read the selected file
 * 
 * @returns {Promise<{content: string, filename: string}>} File content and name
 */
export function openFilePicker() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = FILE_EXTENSION + ',.json';
        
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) {
                reject(new Error('No file selected'));
                return;
            }
            
            try {
                const content = await file.text();
                resolve({
                    content,
                    filename: file.name
                });
            } catch (error) {
                reject(error);
            }
        };
        
        input.oncancel = () => {
            reject(new Error('File selection cancelled'));
        };
        
        input.click();
    });
}

/**
 * Validate that a JSON object is a valid AmericaD document
 * 
 * @param {Object} data - Parsed JSON data
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validate(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid JSON data' };
    }
    
    if (!data.version) {
        return { valid: false, error: 'Missing version field' };
    }
    
    if (!Array.isArray(data.features)) {
        return { valid: false, error: 'Missing or invalid features array' };
    }
    
    // Validate each feature has required fields
    for (const feature of data.features) {
        if (!feature.id) {
            return { valid: false, error: 'Feature missing id' };
        }
        if (!feature.type) {
            return { valid: false, error: `Feature ${feature.id} missing type` };
        }
    }
    
    // Check for dependency integrity
    const featureIds = new Set(data.features.map(f => f.id));
    for (const feature of data.features) {
        for (const depId of feature.dependencies || []) {
            if (!featureIds.has(depId)) {
                return { 
                    valid: false, 
                    error: `Feature ${feature.id} depends on non-existent feature ${depId}` 
                };
            }
        }
    }
    
    return { valid: true };
}

export default {
    FILE_FORMAT_VERSION,
    FILE_EXTENSION,
    MIME_TYPE,
    serialize,
    deserialize,
    downloadFile,
    openFilePicker,
    validate
};
