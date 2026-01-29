/**
 * Ameri-CAD Modal Transform Tests
 * 
 * Tests for Blender-style modal transforms (G/R/S)
 */

import { describe, it, beforeEach, afterEach, expect, vi, createMockSelectionManager, createMockMesh, createMockTransformControl } from './test-utils.js';

// Mock THREE.js
const mockTHREE = {
    Vector2: class Vector2 {
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }
        clone() { return new mockTHREE.Vector2(this.x, this.y); }
        set(x, y) { this.x = x; this.y = y; return this; }
    },
    Vector3: class Vector3 {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        clone() { return new mockTHREE.Vector3(this.x, this.y, this.z); }
        copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
        add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
        addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
        multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
        sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
        dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
        setFromMatrixColumn(m, i) { return this; }
    },
    Euler: class Euler {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        clone() { return new mockTHREE.Euler(this.x, this.y, this.z); }
        copy(e) { this.x = e.x; this.y = e.y; this.z = e.z; return this; }
        set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    },
    Matrix4: class Matrix4 {
        constructor() { this.elements = new Array(16).fill(0); }
        clone() { const m = new mockTHREE.Matrix4(); m.elements = [...this.elements]; return m; }
    },
    MathUtils: {
        degToRad: (deg) => deg * Math.PI / 180
    },
    BufferGeometry: class BufferGeometry {
        constructor() { this.attributes = {}; }
        setAttribute(name, attr) { this.attributes[name] = attr; }
        dispose() {}
    },
    BufferAttribute: class BufferAttribute {
        constructor(array, itemSize) {
            this.array = array;
            this.itemSize = itemSize;
            this.needsUpdate = false;
        }
    },
    LineBasicMaterial: class LineBasicMaterial {
        constructor(opts = {}) { Object.assign(this, opts); }
        dispose() {}
    },
    Line: class Line {
        constructor(geometry, material) {
            this.geometry = geometry;
            this.material = material;
            this.visible = true;
            this.renderOrder = 0;
        }
    },
    Raycaster: class Raycaster {
        setFromCamera() {}
    }
};

// Store original window for restoration
let originalWindow;

// Test state
let modalTransform;
let mockScene;
let mockCamera;
let mockRenderer;
let mockSelectionManager;
let mockTransformControl;
let mockOrbitControls;
let mockMesh;
let logMessages;

/**
 * Create test infrastructure
 */
function setupTestEnvironment() {
    logMessages = [];
    
    // Mock mesh
    mockMesh = {
        position: new mockTHREE.Vector3(0, 0, 0),
        rotation: new mockTHREE.Euler(0, 0, 0),
        scale: new mockTHREE.Vector3(1, 1, 1),
        matrix: new mockTHREE.Matrix4(),
        rotateOnWorldAxis: vi.fn(),
        rotateY: vi.fn()
    };
    
    // Mock selection manager
    mockSelectionManager = {
        getSelected: vi.fn(() => mockMesh),
        select: vi.fn(),
        deselect: vi.fn()
    };
    
    // Mock transform control
    mockTransformControl = {
        visible: true,
        attach: vi.fn(),
        detach: vi.fn()
    };
    
    // Mock orbit controls
    mockOrbitControls = {
        enabled: true
    };
    
    // Mock scene
    mockScene = {
        add: vi.fn(),
        remove: vi.fn()
    };
    
    // Mock camera
    mockCamera = {
        getWorldDirection: vi.fn(() => new mockTHREE.Vector3(0, 0, -1)),
        matrixWorld: new mockTHREE.Matrix4()
    };
    
    // Mock renderer
    mockRenderer = {
        domElement: {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
        }
    };
}

/**
 * Create a mock key event
 */
function createKeyEvent(key, options = {}) {
    return {
        key,
        shiftKey: options.shiftKey || false,
        ctrlKey: options.ctrlKey || false,
        metaKey: options.metaKey || false,
        altKey: options.altKey || false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
    };
}

// ============================================
// TEST SUITE
// ============================================

