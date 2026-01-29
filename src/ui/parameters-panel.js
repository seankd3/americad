/**
 * Ameri-CAD Parameters Panel
 * 
 * UI panel for managing parametric expressions.
 * Shows all defined parameters, their expressions, and computed values.
 * Allows editing expressions and highlights circular dependencies.
 */

import { parameters, ParameterStore } from '../state/parameters.js';

/**
 * Parameters Panel - displays and edits parametric expressions
 */
export class ParametersPanel {
    constructor(options = {}) {
        this.container = null;
        this.store = options.store || parameters;
        this.onParameterChange = options.onParameterChange || (() => {});
        
        // Track editing state
        this.editingRow = null;
        this.rows = new Map(); // name → row element
        
        this.init();
    }
    
    /**
     * Initialize the panel
     */
    init() {
        // Find or create the parameters panel container
        this.container = document.getElementById('panel-parameters');
        if (!this.container) {
            console.warn('[ParametersPanel] Parameters panel container not found');
            return;
        }
        
        // Clear and create structure
        this.container.innerHTML = '';
        this.createStructure();
        this.addStyles();
        
        // Listen for store changes
        this.store.onChange = (name, value) => {
            this.refresh();
            this.onParameterChange(name, value);
        };
        
        // Initial render
        this.refresh();
    }
    
    /**
     * Create the panel structure
     */
    createStructure() {
        this.container.innerHTML = `
            <div class="params-panel-header">
                <div class="params-title">
                    <span class="params-icon">ƒ</span>
                    <span>PARAMETERS</span>
                </div>
                <button class="params-add-btn" title="Add Parameter">+</button>
            </div>
            
            <div class="params-help-text">
                Define expressions that reference other parameters.
                <span class="params-help-example">e.g., height = width / 2</span>
            </div>
            
            <div class="params-table-header">
                <span class="params-col-name">NAME</span>
                <span class="params-col-expr">EXPRESSION</span>
                <span class="params-col-value">VALUE</span>
                <span class="params-col-actions"></span>
            </div>
            
            <div class="params-list" id="params-list">
                <!-- Parameters rendered here -->
            </div>
            
            <div class="params-empty" id="params-empty">
                <div class="empty-icon">∅</div>
                <div class="empty-text">No parameters defined</div>
                <button class="params-add-first-btn">+ Add First Parameter</button>
            </div>
            
            <div class="params-footer">
                <div class="params-functions-hint">
                    <span class="hint-label">FUNCTIONS:</span>
                    <span class="hint-list">min, max, sqrt, sin, cos, tan, abs, floor, ceil, round</span>
                </div>
                <div class="params-constants-hint">
                    <span class="hint-label">CONSTANTS:</span>
                    <span class="hint-list">PI, E, TAU</span>
                </div>
            </div>
        `;
        
        this.bindEvents();
    }
    
    /**
     * Bind event handlers
     */
    bindEvents() {
        // Add button
        const addBtn = this.container.querySelector('.params-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addNewParameter());
        }
        
        // Add first button (in empty state)
        const addFirstBtn = this.container.querySelector('.params-add-first-btn');
        if (addFirstBtn) {
            addFirstBtn.addEventListener('click', () => this.addNewParameter());
        }
    }
    
    /**
     * Refresh the parameter list
     */
    refresh() {
        const list = this.container.querySelector('#params-list');
        const empty = this.container.querySelector('#params-empty');
        
        if (!list || !empty) return;
        
        const params = this.store.getAll();
        
        if (params.length === 0) {
            list.style.display = 'none';
            empty.style.display = '';
            this.container.querySelector('.params-table-header').style.display = 'none';
            return;
        }
        
        list.style.display = '';
        empty.style.display = 'none';
        this.container.querySelector('.params-table-header').style.display = '';
        
        // Sort by topological order for intuitive display
        const order = this.store.getTopologicalOrder();
        params.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
        
        // Render rows
        list.innerHTML = params.map(param => this.renderRow(param)).join('');
        
        // Rebind row events
        this.bindRowEvents(list);
    }
    
    /**
     * Render a single parameter row
     */
    renderRow(param) {
        const hasError = param.error != null;
        const isCircular = param.error?.includes('Circular');
        const deps = param.dependencies.length > 0 
            ? `data-deps="${param.dependencies.join(', ')}"` 
            : '';
        
        const valueDisplay = hasError
            ? `<span class="param-error-value" title="${param.error}">ERROR</span>`
            : `<span class="param-value-num">${this.formatValue(param.value)}</span>`;
        
        return `
            <div class="param-row ${hasError ? 'has-error' : ''} ${isCircular ? 'circular' : ''}" 
                 data-name="${param.name}" ${deps}>
                <span class="param-name" title="Click to rename">${param.name}</span>
                <span class="param-expression" title="Click to edit">${this.escapeHtml(param.expression)}</span>
                <span class="param-value">${valueDisplay}</span>
                <span class="param-actions">
                    <button class="param-action-btn edit" title="Edit">✎</button>
                    <button class="param-action-btn delete" title="Delete">×</button>
                </span>
            </div>
        `;
    }
    
