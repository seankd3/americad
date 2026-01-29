/**
 * Ameri-CAD Mass Properties Panel
 *
 * Displays mass properties (volume, surface area, center of gravity,
 * moments of inertia, etc.) for selected geometry.
 * Similar to Fusion 360's Mass Properties feature.
 */

/**
 * Mass Properties Panel - Displays calculated mass properties for selection
 */
export class MassPropertiesPanel {
  constructor(options = {}) {
    this.container = null;
    this.kernel = options.kernel || null;
    this.onDensityChange = options.onDensityChange || (() => {});

    this.currentShapeId = null;
    this.currentData = null;
    this.density = 1.0; // Default density: 1.0 g/cm³ (water/generic plastic)

    // Section collapse states
    this.collapsedSections = new Set();

    this.visible = false;
    this.init();
  }

  /**
   * Initialize the panel
   */
  init() {
    this.createPanel();
    this.addStyles();
    this.hide();
  }

  /**
   * Create the panel DOM structure
   */
  createPanel() {
    this.container = document.createElement('div');
    this.container.id = 'mass-properties-panel';
    this.container.className = 'mass-properties-panel floating-panel';

    this.container.innerHTML = `
            <div class="panel-header">
                <span class="panel-title">⚖️ MASS PROPERTIES</span>
                <div class="panel-controls">
                    <button class="panel-btn copy-btn" title="Copy to clipboard">📋</button>
                    <button class="panel-btn close-btn" title="Close">×</button>
                </div>
            </div>
            
            <div class="panel-body">
                <!-- Loading state -->
                <div class="loading-state" id="mp-loading" style="display: none;">
                    <div class="spinner"></div>
                    <span>Calculating...</span>
                </div>
                
                <!-- Empty state -->
                <div class="empty-state" id="mp-empty">
                    <div class="empty-icon">◎</div>
                    <div class="empty-text">NO SELECTION</div>
                    <div class="empty-hint">Select a solid to view mass properties</div>
                </div>
                
                <!-- Content -->
                <div class="mp-content" id="mp-content" style="display: none;">
                    <!-- Material Section -->
                    <div class="mp-section" data-section="material">
                        <div class="section-header">
                            <span class="section-collapse-icon">▼</span>
                            <span class="section-title">MATERIAL</span>
                        </div>
                        <div class="section-body">
                            <div class="density-input-row">
                                <label>Density (g/cm³)</label>
                                <input type="number" id="mp-density" value="1.0" 
                                    step="0.1" min="0.001" max="25">
                            </div>
                            <div class="quick-materials">
                                <button data-density="0.92" title="HDPE Plastic">🧪 HDPE</button>
                                <button data-density="1.05" title="ABS Plastic">🧪 ABS</button>
                                <button data-density="1.24" title="PLA Plastic">🧪 PLA</button>
                                <button data-density="2.70" title="Aluminum 6061">🔩 Al</button>
                                <button data-density="7.85" title="Steel">🔩 Steel</button>
                                <button data-density="8.96" title="Copper">🔩 Cu</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Mass/Volume Section -->
                    <div class="mp-section" data-section="mass">
                        <div class="section-header">
                            <span class="section-collapse-icon">▼</span>
                            <span class="section-title">MASS & VOLUME</span>
                        </div>
                        <div class="section-body">
                            <div class="mp-row">
                                <span class="mp-label">Mass</span>
                                <span class="mp-value" id="mp-mass">—</span>
                            </div>
                            <div class="mp-row">
                                <span class="mp-label">Volume</span>
                                <span class="mp-value" id="mp-volume">—</span>
                            </div>
                            <div class="mp-row">
                                <span class="mp-label">Surface Area</span>
                                <span class="mp-value" id="mp-surface-area">—</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Bounding Box Section -->
                    <div class="mp-section" data-section="bbox">
                        <div class="section-header">
                            <span class="section-collapse-icon">▼</span>
                            <span class="section-title">BOUNDING BOX</span>
                        </div>
                        <div class="section-body">
                            <div class="mp-row">
                                <span class="mp-label">Width (X)</span>
                                <span class="mp-value" id="mp-bbox-x">—</span>
                            </div>
                            <div class="mp-row">
                                <span class="mp-label">Height (Y)</span>
                                <span class="mp-value" id="mp-bbox-y">—</span>
                            </div>
                            <div class="mp-row">
                                <span class="mp-label">Depth (Z)</span>
                                <span class="mp-value" id="mp-bbox-z">—</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Center of Gravity Section -->
                    <div class="mp-section" data-section="cog">
                        <div class="section-header">
                            <span class="section-collapse-icon">▼</span>
                            <span class="section-title">CENTER OF GRAVITY</span>
                        </div>
                        <div class="section-body">
                            <div class="cog-display">
                                <div class="cog-axis">
                                    <span class="axis-marker x">X</span>
                                    <span class="mp-value" id="mp-cog-x">—</span>
                                </div>
                                <div class="cog-axis">
                                    <span class="axis-marker y">Y</span>
                                    <span class="mp-value" id="mp-cog-y">—</span>
                                </div>
                                <div class="cog-axis">
                                    <span class="axis-marker z">Z</span>
                                    <span class="mp-value" id="mp-cog-z">—</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Moments of Inertia Section -->
                    <div class="mp-section" data-section="inertia">
                        <div class="section-header">
                            <span class="section-collapse-icon">▼</span>
                            <span class="section-title">MOMENTS OF INERTIA</span>
                        </div>
                        <div class="section-body">
                            <div class="inertia-grid">
                                <div class="mp-row">
                                    <span class="mp-label">Ixx</span>
                                    <span class="mp-value" id="mp-ixx">—</span>
                                </div>
                                <div class="mp-row">
                                    <span class="mp-label">Iyy</span>
                                    <span class="mp-value" id="mp-iyy">—</span>
                                </div>
                                <div class="mp-row">
                                    <span class="mp-label">Izz</span>
                                    <span class="mp-value" id="mp-izz">—</span>
                                </div>
                                <div class="mp-row secondary">
                                    <span class="mp-label">Ixy</span>
                                    <span class="mp-value" id="mp-ixy">—</span>
                                </div>
                                <div class="mp-row secondary">
                                    <span class="mp-label">Ixz</span>
                                    <span class="mp-value" id="mp-ixz">—</span>
                                </div>
                                <div class="mp-row secondary">
                                    <span class="mp-label">Iyz</span>
                                    <span class="mp-value" id="mp-iyz">—</span>
                                </div>
                            </div>
                            <div class="inertia-units">Units: mm⁵ (volume-based)</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

    document.body.appendChild(this.container);
    this.bindEvents();
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Close button
    this.container.querySelector('.close-btn').addEventListener('click', () => {
      this.hide();
    });

    // Copy button
    this.container.querySelector('.copy-btn').addEventListener('click', () => {
      this.copyToClipboard();
    });

    // Density input
    const densityInput = this.container.querySelector('#mp-density');
    densityInput.addEventListener('input', () => {
      this.density = parseFloat(densityInput.value) || 1.0;
      this.recalculate();
    });

    // Quick material buttons
    this.container.querySelectorAll('.quick-materials button').forEach(btn => {
      btn.addEventListener('click', () => {
        const density = parseFloat(btn.dataset.density);
        this.density = density;
        densityInput.value = density;
        this.recalculate();
      });
    });

    // Section collapse toggles
    this.container.querySelectorAll('.section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.mp-section');
        const sectionName = section.dataset.section;
        this.toggleSection(sectionName, section);
      });
    });

    // Make panel draggable
    this.makeDraggable();
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
   * Make the panel draggable
   */
  makeDraggable() {
    const header = this.container.querySelector('.panel-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.container.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.container.style.left = `${startLeft + dx}px`;
      this.container.style.top = `${startTop + dy}px`;
      this.container.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      header.style.cursor = 'grab';
    });
  }

  /**
   * Show the panel
   */
  show() {
    this.container.style.display = 'block';
    this.visible = true;
  }

  /**
   * Hide the panel
   */
  hide() {
    this.container.style.display = 'none';
    this.visible = false;
  }

  /**
   * Toggle visibility
   */
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if panel is visible
   */
  isVisible() {
    return this.visible;
  }

  /**
   * Set the kernel bridge reference
   */
  setKernel(kernel) {
    this.kernel = kernel;
  }

  /**
   * Calculate and display mass properties for a shape
   * @param {string} shapeId - Kernel shape ID
   * @param {number} density - Optional density override
   */
  async calculate(shapeId, density = null) {
    if (!this.kernel) {
      console.error('[MassPropertiesPanel] No kernel set');
      return;
    }

    this.currentShapeId = shapeId;
    if (density !== null) {
      this.density = density;
      this.container.querySelector('#mp-density').value = density;
    }

    // Show loading state
    this.container.querySelector('#mp-loading').style.display = 'flex';
    this.container.querySelector('#mp-empty').style.display = 'none';
    this.container.querySelector('#mp-content').style.display = 'none';

    try {
      // Call kernel to get mass properties
      this.currentData = await this.kernel.getMassProperties(shapeId, this.density);
      this.displayData(this.currentData);
    } catch (error) {
      console.error('[MassPropertiesPanel] Calculation error:', error);
      this.showEmpty('Calculation failed: ' + error.message);
    }
  }

  /**
   * Recalculate with current shape and new density
   */
  async recalculate() {
    if (!this.currentShapeId || !this.kernel) return;
    await this.calculate(this.currentShapeId);
  }

  /**
   * Display the calculated data
   */
  displayData(data) {
    this.container.querySelector('#mp-loading').style.display = 'none';
    this.container.querySelector('#mp-empty').style.display = 'none';
    this.container.querySelector('#mp-content').style.display = 'block';

    // Mass & Volume
    this.container.querySelector('#mp-mass').textContent = this.formatMass(data.mass);
    this.container.querySelector('#mp-volume').textContent = this.formatVolume(
      data.volume,
      data.volumeCm3
    );
    this.container.querySelector('#mp-surface-area').textContent = this.formatArea(
      data.surfaceArea,
      data.surfaceAreaCm2
    );

    // Bounding Box
    const dims = data.boundingBox.dimensions;
    this.container.querySelector('#mp-bbox-x').textContent = `${dims.x.toFixed(3)} mm`;
    this.container.querySelector('#mp-bbox-y').textContent = `${dims.y.toFixed(3)} mm`;
    this.container.querySelector('#mp-bbox-z').textContent = `${dims.z.toFixed(3)} mm`;

    // Center of Gravity
    const cog = data.centerOfGravity;
    this.container.querySelector('#mp-cog-x').textContent = `${cog.x.toFixed(4)} mm`;
    this.container.querySelector('#mp-cog-y').textContent = `${cog.y.toFixed(4)} mm`;
    this.container.querySelector('#mp-cog-z').textContent = `${cog.z.toFixed(4)} mm`;

    // Moments of Inertia
    const moi = data.momentsOfInertia;
    this.container.querySelector('#mp-ixx').textContent = this.formatInertia(moi.Ixx);
    this.container.querySelector('#mp-iyy').textContent = this.formatInertia(moi.Iyy);
    this.container.querySelector('#mp-izz').textContent = this.formatInertia(moi.Izz);
    this.container.querySelector('#mp-ixy').textContent = this.formatInertia(moi.Ixy);
    this.container.querySelector('#mp-ixz').textContent = this.formatInertia(moi.Ixz);
    this.container.querySelector('#mp-iyz').textContent = this.formatInertia(moi.Iyz);
  }

  /**
   * Show empty state with optional message
   */
  showEmpty(message = null) {
    this.container.querySelector('#mp-loading').style.display = 'none';
    this.container.querySelector('#mp-content').style.display = 'none';
    const emptyEl = this.container.querySelector('#mp-empty');
    emptyEl.style.display = 'flex';

    if (message) {
      emptyEl.querySelector('.empty-hint').textContent = message;
    }
  }

  /**
   * Clear the panel
   */
  clear() {
    this.currentShapeId = null;
    this.currentData = null;
    this.showEmpty();
  }

  /**
   * Format mass for display
   */
  formatMass(grams) {
    if (grams >= 1000) {
      return `${(grams / 1000).toFixed(4)} kg`;
    }
    return `${grams.toFixed(4)} g`;
  }

  /**
   * Format volume for display
   */
  formatVolume(mm3, cm3) {
    if (cm3 >= 1) {
      return `${cm3.toFixed(4)} cm³`;
    }
    return `${mm3.toFixed(4)} mm³`;
  }

  /**
   * Format area for display
   */
  formatArea(mm2, cm2) {
    if (cm2 >= 1) {
      return `${cm2.toFixed(4)} cm²`;
    }
    return `${mm2.toFixed(4)} mm²`;
  }

  /**
   * Format inertia values (scientific notation for large values)
   */
  formatInertia(value) {
    if (Math.abs(value) >= 1e6 || (Math.abs(value) < 0.01 && value !== 0)) {
      return value.toExponential(4);
    }
    return value.toFixed(4);
  }

  /**
   * Copy mass properties to clipboard as text
   */
  async copyToClipboard() {
    if (!this.currentData) return;

    const data = this.currentData;
    const text = `
MASS PROPERTIES
===============
Density: ${data.density} g/cm³

MASS & VOLUME
Mass: ${this.formatMass(data.mass)}
Volume: ${this.formatVolume(data.volume, data.volumeCm3)}
Surface Area: ${this.formatArea(data.surfaceArea, data.surfaceAreaCm2)}

BOUNDING BOX
Width (X): ${data.boundingBox.dimensions.x.toFixed(3)} mm
Height (Y): ${data.boundingBox.dimensions.y.toFixed(3)} mm
Depth (Z): ${data.boundingBox.dimensions.z.toFixed(3)} mm

CENTER OF GRAVITY
X: ${data.centerOfGravity.x.toFixed(4)} mm
Y: ${data.centerOfGravity.y.toFixed(4)} mm
Z: ${data.centerOfGravity.z.toFixed(4)} mm

MOMENTS OF INERTIA (mm⁵)
Ixx: ${this.formatInertia(data.momentsOfInertia.Ixx)}
Iyy: ${this.formatInertia(data.momentsOfInertia.Iyy)}
Izz: ${this.formatInertia(data.momentsOfInertia.Izz)}
Ixy: ${this.formatInertia(data.momentsOfInertia.Ixy)}
Ixz: ${this.formatInertia(data.momentsOfInertia.Ixz)}
Iyz: ${this.formatInertia(data.momentsOfInertia.Iyz)}
`.trim();

    try {
      await navigator.clipboard.writeText(text);
      // Show brief feedback
      const copyBtn = this.container.querySelector('.copy-btn');
      const original = copyBtn.textContent;
      copyBtn.textContent = '✓';
      setTimeout(() => {
        copyBtn.textContent = original;
      }, 1000);
    } catch (e) {
      console.error('[MassPropertiesPanel] Copy failed:', e);
    }
  }

  /**
   * Get current mass properties data
   */
  getData() {
    return this.currentData;
  }

  /**
   * Add component styles
   */
  addStyles() {
    if (document.getElementById('mass-properties-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'mass-properties-panel-styles';
    style.textContent = `
            .mass-properties-panel {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 320px;
                background: var(--bg-100, #121214);
                border: 1px solid var(--border-subtle, #27272b);
                border-radius: var(--radius-lg, 4px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                z-index: 1000;
                font-family: var(--font-mono, 'JetBrains Mono', monospace);
                color: var(--text-primary, #f5f5f5);
            }
            
            .mass-properties-panel .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--space-3, 12px) var(--space-4, 16px);
                background: var(--bg-200, #18181a);
                border-bottom: 1px solid var(--border-subtle, #27272b);
                cursor: grab;
            }
            
            .mass-properties-panel .panel-title {
                font-size: var(--text-sm, 11px);
                font-weight: var(--font-semibold, 600);
                letter-spacing: 0.1em;
                color: var(--text-secondary, #a0a0a5);
            }
            
            .mass-properties-panel .panel-controls {
                display: flex;
                gap: var(--space-2, 8px);
            }
            
            .mass-properties-panel .panel-btn {
                background: transparent;
                border: none;
                color: var(--text-tertiary, #6a6a70);
                font-size: 14px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: var(--radius-sm, 2px);
                transition: all var(--transition-fast, 80ms);
            }
            
            .mass-properties-panel .panel-btn:hover {
                background: var(--surface-hover, #35353a);
                color: var(--text-primary, #f5f5f5);
            }
            
            .mass-properties-panel .panel-body {
                max-height: 70vh;
                overflow-y: auto;
            }
            
            /* Loading State */
            .mass-properties-panel .loading-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--space-8, 32px);
                color: var(--text-tertiary, #6a6a70);
            }
            
            .mass-properties-panel .spinner {
                width: 24px;
                height: 24px;
                border: 2px solid var(--border-subtle, #27272b);
                border-top-color: var(--accent-primary, #e8b13f);
                border-radius: 50%;
                animation: mp-spin 0.8s linear infinite;
                margin-bottom: var(--space-3, 12px);
            }
            
            @keyframes mp-spin {
                to { transform: rotate(360deg); }
            }
            
            /* Empty State */
            .mass-properties-panel .empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--space-8, 32px) var(--space-4, 16px);
                text-align: center;
                color: var(--text-tertiary, #6a6a70);
            }
            
            .mass-properties-panel .empty-icon {
                font-size: 32px;
                margin-bottom: var(--space-3, 12px);
                opacity: 0.5;
            }
            
            .mass-properties-panel .empty-text {
                font-size: var(--text-sm, 11px);
                font-weight: var(--font-semibold, 600);
                letter-spacing: 0.1em;
                margin-bottom: var(--space-1, 4px);
            }
            
            .mass-properties-panel .empty-hint {
                font-size: var(--text-xs, 10px);
                opacity: 0.7;
            }
            
            /* Content Sections */
            .mass-properties-panel .mp-section {
                border-bottom: 1px solid var(--border-subtle, #27272b);
            }
            
            .mass-properties-panel .mp-section:last-child {
                border-bottom: none;
            }
            
            .mass-properties-panel .section-header {
                display: flex;
                align-items: center;
                gap: var(--space-2, 8px);
                padding: var(--space-3, 12px) var(--space-4, 16px);
                background: var(--bg-200, #18181a);
                cursor: pointer;
                user-select: none;
            }
            
            .mass-properties-panel .section-header:hover {
                background: var(--surface-hover, #35353a);
            }
            
            .mass-properties-panel .section-collapse-icon {
                font-size: 8px;
                color: var(--text-tertiary, #6a6a70);
            }
            
            .mass-properties-panel .section-title {
                font-size: var(--text-xs, 10px);
                font-weight: var(--font-semibold, 600);
                letter-spacing: 0.1em;
                color: var(--text-secondary, #a0a0a5);
            }
            
            .mass-properties-panel .section-body {
                padding: var(--space-3, 12px) var(--space-4, 16px);
            }
            
            /* Property Rows */
            .mass-properties-panel .mp-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--space-1, 4px) 0;
            }
            
            .mass-properties-panel .mp-row.secondary {
                opacity: 0.7;
            }
            
            .mass-properties-panel .mp-label {
                font-size: var(--text-sm, 11px);
                color: var(--text-secondary, #a0a0a5);
            }
            
            .mass-properties-panel .mp-value {
                font-size: var(--text-sm, 11px);
                color: var(--text-primary, #f5f5f5);
                font-family: var(--font-mono);
            }
            
            /* Density Input */
            .mass-properties-panel .density-input-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: var(--space-3, 12px);
            }
            
            .mass-properties-panel .density-input-row label {
                font-size: var(--text-sm, 11px);
                color: var(--text-secondary, #a0a0a5);
            }
            
            .mass-properties-panel .density-input-row input {
                width: 100px;
                padding: var(--space-2, 8px);
                background: var(--bg-200, #18181a);
                border: 1px solid var(--border-subtle, #27272b);
                border-radius: var(--radius-md, 3px);
                color: var(--text-primary, #f5f5f5);
                font-family: var(--font-mono);
                font-size: var(--text-sm, 11px);
                text-align: right;
            }
            
            .mass-properties-panel .density-input-row input:focus {
                outline: none;
                border-color: var(--accent-primary, #e8b13f);
            }
            
            /* Quick Materials */
            .mass-properties-panel .quick-materials {
                display: flex;
                flex-wrap: wrap;
                gap: var(--space-1, 4px);
            }
            
            .mass-properties-panel .quick-materials button {
                padding: var(--space-1, 4px) var(--space-2, 8px);
                background: var(--bg-300, #1f1f22);
                border: 1px solid var(--border-subtle, #27272b);
                border-radius: var(--radius-sm, 2px);
                color: var(--text-secondary, #a0a0a5);
                font-size: var(--text-xs, 10px);
                cursor: pointer;
                transition: all var(--transition-fast, 80ms);
            }
            
            .mass-properties-panel .quick-materials button:hover {
                background: var(--surface-hover, #35353a);
                color: var(--text-primary, #f5f5f5);
                border-color: var(--accent-primary, #e8b13f);
            }
            
            /* Center of Gravity Display */
            .mass-properties-panel .cog-display {
                display: flex;
                gap: var(--space-3, 12px);
            }
            
            .mass-properties-panel .cog-axis {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-1, 4px);
            }
            
            .mass-properties-panel .axis-marker {
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: var(--text-xs, 10px);
                font-weight: var(--font-semibold, 600);
                border-radius: var(--radius-sm, 2px);
            }
            
            .mass-properties-panel .axis-marker.x {
                background: rgba(255, 68, 68, 0.2);
                color: var(--axis-x, #ff4444);
            }
            
            .mass-properties-panel .axis-marker.y {
                background: rgba(68, 255, 68, 0.2);
                color: var(--axis-y, #44ff44);
            }
            
            .mass-properties-panel .axis-marker.z {
                background: rgba(68, 68, 255, 0.2);
                color: var(--axis-z, #4444ff);
            }
            
            /* Inertia Grid */
            .mass-properties-panel .inertia-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: var(--space-2, 8px);
            }
            
            .mass-properties-panel .inertia-units {
                margin-top: var(--space-2, 8px);
                font-size: var(--text-xs, 10px);
                color: var(--text-tertiary, #6a6a70);
                text-align: center;
            }
        `;

    document.head.appendChild(style);
  }
}

/**
 * Create and export singleton instance
 */
let panelInstance = null;

export function getMassPropertiesPanel(options = {}) {
  if (!panelInstance) {
    panelInstance = new MassPropertiesPanel(options);
  }
  return panelInstance;
}

export function initMassPropertiesPanel(options = {}) {
  return getMassPropertiesPanel(options);
}

export default MassPropertiesPanel;