describe('ModalTransformManager', () => {
    beforeEach(async () => {
        setupTestEnvironment();
        
        // Dynamic import with mocked THREE
        globalThis.THREE = mockTHREE;
        
        // Import the module
        const module = await import('../src/ui/modal-transform.js');
        const { ModalTransformManager, TransformMode, AxisConstraint, PlaneConstraint } = module;
        
        // Create instance
        modalTransform = new ModalTransformManager({
            log: (msg, type) => logMessages.push({ msg, type })
        });
        
        // Initialize
        modalTransform.init(
            mockScene,
            mockCamera,
            mockRenderer,
            mockSelectionManager,
            mockTransformControl,
            mockOrbitControls
        );
        
        // Store enums for tests
        globalThis.TransformMode = TransformMode;
        globalThis.AxisConstraint = AxisConstraint;
        globalThis.PlaneConstraint = PlaneConstraint;
    });
    
    afterEach(() => {
        if (modalTransform) {
            modalTransform.dispose();
        }
        document.body.innerHTML = '';
    });
    
    // ----------------------------------------
    // Mode Entry Tests
    // ----------------------------------------
    
    describe('Mode Entry', () => {
        it('G key enters grab mode', () => {
            const result = modalTransform.enterMode(TransformMode.GRAB);
            
            expect(result).toBe(true);
            expect(modalTransform.isActive()).toBe(true);
            expect(modalTransform.getMode()).toBe(TransformMode.GRAB);
        });
        
        it('R key enters rotate mode', () => {
            const result = modalTransform.enterMode(TransformMode.ROTATE);
            
            expect(result).toBe(true);
            expect(modalTransform.getMode()).toBe(TransformMode.ROTATE);
        });
        
        it('S key enters scale mode', () => {
            const result = modalTransform.enterMode(TransformMode.SCALE);
            
            expect(result).toBe(true);
            expect(modalTransform.getMode()).toBe(TransformMode.SCALE);
        });
        
        it('fails to enter mode without selection', () => {
            mockSelectionManager.getSelected.mockReturnValue(null);
            
            const result = modalTransform.enterMode(TransformMode.GRAB);
            
            expect(result).toBe(false);
            expect(modalTransform.isActive()).toBe(false);
        });
        
        it('stores initial transform state on mode entry', () => {
            mockMesh.position.set(10, 20, 30);
            mockMesh.rotation.set(0.5, 1, 1.5);
            mockMesh.scale.set(2, 2, 2);
            
            modalTransform.enterMode(TransformMode.GRAB);
            
            expect(modalTransform.state.startPosition.x).toBe(10);
            expect(modalTransform.state.startPosition.y).toBe(20);
            expect(modalTransform.state.startPosition.z).toBe(30);
        });
        
        it('disables orbit controls on mode entry', () => {
            modalTransform.enterMode(TransformMode.GRAB);
            
            expect(mockOrbitControls.enabled).toBe(false);
        });
        
        it('hides transform control on mode entry', () => {
            modalTransform.enterMode(TransformMode.GRAB);
            
            expect(mockTransformControl.visible).toBe(false);
            expect(mockTransformControl.detach).toHaveBeenCalled();
        });
    });
    
    // ----------------------------------------
    // Axis Constraint Tests
    // ----------------------------------------
    
    describe('Axis Constraints', () => {
        beforeEach(() => {
            modalTransform.enterMode(TransformMode.GRAB);
        });
        
        it('X key locks to X axis', () => {
            modalTransform.setAxis(AxisConstraint.X);
            
            expect(modalTransform.state.axis).toBe(AxisConstraint.X);
            expect(modalTransform.state.plane).toBe(PlaneConstraint.NONE);
        });
        
        it('Y key locks to Y axis', () => {
            modalTransform.setAxis(AxisConstraint.Y);
            
            expect(modalTransform.state.axis).toBe(AxisConstraint.Y);
        });
        
        it('Z key locks to Z axis', () => {
            modalTransform.setAxis(AxisConstraint.Z);
            
            expect(modalTransform.state.axis).toBe(AxisConstraint.Z);
        });
        
        it('pressing same axis key toggles off constraint', () => {
            modalTransform.setAxis(AxisConstraint.X);
            expect(modalTransform.state.axis).toBe(AxisConstraint.X);
            
            modalTransform.setAxis(AxisConstraint.X);
            expect(modalTransform.state.axis).toBe(AxisConstraint.NONE);
        });
        
        it('pressing different axis key switches constraint', () => {
            modalTransform.setAxis(AxisConstraint.X);
            modalTransform.setAxis(AxisConstraint.Y);
            
            expect(modalTransform.state.axis).toBe(AxisConstraint.Y);
        });
        
        it('Shift+X locks to YZ plane', () => {
            modalTransform.setAxis(AxisConstraint.X, true);
            
            expect(modalTransform.state.plane).toBe(PlaneConstraint.YZ);
            expect(modalTransform.state.axis).toBe(AxisConstraint.NONE);
        });
        
        it('Shift+Y locks to XZ plane', () => {
            modalTransform.setAxis(AxisConstraint.Y, true);
            
            expect(modalTransform.state.plane).toBe(PlaneConstraint.XZ);
        });
        
        it('Shift+Z locks to XY plane', () => {
            modalTransform.setAxis(AxisConstraint.Z, true);
            
            expect(modalTransform.state.plane).toBe(PlaneConstraint.XY);
        });
        
        it('axis constraint clears plane constraint', () => {
            modalTransform.setAxis(AxisConstraint.X, true); // Plane YZ
            expect(modalTransform.state.plane).toBe(PlaneConstraint.YZ);
            
            modalTransform.setAxis(AxisConstraint.Y, false); // Axis Y
            expect(modalTransform.state.axis).toBe(AxisConstraint.Y);
            expect(modalTransform.state.plane).toBe(PlaneConstraint.NONE);
        });
    });
    
    // ----------------------------------------
    // Numeric Input Tests
    // ----------------------------------------
    
    describe('Numeric Input', () => {
        beforeEach(() => {
            modalTransform.enterMode(TransformMode.GRAB);
        });
        
        it('accepts digit input', () => {
            modalTransform.addNumericInput('1');
            modalTransform.addNumericInput('0');
            
            expect(modalTransform.state.numericInput).toBe('10');
            expect(modalTransform.state.currentValue).toBe(10);
        });
        
        it('accepts decimal point', () => {
            modalTransform.addNumericInput('5');
            modalTransform.addNumericInput('.');
            modalTransform.addNumericInput('5');
            
            expect(modalTransform.state.numericInput).toBe('5.5');
            expect(modalTransform.state.currentValue).toBe(5.5);
        });
        
        it('accepts negative values', () => {
            modalTransform.addNumericInput('-');
            modalTransform.addNumericInput('1');
            modalTransform.addNumericInput('5');
            
            expect(modalTransform.state.numericInput).toBe('-15');
            expect(modalTransform.state.currentValue).toBe(-15);
        });
        
        it('toggles negative sign', () => {
            modalTransform.addNumericInput('5');
            modalTransform.addNumericInput('-');
            expect(modalTransform.state.numericInput).toBe('-5');
            
            modalTransform.addNumericInput('-');
            expect(modalTransform.state.numericInput).toBe('5');
        });
        
        it('only allows one decimal point', () => {
            modalTransform.addNumericInput('5');
            modalTransform.addNumericInput('.');
            modalTransform.addNumericInput('5');
            modalTransform.addNumericInput('.');
            modalTransform.addNumericInput('5');
            
            expect(modalTransform.state.numericInput).toBe('5.55');
        });
        
        it('backspace removes last character', () => {
            modalTransform.addNumericInput('1');
            modalTransform.addNumericInput('2');
            modalTransform.addNumericInput('3');
            modalTransform.clearNumericInput();
            
            expect(modalTransform.state.numericInput).toBe('12');
            expect(modalTransform.state.currentValue).toBe(12);
        });
        
        it('handles empty input after backspace', () => {
            modalTransform.addNumericInput('5');
            modalTransform.clearNumericInput();
            
            expect(modalTransform.state.numericInput).toBe('');
            expect(modalTransform.state.currentValue).toBe(0);
        });
    });
    
    // ----------------------------------------
    // Confirm/Cancel Tests
    // ----------------------------------------
    
    describe('Confirm and Cancel', () => {
        beforeEach(() => {
            mockMesh.position.set(0, 0, 0);
            modalTransform.enterMode(TransformMode.GRAB);
        });
        
        it('Enter confirms transform', () => {
            let completeCalled = false;
            modalTransform.onTransformComplete = () => { completeCalled = true; };
            
            modalTransform.setAxis(AxisConstraint.X);
            modalTransform.addNumericInput('1');
            modalTransform.addNumericInput('0');
            modalTransform.confirm();
            
            expect(modalTransform.isActive()).toBe(false);
            expect(completeCalled).toBe(true);
        });
        
        it('Escape cancels and restores original position', () => {
            // Set initial position
            mockMesh.position.set(10, 20, 30);
            
            // Enter mode (stores initial position)
            modalTransform.cancel(); // Clean up first
            mockMesh.position.set(10, 20, 30);
            modalTransform.enterMode(TransformMode.GRAB);
            
            // Modify position
            mockMesh.position.set(100, 200, 300);
            
            // Cancel
            modalTransform.cancel();
            
            // Should restore original position
            expect(mockMesh.position.x).toBe(10);
            expect(mockMesh.position.y).toBe(20);
            expect(mockMesh.position.z).toBe(30);
            expect(modalTransform.isActive()).toBe(false);
        });
        
        it('re-enables orbit controls after confirm', () => {
            modalTransform.confirm();
            
            expect(mockOrbitControls.enabled).toBe(true);
        });
        
        it('re-enables orbit controls after cancel', () => {
            modalTransform.cancel();
            
            expect(mockOrbitControls.enabled).toBe(true);
        });
        
        it('re-attaches transform control after confirm', () => {
            modalTransform.confirm();
            
            expect(mockTransformControl.attach).toHaveBeenCalledWith(mockMesh);
            expect(mockTransformControl.visible).toBe(true);
        });
    });
    
    // ----------------------------------------
    // Keyboard Handler Tests
    // ----------------------------------------
    
    describe('Keyboard Handling', () => {
        beforeEach(() => {
            modalTransform.enterMode(TransformMode.GRAB);
        });
        
        it('processes X key for axis lock', () => {
            modalTransform._handleKeyDown(createKeyEvent('x'));
            
            expect(modalTransform.state.axis).toBe(AxisConstraint.X);
        });
        
        it('processes Shift+X for plane lock', () => {
            modalTransform._handleKeyDown(createKeyEvent('x', { shiftKey: true }));
            
            expect(modalTransform.state.plane).toBe(PlaneConstraint.YZ);
        });
        
        it('processes number keys', () => {
            modalTransform._handleKeyDown(createKeyEvent('5'));
            modalTransform._handleKeyDown(createKeyEvent('0'));
            
            expect(modalTransform.state.numericInput).toBe('50');
        });
        
        it('processes Enter for confirm', () => {
            const spy = vi.spyOn(modalTransform, 'confirm');
            modalTransform._handleKeyDown(createKeyEvent('Enter'));
            
            expect(spy).toHaveBeenCalled();
        });
        
        it('processes Escape for cancel', () => {
            const spy = vi.spyOn(modalTransform, 'cancel');
            modalTransform._handleKeyDown(createKeyEvent('Escape'));
            
            expect(spy).toHaveBeenCalled();
        });
        
        it('prevents default for all keys during modal', () => {
            const event = createKeyEvent('x');
            modalTransform._handleKeyDown(event);
            
            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
        });
        
        it('allows mode switching while in transform', () => {
            expect(modalTransform.getMode()).toBe(TransformMode.GRAB);
            
            // Pressing 'r' should switch to rotate
            modalTransform._handleKeyDown(createKeyEvent('r'));
            
            // Should cancel grab and enter rotate
            expect(modalTransform.getMode()).toBe(TransformMode.ROTATE);
        });
    });
    
    // ----------------------------------------
    // Transform Application Tests
    // ----------------------------------------
    
    describe('Transform Application', () => {
        beforeEach(() => {
            mockMesh.position.set(0, 0, 0);
            mockMesh.rotation.set(0, 0, 0);
            mockMesh.scale.set(1, 1, 1);
        });
        
        it('applies grab on X axis with numeric input', () => {
            modalTransform.enterMode(TransformMode.GRAB);
            modalTransform.setAxis(AxisConstraint.X);
            modalTransform.addNumericInput('1');
            modalTransform.addNumericInput('0');
            
            expect(mockMesh.position.x).toBe(10);
            expect(mockMesh.position.y).toBe(0);
            expect(mockMesh.position.z).toBe(0);
        });
        
        it('applies grab on Y axis with numeric input', () => {
            modalTransform.enterMode(TransformMode.GRAB);
            modalTransform.setAxis(AxisConstraint.Y);
            modalTransform.addNumericInput('2');
            modalTransform.addNumericInput('5');
            
            expect(mockMesh.position.x).toBe(0);
            expect(mockMesh.position.y).toBe(25);
            expect(mockMesh.position.z).toBe(0);
        });
        
        it('applies negative grab value', () => {
            modalTransform.enterMode(TransformMode.GRAB);
            modalTransform.setAxis(AxisConstraint.Z);
            modalTransform.addNumericInput('-');
            modalTransform.addNumericInput('5');
            
            expect(mockMesh.position.z).toBe(-5);
        });
        
        it('applies scale on single axis', () => {
            modalTransform.enterMode(TransformMode.SCALE);
            modalTransform.setAxis(AxisConstraint.X);
            modalTransform.addNumericInput('2');
            
            expect(mockMesh.scale.x).toBe(2);
            expect(mockMesh.scale.y).toBe(1);
            expect(mockMesh.scale.z).toBe(1);
        });
        
        it('applies uniform scale without axis constraint', () => {
            modalTransform.enterMode(TransformMode.SCALE);
            modalTransform.addNumericInput('3');
            
            expect(mockMesh.scale.x).toBe(3);
            expect(mockMesh.scale.y).toBe(3);
            expect(mockMesh.scale.z).toBe(3);
        });
        
        it('applies rotation with numeric degrees', () => {
            modalTransform.enterMode(TransformMode.ROTATE);
            modalTransform.setAxis(AxisConstraint.Y);
            modalTransform.addNumericInput('9');
            modalTransform.addNumericInput('0');
            
            // Should call rotateOnWorldAxis with Y axis and 90 degrees in radians
            expect(mockMesh.rotateOnWorldAxis).toHaveBeenCalled();
        });
    });
    
    // ----------------------------------------
    // Status Display Tests
    // ----------------------------------------
    
    describe('Status Display', () => {
        it('creates status element on init', () => {
            expect(modalTransform.statusElement).toBeDefined();
            expect(document.getElementById('modal-transform-status')).toBeTruthy();
        });
        
        it('shows status element when mode is active', () => {
            modalTransform.enterMode(TransformMode.GRAB);
            
            expect(modalTransform.statusElement.style.display).toBe('block');
        });
        
        it('hides status element when not active', () => {
            modalTransform.enterMode(TransformMode.GRAB);
            modalTransform.confirm();
            
            expect(modalTransform.statusElement.style.display).toBe('none');
        });
        
        it('displays mode name in status', () => {
            modalTransform.enterMode(TransformMode.GRAB);
            
            expect(modalTransform.statusElement.innerHTML).toContain('GRAB');
        });
        
        it('displays axis constraint in status', () => {
            modalTransform.enterMode(TransformMode.GRAB);
            modalTransform.setAxis(AxisConstraint.X);
            
            expect(modalTransform.statusElement.innerHTML).toContain('AXIS: X');
        });
        
        it('displays numeric input in status', () => {
            modalTransform.enterMode(TransformMode.GRAB);
            modalTransform.addNumericInput('4');
            modalTransform.addNumericInput('2');
            
            expect(modalTransform.statusElement.innerHTML).toContain('42');
        });
    });
    
    // ----------------------------------------
    // Integration Tests
    // ----------------------------------------
    
    describe('Full Workflow Integration', () => {
        it('completes G X 10 Enter workflow', () => {
            mockMesh.position.set(0, 0, 0);
            let finalTransform = null;
            
            modalTransform.onTransformComplete = (mesh, data) => {
                finalTransform = data;
            };
            
            // G - Enter grab mode
            modalTransform.enterMode(TransformMode.GRAB);
            expect(modalTransform.isActive()).toBe(true);
            
            // X - Lock to X axis
            modalTransform._handleKeyDown(createKeyEvent('x'));
            expect(modalTransform.state.axis).toBe(AxisConstraint.X);
            
            // 1 0 - Enter value 10
            modalTransform._handleKeyDown(createKeyEvent('1'));
            modalTransform._handleKeyDown(createKeyEvent('0'));
            expect(modalTransform.state.currentValue).toBe(10);
            
            // Enter - Confirm
            modalTransform._handleKeyDown(createKeyEvent('Enter'));
            
            expect(modalTransform.isActive()).toBe(false);
            expect(mockMesh.position.x).toBe(10);
            expect(finalTransform).not.toBeNull();
            expect(finalTransform.mode).toBe(TransformMode.GRAB);
            expect(finalTransform.axis).toBe(AxisConstraint.X);
            expect(finalTransform.value).toBe(10);
        });
        
        it('completes S 2 Enter workflow for uniform scale', () => {
            mockMesh.scale.set(1, 1, 1);
            
            modalTransform.enterMode(TransformMode.SCALE);
            modalTransform._handleKeyDown(createKeyEvent('2'));
            modalTransform._handleKeyDown(createKeyEvent('Enter'));
            
            expect(mockMesh.scale.x).toBe(2);
            expect(mockMesh.scale.y).toBe(2);
            expect(mockMesh.scale.z).toBe(2);
        });
        
        it('cancels with Escape and restores state', () => {
            mockMesh.position.set(5, 5, 5);
            
            modalTransform.enterMode(TransformMode.GRAB);
            
            // Modify position
            modalTransform.setAxis(AxisConstraint.X);
            modalTransform.addNumericInput('1');
            modalTransform.addNumericInput('0');
            modalTransform.addNumericInput('0');
            
            // Position should be modified
            expect(mockMesh.position.x).toBe(100);
            
            // Cancel with Escape
            modalTransform._handleKeyDown(createKeyEvent('Escape'));
            
            // Position should be restored
            expect(mockMesh.position.x).toBe(5);
            expect(mockMesh.position.y).toBe(5);
            expect(mockMesh.position.z).toBe(5);
        });
    });
});

