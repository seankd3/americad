/**
 * Ameri-CAD Property Panel
 * 
 * Real-time inline property editor for selected features.
 * Shows in the right sidebar under Properties tab.
 */

import { FEATURE_PARAMS, getFeatureParams, hasEditableParams } from './param-editor.js';

/**
 * Property Panel - Inline property editor bound to selection
 */
export class PropertyPanel {
    constructor(options = {}) {
        this.container = null;
        this.document = options.document || null;
        this.onPropertyChange = options.onPropertyChange || (() => {});
        
        this.currentFeature = null;
        this.inputs = {};
        this.debounceTimer = null;
        
        // Section collapse states
        this.collapsedSections = new Set();
        
        this.init();
    }
    
    /**
     * Initialize the property panel
     */
    init() {
        // Find or create the properties panel container
        this.container = document.getElementById('panel-properties');
        if (!this.container) {
            console.warn('[PropertyPanel] Properties panel container not found');
            return;
        }
        
        // Clear static content and create dynamic structure
        this.container.innerHTML = '';
        this.createStructure();
        this.addStyles();
    }
    
    /**
     * Create the panel structure
     */
    createStructure() {
        this.container.innerHTML = `
            <div class="property-panel-empty" id="prop-empty">
                <div class="empty-icon">◎</div>
                <div class="empty-text">NO SELECTION</div>
                <div class="empty-hint">Select an object to view properties</div>
            </div>
            
            <div class="property-panel-content" id="prop-content" style="display: none;">
                <!-- Identity Section -->
                <div class="data-section prop-section" data-section="identity">
                    <div class="section-header prop-section-header">
                        <span class="section-collapse-icon">▼</span>
                        <span class="section-title">IDENTITY</span>
                    </div>
                    <div class="section-body">
                        <div class="property-row">
                            <span class="property-label">NAME</span>
                            <input type="text" class="property-input" id="prop-name" placeholder="Feature name">
                        </div>
                        <div class="property-row">
                            <span class="property-label">TYPE</span>
                            <span class="property-value" id="prop-type">—</span>
                        </div>
                        <div class="property-row">
                            <span class="property-label">ID</span>
                            <span class="property-value property-id" id="prop-id">—</span>
                        </div>
                    </div>
                </div>
                
                <!-- Parameters Section (dynamic based on feature type) -->
                <div class="data-section prop-section" data-section="params" id="prop-params-section" style="display: none;">
                    <div class="section-header prop-section-header">
                        <span class="section-collapse-icon">▼</span>
                        <span class="section-title">PARAMETERS</span>
                    </div>
                    <div class="section-body" id="prop-params">
                        <!-- Dynamic parameter fields -->
                    </div>
                </div>
                
                <!-- Transform Section -->
                <div class="data-section prop-section" data-section="transform">
                    <div class="section-header prop-section-header">
                        <span class="section-collapse-icon">▼</span>
                        <span class="section-title">TRANSFORM</span>
                    </div>
                    <div class="section-body" id="prop-transform">
                        <div class="vector-group">
                            <label class="vector-label">POSITION (MM)</label>
                            <div class="vector-inputs">
                                <div class="vector-input">
                                    <span class="axis-marker x">X</span>
                                    <input type="number" id="prop-pos-x" value="0" step="1">
                                </div>
                                <div class="vector-input">
                                    <span class="axis-marker y">Y</span>
                                    <input type="number" id="prop-pos-y" value="0" step="1">
                                </div>
                                <div class="vector-input">
                                    <span class="axis-marker z">Z</span>
                                    <input type="number" id="prop-pos-z" value="0" step="1">
                                </div>
                            </div>
                        </div>
                        <div class="vector-group">
                            <label class="vector-label">ROTATION (DEG)</label>
                            <div class="vector-inputs">
                                <div class="vector-input">
                                    <span class="axis-marker x">X</span>
                                    <input type="number" id="prop-rot-x" value="0" step="1">
                                </div>
                                <div class="vector-input">
                                    <span class="axis-marker y">Y</span>
                                    <input type="number" id="prop-rot-y" value="0" step="1">
                                </div>
                                <div class="vector-input">
                                    <span class="axis-marker z">Z</span>
                                    <input type="number" id="prop-rot-z" value="0" step="1">
                                </div>
                            </div>
                        </div>
                        <div class="vector-group">
                            <label class="vector-label">SCALE</label>
                            <div class="vector-inputs">
                                <div class="vector-input">
                                    <span class="axis-marker x">X</span>
                                    <input type="number" id="prop-scale-x" value="1" step="0.1" min="0.001">
                                </div>
                                <div class="vector-input">
                                    <span class="axis-marker y">Y</span>
                                    <input type="number" id="prop-scale-y" value="1" step="0.1" min="0.001">
                                </div>
                                <div class="vector-input">
                                    <span class="axis-marker z">Z</span>
                                    <input type="number" id="prop-scale-z" value="1" step="0.1" min="0.001">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Geometry Info Section -->
                <div class="data-section prop-section" data-section="geometry">
                    <div class="section-header prop-section-header">
                        <span class="section-collapse-icon">▼</span>
                        <span class="section-title">GEOMETRY DATA</span>
                    </div>
                    <div class="section-body">
                        <div class="info-grid" id="prop-geometry">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.bindEvents();
    }
    
    /**
     * Bind event handlers
     */
    bindEvents() {
        // Section collapse toggles
        this.container.querySelectorAll('.prop-section-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const section = header.closest('.prop-section');
                const sectionName = section.dataset.section;
                this.toggleSection(sectionName, section);
            });
        });
        
        // Name field
        const nameInput = this.container.querySelector('#prop-name');
        if (nameInput) {
            nameInput.addEventListener('input', () => this.handleNameChange(nameInput.value));
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') nameInput.blur();
            });
        }
    }
    
    /**
     * Toggle section collapse state
     */
    toggleSection(sectionName, sectionEl) {
        const isCollapsed = this.collapsedSections.has(sectionName);
        const body = sectionEl.querySelector('.section-body');
        const icon = sectionEl.querySelector('.section-collapse-icon');
        
        if (isCollapsed) {
            this.collapsedSections.delete(sectionName);
            body.style.display = '';
            icon.textContent = '▼';
            sectionEl.classList.remove('collapsed');
        } else {
            this.collapsedSections.add(sectionName);
            body.style.display = 'none';
            icon.textContent = '▶';
            sectionEl.classList.add('collapsed');
        }
    }
    
    /**
     * Handle name input change
     */
    handleNameChange(name) {
        if (!this.currentFeature) return;
        
        // Update feature name
        this.currentFeature.name = name;
        
        // Debounced callback
        this.emitPropertyChange('name', name);
    }
    
    /**
     * Handle parameter input change
     */
    handleParamChange(paramName, value) {
        if (!this.currentFeature) return;
        
        // Parse value
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        
        // Update feature params
        this.currentFeature.params[paramName] = numValue;
        
        // Debounced callback for geometry regeneration
        this.emitPropertyChange('param', { [paramName]: numValue });
    }
    
    /**
     * Handle transform input change
     */
    handleTransformChange() {
        if (!this.currentFeature) return;
        
        const transform = {
            position: {
                x: parseFloat(this.container.querySelector('#prop-pos-x')?.value) || 0,
                y: parseFloat(this.container.querySelector('#prop-pos-y')?.value) || 0,
                z: parseFloat(this.container.querySelector('#prop-pos-z')?.value) || 0
            },
            rotation: {
                x: parseFloat(this.container.querySelector('#prop-rot-x')?.value) || 0,
                y: parseFloat(this.container.querySelector('#prop-rot-y')?.value) || 0,
                z: parseFloat(this.container.querySelector('#prop-rot-z')?.value) || 0
            },
            scale: {
                x: parseFloat(this.container.querySelector('#prop-scale-x')?.value) || 1,
                y: parseFloat(this.container.querySelector('#prop-scale-y')?.value) || 1,
                z: parseFloat(this.container.querySelector('#prop-scale-z')?.value) || 1
            }
        };
        
        this.emitPropertyChange('transform', transform);
    }
    
    /**
     * Emit property change with debounce
     */
    emitPropertyChange(type, value) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.onPropertyChange(this.currentFeature?.id, type, value);
        }, 150);
    }
    
    /**
     * Bind to a feature (called when selection changes)
     */
    bind(feature, mesh = null) {
        this.currentFeature = feature;
        this.inputs = {};
        
        const emptyEl = this.container.querySelector('#prop-empty');
        const contentEl = this.container.querySelector('#prop-content');
        
        if (!feature) {
            // No selection
            emptyEl.style.display = '';
            contentEl.style.display = 'none';
            return;
        }
        
        // Show content
        emptyEl.style.display = 'none';
        contentEl.style.display = '';
        
        // Populate identity
        this.container.querySelector('#prop-name').value = feature.name || '';
        this.container.querySelector('#prop-type').textContent = this.formatType(feature.type);
        this.container.querySelector('#prop-id').textContent = feature.id;
        
        // Populate parameters
        this.populateParameters(feature);
        
        // Populate transform from mesh if available
        this.populateTransform(mesh, feature);
        
        // Populate geometry info
        this.populateGeometryInfo(mesh, feature);
    }
    
    /**
     * Populate parameter inputs based on feature type
     */
    populateParameters(feature) {
        const paramsSection = this.container.querySelector('#prop-params-section');
        const paramsContainer = this.container.querySelector('#prop-params');
        
        const paramDefs = getFeatureParams(feature.type);
        
        if (paramDefs.length === 0) {
            // No editable params (e.g., boolean operations)
            paramsSection.style.display = 'none';
            return;
        }
        
        paramsSection.style.display = '';
        
        // Build parameter fields
        const html = paramDefs.map(def => {
            const value = feature.params[def.name] ?? def.default ?? 0;
            const min = def.min !== undefined ? `min="${def.min}"` : '';
            const max = def.max !== undefined ? `max="${def.max}"` : '';
            const step = def.step || 0.1;
            
            return `
                <div class="param-row">
                    <label class="param-label">${def.label || def.name}</label>
                    <div class="param-input-wrap">
                        <button class="param-step-btn minus" data-param="${def.name}" data-step="${-step}">−</button>
                        <input type="number" 
                            class="param-input" 
                            id="param-${def.name}"
                            data-param="${def.name}"
                            value="${value}"
                            step="${step}"
                            ${min}
                            ${max}
                        >
                        <button class="param-step-btn plus" data-param="${def.name}" data-step="${step}">+</button>
                    </div>
                </div>
            `;
        }).join('');
        
        paramsContainer.innerHTML = html;
        
        // Bind input events
        paramsContainer.querySelectorAll('.param-input').forEach(input => {
            const paramName = input.dataset.param;
            this.inputs[paramName] = input;
            
            input.addEventListener('input', () => {
                this.handleParamChange(paramName, input.value);
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') input.blur();
            });
        });
        
        // Bind step button events
        paramsContainer.querySelectorAll('.param-step-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const paramName = btn.dataset.param;
                const step = parseFloat(btn.dataset.step);
                const input = this.inputs[paramName];
                if (input) {
                    const currentVal = parseFloat(input.value) || 0;
                    const newVal = Math.round((currentVal + step) * 1000) / 1000;
                    const minVal = parseFloat(input.min);
                    if (!isNaN(minVal) && newVal < minVal) return;
                    input.value = newVal;
                    this.handleParamChange(paramName, newVal);
                }
            });
        });
    }
    
    /**
     * Populate transform fields from mesh
     */
    populateTransform(mesh, feature) {
        if (mesh) {
            // Get mesh transform
            const pos = mesh.position;
            const rot = mesh.rotation;
            const scale = mesh.scale;
            
            this.container.querySelector('#prop-pos-x').value = pos.x.toFixed(2);
            this.container.querySelector('#prop-pos-y').value = pos.y.toFixed(2);
            this.container.querySelector('#prop-pos-z').value = pos.z.toFixed(2);
            
            // Convert radians to degrees
            this.container.querySelector('#prop-rot-x').value = (rot.x * 180 / Math.PI).toFixed(1);
            this.container.querySelector('#prop-rot-y').value = (rot.y * 180 / Math.PI).toFixed(1);
            this.container.querySelector('#prop-rot-z').value = (rot.z * 180 / Math.PI).toFixed(1);
            
            this.container.querySelector('#prop-scale-x').value = scale.x.toFixed(3);
            this.container.querySelector('#prop-scale-y').value = scale.y.toFixed(3);
            this.container.querySelector('#prop-scale-z').value = scale.z.toFixed(3);
        } else if (feature.params.center) {
            // Use center from params
            const c = feature.params.center;
            this.container.querySelector('#prop-pos-x').value = (c.x || 0).toFixed(2);
            this.container.querySelector('#prop-pos-y').value = (c.y || 0).toFixed(2);
            this.container.querySelector('#prop-pos-z').value = (c.z || 0).toFixed(2);
            
            this.container.querySelector('#prop-rot-x').value = '0';
            this.container.querySelector('#prop-rot-y').value = '0';
            this.container.querySelector('#prop-rot-z').value = '0';
            
            this.container.querySelector('#prop-scale-x').value = '1';
            this.container.querySelector('#prop-scale-y').value = '1';
            this.container.querySelector('#prop-scale-z').value = '1';
        }
        
        // Bind transform input events
        ['pos-x', 'pos-y', 'pos-z', 'rot-x', 'rot-y', 'rot-z', 'scale-x', 'scale-y', 'scale-z'].forEach(id => {
            const input = this.container.querySelector(`#prop-${id}`);
            if (input) {
                input.addEventListener('input', () => this.handleTransformChange());
            }
        });
    }
    
    /**
     * Populate geometry info section
     */
    populateGeometryInfo(mesh, feature) {
        const container = this.container.querySelector('#prop-geometry');
        if (!container) return;
        
        // Default info
        let info = {
            volume: '—',
            surface: '—',
            faces: '—',
            edges: '—',
            vertices: '—'
        };
        
        // Calculate from mesh if available
        if (mesh?.geometry) {
            const geo = mesh.geometry;
            const posAttr = geo.getAttribute('position');
            const indexAttr = geo.index;
            
            const vertexCount = posAttr ? posAttr.count : 0;
            const triangleCount = indexAttr ? indexAttr.count / 3 : vertexCount / 3;
            
            info.vertices = vertexCount.toLocaleString();
            info.faces = Math.floor(triangleCount).toLocaleString();
            
            // Estimate edges (for triangulated mesh: edges ≈ 1.5 * triangles)
            info.edges = Math.floor(triangleCount * 1.5).toLocaleString();
            
            // Compute bounding box volume
            geo.computeBoundingBox();
            if (geo.boundingBox) {
                const size = geo.boundingBox.max.clone().sub(geo.boundingBox.min);
                const bbVolume = size.x * size.y * size.z;
                info.volume = `~${bbVolume.toFixed(2)} MM³`;
            }
        }
        
        // Add feature-specific info
        if (feature.type === 'box') {
            const { width = 10, height = 10, depth = 10 } = feature.params;
            info.volume = `${(width * height * depth).toFixed(2)} MM³`;
            info.surface = `${(2 * (width * height + height * depth + width * depth)).toFixed(2)} MM²`;
            info.faces = '6';
            info.edges = '12';
            info.vertices = '8';
        } else if (feature.type === 'sphere') {
            const r = feature.params.radius || 5;
            info.volume = `${((4/3) * Math.PI * r * r * r).toFixed(2)} MM³`;
            info.surface = `${(4 * Math.PI * r * r).toFixed(2)} MM²`;
        } else if (feature.type === 'cylinder') {
            const r = feature.params.radius || 5;
            const h = feature.params.height || 10;
            info.volume = `${(Math.PI * r * r * h).toFixed(2)} MM³`;
            info.surface = `${(2 * Math.PI * r * (r + h)).toFixed(2)} MM²`;
        }
        
        container.innerHTML = `
            <div class="info-item">
                <span class="info-label">VOLUME</span>
                <span class="info-value">${info.volume}</span>
            </div>
            <div class="info-item">
                <span class="info-label">SURFACE</span>
                <span class="info-value">${info.surface}</span>
            </div>
            <div class="info-item">
                <span class="info-label">FACES</span>
                <span class="info-value">${info.faces}</span>
            </div>
            <div class="info-item">
                <span class="info-label">EDGES</span>
                <span class="info-value">${info.edges}</span>
            </div>
            <div class="info-item">
                <span class="info-label">VERTICES</span>
                <span class="info-value">${info.vertices}</span>
            </div>
        `;
    }
    
    /**
     * Update a specific parameter input value (for external updates)
     */
    updateParam(paramName, value) {
        const input = this.inputs[paramName];
        if (input) {
            input.value = value;
        }
    }
    
    /**
     * Refresh panel with current feature data
     */
    refresh() {
        if (this.currentFeature) {
            this.bind(this.currentFeature);
        }
    }
    
    /**
     * Clear the panel
     */
    clear() {
        this.bind(null);
    }
    
    /**
     * Format feature type for display
     */
    formatType(type) {
        const typeMap = {
            'box': 'BOX / SOLID',
            'sphere': 'SPHERE / SOLID',
            'cylinder': 'CYLINDER / SOLID',
            'cone': 'CONE / SOLID',
            'torus': 'TORUS / SOLID',
            'wedge': 'WEDGE / SOLID',
            'boolean_union': 'UNION / BOOLEAN',
            'boolean_subtract': 'SUBTRACT / BOOLEAN',
            'boolean_intersect': 'INTERSECT / BOOLEAN',
            'fillet': 'FILLET / MODIFIER',
            'chamfer': 'CHAMFER / MODIFIER',
            'extrude': 'EXTRUDE / FEATURE',
            'sketch': 'SKETCH / 2D'
        };
        return typeMap[type] || type.toUpperCase();
    }
    
    /**
     * Add component styles
     */
    addStyles() {
        if (document.getElementById('property-panel-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'property-panel-styles';
        style.textContent = `
            /* Property Panel Empty State */
            .property-panel-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--space-8, 32px) var(--space-4, 16px);
                text-align: center;
                color: var(--text-tertiary, #6a6a70);
            }
            
            .property-panel-empty .empty-icon {
                font-size: 32px;
                margin-bottom: var(--space-3, 12px);
                opacity: 0.5;
            }
            
            .property-panel-empty .empty-text {
                font-size: var(--text-sm, 11px);
                font-weight: var(--font-semibold, 600);
                letter-spacing: 0.1em;
                margin-bottom: var(--space-1, 4px);
            }
            
            .property-panel-empty .empty-hint {
                font-size: var(--text-xs, 10px);
                opacity: 0.7;
            }
            
            /* Property Panel Content */
            .property-panel-content {
                display: flex;
                flex-direction: column;
                gap: 0;
            }
            
            /* Section Headers - Collapsible */
            .prop-section-header {
                display: flex;
                align-items: center;
                gap: var(--space-2, 8px);
                cursor: pointer;
                user-select: none;
            }
            
            .prop-section-header:hover {
                background: var(--surface-hover, #35353a);
            }
            
            .section-collapse-icon {
                font-size: 8px;
                color: var(--text-tertiary, #6a6a70);
                transition: transform var(--transition-fast, 80ms);
            }
            
            .prop-section.collapsed .section-collapse-icon {
                transform: rotate(-90deg);
            }
            
            /* Property ID styling */
            .property-id {
                font-family: var(--font-mono);
                font-size: var(--text-xs, 10px);
                opacity: 0.6;
            }
            
            /* Parameter Row */
            .param-row {
                display: flex;
                align-items: center;
                gap: var(--space-3, 12px);
                padding: var(--space-2, 8px) 0;
            }
            
            .param-label {
                flex: 0 0 90px;
                font-size: var(--text-sm, 11px);
                color: var(--text-secondary, #a0a0a5);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            .param-input-wrap {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 0;
                background: var(--bg-200, #18181a);
                border: 1px solid var(--border-subtle, #27272b);
                border-radius: var(--radius-md, 3px);
                overflow: hidden;
            }
            
            .param-input-wrap:focus-within {
                border-color: var(--accent-primary, #e8b13f);
            }
            
            .param-input {
                flex: 1;
                background: transparent;
                border: none;
                padding: var(--space-2, 8px) var(--space-3, 12px);
                color: var(--text-primary, #f5f5f5);
                font-family: var(--font-mono);
                font-size: var(--text-md, 13px);
                text-align: center;
                min-width: 0;
            }
            
            .param-input:focus {
                outline: none;
            }
            
            .param-input::-webkit-inner-spin-button,
            .param-input::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            
            .param-input[type="number"] {
                -moz-appearance: textfield;
            }
            
            /* Step Buttons (+/-) */
            .param-step-btn {
                flex: 0 0 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--bg-300, #1f1f22);
                border: none;
                color: var(--text-secondary, #a0a0a5);
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all var(--transition-fast, 80ms);
            }
            
            .param-step-btn:hover {
                background: var(--surface-hover, #35353a);
                color: var(--text-primary, #f5f5f5);
            }
            
            .param-step-btn:active {
                background: var(--surface-active, #3d3d42);
            }
            
            .param-step-btn.minus {
                border-right: 1px solid var(--border-subtle, #27272b);
            }
            
            .param-step-btn.plus {
                border-left: 1px solid var(--border-subtle, #27272b);
            }
            
            /* Info Grid - Geometry Data */
            .info-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: var(--space-2, 8px);
            }
            
            .info-item {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            
            .info-label {
                font-size: var(--text-xs, 10px);
                color: var(--text-tertiary, #6a6a70);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            .info-value {
                font-size: var(--text-sm, 11px);
                color: var(--text-primary, #f5f5f5);
                font-family: var(--font-mono);
            }
            
            /* Vector inputs (transform) */
            .vector-group {
                margin-bottom: var(--space-3, 12px);
            }
            
            .vector-group:last-child {
                margin-bottom: 0;
            }
            
            .vector-label {
                display: block;
                font-size: var(--text-xs, 10px);
                color: var(--text-tertiary, #6a6a70);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: var(--space-2, 8px);
            }
            
            .vector-inputs {
                display: flex;
                gap: var(--space-2, 8px);
            }
            
            .vector-input {
                flex: 1;
                display: flex;
                align-items: center;
                background: var(--bg-200, #18181a);
                border: 1px solid var(--border-subtle, #27272b);
                border-radius: var(--radius-md, 3px);
                overflow: hidden;
            }
            
            .vector-input:focus-within {
                border-color: var(--accent-primary, #e8b13f);
            }
            
            .axis-marker {
                flex: 0 0 20px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: var(--text-xs, 10px);
                font-weight: var(--font-semibold, 600);
            }
            
            .axis-marker.x { background: rgba(255, 68, 68, 0.2); color: var(--axis-x, #ff4444); }
            .axis-marker.y { background: rgba(68, 255, 68, 0.2); color: var(--axis-y, #44ff44); }
            .axis-marker.z { background: rgba(68, 68, 255, 0.2); color: var(--axis-z, #4444ff); }
            
            .vector-input input {
                flex: 1;
                background: transparent;
                border: none;
                padding: var(--space-1, 4px) var(--space-2, 8px);
                color: var(--text-primary, #f5f5f5);
                font-family: var(--font-mono);
                font-size: var(--text-sm, 11px);
                min-width: 0;
            }
            
            .vector-input input:focus {
                outline: none;
            }
            
            .vector-input input::-webkit-inner-spin-button,
            .vector-input input::-webkit-outer-spin-button {
                -webkit-appearance: none;
            }
            
            .vector-input input[type="number"] {
                -moz-appearance: textfield;
            }
        `;
        
        document.head.appendChild(style);
    }
}

/**
 * Create and export singleton instance
 */
let panelInstance = null;

export function getPropertyPanel(options = {}) {
    if (!panelInstance) {
        panelInstance = new PropertyPanel(options);
    }
    return panelInstance;
}

export function initPropertyPanel(options = {}) {
    return getPropertyPanel(options);
}

export default PropertyPanel;
