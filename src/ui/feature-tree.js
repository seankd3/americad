/**
 * Ameri-CAD Feature Tree UI
 * Displays and manages the parametric feature tree
 */

/**
 * Feature Tree UI Component
 */
export class FeatureTreeUI {
    constructor(containerSelector, documentModel) {
        this.container = document.querySelector(containerSelector);
        this.document = documentModel;
        this.selectedFeatureId = null;
        
        // Callbacks
        this.onFeatureSelect = null;
        this.onFeatureDoubleClick = null;
        this.onVisibilityToggle = null;
        this.onFeatureDelete = null;
        this.onFeatureRename = null;
        
        // Chain document events (don't overwrite existing handlers)
        const existingAdded = this.document.onFeatureAdded;
        const existingRemoved = this.document.onFeatureRemoved;
        const existingModified = this.document.onFeatureModified;
        
        this.document.onFeatureAdded = (feature) => {
            // Don't trigger evaluator for external features
            if (existingAdded && !feature?.params?.external) {
                existingAdded(feature);
            }
            this.render();
        };
        
        this.document.onFeatureRemoved = (feature) => {
            if (existingRemoved && !feature?.params?.external) {
                existingRemoved(feature);
            }
            this.render();
        };
        
        this.document.onFeatureModified = (feature) => {
            if (existingModified && !feature?.params?.external) {
                existingModified(feature);
            }
            this.render();
        };
        
        // Initial render
        this.render();
    }
    
    /**
     * Render the feature tree
     */
    render() {
        if (!this.container) return;
        
        const features = Array.from(this.document.features.values());
        
        if (features.length === 0) {
            this.container.innerHTML = `
                <div class="tree-empty">
                    <div class="tree-empty-icon">📦</div>
                    <div class="tree-empty-text">No features yet</div>
                    <div class="tree-empty-hint">Create a primitive to start</div>
                </div>
            `;
            return;
        }
        
        // Build tree structure
        const rootFeatures = this.document.rootFeatures
            .map(id => this.document.getFeature(id))
            .filter(f => f);
        
        let html = '<div class="feature-tree">';
        
        for (const feature of rootFeatures) {
            html += this.renderFeatureNode(feature, 0);
        }
        
        html += '</div>';
        
        this.container.innerHTML = html;
        
        // Bind events
        this.bindEvents();
    }
    
