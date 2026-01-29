/**
 * Ameri-CAD Viewport Manager
 * 
 * Manages single or quad viewport layouts with synchronized selection
 * and camera presets for Top/Front/Right/Perspective views.
 */

// Camera presets for standard views
export const cameraPresets = {
    top: { 
        position: [0, 1000, 0], 
        up: [0, 0, -1],
        label: 'TOP',
        axis: 'Y'
    },
    front: { 
        position: [0, 0, 1000], 
        up: [0, 1, 0],
        label: 'FRONT',
        axis: 'Z'
    },
    right: { 
        position: [1000, 0, 0], 
        up: [0, 1, 0],
        label: 'RIGHT',
        axis: 'X'
    },
    perspective: { 
        position: [50, 40, 50], 
        up: [0, 1, 0],
        label: 'PERSP',
        axis: null
    }
};

/**
 * Individual viewport configuration
 */
class Viewport {
    constructor(options = {}) {
        this.name = options.name || 'viewport';
        this.container = options.container || null;
        this.renderer = options.renderer || null;
        this.camera = options.camera || null;
        this.controls = options.controls || null;
        this.preset = options.preset || 'perspective';
        this.isOrthographic = options.isOrthographic || false;
        this.isMaximized = false;
        this.label = null;
    }
    
    /**
     * Resize the viewport renderer
     */
    resize(width, height) {
        if (!this.renderer || !this.camera) return;
        
        this.renderer.setSize(width, height);
        
        if (this.isOrthographic && this.camera.isOrthographicCamera) {
            const aspect = width / height;
            const frustumSize = this.camera.userData.frustumSize || 100;
            this.camera.left = -frustumSize * aspect / 2;
            this.camera.right = frustumSize * aspect / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = -frustumSize / 2;
            this.camera.updateProjectionMatrix();
        } else if (this.camera.isPerspectiveCamera) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
    }
    
    /**
     * Render this viewport
     */
    render(scene) {
        if (!this.renderer || !this.camera || !scene) return;
        this.renderer.render(scene, this.camera);
    }
    
    /**
     * Apply camera preset
     */
    applyPreset(presetName, target = { x: 0, y: 0, z: 0 }) {
        const preset = cameraPresets[presetName];
        if (!preset || !this.camera) return;
        
        this.preset = presetName;
        
        this.camera.position.set(...preset.position);
        this.camera.up.set(...preset.up);
        this.camera.lookAt(target.x, target.y, target.z);
        
        if (this.controls) {
            this.controls.target.set(target.x, target.y, target.z);
            this.controls.update();
        }
    }
    
    /**
     * Dispose of this viewport's resources
     */
    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
        }
        if (this.controls) {
            this.controls.dispose();
        }
        if (this.container && this.label) {
            this.label.remove();
        }
    }
}

/**
 * ViewportManager - Manages single or quad viewport layouts
 */
export class ViewportManager {
    constructor(container, THREE) {
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        this.THREE = THREE;
        
        this.mode = 'single';  // 'single' | 'quad'
        this.viewports = [];
        this.scene = null;
        this.mainRenderer = null;
        this.mainCamera = null;
        this.mainControls = null;
        
        // Track which viewport is active (for controls)
        this.activeViewport = null;
        
        // Quad view container
        this.quadContainer = null;
        
        // Event callbacks
        this.onModeChange = null;
        this.onViewportClick = null;
        
        // Keyboard shortcuts enabled
        this.keyboardEnabled = true;
        
        this._boundKeyHandler = this._handleKeyboard.bind(this);
        this._boundResizeHandler = this._handleResize.bind(this);
    }
    
    /**
     * Initialize the viewport manager with existing scene/camera/renderer
     */
    init(scene, camera, renderer, controls) {
        this.scene = scene;
        this.mainRenderer = renderer;
        this.mainCamera = camera;
        this.mainControls = controls;
        
        // Create the main viewport reference
        const mainViewport = new Viewport({
            name: 'perspective',
            container: this.container,
            renderer: renderer,
            camera: camera,
            controls: controls,
            preset: 'perspective',
            isOrthographic: false
        });
        
        this.viewports = [mainViewport];
        this.activeViewport = mainViewport;
        
        // Set up event listeners
        document.addEventListener('keydown', this._boundKeyHandler);
        window.addEventListener('resize', this._boundResizeHandler);
        
        console.log('[ViewportManager] Initialized in single mode');
    }
    
