/**
 * Ameri-CAD CAD SYSTEM - Selection Manager
 * Handles object selection state and visual feedback
 */

// THREE unused - type annotations only

/**
 * SelectionManager - Manages selection state for CAD objects
 */
export class SelectionManager {
  constructor() {
    /** @type {THREE.Object3D | null} */
    this.selected = null;

    /** @type {Set<THREE.Object3D>} */
    this.multiSelection = new Set();

    /** @type {((obj: THREE.Object3D | null) => void)[]} */
    this.onSelectionChangeCallbacks = [];
  }

  /**
   * Register a callback for selection changes
   * @param {(obj: THREE.Object3D | null) => void} callback
   */
  onSelectionChange(callback) {
    this.onSelectionChangeCallbacks.push(callback);
  }

  /**
   * Notify all callbacks of selection change
   * @private
   */
  _notifySelectionChange() {
    this.onSelectionChangeCallbacks.forEach(cb => cb(this.selected));
  }

  /**
   * Select an object
   * @param {THREE.Object3D} object
   * @param {THREE.TransformControls} transformControl
   * @param {string} transformMode
   */
  select(object, transformControl, transformMode) {
    // Deselect previous if different
    if (this.selected && this.selected !== object) {
      this.deselect(transformControl);
    }

    this.selected = object;

    // Attach transform controls
    transformControl.attach(object);
    transformControl.visible = true;
    transformControl.setMode(transformMode);

    // Apply selection highlight
    this._applyHighlight(object);

    this._notifySelectionChange();
  }

  /**
   * Deselect current object
   * @param {THREE.TransformControls} transformControl
   */
  deselect(transformControl) {
    if (!this.selected) return;

    // Remove highlight
    this._removeHighlight(this.selected);

    this.selected = null;
    transformControl.detach();
    transformControl.visible = false;

    this._notifySelectionChange();
  }

  /**
   * Apply selection highlight to object
   * @private
   * @param {THREE.Object3D} object
   */
  _applyHighlight(object) {
    if (object.material) {
      object.userData.originalEmissive = object.material.emissive.getHex();
      object.material.emissive.setHex(0x333333);
    }
  }

  /**
   * Remove selection highlight from object
   * @private
   * @param {THREE.Object3D} object
   */
  _removeHighlight(object) {
    if (object.material && object.userData.originalEmissive !== undefined) {
      object.material.emissive.setHex(object.userData.originalEmissive);
    }
  }

  /**
   * Check if an object is selected
   * @param {THREE.Object3D} object
   * @returns {boolean}
   */
  isSelected(object) {
    return this.selected === object;
  }

  /**
   * Get currently selected object
   * @returns {THREE.Object3D | null}
   */
  getSelected() {
    return this.selected;
  }

  /**
   * Add object to multi-selection
   * @param {THREE.Object3D} object
   */
  addToSelection(object) {
    this.multiSelection.add(object);
    this._applyHighlight(object);
  }

  /**
   * Remove object from multi-selection
   * @param {THREE.Object3D} object
   */
  removeFromSelection(object) {
    this.multiSelection.delete(object);
    this._removeHighlight(object);
  }

  /**
   * Clear all selections
   * @param {THREE.TransformControls} transformControl
   */
  clearAll(transformControl) {
    // Clear primary selection
    this.deselect(transformControl);

    // Clear multi-selection
    this.multiSelection.forEach(obj => this._removeHighlight(obj));
    this.multiSelection.clear();
  }

  /**
   * Get all selected objects (primary + multi)
   * @returns {THREE.Object3D[]}
   */
  getAllSelected() {
    const all = [...this.multiSelection];
    if (this.selected && !this.multiSelection.has(this.selected)) {
      all.unshift(this.selected);
    }
    return all;
  }
}

// Export singleton instance for app use
export const selectionManager = new SelectionManager();
