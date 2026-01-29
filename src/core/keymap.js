/**
 * Ameri-CAD Keymap Manager
 *
 * Customizable keyboard shortcuts like Blender's keymap editor.
 * - Default shortcuts for all common operations
 * - User customization with localStorage persistence
 * - Conflict detection
 * - Import/export keymaps
 */

/**
 * Default keymap configuration
 */
export const defaultKeymap = {
  // File operations
  'ctrl+s': 'save',
  'ctrl+o': 'open',
  'ctrl+n': 'new',
  'ctrl+shift+s': 'saveAs',

  // Edit operations
  'ctrl+z': 'undo',
  'ctrl+shift+z': 'redo',
  'ctrl+y': 'redo', // Alternative
  delete: 'delete',
  'ctrl+c': 'copy',
  'ctrl+v': 'paste',
  'ctrl+x': 'cut',
  'ctrl+a': 'selectAll',
  escape: 'cancel',

  // Transform (Blender-style)
  g: 'grab',
  r: 'rotate',
  s: 'scale',

  // Tools
  b: 'box',
  c: 'sketch',
  m: 'measure',
  e: 'extrude',

  // View presets (numpad style)
  1: 'viewFront',
  3: 'viewRight',
  7: 'viewTop',
  5: 'toggleOrtho',
  0: 'viewCamera',
  '.': 'focusSelected',

  // Numpad alternatives with ctrl
  'ctrl+1': 'viewFront',
  'ctrl+3': 'viewRight',
  'ctrl+7': 'viewTop',
  'ctrl+5': 'toggleOrtho',

  // Zoom controls
  '+': 'zoomIn',
  '-': 'zoomOut',
  '=': 'zoomIn', // Alternative (no shift needed)
  h: 'home', // Fit all
};

/**
 * Action metadata - descriptions and categories
 */
export const actionMetadata = {
  // File
  save: { description: 'Save document', category: 'file' },
  open: { description: 'Open document', category: 'file' },
  new: { description: 'New document', category: 'file' },
  saveAs: { description: 'Save document as...', category: 'file' },

  // Edit
  undo: { description: 'Undo last action', category: 'edit' },
  redo: { description: 'Redo last undone action', category: 'edit' },
  delete: { description: 'Delete selected', category: 'edit' },
  copy: { description: 'Copy selection', category: 'edit' },
  paste: { description: 'Paste from clipboard', category: 'edit' },
  cut: { description: 'Cut selection', category: 'edit' },
  selectAll: { description: 'Select all', category: 'edit' },
  cancel: { description: 'Cancel current operation', category: 'edit' },

  // Transform
  grab: { description: 'Move/grab selected', category: 'transform' },
  rotate: { description: 'Rotate selected', category: 'transform' },
  scale: { description: 'Scale selected', category: 'transform' },

  // Tools
  box: { description: 'Create box primitive', category: 'tools' },
  sketch: { description: 'Enter sketch mode', category: 'tools' },
  measure: { description: 'Measure tool', category: 'tools' },
  extrude: { description: 'Extrude selected face', category: 'tools' },

  // View
  viewFront: { description: 'Front view', category: 'view' },
  viewRight: { description: 'Right view', category: 'view' },
  viewTop: { description: 'Top view', category: 'view' },
  toggleOrtho: { description: 'Toggle orthographic/perspective', category: 'view' },
  viewCamera: { description: 'Camera view', category: 'view' },
  focusSelected: { description: 'Focus on selected', category: 'view' },
  zoomIn: { description: 'Zoom in', category: 'view' },
  zoomOut: { description: 'Zoom out', category: 'view' },
  home: { description: 'Fit all in view', category: 'view' },
};

const STORAGE_KEY = 'ameri-cad-keymap';

/**
 * KeymapManager - Handles all keyboard shortcut configuration
 */
export class KeymapManager {
  constructor() {
    this.keymap = { ...defaultKeymap };
    this.reverseMap = new Map(); // action -> shortcut(s)
    this.listeners = [];
    this.loadUserKeymap();
    this._buildReverseMap();
  }

