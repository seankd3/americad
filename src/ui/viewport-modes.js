/**
 * Ameri-CAD Viewport Display Modes
 * 
 * Multiple viewport shading modes like Blender:
 * - Solid: Full shaded view (default)
 * - Wireframe: Only edges visible, see-through
 * - X-Ray: Solid but semi-transparent, can select through objects
 * - Hidden Line: Wireframe with hidden lines removed (technical drawing style)
 */

/**
 * Viewport display mode enumeration
 */
export const ViewportMode = {
    SOLID: 'solid',
    WIREFRAME: 'wireframe',
    XRAY: 'xray',
    HIDDEN: 'hidden'
};

/**
 * Mode display names for UI
 */
export const ViewportModeLabels = {
    [ViewportMode.SOLID]: 'SHADED',
    [ViewportMode.WIREFRAME]: 'WIREFRAME',
    [ViewportMode.XRAY]: 'X-RAY',
    [ViewportMode.HIDDEN]: 'HIDDEN LINE'
};

/**
 * Ordered list of modes for cycling
 */
const MODE_ORDER = [
    ViewportMode.SOLID,
    ViewportMode.WIREFRAME,
    ViewportMode.XRAY,
    ViewportMode.HIDDEN
];

/**
 * ViewportModeManager
 * Manages viewport display modes and applies material changes to meshes
 */
export class ViewportModeManager {
    /**
     * @param {Object} options
     * @param {THREE} options.THREE - Three.js library reference
     * @param {THREE.Scene} options.scene - The scene containing objects
     * @param {Function} options.getObjects - Function that returns array of CAD objects
     * @param {Function} options.onModeChange - Callback when mode changes (mode, label)
     */
    constructor(options = {}) {
        this.THREE = options.THREE;
        this.scene = options.scene;
        this.getObjects = options.getObjects || (() => []);
        this.onModeChange = options.onModeChange || (() => {});
        
        // Current mode
        this.currentMode = ViewportMode.SOLID;
        
        // X-Ray blend factor (0-1, default 0.5)
        this.xrayOpacity = 0.5;
        
        // Store original materials for restoration
        this.originalMaterials = new WeakMap();
        
        // Hidden line materials cache
        this.hiddenLineMaterials = new WeakMap();
        
        // Edge visibility tracking
        this.edgeVisibility = new WeakMap();
    }
    
    /**
     * Get current viewport mode
     * @returns {string}
     */
    getMode() {
        return this.currentMode;
    }
    
    /**
     * Get current mode label for UI
     * @returns {string}
     */
    getModeLabel() {
        return ViewportModeLabels[this.currentMode] || 'UNKNOWN';
    }
    
    /**
     * Set viewport mode
     * @param {string} mode - One of ViewportMode values
     */
    setMode(mode) {
        if (!MODE_ORDER.includes(mode)) {
            console.warn(`[ViewportModes] Unknown mode: ${mode}`);
            return;
        }
        
        const previousMode = this.currentMode;
        this.currentMode = mode;
        
        // Apply mode to all objects
        this.applyMode();
        
        // Trigger callback
        this.onModeChange(mode, ViewportModeLabels[mode], previousMode);
        
        console.log(`[ViewportModes] Mode: ${mode}`);
    }
    
    /**
     * Cycle to next viewport mode (Z key behavior)
     * @returns {string} The new mode
     */
    cycleMode() {
        const currentIndex = MODE_ORDER.indexOf(this.currentMode);
        const nextIndex = (currentIndex + 1) % MODE_ORDER.length;
        const nextMode = MODE_ORDER[nextIndex];
        
        this.setMode(nextMode);
        return nextMode;
    }
    
    /**
     * Set X-Ray opacity
     * @param {number} opacity - Value between 0 and 1
     */
    setXRayOpacity(opacity) {
        this.xrayOpacity = Math.max(0.1, Math.min(1.0, opacity));
        
        // Reapply if currently in X-Ray mode
        if (this.currentMode === ViewportMode.XRAY) {
            this.applyMode();
        }
    }
    
