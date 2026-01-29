/**
 * Ameri-CAD Main Entry Point
 * Integrates all modules: Kernel + Document Model + UI
 */

import { kernel, downloadFile } from './kernel/bridge.js';
import {
  DocumentModel,
  BoxFeature,
  CylinderFeature,
  SphereFeature,
  ConeFeature,
  BooleanFeature,
} from './state/document.js';
import { Evaluator } from './kernel/evaluator.js';
import { FeatureTreeUI, addFeatureTreeStyles } from './ui/feature-tree.js';
import { editFeature, hasEditableParams } from './ui/param-editor.js';
import { initPropertyPanel } from './ui/property-panel.js';
import { MeasureTool, MeasureMode } from './ui/measure-tool.js';
// commandManager unused - imported for future use
// import { commandManager } from './state/history.js';
import { CrashGuard } from './crash-guard.js';
import {
  meshToSTL,
  meshToSTLBinary,
  mergeMeshesToSTL,
  geometryToMeshData,
  downloadSTL,
  getSTLStats,
} from './io/stl-export.js';
import {
  serialize,
  deserialize,
  downloadFile as downloadAmericadFile,
  openFilePicker,
  validate,
  FILE_EXTENSION,
} from './io/file-format.js';
// Reserved for welcome screen integration
// import { getRecentFilesManager } from './core/recent-files.js';
// import { WelcomeScreen, addWelcomeScreenStyles } from './ui/welcome-screen.js';

/**
 * Ameri-CAD Application
 */
export class AmericaD {
  constructor(options = {}) {
    this.options = {
      container: options.container || '#viewport',
      treeContainer: options.treeContainer || '#feature-tree',
      ...options,
    };

    // Core components
    this.THREE = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.transformControl = null;

    // CAD components
    this.document = new DocumentModel();
    this.evaluator = null;
    this.treeUI = null;
    this.propertyPanel = null;
    this.measureTool = null;

    // Recent files and welcome screen
    this.recentFiles = getRecentFilesManager(10);
    this.welcomeScreen = null;

    // State
    this.selectedFeatureId = null;
    this.kernelReady = false;

    console.log('[Ameri-CAD] Application created');
  }

  /**
   * Initialize the application
   */
  async init(THREE) {
    this.THREE = THREE;

    console.log('[Ameri-CAD] Initializing...');

    // Add styles
    addFeatureTreeStyles();

    // Initialize kernel
    console.log('[Ameri-CAD] Loading geometry kernel...');
    try {
      await kernel.init();
      this.kernelReady = true;
      console.log('[Ameri-CAD] Kernel ready');
    } catch (error) {
      console.warn('[Ameri-CAD] Kernel failed to load, running in mesh-only mode:', error);
      this.kernelReady = false;
    }

    // Create evaluator
    this.evaluator = new Evaluator(this.document, this.scene, THREE);

    // Create feature tree UI
    this.treeUI = new FeatureTreeUI(this.options.treeContainer, this.document);
    this.treeUI.onFeatureSelect = id => this.selectFeature(id);
    this.treeUI.onFeatureDoubleClick = id => this.editFeature(id);
    this.treeUI.onVisibilityToggle = (id, visible) => this.setFeatureVisibility(id, visible);
    this.treeUI.onFeatureDelete = id => this.deleteFeature(id);
    this.treeUI.onFeatureRename = (id, name) => this.renameFeature(id, name);

    // Create property panel UI
    this.propertyPanel = initPropertyPanel({
      document: this.document,
      onPropertyChange: (featureId, type, value) =>
        this.handlePropertyChange(featureId, type, value),
    });

    // Set up crash recovery
    CrashGuard.init();

    // Check for crash recovery on startup
    if (CrashGuard.hasRecoveryData()) {
      CrashGuard.promptRecovery().then(shouldRecover => {
        if (shouldRecover) {
          const data = CrashGuard.getRecoveryData();
          this.recoverFromCrash(data);
        }
      });
    }

    // Initialize welcome screen
    addWelcomeScreenStyles();
    this.welcomeScreen = new WelcomeScreen({
      recentFiles: this.recentFiles,
      callbacks: {
        onNewDocument: () => {
          this.newDocument();
          this.welcomeScreen.hide();
        },
        onOpenFile: async () => {
          const success = await this.openDocument();
          if (success) {
            this.welcomeScreen.hide();
          }
        },
        onOpenRecent: async path => {
          // For now, recent files store serialized JSON content
          // In a full implementation, this would read from disk
          const file = this.recentFiles.get(path);
          if (file && file.content) {
            try {
              await this.loadDocument(file.content, file.name);
              this.welcomeScreen.hide();
            } catch (error) {
              console.error('[Ameri-CAD] Failed to open recent file:', error);
            }
          }
        },
      },
    });

    console.log('[Ameri-CAD] Initialization complete');
  }

