/**
 * Ameri-CAD Camera Presets
 *
 * Standard engineering views with orthographic support.
 * Keyboard shortcuts follow Blender numpad conventions.
 *
 * Views:
 *   Numpad 1 - Front (+Y looking at -Y)
 *   Numpad 3 - Right (+X looking at -X)
 *   Numpad 7 - Top (+Z looking at -Z)
 *   Ctrl+1   - Back (-Y looking at +Y)
 *   Ctrl+3   - Left (-X looking at +X)
 *   Ctrl+7   - Bottom (-Z looking at +Z)
 *   Numpad 5 - Toggle ortho/perspective
 *   Numpad 0 - Reset to default perspective
 */

/**
 * Camera preset definitions
 * Position is the direction from target (will be scaled by distance)
 * Up vector defines the camera orientation
 */
export const CameraPresets = {
  front: {
    position: [0, 1, 0],
    up: [0, 0, 1],
    ortho: true,
    label: 'FRONT',
    axis: 'Y',
  },
  back: {
    position: [0, -1, 0],
    up: [0, 0, 1],
    ortho: true,
    label: 'BACK',
    axis: '-Y',
  },
  right: {
    position: [1, 0, 0],
    up: [0, 0, 1],
    ortho: true,
    label: 'RIGHT',
    axis: 'X',
  },
  left: {
    position: [-1, 0, 0],
    up: [0, 0, 1],
    ortho: true,
    label: 'LEFT',
    axis: '-X',
  },
  top: {
    position: [0, 0, 1],
    up: [0, 1, 0],
    ortho: true,
    label: 'TOP',
    axis: 'Z',
  },
  bottom: {
    position: [0, 0, -1],
    up: [0, -1, 0],
    ortho: true,
    label: 'BOTTOM',
    axis: '-Z',
  },
  iso: {
    position: [1, 1, 1],
    up: [0, 0, 1],
    ortho: false,
    label: 'ISO',
    axis: null,
  },
};

/**
 * Default view settings
 */
export const DEFAULT_VIEW = {
  preset: 'iso',
  distance: 100,
  ortho: false,
};

/**
 * CameraPresetManager - Manages camera view presets and orthographic toggle
 */
export class CameraPresetManager {
  /**
   * @param {Object} options
   * @param {THREE} options.THREE - Three.js library reference
   * @param {THREE.Camera} options.camera - Current camera (perspective or orthographic)
   * @param {OrbitControls} options.controls - OrbitControls instance
   * @param {Function} options.onViewChange - Callback when view changes
   */
  constructor(options = {}) {
    this.THREE = options.THREE;
    this.perspectiveCamera = options.camera;
    this.orthographicCamera = null;
    this.controls = options.controls;
    this.onViewChange = options.onViewChange || (() => {});

    // Current state
    this.currentView = 'iso';
    this.isOrtho = false;
    this.savedPerspectiveState = null;

    // Animation
    this.animationDuration = 300; // ms
    this.animating = false;

    // UI indicator element
    this.indicator = null;

    // Create orthographic camera if THREE is available
    if (this.THREE && this.perspectiveCamera) {
      this._createOrthographicCamera();
    }
  }

  /**
   * Initialize with Three.js context
   */
  init(THREE, camera, controls) {
    this.THREE = THREE;
    this.perspectiveCamera = camera;
    this.controls = controls;
    this._createOrthographicCamera();
  }

  /**
   * Create the orthographic camera matching perspective camera's view
   */
  _createOrthographicCamera() {
    if (!this.THREE || !this.perspectiveCamera) return;

    const aspect = this.perspectiveCamera.aspect || 1;
    const frustumSize = 100;

    this.orthographicCamera = new this.THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      2000
    );

    this.orthographicCamera.userData.frustumSize = frustumSize;

