/**
 * Ameri-CAD Main Entry Point
 * Integrates all modules: Kernel + Document Model + UI
 */

import { kernel, meshToThreeGeometry, downloadFile } from './kernel/bridge.js';
import { DocumentModel, BoxFeature, CylinderFeature, SphereFeature, ConeFeature, BooleanFeature } from './state/document.js';
import { Evaluator } from './kernel/evaluator.js';
import { FeatureTreeUI, addFeatureTreeStyles } from './ui/feature-tree.js';
import { commandManager } from './state/history.js';
import { CrashGuard } from './crash-guard.js';

/**
 * Ameri-CAD Application
 */
export class AmericaD {
    constructor(options = {}) {
        this.options = {
            container: options.container || '#viewport',
            treeContainer: options.treeContainer || '#feature-tree',
            ...options
        };
        
        // Core components
        this.THREE = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.transformControl = null;
        
        // CAD components
        this.document = new DocumentModel();
        this.evaluator = null;
        this.treeUI = null;
        
        // State
        this.selectedFeatureId = null;
        this.kernelReady = false;
        
        console.log('[Ameri-CAD] Application created');
    }
    
    /**
     * Initialize the application
     */
    async init(THREE) {
        this.THREE = THREE;
        
        console.log('[Ameri-CAD] Initializing...');
        
        // Add styles
        addFeatureTreeStyles();
        
        // Initialize kernel
        console.log('[Ameri-CAD] Loading geometry kernel...');
        try {
            await kernel.init();
            this.kernelReady = true;
            console.log('[Ameri-CAD] Kernel ready');
        } catch (error) {
            console.warn('[Ameri-CAD] Kernel failed to load, running in mesh-only mode:', error);
            this.kernelReady = false;
        }
        
        // Create evaluator
        this.evaluator = new Evaluator(this.document, this.scene, THREE);
        
        // Create feature tree UI
        this.treeUI = new FeatureTreeUI(this.options.treeContainer, this.document);
        this.treeUI.onFeatureSelect = (id) => this.selectFeature(id);
        this.treeUI.onFeatureDoubleClick = (id) => this.editFeature(id);
        this.treeUI.onVisibilityToggle = (id, visible) => this.setFeatureVisibility(id, visible);
        this.treeUI.onFeatureDelete = (id) => this.deleteFeature(id);
        this.treeUI.onFeatureRename = (id, name) => this.renameFeature(id, name);
        
        // Set up crash recovery
        CrashGuard.onRecover = (data) => this.recoverFromCrash(data);
        CrashGuard.init();
        
        console.log('[Ameri-CAD] Initialization complete');
    }
    
    /**
     * Set Three.js scene reference
     */
    setScene(scene, camera, renderer, controls, transformControl) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;
        this.transformControl = transformControl;
        
