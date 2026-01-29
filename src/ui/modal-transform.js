/**
 * Ameri-CAD - Blender-Style Modal Transform System
 * 
 * Implements G/R/S keyboard shortcuts for grab/rotate/scale
 * with axis locking (X/Y/Z), plane locking (Shift+X/Y/Z),
 * and numeric input for precise values.
 * 
 * Usage:
 *   G → Grab mode (move)
 *   R → Rotate mode
 *   S → Scale mode
 *   X/Y/Z → Lock to axis
 *   Shift+X/Y/Z → Lock to plane (exclude that axis)
 *   0-9, -, . → Numeric input
 *   Enter → Confirm transform
 *   Escape/Right-click → Cancel
 */

import * as THREE from 'three';

/**
 * Transform modes
 */
export const TransformMode = {
    NONE: null,
    GRAB: 'grab',
    ROTATE: 'rotate',
    SCALE: 'scale'
};

/**
 * Axis constraints
 */
export const AxisConstraint = {
    NONE: null,
    X: 'x',
    Y: 'y',
    Z: 'z'
};

/**
 * Plane constraints (excludes the named axis)
 */
export const PlaneConstraint = {
    NONE: null,
    XY: 'xy',  // Shift+Z - move in XY plane
    XZ: 'xz',  // Shift+Y - move in XZ plane
    YZ: 'yz'   // Shift+X - move in YZ plane
};

/**
 * Axis colors matching standard CAD conventions
 */
const AXIS_COLORS = {
    x: 0xff4444,  // Red
    y: 0x44ff44,  // Green
    z: 0x4444ff   // Blue
};

/**
 * Modal Transform Manager
 * Handles Blender-style modal transforms with keyboard input
 */
export class ModalTransformManager {
    constructor(options = {}) {
        this.scene = options.scene || null;
        this.camera = options.camera || null;
        this.renderer = options.renderer || null;
        this.selectionManager = options.selectionManager || null;
        this.transformControl = options.transformControl || null;
        this.controls = options.controls || null;  // OrbitControls
        
        // State
        this.state = {
            active: TransformMode.NONE,
            axis: AxisConstraint.NONE,
            plane: PlaneConstraint.NONE,
            numericInput: '',
            startPosition: null,
            startRotation: null,
            startScale: null,
            startMatrix: null,
            startMousePos: null,
            currentValue: 0,
            preview: null
        };
        
        // Visual helpers
        this.axisLine = null;
        this.statusElement = null;
        
        // Callbacks
        this.onModeChange = options.onModeChange || null;
        this.onTransformComplete = options.onTransformComplete || null;
        this.onTransformCancel = options.onTransformCancel || null;
        this.log = options.log || console.log;
        
        // Bound event handlers (for removal)
        this._boundKeyHandler = this._handleKeyDown.bind(this);
        this._boundMouseHandler = this._handleMouseMove.bind(this);
        this._boundClickHandler = this._handleClick.bind(this);
        
        // Mouse tracking
        this._mouse = new THREE.Vector2();
        this._raycaster = new THREE.Raycaster();
    }
    
    /**
     * Initialize the manager
     */
    init(scene, camera, renderer, selectionManager, transformControl, controls) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.selectionManager = selectionManager;
        this.transformControl = transformControl;
        this.controls = controls;
        
        // Create status element
        this._createStatusElement();
        
