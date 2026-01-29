/**
 * Ameri-CAD Parameter Editor UI
 * 
 * Modal dialog for editing feature parameters.
 * Shows when user double-clicks feature tree item or selects "Edit" from context menu.
 */

/**
 * Feature type → editable parameters mapping
 * Defines what params each feature type has
 */
export const FEATURE_PARAMS = {
    box: [
        { name: 'width', type: 'number', label: 'Width', min: 0.001 },
        { name: 'height', type: 'number', label: 'Height', min: 0.001 },
        { name: 'depth', type: 'number', label: 'Depth', min: 0.001 }
    ],
    sphere: [
        { name: 'radius', type: 'number', label: 'Radius', min: 0.001 }
    ],
    cylinder: [
        { name: 'radius', type: 'number', label: 'Radius', min: 0.001 },
        { name: 'height', type: 'number', label: 'Height', min: 0.001 }
    ],
    cone: [
        { name: 'radius1', type: 'number', label: 'Base Radius', min: 0.001 },
        { name: 'radius2', type: 'number', label: 'Top Radius', min: 0 },
        { name: 'height', type: 'number', label: 'Height', min: 0.001 }
    ],
    torus: [
        { name: 'majorRadius', type: 'number', label: 'Major Radius', min: 0.001 },
        { name: 'minorRadius', type: 'number', label: 'Minor Radius', min: 0.001 }
    ],
    wedge: [
        { name: 'dx', type: 'number', label: 'X Dimension', min: 0.001 },
        { name: 'dy', type: 'number', label: 'Y Dimension', min: 0.001 },
        { name: 'dz', type: 'number', label: 'Z Dimension', min: 0.001 },
        { name: 'ltx', type: 'number', label: 'Top X Dimension', min: 0 }
    ],
    fillet: [
        { name: 'radius', type: 'number', label: 'Fillet Radius', min: 0.001 }
    ],
    chamfer: [
        { name: 'distance', type: 'number', label: 'Chamfer Distance', min: 0.001 }
    ],
    // Boolean operations don't have editable dimension params
    boolean_union: [],
    boolean_subtract: [],
    boolean_intersect: []
};

/**
 * Get editable parameters for a feature type
 */
export function getFeatureParams(featureType) {
    // Handle variants like 'boolean_union', etc.
    const baseType = featureType.split('_')[0] === 'boolean' ? featureType : featureType;
    return FEATURE_PARAMS[baseType] || [];
}

/**
 * Check if a feature type has editable parameters
 */
export function hasEditableParams(featureType) {
    const params = getFeatureParams(featureType);
    return params.length > 0;
}

/**
 * Parameter Editor Modal Dialog
 */
export class ParamEditor {
    constructor(options = {}) {
        this.onApply = options.onApply || (() => {});
        this.onCancel = options.onCancel || (() => {});
        
        this.element = null;
        this.feature = null;
        this.inputs = {};
        
        this.addStyles();
    }
    
    /**
     * Open the editor for a feature
     */
    open(feature) {
        if (!feature) return;
        
        this.feature = feature;
        const params = getFeatureParams(feature.type);
        
        if (params.length === 0) {
            console.log(`[ParamEditor] Feature type '${feature.type}' has no editable parameters`);
            return;
        }
        
        this.createElement(feature, params);
        this.show();
    }
    
