/**
 * Camera Presets Tests
 *
 * Tests for orthographic view presets and keyboard shortcuts.
 */

import {
  CameraPresetManager,
  CameraPresets,
  handleViewShortcut,
  DEFAULT_VIEW,
} from '../src/ui/camera-presets.js';

// Mock Three.js objects for testing
const mockTHREE = {
  Vector3: class {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    copy(v) {
      this.x = v.x;
      this.y = v.y;
      this.z = v.z;
      return this;
    }
    clone() {
      return new mockTHREE.Vector3(this.x, this.y, this.z);
    }
    normalize() {
      const len = Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
      if (len > 0) {
        this.x /= len;
        this.y /= len;
        this.z /= len;
      }
      return this;
    }
    multiplyScalar(s) {
      this.x *= s;
      this.y *= s;
      this.z *= s;
      return this;
    }
    add(v) {
      this.x += v.x;
      this.y += v.y;
      this.z += v.z;
      return this;
    }
    distanceTo(v) {
      return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2);
    }
    lerpVectors(a, b, t) {
      this.x = a.x + (b.x - a.x) * t;
      this.y = a.y + (b.y - a.y) * t;
      this.z = a.z + (b.z - a.z) * t;
      return this;
    }
  },
  Quaternion: class {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      this.w = 1;
    }
    copy(q) {
      this.x = q.x;
      this.y = q.y;
      this.z = q.z;
      this.w = q.w;
      return this;
    }
    clone() {
      const q = new mockTHREE.Quaternion();
      q.copy(this);
      return q;
    }
  },
  OrthographicCamera: class {
    constructor(left, right, top, bottom, near, far) {
      this.left = left;
      this.right = right;
      this.top = top;
      this.bottom = bottom;
      this.near = near;
      this.far = far;
      this.position = new mockTHREE.Vector3(0, 0, 100);
      this.up = new mockTHREE.Vector3(0, 1, 0);
      this.quaternion = new mockTHREE.Quaternion();
      this.userData = {};
      this.isOrthographicCamera = true;
      this.aspect = 1;
    }
    lookAt() {}
    updateProjectionMatrix() {}
  },
  PerspectiveCamera: class {
    constructor(fov, aspect, near, far) {
      this.fov = fov;
      this.aspect = aspect || 1;
      this.near = near;
      this.far = far;
      this.position = new mockTHREE.Vector3(50, 50, 50);
      this.up = new mockTHREE.Vector3(0, 1, 0);
      this.quaternion = new mockTHREE.Quaternion();
      this.isPerspectiveCamera = true;
    }
    lookAt() {}
    updateProjectionMatrix() {}
  },
};

function createMockControls() {
  return {
    target: new mockTHREE.Vector3(0, 0, 0),
    object: null,
    update: function () {},
  };
}

function createMockKeyEvent(code, key, ctrlKey = false) {
  return {
    code,
    key,
    ctrlKey,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: function () {
      this._defaultPrevented = true;
    },
    _defaultPrevented: false,
    target: { tagName: 'BODY' },
  };
}