        // Create axis visualization helper
        this._createAxisHelper();
    }
    
    /**
     * Check if a modal transform is active
     */
    isActive() {
        return this.state.active !== TransformMode.NONE;
    }
    
    /**
     * Get current mode
     */
    getMode() {
        return this.state.active;
    }
    
    /**
     * Enter a transform mode
     */
    enterMode(mode) {
        const selected = this.selectionManager?.getSelected();
        if (!selected) {
            this.log('SELECT AN OBJECT FIRST', 'warn');
            return false;
        }
        
        // Cancel any existing transform
        if (this.isActive()) {
            this.cancel();
        }
        
        // Store starting state
        this.state.active = mode;
        this.state.axis = AxisConstraint.NONE;
        this.state.plane = PlaneConstraint.NONE;
        this.state.numericInput = '';
        this.state.currentValue = 0;
        this.state.startPosition = selected.position.clone();
        this.state.startRotation = selected.rotation.clone();
        this.state.startScale = selected.scale.clone();
        this.state.startMatrix = selected.matrix.clone();
        
        // Get initial mouse position for delta calculations
        this.state.startMousePos = this._mouse.clone();
        
        // Hide the regular transform control
        if (this.transformControl) {
            this.transformControl.visible = false;
            this.transformControl.detach();
        }
        
        // Disable orbit controls
        if (this.controls) {
            this.controls.enabled = false;
        }
        
        // Add event listeners
        document.addEventListener('keydown', this._boundKeyHandler);
        if (this.renderer?.domElement) {
            this.renderer.domElement.addEventListener('mousemove', this._boundMouseHandler);
            this.renderer.domElement.addEventListener('click', this._boundClickHandler);
            this.renderer.domElement.addEventListener('contextmenu', this._boundClickHandler);
        }
        
        // Update status
        this._updateStatus();
        
        const modeNames = {
            [TransformMode.GRAB]: 'GRAB',
            [TransformMode.ROTATE]: 'ROTATE',
            [TransformMode.SCALE]: 'SCALE'
        };
        
        this.log(`MODAL: ${modeNames[mode]} — X/Y/Z to lock axis, numbers for value, Enter to confirm`, 'info');
        
        if (this.onModeChange) {
            this.onModeChange(mode, this.state);
        }
        
        return true;
    }
    
    /**
     * Set axis constraint
     */
    setAxis(axis, isShiftHeld = false) {
        if (!this.isActive()) return;
        
        if (isShiftHeld) {
            // Shift+Axis = lock to plane (exclude that axis)
            const planeMap = {
                [AxisConstraint.X]: PlaneConstraint.YZ,
                [AxisConstraint.Y]: PlaneConstraint.XZ,
                [AxisConstraint.Z]: PlaneConstraint.XY
            };
            
            // Toggle plane if same one pressed again
            if (this.state.plane === planeMap[axis]) {
                this.state.plane = PlaneConstraint.NONE;
            } else {
                this.state.plane = planeMap[axis];
                this.state.axis = AxisConstraint.NONE;  // Clear axis constraint
            }
        } else {
            // Toggle axis if same one pressed again
            if (this.state.axis === axis) {
                this.state.axis = AxisConstraint.NONE;
            } else {
                this.state.axis = axis;
                this.state.plane = PlaneConstraint.NONE;  // Clear plane constraint
            }
        }
        
        this._updateAxisVisualization();
        this._updateStatus();
        this._applyTransform();
    }
    
    /**
     * Add numeric input
     */
    addNumericInput(char) {
        if (!this.isActive()) return;
        
        // Validate input
        if (char === '-') {
            // Toggle negative sign
            if (this.state.numericInput.startsWith('-')) {
                this.state.numericInput = this.state.numericInput.slice(1);
            } else {
                this.state.numericInput = '-' + this.state.numericInput;
            }
        } else if (char === '.') {
            // Only one decimal point allowed
            if (!this.state.numericInput.includes('.')) {
                this.state.numericInput += char;
            }
        } else if (/[0-9]/.test(char)) {
            this.state.numericInput += char;
        }
        
        // Parse the numeric value
        const value = parseFloat(this.state.numericInput) || 0;
        this.state.currentValue = value;
        
        this._updateStatus();
        this._applyTransform();
    }
    
    /**
     * Clear numeric input (Backspace)
     */
    clearNumericInput() {
        if (!this.isActive()) return;
        
        if (this.state.numericInput.length > 0) {
            this.state.numericInput = this.state.numericInput.slice(0, -1);
            this.state.currentValue = parseFloat(this.state.numericInput) || 0;
            this._updateStatus();
            this._applyTransform();
        }
    }
    
    /**
     * Confirm the transform
     */
    confirm() {
        if (!this.isActive()) return;
        
        const mode = this.state.active;
        const selected = this.selectionManager?.getSelected();
        
        // Clean up
        this._cleanup();
        
        this.log(`TRANSFORM CONFIRMED: ${mode.toUpperCase()}`, 'success');
        
        if (this.onTransformComplete && selected) {
            this.onTransformComplete(selected, {
                mode,
                axis: this.state.axis,
                plane: this.state.plane,
                value: this.state.currentValue,
                position: selected.position.clone(),
                rotation: selected.rotation.clone(),
                scale: selected.scale.clone()
            });
        }
        
        // Reset state after callback
        this._resetState();
    }
    
    /**
     * Cancel the transform and restore original state
     */
    cancel() {
        if (!this.isActive()) return;
        
        const selected = this.selectionManager?.getSelected();
        
        // Restore original transform
        if (selected) {
            selected.position.copy(this.state.startPosition);
            selected.rotation.copy(this.state.startRotation);
            selected.scale.copy(this.state.startScale);
        }
        
        // Clean up
        this._cleanup();
        
        this.log('TRANSFORM CANCELLED', 'warn');
        
        if (this.onTransformCancel) {
            this.onTransformCancel();
        }
        
        this._resetState();
    }
    
    /**
     * Handle key events during modal transform
     * @private
     */
    _handleKeyDown(e) {
        if (!this.isActive()) return;
        
        // Prevent default for all keys during modal transform
        e.preventDefault();
        e.stopPropagation();
        
        const key = e.key.toLowerCase();
        
        // Axis constraints
        if (key === 'x') {
            this.setAxis(AxisConstraint.X, e.shiftKey);
            return;
        }
        if (key === 'y') {
            this.setAxis(AxisConstraint.Y, e.shiftKey);
            return;
        }
        if (key === 'z') {
            this.setAxis(AxisConstraint.Z, e.shiftKey);
            return;
        }
        
        // Numeric input
        if (/[0-9]/.test(e.key)) {
            this.addNumericInput(e.key);
            return;
        }
        if (key === '-' || key === 'minus') {
            this.addNumericInput('-');
            return;
        }
        if (key === '.' || key === 'period') {
            this.addNumericInput('.');
            return;
        }
        
        // Backspace to clear numeric input
        if (key === 'backspace') {
            this.clearNumericInput();
            return;
        }
        
        // Confirm
        if (key === 'enter') {
            this.confirm();
            return;
        }
        
        // Cancel
        if (key === 'escape') {
            this.cancel();
            return;
        }
        
        // Mode switching while in transform (Blender allows this)
        if (key === 'g' && this.state.active !== TransformMode.GRAB) {
            this.cancel();
            this.enterMode(TransformMode.GRAB);
            return;
        }
        if (key === 'r' && this.state.active !== TransformMode.ROTATE) {
            this.cancel();
            this.enterMode(TransformMode.ROTATE);
            return;
        }
        if (key === 's' && this.state.active !== TransformMode.SCALE) {
            this.cancel();
            this.enterMode(TransformMode.SCALE);
            return;
        }
    }
    
    /**
     * Handle mouse movement for interactive transform
     * @private
     */
    _handleMouseMove(e) {
        if (!this.isActive()) return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Only apply mouse-based transform if no numeric input
        if (!this.state.numericInput) {
            this._applyMouseTransform();
        }
    }
    
    /**
     * Handle click events
     * @private
     */
    _handleClick(e) {
        if (!this.isActive()) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        if (e.button === 0) {
            // Left click = confirm
            this.confirm();
        } else if (e.button === 2) {
            // Right click = cancel
            this.cancel();
        }
    }
    
    /**
     * Apply transform based on current state
     * @private
     */
    _applyTransform() {
        const selected = this.selectionManager?.getSelected();
        if (!selected) return;
        
        // If numeric input exists, use that value
        if (this.state.numericInput && this.state.currentValue !== 0) {
            this._applyNumericTransform(selected, this.state.currentValue);
        }
    }
    
    /**
     * Apply mouse-based interactive transform
     * @private
     */
    _applyMouseTransform() {
        const selected = this.selectionManager?.getSelected();
        if (!selected || !this.state.startMousePos) return;
        
        // Calculate mouse delta
        const delta = new THREE.Vector2(
            this._mouse.x - this.state.startMousePos.x,
            this._mouse.y - this.state.startMousePos.y
        );
        
        // Sensitivity factors
        const moveSensitivity = 50;
        const rotateSensitivity = 2;
        const scaleSensitivity = 1;
        
        switch (this.state.active) {
            case TransformMode.GRAB:
                this._applyGrabMouse(selected, delta, moveSensitivity);
                break;
            case TransformMode.ROTATE:
                this._applyRotateMouse(selected, delta, rotateSensitivity);
                break;
            case TransformMode.SCALE:
                this._applyScaleMouse(selected, delta, scaleSensitivity);
                break;
        }
    }
    
    /**
     * Apply numeric transform value
     * @private
     */
    _applyNumericTransform(selected, value) {
        // Reset to start position first
        selected.position.copy(this.state.startPosition);
        selected.rotation.copy(this.state.startRotation);
        selected.scale.copy(this.state.startScale);
        
        switch (this.state.active) {
            case TransformMode.GRAB:
                this._applyGrabNumeric(selected, value);
                break;
            case TransformMode.ROTATE:
                this._applyRotateNumeric(selected, value);
                break;
            case TransformMode.SCALE:
                this._applyScaleNumeric(selected, value);
                break;
        }
    }
    
    /**
     * Apply grab (move) with mouse
     * @private
     */
    _applyGrabMouse(selected, delta, sensitivity) {
        // Reset to start
        selected.position.copy(this.state.startPosition);
        
        // Get camera-relative axes
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        this.camera.getWorldDirection(new THREE.Vector3());
        right.setFromMatrixColumn(this.camera.matrixWorld, 0);
        up.setFromMatrixColumn(this.camera.matrixWorld, 1);
        
        const moveX = delta.x * sensitivity;
        const moveY = delta.y * sensitivity;
        
        if (this.state.axis) {
            // Single axis constraint
            const axisVec = this._getAxisVector(this.state.axis);
            const screenDelta = Math.abs(delta.x) > Math.abs(delta.y) ? delta.x : -delta.y;
            selected.position.addScaledVector(axisVec, screenDelta * sensitivity);
        } else if (this.state.plane) {
            // Plane constraint
            this._applyPlaneMove(selected, delta, sensitivity);
        } else {
            // Free movement in screen space
            selected.position.addScaledVector(right, moveX);
            selected.position.addScaledVector(up, moveY);
        }
    }
    
    /**
     * Apply grab (move) with numeric value
     * @private
     */
    _applyGrabNumeric(selected, value) {
        if (this.state.axis) {
            // Move along single axis
            const axisVec = this._getAxisVector(this.state.axis);
            selected.position.addScaledVector(axisVec, value);
        } else if (this.state.plane) {
            // For plane constraint with numeric, move equally on both axes
            const axes = this.state.plane.split('');
            axes.forEach(axis => {
                const vec = this._getAxisVector(axis);
                selected.position.addScaledVector(vec, value / Math.sqrt(2));
            });
        } else {
            // No constraint - move in all axes equally
            selected.position.add(new THREE.Vector3(value, value, value));
        }
    }
    
    /**
     * Apply rotation with mouse
     * @private
     */
    _applyRotateMouse(selected, delta, sensitivity) {
        // Reset to start
        selected.rotation.copy(this.state.startRotation);
        
        const angle = (Math.abs(delta.x) > Math.abs(delta.y) ? delta.x : -delta.y) * sensitivity;
        
        if (this.state.axis) {
            // Rotate around single axis
            this._rotateAroundAxis(selected, this.state.axis, angle);
        } else if (this.state.plane) {
            // Rotate around the normal of the plane
            const normal = this._getPlaneNormal(this.state.plane);
            selected.rotateOnWorldAxis(normal, angle);
        } else {
            // Free rotation - use view direction
            const viewDir = new THREE.Vector3();
            this.camera.getWorldDirection(viewDir);
            selected.rotateOnWorldAxis(viewDir, angle);
        }
    }
    
    /**
     * Apply rotation with numeric value (degrees)
     * @private
     */
    _applyRotateNumeric(selected, value) {
        const radians = THREE.MathUtils.degToRad(value);
        
        if (this.state.axis) {
            this._rotateAroundAxis(selected, this.state.axis, radians);
        } else if (this.state.plane) {
            const normal = this._getPlaneNormal(this.state.plane);
            selected.rotateOnWorldAxis(normal, radians);
        } else {
            // Default: rotate around Y axis
            selected.rotateY(radians);
        }
    }
    
    /**
     * Apply scale with mouse
     * @private
     */
    _applyScaleMouse(selected, delta, sensitivity) {
        // Reset to start
        selected.scale.copy(this.state.startScale);
        
        const scaleFactor = 1 + (delta.x + delta.y) * sensitivity * 0.5;
        
        if (this.state.axis) {
            // Scale along single axis
            const axis = this.state.axis;
            selected.scale[axis] = this.state.startScale[axis] * scaleFactor;
        } else if (this.state.plane) {
            // Scale in plane (two axes)
            const axes = this.state.plane.split('');
            axes.forEach(axis => {
                selected.scale[axis] = this.state.startScale[axis] * scaleFactor;
            });
        } else {
            // Uniform scale
            selected.scale.multiplyScalar(scaleFactor);
        }
    }
    
    /**
     * Apply scale with numeric value
     * @private
     */
    _applyScaleNumeric(selected, value) {
        if (this.state.axis) {
            // Absolute scale on single axis
            selected.scale[this.state.axis] = value;
        } else if (this.state.plane) {
            // Scale both plane axes
            const axes = this.state.plane.split('');
            axes.forEach(axis => {
                selected.scale[axis] = value;
            });
        } else {
            // Uniform scale
            selected.scale.set(value, value, value);
        }
    }
    
    /**
     * Helper: Get unit vector for axis
     * @private
     */
    _getAxisVector(axis) {
        switch (axis) {
            case AxisConstraint.X: return new THREE.Vector3(1, 0, 0);
            case AxisConstraint.Y: return new THREE.Vector3(0, 1, 0);
            case AxisConstraint.Z: return new THREE.Vector3(0, 0, 1);
            default: return new THREE.Vector3(1, 0, 0);
        }
    }
    
    /**
     * Helper: Get plane normal vector
     * @private
     */
    _getPlaneNormal(plane) {
        switch (plane) {
            case PlaneConstraint.XY: return new THREE.Vector3(0, 0, 1);
            case PlaneConstraint.XZ: return new THREE.Vector3(0, 1, 0);
            case PlaneConstraint.YZ: return new THREE.Vector3(1, 0, 0);
            default: return new THREE.Vector3(0, 1, 0);
        }
    }
    
    /**
     * Helper: Apply plane-constrained movement
     * @private
     */
    _applyPlaneMove(selected, delta, sensitivity) {
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        right.setFromMatrixColumn(this.camera.matrixWorld, 0);
        up.setFromMatrixColumn(this.camera.matrixWorld, 1);
        
        const moveX = delta.x * sensitivity;
        const moveY = delta.y * sensitivity;
        
        // Project movement onto the plane
        const excludedAxis = this._getPlaneNormal(this.state.plane);
        const movement = new THREE.Vector3()
            .addScaledVector(right, moveX)
            .addScaledVector(up, moveY);
        
        // Remove component along excluded axis
        movement.sub(excludedAxis.clone().multiplyScalar(movement.dot(excludedAxis)));
        
        selected.position.add(movement);
    }
    
    /**
     * Helper: Rotate object around world axis
     * @private
     */
    _rotateAroundAxis(object, axis, angle) {
        const axisVec = this._getAxisVector(axis);
        object.rotateOnWorldAxis(axisVec, angle);
    }
    
    /**
     * Create the status display element
     * @private
     */
    _createStatusElement() {
        this.statusElement = document.createElement('div');
        this.statusElement.id = 'modal-transform-status';
        this.statusElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(10, 10, 12, 0.95);
            border: 1px solid #e8b13f;
            padding: 12px 24px;
            font-family: monospace;
            font-size: 14px;
            color: #e8b13f;
            z-index: 10000;
            pointer-events: none;
            display: none;
            text-align: center;
            min-width: 200px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;
        document.body.appendChild(this.statusElement);
    }
    
    /**
     * Create axis visualization helper
     * @private
     */
    _createAxisHelper() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6);  // 2 points
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.8
        });
        
        this.axisLine = new THREE.Line(geometry, material);
        this.axisLine.renderOrder = 999;
        this.axisLine.visible = false;
        
        if (this.scene) {
            this.scene.add(this.axisLine);
        }
    }
    
    /**
     * Update status display
     * @private
     */
    _updateStatus() {
        if (!this.statusElement) return;
        
        if (!this.isActive()) {
            this.statusElement.style.display = 'none';
            return;
        }
        
        const modeNames = {
            [TransformMode.GRAB]: 'GRAB',
            [TransformMode.ROTATE]: 'ROTATE',
            [TransformMode.SCALE]: 'SCALE'
        };
        
        let statusText = `<div style="font-size: 18px; margin-bottom: 8px;">${modeNames[this.state.active]}</div>`;
        
        // Constraint info
        if (this.state.axis) {
            const axisColors = { x: '#ff4444', y: '#44ff44', z: '#4444ff' };
            statusText += `<div style="color: ${axisColors[this.state.axis]}">AXIS: ${this.state.axis.toUpperCase()}</div>`;
        } else if (this.state.plane) {
            statusText += `<div style="color: #88aaff">PLANE: ${this.state.plane.toUpperCase()}</div>`;
        }
        
        // Numeric value
        if (this.state.numericInput) {
            const units = this.state.active === TransformMode.ROTATE ? '°' : 
                          this.state.active === TransformMode.SCALE ? '×' : 'mm';
            statusText += `<div style="font-size: 24px; margin-top: 8px;">${this.state.numericInput}${units}</div>`;
        }
        
        // Help text
        statusText += `<div style="font-size: 10px; margin-top: 8px; color: #666;">X/Y/Z: axis | Enter: confirm | Esc: cancel</div>`;
        
        this.statusElement.innerHTML = statusText;
        this.statusElement.style.display = 'block';
    }
    
    /**
     * Update axis visualization line
     * @private
     */
    _updateAxisVisualization() {
        if (!this.axisLine || !this.selectionManager) return;
        
        const selected = this.selectionManager.getSelected();
        if (!selected) {
            this.axisLine.visible = false;
            return;
        }
        
        if (this.state.axis) {
            const center = selected.position.clone();
            const axisVec = this._getAxisVector(this.state.axis);
            const length = 100;
            
            const positions = this.axisLine.geometry.attributes.position.array;
            positions[0] = center.x - axisVec.x * length;
            positions[1] = center.y - axisVec.y * length;
            positions[2] = center.z - axisVec.z * length;
            positions[3] = center.x + axisVec.x * length;
            positions[4] = center.y + axisVec.y * length;
            positions[5] = center.z + axisVec.z * length;
            
            this.axisLine.geometry.attributes.position.needsUpdate = true;
            this.axisLine.material.color.setHex(AXIS_COLORS[this.state.axis]);
            this.axisLine.visible = true;
        } else {
            this.axisLine.visible = false;
        }
    }
    
    /**
     * Clean up event listeners and visual elements
     * @private
     */
    _cleanup() {
        // Remove event listeners
        document.removeEventListener('keydown', this._boundKeyHandler);
        if (this.renderer?.domElement) {
            this.renderer.domElement.removeEventListener('mousemove', this._boundMouseHandler);
            this.renderer.domElement.removeEventListener('click', this._boundClickHandler);
            this.renderer.domElement.removeEventListener('contextmenu', this._boundClickHandler);
        }
        
        // Hide status
        if (this.statusElement) {
            this.statusElement.style.display = 'none';
        }
        
        // Hide axis line
        if (this.axisLine) {
            this.axisLine.visible = false;
        }
        
        // Re-enable orbit controls
        if (this.controls) {
            this.controls.enabled = true;
        }
        
        // Re-attach transform control
        const selected = this.selectionManager?.getSelected();
        if (this.transformControl && selected) {
            this.transformControl.attach(selected);
            this.transformControl.visible = true;
        }
    }
    
    /**
     * Reset state to default
     * @private
     */
    _resetState() {
        this.state = {
            active: TransformMode.NONE,
            axis: AxisConstraint.NONE,
            plane: PlaneConstraint.NONE,
            numericInput: '',
            startPosition: null,
            startRotation: null,
            startScale: null,
            startMatrix: null,
            startMousePos: null,
            currentValue: 0,
            preview: null
        };
    }
    
    /**
     * Process a keydown event (called externally from main app)
     * Returns true if the event was handled
     */
    handleKeyDown(e) {
        // Check if we should enter a modal mode
        if (!this.isActive()) {
            const key = e.key.toLowerCase();
            
            // Only handle G/R/S if an object is selected and not in input
            const inInput = document.activeElement?.tagName === 'INPUT' || 
                           document.activeElement?.tagName === 'TEXTAREA' ||
                           document.activeElement?.isContentEditable;
            
            if (inInput) return false;
            
            const selected = this.selectionManager?.getSelected();
            if (!selected) return false;
            
            if (key === 'g' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.enterMode(TransformMode.GRAB);
                return true;
            }
            // Note: 'r' is also used for rectangle in sketch mode, so check context
            // 's' conflicts with select/spline in some modes
            // For now, require object selection for these to work
        }
        
        return false;
    }
    
    /**
     * Dispose of all resources
     */
    dispose() {
        this._cleanup();
        
        if (this.statusElement && this.statusElement.parentNode) {
            this.statusElement.parentNode.removeChild(this.statusElement);
        }
        
        if (this.axisLine && this.scene) {
            this.scene.remove(this.axisLine);
            this.axisLine.geometry.dispose();
            this.axisLine.material.dispose();
        }
    }
}

// Export singleton instance
export const modalTransform = new ModalTransformManager();