    /**
     * Apply current mode to all objects
     */
    applyMode() {
        const objects = this.getObjects();
        
        objects.forEach(mesh => {
            if (!mesh || !mesh.material) return;
            
            // Store original material if not already stored
            if (!this.originalMaterials.has(mesh)) {
                this.originalMaterials.set(mesh, this.cloneMaterial(mesh.material));
            }
            
            // Apply mode-specific material settings
            switch (this.currentMode) {
                case ViewportMode.SOLID:
                    this.applySolidMode(mesh);
                    break;
                case ViewportMode.WIREFRAME:
                    this.applyWireframeMode(mesh);
                    break;
                case ViewportMode.XRAY:
                    this.applyXRayMode(mesh);
                    break;
                case ViewportMode.HIDDEN:
                    this.applyHiddenLineMode(mesh);
                    break;
            }
        });
    }
    
    /**
     * Apply solid (shaded) mode
     * @param {THREE.Mesh} mesh
     */
    applySolidMode(mesh) {
        const original = this.originalMaterials.get(mesh);
        if (!original) return;
        
        // Restore original material properties
        mesh.material.wireframe = false;
        mesh.material.transparent = original.transparent || false;
        mesh.material.opacity = original.opacity !== undefined ? original.opacity : 1.0;
        mesh.material.depthWrite = true;
        mesh.material.side = this.THREE.FrontSide;
        mesh.material.needsUpdate = true;
        
        // Show edges (default CAD look)
        this.setEdgeVisibility(mesh, true, 0.3);
    }
    
    /**
     * Apply wireframe mode
     * @param {THREE.Mesh} mesh
     */
    applyWireframeMode(mesh) {
        mesh.material.wireframe = true;
        mesh.material.transparent = false;
        mesh.material.opacity = 1.0;
        mesh.material.depthWrite = true;
        mesh.material.needsUpdate = true;
        
        // Hide separate edge lines (wireframe shows them)
        this.setEdgeVisibility(mesh, false);
    }
    
    /**
     * Apply X-Ray mode
     * @param {THREE.Mesh} mesh
     */
    applyXRayMode(mesh) {
        mesh.material.wireframe = false;
        mesh.material.transparent = true;
        mesh.material.opacity = this.xrayOpacity;
        mesh.material.depthWrite = false; // Key for X-Ray effect
        mesh.material.side = this.THREE.DoubleSide;
        mesh.material.needsUpdate = true;
        
        // Show edges with higher opacity
        this.setEdgeVisibility(mesh, true, 0.7);
    }
    
    /**
     * Apply hidden line mode (technical drawing style)
     * @param {THREE.Mesh} mesh
     */
    applyHiddenLineMode(mesh) {
        // Make faces white/light gray
        mesh.material.wireframe = false;
        mesh.material.transparent = false;
        mesh.material.opacity = 1.0;
        mesh.material.depthWrite = true;
        mesh.material.side = this.THREE.FrontSide;
        
        // Override color to white for technical drawing look
        if (mesh.material.color) {
            // Store original color if not stored
            if (!mesh.userData._originalColor) {
                mesh.userData._originalColor = mesh.material.color.getHex();
            }
            mesh.material.color.setHex(0xfafafa); // Near-white
        }
        
        // Remove metalness/roughness for flat look
        if (mesh.material.metalness !== undefined) {
            if (mesh.userData._originalMetalness === undefined) {
                mesh.userData._originalMetalness = mesh.material.metalness;
            }
            mesh.material.metalness = 0;
        }
        if (mesh.material.roughness !== undefined) {
            if (mesh.userData._originalRoughness === undefined) {
                mesh.userData._originalRoughness = mesh.material.roughness;
            }
            mesh.material.roughness = 1;
        }
        
        mesh.material.needsUpdate = true;
        
        // Show edges in black with full opacity
        this.setEdgeVisibility(mesh, true, 1.0, 0x000000);
    }
    