        if (this.evaluator) {
            this.evaluator.scene = scene;
        }
    }
    
    // ==================== Feature Operations ====================
    
    /**
     * Create a box primitive
     */
    async createBox(params = {}) {
        const feature = new BoxFeature({
            width: params.width ?? 10,
            height: params.height ?? 10,
            depth: params.depth ?? 10,
            center: params.center ?? { x: 0, y: 0, z: 0 },
            name: params.name
        });
        
        this.document.addFeature(feature);
        
        if (this.kernelReady) {
            await this.evaluator.evaluateFeature(feature.id);
        }
        
        CrashGuard.log({ action: 'create', type: 'box', featureId: feature.id });
        
        return feature;
    }
    
    /**
     * Create a cylinder primitive
     */
    async createCylinder(params = {}) {
        const feature = new CylinderFeature({
            radius: params.radius ?? 5,
            height: params.height ?? 10,
            center: params.center ?? { x: 0, y: 0, z: 0 },
            name: params.name
        });
        
        this.document.addFeature(feature);
        
        if (this.kernelReady) {
            await this.evaluator.evaluateFeature(feature.id);
        }
        
        CrashGuard.log({ action: 'create', type: 'cylinder', featureId: feature.id });
        
        return feature;
    }
    
    /**
     * Create a sphere primitive
     */
    async createSphere(params = {}) {
        const feature = new SphereFeature({
            radius: params.radius ?? 5,
            center: params.center ?? { x: 0, y: 0, z: 0 },
            name: params.name
        });
        
        this.document.addFeature(feature);
        
        if (this.kernelReady) {
            await this.evaluator.evaluateFeature(feature.id);
        }
        
        CrashGuard.log({ action: 'create', type: 'sphere', featureId: feature.id });
        
        return feature;
    }
    
    /**
     * Create a cone primitive
     */
    async createCone(params = {}) {
        const feature = new ConeFeature({
            radius1: params.radius1 ?? 5,
            radius2: params.radius2 ?? 0,
            height: params.height ?? 10,
            center: params.center ?? { x: 0, y: 0, z: 0 },
            name: params.name
        });
        
        this.document.addFeature(feature);
        
        if (this.kernelReady) {
            await this.evaluator.evaluateFeature(feature.id);
        }
        
        CrashGuard.log({ action: 'create', type: 'cone', featureId: feature.id });
        
        return feature;
    }
    
    /**
     * Boolean union of two features
     */
    async booleanUnion(targetId, toolId, params = {}) {
        const feature = new BooleanFeature('union', targetId, toolId, {
            name: params.name ?? 'Union'
        });
        
        this.document.addFeature(feature);
        
        if (this.kernelReady) {
            await this.evaluator.evaluateFeature(feature.id);
        }
        
        CrashGuard.log({ action: 'boolean', operation: 'union', featureId: feature.id });
        
        return feature;
    }
    
    /**
     * Boolean subtract (cut) tool from target
     */
    async booleanSubtract(targetId, toolId, params = {}) {
        const feature = new BooleanFeature('subtract', targetId, toolId, {
            name: params.name ?? 'Cut'
        });
        
        this.document.addFeature(feature);
        
        if (this.kernelReady) {
            await this.evaluator.evaluateFeature(feature.id);
        }
        
        CrashGuard.log({ action: 'boolean', operation: 'subtract', featureId: feature.id });
        
        return feature;
    }
    
    /**
     * Boolean intersect two features
     */
    async booleanIntersect(targetId, toolId, params = {}) {
        const feature = new BooleanFeature('intersect', targetId, toolId, {
            name: params.name ?? 'Intersect'
        });
        
        this.document.addFeature(feature);
        
        if (this.kernelReady) {
            await this.evaluator.evaluateFeature(feature.id);
        }
        
        CrashGuard.log({ action: 'boolean', operation: 'intersect', featureId: feature.id });
        
        return feature;
    }
    
    // ==================== Feature Management ====================
    
    /**
     * Select a feature
     */
    selectFeature(featureId) {
        // Deselect previous
        if (this.selectedFeatureId) {
            this.evaluator.highlight(this.selectedFeatureId, false);
        }
        
        this.selectedFeatureId = featureId;
        
        if (featureId) {
            this.evaluator.highlight(featureId, true);
            this.treeUI.selectFeature(featureId);
            
            // Attach transform control
            const mesh = this.evaluator.getMesh(featureId);
            if (mesh && this.transformControl) {
                this.transformControl.attach(mesh);
                this.transformControl.visible = true;
            }
        } else if (this.transformControl) {
            this.transformControl.detach();
            this.transformControl.visible = false;
        }
    }
    
    /**
     * Delete a feature
     */
    deleteFeature(featureId) {
        if (featureId === this.selectedFeatureId) {
            this.selectFeature(null);
        }
        
        this.document.removeFeature(featureId);
        this.evaluator.removeFeatureMesh(featureId);
        
        CrashGuard.log({ action: 'delete', featureId });
    }
    
    /**
     * Edit feature parameters
     */
    editFeature(featureId) {
        const feature = this.document.getFeature(featureId);
        if (!feature) return;
        
        // Show parameter dialog (placeholder)
        console.log('[Ameri-CAD] Edit feature:', feature.name, feature.params);
        
        // TODO: Show modal with parameter inputs
    }
    
    /**
     * Set feature visibility
     */
    setFeatureVisibility(featureId, visible) {
        this.evaluator.setVisibility(featureId, visible);
    }
    
    /**
     * Rename a feature
     */
    renameFeature(featureId, name) {
        this.document.updateFeature(featureId, { name });
    }
    
    /**
     * Update feature parameters and regenerate
     */
    async updateFeature(featureId, params) {
        this.document.updateFeature(featureId, params);
        
        if (this.kernelReady) {
            await this.evaluator.reEvaluateFromFeature(featureId);
        }
        
        CrashGuard.log({ action: 'update', featureId, params });
    }
    
    // ==================== File Operations ====================
    
    /**
     * Save document to JSON file
     */
    saveDocument(filename = 'design.americad') {
        const json = JSON.stringify(this.document.toJSON(), null, 2);
        downloadFile(json, filename, 'application/json');
    }
    
    /**
     * Load document from JSON
     */
    async loadDocument(json) {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        
        // Clear current
        this.document.clear();
        this.evaluator.clear();
        
        // Load new document
        this.document = DocumentModel.fromJSON(data);
        this.evaluator.document = this.document;
        this.treeUI.document = this.document;
        
        // Evaluate all features
        if (this.kernelReady) {
            await this.evaluator.evaluateAll();
        }
        
        this.treeUI.render();
    }
    
    /**
     * Export selected feature to STEP
     */
    async exportSTEP(featureId = null) {
        const id = featureId || this.selectedFeatureId;
        if (!id) {
            console.warn('[Ameri-CAD] No feature selected for export');
            return;
        }
        
        if (!this.kernelReady) {
            console.warn('[Ameri-CAD] Kernel not ready for STEP export');
            return;
        }
        
        const result = await this.evaluator.exportSTEP(id);
        downloadFile(result.content, 'export.step', 'application/step');
    }
    
    /**
     * Export selected feature to STL
     */
    async exportSTL(featureId = null) {
        const id = featureId || this.selectedFeatureId;
        if (!id) {
            console.warn('[Ameri-CAD] No feature selected for export');
            return;
        }
        
        if (!this.kernelReady) {
            console.warn('[Ameri-CAD] Kernel not ready for STL export');
            return;
        }
        
        const result = await this.evaluator.exportSTL(id);
        downloadFile(result.content, 'export.stl', 'application/sla');
    }
    
    // ==================== Recovery ====================
    
    /**
     * Recover from crash
     */
    recoverFromCrash(data) {
        console.log('[Ameri-CAD] Recovering from crash:', data);
        // TODO: Replay commands from crash log
    }
    
    /**
     * Clear document and start fresh
     */
    newDocument() {
        this.document.clear();
        this.evaluator.clear();
        this.selectFeature(null);
        CrashGuard.clear();
    }
}

// Export singleton
export const app = new AmericaD();