    // Copy current position
    this.orthographicCamera.position.copy(this.perspectiveCamera.position);
    this.orthographicCamera.up.copy(this.perspectiveCamera.up);
    this.orthographicCamera.quaternion.copy(this.perspectiveCamera.quaternion);
  }

  /**
   * Get the currently active camera
   */
  getActiveCamera() {
    return this.isOrtho ? this.orthographicCamera : this.perspectiveCamera;
  }

  /**
   * Set the view to a preset
   * @param {string} presetName - Name of preset (front, back, top, etc.)
   * @param {boolean} animate - Whether to animate the transition
   * @returns {boolean} Success
   */
  setView(presetName, animate = true) {
    const preset = CameraPresets[presetName];
    if (!preset) {
      console.warn(`[CameraPresets] Unknown preset: ${presetName}`);
      return false;
    }

    const camera = this.getActiveCamera();
    if (!camera || !this.controls) return false;

    // Get current distance from target
    const target = this.controls.target.clone();
    const currentDistance = camera.position.distanceTo(target) || DEFAULT_VIEW.distance;

    // Calculate new position
    const direction = new this.THREE.Vector3(...preset.position).normalize();
    const newPosition = direction.clone().multiplyScalar(currentDistance).add(target);
    const newUp = new this.THREE.Vector3(...preset.up);

    if (animate && this.animationDuration > 0) {
      this._animateToView(camera, newPosition, newUp, target, () => {
        this.currentView = presetName;

        // Switch to ortho if preset requires it
        if (preset.ortho && !this.isOrtho) {
          this.toggleOrtho(false);
        }

        this._updateIndicator();
        this.onViewChange(presetName, this.isOrtho);
      });
    } else {
      camera.position.copy(newPosition);
      camera.up.copy(newUp);
      camera.lookAt(target);
      this.controls.update();

      this.currentView = presetName;

      // Switch to ortho if preset requires it
      if (preset.ortho && !this.isOrtho) {
        this.toggleOrtho(false);
      }

      this._updateIndicator();
      this.onViewChange(presetName, this.isOrtho);
    }

    return true;
  }

  /**
   * Animate camera transition
   */
  _animateToView(camera, targetPos, targetUp, lookAtTarget, onComplete) {
    if (this.animating) return;
    this.animating = true;

    const startPos = camera.position.clone();
    const startUp = camera.up.clone();
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / this.animationDuration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);

      camera.position.lerpVectors(startPos, targetPos, eased);
      camera.up.lerpVectors(startUp, targetUp, eased).normalize();
      camera.lookAt(lookAtTarget);

      if (this.controls) {
        this.controls.update();
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.animating = false;
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Toggle between orthographic and perspective projection
   * @param {boolean} animate - Whether to animate (default false for toggle)
   */
  toggleOrtho(_animate = false) {
    if (!this.perspectiveCamera || !this.orthographicCamera) {
      console.warn('[CameraPresets] Cameras not initialized');
      return;
    }

    const oldCamera = this.getActiveCamera();
    this.isOrtho = !this.isOrtho;
    const newCamera = this.getActiveCamera();

    // Sync camera state
    newCamera.position.copy(oldCamera.position);
    newCamera.up.copy(oldCamera.up);
    newCamera.quaternion.copy(oldCamera.quaternion);

    // Update orthographic frustum based on distance
    if (this.isOrtho) {
      this._updateOrthoFrustum();
    }

    // Update controls to use new camera
    if (this.controls) {
      this.controls.object = newCamera;
      this.controls.update();
    }

    this._updateIndicator();
    this.onViewChange(this.currentView, this.isOrtho);

    return this.isOrtho;
  }

  /**
   * Update orthographic frustum size based on camera distance
   */
  _updateOrthoFrustum() {
    if (!this.orthographicCamera || !this.controls) return;

    const distance = this.orthographicCamera.position.distanceTo(this.controls.target);
    const frustumSize = distance * 0.5; // Scale factor for ortho view
    const aspect = this.perspectiveCamera?.aspect || 1;

    this.orthographicCamera.left = (-frustumSize * aspect) / 2;
    this.orthographicCamera.right = (frustumSize * aspect) / 2;
    this.orthographicCamera.top = frustumSize / 2;
    this.orthographicCamera.bottom = -frustumSize / 2;
    this.orthographicCamera.updateProjectionMatrix();
    this.orthographicCamera.userData.frustumSize = frustumSize;
  }

  /**
   * Reset to default perspective view
   */
  reset() {
    // Switch to perspective if in ortho
    if (this.isOrtho) {
      this.isOrtho = false;
      if (this.controls) {
        this.controls.object = this.perspectiveCamera;
      }
    }

    // Reset to isometric view
    this.setView('iso', true);
  }

  /**
   * Handle resize
   */
  resize(width, height) {
    const aspect = width / height;

    if (this.perspectiveCamera) {
      this.perspectiveCamera.aspect = aspect;
      this.perspectiveCamera.updateProjectionMatrix();
    }

    if (this.orthographicCamera) {
      const frustumSize = this.orthographicCamera.userData.frustumSize || 100;
      this.orthographicCamera.left = (-frustumSize * aspect) / 2;
      this.orthographicCamera.right = (frustumSize * aspect) / 2;
      this.orthographicCamera.updateProjectionMatrix();
    }
  }

  /**
   * Create and attach the view indicator UI element
   * @param {HTMLElement} container - Container to append indicator to
   */
  createIndicator(container) {
    if (this.indicator) {
      this.indicator.remove();
    }

    this.indicator = document.createElement('div');
    this.indicator.className = 'view-indicator';
    this.indicator.id = 'view-indicator';
    this._updateIndicator();

    if (container) {
      container.appendChild(this.indicator);
    }

    // Add styles if not present
    this._addIndicatorStyles();

    return this.indicator;
  }

  /**
   * Update the view indicator display
   */
  _updateIndicator() {
    if (!this.indicator) return;

    const preset = CameraPresets[this.currentView];
    const viewName = preset?.label || this.currentView.toUpperCase();
    const orthoText = this.isOrtho ? ' (Ortho)' : ' (Persp)';

    this.indicator.textContent = viewName + orthoText;
    this.indicator.dataset.view = this.currentView;
    this.indicator.dataset.ortho = this.isOrtho;
  }

  /**
   * Add CSS styles for the indicator
   */
  _addIndicatorStyles() {
    if (document.getElementById('view-indicator-styles')) return;

    const style = document.createElement('style');
    style.id = 'view-indicator-styles';
    style.textContent = `
            .view-indicator {
                position: absolute;
                top: 12px;
                right: 12px;
                background: rgba(26, 26, 31, 0.9);
                color: #e8b13f;
                font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
                font-size: 11px;
                font-weight: bold;
                padding: 6px 12px;
                border-radius: 3px;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                pointer-events: none;
                border: 1px solid #35353a;
                z-index: 100;
                transition: background 0.2s, border-color 0.2s;
            }
            
            .view-indicator[data-ortho="true"] {
                background: rgba(232, 177, 63, 0.15);
                border-color: #e8b13f;
            }
        `;
    document.head.appendChild(style);
  }

  /**
   * Get current view state
   */
  getState() {
    return {
      view: this.currentView,
      isOrtho: this.isOrtho,
      camera: this.getActiveCamera(),
    };
  }

  /**
   * Dispose of resources
   */
  dispose() {
    if (this.indicator) {
      this.indicator.remove();
      this.indicator = null;
    }

    if (this.orthographicCamera) {
      this.orthographicCamera = null;
    }
  }
}