    /**
     * Toggle between single and quad view
     */
    toggle() {
        if (this.mode === 'single') {
            this.setQuadView();
        } else {
            this.setSingleView();
        }
    }
    
    /**
     * Set up quad view layout
     */
    setQuadView() {
        if (this.mode === 'quad') return;
        if (!this.container || !this.THREE) {
            console.error('[ViewportManager] Container or THREE not available');
            return;
        }
        
        console.log('[ViewportManager] Setting up quad view...');
        
        const THREE = this.THREE;
        
        // Hide the main canvas
        if (this.mainRenderer && this.mainRenderer.domElement) {
            this.mainRenderer.domElement.style.display = 'none';
        }
        
        // Create quad container
        this.quadContainer = document.createElement('div');
        this.quadContainer.className = 'quad-viewport-container';
        this.quadContainer.innerHTML = `
            <div class="quad-viewport" data-view="top"></div>
            <div class="quad-viewport" data-view="front"></div>
            <div class="quad-viewport" data-view="right"></div>
            <div class="quad-viewport" data-view="perspective"></div>
        `;
        this.container.appendChild(this.quadContainer);
        
        // Clear existing viewports (except we keep reference to main)
        this.viewports = [];
        
        // View configurations
        const viewConfigs = [
            { name: 'top', preset: 'top', ortho: true },
            { name: 'front', preset: 'front', ortho: true },
            { name: 'right', preset: 'right', ortho: true },
            { name: 'perspective', preset: 'perspective', ortho: false }
        ];
        
        // Get the frustum size based on scene bounds
        const frustumSize = 100;
        
        viewConfigs.forEach(config => {
            const viewContainer = this.quadContainer.querySelector(`[data-view="${config.name}"]`);
            if (!viewContainer) return;
            
            const rect = viewContainer.getBoundingClientRect();
            const width = rect.width || 400;
            const height = rect.height || 300;
            const aspect = width / height;
            
            // Create camera
            let camera;
            if (config.ortho) {
                camera = new THREE.OrthographicCamera(
                    -frustumSize * aspect / 2,
                    frustumSize * aspect / 2,
                    frustumSize / 2,
                    -frustumSize / 2,
                    0.1,
                    2000
                );
                camera.userData.frustumSize = frustumSize;
            } else {
                // Reuse main camera for perspective if it's the last one
                camera = this.mainCamera.clone();
                camera.aspect = aspect;
                camera.updateProjectionMatrix();
            }
            
            // Apply preset
            const preset = cameraPresets[config.preset];
            camera.position.set(...preset.position);
            camera.up.set(...preset.up);
            camera.lookAt(0, 0, 0);
            
            // Create renderer
            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: false,
                powerPreference: 'high-performance'
            });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setClearColor(0x0a0a0b);
            viewContainer.appendChild(renderer.domElement);
            
            // Create controls (import dynamically since we might not have it)
            let controls = null;
            if (window.OrbitControls || this.mainControls) {
                const OrbitControls = window.OrbitControls || this.mainControls.constructor;
                controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.05;
                controls.target.set(0, 0, 0);
                
                // For orthographic views, limit rotation
                if (config.ortho) {
                    controls.enableRotate = false;
                    controls.screenSpacePanning = true;
                }
                
                controls.update();
            }
            
            // Create viewport object
            const viewport = new Viewport({
                name: config.name,
                container: viewContainer,
                renderer: renderer,
                camera: camera,
                controls: controls,
                preset: config.preset,
                isOrthographic: config.ortho
            });
            
            // Add label
            const label = document.createElement('div');
            label.className = 'viewport-label';
            label.textContent = preset.label;
            viewContainer.appendChild(label);
            viewport.label = label;
            
            // Click handler for maximizing
            viewContainer.addEventListener('dblclick', () => {
                this._maximizeViewport(viewport);
            });
            
            // Click to activate
            viewContainer.addEventListener('click', () => {
                this._setActiveViewport(viewport);
            });
            
            this.viewports.push(viewport);
        });
        
        this.mode = 'quad';
        this._addQuadStyles();
        
        // Start animation loop for quad view
        this._startQuadRenderLoop();
        
        if (this.onModeChange) {
            this.onModeChange('quad');
        }
        
        console.log('[ViewportManager] Quad view active');
    }
    
    /**
     * Return to single viewport mode
     */
    setSingleView() {
        if (this.mode === 'single') return;
        
        console.log('[ViewportManager] Returning to single view...');
        
        // Stop quad render loop
        if (this._quadAnimationId) {
            cancelAnimationFrame(this._quadAnimationId);
            this._quadAnimationId = null;
        }
        
        // Dispose of quad viewports
        this.viewports.forEach(vp => {
            if (vp.renderer !== this.mainRenderer) {
                vp.dispose();
            }
        });
        
        // Remove quad container
        if (this.quadContainer) {
            this.quadContainer.remove();
            this.quadContainer = null;
        }
        
        // Show main canvas again
        if (this.mainRenderer && this.mainRenderer.domElement) {
            this.mainRenderer.domElement.style.display = 'block';
        }
        
        // Reset viewports to main only
        const mainViewport = new Viewport({
            name: 'perspective',
            container: this.container,
            renderer: this.mainRenderer,
            camera: this.mainCamera,
            controls: this.mainControls,
            preset: 'perspective',
            isOrthographic: false
        });
        
        this.viewports = [mainViewport];
        this.activeViewport = mainViewport;
        this.mode = 'single';
        
        if (this.onModeChange) {
            this.onModeChange('single');
        }
        
        console.log('[ViewportManager] Single view active');
    }
    
    /**
     * Set camera to a specific preset view (for single mode)
     */
    setView(presetName) {
        if (this.mode !== 'single') {
            // In quad mode, find and maximize that viewport
            const vp = this.viewports.find(v => v.preset === presetName);
            if (vp) {
                this._setActiveViewport(vp);
            }
            return;
        }
        
        const preset = cameraPresets[presetName];
        if (!preset || !this.mainCamera) return;
        
        const target = this.mainControls?.target || { x: 0, y: 0, z: 0 };
        const distance = this.mainCamera.position.distanceTo(
            new this.THREE.Vector3(target.x, target.y, target.z)
        );
        
        // Scale position to maintain viewing distance
        const dir = new this.THREE.Vector3(...preset.position).normalize();
        this.mainCamera.position.copy(dir.multiplyScalar(distance));
        this.mainCamera.up.set(...preset.up);
        this.mainCamera.lookAt(target.x, target.y, target.z);
        
        if (this.mainControls) {
            this.mainControls.update();
        }
        
        console.log(`[ViewportManager] View: ${presetName.toUpperCase()}`);
    }
    
    /**
     * Render all viewports (call from main animation loop)
     */
    render() {
        if (this.mode === 'single') {
            // Main render loop handles this
            return;
        }
        
        // Quad mode - render each viewport
        this.viewports.forEach(vp => {
            if (vp.controls) {
                vp.controls.update();
            }
            vp.render(this.scene);
        });
    }
    
    /**
     * Handle window resize
     */
    resize() {
        if (this.mode === 'single') return;
        
        this.viewports.forEach(vp => {
            if (vp.container) {
                const rect = vp.container.getBoundingClientRect();
                vp.resize(rect.width, rect.height);
            }
        });
    }
    
    /**
     * Dispose of all resources
     */
    dispose() {
        document.removeEventListener('keydown', this._boundKeyHandler);
        window.removeEventListener('resize', this._boundResizeHandler);
        
        if (this._quadAnimationId) {
            cancelAnimationFrame(this._quadAnimationId);
        }
        
        this.viewports.forEach(vp => {
            if (vp.renderer !== this.mainRenderer) {
                vp.dispose();
            }
        });
        
        if (this.quadContainer) {
            this.quadContainer.remove();
        }
    }
    
    // ==================== Private Methods ====================
    
    /**
     * Start the render loop for quad view
     */
    _startQuadRenderLoop() {
        const animate = () => {
            if (this.mode !== 'quad') return;
            
            this._quadAnimationId = requestAnimationFrame(animate);
            this.render();
        };
        animate();
    }
    
    /**
     * Handle keyboard shortcuts
     */
    _handleKeyboard(e) {
        if (!this.keyboardEnabled) return;
        
        // Don't trigger if user is typing
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        
        // Ctrl+Alt+Q = Toggle quad view
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'q') {
            e.preventDefault();
            this.toggle();
            return;
        }
        
        // Numpad shortcuts for views
        switch (e.key) {
            case '7':
            case 'Numpad7':
                e.preventDefault();
                this.setView('top');
                break;
            case '1':
            case 'Numpad1':
                e.preventDefault();
                this.setView('front');
                break;
            case '3':
            case 'Numpad3':
                e.preventDefault();
                this.setView('right');
                break;
            case '0':
            case 'Numpad0':
                e.preventDefault();
                this.setView('perspective');
                break;
        }
    }
    
    /**
     * Handle window resize
     */
    _handleResize() {
        this.resize();
    }
    
    /**
     * Set the active viewport
     */
    _setActiveViewport(viewport) {
        this.viewports.forEach(vp => {
            if (vp.container) {
                vp.container.classList.remove('active');
            }
        });
        
        if (viewport.container) {
            viewport.container.classList.add('active');
        }
        
        this.activeViewport = viewport;
        
        if (this.onViewportClick) {
            this.onViewportClick(viewport);
        }
    }
    
    /**
     * Maximize a viewport (double-click handler)
     */
    _maximizeViewport(viewport) {
        if (viewport.isMaximized) {
            // Restore all viewports
            this.viewports.forEach(vp => {
                if (vp.container) {
                    vp.container.classList.remove('maximized', 'hidden');
                }
                vp.isMaximized = false;
            });
        } else {
            // Maximize this viewport, hide others
            this.viewports.forEach(vp => {
                if (vp === viewport) {
                    vp.container.classList.add('maximized');
                    vp.isMaximized = true;
                } else {
                    vp.container.classList.add('hidden');
                }
            });
        }
        
        // Trigger resize after layout change
        setTimeout(() => this.resize(), 100);
    }
    
    /**
     * Add CSS styles for quad viewport layout
     */
    _addQuadStyles() {
        if (document.getElementById('quad-viewport-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'quad-viewport-styles';
        style.textContent = `
            .quad-viewport-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-template-rows: 1fr 1fr;
                gap: 2px;
                width: 100%;
                height: 100%;
                background: #0a0a0b;
                position: absolute;
                top: 0;
                left: 0;
            }
            
            .quad-viewport {
                position: relative;
                background: #0a0a0b;
                border: 1px solid #35353a;
                overflow: hidden;
            }
            
            .quad-viewport.active {
                border-color: #e8b13f;
            }
            
            .quad-viewport canvas {
                display: block;
                width: 100%;
                height: 100%;
            }
            
            .quad-viewport .viewport-label {
                position: absolute;
                top: 8px;
                left: 8px;
                background: rgba(26, 26, 31, 0.9);
                color: #e8b13f;
                font-family: 'Menlo', 'Monaco', monospace;
                font-size: 10px;
                font-weight: bold;
                padding: 4px 8px;
                border-radius: 2px;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                pointer-events: none;
                border: 1px solid #35353a;
            }
            
            .quad-viewport.active .viewport-label {
                background: rgba(232, 177, 63, 0.2);
                border-color: #e8b13f;
            }
            
            .quad-viewport.maximized {
                grid-column: 1 / -1;
                grid-row: 1 / -1;
                z-index: 10;
            }
            
            .quad-viewport.hidden {
                display: none;
            }
            
            /* Transition for smooth maximize/restore */
            .quad-viewport {
                transition: opacity 0.2s ease;
            }
        `;
        document.head.appendChild(style);
    }
    
    // ==================== Static Helpers ====================
    
    /**
     * Get the current mode
     */
    getMode() {
        return this.mode;
    }
    
    /**
     * Get all viewports
     */
    getViewports() {
        return this.viewports;
    }
    
    /**
     * Get the active viewport
     */
    getActiveViewport() {
        return this.activeViewport;
    }
}

// Default export
export default ViewportManager;
