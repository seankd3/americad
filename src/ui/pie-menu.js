/**
 * Ameri-CAD - Radial Pie Menu System
 *
 * Blender-style pie menus for quick tool access.
 *
 * Trigger:
 *   - Hold Q or Space → Pie menu appears at cursor
 *   - Move mouse toward option → Highlight
 *   - Release → Execute selected action
 *   - Press again without movement → Toggle (tap)
 *
 * Context-aware:
 *   - Default: Box, Cylinder, Sphere, Sketch, Measure, Open, Save, Undo
 *   - With Selection: Delete, Fillet, Chamfer, Boolean, Pattern, Move, Copy, Properties
 *   - In Sketch Mode: Line, Rect, Circle, Spline, Arc, Dim, Constrain, Exit
 */

/**
 * Pie menu contexts
 */
export const PieMenuContext = {
  DEFAULT: 'default',
  SELECTION: 'selection',
  SKETCH: 'sketch',
};

/**
 * Default pie menu items by context
 */
export const DEFAULT_PIE_ITEMS = {
  [PieMenuContext.DEFAULT]: [
    { id: 'box', label: 'Box', icon: '▢', position: 0 }, // Top
    { id: 'sphere', label: 'Sphere', icon: '○', position: 1 }, // Top-right
    { id: 'measure', label: 'Measure', icon: '📏', position: 2 }, // Right
    { id: 'save', label: 'Save', icon: '💾', position: 3 }, // Bottom-right
    { id: 'undo', label: 'Undo', icon: '↩', position: 4 }, // Bottom
    { id: 'open', label: 'Open', icon: '📂', position: 5 }, // Bottom-left
    { id: 'sketch', label: 'Sketch', icon: '✏', position: 6 }, // Left
    { id: 'cylinder', label: 'Cyl', icon: '⬭', position: 7 }, // Top-left
  ],
  [PieMenuContext.SELECTION]: [
    { id: 'delete', label: 'Delete', icon: '🗑', position: 0 },
    { id: 'chamfer', label: 'Chamfer', icon: '◣', position: 1 },
    { id: 'pattern', label: 'Pattern', icon: '⊞', position: 2 },
    { id: 'copy', label: 'Copy', icon: '⧉', position: 3 },
    { id: 'properties', label: 'Props', icon: '⚙', position: 4 },
    { id: 'move', label: 'Move', icon: '✥', position: 5 },
    { id: 'boolean', label: 'Boolean', icon: '⊕', position: 6 },
    { id: 'fillet', label: 'Fillet', icon: '◠', position: 7 },
  ],
  [PieMenuContext.SKETCH]: [
    { id: 'line', label: 'Line', icon: '╱', position: 0 },
    { id: 'circle', label: 'Circle', icon: '○', position: 1 },
    { id: 'arc', label: 'Arc', icon: '◜', position: 2 },
    { id: 'constrain', label: 'Constrain', icon: '⊥', position: 3 },
    { id: 'exit', label: 'Exit', icon: '✕', position: 4 },
    { id: 'dim', label: 'Dim', icon: '↔', position: 5 },
    { id: 'spline', label: 'Spline', icon: '〰', position: 6 },
    { id: 'rect', label: 'Rect', icon: '▢', position: 7 },
  ],
};

/**
 * PieMenu class - Radial menu for quick actions
 */
export class PieMenu {
  /**
   * Create a new PieMenu
   * @param {Object} options Configuration
   * @param {HTMLElement} options.container Parent element (default: document.body)
   * @param {number} options.radius Menu radius in pixels (default: 100)
   * @param {number} options.itemRadius Individual item radius (default: 40)
   * @param {number} options.deadZone Dead zone radius for center (default: 30)
   * @param {number} options.holdDelay Milliseconds to hold before showing (default: 150)
   * @param {Function} options.onAction Callback when action is selected
   * @param {Function} options.getContext Function to determine current context
   * @param {Function} options.log Logging function
   */
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.radius = options.radius || 100;
    this.itemRadius = options.itemRadius || 40;
    this.deadZone = options.deadZone || 30;
    this.holdDelay = options.holdDelay || 150;
    this.onAction = options.onAction || (() => {});
    this.getContext = options.getContext || (() => PieMenuContext.DEFAULT);
    this.log = options.log || console.log;

    // Custom items by context (can override defaults)
    this.items = { ...DEFAULT_PIE_ITEMS, ...(options.items || {}) };