/**
 * Keyboard shortcut handler for camera presets
 * Follows Blender numpad conventions
 *
 * @param {KeyboardEvent} e - Keyboard event
 * @param {CameraPresetManager} manager - Camera preset manager instance
 * @returns {boolean} Whether the event was handled
 */
export function handleViewShortcut(e, manager) {
  if (!manager) return false;

  // Ignore if typing in an input
  if (
    e.target.tagName === 'INPUT' ||
    e.target.tagName === 'TEXTAREA' ||
    e.target.isContentEditable
  ) {
    return false;
  }

  const code = e.code;
  const ctrl = e.ctrlKey || e.metaKey;

  // Numpad shortcuts
  switch (code) {
    case 'Numpad1':
      e.preventDefault();
      manager.setView(ctrl ? 'back' : 'front');
      return true;

    case 'Numpad3':
      e.preventDefault();
      manager.setView(ctrl ? 'left' : 'right');
      return true;

    case 'Numpad7':
      e.preventDefault();
      manager.setView(ctrl ? 'bottom' : 'top');
      return true;

    case 'Numpad5':
      e.preventDefault();
      manager.toggleOrtho();
      return true;

    case 'Numpad0':
      e.preventDefault();
      manager.reset();
      return true;
  }

  // Also handle regular number keys with numlock off or on laptops
  // Only if Shift is not held (to avoid interfering with other shortcuts)
  if (!e.shiftKey && !e.altKey) {
    switch (e.key) {
      case '1':
        if (ctrl) {
          e.preventDefault();
          manager.setView('back');
          return true;
        }
        break;
      case '3':
        if (ctrl) {
          e.preventDefault();
          manager.setView('left');
          return true;
        }
        break;
      case '7':
        if (ctrl) {
          e.preventDefault();
          manager.setView('bottom');
          return true;
        }
        break;
    }
  }

  return false;
}

/**
 * Register view commands with the command system
 * @param {Function} registerCommand - Command registration function
 */
export function registerViewCommands(registerCommand) {
  // VIEW command
  registerCommand('view', {
    aliases: ['v'],
    description: 'Set camera view (front/back/left/right/top/bottom/iso) or toggle ortho',
    category: 'view',
    params: [
      {
        name: 'preset',
        type: 'string',
        required: true,
        description: 'View preset: front, back, left, right, top, bottom, iso, ortho, reset',
      },
    ],
    execute(params, context) {
      const manager = context.cameraPresets;
      if (!manager) {
        return 'Camera preset manager not available';
      }

      const preset = params.preset.toLowerCase();

      if (preset === 'ortho' || preset === 'toggle') {
        const isOrtho = manager.toggleOrtho();
        return `Projection: ${isOrtho ? 'ORTHOGRAPHIC' : 'PERSPECTIVE'}`;
      }

      if (preset === 'reset') {
        manager.reset();
        return 'View reset to default';
      }

      if (CameraPresets[preset]) {
        manager.setView(preset);
        const viewLabel = CameraPresets[preset].label;
        return `View: ${viewLabel}`;
      }

      const validViews = Object.keys(CameraPresets).join(', ');
      return `Unknown view: ${preset}. Valid views: ${validViews}, ortho, reset`;
    },
  });
}

export default CameraPresetManager;
