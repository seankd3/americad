/**
 * Ameri-CAD Welcome Screen
 * Startup screen with recent files and quick actions
 */

import { formatRelativeTime } from '../core/recent-files.js';

/**
 * Welcome Screen Component
 * Displays on app startup when no document is loaded
 */
export class WelcomeScreen {
  /**
   * Create a welcome screen
   * @param {Object} options - Configuration options
   * @param {HTMLElement|string} options.container - Container element or selector
   * @param {RecentFilesManager} options.recentFiles - Recent files manager instance
   * @param {Object} options.callbacks - Action callbacks
   * @param {Function} options.callbacks.onNewDocument - Called when user clicks new document
   * @param {Function} options.callbacks.onOpenFile - Called when user clicks open file
   * @param {Function} options.callbacks.onOpenRecent - Called with file path when user clicks a recent file
   */
  constructor(options = {}) {
    this.container =
      typeof options.container === 'string'
        ? document.querySelector(options.container)
        : options.container;

    this.recentFiles = options.recentFiles;
    this.callbacks = options.callbacks || {};

    this.element = null;
    this._visible = false;

    // Create the welcome screen element
    this._create();

    // Subscribe to recent files updates
    if (this.recentFiles) {
      this.recentFiles.onUpdate = () => this._updateRecentFilesList();
    }
  }