    // State
    this.state = {
      visible: false,
      context: PieMenuContext.DEFAULT,
      centerX: 0,
      centerY: 0,
      mouseX: 0,
      mouseY: 0,
      selectedIndex: -1,
      triggerKey: null,
      hasMoved: false,
    };

    // DOM elements
    this.element = null;
    this.itemElements = [];
    this.centerElement = null;
    this.backgroundElement = null;

    // Timer for hold detection
    this._holdTimer = null;
    this._holdStartPos = null;

    // Bound event handlers
    this._boundKeyDown = this._handleKeyDown.bind(this);
    this._boundKeyUp = this._handleKeyUp.bind(this);
    this._boundMouseMove = this._handleMouseMove.bind(this);
    this._boundMouseDown = this._handleMouseDown.bind(this);

    // Initialize
    this._createDOM();
    this._addStyles();
  }

  /**
   * Start listening for pie menu triggers
   */
  enable() {
    document.addEventListener('keydown', this._boundKeyDown);
    document.addEventListener('keyup', this._boundKeyUp);
    document.addEventListener('mousemove', this._boundMouseMove);
    document.addEventListener('mousedown', this._boundMouseDown);
  }

  /**
   * Stop listening for pie menu triggers
   */
  disable() {
    this.hide();
    document.removeEventListener('keydown', this._boundKeyDown);
    document.removeEventListener('keyup', this._boundKeyUp);
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('mousedown', this._boundMouseDown);
  }

  /**
   * Check if pie menu is visible
   */
  isVisible() {
    return this.state.visible;
  }

  /**
   * Get current selected item
   */
  getSelected() {
    if (this.state.selectedIndex < 0) return null;
    const items = this.items[this.state.context];
    return items?.[this.state.selectedIndex] || null;
  }

  /**
   * Show pie menu at coordinates
   * @param {number} x X coordinate (center)
   * @param {number} y Y coordinate (center)
   * @param {string} triggerKey Key that triggered the menu
   */
  show(x, y, triggerKey = null) {
    if (this.state.visible) return;

    // Get current context
    this.state.context = this.getContext();

    // Position at cursor
    this.state.centerX = x;
    this.state.centerY = y;
    this.state.mouseX = x;
    this.state.mouseY = y;
    this.state.selectedIndex = -1;
    this.state.triggerKey = triggerKey;
    this.state.hasMoved = false;

    // Render items for current context
    this._renderItems();

    // Position and show
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.element.classList.add('visible');
    this.backgroundElement.classList.add('visible');

    this.state.visible = true;

    // Trigger animation
    requestAnimationFrame(() => {
      this.element.classList.add('animate-in');
    });
  }

  /**
   * Hide pie menu and execute selected action
   * @param {boolean} execute Whether to execute the selected action
   */
  hide(execute = true) {
    if (!this.state.visible) return;

    // Get selected item before hiding
    const selected = this.getSelected();

    // Animate out
    this.element.classList.remove('animate-in');
    this.element.classList.remove('visible');
    this.backgroundElement.classList.remove('visible');

    // Execute action if we had a selection and moved
    if (execute && selected && this.state.hasMoved) {
      this.onAction(selected.id, selected, this.state.context);
      this.log(`PIE: ${selected.label.toUpperCase()}`, 'info');
    }

    // Reset state
    this.state.visible = false;
    this.state.selectedIndex = -1;
    this.state.triggerKey = null;

    // Clear hold timer
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  /**
   * Cancel pie menu without executing
   */
  cancel() {
    this.hide(false);
  }

  /**
   * Update selection based on mouse position
   * @param {number} x Mouse X
   * @param {number} y Mouse Y
   */
  updateSelection(x, y) {
    if (!this.state.visible) return;

    this.state.mouseX = x;
    this.state.mouseY = y;

    // Calculate distance and angle from center
    const dx = x - this.state.centerX;
    const dy = y - this.state.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if we've moved enough
    if (distance > this.deadZone * 0.5) {
      this.state.hasMoved = true;
    }

    // If in dead zone, no selection
    if (distance < this.deadZone) {
      this._setSelection(-1);
      return;
    }

    // Calculate angle (0 = top, clockwise)
    let angle = Math.atan2(dx, -dy); // Note: swapped for "up is 0"
    if (angle < 0) angle += Math.PI * 2;

    // Determine which item is selected
    const items = this.items[this.state.context];
    const itemCount = items?.length || 8;
    const sectorAngle = (Math.PI * 2) / itemCount;
    const selectedIndex = Math.floor((angle + sectorAngle / 2) / sectorAngle) % itemCount;

    this._setSelection(selectedIndex);
  }

  /**
   * Set the selected item index
   * @param {number} index Item index or -1 for none
   */
  _setSelection(index) {
    if (index === this.state.selectedIndex) return;

    // Remove previous selection highlight
    if (this.state.selectedIndex >= 0 && this.itemElements[this.state.selectedIndex]) {
      this.itemElements[this.state.selectedIndex].classList.remove('selected');
    }

    // Add new selection highlight
    if (index >= 0 && this.itemElements[index]) {
      this.itemElements[index].classList.add('selected');
    }

    this.state.selectedIndex = index;

    // Update center indicator
    const selected = this.getSelected();
    if (this.centerElement) {
      this.centerElement.textContent = selected ? selected.icon : '●';
      this.centerElement.classList.toggle('has-selection', selected !== null);
    }
  }

  /**
   * Render items for current context
   */
  _renderItems() {
    const items = this.items[this.state.context] || [];
    const itemCount = items.length;
    const angleStep = (Math.PI * 2) / itemCount;

    // Clear existing items
    this.itemElements.forEach(el => el.remove());
    this.itemElements = [];

    // Create items positioned radially
    items.forEach((item, i) => {
      // Calculate position (start from top, go clockwise)
      const angle = i * angleStep - Math.PI / 2;
      const x = Math.cos(angle) * this.radius;
      const y = Math.sin(angle) * this.radius;

      const el = document.createElement('div');
      el.className = 'pie-menu-item';
      el.dataset.index = i;
      el.dataset.id = item.id;
      el.innerHTML = `
                <span class="pie-item-icon">${item.icon}</span>
                <span class="pie-item-label">${item.label}</span>
            `;

      el.style.transform = `translate(${x}px, ${y}px)`;

      this.element.appendChild(el);
      this.itemElements.push(el);
    });

    // Reset center
    if (this.centerElement) {
      this.centerElement.textContent = '●';
      this.centerElement.classList.remove('has-selection');
    }
  }

  /**
   * Create DOM structure
   */
  _createDOM() {
    // Background overlay (for click-away)
    this.backgroundElement = document.createElement('div');
    this.backgroundElement.className = 'pie-menu-background';
    this.container.appendChild(this.backgroundElement);

    // Main menu container
    this.element = document.createElement('div');
    this.element.className = 'pie-menu';

    // Center indicator
    this.centerElement = document.createElement('div');
    this.centerElement.className = 'pie-menu-center';
    this.centerElement.textContent = '●';
    this.element.appendChild(this.centerElement);

    this.container.appendChild(this.element);
  }

  /**
   * Add CSS styles
   */
  _addStyles() {
    if (document.getElementById('pie-menu-styles')) return;

    const style = document.createElement('style');
    style.id = 'pie-menu-styles';
    style.textContent = `
            .pie-menu-background {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: transparent;
                z-index: 9998;
                display: none;
                pointer-events: none;
            }
            
            .pie-menu-background.visible {
                display: block;
                pointer-events: auto;
            }
            
            .pie-menu {
                position: fixed;
                width: 0;
                height: 0;
                z-index: 9999;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.1s ease;
            }
            
            .pie-menu.visible {
                opacity: 1;
            }
            
            .pie-menu.animate-in .pie-menu-item {
                transform: translate(var(--tx, 0), var(--ty, 0)) scale(1);
            }
            
            .pie-menu-center {
                position: absolute;
                width: 50px;
                height: 50px;
                left: -25px;
                top: -25px;
                background: rgba(15, 52, 96, 0.95);
                border: 2px solid rgba(232, 177, 63, 0.4);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                color: #666;
                transition: all 0.15s ease;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            }
            
            .pie-menu-center.has-selection {
                background: rgba(232, 177, 63, 0.2);
                border-color: var(--accent, #e8b13f);
                color: var(--accent, #e8b13f);
            }
            
            .pie-menu-item {
                position: absolute;
                width: 72px;
                height: 72px;
                left: -36px;
                top: -36px;
                background: rgba(26, 26, 46, 0.95);
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                pointer-events: auto;
                transition: all 0.15s ease;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                transform: scale(0.8);
            }
            
            .pie-menu.animate-in .pie-menu-item {
                transform: scale(1);
            }
            
            .pie-menu-item:hover,
            .pie-menu-item.selected {
                background: rgba(232, 177, 63, 0.2);
                border-color: var(--accent, #e8b13f);
                transform: scale(1.1);
                box-shadow: 0 4px 20px rgba(232, 177, 63, 0.3);
            }
            
            .pie-item-icon {
                font-size: 20px;
                color: #fff;
                line-height: 1;
            }
            
            .pie-menu-item.selected .pie-item-icon {
                color: var(--accent, #e8b13f);
            }
            
            .pie-item-label {
                font-size: 10px;
                color: #a0a0a0;
                margin-top: 4px;
                font-family: 'Berkeley Mono', 'JetBrains Mono', monospace;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .pie-menu-item.selected .pie-item-label {
                color: #fff;
            }
            
            /* Animation for appearance */
            @keyframes pie-item-appear {
                from {
                    transform: scale(0.5);
                    opacity: 0;
                }
                to {
                    transform: scale(1);
                    opacity: 1;
                }
            }
            
            .pie-menu.animate-in .pie-menu-item {
                animation: pie-item-appear 0.15s ease-out forwards;
            }
            
            .pie-menu.animate-in .pie-menu-item:nth-child(2) { animation-delay: 0.01s; }
            .pie-menu.animate-in .pie-menu-item:nth-child(3) { animation-delay: 0.02s; }
            .pie-menu.animate-in .pie-menu-item:nth-child(4) { animation-delay: 0.03s; }
            .pie-menu.animate-in .pie-menu-item:nth-child(5) { animation-delay: 0.04s; }
            .pie-menu.animate-in .pie-menu-item:nth-child(6) { animation-delay: 0.05s; }
            .pie-menu.animate-in .pie-menu-item:nth-child(7) { animation-delay: 0.06s; }
            .pie-menu.animate-in .pie-menu-item:nth-child(8) { animation-delay: 0.07s; }
            .pie-menu.animate-in .pie-menu-item:nth-child(9) { animation-delay: 0.08s; }
        `;

    document.head.appendChild(style);
  }

  /**
   * Handle keydown events
   */
  _handleKeyDown(e) {
    // Don't trigger if typing in input
    if (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.isContentEditable
    ) {
      return;
    }

    // Escape cancels
    if (e.key === 'Escape' && this.state.visible) {
      e.preventDefault();
      this.cancel();
      return;
    }

    // Q or Space triggers pie menu
    if ((e.key === 'q' || e.key === 'Q' || e.key === ' ') && !this.state.visible && !e.repeat) {
      e.preventDefault();

      // Store start position for hold detection
      this._holdStartPos = { x: this.state.mouseX, y: this.state.mouseY };

      // Start hold timer
      this._holdTimer = setTimeout(() => {
        // Get current mouse position for menu center
        const x = this._holdStartPos.x || window.innerWidth / 2;
        const y = this._holdStartPos.y || window.innerHeight / 2;
        this.show(x, y, e.key);
      }, this.holdDelay);
    }
  }

  /**
   * Handle keyup events
   */
  _handleKeyUp(e) {
    // Clear hold timer
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }

    // If pie menu is visible and this is the trigger key, hide and execute
    const triggerKeys = ['q', 'Q', ' '];
    if (this.state.visible && triggerKeys.includes(e.key)) {
      e.preventDefault();
      this.hide(true);
    }
  }

  /**
   * Handle mouse move events
   */
  _handleMouseMove(e) {
    // Track mouse position for pie menu center
    this.state.mouseX = e.clientX;
    this.state.mouseY = e.clientY;

    // Update hold start position if timer is running
    if (this._holdTimer) {
      this._holdStartPos = { x: e.clientX, y: e.clientY };
    }

    // Update selection if visible
    if (this.state.visible) {
      this.updateSelection(e.clientX, e.clientY);
    }
  }

  /**
   * Handle mouse down events (for click-away)
   */
  _handleMouseDown(e) {
    // Click on background cancels
    if (this.state.visible && e.target === this.backgroundElement) {
      e.preventDefault();
      this.cancel();
    }
  }

  /**
   * Set items for a context
   * @param {string} context Context key
   * @param {Array} items Array of {id, label, icon} items
   */
  setItems(context, items) {
    this.items[context] = items;
  }

  /**
   * Get items for a context
   * @param {string} context Context key
   */
  getItems(context) {
    return this.items[context] || [];
  }

  /**
   * Clean up and remove pie menu
   */
  destroy() {
    this.disable();

    if (this.element?.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    if (this.backgroundElement?.parentNode) {
      this.backgroundElement.parentNode.removeChild(this.backgroundElement);
    }

    // Remove styles
    const styles = document.getElementById('pie-menu-styles');
    if (styles) styles.remove();
  }
}

export default PieMenu;
