/**
 * Ameri-CAD Recent Files Manager
 * Tracks and persists recently opened/saved files
 */

const STORAGE_KEY = 'ameri-cad-recent';
const DEFAULT_MAX_FILES = 10;

/**
 * Recent Files Manager
 * Manages a list of recently accessed files with localStorage persistence
 */
export class RecentFilesManager {
  /**
   * Create a recent files manager
   * @param {number} maxFiles - Maximum number of files to track (default: 10)
   */
  constructor(maxFiles = DEFAULT_MAX_FILES) {
    this.maxFiles = maxFiles;
    this.files = this.load();

    // Event callbacks
    this.onUpdate = null;
  }

  /**
   * Add a file to the recent files list
   * Moves existing file to front if already present
   * @param {string} filePath - File path or identifier
   * @param {string} name - Display name of the file
   * @param {Object} metadata - Optional additional metadata
   */
  add(filePath, name, metadata = {}) {
    if (!filePath || !name) {
      console.warn('[RecentFiles] Cannot add file without path and name');
      return;
    }

    // Remove if already exists (will be re-added at front)
    this.files = this.files.filter(f => f.path !== filePath);

    // Add to front
    this.files.unshift({
      path: filePath,
      name: name,
      timestamp: Date.now(),
      ...metadata,
    });

    // Trim to max
    this.files = this.files.slice(0, this.maxFiles);

    // Persist and notify
    this.save();
    this._notifyUpdate();

    console.log(`[RecentFiles] Added: ${name}`);
  }

  /**
   * Get the list of recent files
   * @returns {Array} Array of recent file objects
   */
  getRecent() {
    return [...this.files];
  }

  /**
   * Get a specific recent file by path
   * @param {string} filePath - File path to find
   * @returns {Object|null} File object or null if not found
   */
  get(filePath) {
    return this.files.find(f => f.path === filePath) || null;
  }

  /**
   * Remove a specific file from the list
   * @param {string} filePath - File path to remove
   */
  remove(filePath) {
    const initialLength = this.files.length;
    this.files = this.files.filter(f => f.path !== filePath);

    if (this.files.length !== initialLength) {
      this.save();
      this._notifyUpdate();
      console.log(`[RecentFiles] Removed: ${filePath}`);
    }
  }

  /**
   * Clear all recent files
   */
  clear() {
    this.files = [];
    this.save();
    this._notifyUpdate();
    console.log('[RecentFiles] Cleared all recent files');
  }

  /**
   * Check if the list is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.files.length === 0;
  }

  /**
   * Get the count of recent files
   * @returns {number}
   */
  count() {
    return this.files.length;
  }

  /**
   * Save the recent files list to localStorage
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.files));
    } catch (error) {
      console.warn('[RecentFiles] Failed to save to localStorage:', error);
    }
  }

  /**
   * Load the recent files list from localStorage
   * @returns {Array} Loaded files or empty array
   */
  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate structure
        if (Array.isArray(parsed)) {
          return parsed
            .filter(f => f && typeof f.path === 'string' && typeof f.name === 'string')
            .slice(0, this.maxFiles);
        }
      }
    } catch (error) {
      console.warn('[RecentFiles] Failed to load from localStorage:', error);
    }
    return [];
  }

  /**
   * Notify listeners of an update
   * @private
   */
  _notifyUpdate() {
    if (this.onUpdate && typeof this.onUpdate === 'function') {
      this.onUpdate(this.files);
    }
  }
}

/**
 * Format a timestamp as a relative time string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted relative time
 */
export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    // More than a week, show date
    return new Date(timestamp).toLocaleDateString();
  } else if (days > 0) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  } else if (hours > 0) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  } else if (minutes > 0) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  } else {
    return 'Just now';
  }
}

// Singleton instance for app-wide use
let _instance = null;

/**
 * Get the singleton RecentFilesManager instance
 * @param {number} maxFiles - Maximum files (only used on first call)
 * @returns {RecentFilesManager}
 */
export function getRecentFilesManager(maxFiles = DEFAULT_MAX_FILES) {
  if (!_instance) {
    _instance = new RecentFilesManager(maxFiles);
  }
  return _instance;
}