// Test Results Tracking
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${e.message}`);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`${message} Expected truthy value, got ${value}`);
  }
}

function assertFalse(value, message = '') {
  if (value) {
    throw new Error(`${message} Expected falsy value, got ${value}`);
  }
}

function assertDefined(value, message = '') {
  if (value === undefined || value === null) {
    throw new Error(`${message} Expected defined value, got ${value}`);
  }
}

function describe(suiteName, fn) {
  console.log(`\n${suiteName}`);
  fn();
}

// ============================================
// Test Suites
// ============================================

describe('CameraPresets', () => {
  describe('Preset Definitions', () => {
    test('should have all required presets', () => {
      assertDefined(CameraPresets.front);
      assertDefined(CameraPresets.back);
      assertDefined(CameraPresets.left);
      assertDefined(CameraPresets.right);
      assertDefined(CameraPresets.top);
      assertDefined(CameraPresets.bottom);
      assertDefined(CameraPresets.iso);
    });

    test('should have correct position for front view', () => {
      const { position, up, ortho } = CameraPresets.front;
      assertDeepEqual(position, [0, 1, 0]);
      assertDeepEqual(up, [0, 0, 1]);
      assertEqual(ortho, true);
    });

    test('should have correct position for back view', () => {
      const { position, up, ortho } = CameraPresets.back;
      assertDeepEqual(position, [0, -1, 0]);
      assertDeepEqual(up, [0, 0, 1]);
      assertEqual(ortho, true);
    });

    test('should have correct position for right view', () => {
      const { position, up, ortho } = CameraPresets.right;
      assertDeepEqual(position, [1, 0, 0]);
      assertDeepEqual(up, [0, 0, 1]);
      assertEqual(ortho, true);
    });

    test('should have correct position for left view', () => {
      const { position, up, ortho } = CameraPresets.left;
      assertDeepEqual(position, [-1, 0, 0]);
      assertDeepEqual(up, [0, 0, 1]);
      assertEqual(ortho, true);
    });

    test('should have correct position for top view', () => {
      const { position, up, ortho } = CameraPresets.top;
      assertDeepEqual(position, [0, 0, 1]);
      assertDeepEqual(up, [0, 1, 0]);
      assertEqual(ortho, true);
    });

    test('should have correct position for bottom view', () => {
      const { position, up, ortho } = CameraPresets.bottom;
      assertDeepEqual(position, [0, 0, -1]);
      assertDeepEqual(up, [0, -1, 0]);
      assertEqual(ortho, true);
    });

    test('should have correct position for iso view', () => {
      const { position, up, ortho } = CameraPresets.iso;
      assertDeepEqual(position, [1, 1, 1]);
      assertDeepEqual(up, [0, 0, 1]);
      assertEqual(ortho, false);
    });

    test('should have labels for all presets', () => {
      Object.values(CameraPresets).forEach(preset => {
        assertDefined(preset.label);
        assertEqual(typeof preset.label, 'string');
      });
    });
  });

  describe('DEFAULT_VIEW', () => {
    test('should have default view settings', () => {
      assertEqual(DEFAULT_VIEW.preset, 'iso');
      assertEqual(DEFAULT_VIEW.distance, 100);
      assertEqual(DEFAULT_VIEW.ortho, false);
    });
  });
});

describe('CameraPresetManager', () => {
  let camera;
  let controls;
  let manager;

  function setup() {
    camera = new mockTHREE.PerspectiveCamera(45, 1, 0.1, 1000);
    controls = createMockControls();
    manager = new CameraPresetManager({
      THREE: mockTHREE,
      camera,
      controls,
      onViewChange: function () {},
    });
  }

  describe('Initialization', () => {
    test('should initialize with default state', () => {
      setup();
      assertEqual(manager.currentView, 'iso');
      assertEqual(manager.isOrtho, false);
    });

    test('should create orthographic camera', () => {
      setup();
      assertDefined(manager.orthographicCamera);
      assertTrue(manager.orthographicCamera.isOrthographicCamera);
    });

    test('should return perspective camera as active by default', () => {
      setup();
      assertEqual(manager.getActiveCamera(), manager.perspectiveCamera);
    });
  });

  describe('setView', () => {
    test('should change to front view', () => {
      setup();
      const result = manager.setView('front', false);
      assertTrue(result);
      assertEqual(manager.currentView, 'front');
    });

    test('should change to back view', () => {
      setup();
      const result = manager.setView('back', false);
      assertTrue(result);
      assertEqual(manager.currentView, 'back');
    });

    test('should change to top view', () => {
      setup();
      const result = manager.setView('top', false);
      assertTrue(result);
      assertEqual(manager.currentView, 'top');
    });

    test('should change to bottom view', () => {
      setup();
      const result = manager.setView('bottom', false);
      assertTrue(result);
      assertEqual(manager.currentView, 'bottom');
    });

    test('should change to right view', () => {
      setup();
      const result = manager.setView('right', false);
      assertTrue(result);
      assertEqual(manager.currentView, 'right');
    });

    test('should change to left view', () => {
      setup();
      const result = manager.setView('left', false);
      assertTrue(result);
      assertEqual(manager.currentView, 'left');
    });

    test('should change to iso view', () => {
      setup();
      manager.setView('front', false);
      const result = manager.setView('iso', false);
      assertTrue(result);
      assertEqual(manager.currentView, 'iso');
    });

    test('should return false for unknown preset', () => {
      setup();
      const result = manager.setView('unknown', false);
      assertFalse(result);
    });

    test('should call onViewChange callback', () => {
      setup();
      let called = false;
      let calledView = null;
      manager.onViewChange = function (view) {
        called = true;
        calledView = view;
      };
      manager.setView('front', false);
      assertTrue(called);
      assertEqual(calledView, 'front');
    });
  });

  describe('toggleOrtho', () => {
    test('should toggle to orthographic', () => {
      setup();
      assertFalse(manager.isOrtho);
      manager.toggleOrtho();
      assertTrue(manager.isOrtho);
    });

    test('should toggle back to perspective', () => {
      setup();
      manager.toggleOrtho();
      assertTrue(manager.isOrtho);
      manager.toggleOrtho();
      assertFalse(manager.isOrtho);
    });

    test('should return new ortho state', () => {
      setup();
      const result1 = manager.toggleOrtho();
      assertTrue(result1);
      const result2 = manager.toggleOrtho();
      assertFalse(result2);
    });

    test('should update controls object', () => {
      setup();
      manager.toggleOrtho();
      assertEqual(controls.object, manager.orthographicCamera);
    });
  });

  describe('getActiveCamera', () => {
    test('should return perspective camera when not ortho', () => {
      setup();
      assertEqual(manager.getActiveCamera(), manager.perspectiveCamera);
    });

    test('should return orthographic camera when ortho', () => {
      setup();
      manager.toggleOrtho();
      assertEqual(manager.getActiveCamera(), manager.orthographicCamera);
    });
  });

  describe('reset', () => {
    test('should reset to iso view', () => {
      setup();
      manager.setView('front', false);
      manager.toggleOrtho();
      manager.reset();
      assertEqual(manager.currentView, 'iso');
    });

    test('should reset to perspective mode', () => {
      setup();
      manager.toggleOrtho();
      manager.reset();
      assertFalse(manager.isOrtho);
    });
  });

  describe('getState', () => {
    test('should return current state', () => {
      setup();
      manager.setView('top', false);
      manager.toggleOrtho();

      const state = manager.getState();
      assertEqual(state.view, 'top');
      assertTrue(state.isOrtho);
      assertEqual(state.camera, manager.orthographicCamera);
    });
  });

  describe('resize', () => {
    test('should update perspective camera aspect', () => {
      setup();
      manager.resize(800, 600);
      const expectedAspect = 800 / 600;
      assertTrue(Math.abs(manager.perspectiveCamera.aspect - expectedAspect) < 0.01);
    });
  });

  describe('createIndicator', () => {
    test('should create indicator element', () => {
      setup();
      const container = document.createElement('div');
      const indicator = manager.createIndicator(container);

      assertDefined(indicator);
      assertEqual(indicator.className, 'view-indicator');
      assertTrue(container.contains(indicator));
    });

    test('should update indicator text', () => {
      setup();
      const container = document.createElement('div');
      manager.createIndicator(container);

      assertTrue(manager.indicator.textContent.includes('ISO'));
    });
  });

  describe('dispose', () => {
    test('should remove indicator', () => {
      setup();
      const container = document.createElement('div');
      manager.createIndicator(container);

      manager.dispose();
      assertEqual(manager.indicator, null);
    });

    test('should clean up orthographic camera', () => {
      setup();
      manager.dispose();
      assertEqual(manager.orthographicCamera, null);
    });
  });
});

describe('handleViewShortcut', () => {
  let camera;
  let controls;
  let manager;

  function setup() {
    camera = new mockTHREE.PerspectiveCamera(45, 1, 0.1, 1000);
    controls = createMockControls();
    manager = new CameraPresetManager({
      THREE: mockTHREE,
      camera,
      controls,
      onViewChange: function () {},
    });
  }

  describe('Numpad shortcuts', () => {
    test('should handle Numpad1 for front view', () => {
      setup();
      const event = createMockKeyEvent('Numpad1', '1');
      const result = handleViewShortcut(event, manager);

      assertTrue(result);
      assertTrue(event._defaultPrevented);
      assertEqual(manager.currentView, 'front');
    });

    test('should handle Ctrl+Numpad1 for back view', () => {
      setup();
      const event = createMockKeyEvent('Numpad1', '1', true);
      const result = handleViewShortcut(event, manager);

      assertTrue(result);
      assertEqual(manager.currentView, 'back');
    });

    test('should handle Numpad3 for right view', () => {
      setup();
      const event = createMockKeyEvent('Numpad3', '3');
      const result = handleViewShortcut(event, manager);

      assertTrue(result);
      assertEqual(manager.currentView, 'right');
    });

    test('should handle Ctrl+Numpad3 for left view', () => {
      setup();
      const event = createMockKeyEvent('Numpad3', '3', true);
      const result = handleViewShortcut(event, manager);

      assertTrue(result);
      assertEqual(manager.currentView, 'left');
    });

    test('should handle Numpad7 for top view', () => {
      setup();
      const event = createMockKeyEvent('Numpad7', '7');
      const result = handleViewShortcut(event, manager);

      assertTrue(result);
      assertEqual(manager.currentView, 'top');
    });

    test('should handle Ctrl+Numpad7 for bottom view', () => {
      setup();
      const event = createMockKeyEvent('Numpad7', '7', true);
      const result = handleViewShortcut(event, manager);

      assertTrue(result);
      assertEqual(manager.currentView, 'bottom');
    });

    test('should handle Numpad5 for ortho toggle', () => {
      setup();
      const event = createMockKeyEvent('Numpad5', '5');
      const result = handleViewShortcut(event, manager);

      assertTrue(result);
      assertTrue(manager.isOrtho);
    });

    test('should handle Numpad0 for reset', () => {
      setup();
      manager.setView('front', false);
      manager.toggleOrtho();

      const event = createMockKeyEvent('Numpad0', '0');
      const result = handleViewShortcut(event, manager);

      assertTrue(result);
      assertEqual(manager.currentView, 'iso');
      assertFalse(manager.isOrtho);
    });
  });

  describe('Regular number keys with Ctrl', () => {
    test('should handle Ctrl+1 for back view', () => {
      setup();
      const event = createMockKeyEvent('Digit1', '1', true);
      const result = handleViewShortcut(event, manager);

      assertTrue(result);
      assertEqual(manager.currentView, 'back');
    });

    test('should handle Ctrl+3 for left view', () => {
      setup();
      const event = createMockKeyEvent('Digit3', '3', true);
      const result = handleViewShortcut(event, manager);

      assertTrue(result);
      assertEqual(manager.currentView, 'left');
    });

    test('should handle Ctrl+7 for bottom view', () => {
      setup();
      const event = createMockKeyEvent('Digit7', '7', true);
      const result = handleViewShortcut(event, manager);

      assertTrue(result);
      assertEqual(manager.currentView, 'bottom');
    });
  });

  describe('Input field handling', () => {
    test('should not handle shortcuts when typing in input', () => {
      setup();
      const event = createMockKeyEvent('Numpad1', '1');
      event.target = { tagName: 'INPUT' };

      const result = handleViewShortcut(event, manager);
      assertFalse(result);
    });

    test('should not handle shortcuts when typing in textarea', () => {
      setup();
      const event = createMockKeyEvent('Numpad1', '1');
      event.target = { tagName: 'TEXTAREA' };

      const result = handleViewShortcut(event, manager);
      assertFalse(result);
    });

    test('should not handle shortcuts in contenteditable', () => {
      setup();
      const event = createMockKeyEvent('Numpad1', '1');
      event.target = { tagName: 'DIV', isContentEditable: true };

      const result = handleViewShortcut(event, manager);
      assertFalse(result);
    });
  });

  describe('Unhandled keys', () => {
    test('should return false for unhandled keys', () => {
      setup();
      const event = createMockKeyEvent('KeyA', 'a');
      const result = handleViewShortcut(event, manager);

      assertFalse(result);
      assertFalse(event._defaultPrevented);
    });
  });

  describe('Null manager', () => {
    test('should return false when manager is null', () => {
      const event = createMockKeyEvent('Numpad1', '1');
      const result = handleViewShortcut(event, null);

      assertFalse(result);
    });
  });
});

// ============================================
// Results Summary
// ============================================

console.log('\n========================================');
console.log(`Camera Presets Tests: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

// Export for runner
export { passed, failed };
