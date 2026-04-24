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
    this.onSuppressionToggle = null;
    this.onFeatureDelete = null;
    this.onFeatureRename = null;
    this.onFeatureReorder = null;

    // Drag state
    this._draggedFeatureId = null;
    this._dropTargetId = null;
    this._dropPosition = null; // 'before' or 'after'

    // Chain document events (don't overwrite existing handlers)
    const existingAdded = this.document.onFeatureAdded;
    const existingRemoved = this.document.onFeatureRemoved;
    const existingModified = this.document.onFeatureModified;

    this.document.onFeatureAdded = feature => {
      // Don't trigger evaluator for external features
      if (existingAdded && !feature?.params?.external) {
        existingAdded(feature);
      }
      this.render();
    };

    this.document.onFeatureRemoved = feature => {
      if (existingRemoved && !feature?.params?.external) {
        existingRemoved(feature);
      }
      this.render();
    };

    this.document.onFeatureModified = feature => {
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
    const isSuppressed = feature.suppressed;
    const isEffectivelySuppressed = this.document.isEffectivelySuppressed(feature.id);

    // Icon based on feature type
    const icon = this.getFeatureIcon(feature.type);

    // Status indicators
    let statusClass = '';
    if (!isValid) statusClass = 'error';
    if (isSuppressed) statusClass = 'suppressed';
    if (isEffectivelySuppressed && !isSuppressed) statusClass = 'inherited-suppressed';

    const visibilityIcon = isVisible ? '👁️' : '👁️‍🗨️';
    const suppressionIcon = isSuppressed ? '⏸️' : '';

    let html = `
            <div class="tree-node ${isSelected ? 'selected' : ''} ${statusClass}" 
                 data-id="${feature.id}" 
                 data-position="${this.document.getFeaturePosition ? this.document.getFeaturePosition(feature.id) : -1}"
                 draggable="true"
                 style="padding-left: ${indent + 8}px">
                <span class="tree-expand ${hasChildren ? 'has-children' : ''}" data-id="${feature.id}">
                    ${hasChildren ? '▶' : ''}
                </span>
                <span class="tree-icon">${icon}</span>
                <span class="tree-name" data-id="${feature.id}">${feature.name}</span>
                ${suppressionIcon ? `<span class="tree-suppression" data-id="${feature.id}" title="Feature is suppressed">${suppressionIcon}</span>` : ''}
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
      box: '📦',
      cube: '📦',
      cylinder: '🛢️',
      sphere: '🔵',
      cone: '🔺',
      torus: '🍩',
      boolean_union: '➕',
      boolean_subtract: '➖',
      boolean_intersect: '✖️',
      fillet: '⭕',
      chamfer: '📐',
      transform: '↔️',
      extrude: '⬆️',
      sketch: '✏️',
      body: '▪️',
    };
    return icons[type] || '📄';
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Node selection
    this.container.querySelectorAll('.tree-node').forEach(node => {
      node.addEventListener('click', e => {
        if (e.target.classList.contains('tree-visibility')) return;
        if (e.target.classList.contains('tree-expand')) return;

        const id = node.dataset.id;
        this.selectFeature(id);
      });

      node.addEventListener('dblclick', e => {
        if (e.target.classList.contains('tree-visibility')) return;

        const id = node.dataset.id;
        if (this.onFeatureDoubleClick) {
          this.onFeatureDoubleClick(id);
        }
      });
    });

    // Expand/collapse
    this.container.querySelectorAll('.tree-expand.has-children').forEach(btn => {
      btn.addEventListener('click', e => {
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
      btn.addEventListener('click', e => {
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
      node.addEventListener('contextmenu', e => {
        e.preventDefault();
        const id = node.dataset.id;
        this.showContextMenu(e.clientX, e.clientY, id);
      });
    });

    // Rename on name double-click
    this.container.querySelectorAll('.tree-name').forEach(name => {
      name.addEventListener('dblclick', e => {
        e.stopPropagation();
        const id = name.dataset.id;
        this.startRename(id);
      });
    });

    // Drag and drop for reordering
    this.container.querySelectorAll('.tree-node').forEach(node => {
      node.addEventListener('dragstart', e => {
        this._handleDragStart(e, node);
      });

      node.addEventListener('dragover', e => {
        this._handleDragOver(e, node);
      });

      node.addEventListener('dragleave', e => {
        this._handleDragLeave(e, node);
      });

      node.addEventListener('drop', e => {
        this._handleDrop(e, node);
      });

      node.addEventListener('dragend', e => {
        this._handleDragEnd(e);
      });
    });
  }

  /**
   * Handle drag start event
   */
  _handleDragStart(e, node) {
    const featureId = node.dataset.id;
    this._draggedFeatureId = featureId;

    e.dataTransfer.setData('text/plain', featureId);
    e.dataTransfer.effectAllowed = 'move';

    // Add dragging class after a brief delay to show visual feedback
    setTimeout(() => {
      node.classList.add('dragging');
    }, 0);
  }

  /**
   * Handle drag over event
   */
  _handleDragOver(e, node) {
    e.preventDefault();

    if (!this._draggedFeatureId) return;

    const targetId = node.dataset.id;
    if (targetId === this._draggedFeatureId) return;

    const rect = node.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';

    // Calculate target position index
    const targetPosition = parseInt(node.dataset.position, 10);
    const newPosition = position === 'before' ? targetPosition : targetPosition + 1;

    // Validate if reorder is allowed
    const validation = this.document.canReorder
      ? this.document.canReorder(this._draggedFeatureId, newPosition)
      : { valid: true };

    // Remove existing indicators
    this.container.querySelectorAll('.tree-node').forEach(n => {
      n.classList.remove('drop-before', 'drop-after', 'drop-invalid');
    });

    if (validation.valid) {
      e.dataTransfer.dropEffect = 'move';
      node.classList.add(position === 'before' ? 'drop-before' : 'drop-after');
      this._dropTargetId = targetId;
      this._dropPosition = position;
    } else {
      e.dataTransfer.dropEffect = 'none';
      node.classList.add('drop-invalid');
      this._dropTargetId = null;
      this._dropPosition = null;
    }
  }

  /**
   * Handle drag leave event
   */
  _handleDragLeave(e, node) {
    node.classList.remove('drop-before', 'drop-after', 'drop-invalid');
  }

  /**
   * Handle drop event
   */
  _handleDrop(e, node) {
    e.preventDefault();

    if (!this._draggedFeatureId || !this._dropTargetId) {
      this._clearDragState();
      return;
    }

    const targetPosition = parseInt(node.dataset.position, 10);
    let newPosition = this._dropPosition === 'before' ? targetPosition : targetPosition + 1;

    // Adjust for the removal of the dragged item
    const draggedPosition = this.document.getFeaturePosition
      ? this.document.getFeaturePosition(this._draggedFeatureId)
      : -1;
    if (draggedPosition !== -1 && draggedPosition < newPosition) {
      newPosition--;
    }

    if (this.onFeatureReorder) {
      this.onFeatureReorder(this._draggedFeatureId, newPosition);
    }

    this._clearDragState();
  }

  /**
   * Handle drag end event
   */
  _handleDragEnd(_e) {
    this._clearDragState();
  }

  /**
   * Clear drag state and remove visual indicators
   */
  _clearDragState() {
    this._draggedFeatureId = null;
    this._dropTargetId = null;
    this._dropPosition = null;

    this.container.querySelectorAll('.tree-node').forEach(n => {
      n.classList.remove('dragging', 'drop-before', 'drop-after', 'drop-invalid');
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

    // Check if move up/down is possible
    const position = this.document.getFeaturePosition
      ? this.document.getFeaturePosition(featureId)
      : -1;
    const canMoveUp =
      position > 0 &&
      (!this.document.canReorder || this.document.canReorder(featureId, position - 1).valid);
    const canMoveDown =
      position >= 0 &&
      position < this.document.rootFeatures.length - 1 &&
      (!this.document.canReorder || this.document.canReorder(featureId, position + 1).valid);

    menu.innerHTML = `
            <div class="context-item" data-action="edit">✏️ Edit Parameters</div>
            <div class="context-item" data-action="rename">📝 Rename</div>
            <div class="context-divider"></div>
            <div class="context-item ${canMoveUp ? '' : 'disabled'}" data-action="moveUp">⬆️ Move Up</div>
            <div class="context-item ${canMoveDown ? '' : 'disabled'}" data-action="moveDown">⬇️ Move Down</div>
            <div class="context-divider"></div>
            <div class="context-item" data-action="visibility">
                ${feature.visible ? '👁️‍🗨️ Hide' : '👁️ Show'}
            </div>
            <div class="context-item" data-action="suppress">
                ${feature.suppressed ? '▶️ Unsuppress' : '⏸️ Suppress'}
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
      case 'moveUp':
        this._moveFeature(featureId, -1);
        break;
      case 'moveDown':
        this._moveFeature(featureId, 1);
        break;
      case 'visibility':
        const feature = this.document.getFeature(featureId);
        if (feature && this.onVisibilityToggle) {
          this.onVisibilityToggle(featureId, !feature.visible);
        }
        break;
      case 'suppress':
        const suppressFeature = this.document.getFeature(featureId);
        if (suppressFeature && this.onSuppressionToggle) {
          this.onSuppressionToggle(featureId, !suppressFeature.suppressed);
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
   * Move a feature up or down in the tree
   * @param {string} featureId - Feature ID
   * @param {number} direction - -1 for up, +1 for down
   */
  _moveFeature(featureId, direction) {
    if (!this.document.getFeaturePosition) return;

    const currentPosition = this.document.getFeaturePosition(featureId);
    if (currentPosition === -1) return;

    const newPosition = currentPosition + direction;

    if (this.onFeatureReorder) {
      this.onFeatureReorder(featureId, newPosition);
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
    input.addEventListener('keydown', e => {
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
  if (document.getElementById('feature-tree-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'feature-tree-styles';
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
        
        .tree-node.suppressed {
            opacity: 0.5;
            color: var(--text-muted, #888);
            font-style: italic;
        }
        
        .tree-node.inherited-suppressed {
            opacity: 0.6;
            color: var(--text-muted, #999);
        }
        
        .tree-suppression {
            margin-left: 4px;
            font-size: 10px;
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
        
        .context-item.disabled {
            color: var(--text-muted, #666);
            cursor: not-allowed;
            pointer-events: none;
        }
        
        .context-divider {
            height: 1px;
            background: var(--border, #333);
            margin: 4px 0;
        }
        
        /* Drag and Drop Styles */
        .tree-node.dragging {
            opacity: 0.5;
            background: var(--bg-selected, rgba(74, 144, 217, 0.1));
        }
        
        .tree-node.drop-before {
            border-top: 2px solid var(--accent-primary, #e8b13f);
            margin-top: -2px;
        }
        
        .tree-node.drop-after {
            border-bottom: 2px solid var(--accent-primary, #e8b13f);
            margin-bottom: -2px;
        }
        
        .tree-node.drop-invalid {
            background: var(--bg-error, rgba(255, 107, 107, 0.1));
            cursor: not-allowed;
        }
        
        .tree-node[draggable="true"] {
            cursor: grab;
        }
        
        .tree-node[draggable="true"]:active {
            cursor: grabbing;
        }
    `;
  document.head.appendChild(style);
}