    /**
     * Create the modal element
     */
    createElement(feature, paramDefs) {
        // Remove existing
        this.close();
        
        this.element = document.createElement('div');
        this.element.className = 'param-editor-overlay';
        
        const icon = this.getFeatureIcon(feature.type);
        
        this.element.innerHTML = `
            <div class="param-editor-modal">
                <div class="param-editor-header">
                    <span class="param-editor-icon">${icon}</span>
                    <span class="param-editor-title">Edit ${feature.name}</span>
                    <button class="param-editor-close" title="Close">&times;</button>
                </div>
                <div class="param-editor-body">
                    <div class="param-editor-type">Type: ${feature.type}</div>
                    <div class="param-editor-fields">
                        ${this.renderFields(paramDefs, feature.params)}
                    </div>
                </div>
                <div class="param-editor-footer">
                    <button class="param-editor-btn cancel">Cancel</button>
                    <button class="param-editor-btn apply">Apply</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.element);
        
        // Cache input references
        this.inputs = {};
        for (const def of paramDefs) {
            this.inputs[def.name] = this.element.querySelector(`[data-param="${def.name}"]`);
        }
        
        // Bind events
        this.bindEvents();
        
        // Focus first input
        const firstInput = this.element.querySelector('.param-editor-input');
        if (firstInput) {
            firstInput.focus();
            firstInput.select();
        }
    }
    
    /**
     * Render parameter input fields
     */
    renderFields(paramDefs, currentValues) {
        return paramDefs.map(def => {
            const value = currentValues[def.name] ?? def.default ?? 0;
            const min = def.min !== undefined ? `min="${def.min}"` : '';
            const max = def.max !== undefined ? `max="${def.max}"` : '';
            const step = def.step || 0.1;
            
            return `
                <div class="param-editor-field">
                    <label class="param-editor-label">${def.label || def.name}</label>
                    <input 
                        type="number" 
                        class="param-editor-input" 
                        data-param="${def.name}"
                        value="${value}"
                        step="${step}"
                        ${min}
                        ${max}
                    >
                </div>
            `;
        }).join('');
    }
    
    /**
     * Bind event handlers
     */
    bindEvents() {
        // Close button
        this.element.querySelector('.param-editor-close').addEventListener('click', () => {
            this.cancel();
        });
        
        // Cancel button
        this.element.querySelector('.cancel').addEventListener('click', () => {
            this.cancel();
        });
        
        // Apply button
        this.element.querySelector('.apply').addEventListener('click', () => {
            this.apply();
        });
        
        // Click outside to close
        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.cancel();
            }
        });
        
        // Keyboard shortcuts
        this.element.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cancel();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                this.apply();
            }
        });
        
        // Live preview on input change (optional - could enable this)
        // for (const input of Object.values(this.inputs)) {
        //     input.addEventListener('input', () => this.preview());
        // }
    }
    
    /**
     * Get current values from inputs
     */
    getValues() {
        const values = {};
        for (const [name, input] of Object.entries(this.inputs)) {
            if (input) {
                values[name] = parseFloat(input.value) || 0;
            }
        }
        return values;
    }
    
    /**
     * Apply changes and close
     */
    apply() {
        const values = this.getValues();
        
        // Validate values
        const paramDefs = getFeatureParams(this.feature.type);
        for (const def of paramDefs) {
            const value = values[def.name];
            if (def.min !== undefined && value < def.min) {
                this.showError(`${def.label || def.name} must be at least ${def.min}`);
                return;
            }
            if (def.max !== undefined && value > def.max) {
                this.showError(`${def.label || def.name} must be at most ${def.max}`);
                return;
            }
        }
        
        console.log(`[ParamEditor] Applying changes to ${this.feature.name}:`, values);
        
        this.onApply(this.feature.id, values);
        this.close();
    }
    
    /**
     * Cancel and close
     */
    cancel() {
        this.onCancel();
        this.close();
    }
    
    /**
     * Show the modal
     */
    show() {
        if (this.element) {
            this.element.classList.add('visible');
        }
    }
    
    /**
     * Close and remove the modal
     */
    close() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        this.feature = null;
        this.inputs = {};
    }
    
    /**
     * Show error message
     */
    showError(message) {
        const body = this.element?.querySelector('.param-editor-body');
        if (!body) return;
        
        // Remove existing error
        const existing = body.querySelector('.param-editor-error');
        if (existing) existing.remove();
        
        const error = document.createElement('div');
        error.className = 'param-editor-error';
        error.textContent = message;
        body.insertBefore(error, body.firstChild);
        
        // Auto-remove after 3 seconds
        setTimeout(() => error.remove(), 3000);
    }
    
    /**
     * Get icon for feature type
     */
    getFeatureIcon(type) {
        const icons = {
            'box': '📦',
            'cube': '📦',
            'cylinder': '🛢️',
            'sphere': '🔵',
            'cone': '🔺',
            'torus': '🍩',
            'wedge': '📐',
            'boolean_union': '➕',
            'boolean_subtract': '➖',
            'boolean_intersect': '✖️',
            'fillet': '⭕',
            'chamfer': '📐',
            'transform': '↔️'
        };
        return icons[type] || '📄';
    }
    
    /**
     * Add styles to document
     */
    addStyles() {
        if (document.getElementById('param-editor-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'param-editor-styles';
        style.textContent = `
            .param-editor-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                opacity: 0;
                transition: opacity 0.15s ease;
            }
            