    /**
     * Set edge line visibility for a mesh
     * @param {THREE.Mesh} mesh
     * @param {boolean} visible
     * @param {number} opacity - Edge opacity (0-1)
     * @param {number} color - Edge color (hex)
     */
    setEdgeVisibility(mesh, visible, opacity = 0.3, color = null) {
        // Find edge children (LineSegments)
        mesh.children.forEach(child => {
            if (child.isLineSegments) {
                child.visible = visible;
                
                if (child.material) {
                    child.material.opacity = opacity;
                    child.material.transparent = opacity < 1;
                    
                    if (color !== null && child.material.color) {
                        child.material.color.setHex(color);
                    }
                    
                    child.material.needsUpdate = true;
                }
            }
        });
    }
    
    /**
     * Clone material for storage
     * @param {THREE.Material} material
     * @returns {Object} Cloned material properties
     */
    cloneMaterial(material) {
        return {
            wireframe: material.wireframe || false,
            transparent: material.transparent || false,
            opacity: material.opacity !== undefined ? material.opacity : 1.0,
            depthWrite: material.depthWrite !== undefined ? material.depthWrite : true,
            side: material.side || 0,
            color: material.color ? material.color.getHex() : null,
            metalness: material.metalness,
            roughness: material.roughness
        };
    }
    
    /**
     * Restore original material for a mesh
     * @param {THREE.Mesh} mesh
     */
    restoreOriginalMaterial(mesh) {
        const original = this.originalMaterials.get(mesh);
        if (!original) return;
        
        mesh.material.wireframe = original.wireframe;
        mesh.material.transparent = original.transparent;
        mesh.material.opacity = original.opacity;
        mesh.material.depthWrite = original.depthWrite;
        mesh.material.side = original.side;
        
        if (original.color !== null && mesh.material.color) {
            mesh.material.color.setHex(original.color);
        }
        
        if (original.metalness !== undefined) {
            mesh.material.metalness = original.metalness;
        }
        if (original.roughness !== undefined) {
            mesh.material.roughness = original.roughness;
        }
        
        // Restore original color from userData
        if (mesh.userData._originalColor !== undefined) {
            mesh.material.color.setHex(mesh.userData._originalColor);
            delete mesh.userData._originalColor;
        }
        if (mesh.userData._originalMetalness !== undefined) {
            mesh.material.metalness = mesh.userData._originalMetalness;
            delete mesh.userData._originalMetalness;
        }
        if (mesh.userData._originalRoughness !== undefined) {
            mesh.material.roughness = mesh.userData._originalRoughness;
            delete mesh.userData._originalRoughness;
        }
        
        mesh.material.needsUpdate = true;
    }
    
    /**
     * Apply mode to a single mesh (for newly created objects)
     * @param {THREE.Mesh} mesh
     */
    applyModeToMesh(mesh) {
        if (!mesh || !mesh.material) return;
        
        // Store original material
        if (!this.originalMaterials.has(mesh)) {
            this.originalMaterials.set(mesh, this.cloneMaterial(mesh.material));
        }
        
        // Apply current mode
        switch (this.currentMode) {
            case ViewportMode.SOLID:
                this.applySolidMode(mesh);
                break;
            case ViewportMode.WIREFRAME:
                this.applyWireframeMode(mesh);
                break;
            case ViewportMode.XRAY:
                this.applyXRayMode(mesh);
                break;
            case ViewportMode.HIDDEN:
                this.applyHiddenLineMode(mesh);
                break;
        }
    }
    
    /**
     * Remove a mesh from tracking (call when mesh is deleted)
     * @param {THREE.Mesh} mesh
     */
    removeMesh(mesh) {
        this.originalMaterials.delete(mesh);
        this.hiddenLineMaterials.delete(mesh);
        this.edgeVisibility.delete(mesh);
    }
    
    /**
     * Reset all materials to original state
     */
    reset() {
        const objects = this.getObjects();
        objects.forEach(mesh => {
            this.restoreOriginalMaterial(mesh);
        });
        this.currentMode = ViewportMode.SOLID;
    }
}

/**
 * Create and initialize viewport mode manager
 * @param {Object} options
 * @returns {ViewportModeManager}
 */
export function createViewportModeManager(options) {
    return new ViewportModeManager(options);
}

export default ViewportModeManager;
