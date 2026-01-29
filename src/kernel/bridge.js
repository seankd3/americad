/**
 * AMERICA-D Kernel Bridge
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
     * @returns {Promise<{id: string, mesh: Object}>}
     */
    async fillet(shapeId, edgeIds, radius) {
        await this.init();
        return this._call('fillet', { shapeId, edgeIds, radius });
    }
    
    // ==================== Export ====================
    
    /**
     * Export shape to STEP format
     * @returns {Promise<{content: string, format: string}>}
     */
    async exportSTEP(id) {
        await this.init();
        return this._call('exportSTEP', { id });
    }
    
    /**
     * Export shape to STL format
     * @returns {Promise<{content: string, format: string}>}
     */
    async exportSTL(id) {
        await this.init();
        return this._call('exportSTL', { id });
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
