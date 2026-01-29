/**
 * Ameri-CAD Shortcuts Panel UI
 *
 * Visual editor for keyboard shortcuts (like Blender's keymap editor).
 * - List all shortcuts by category
 * - Click to edit (capture new key combo)
 * - Reset to defaults
 * - Search/filter
 * - Export/import keymaps
 */

import {
  keymapManager,
  // actionMetadata - reserved for future category metadata display
  defaultKeymap,
} from '../core/keymap.js';

/**
 * ShortcutsPanel - Modal UI for editing shortcuts
 */
export class ShortcutsPanel {
  constructor(options = {}) {
    this.onClose = options.onClose || (() => {});

    this.element = null;
    this.searchInput = null;
    this.contentArea = null;
    this.editingAction = null;
    this.editingElement = null;

    this._boundKeyHandler = this._handleKeyCapture.bind(this);
    this._unsubscribe = null;
  }

  /**
   * Show the shortcuts panel
   */
  show() {
    if (this.element) {
      this.element.remove();
    }

    this._createElement();
    this._addStyles();
    this._attachEventListeners();
    this._render();

    // Subscribe to keymap changes
    this._unsubscribe = keymapManager.subscribe(() => this._render());

    document.body.appendChild(this.element);
  }

  /**
   * Hide and destroy the panel
   */
  hide() {
    this._stopEditing();

    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }

    if (this.element) {
      this.element.remove();
      this.element = null;
    }

