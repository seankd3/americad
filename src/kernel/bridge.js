/**
 * Ameri-CAD Kernel Bridge
 * Main thread interface to the OpenCASCADE Web Worker
 */

export class KernelBridge {
    constructor() {
        this.worker = null;
        this.pending = new Map();
        this.nextId = 1;
        this.initialized = false;
        this.initPromise = null;
        
        // Event listeners
        this.onProgress = null;
        this.onError = null;
    }
    
    /**
     * Initialize the kernel worker
     */
    async init() {
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = new Promise((resolve, reject) => {
            try {
                // Create worker with ES module support
                this.worker = new Worker('./src/kernel/worker.js', { type: 'module' });
                
                // Handle messages from worker
                this.worker.onmessage = (e) => {
                    const { id, success, result, error } = e.data;
                    
                    const handler = this.pending.get(id);
                    if (handler) {
                        this.pending.delete(id);
                        if (success) {
                            handler.resolve(result);
                        } else {
                            handler.reject(new Error(error));
                        }
                    }
                };
                
                this.worker.onerror = (e) => {
                    console.error('[KernelBridge] Worker error:', e);
                    if (this.onError) this.onError(e);
                };
                
                // Initialize OCCT
                this._call('init')
                    .then(() => {
                        this.initialized = true;
                        console.log('[KernelBridge] Kernel initialized');
                        resolve(true);
                    })
                    .catch(reject);
                    
            } catch (error) {
                reject(error);
            }
        });
        
        return this.initPromise;
    }
    
    /**
     * Internal call to worker
     */
    _call(action, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.worker) {
                reject(new Error('Worker not initialized'));
                return;
            }
            
            const id = this.nextId++;
            this.pending.set(id, { resolve, reject });
            