  /**
   * Set Three.js scene reference
   */
  setScene(scene, camera, renderer, controls, transformControl) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;
    this.transformControl = transformControl;

    if (this.evaluator) {
      this.evaluator.scene = scene;
    }

    // Initialize measure tool
    this.measureTool = new MeasureTool({
      scene: scene,
      camera: camera,
      renderer: renderer,
      evaluator: this.evaluator,
      onModeChange: mode => {
        console.log(`[Ameri-CAD] Measure mode: ${mode}`);
        // Update status bar if available
        const statusEl = document.querySelector('.status-mode');
        if (statusEl) {
          statusEl.textContent = mode === MeasureMode.NONE ? '' : `MEASURE: ${mode.toUpperCase()}`;
        }
      },
      onMeasurementComplete: result => {
        console.log(`[Ameri-CAD] Measurement: ${result.formatted}`);
        // Show in console/status
        const statusEl = document.querySelector('.status-message');
        if (statusEl) {
          statusEl.textContent = `${result.type.toUpperCase()}: ${result.formatted}`;
        }
      },
      onStatusUpdate: status => {
        const statusEl = document.querySelector('.status-message');
        if (statusEl && status) {
          statusEl.textContent = status;
        }
      },
    });
    this.measureTool.init(scene, camera, renderer);