  /**
   * Create the welcome screen DOM elements
   * @private
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'welcome-screen-overlay';
    this.element.innerHTML = this._renderContent();

    // Bind event handlers
    this._bindEvents();

    // Append to container or body
    if (this.container) {
      this.container.appendChild(this.element);
    } else {
      document.body.appendChild(this.element);
    }
  }

  /**
   * Render the welcome screen content
   * @private
   * @returns {string} HTML content
   */
  _renderContent() {
    const files = this.recentFiles ? this.recentFiles.getRecent() : [];

    return `
      <div class="welcome-screen">
        <div class="welcome-header">
          <div class="welcome-logo">
            <span class="welcome-logo-icon">◆</span>
            <span class="welcome-logo-text">Ameri-CAD</span>
          </div>
          <p class="welcome-tagline">PRECISION CAD WITH BLENDER'S SOUL</p>
        </div>
        
        <div class="welcome-body">
          <div class="welcome-actions">
            <h2 class="welcome-section-title">START</h2>
            <button class="welcome-btn welcome-btn-primary" data-action="new">
              <span class="welcome-btn-icon">+</span>
              <span class="welcome-btn-text">NEW DOCUMENT</span>
              <span class="welcome-btn-shortcut">CTRL+N</span>
            </button>
            <button class="welcome-btn" data-action="open">
              <span class="welcome-btn-icon">📂</span>
              <span class="welcome-btn-text">OPEN FILE</span>
              <span class="welcome-btn-shortcut">CTRL+O</span>
            </button>
          </div>
          
          <div class="welcome-recent">
            <h2 class="welcome-section-title">
              RECENT FILES
              ${files.length > 0 ? `<span class="welcome-recent-count">${files.length}</span>` : ''}
            </h2>
            <div class="welcome-recent-list" id="welcome-recent-list">
              ${this._renderRecentFiles(files)}
            </div>
          </div>
        </div>
        
        <div class="welcome-footer">
          <div class="welcome-tips">
            <h3 class="welcome-tips-title">QUICK TIPS</h3>
            <ul class="welcome-tips-list">
              <li><kbd>B</kbd> Create Box primitive</li>
              <li><kbd>C</kbd> Enter Sketch mode</li>
              <li><kbd>G</kbd> / <kbd>R</kbd> / <kbd>S</kbd> Grab / Rotate / Scale</li>
              <li><kbd>M</kbd> Measure tool</li>
              <li><kbd>?</kbd> Command help</li>
            </ul>
          </div>
          <div class="welcome-version">
            <span>VER 2.0.1-LA // UNRESTRICTED</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render the recent files list
   * @private
   * @param {Array} files - Array of recent file objects
   * @returns {string} HTML content
   */
  _renderRecentFiles(files) {
    if (!files || files.length === 0) {
      return `
        <div class="welcome-recent-empty">
          <span class="welcome-recent-empty-icon">📄</span>
          <span class="welcome-recent-empty-text">No recent files</span>
        </div>
      `;
    }

    return files
      .map(
        file => `
        <div class="welcome-recent-item" data-action="open-recent" data-path="${this._escapeHtml(file.path)}">
          <span class="welcome-recent-icon">📐</span>
          <div class="welcome-recent-info">
            <span class="welcome-recent-name">${this._escapeHtml(file.name)}</span>
            <span class="welcome-recent-date">${formatRelativeTime(file.timestamp)}</span>
          </div>
          <button class="welcome-recent-remove" data-action="remove-recent" data-path="${this._escapeHtml(file.path)}" title="Remove from list">×</button>
        </div>
      `
      )
      .join('');
  }

  /**
   * Update the recent files list
   * @private
   */
  _updateRecentFilesList() {
    const listEl = this.element.querySelector('#welcome-recent-list');
    const countEl = this.element.querySelector('.welcome-recent-count');
    const files = this.recentFiles ? this.recentFiles.getRecent() : [];

    if (listEl) {
      listEl.innerHTML = this._renderRecentFiles(files);
    }

    // Update count badge
    const titleEl = this.element.querySelector('.welcome-recent .welcome-section-title');
    if (titleEl) {
      if (countEl) {
        countEl.textContent = files.length > 0 ? files.length : '';
        countEl.style.display = files.length > 0 ? '' : 'none';
      } else if (files.length > 0) {
        titleEl.innerHTML = `RECENT FILES <span class="welcome-recent-count">${files.length}</span>`;
      }
    }
  }

  /**
   * Bind event handlers
   * @private
   */
  _bindEvents() {
    this.element.addEventListener('click', e => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const path = target.dataset.path;

      e.preventDefault();
      e.stopPropagation();

      switch (action) {
        case 'new':
          if (this.callbacks.onNewDocument) {
            this.callbacks.onNewDocument();
          }
          break;

        case 'open':
          if (this.callbacks.onOpenFile) {
            this.callbacks.onOpenFile();
          }
          break;

        case 'open-recent':
          if (path && this.callbacks.onOpenRecent) {
            this.callbacks.onOpenRecent(path);
          }
          break;

        case 'remove-recent':
          if (path && this.recentFiles) {
            this.recentFiles.remove(path);
          }
          break;
      }
    });

    // Handle keyboard shortcuts when welcome screen is visible
    this._keyHandler = e => {
      if (!this._visible) return;

      // Don't handle if user is typing in an input
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        return;
      }

      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (this.callbacks.onNewDocument) {
          this.callbacks.onNewDocument();
        }
      } else if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        if (this.callbacks.onOpenFile) {
          this.callbacks.onOpenFile();
        }
      }
    };

    document.addEventListener('keydown', this._keyHandler);
  }

  /**
   * Show the welcome screen
   */
  show() {
    if (!this.element) return;

    this._visible = true;
    this.element.classList.add('visible');

    // Refresh recent files
    this._updateRecentFilesList();

    console.log('[WelcomeScreen] Shown');
  }

  /**
   * Hide the welcome screen
   */
  hide() {
    if (!this.element) return;

    this._visible = false;
    this.element.classList.remove('visible');

    console.log('[WelcomeScreen] Hidden');
  }

  /**
   * Check if the welcome screen is visible
   * @returns {boolean}
   */
  isVisible() {
    return this._visible;
  }

  /**
   * Toggle the welcome screen visibility
   */
  toggle() {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Destroy the welcome screen and clean up
   */
  destroy() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }

    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this.element = null;
    this._visible = false;
  }

  /**
   * Escape HTML special characters
   * @private
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

/**
 * Add welcome screen styles to the document
 */
export function addWelcomeScreenStyles() {
  if (document.getElementById('welcome-screen-styles')) return;

  const style = document.createElement('style');
  style.id = 'welcome-screen-styles';
  style.textContent = `
    /* Welcome Screen Overlay */
    .welcome-screen-overlay {
      position: fixed;
      inset: 0;
      background: rgba(10, 10, 11, 0.95);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }
    
    .welcome-screen-overlay.visible {
      opacity: 1;
      visibility: visible;
    }
    
    /* Welcome Screen Container */
    .welcome-screen {
      width: 100%;
      max-width: 720px;
      padding: 48px;
      display: flex;
      flex-direction: column;
      gap: 40px;
    }
    
    /* Header */
    .welcome-header {
      text-align: center;
    }
    
    .welcome-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    
    .welcome-logo-icon {
      font-size: 28px;
      color: var(--accent-primary, #e8b13f);
    }
    
    .welcome-logo-text {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--text-primary, #f5f5f5);
    }
    
    .welcome-tagline {
      font-size: 11px;
      color: var(--text-tertiary, #6a6a70);
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    
    /* Body */
    .welcome-body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    
    .welcome-section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary, #a0a0a5);
      letter-spacing: 0.15em;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .welcome-recent-count {
      background: var(--bg-400, #27272b);
      color: var(--text-secondary, #a0a0a5);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
    }
    
    /* Action Buttons */
    .welcome-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .welcome-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: var(--bg-300, #1f1f22);
      border: 1px solid var(--border-subtle, #27272b);
      border-radius: 4px;
      color: var(--text-primary, #f5f5f5);
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.12s ease;
      text-align: left;
    }
    
    .welcome-btn:hover {
      background: var(--bg-400, #27272b);
      border-color: var(--border-default, #35353a);
    }
    
    .welcome-btn-primary {
      border-color: var(--accent-primary, #e8b13f);
      background: rgba(232, 177, 63, 0.1);
    }
    
    .welcome-btn-primary:hover {
      background: rgba(232, 177, 63, 0.2);
      box-shadow: 0 0 12px rgba(232, 177, 63, 0.2);
    }
    
    .welcome-btn-icon {
      font-size: 16px;
      width: 20px;
      text-align: center;
    }
    
    .welcome-btn-text {
      flex: 1;
      font-weight: 500;
      letter-spacing: 0.05em;
    }
    
    .welcome-btn-shortcut {
      font-size: 10px;
      color: var(--text-tertiary, #6a6a70);
      letter-spacing: 0.1em;
    }
    
    /* Recent Files */
    .welcome-recent-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 280px;
      overflow-y: auto;
    }
    
    .welcome-recent-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--bg-200, #18181a);
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.12s ease;
    }
    
    .welcome-recent-item:hover {
      background: var(--bg-300, #1f1f22);
      border-color: var(--border-subtle, #27272b);
    }
    
    .welcome-recent-icon {
      font-size: 14px;
      opacity: 0.7;
    }
    
    .welcome-recent-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .welcome-recent-name {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-primary, #f5f5f5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .welcome-recent-date {
      font-size: 10px;
      color: var(--text-tertiary, #6a6a70);
    }
    
    .welcome-recent-remove {
      opacity: 0;
      background: none;
      border: none;
      color: var(--text-tertiary, #6a6a70);
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
      transition: all 0.12s ease;
    }
    
    .welcome-recent-item:hover .welcome-recent-remove {
      opacity: 1;
    }
    
    .welcome-recent-remove:hover {
      color: var(--accent-tertiary, #ff6b47);
    }
    
    .welcome-recent-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px;
      color: var(--text-tertiary, #6a6a70);
    }
    
    .welcome-recent-empty-icon {
      font-size: 24px;
      opacity: 0.5;
    }
    
    .welcome-recent-empty-text {
      font-size: 11px;
      letter-spacing: 0.1em;
    }
    
    /* Footer */
    .welcome-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px solid var(--border-subtle, #27272b);
      padding-top: 24px;
    }
    
    .welcome-tips {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .welcome-tips-title {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-tertiary, #6a6a70);
      letter-spacing: 0.15em;
    }
    
    .welcome-tips-list {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 24px;
      font-size: 11px;
      color: var(--text-secondary, #a0a0a5);
    }
    
    .welcome-tips-list kbd {
      display: inline-block;
      padding: 2px 6px;
      background: var(--bg-300, #1f1f22);
      border: 1px solid var(--border-subtle, #27272b);
      border-radius: 3px;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--accent-primary, #e8b13f);
    }
    
    .welcome-version {
      font-size: 10px;
      color: var(--text-muted, #4a4a50);
      letter-spacing: 0.1em;
    }
    
    /* Responsive */
    @media (max-width: 640px) {
      .welcome-screen {
        padding: 24px;
        gap: 24px;
      }
      
      .welcome-body {
        grid-template-columns: 1fr;
        gap: 24px;
      }
      
      .welcome-footer {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }
    }
  `;

  document.head.appendChild(style);
}