            this.worker.postMessage({ id, action, params });
        });
    }
    
    /**
     * Check if kernel is ready
     */
    isReady() {
        return this.initialized;
    }
    
    // ==================== Primitive Creation ====================
    
    /**
     * Create a box primitive
     * @returns {Promise<{id: string, mesh: Object, params: Object}>}
     */
    async createBox(width, height, depth, center = { x: 0, y: 0, z: 0 }) {
        await this.init();
        return this._call('createBox', { width, height, depth, center });
    }
    
    /**
     * Create a cylinder primitive
     * @returns {Promise<{id: string, mesh: Object, params: Object}>}
     */
    async createCylinder(radius, height, center = { x: 0, y: 0, z: 0 }) {
        await this.init();
        return this._call('createCylinder', { radius, height, center });
    }
    
    /**
     * Create a sphere primitive
     * @returns {Promise<{id: string, mesh: Object, params: Object}>}
     */
    async createSphere(radius, center = { x: 0, y: 0, z: 0 }) {
        await this.init();
        return this._call('createSphere', { radius, center });
    }
    
    /**
     * Create a cone primitive
     * @returns {Promise<{id: string, mesh: Object, params: Object}>}
     */
    async createCone(radius1, radius2, height, center = { x: 0, y: 0, z: 0 }) {
        await this.init();
        return this._call('createCone', { radius1, radius2, height, center });
    }
    
    // ==================== Boolean Operations ====================
    
    /**
     * Unified boolean operation dispatcher
     * @param {string} targetId - Target shape ID
     * @param {string} toolId - Tool shape ID
     * @param {string} type - Operation type: 'union', 'subtract', 'intersect'
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async boolean(targetId, toolId, type) {
        await this.init();
        switch (type) {
            case 'union':
            case 'add':
            case 'fuse':
                return this._call('booleanUnion', { id1: targetId, id2: toolId });
            case 'subtract':
            case 'cut':
            case 'difference':
                return this._call('booleanSubtract', { id1: targetId, id2: toolId });
            case 'intersect':
            case 'common':
                return this._call('booleanIntersect', { id1: targetId, id2: toolId });
            default:
                throw new Error(`Unknown boolean type: ${type}`);
        }
    }
    
    /**
     * Union two shapes
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async union(id1, id2) {
        await this.init();
        return this._call('booleanUnion', { id1, id2 });
    }
    
    /**
     * Subtract shape2 from shape1
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async subtract(id1, id2) {
        await this.init();
        return this._call('booleanSubtract', { id1, id2 });
    }
    
    /**
     * Intersect two shapes
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async intersect(id1, id2) {
        await this.init();
        return this._call('booleanIntersect', { id1, id2 });
    }
    
    // ==================== Modifications ====================
    
    /**
     * Apply fillet to edges
     * @param {string} shapeId - Shape ID
     * @param {string[]} edgeIds - Array of edge IDs to fillet
     * @param {number} radius - Fillet radius
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async fillet(shapeId, edgeIds, radius) {
        await this.init();
        return this._call('fillet', { shapeId, edgeIds, radius });
    }
    
    /**
     * Apply chamfer to edges
     * @param {string} shapeId - Shape ID
     * @param {string[]} edgeIds - Array of edge IDs to chamfer
     * @param {number} distance - Chamfer distance
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async chamfer(shapeId, edgeIds, distance) {
        await this.init();
        return this._call('chamfer', { shapeId, edgeIds, distance });
    }
    
    /**
     * Apply fillet to ALL edges of a shape
     * @param {string} shapeId - Shape ID
     * @param {number} radius - Fillet radius
     * @returns {Promise<{id: string, mesh: Object, edgeCount: number}>}
     */
    async filletAll(shapeId, radius) {
        await this.init();
        return this._call('filletAll', { shapeId, radius });
    }
    
    /**
     * Apply chamfer to ALL edges of a shape
     * @param {string} shapeId - Shape ID
     * @param {number} distance - Chamfer distance
     * @returns {Promise<{id: string, mesh: Object, edgeCount: number}>}
     */
    async chamferAll(shapeId, distance) {
        await this.init();
        return this._call('chamferAll', { shapeId, distance });
    }
    
    /**
     * Get all edge IDs for a shape
     * @param {string} shapeId - Shape ID
     * @returns {Promise<{edgeIds: string[]}>}
     */
    async getEdges(shapeId) {
        await this.init();
        return this._call('getEdges', { shapeId });
    }
    
    /**
     * Extrude a profile along a direction
     * @param {string} profileId - Profile (face/wire) ID
     * @param {{x,y,z}} direction - Extrusion direction vector
     * @param {number} distance - Extrusion distance
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async extrude(profileId, direction, distance) {
        await this.init();
        return this._call('extrude', { profileId, direction, distance });
    }
    
    /**
     * Extrude a sketch profile directly (from sketch geometry data)
     * @param {Object} profile - Profile data with type, dimensions, center
     * @param {number} height - Extrusion height
     * @param {string} plane - Sketch plane ('xy', 'xz', 'yz')
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async extrudeSketchProfile(profile, height, plane = 'xy') {
        await this.init();
        return this._call('extrudeSketchProfile', { profile, height, plane });
    }
    
    /**
     * Create a wire from polygon points
     * @param {Array<{x,y,z}>} points - 3D points
     * @returns {Promise<{id: string}>}
     */
    async createWireFromPolygon(points) {
        await this.init();
        return this._call('createWireFromPolygon', { points });
    }
    
    /**
     * Create a circular wire
     * @param {{x,y,z}} center - Center point
     * @param {number} radius - Circle radius
     * @param {{x,y,z}} normal - Plane normal
     * @returns {Promise<{id: string}>}
     */
    async createCircleWire(center, radius, normal = { x: 0, y: 0, z: 1 }) {
        await this.init();
        return this._call('createCircleWire', { center, radius, normal });
    }
    
    /**
     * Revolve a profile around an axis
     * @param {string} profileId - Profile (face/wire) ID
     * @param {{origin: {x,y,z}, direction: {x,y,z}}} axis - Revolution axis
     * @param {number} angle - Revolution angle in degrees
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async revolve(profileId, axis, angle) {
        await this.init();
        return this._call('revolve', { profileId, axis, angle });
    }
    
    /**
     * Shell a solid (hollow it out)
     * @param {string} shapeId - Solid shape ID
     * @param {string[]} faceIds - Faces to remove (for open shell)
     * @param {number} thickness - Wall thickness
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async shell(shapeId, faceIds, thickness) {
        await this.init();
        return this._call('shell', { shapeId, faceIds, thickness });
    }
    
    /**
     * Loft between multiple profiles
     * @param {string[]} profileIds - Array of profile IDs
     * @param {boolean} solid - Create solid (vs surface)
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async loft(profileIds, solid = true) {
        await this.init();
        return this._call('loft', { profileIds, solid });
    }
    
    /**
     * Sweep a profile along a path
     * @param {string} profileId - Profile shape ID
     * @param {string} pathId - Path curve ID
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async sweep(profileId, pathId) {
        await this.init();
        return this._call('sweep', { profileId, pathId });
    }
    
    // ==================== Additional Primitives ====================
    
    /**
     * Create a torus primitive
     * @returns {Promise<{id: string, mesh: Object, params: Object}>}
     */
    async createTorus(majorRadius, minorRadius, center = { x: 0, y: 0, z: 0 }) {
        await this.init();
        return this._call('createTorus', { majorRadius, minorRadius, center });
    }
    
    /**
     * Create a wedge primitive
     * @returns {Promise<{id: string, mesh: Object, params: Object}>}
     */
    async createWedge(dx, dy, dz, ltx = 0, center = { x: 0, y: 0, z: 0 }) {
        await this.init();
        return this._call('createWedge', { dx, dy, dz, ltx, center });
    }
    
    // ==================== Export ====================
    
    /**
     * Export shape to STEP format (ISO 10303-21, AP214)
     * @param {string} id - Shape ID to export
     * @returns {Promise<{content: string, format: string}>}
     */
    async exportSTEP(id) {
        await this.init();
        return this._call('exportSTEP', { id });
    }
    
    /**
     * Export multiple shapes to STEP format as a compound
     * @param {string[]} ids - Array of shape IDs to export
     * @returns {Promise<{content: string, format: string, count: number}>}
     */
    async exportSTEPMultiple(ids) {
        await this.init();
        return this._call('exportSTEPMultiple', { ids });
    }
    
    /**
     * Export all shapes in kernel memory to STEP format
     * @returns {Promise<{content: string, format: string, count: number}>}
     */
    async exportSTEPAll() {
        await this.init();
        return this._call('exportSTEPAll', {});
    }
    
    /**
     * Export shape to STL format
     * @param {string} id - Shape ID to export
     * @param {boolean} ascii - Whether to export ASCII format (default: true)
     * @returns {Promise<{content: string|Uint8Array, format: string, binary: boolean}>}
     */
    async exportSTL(id, ascii = true) {
        await this.init();
        return this._call('exportSTL', { id, ascii });
    }
    
    // ==================== Analysis ====================
    
    /**
     * Get volume of shape
     * @returns {Promise<{volume: number}>}
     */
    async getVolume(id) {
        await this.init();
        return this._call('getVolume', { id });
    }
    
    /**
     * Get bounding box of shape
     * @returns {Promise<{min: {x,y,z}, max: {x,y,z}}>}
     */
    async getBoundingBox(id) {
        await this.init();
        return this._call('getBoundingBox', { id });
    }
    
    // ==================== Management ====================
    
    /**
     * Delete a shape from kernel memory
     */
    async deleteShape(id) {
        await this.init();
        return this._call('deleteShape', { id });
    }
    
    /**
     * Terminate the worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.initialized = false;
            this.initPromise = null;
        }
    }
}

/**
 * Convert kernel mesh data to Three.js BufferGeometry
 */
export function meshToThreeGeometry(mesh, THREE) {
    const geometry = new THREE.BufferGeometry();
    
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    
    // Compute normals if not provided properly
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    // Store face IDs for selection
    geometry.userData.faceIds = mesh.faceIds;
    
    return geometry;
}

/**
 * Download a string as a file
 */
export function downloadFile(content, filename, mimeType = 'application/octet-stream') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Global singleton instance
export const kernel = new KernelBridge();
