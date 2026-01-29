/**
 * Ameri-CAD Feature Evaluator
 * Compiles the Document Model into geometry via the kernel
 */

import { kernel, meshToThreeGeometry } from './bridge.js';

/**
 * Evaluator - converts feature tree to rendered geometry
 */
export class Evaluator {
    constructor(documentModel, scene, THREE) {
        this.document = documentModel;
        this.scene = scene;
        this.THREE = THREE;
        
        // Mesh cache: featureId -> Three.js mesh
        this.meshes = new Map();
        
        // Kernel ID cache: featureId -> kernelId
        this.kernelIds = new Map();
        
        // Materials
        this.defaultMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a90d9,
            metalness: 0.3,
            roughness: 0.7,
            side: THREE.DoubleSide
        });
        
        this.selectedMaterial = new THREE.MeshStandardMaterial({
            color: 0xff9800,
            metalness: 0.3,
            roughness: 0.7,
            side: THREE.DoubleSide
        });
        
        this.invalidMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            metalness: 0.1,
            roughness: 0.9,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        
        // Bind document events
        this.document.onFeatureAdded = (f) => this.evaluateFeature(f.id);
        this.document.onFeatureRemoved = (f) => this.removeFeatureMesh(f.id);
        this.document.onFeatureModified = (f) => this.reEvaluateFromFeature(f.id);
    }
    
    /**
     * Initialize the evaluator (loads kernel)
     */
    async init() {
        console.log('[Evaluator] Initializing kernel...');
        await kernel.init();
        console.log('[Evaluator] Kernel ready');
    }
    
    /**
     * Evaluate a single feature
     */
    async evaluateFeature(featureId) {
        const feature = this.document.getFeature(featureId);
        if (!feature) return null;
        
        try {
            let result;
            
            switch (feature.type) {
                case 'box':
                    result = await kernel.createBox(
                        feature.params.width,
                        feature.params.height,
                        feature.params.depth,
                        feature.params.center
                    );
                    break;
                    
                case 'cylinder':
                    result = await kernel.createCylinder(
                        feature.params.radius,
                        feature.params.height,
                        feature.params.center
                    );
                    break;
                    
                case 'sphere':
                    result = await kernel.createSphere(
                        feature.params.radius,
                        feature.params.center
                    );
                    break;
                    
                case 'cone':
                    result = await kernel.createCone(
                        feature.params.radius1,
                        feature.params.radius2,
                        feature.params.height,
                        feature.params.center
                    );
                    break;
                    
                case 'boolean_union':
                    const id1u = this.kernelIds.get(feature.dependencies[0]);
                    const id2u = this.kernelIds.get(feature.dependencies[1]);
                    result = await kernel.union(id1u, id2u);
                    break;
                    
                case 'boolean_subtract':
                    const id1s = this.kernelIds.get(feature.dependencies[0]);
                    const id2s = this.kernelIds.get(feature.dependencies[1]);
                    result = await kernel.subtract(id1s, id2s);
                    break;
                    
                case 'boolean_intersect':
                    const id1i = this.kernelIds.get(feature.dependencies[0]);
                    const id2i = this.kernelIds.get(feature.dependencies[1]);
                    result = await kernel.intersect(id1i, id2i);
                    break;
                    
                case 'fillet':
                    const targetId = this.kernelIds.get(feature.dependencies[0]);
                    result = await kernel.fillet(
                        targetId,
                        feature.params.edgeIds,
                        feature.params.radius
                    );
                    break;
                    
                case 'chamfer':
                    const chamferTargetId = this.kernelIds.get(feature.dependencies[0]);
                    result = await kernel.chamfer(
                        chamferTargetId,
                        feature.params.edgeIds,
                        feature.params.distance
                    );
                    break;
                    
                case 'extrude':
                    // Get the sketch feature this extrude depends on
                    const sketchFeature = this.document.getFeature(feature.dependencies[0]);
                    if (!sketchFeature || sketchFeature.type !== 'sketch') {
                        throw new Error('Extrude requires a sketch dependency');
                    }
                    
                    // Get profile from sketch (use specified index or first profile)
                    const profileIndex = feature.params.profileIndex ?? 0;
                    const profiles = this.getSketchProfiles(sketchFeature);
                    
                    if (profiles.length === 0) {
                        throw new Error('Sketch has no extrudable profiles');
                    }
                    
                    const profile = profiles[profileIndex] || profiles[0];
                    
                    // Determine extrusion height based on direction
                    let extrudeHeight = feature.params.height ?? 10;
                    if (feature.params.direction === 'reverse') {
                        extrudeHeight = -extrudeHeight;
                    } else if (feature.params.direction === 'both') {
                        // For 'both', we'll handle this as symmetric extrude
                        extrudeHeight = extrudeHeight / 2;
                    }
                    
                    result = await kernel.extrudeSketchProfile(
                        profile,
                        Math.abs(extrudeHeight),
                        sketchFeature.params.plane || 'xy'
                    );
                    break;
                    
                case 'sweep':
                    // Sweep requires a profile and a path
                    const sweepProfileId = this.kernelIds.get(feature.dependencies[0]);
                    const sweepPathId = this.kernelIds.get(feature.dependencies[1]);
                    
                    if (!sweepProfileId || !sweepPathId) {
                        throw new Error('Sweep requires both profile and path dependencies');
                    }
                    
                    result = await kernel.sweep(sweepProfileId, sweepPathId);
                    break;
                    
                case 'sketch':
                    // Sketches create 2D wire geometry for later operations
                    result = await this.evaluateSketch(feature);
                    break;
                    
                case 'transform':
                    const transformSourceId = this.kernelIds.get(feature.dependencies[0]);
                    if (!transformSourceId) {
                        throw new Error('Transform requires a shape dependency');
                    }
                    
                    const transform = feature.params.transform || {};
                    
                    // Apply transformations: position (translate), rotation, scale
                    // For now, we create a transformed copy via the kernel
                    // The kernel bridge may need extension for full transform support
                    if (transform.position) {
                        // Translate by creating at offset position
                        const sourceFeature = this.document.getFeature(feature.dependencies[0]);
                        if (sourceFeature) {
                            // Re-create with offset - this is a simplified approach
                            // Full implementation would use kernel.translate()
                            result = await this.reCreateWithTransform(sourceFeature, transform);
                        }
                    }
                    
                    // If no result yet, copy the source shape
                    if (!result) {
                        // Fallback: reference the source shape (identity transform)
                        result = { id: transformSourceId, mesh: null };
                        // Get mesh from source
                        const sourceMesh = this.meshes.get(feature.dependencies[0]);
                        if (sourceMesh) {
                            result.mesh = {
                                vertices: sourceMesh.geometry.attributes.position.array,
                                normals: sourceMesh.geometry.attributes.normal.array,
                                indices: sourceMesh.geometry.index.array,
                                faceIds: sourceMesh.userData.faceIds
                            };
                        }
                    }
                    break;
                    
                default:
                    console.warn(`[Evaluator] Unknown feature type: ${feature.type}`);
                    return null;
            }
            
            // Store kernel ID
            this.kernelIds.set(featureId, result.id);
            feature.kernelId = result.id;
            
            // Create Three.js mesh
            const geometry = meshToThreeGeometry(result.mesh, this.THREE);
            const mesh = new this.THREE.Mesh(geometry, this.defaultMaterial.clone());
            
            // Store feature reference
            mesh.userData.featureId = featureId;
            mesh.userData.faceIds = result.mesh.faceIds;
            mesh.name = feature.name;
            
            // Remove old mesh if exists
            this.removeFeatureMesh(featureId);
            
            // Add to scene
            this.meshes.set(featureId, mesh);
            feature.meshId = mesh.uuid;
            
            if (feature.visible) {
                this.scene.add(mesh);
            }
            
            // Mark as valid
            feature.valid = true;
            feature.error = null;
            
            console.log(`[Evaluator] Evaluated ${feature.type}: ${feature.name}`);
            return mesh;
            
        } catch (error) {
            console.error(`[Evaluator] Failed to evaluate ${feature.name}:`, error);
            feature.valid = false;
            feature.error = error.message;
            
            // Show error placeholder
            this.showErrorPlaceholder(featureId);
            
            return null;
        }
    }
    
    /**
     * Re-evaluate a feature and all its dependents
     */
    async reEvaluateFromFeature(featureId) {
        // Get features to re-evaluate in topological order
        const toEvaluate = [featureId, ...this.document.getDependents(featureId)];
        const order = this.document.getTopologicalOrder();
        
        // Sort by topological order
        toEvaluate.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        
        console.log(`[Evaluator] Re-evaluating ${toEvaluate.length} features`);
        
        for (const id of toEvaluate) {
            await this.evaluateFeature(id);
        }
    }
    
    /**
     * Evaluate all features in the document
     */
    async evaluateAll() {
        const order = this.document.getTopologicalOrder();
        
        console.log(`[Evaluator] Evaluating ${order.length} features`);
        
        for (const featureId of order) {
            await this.evaluateFeature(featureId);
        }
    }
    
    /**
     * Remove mesh for a feature
     */
    removeFeatureMesh(featureId) {
        const mesh = this.meshes.get(featureId);
        if (mesh) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
            this.meshes.delete(featureId);
        }
        
        // Clean up kernel shape
        const kernelId = this.kernelIds.get(featureId);
        if (kernelId) {
            kernel.deleteShape(kernelId).catch(() => {});
            this.kernelIds.delete(featureId);
        }
    }
    
    /**
     * Show error placeholder for failed feature
     */
    showErrorPlaceholder(featureId) {
        const feature = this.document.getFeature(featureId);
        if (!feature) return;
        
        // Create a simple box as error indicator
        const geometry = new this.THREE.BoxGeometry(1, 1, 1);
        const mesh = new this.THREE.Mesh(geometry, this.invalidMaterial);
        
        mesh.userData.featureId = featureId;
        mesh.userData.isError = true;
        mesh.name = `${feature.name} (ERROR)`;
        
        this.removeFeatureMesh(featureId);
        this.meshes.set(featureId, mesh);
        
        if (feature.visible) {
            this.scene.add(mesh);
        }
    }
    
    /**
     * Get mesh for a feature
     */
    getMesh(featureId) {
        return this.meshes.get(featureId);
    }
    
    /**
     * Extract extrudable profiles from a sketch feature
     * @param {Feature} sketchFeature - The sketch feature
     * @returns {Array} Array of profile objects for kernel.extrudeSketchProfile
     */
    getSketchProfiles(sketchFeature) {
        const profiles = [];
        const elements = sketchFeature.params.elements || [];
        
        for (const element of elements) {
            if (element.type === 'rectangle') {
                profiles.push({
                    type: 'rectangle',
                    width: element.width,
                    height: element.height,
                    center: element.center || { x: 0, y: 0 }
                });
            } else if (element.type === 'circle') {
                profiles.push({
                    type: 'circle',
                    radius: element.radius,
                    center: element.center || { x: 0, y: 0 }
                });
            } else if (element.type === 'polygon' && element.points && element.closed) {
                profiles.push({
                    type: 'polygon',
                    points: element.points
                });
            }
        }
        
        return profiles;
    }
    
    /**
     * Evaluate a sketch feature to create wire geometry
     * @param {Feature} feature - The sketch feature
     * @returns {Object} Result with id and mesh
     */
    async evaluateSketch(feature) {
        const elements = feature.params.elements || [];
        const plane = feature.params.plane || 'xy';
        const origin = feature.params.origin || { x: 0, y: 0, z: 0 };
        
        // For now, create wire geometry for the first closed profile
        // This provides a kernel ID that can be used by extrude/sweep
        for (const element of elements) {
            if (element.type === 'rectangle') {
                const w = element.width / 2;
                const h = element.height / 2;
                const cx = (element.center?.x || 0) + origin.x;
                const cy = (element.center?.y || 0) + origin.y;
                const cz = origin.z;
                
                // Create rectangle wire based on plane
                let points;
                if (plane === 'xy') {
                    points = [
                        { x: cx - w, y: cy - h, z: cz },
                        { x: cx + w, y: cy - h, z: cz },
                        { x: cx + w, y: cy + h, z: cz },
                        { x: cx - w, y: cy + h, z: cz }
                    ];
                } else if (plane === 'xz') {
                    points = [
                        { x: cx - w, y: cz, z: cy - h },
                        { x: cx + w, y: cz, z: cy - h },
                        { x: cx + w, y: cz, z: cy + h },
                        { x: cx - w, y: cz, z: cy + h }
                    ];
                } else { // yz
                    points = [
                        { x: cz, y: cx - w, z: cy - h },
                        { x: cz, y: cx + w, z: cy - h },
                        { x: cz, y: cx + w, z: cy + h },
                        { x: cz, y: cx - w, z: cy + h }
                    ];
                }
                
                const wireResult = await kernel.createWireFromPolygon(points);
                const faceResult = await kernel.createFaceFromWire(wireResult.id);
                
                // Create a simple visualization mesh for the sketch
                return {
                    id: faceResult.id,
                    mesh: this.createSketchVisualization(points)
                };
            } else if (element.type === 'circle') {
                const cx = (element.center?.x || 0) + origin.x;
                const cy = (element.center?.y || 0) + origin.y;
                const cz = origin.z;
                const radius = element.radius;
                
                let center, normal;
                if (plane === 'xy') {
                    center = { x: cx, y: cy, z: cz };
                    normal = { x: 0, y: 0, z: 1 };
                } else if (plane === 'xz') {
                    center = { x: cx, y: cz, z: cy };
                    normal = { x: 0, y: 1, z: 0 };
                } else { // yz
                    center = { x: cz, y: cx, z: cy };
                    normal = { x: 1, y: 0, z: 0 };
                }
                
                const wireResult = await kernel.createCircleWire(center, radius, normal);
                const faceResult = await kernel.createFaceFromWire(wireResult.id);
                
                return {
                    id: faceResult.id,
                    mesh: this.createCircleVisualization(center, radius, normal)
                };
            }
        }
        
        // No valid profiles found - return empty result
        throw new Error('Sketch has no valid geometry elements');
    }
    
    /**
     * Create visualization mesh for sketch rectangle
     */
    createSketchVisualization(points) {
        // Create a simple line representation
        const vertices = new Float32Array(points.length * 3);
        for (let i = 0; i < points.length; i++) {
            vertices[i * 3] = points[i].x;
            vertices[i * 3 + 1] = points[i].y;
            vertices[i * 3 + 2] = points[i].z;
        }
        
        // Indices for two triangles forming the rectangle
        const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
        
        // Normals (all pointing up for XY plane)
        const normals = new Float32Array(points.length * 3);
        for (let i = 0; i < points.length; i++) {
            normals[i * 3] = 0;
            normals[i * 3 + 1] = 0;
            normals[i * 3 + 2] = 1;
        }
        
        return { vertices, normals, indices, faceIds: [] };
    }
    
    /**
     * Create visualization mesh for sketch circle
     */
    createCircleVisualization(center, radius, normal, segments = 32) {
        const vertices = [];
        const normals = [];
        const indices = [];
        
        // Center vertex
        vertices.push(center.x, center.y, center.z);
        normals.push(normal.x, normal.y, normal.z);
        
        // Circle vertices
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const cos = Math.cos(theta) * radius;
            const sin = Math.sin(theta) * radius;
            
            // Compute point based on plane orientation
            if (Math.abs(normal.z) > 0.9) {
                // XY plane
                vertices.push(center.x + cos, center.y + sin, center.z);
            } else if (Math.abs(normal.y) > 0.9) {
                // XZ plane
                vertices.push(center.x + cos, center.y, center.z + sin);
            } else {
                // YZ plane
                vertices.push(center.x, center.y + cos, center.z + sin);
            }
            normals.push(normal.x, normal.y, normal.z);
        }
        
        // Create triangle fan
        for (let i = 1; i <= segments; i++) {
            indices.push(0, i, i + 1);
        }
        
        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            indices: new Uint32Array(indices),
            faceIds: []
        };
    }
    
    /**
     * Re-create a shape with transformation applied
     * @param {Feature} sourceFeature - Original feature
     * @param {Object} transform - Transform to apply
     * @returns {Object} Result with id and mesh
     */
    async reCreateWithTransform(sourceFeature, transform) {
        const pos = transform.position || { x: 0, y: 0, z: 0 };
        
        // Re-create based on feature type with offset center
        switch (sourceFeature.type) {
            case 'box':
                const boxCenter = sourceFeature.params.center || { x: 0, y: 0, z: 0 };
                return kernel.createBox(
                    sourceFeature.params.width,
                    sourceFeature.params.height,
                    sourceFeature.params.depth,
                    {
                        x: boxCenter.x + pos.x,
                        y: boxCenter.y + pos.y,
                        z: boxCenter.z + pos.z
                    }
                );
                
            case 'cylinder':
                const cylCenter = sourceFeature.params.center || { x: 0, y: 0, z: 0 };
                return kernel.createCylinder(
                    sourceFeature.params.radius,
                    sourceFeature.params.height,
                    {
                        x: cylCenter.x + pos.x,
                        y: cylCenter.y + pos.y,
                        z: cylCenter.z + pos.z
                    }
                );
                
            case 'sphere':
                const sphCenter = sourceFeature.params.center || { x: 0, y: 0, z: 0 };
                return kernel.createSphere(
                    sourceFeature.params.radius,
                    {
                        x: sphCenter.x + pos.x,
                        y: sphCenter.y + pos.y,
                        z: sphCenter.z + pos.z
                    }
                );
                
            case 'cone':
                const coneCenter = sourceFeature.params.center || { x: 0, y: 0, z: 0 };
                return kernel.createCone(
                    sourceFeature.params.radius1,
                    sourceFeature.params.radius2,
                    sourceFeature.params.height,
                    {
                        x: coneCenter.x + pos.x,
                        y: coneCenter.y + pos.y,
                        z: coneCenter.z + pos.z
                    }
                );
                
            default:
                return null;
        }
    }
    
    /**
     * Get kernel ID for a feature
     */
    getKernelId(featureId) {
        return this.kernelIds.get(featureId);
    }
    
    /**
     * Set feature visibility
     */
    setVisibility(featureId, visible) {
        const feature = this.document.getFeature(featureId);
        if (feature) {
            feature.visible = visible;
        }
        
        const mesh = this.meshes.get(featureId);
        if (mesh) {
            if (visible) {
                this.scene.add(mesh);
            } else {
                this.scene.remove(mesh);
            }
        }
    }
    
    /**
     * Highlight a feature (selection)
     */
    highlight(featureId, selected = true) {
        const mesh = this.meshes.get(featureId);
        if (mesh) {
            mesh.material = selected ? this.selectedMaterial.clone() : this.defaultMaterial.clone();
        }
    }
    
    /**
     * Export feature to STEP (ISO 10303-21, AP214)
     * @param {string} featureId - Feature to export
     */
    async exportSTEP(featureId) {
        const kernelId = this.kernelIds.get(featureId);
        if (!kernelId) throw new Error('Feature not evaluated');
        
        return kernel.exportSTEP(kernelId);
    }
    
    /**
     * Export multiple features to STEP as a compound
     * @param {string[]} featureIds - Features to export
     */
    async exportSTEPMultiple(featureIds) {
        const kernelIds = [];
        for (const featureId of featureIds) {
            const kernelId = this.kernelIds.get(featureId);
            if (kernelId) {
                kernelIds.push(kernelId);
            }
        }
        
        if (kernelIds.length === 0) {
            throw new Error('No features to export');
        }
        
        return kernel.exportSTEPMultiple(kernelIds);
    }
    
    /**
     * Export all visible features to STEP
     */
    async exportSTEPAll() {
        const kernelIds = [];
        
        for (const [featureId, kernelId] of this.kernelIds) {
            const feature = this.document.getFeature(featureId);
            // Only export visible, valid features
            if (feature && feature.visible && feature.valid !== false) {
                kernelIds.push(kernelId);
            }
        }
        
        if (kernelIds.length === 0) {
            throw new Error('No features to export');
        }
        
        return kernel.exportSTEPMultiple(kernelIds);
    }
    
    /**
     * Export feature to STL
     */
    async exportSTL(featureId) {
        const kernelId = this.kernelIds.get(featureId);
        if (!kernelId) throw new Error('Feature not evaluated');
        
        return kernel.exportSTL(kernelId);
    }
    
    /**
     * Get volume of a feature
     */
    async getVolume(featureId) {
        const kernelId = this.kernelIds.get(featureId);
        if (!kernelId) throw new Error('Feature not evaluated');
        
        return kernel.getVolume(kernelId);
    }
    
    /**
     * Get bounding box of a feature
     */
    async getBoundingBox(featureId) {
        const kernelId = this.kernelIds.get(featureId);
        if (!kernelId) throw new Error('Feature not evaluated');
        
        return kernel.getBoundingBox(kernelId);
    }
    
    /**
     * Clear all meshes
     */
    clear() {
        for (const featureId of this.meshes.keys()) {
            this.removeFeatureMesh(featureId);
        }
    }
}