    // Set up keyboard shortcut for measure tool
    this._setupMeasureKeyboard();
  }

  /**
   * Set up keyboard shortcuts for measure tool
   */
  _setupMeasureKeyboard() {
    document.addEventListener('keydown', e => {
      // Don't trigger if user is typing in an input
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (this.measureTool) {
          this.measureTool.toggle(MeasureMode.DISTANCE);
        }
      }
    });
  }

  // ==================== Feature Operations ====================

  /**
   * Create a box primitive
   */
  async createBox(params = {}) {
    const feature = new BoxFeature({
      width: params.width ?? 10,
      height: params.height ?? 10,
      depth: params.depth ?? 10,
      center: params.center ?? { x: 0, y: 0, z: 0 },
      name: params.name,
    });

    this.document.addFeature(feature);

    if (this.kernelReady) {
      await this.evaluator.evaluateFeature(feature.id);
    }

    CrashGuard.recordCommand({
      type: 'CREATE_PRIMITIVE',
      data: { action: 'create', primitiveType: 'box', featureId: feature.id },
    });

    return feature;
  }

  /**
   * Create a cylinder primitive
   */
  async createCylinder(params = {}) {
    const feature = new CylinderFeature({
      radius: params.radius ?? 5,
      height: params.height ?? 10,
      center: params.center ?? { x: 0, y: 0, z: 0 },
      name: params.name,
    });

    this.document.addFeature(feature);

    if (this.kernelReady) {
      await this.evaluator.evaluateFeature(feature.id);
    }

    CrashGuard.recordCommand({
      type: 'CREATE_PRIMITIVE',
      data: { action: 'create', primitiveType: 'cylinder', featureId: feature.id },
    });

    return feature;
  }

  /**
   * Create a sphere primitive
   */
  async createSphere(params = {}) {
    const feature = new SphereFeature({
      radius: params.radius ?? 5,
      center: params.center ?? { x: 0, y: 0, z: 0 },
      name: params.name,
    });

    this.document.addFeature(feature);

    if (this.kernelReady) {
      await this.evaluator.evaluateFeature(feature.id);
    }

    CrashGuard.recordCommand({
      type: 'CREATE_PRIMITIVE',
      data: { action: 'create', primitiveType: 'sphere', featureId: feature.id },
    });

    return feature;
  }

  /**
   * Create a cone primitive
   */
  async createCone(params = {}) {
    const feature = new ConeFeature({
      radius1: params.radius1 ?? 5,
      radius2: params.radius2 ?? 0,
      height: params.height ?? 10,
      center: params.center ?? { x: 0, y: 0, z: 0 },
      name: params.name,
    });

    this.document.addFeature(feature);

    if (this.kernelReady) {
      await this.evaluator.evaluateFeature(feature.id);
    }

    CrashGuard.recordCommand({
      type: 'CREATE_PRIMITIVE',
      data: { action: 'create', primitiveType: 'cone', featureId: feature.id },
    });

    return feature;
  }

  /**
   * Boolean union of two features
   */
  async booleanUnion(targetId, toolId, params = {}) {
    const feature = new BooleanFeature('union', targetId, toolId, {
      name: params.name ?? 'Union',
    });

    this.document.addFeature(feature);

    if (this.kernelReady) {
      await this.evaluator.evaluateFeature(feature.id);
    }

    CrashGuard.recordCommand({
      type: 'BOOLEAN_OP',
      data: { action: 'boolean', operation: 'union', featureId: feature.id },
    });

    return feature;
  }

  /**
   * Boolean subtract (cut) tool from target
   */
  async booleanSubtract(targetId, toolId, params = {}) {
    const feature = new BooleanFeature('subtract', targetId, toolId, {
      name: params.name ?? 'Cut',
    });

    this.document.addFeature(feature);

    if (this.kernelReady) {
      await this.evaluator.evaluateFeature(feature.id);
    }

    CrashGuard.recordCommand({
      type: 'BOOLEAN_OP',
      data: { action: 'boolean', operation: 'subtract', featureId: feature.id },
    });

    return feature;
  }

  /**
   * Boolean intersect two features
   */
  async booleanIntersect(targetId, toolId, params = {}) {
    const feature = new BooleanFeature('intersect', targetId, toolId, {
      name: params.name ?? 'Intersect',
    });

    this.document.addFeature(feature);

    if (this.kernelReady) {
      await this.evaluator.evaluateFeature(feature.id);
    }

    CrashGuard.recordCommand({
      type: 'BOOLEAN_OP',
      data: { action: 'boolean', operation: 'intersect', featureId: feature.id },
    });

    return feature;
  }

  // ==================== Feature Management ====================

  /**
   * Select a feature
   */
  selectFeature(featureId) {
    // Deselect previous
    if (this.selectedFeatureId) {
      this.evaluator.highlight(this.selectedFeatureId, false);
    }

    this.selectedFeatureId = featureId;

    if (featureId) {
      this.evaluator.highlight(featureId, true);
      this.treeUI.selectFeature(featureId);

      // Attach transform control
      const mesh = this.evaluator.getMesh(featureId);
      if (mesh && this.transformControl) {
        this.transformControl.attach(mesh);
        this.transformControl.visible = true;
      }

      // Update property panel
      const feature = this.document.getFeature(featureId);
      if (this.propertyPanel && feature) {
        this.propertyPanel.bind(feature, mesh);
      }
    } else {
      if (this.transformControl) {
        this.transformControl.detach();
        this.transformControl.visible = false;
      }

      // Clear property panel
      if (this.propertyPanel) {
        this.propertyPanel.clear();
      }
    }
  }

  /**
   * Handle property change from property panel
   */
  async handlePropertyChange(featureId, type, value) {
    if (!featureId) return;

    const feature = this.document.getFeature(featureId);
    if (!feature) return;

    switch (type) {
      case 'name':
        this.renameFeature(featureId, value);
        break;

      case 'param':
        // Update geometry with new parameters
        await this.updateFeature(featureId, value);

        // Refresh property panel geometry info
        if (this.propertyPanel) {
          const mesh = this.evaluator.getMesh(featureId);
          const updatedFeature = this.document.getFeature(featureId);
          this.propertyPanel.bind(updatedFeature, mesh);
        }
        break;

      case 'transform':
        // Apply transform to mesh
        const mesh = this.evaluator.getMesh(featureId);
        if (mesh) {
          mesh.position.set(value.position.x, value.position.y, value.position.z);
          mesh.rotation.set(
            (value.rotation.x * Math.PI) / 180,
            (value.rotation.y * Math.PI) / 180,
            (value.rotation.z * Math.PI) / 180
          );
          mesh.scale.set(value.scale.x, value.scale.y, value.scale.z);
        }
        break;
    }
  }

  /**
   * Delete a feature
   */
  async deleteFeature(featureId) {
    if (featureId === this.selectedFeatureId) {
      this.selectFeature(null);
    }

    // Get kernel shape ID before removing from document
    const feature = this.document.getFeature(featureId);
    const kernelId = feature?.kernelId || this.evaluator.getKernelId(featureId);

    // Remove from document and evaluator
    this.document.removeFeature(featureId);
    this.evaluator.removeFeatureMesh(featureId);

    // Clean up kernel memory to prevent leaks
    if (this.kernelReady && kernelId) {
      try {
        await kernel.deleteShape(kernelId);
      } catch (err) {
        console.warn('[Ameri-CAD] Failed to delete kernel shape:', err);
      }
    }

    CrashGuard.recordCommand({ type: 'DELETE', data: { action: 'delete', featureId } });
  }

  /**
   * Edit feature parameters
   * Opens a modal dialog to edit the feature's dimensions
   */
  editFeature(featureId) {
    const feature = this.document.getFeature(featureId);
    if (!feature) return;

    // Check if feature has editable parameters
    if (!hasEditableParams(feature.type)) {
      console.log(`[Ameri-CAD] Feature '${feature.name}' has no editable parameters`);
      return;
    }

    console.log('[Ameri-CAD] Opening parameter editor for:', feature.name);

    // Open the parameter editor modal
    editFeature(
      feature,
      // onApply callback
      async (id, newParams) => {
        console.log('[Ameri-CAD] Applying parameter changes:', newParams);
        await this.updateFeature(id, newParams);
      },
      // onCancel callback
      () => {
        console.log('[Ameri-CAD] Parameter edit cancelled');
      }
    );
  }

  /**
   * Set feature visibility
   */
  setFeatureVisibility(featureId, visible) {
    this.evaluator.setVisibility(featureId, visible);
  }

  /**
   * Rename a feature
   */
  renameFeature(featureId, name) {
    this.document.updateFeature(featureId, { name });
  }

  /**
   * Update feature parameters and regenerate
   */
  async updateFeature(featureId, params) {
    this.document.updateFeature(featureId, params);

    if (this.kernelReady) {
      await this.evaluator.reEvaluateFromFeature(featureId);
    }

    CrashGuard.recordCommand({
      type: 'UPDATE_PARAMS',
      data: { action: 'update', featureId, params },
    });
  }

  // ==================== File Operations ====================

  /**
   * Save document to .americad file
   *
   * @param {string} filename - Filename (without extension)
   * @returns {string} The serialized JSON content
   */
  saveDocument(filename = 'design') {
    // Ensure filename has proper extension
    const fullFilename = filename.endsWith(FILE_EXTENSION) ? filename : filename + FILE_EXTENSION;

    // Serialize using the new file format
    const json = serialize(this.document, {
      pretty: true,
      name: this.document.name || filename.replace(FILE_EXTENSION, ''),
    });

    // Trigger download
    downloadAmericadFile(json, fullFilename);

    console.log(`[Ameri-CAD] Document saved: ${fullFilename}`);

    // Clear modified state
    this.document.modifiedAt = Date.now();

    // Add to recent files
    const docName = this.document.name || filename.replace(FILE_EXTENSION, '');
    this.recentFiles.add(fullFilename, docName, { content: json });

    return json;
  }

  /**
   * Open file picker and load document
   *
   * @returns {Promise<boolean>} Whether load was successful
   */
  async openDocument() {
    try {
      const { content, filename } = await openFilePicker();
      await this.loadDocument(content, filename);
      return true;
    } catch (error) {
      if (error.message !== 'File selection cancelled') {
        console.error('[Ameri-CAD] Failed to open document:', error);
      }
      return false;
    }
  }

  /**
   * Load document from JSON
   *
   * @param {string|Object} json - JSON string or parsed object
   * @param {string} filename - Optional filename for document name
   */
  async loadDocument(json, filename = null) {
    // Validate the file format
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const validation = validate(data);

    if (!validation.valid) {
      throw new Error(`Invalid document: ${validation.error}`);
    }

    console.log(`[Ameri-CAD] Loading document: ${data.name || filename || 'Untitled'}`);

    // Clear current document and scene
    this.document.clear();
    this.evaluator.clear();
    this.selectFeature(null);

    // Deserialize the document using the file format module
    this.document = deserialize(data);

    // Update document name from filename if not set
    if (filename && !this.document.name) {
      this.document.name = filename.replace(FILE_EXTENSION, '').replace('.json', '');
    }

    // Update references in evaluator and UI
    this.evaluator.document = this.document;
    this.treeUI.document = this.document;

    // Evaluate all features to rebuild geometry
    // Features are already in topological order from deserialization
    if (this.kernelReady) {
      console.log(`[Ameri-CAD] Regenerating ${this.document.features.size} features...`);
      await this.evaluator.evaluateAll();
      console.log('[Ameri-CAD] Regeneration complete');
    } else {
      console.warn('[Ameri-CAD] Kernel not ready - geometry not regenerated');
    }

    // Update the feature tree UI
    this.treeUI.render();

    // Update document title in UI
    this.updateDocumentTitle(this.document.name);

    // Add to recent files
    const fullFilename = filename || `${this.document.name || 'Untitled'}${FILE_EXTENSION}`;
    const docName = this.document.name || 'Untitled';
    const jsonContent = typeof json === 'string' ? json : JSON.stringify(json);
    this.recentFiles.add(fullFilename, docName, { content: jsonContent });

    console.log(`[Ameri-CAD] Loaded document with ${this.document.features.size} features`);
  }

  /**
   * Update document title in the UI
   *
   * @param {string} name - Document name
   */
  updateDocumentTitle(name) {
    const titleEl = document.querySelector('.doc-title span[contenteditable]');
    if (titleEl) {
      titleEl.textContent = (name || 'UNTITLED') + '.AD';
    }
  }

  /**
   * Check if document has unsaved changes
   *
   * @returns {boolean}
   */
  hasUnsavedChanges() {
    // Simple check - could be enhanced with actual change tracking
    return this.document.features.size > 0;
  }

  /**
   * Get document info for display
   *
   * @returns {Object}
   */
  getDocumentInfo() {
    return {
      name: this.document.name,
      featureCount: this.document.features.size,
      created: new Date(this.document.createdAt).toLocaleString(),
      modified: new Date(this.document.modifiedAt).toLocaleString(),
    };
  }

  /**
   * Export feature(s) to STEP format (ISO 10303-21, AP214)
   * @param {string|string[]|null} featureIds - Feature ID(s) to export, or null for selected/all
   * @param {string} filename - Output filename
   */
  async exportSTEP(featureIds = null, filename = 'export.step') {
    if (!this.kernelReady) {
      console.warn('[Ameri-CAD] Kernel not ready for STEP export');
      return { success: false, error: 'Kernel not ready' };
    }

    try {
      let result;

      if (Array.isArray(featureIds)) {
        // Export specific features
        result = await this.evaluator.exportSTEPMultiple(featureIds);
      } else if (featureIds) {
        // Export single feature
        result = await this.evaluator.exportSTEP(featureIds);
      } else if (this.selectedFeatureId) {
        // Export selected feature
        result = await this.evaluator.exportSTEP(this.selectedFeatureId);
      } else {
        // Export all visible features
        result = await this.evaluator.exportSTEPAll();
      }

      downloadFile(result.content, filename, 'application/step');
      console.log(`[Ameri-CAD] Exported ${result.count || 1} shape(s) to STEP`);
      return { success: true, count: result.count || 1 };
    } catch (error) {
      console.error('[Ameri-CAD] STEP export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export all visible features to STEP
   * @param {string} filename - Output filename
   */
  async exportSTEPAll(filename = 'model.step') {
    if (!this.kernelReady) {
      console.warn('[Ameri-CAD] Kernel not ready for STEP export');
      return { success: false, error: 'Kernel not ready' };
    }

    try {
      const result = await this.evaluator.exportSTEPAll();
      downloadFile(result.content, filename, 'application/step');
      console.log(`[Ameri-CAD] Exported ${result.count} shape(s) to STEP`);
      return { success: true, count: result.count };
    } catch (error) {
      console.error('[Ameri-CAD] STEP export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export selected feature to STL
   * @param {string} featureId - Feature ID to export (or null for selected)
   * @param {Object} options - Export options
   * @param {boolean} options.binary - Use binary format (default: true, smaller files)
   * @param {string} options.filename - Output filename (default: 'export')
   * @param {boolean} options.useKernel - Try kernel export first (default: true)
   */
  async exportSTL(featureId = null, options = {}) {
    const {
      binary = true,
      filename = 'export',
      useKernel = true,
    } = typeof options === 'string' ? { filename: options } : options;

    const id = featureId || this.selectedFeatureId;
    if (!id) {
      console.warn('[Ameri-CAD] No feature selected for export');
      return { success: false, error: 'No feature selected' };
    }

    const finalFilename = filename.endsWith('.stl') ? filename : `${filename}.stl`;

    // Try kernel-based export first (produces cleaner B-rep geometry)
    if (useKernel && this.kernelReady) {
      try {
        const result = await this.evaluator.exportSTL(id);
        downloadFile(result.content, finalFilename, 'application/sla');
        console.log('[Ameri-CAD] Exported STL via kernel');
        return { success: true, method: 'kernel' };
      } catch (error) {
        console.warn('[Ameri-CAD] Kernel STL export failed, trying mesh export:', error.message);
      }
    }

    // Fallback to mesh-based export (always available if mesh exists)
    const mesh = this.evaluator.getMesh(id);
    if (!mesh?.geometry) {
      console.warn('[Ameri-CAD] No mesh data available for export');
      return { success: false, error: 'No mesh data available' };
    }

    try {
      const meshData = geometryToMeshData(mesh.geometry);
      const feature = this.document.getFeature(id);
      const name = feature?.name || 'americad';

      let content;
      if (binary) {
        content = meshToSTLBinary(meshData, `Ameri-CAD: ${name}`);
      } else {
        content = meshToSTL(meshData, name);
      }

      downloadSTL(content, finalFilename, binary);

      const stats = getSTLStats(meshData);
      console.log(
        `[Ameri-CAD] Exported ${binary ? 'binary' : 'ASCII'} STL via mesh: ${stats.triangleCount} triangles`
      );

      return { success: true, method: 'mesh', stats };
    } catch (error) {
      console.error('[Ameri-CAD] Mesh STL export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export multiple features to a single STL file
   * @param {string[]} featureIds - Feature IDs to export (null = all visible)
   * @param {Object} options - Export options
   * @param {boolean} options.binary - Use binary format (default: true)
   * @param {string} options.filename - Output filename (default: 'export')
   */
  async exportMultipleSTL(featureIds = null, options = {}) {
    const { binary = true, filename = 'export' } = options;

    // Default to all visible features
    const ids =
      featureIds ||
      Array.from(this.document.features.values())
        .filter(f => f.visible)
        .map(f => f.id);

    if (ids.length === 0) {
      console.warn('[Ameri-CAD] No features to export');
      return { success: false, error: 'No features to export' };
    }

    // Collect mesh data from all features
    const meshes = [];
    for (const id of ids) {
      const mesh = this.evaluator.getMesh(id);
      if (mesh?.geometry) {
        meshes.push(geometryToMeshData(mesh.geometry));
      }
    }

    if (meshes.length === 0) {
      console.warn('[Ameri-CAD] No mesh data available for export');
      return { success: false, error: 'No mesh data available' };
    }

    try {
      const content = mergeMeshesToSTL(meshes, filename, binary);
      const finalFilename = filename.endsWith('.stl') ? filename : `${filename}.stl`;
      downloadSTL(content, finalFilename, binary);

      const totalTriangles = meshes.reduce((sum, m) => sum + m.indices.length / 3, 0);
      console.log(
        `[Ameri-CAD] Exported merged ${binary ? 'binary' : 'ASCII'} STL: ${totalTriangles} triangles from ${meshes.length} bodies`
      );

      return { success: true, bodies: meshes.length, triangles: totalTriangles };
    } catch (error) {
      console.error('[Ameri-CAD] Multi-body STL export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get STL export statistics without downloading
   * @param {string} featureId - Feature ID (null = selected)
   * @returns {Object|null} Statistics about the mesh for STL export
   */
  getSTLExportStats(featureId = null) {
    const id = featureId || this.selectedFeatureId;
    if (!id) return null;

    const mesh = this.evaluator.getMesh(id);
    if (!mesh?.geometry) return null;

    return getSTLStats(geometryToMeshData(mesh.geometry));
  }

  // ==================== Recovery ====================

  /**
   * Recover from crash
   */
  recoverFromCrash(data) {
    console.log('[Ameri-CAD] Recovering from crash:', data);
    // TODO: Replay commands from crash log
  }

  /**
   * Clear document and start fresh
   */
  newDocument() {
    this.document.clear();
    this.evaluator.clear();
    this.selectFeature(null);
    CrashGuard.clear();
  }

  // ==================== Welcome Screen ====================

  /**
   * Show the welcome screen
   */
  showWelcomeScreen() {
    if (this.welcomeScreen) {
      this.welcomeScreen.show();
    }
  }

  /**
   * Hide the welcome screen
   */
  hideWelcomeScreen() {
    if (this.welcomeScreen) {
      this.welcomeScreen.hide();
    }
  }

  /**
   * Check if welcome screen is visible
   * @returns {boolean}
   */
  isWelcomeScreenVisible() {
    return this.welcomeScreen ? this.welcomeScreen.isVisible() : false;
  }

  /**
   * Get recent files list
   * @returns {Array} Array of recent file objects
   */
  getRecentFiles() {
    return this.recentFiles.getRecent();
  }

  /**
   * Clear recent files history
   */
  clearRecentFiles() {
    this.recentFiles.clear();
  }
}

// Export singleton
export const app = new AmericaD();

// Re-export for convenience
export { getRecentFilesManager } from './core/recent-files.js';
export { WelcomeScreen, addWelcomeScreenStyles } from './ui/welcome-screen.js';