  /**
   * Build reverse lookup map (action -> shortcuts)
   */
  _buildReverseMap() {
    this.reverseMap.clear();
    for (const [shortcut, action] of Object.entries(this.keymap)) {
      if (!this.reverseMap.has(action)) {
        this.reverseMap.set(action, []);
      }
      this.reverseMap.get(action).push(shortcut);
    }
  }

  /**
   * Bind a shortcut to an action
   * @param {string} shortcut - Key combination (e.g., 'ctrl+shift+s')
   * @param {string} action - Action name (e.g., 'saveAs')
   * @returns {Object|null} Conflict info if there was one, null otherwise
   */
  bind(shortcut, action) {
    const normalized = this.normalizeShortcut(shortcut);
    const existingAction = this.keymap[normalized];
    let conflict = null;

    if (existingAction && existingAction !== action) {
      conflict = { shortcut: normalized, previousAction: existingAction };
    }

    this.keymap[normalized] = action;
    this._buildReverseMap();
    this.save();
    this._notifyListeners('bind', { shortcut: normalized, action, conflict });

    return conflict;
  }

  /**
   * Unbind a shortcut
   * @param {string} shortcut - Key combination to unbind
   * @returns {string|null} The action that was unbound, or null
   */
  unbind(shortcut) {
    const normalized = this.normalizeShortcut(shortcut);
    const action = this.keymap[normalized];

    if (action) {
      delete this.keymap[normalized];
      this._buildReverseMap();
      this.save();
      this._notifyListeners('unbind', { shortcut: normalized, action });
    }

    return action || null;
  }

  /**
   * Get the action for a keyboard event
   * @param {KeyboardEvent} event - The keyboard event
   * @returns {string|null} The action name or null
   */
  getAction(event) {
    const key = this.eventToKey(event);
    return this.keymap[key] || null;
  }

  /**
   * Get the action for a shortcut string
   * @param {string} shortcut - Key combination
   * @returns {string|null} The action name or null
   */
  getActionForShortcut(shortcut) {
    return this.keymap[this.normalizeShortcut(shortcut)] || null;
  }

  /**
   * Get all shortcuts for an action
   * @param {string} action - Action name
   * @returns {string[]} Array of shortcuts
   */
  getShortcutsForAction(action) {
    return this.reverseMap.get(action) || [];
  }

  /**
   * Convert a KeyboardEvent to a shortcut string
   * @param {KeyboardEvent} e - The keyboard event
   * @returns {string} Normalized shortcut string
   */
  eventToKey(e) {
    const parts = [];

    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');

    // Get the key, handling special cases
    let key = e.key.toLowerCase();

    // Normalize some key names
    const keyMap = {
      ' ': 'space',
      arrowup: 'up',
      arrowdown: 'down',
      arrowleft: 'left',
      arrowright: 'right',
      control: '', // Ignore modifier keys themselves
      shift: '',
      alt: '',
      meta: '',
    };

    if (keyMap[key] !== undefined) {
      key = keyMap[key];
    }

    if (key) {
      parts.push(key);
    }

    return parts.join('+');
  }