    /**
     * Render a single feature node
     */
    renderFeatureNode(feature, depth) {
        const indent = depth * 16;
        const hasChildren = feature.children.length > 0;
        const isSelected = feature.id === this.selectedFeatureId;
        const isValid = feature.valid;
        const isVisible = feature.visible;
        
        // Icon based on feature type
        const icon = this.getFeatureIcon(feature.type);
        
        // Status indicators
        const statusClass = !isValid ? 'error' : '';
        const visibilityIcon = isVisible ? '👁️' : '👁️‍🗨️';
        
        let html = `
            <div class="tree-node ${isSelected ? 'selected' : ''} ${statusClass}" 
                 data-id="${feature.id}" 
                 style="padding-left: ${indent + 8}px">
                <span class="tree-expand ${hasChildren ? 'has-children' : ''}" data-id="${feature.id}">
                    ${hasChildren ? '▶' : ''}
                </span>
                <span class="tree-icon">${icon}</span>
                <span class="tree-name" data-id="${feature.id}">${feature.name}</span>
                <span class="tree-visibility" data-id="${feature.id}" title="Toggle visibility">
                    ${visibilityIcon}
                </span>
                ${!isValid ? `<span class="tree-error" title="${feature.error}">⚠️</span>` : ''}
            </div>
        `;
        
        // Render children
        if (hasChildren) {
            html += `<div class="tree-children" data-parent="${feature.id}">`;
            for (const childId of feature.children) {
                const child = this.document.getFeature(childId);
                if (child) {
                    html += this.renderFeatureNode(child, depth + 1);
                }
            }
            html += '</div>';
        }
        
        return html;
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
            'boolean_union': '➕',
            'boolean_subtract': '➖',
            'boolean_intersect': '✖️',
            'fillet': '⭕',
            'chamfer': '📐',
            'transform': '↔️',
            'extrude': '⬆️',
            'sketch': '✏️',
            'body': '▪️'
        };
        return icons[type] || '📄';
    }
    
    /**
     * Bind event handlers
     */
    bindEvents() {
        // Node selection
        this.container.querySelectorAll('.tree-node').forEach(node => {
            node.addEventListener('click', (e) => {
                if (e.target.classList.contains('tree-visibility')) return;
                if (e.target.classList.contains('tree-expand')) return;
                
                const id = node.dataset.id;
                this.selectFeature(id);
            });
            
            node.addEventListener('dblclick', (e) => {
                if (e.target.classList.contains('tree-visibility')) return;
                
                const id = node.dataset.id;
                if (this.onFeatureDoubleClick) {
                    this.onFeatureDoubleClick(id);
                }
            });
        });
        
        // Expand/collapse
        this.container.querySelectorAll('.tree-expand.has-children').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const children = this.container.querySelector(`.tree-children[data-parent="${id}"]`);
                if (children) {
                    children.classList.toggle('collapsed');
                    btn.textContent = children.classList.contains('collapsed') ? '▶' : '▼';
                }
            });
        });
        
        // Visibility toggle
        this.container.querySelectorAll('.tree-visibility').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const feature = this.document.getFeature(id);
                if (feature && this.onVisibilityToggle) {
                    this.onVisibilityToggle(id, !feature.visible);
                }
            });
        });
        
        // Context menu
        this.container.querySelectorAll('.tree-node').forEach(node => {
            node.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const id = node.dataset.id;
                this.showContextMenu(e.clientX, e.clientY, id);
            });
        });
        
        // Rename on name double-click
        this.container.querySelectorAll('.tree-name').forEach(name => {
            name.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const id = name.dataset.id;
                this.startRename(id);
            });
        });
    }
    
    /**
     * Select a feature
     */
    selectFeature(featureId) {
        this.selectedFeatureId = featureId;
        
        // Update UI
        this.container.querySelectorAll('.tree-node').forEach(node => {
            node.classList.toggle('selected', node.dataset.id === featureId);
        });
        
        if (this.onFeatureSelect) {
            this.onFeatureSelect(featureId);
        }
    }
    
    /**
     * Show context menu
     */
    showContextMenu(x, y, featureId) {
        // Remove existing menu
        const existing = document.getElementById('feature-context-menu');
        if (existing) existing.remove();
        
        const feature = this.document.getFeature(featureId);
        if (!feature) return;
        
        const menu = document.createElement('div');
        menu.id = 'feature-context-menu';
        menu.className = 'feature-context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        
        menu.innerHTML = `
            <div class="context-item" data-action="edit">✏️ Edit Parameters</div>
            <div class="context-item" data-action="rename">📝 Rename</div>
            <div class="context-divider"></div>
            <div class="context-item" data-action="visibility">
                ${feature.visible ? '👁️‍🗨️ Hide' : '👁️ Show'}
            </div>
            <div class="context-divider"></div>
            <div class="context-item danger" data-action="delete">🗑️ Delete</div>
        `;
        
        document.body.appendChild(menu);
        
        // Handle clicks
        menu.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleContextAction(action, featureId);
                menu.remove();
            });
        });
        
        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', function handler() {
                menu.remove();
                document.removeEventListener('click', handler);
            });
        }, 0);
    }
    
    /**
     * Handle context menu action
     */
    handleContextAction(action, featureId) {
        switch (action) {
            case 'edit':
                if (this.onFeatureDoubleClick) {
                    this.onFeatureDoubleClick(featureId);
                }
                break;
            case 'rename':
                this.startRename(featureId);
                break;
            case 'visibility':
                const feature = this.document.getFeature(featureId);
                if (feature && this.onVisibilityToggle) {
                    this.onVisibilityToggle(featureId, !feature.visible);
                }
                break;
            case 'delete':
                if (this.onFeatureDelete) {
                    this.onFeatureDelete(featureId);
                }
                break;
        }
    }
    
    /**
     * Start inline rename
     */
    startRename(featureId) {
        const feature = this.document.getFeature(featureId);
        if (!feature) return;
        
        const nameEl = this.container.querySelector(`.tree-name[data-id="${featureId}"]`);
        if (!nameEl) return;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'tree-rename-input';
        input.value = feature.name;
        
        nameEl.innerHTML = '';
        nameEl.appendChild(input);
        input.focus();
        input.select();
        
        const finish = () => {
            const newName = input.value.trim() || feature.name;
            if (newName !== feature.name && this.onFeatureRename) {
                this.onFeatureRename(featureId, newName);
            }
            this.render();
        };
        
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finish();
            } else if (e.key === 'Escape') {
                this.render();
            }
        });
    }
    
    /**
     * Scroll to and highlight a feature
     */
    scrollToFeature(featureId) {
        const node = this.container.querySelector(`.tree-node[data-id="${featureId}"]`);
        if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            node.classList.add('highlight');
            setTimeout(() => node.classList.remove('highlight'), 1000);
        }
    }
}