            .param-editor-overlay.visible {
                opacity: 1;
            }
            
            .param-editor-modal {
                background: var(--bg-panel, #1f1f22);
                border: 1px solid var(--border, #333);
                border-radius: 8px;
                min-width: 300px;
                max-width: 400px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                transform: translateY(-10px);
                transition: transform 0.15s ease;
            }
            
            .param-editor-overlay.visible .param-editor-modal {
                transform: translateY(0);
            }
            
            .param-editor-header {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid var(--border, #333);
                background: var(--bg-header, #16161a);
                border-radius: 8px 8px 0 0;
            }
            
            .param-editor-icon {
                font-size: 18px;
                margin-right: 8px;
            }
            
            .param-editor-title {
                flex: 1;
                font-weight: 600;
                color: var(--text-primary, #fff);
            }
            
            .param-editor-close {
                background: none;
                border: none;
                color: var(--text-muted, #888);
                font-size: 20px;
                cursor: pointer;
                padding: 0 4px;
                line-height: 1;
            }
            
            .param-editor-close:hover {
                color: var(--text-primary, #fff);
            }
            
            .param-editor-body {
                padding: 16px;
            }
            
            .param-editor-type {
                font-size: 11px;
                color: var(--text-muted, #666);
                margin-bottom: 16px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .param-editor-fields {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .param-editor-field {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .param-editor-label {
                flex: 0 0 100px;
                font-size: 13px;
                color: var(--text-secondary, #aaa);
            }
            
            .param-editor-input {
                flex: 1;
                background: var(--bg-input, #1a1a1c);
                border: 1px solid var(--border, #333);
                border-radius: 4px;
                padding: 8px 12px;
                color: var(--text-primary, #fff);
                font-family: 'Berkeley Mono', 'JetBrains Mono', monospace;
                font-size: 13px;
            }
            
            .param-editor-input:focus {
                outline: none;
                border-color: var(--accent, #4a90d9);
            }
            
            .param-editor-input::-webkit-inner-spin-button,
            .param-editor-input::-webkit-outer-spin-button {
                opacity: 1;
            }
            
            .param-editor-error {
                background: rgba(255, 100, 100, 0.1);
                border: 1px solid rgba(255, 100, 100, 0.3);
                color: #ff6b6b;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                margin-bottom: 12px;
            }
            
            .param-editor-footer {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                padding: 12px 16px;
                border-top: 1px solid var(--border, #333);
                background: var(--bg-header, #16161a);
                border-radius: 0 0 8px 8px;
            }
            
            .param-editor-btn {
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.1s ease;
                font-family: inherit;
            }
            
            .param-editor-btn.cancel {
                background: transparent;
                border: 1px solid var(--border, #333);
                color: var(--text-secondary, #aaa);
            }
            
            .param-editor-btn.cancel:hover {
                background: var(--bg-hover, rgba(255,255,255,0.05));
                color: var(--text-primary, #fff);
            }
            
            .param-editor-btn.apply {
                background: var(--accent, #4a90d9);
                border: 1px solid var(--accent, #4a90d9);
                color: white;
                font-weight: 500;
            }
            
            .param-editor-btn.apply:hover {
                background: var(--accent-hover, #5a9fe9);
            }
        `;
        
        document.head.appendChild(style);
    }
}

/**
 * Create a singleton instance for easy access
 */
let editorInstance = null;

export function getParamEditor(options = {}) {
    if (!editorInstance) {
        editorInstance = new ParamEditor(options);
    }
    return editorInstance;
}

/**
 * Quick function to open editor for a feature
 */
export function editFeature(feature, onApply, onCancel) {
    const editor = getParamEditor({
        onApply: onApply || (() => {}),
        onCancel: onCancel || (() => {})
    });
    editor.onApply = onApply || (() => {});
    editor.onCancel = onCancel || (() => {});
    editor.open(feature);
    return editor;
}

export default ParamEditor;