  /**
   * Normalize a shortcut string for consistent storage
   * @param {string} shortcut - Raw shortcut string
   * @returns {string} Normalized shortcut
   */
  normalizeShortcut(shortcut) {
    const parts = shortcut.toLowerCase().split('+');
    const modifiers = [];
    let key = '';

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed === 'ctrl' || trimmed === 'cmd' || trimmed === 'meta') {
        modifiers.push('ctrl');
      } else if (trimmed === 'shift') {
        modifiers.push('shift');
      } else if (trimmed === 'alt' || trimmed === 'option') {
        modifiers.push('alt');
      } else if (trimmed) {
        key = trimmed;
      }
    }

    // Sort modifiers for consistency: ctrl+shift+alt
    const order = ['ctrl', 'shift', 'alt'];
    modifiers.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    if (key) {
      modifiers.push(key);
    }

    return modifiers.join('+');
  }

  /**
   * Format a shortcut for display
   * @param {string} shortcut - Normalized shortcut
   * @returns {string} Human-readable shortcut
   */
  formatShortcut(shortcut) {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

    return shortcut
      .split('+')
      .map(part => {
        if (part === 'ctrl') return isMac ? '⌘' : 'Ctrl';
        if (part === 'shift') return isMac ? '⇧' : 'Shift';
        if (part === 'alt') return isMac ? '⌥' : 'Alt';
        if (part === 'delete') return 'Del';
        if (part === 'escape') return 'Esc';
        if (part === 'space') return 'Space';
        return part.toUpperCase();
      })
      .join(isMac ? '' : '+');
  }

  /**
   * Check if a shortcut would conflict with an existing binding
   * @param {string} shortcut - Shortcut to check
   * @param {string} forAction - Action we're trying to bind to (optional)
   * @returns {Object|null} Conflict info or null
   */
  checkConflict(shortcut, forAction = null) {
    const normalized = this.normalizeShortcut(shortcut);
    const existing = this.keymap[normalized];

    if (existing && existing !== forAction) {
      return {
        shortcut: normalized,
        action: existing,
        metadata: actionMetadata[existing] || {},
      };
    }

    return null;
  }

  /**
   * Save keymap to localStorage
   */
  save() {
    try {
      // Only save differences from default
      const customizations = {};
      for (const [shortcut, action] of Object.entries(this.keymap)) {
        if (defaultKeymap[shortcut] !== action) {
          customizations[shortcut] = action;
        }
      }
      // Also track removed default bindings
      for (const shortcut of Object.keys(defaultKeymap)) {
        if (!(shortcut in this.keymap)) {
          customizations[shortcut] = null; // Mark as removed
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customizations));
    } catch {
      // localStorage not available
    }
  }

  /**
   * Load user customizations from localStorage
   */
  loadUserKeymap() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const customizations = JSON.parse(saved);
        for (const [shortcut, action] of Object.entries(customizations)) {
          if (action === null) {
            delete this.keymap[shortcut];
          } else {
            this.keymap[shortcut] = action;
          }
        }
      }
    } catch {
      // localStorage not available or invalid data
    }
  }

  /**
   * Reset to default keymap
   */
  reset() {
    this.keymap = { ...defaultKeymap };
    this._buildReverseMap();
    this.save();
    this._notifyListeners('reset', {});
  }

  /**
   * Get all bindings grouped by category
   * @returns {Object} Bindings by category
   */
  getBindingsByCategory() {
    const categories = {};

    // Get all known actions from metadata
    for (const [action, meta] of Object.entries(actionMetadata)) {
      const category = meta.category || 'other';
      if (!categories[category]) {
        categories[category] = [];
      }

      const shortcuts = this.getShortcutsForAction(action);
      categories[category].push({
        action,
        shortcuts,
        description: meta.description,
        isDefault: shortcuts.some(s => defaultKeymap[s] === action),
      });
    }

    // Sort actions within categories
    for (const category of Object.keys(categories)) {
      categories[category].sort((a, b) => a.action.localeCompare(b.action));
    }

    return categories;
  }

  /**
   * Export keymap as JSON
   * @returns {string} JSON string
   */
  exportKeymap() {
    return JSON.stringify(
      {
        version: 1,
        keymap: this.keymap,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Import keymap from JSON
   * @param {string} json - JSON string
   * @returns {Object} Result with success and any errors
   */
  importKeymap(json) {
    try {
      const data = JSON.parse(json);

      if (!data.keymap || typeof data.keymap !== 'object') {
        return { success: false, error: 'Invalid keymap format' };
      }

      // Validate all entries
      const errors = [];
      for (const [shortcut, action] of Object.entries(data.keymap)) {
        if (typeof action !== 'string') {
          errors.push(`Invalid action for ${shortcut}`);
        }
      }

      if (errors.length > 0) {
        return { success: false, error: errors.join(', ') };
      }

      // Apply the keymap
      this.keymap = { ...data.keymap };
      this._buildReverseMap();
      this.save();
      this._notifyListeners('import', { keymap: this.keymap });

      return { success: true, count: Object.keys(this.keymap).length };
    } catch (e) {
      return { success: false, error: `Parse error: ${e.message}` };
    }
  }

  /**
   * Subscribe to keymap changes
   * @param {Function} callback - Called with (event, data)
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /**
   * Notify listeners of changes
   */
  _notifyListeners(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (e) {
        console.error('[KeymapManager] Listener error:', e);
      }
    }
  }
}

// Export singleton instance
export const keymapManager = new KeymapManager();

export default keymapManager;