/**
 * Add feature tree styles
 */
export function addFeatureTreeStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .feature-tree {
            font-family: 'Berkeley Mono', monospace;
            font-size: 12px;
        }
        
        .tree-empty {
            text-align: center;
            padding: 20px;
            color: var(--text-muted, #666);
        }
        
        .tree-empty-icon {
            font-size: 32px;
            margin-bottom: 8px;
        }
        
        .tree-empty-text {
            font-weight: 500;
        }
        
        .tree-empty-hint {
            font-size: 10px;
            margin-top: 4px;
        }
        
        .tree-node {
            display: flex;
            align-items: center;
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.1s;
        }
        
        .tree-node:hover {
            background: var(--bg-hover, rgba(255,255,255,0.05));
        }
        
        .tree-node.selected {
            background: var(--bg-selected, rgba(74, 144, 217, 0.2));
        }
        
        .tree-node.error {
            color: var(--text-error, #ff6b6b);
        }
        
        .tree-node.highlight {
            animation: tree-highlight 1s ease;
        }
        
        @keyframes tree-highlight {
            0%, 100% { background: transparent; }
            50% { background: var(--bg-highlight, rgba(255, 200, 0, 0.3)); }
        }
        
        .tree-expand {
            width: 16px;
            text-align: center;
            font-size: 8px;
            color: var(--text-muted, #666);
        }
        
        .tree-expand.has-children {
            cursor: pointer;
        }
        
        .tree-icon {
            margin-right: 6px;
        }
        
        .tree-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .tree-visibility {
            opacity: 0.5;
            cursor: pointer;
            padding: 0 4px;
        }
        
        .tree-visibility:hover {
            opacity: 1;
        }
        
        .tree-error {
            margin-left: 4px;
        }
        
        .tree-children {
            overflow: hidden;
        }
        
        .tree-children.collapsed {
            display: none;
        }
        
        .tree-rename-input {
            background: var(--bg-input, #1a1a1c);
            border: 1px solid var(--border, #333);
            color: inherit;
            font-family: inherit;
            font-size: inherit;
            padding: 2px 4px;
            border-radius: 2px;
            width: 100%;
        }
        
        .feature-context-menu {
            position: fixed;
            background: var(--bg-menu, #1f1f22);
            border: 1px solid var(--border, #333);
            border-radius: 4px;
            padding: 4px 0;
            min-width: 150px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        
        .context-item {
            padding: 6px 12px;
            cursor: pointer;
        }
        
        .context-item:hover {
            background: var(--bg-hover, rgba(255,255,255,0.05));
        }
        
        .context-item.danger {
            color: var(--text-error, #ff6b6b);
        }
        
        .context-divider {
            height: 1px;
            background: var(--border, #333);
            margin: 4px 0;
        }
    `;
    document.head.appendChild(style);
}