    /**
     * Bind events to parameter rows
     */
    bindRowEvents(list) {
        // Edit expression on click
        list.querySelectorAll('.param-expression').forEach(el => {
            el.addEventListener('click', (e) => {
                const row = e.target.closest('.param-row');
                const name = row.dataset.name;
                this.editExpression(name, row);
            });
        });
        
        // Rename on name click
        list.querySelectorAll('.param-name').forEach(el => {
            el.addEventListener('dblclick', (e) => {
                const row = e.target.closest('.param-row');
                const name = row.dataset.name;
                this.renameName(name, row);
            });
        });
        
        // Edit button
        list.querySelectorAll('.param-action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('.param-row');
                const name = row.dataset.name;
                this.editExpression(name, row);
            });
        });
        
        // Delete button
        list.querySelectorAll('.param-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('.param-row');
                const name = row.dataset.name;
                this.deleteParameter(name);
            });
        });
        
        // Hover to highlight dependencies
        list.querySelectorAll('.param-row').forEach(row => {
            row.addEventListener('mouseenter', () => this.highlightDependencies(row));
            row.addEventListener('mouseleave', () => this.clearHighlights());
        });
    }
    
    /**
     * Add a new parameter
     */
    addNewParameter() {
        // Generate unique name
        let index = 1;
        let name = `param${index}`;
        while (this.store.has(name)) {
            index++;
            name = `param${index}`;
        }
        
        // Add with default value
        try {
            this.store.set(name, 0);
            this.refresh();
            
            // Focus the expression for editing
            setTimeout(() => {
                const row = this.container.querySelector(`[data-name="${name}"]`);
                if (row) {
                    this.editExpression(name, row);
                }
            }, 50);
        } catch (e) {
            this.showError(e.message);
        }
    }
    
    /**
     * Edit an expression inline
     */
    editExpression(name, row) {
        const exprEl = row.querySelector('.param-expression');
        const currentExpr = this.store.getExpression(name);
        
        // Replace with input
        exprEl.innerHTML = `
            <input type="text" class="param-expr-input" value="${this.escapeHtml(currentExpr)}" />
        `;
        
        const input = exprEl.querySelector('input');
        input.focus();
        input.select();
        
        const save = () => {
            const newExpr = input.value.trim();
            if (newExpr === '') {
                // Delete if empty
                this.deleteParameter(name);
            } else {
                try {
                    this.store.set(name, newExpr);
                } catch (e) {
                    this.showError(e.message);
                }
            }
            this.refresh();
        };
        
        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.removeEventListener('blur', save);
                this.refresh();
            }
        });
    }
    
    /**
     * Rename a parameter
     */
    renameName(name, row) {
        const nameEl = row.querySelector('.param-name');
        
        nameEl.innerHTML = `
            <input type="text" class="param-name-input" value="${name}" />
        `;
        
        const input = nameEl.querySelector('input');
        input.focus();
        input.select();
        
        const save = () => {
            const newName = input.value.trim();
            if (newName && newName !== name) {
                try {
                    this.store.rename(name, newName);
                } catch (e) {
                    this.showError(e.message);
                }
            }
            this.refresh();
        };
        
        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.removeEventListener('blur', save);
                this.refresh();
            }
        });
    }
    
    /**
     * Delete a parameter
     */
    deleteParameter(name) {
        const dependents = this.store.getDependents(name);
        
        if (dependents.length > 0) {
            this.showError(`Cannot delete '${name}': used by ${dependents.join(', ')}`);
            return;
        }
        
        try {
            this.store.delete(name);
            this.refresh();
        } catch (e) {
            this.showError(e.message);
        }
    }
    
    /**
     * Highlight dependencies of a parameter
     */
    highlightDependencies(row) {
        const name = row.dataset.name;
        const deps = this.store.getDependencies(name);
        const dependents = this.store.getDependents(name);
        
        // Highlight dependencies (what this uses)
        for (const dep of deps) {
            const depRow = this.container.querySelector(`[data-name="${dep}"]`);
            if (depRow) {
                depRow.classList.add('highlight-dependency');
            }
        }
        
        // Highlight dependents (what uses this)
        for (const dep of dependents) {
            const depRow = this.container.querySelector(`[data-name="${dep}"]`);
            if (depRow) {
                depRow.classList.add('highlight-dependent');
            }
        }
    }
    
    /**
     * Clear all dependency highlights
     */
    clearHighlights() {
        this.container.querySelectorAll('.param-row').forEach(row => {
            row.classList.remove('highlight-dependency', 'highlight-dependent');
        });
    }
    
    /**
     * Show error message
     */
    showError(message) {
        // Check if error toast already exists
        let toast = this.container.querySelector('.params-error-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'params-error-toast';
            this.container.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.classList.add('visible');
        
        setTimeout(() => {
            toast.classList.remove('visible');
        }, 3000);
    }
    
    /**
     * Format a numeric value for display
     */
    formatValue(value) {
        if (typeof value !== 'number' || isNaN(value)) {
            return '—';
        }
        
        // Check if integer
        if (Number.isInteger(value)) {
            return value.toString();
        }
        
        // Format with appropriate precision
        if (Math.abs(value) < 0.001) {
            return value.toExponential(3);
        }
        
        return value.toFixed(4).replace(/\.?0+$/, '');
    }
    
    /**
     * Escape HTML special characters
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    /**
     * Get the parameter store
     */
    getStore() {
        return this.store;
    }
    
    /**
     * Add component styles
     */
    addStyles() {
        if (document.getElementById('parameters-panel-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'parameters-panel-styles';
        style.textContent = `
            /* Parameters Panel Header */
            .params-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-3, 12px) var(--space-4, 16px);
                border-bottom: 1px solid var(--border-subtle, #27272b);
            }
            
            .params-title {
                display: flex;
                align-items: center;
                gap: var(--space-2, 8px);
                font-size: var(--text-sm, 11px);
                font-weight: var(--font-semibold, 600);
                letter-spacing: 0.1em;
                color: var(--text-primary, #f5f5f5);
            }
            
            .params-icon {
                font-family: serif;
                font-style: italic;
                font-size: 16px;
                color: var(--accent-primary, #e8b13f);
            }
            
            .params-add-btn {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--bg-300, #1f1f22);
                border: 1px solid var(--border-subtle, #27272b);
                border-radius: var(--radius-sm, 2px);
                color: var(--text-secondary, #a0a0a5);
                font-size: 16px;
                cursor: pointer;
                transition: all var(--transition-fast, 80ms);
            }
            
            .params-add-btn:hover {
                background: var(--accent-primary, #e8b13f);
                border-color: var(--accent-primary, #e8b13f);
                color: var(--bg-100, #121214);
            }
            
            /* Help Text */
            .params-help-text {
                padding: var(--space-2, 8px) var(--space-4, 16px);
                font-size: var(--text-xs, 10px);
                color: var(--text-tertiary, #6a6a70);
                background: var(--bg-200, #18181a);
            }
            
            .params-help-example {
                display: block;
                font-family: var(--font-mono);
                color: var(--accent-primary, #e8b13f);
                opacity: 0.7;
                margin-top: 2px;
            }
            
            /* Table Header */
            .params-table-header {
                display: grid;
                grid-template-columns: 80px 1fr 70px 50px;
                gap: var(--space-2, 8px);
                padding: var(--space-2, 8px) var(--space-4, 16px);
                font-size: var(--text-xs, 10px);
                color: var(--text-tertiary, #6a6a70);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                border-bottom: 1px solid var(--border-subtle, #27272b);
                background: var(--bg-200, #18181a);
            }
            
            /* Parameters List */
            .params-list {
                max-height: 300px;
                overflow-y: auto;
            }
            
            /* Parameter Row */
            .param-row {
                display: grid;
                grid-template-columns: 80px 1fr 70px 50px;
                gap: var(--space-2, 8px);
                padding: var(--space-2, 8px) var(--space-4, 16px);
                border-bottom: 1px solid var(--border-subtle, #27272b);
                transition: background var(--transition-fast, 80ms);
            }
            
            .param-row:hover {
                background: var(--surface-hover, rgba(255, 255, 255, 0.03));
            }
            
            .param-row.has-error {
                background: rgba(255, 100, 100, 0.05);
            }
            
            .param-row.circular {
                background: rgba(255, 150, 50, 0.1);
            }
            
            .param-row.highlight-dependency {
                background: rgba(100, 200, 255, 0.1);
                box-shadow: inset 3px 0 0 var(--axis-z, #4444ff);
            }
            
            .param-row.highlight-dependent {
                background: rgba(100, 255, 100, 0.1);
                box-shadow: inset 3px 0 0 var(--axis-y, #44ff44);
            }
            
            /* Parameter Name */
            .param-name {
                font-family: var(--font-mono);
                font-size: var(--text-sm, 11px);
                color: var(--text-primary, #f5f5f5);
                cursor: pointer;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .param-name:hover {
                color: var(--accent-primary, #e8b13f);
            }
            
            .param-name-input {
                width: 100%;
                background: var(--bg-100, #121214);
                border: 1px solid var(--accent-primary, #e8b13f);
                border-radius: var(--radius-sm, 2px);
                padding: 2px 4px;
                font-family: var(--font-mono);
                font-size: var(--text-sm, 11px);
                color: var(--text-primary, #f5f5f5);
            }
            
            .param-name-input:focus {
                outline: none;
            }
            
            /* Parameter Expression */
            .param-expression {
                font-family: var(--font-mono);
                font-size: var(--text-sm, 11px);
                color: var(--text-secondary, #a0a0a5);
                cursor: pointer;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .param-expression:hover {
                color: var(--text-primary, #f5f5f5);
            }
            
            .param-expr-input {
                width: 100%;
                background: var(--bg-100, #121214);
                border: 1px solid var(--accent-primary, #e8b13f);
                border-radius: var(--radius-sm, 2px);
                padding: 2px 6px;
                font-family: var(--font-mono);
                font-size: var(--text-sm, 11px);
                color: var(--text-primary, #f5f5f5);
            }
            
            .param-expr-input:focus {
                outline: none;
            }
            
            /* Parameter Value */
            .param-value {
                font-family: var(--font-mono);
                font-size: var(--text-sm, 11px);
                text-align: right;
            }
            
            .param-value-num {
                color: var(--accent-primary, #e8b13f);
            }
            
            .param-error-value {
                color: var(--semantic-error, #ff6b6b);
                font-size: var(--text-xs, 10px);
            }
            
            /* Parameter Actions */
            .param-actions {
                display: flex;
                gap: 4px;
                justify-content: flex-end;
                opacity: 0;
                transition: opacity var(--transition-fast, 80ms);
            }
            
            .param-row:hover .param-actions {
                opacity: 1;
            }
            
            .param-action-btn {
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: transparent;
                border: none;
                color: var(--text-tertiary, #6a6a70);
                font-size: 12px;
                cursor: pointer;
                border-radius: var(--radius-sm, 2px);
            }
            
            .param-action-btn:hover {
                background: var(--surface-hover, #35353a);
                color: var(--text-primary, #f5f5f5);
            }
            
            .param-action-btn.delete:hover {
                background: rgba(255, 100, 100, 0.2);
                color: var(--semantic-error, #ff6b6b);
            }
            
            /* Empty State */
            .params-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--space-8, 32px) var(--space-4, 16px);
                text-align: center;
                color: var(--text-tertiary, #6a6a70);
            }
            
            .params-empty .empty-icon {
                font-size: 24px;
                margin-bottom: var(--space-2, 8px);
                opacity: 0.5;
            }
            
            .params-empty .empty-text {
                font-size: var(--text-sm, 11px);
                margin-bottom: var(--space-3, 12px);
            }
            
            .params-add-first-btn {
                padding: var(--space-2, 8px) var(--space-4, 16px);
                background: var(--bg-300, #1f1f22);
                border: 1px solid var(--border-subtle, #27272b);
                border-radius: var(--radius-md, 3px);
                color: var(--text-secondary, #a0a0a5);
                font-size: var(--text-sm, 11px);
                cursor: pointer;
                transition: all var(--transition-fast, 80ms);
            }
            
            .params-add-first-btn:hover {
                background: var(--accent-primary, #e8b13f);
                border-color: var(--accent-primary, #e8b13f);
                color: var(--bg-100, #121214);
            }
            
            /* Footer Hints */
            .params-footer {
                padding: var(--space-3, 12px) var(--space-4, 16px);
                background: var(--bg-200, #18181a);
                border-top: 1px solid var(--border-subtle, #27272b);
            }
            
            .params-functions-hint,
            .params-constants-hint {
                font-size: var(--text-xs, 10px);
                color: var(--text-tertiary, #6a6a70);
                margin-bottom: 4px;
            }
            
            .params-constants-hint {
                margin-bottom: 0;
            }
            
            .hint-label {
                color: var(--text-secondary, #a0a0a5);
                margin-right: 4px;
            }
            
            .hint-list {
                font-family: var(--font-mono);
            }
            
            /* Error Toast */
            .params-error-toast {
                position: absolute;
                bottom: var(--space-4, 16px);
                left: var(--space-4, 16px);
                right: var(--space-4, 16px);
                padding: var(--space-2, 8px) var(--space-3, 12px);
                background: rgba(255, 100, 100, 0.9);
                color: white;
                font-size: var(--text-xs, 10px);
                border-radius: var(--radius-md, 3px);
                opacity: 0;
                transform: translateY(10px);
                transition: all var(--transition-normal, 150ms);
                pointer-events: none;
            }
            
            .params-error-toast.visible {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        
        document.head.appendChild(style);
    }
}

/**
 * Singleton instance
 */
let panelInstance = null;

export function getParametersPanel(options = {}) {
    if (!panelInstance) {
        panelInstance = new ParametersPanel(options);
    }
    return panelInstance;
}

export function initParametersPanel(options = {}) {
    return getParametersPanel(options);
}

export default ParametersPanel;