    this.onClose();
  }

  /**
   * Create the panel DOM structure
   */
  _createElement() {
    this.element = document.createElement('div');
    this.element.className = 'shortcuts-panel-overlay';
    this.element.innerHTML = `
      <div class="shortcuts-panel">
        <div class="shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button class="shortcuts-close" title="Close">&times;</button>
        </div>
        
        <div class="shortcuts-toolbar">
          <input type="text" class="shortcuts-search" placeholder="Search shortcuts...">
          <div class="shortcuts-actions">
            <button class="shortcuts-btn" data-action="reset" title="Reset to defaults">
              Reset
            </button>
            <button class="shortcuts-btn" data-action="export" title="Export keymap">
              Export
            </button>
            <button class="shortcuts-btn" data-action="import" title="Import keymap">
              Import
            </button>
          </div>
        </div>
        
        <div class="shortcuts-content"></div>
        
        <div class="shortcuts-footer">
          <span class="shortcuts-hint">Click on a shortcut to edit. Press Escape to cancel.</span>
        </div>
      </div>
    `;

    this.searchInput = this.element.querySelector('.shortcuts-search');
    this.contentArea = this.element.querySelector('.shortcuts-content');
  }

  /**
   * Add CSS styles
   */
  _addStyles() {
    if (document.getElementById('shortcuts-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'shortcuts-panel-styles';
    style.textContent = `
      .shortcuts-panel-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: 'JetBrains Mono', 'Fira Code', -apple-system, sans-serif;
      }
      
      .shortcuts-panel {
        background: #1a1a2e;
        border: 1px solid #0f3460;
        border-radius: 8px;
        width: 90%;
        max-width: 700px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
      }
      
      .shortcuts-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #0f3460;
      }
      
      .shortcuts-header h2 {
        margin: 0;
        font-size: 18px;
        color: #4ecca3;
        font-weight: 600;
      }
      
      .shortcuts-close {
        background: none;
        border: none;
        color: #888;
        font-size: 24px;
        cursor: pointer;
        padding: 0 8px;
        line-height: 1;
      }
      
      .shortcuts-close:hover {
        color: #e94560;
      }
      
      .shortcuts-toolbar {
        display: flex;
        gap: 12px;
        padding: 12px 20px;
        border-bottom: 1px solid #0f3460;
      }
      
      .shortcuts-search {
        flex: 1;
        background: #16213e;
        border: 1px solid #0f3460;
        border-radius: 4px;
        padding: 8px 12px;
        color: #fff;
        font-family: inherit;
        font-size: 13px;
      }
      
      .shortcuts-search::placeholder {
        color: #555;
      }
      
      .shortcuts-search:focus {
        outline: none;
        border-color: #4ecca3;
      }
      
      .shortcuts-actions {
        display: flex;
        gap: 8px;
      }
      
      .shortcuts-btn {
        background: #16213e;
        border: 1px solid #0f3460;
        border-radius: 4px;
        padding: 8px 16px;
        color: #ccc;
        font-family: inherit;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .shortcuts-btn:hover {
        background: #0f3460;
        color: #fff;
      }
      
      .shortcuts-btn.danger:hover {
        background: #e94560;
        border-color: #e94560;
      }
      
      .shortcuts-content {
        flex: 1;
        overflow-y: auto;
        padding: 0;
      }
      
      .shortcuts-category {
        border-bottom: 1px solid #0f3460;
      }
      
      .shortcuts-category:last-child {
        border-bottom: none;
      }
      
      .shortcuts-category-header {
        background: #16213e;
        padding: 10px 20px;
        font-size: 12px;
        font-weight: 600;
        color: #4ecca3;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        position: sticky;
        top: 0;
      }
      
      .shortcuts-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      
      .shortcuts-item {
        display: flex;
        align-items: center;
        padding: 10px 20px;
        border-bottom: 1px solid #0f3460;
      }
      
      .shortcuts-item:last-child {
        border-bottom: none;
      }
      
      .shortcuts-item:hover {
        background: rgba(78, 204, 163, 0.05);
      }
      
      .shortcuts-action-name {
        flex: 1;
        color: #ccc;
        font-size: 13px;
      }
      
      .shortcuts-action-desc {
        color: #666;
        font-size: 11px;
        margin-left: 8px;
      }
      
      .shortcuts-keys {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      
      .shortcut-key {
        background: #0f3460;
        border: 1px solid #1a3a5c;
        border-radius: 4px;
        padding: 4px 10px;
        color: #fff;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 60px;
        text-align: center;
      }
      
      .shortcut-key:hover {
        background: #1a4a7c;
        border-color: #4ecca3;
      }
      
      .shortcut-key.editing {
        background: #4ecca3;
        color: #1a1a2e;
        animation: pulse 1s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      
      .shortcut-key.unbound {
        background: transparent;
        border-style: dashed;
        color: #555;
      }
      
      .shortcut-add {
        background: transparent;
        border: 1px dashed #0f3460;
        border-radius: 4px;
        padding: 4px 8px;
        color: #555;
        font-size: 16px;
        cursor: pointer;
        line-height: 1;
      }
      
      .shortcut-add:hover {
        border-color: #4ecca3;
        color: #4ecca3;
      }
      
      .shortcut-remove {
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        padding: 2px 6px;
        font-size: 14px;
        margin-left: 4px;
      }
      
      .shortcut-remove:hover {
        color: #e94560;
      }
      
      .shortcuts-footer {
        padding: 12px 20px;
        border-top: 1px solid #0f3460;
        background: #16213e;
      }
      
      .shortcuts-hint {
        font-size: 11px;
        color: #666;
      }
      
      .shortcuts-no-results {
        padding: 40px;
        text-align: center;
        color: #555;
      }
      
      .shortcuts-modified {
        color: #f0a500 !important;
      }
      
      .shortcuts-modified::after {
        content: ' *';
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Attach event listeners
   */
  _attachEventListeners() {
    // Close button
    this.element.querySelector('.shortcuts-close').addEventListener('click', () => {
      this.hide();
    });

    // Click outside to close
    this.element.addEventListener('click', e => {
      if (e.target === this.element) {
        this.hide();
      }
    });

    // Search
    this.searchInput.addEventListener('input', () => {
      this._render();
    });

    // Action buttons
    this.element.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._handleAction(btn.dataset.action);
      });
    });

    // Escape to close
    this._escHandler = e => {
      if (e.key === 'Escape') {
        if (this.editingAction) {
          this._stopEditing();
        } else {
          this.hide();
        }
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', this._escHandler, true);
  }

  /**
   * Render the shortcuts list
   */
  _render() {
    const searchTerm = this.searchInput?.value.toLowerCase() || '';
    const bindings = keymapManager.getBindingsByCategory();

    let html = '';
    const categoryOrder = ['file', 'edit', 'transform', 'tools', 'view'];

    for (const category of categoryOrder) {
      const items = bindings[category] || [];

      // Filter by search
      const filteredItems = items.filter(item => {
        if (!searchTerm) return true;
        return (
          item.action.toLowerCase().includes(searchTerm) ||
          item.description.toLowerCase().includes(searchTerm) ||
          item.shortcuts.some(s => s.toLowerCase().includes(searchTerm))
        );
      });

      if (filteredItems.length === 0) continue;

      html += `
        <div class="shortcuts-category">
          <div class="shortcuts-category-header">${category}</div>
          <ul class="shortcuts-list">
      `;

      for (const item of filteredItems) {
        const isModified = this._isModified(item.action, item.shortcuts);

        html += `
          <li class="shortcuts-item">
            <span class="shortcuts-action-name ${isModified ? 'shortcuts-modified' : ''}">
              ${item.action}
              <span class="shortcuts-action-desc">${item.description}</span>
            </span>
            <div class="shortcuts-keys">
        `;

        if (item.shortcuts.length === 0) {
          html += `
            <span class="shortcut-key unbound" data-action="${item.action}" data-shortcut="">
              Unbound
            </span>
          `;
        } else {
          for (const shortcut of item.shortcuts) {
            html += `
              <span class="shortcut-key" data-action="${item.action}" data-shortcut="${shortcut}">
                ${keymapManager.formatShortcut(shortcut)}
              </span>
              <button class="shortcut-remove" data-shortcut="${shortcut}" title="Remove">&times;</button>
            `;
          }
        }

        html += `
              <button class="shortcut-add" data-action="${item.action}" title="Add shortcut">+</button>
            </div>
          </li>
        `;
      }

      html += `
          </ul>
        </div>
      `;
    }

    if (!html) {
      html = '<div class="shortcuts-no-results">No shortcuts match your search.</div>';
    }

    this.contentArea.innerHTML = html;

    // Attach click handlers for editing
    this.contentArea.querySelectorAll('.shortcut-key').forEach(el => {
      el.addEventListener('click', () => {
        this._startEditing(el.dataset.action, el);
      });
    });

    this.contentArea.querySelectorAll('.shortcut-add').forEach(el => {
      el.addEventListener('click', () => {
        this._startEditing(el.dataset.action, el);
      });
    });

    this.contentArea.querySelectorAll('.shortcut-remove').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        keymapManager.unbind(el.dataset.shortcut);
      });
    });
  }

  /**
   * Check if an action's bindings differ from defaults
   */
  _isModified(action, currentShortcuts) {
    // Get default shortcuts for this action
    const defaultShortcuts = Object.entries(defaultKeymap)
      .filter(([, a]) => a === action)
      .map(([s]) => s);

    // Compare
    if (defaultShortcuts.length !== currentShortcuts.length) return true;

    const sorted1 = [...defaultShortcuts].sort();
    const sorted2 = [...currentShortcuts].sort();

    return !sorted1.every((s, i) => s === sorted2[i]);
  }

  /**
   * Start editing a shortcut
   */
  _startEditing(action, element) {
    this._stopEditing();

    this.editingAction = action;
    this.editingElement = element;

    element.classList.add('editing');
    element.textContent = 'Press keys...';

    // Capture keyboard
    document.addEventListener('keydown', this._boundKeyHandler, true);
  }

  /**
   * Stop editing
   */
  _stopEditing() {
    if (this.editingElement) {
      this.editingElement.classList.remove('editing');
    }

    this.editingAction = null;
    this.editingElement = null;

    document.removeEventListener('keydown', this._boundKeyHandler, true);
    this._render();
  }

  /**
   * Handle key capture during editing
   */
  _handleKeyCapture(e) {
    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier-only presses
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      return;
    }

    // Escape cancels
    if (e.key === 'Escape') {
      this._stopEditing();
      return;
    }

    const shortcut = keymapManager.eventToKey(e);
    if (!shortcut) return;

    // Check for conflicts
    const conflict = keymapManager.checkConflict(shortcut, this.editingAction);
    if (conflict) {
      const confirmOverwrite = confirm(
        `"${keymapManager.formatShortcut(shortcut)}" is already bound to "${conflict.action}".\n\nDo you want to reassign it?`
      );
      if (!confirmOverwrite) {
        this._stopEditing();
        return;
      }
    }

    // Unbind old shortcut if editing existing
    const oldShortcut = this.editingElement?.dataset.shortcut;
    if (oldShortcut) {
      keymapManager.unbind(oldShortcut);
    }

    // Bind the new shortcut
    keymapManager.bind(shortcut, this.editingAction);
    this._stopEditing();
  }

  /**
   * Handle toolbar actions
   */
  _handleAction(action) {
    switch (action) {
      case 'reset':
        if (confirm('Reset all shortcuts to defaults?\n\nThis cannot be undone.')) {
          keymapManager.reset();
        }
        break;

      case 'export':
        this._exportKeymap();
        break;

      case 'import':
        this._importKeymap();
        break;
    }
  }

  /**
   * Export keymap to file
   */
  _exportKeymap() {
    const json = keymapManager.exportKeymap();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'ameri-cad-keymap.json';
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Import keymap from file
   */
  _importKeymap() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = keymapManager.importKeymap(text);

        if (result.success) {
          alert(`Imported ${result.count} shortcuts successfully.`);
        } else {
          alert(`Import failed: ${result.error}`);
        }
      } catch (e) {
        alert(`Import failed: ${e.message}`);
      }
    };

    input.click();
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    this.hide();
    document.removeEventListener('keydown', this._escHandler, true);
  }
}

/**
 * Create and show a shortcuts panel
 * @returns {ShortcutsPanel} The panel instance
 */
export function showShortcutsPanel(options = {}) {
  const panel = new ShortcutsPanel(options);
  panel.show();
  return panel;
}

export default ShortcutsPanel;