// ============================================
// TEST UTILITIES
// ============================================

// Simple test framework utilities (if not using external framework)
globalThis.describe = globalThis.describe || function(name, fn) {
    console.log(`\n📦 ${name}`);
    fn();
};

globalThis.it = globalThis.it || function(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
    } catch (e) {
        console.log(`  ❌ ${name}`);
        console.error(`     ${e.message}`);
    }
};

globalThis.beforeEach = globalThis.beforeEach || function(fn) {
    globalThis._beforeEach = fn;
};

globalThis.afterEach = globalThis.afterEach || function(fn) {
    globalThis._afterEach = fn;
};

globalThis.expect = globalThis.expect || function(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${expected} but got ${actual}`);
            }
        },
        toEqual(expected) {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
            }
        },
        toBeDefined() {
            if (actual === undefined) {
                throw new Error(`Expected value to be defined`);
            }
        },
        toBeTruthy() {
            if (!actual) {
                throw new Error(`Expected truthy value but got ${actual}`);
            }
        },
        toBeNull() {
            if (actual !== null) {
                throw new Error(`Expected null but got ${actual}`);
            }
        },
        toContain(expected) {
            if (!actual.includes(expected)) {
                throw new Error(`Expected "${actual}" to contain "${expected}"`);
            }
        },
        toHaveBeenCalled() {
            if (!actual.mock?.calls?.length) {
                throw new Error(`Expected function to have been called`);
            }
        },
        toHaveBeenCalledWith(...args) {
            const calls = actual.mock?.calls || [];
            const found = calls.some(call => 
                JSON.stringify(call) === JSON.stringify(args)
            );
            if (!found) {
                throw new Error(`Expected function to have been called with ${JSON.stringify(args)}`);
            }
        },
        not: {
            toBe(expected) {
                if (actual === expected) {
                    throw new Error(`Expected ${actual} not to be ${expected}`);
                }
            },
            toBeNull() {
                if (actual === null) {
                    throw new Error(`Expected value not to be null`);
                }
            }
        }
    };
};

globalThis.vi = globalThis.vi || {
    fn(impl) {
        const mockFn = (...args) => {
            mockFn.mock.calls.push(args);
            return impl ? impl(...args) : undefined;
        };
        mockFn.mock = { calls: [] };
        mockFn.mockReturnValue = (val) => {
            mockFn.mock.returnValue = val;
            return mockFn;
        };
        mockFn.mockImplementation = (fn) => {
            impl = fn;
            return mockFn;
        };
        return mockFn;
    },
    spyOn(obj, method) {
        const original = obj[method];
        const spy = vi.fn((...args) => original.apply(obj, args));
        obj[method] = spy;
        return spy;
    }
};

// Export for module system
export { describe, it, beforeEach, afterEach, expect, vi };
