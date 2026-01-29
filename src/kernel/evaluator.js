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
     * Export feature to STEP
     */
    async exportSTEP(featureId) {
        const kernelId = this.kernelIds.get(featureId);
        if (!kernelId) throw new Error('Feature not evaluated');
        
        return kernel.exportSTEP(kernelId);
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
