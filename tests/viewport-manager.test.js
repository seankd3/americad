/**
 * Viewport Manager Tests
 * 
 * Tests for quad viewport layout and camera presets
 */

import { ViewportManager, cameraPresets } from '../src/ui/viewport-manager.js';

// Mock THREE.js objects for testing
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
        normalize() {
            const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
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
        distanceTo(v) {
            const dx = this.x - v.x;
            const dy = this.y - v.y;
            const dz = this.z - v.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
    },
    PerspectiveCamera: class {
        constructor(fov, aspect, near, far) {
            this.fov = fov;
            this.aspect = aspect;
            this.near = near;
            this.far = far;
            this.position = new mockTHREE.Vector3();
            this.up = new mockTHREE.Vector3(0, 1, 0);
            this.isPerspectiveCamera = true;
            this.userData = {};
        }
        lookAt(x, y, z) {
            this._lookAt = { x, y, z };
        }
        updateProjectionMatrix() {}
        clone() {
            const c = new mockTHREE.PerspectiveCamera(this.fov, this.aspect, this.near, this.far);
            c.position.copy(this.position);
            c.up.copy(this.up);
            return c;
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
            this.position = new mockTHREE.Vector3();
            this.up = new mockTHREE.Vector3(0, 1, 0);
            this.isOrthographicCamera = true;
            this.userData = {};
        }
        lookAt(x, y, z) {
            this._lookAt = { x, y, z };
        }
        updateProjectionMatrix() {}
    },
    WebGLRenderer: class {
        constructor(options) {
            this.options = options;
            this.domElement = document.createElement('canvas');
            this._size = { width: 0, height: 0 };
        }
        setSize(w, h) {
            this._size = { width: w, height: h };
            this.domElement.width = w;
            this.domElement.height = h;
        }
        setPixelRatio(r) {
            this._pixelRatio = r;
        }
        setClearColor(c) {
            this._clearColor = c;
        }
        render(scene, camera) {
            this._lastRender = { scene, camera };
        }
        dispose() {
            this._disposed = true;
        }
    },
    Scene: class {
        constructor() {
            this.children = [];
            this.background = { clone: () => ({ r: 0, g: 0, b: 0 }) };
        }
    }
};

// Mock OrbitControls
class MockOrbitControls {
    constructor(camera, element) {
        this.camera = camera;
        this.element = element;
        this.target = new mockTHREE.Vector3();
        this.enableDamping = false;
        this.dampingFactor = 0.05;
        this.enableRotate = true;
        this.screenSpacePanning = false;
    }
    update() {}
    dispose() {
        this._disposed = true;
    }
}

// Make OrbitControls available globally for the test
window.OrbitControls = MockOrbitControls;

describe('ViewportManager', function() {
    let container;
    let manager;
    let scene, camera, renderer, controls;
    
    beforeEach(function() {
        // Create container element
        container = document.createElement('div');
        container.id = 'test-viewport';
        container.style.width = '800px';
        container.style.height = '600px';
        document.body.appendChild(container);
        
        // Create mock scene/camera/renderer
        scene = new mockTHREE.Scene();
        camera = new mockTHREE.PerspectiveCamera(45, 800/600, 0.1, 1000);
        camera.position.set(50, 40, 50);
        
        renderer = new mockTHREE.WebGLRenderer({ antialias: true });
        renderer.setSize(800, 600);
        container.appendChild(renderer.domElement);
        
        controls = new MockOrbitControls(camera, renderer.domElement);
        
        // Create manager
        manager = new ViewportManager(container, mockTHREE);
    });
    
    afterEach(function() {
        if (manager) {
            manager.dispose();
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });
    
    describe('Initialization', function() {
        it('should initialize in single mode', function() {
            manager.init(scene, camera, renderer, controls);
            
            chai.expect(manager.mode).to.equal('single');
            chai.expect(manager.viewports.length).to.equal(1);
            chai.expect(manager.scene).to.equal(scene);
        });
        
        it('should create one viewport on init', function() {
            manager.init(scene, camera, renderer, controls);
            
            const vp = manager.viewports[0];
            chai.expect(vp.name).to.equal('perspective');
            chai.expect(vp.preset).to.equal('perspective');
            chai.expect(vp.isOrthographic).to.be.false;
        });
        
        it('should set active viewport on init', function() {
            manager.init(scene, camera, renderer, controls);
            
            chai.expect(manager.activeViewport).to.not.be.null;
            chai.expect(manager.activeViewport.name).to.equal('perspective');
        });
    });
    
    describe('Quad View', function() {
        beforeEach(function() {
            manager.init(scene, camera, renderer, controls);
        });
        
        it('should toggle to quad view', function() {
            manager.setQuadView();
            
            chai.expect(manager.mode).to.equal('quad');
        });
        
        it('should create 4 viewports in quad mode', function() {
            manager.setQuadView();
            
            chai.expect(manager.viewports.length).to.equal(4);
        });
        
        it('should have correct viewport names', function() {
            manager.setQuadView();
            
            const names = manager.viewports.map(v => v.name).sort();
            chai.expect(names).to.deep.equal(['front', 'perspective', 'right', 'top']);
        });
        
        it('should have orthographic cameras for top/front/right', function() {
            manager.setQuadView();
            
            const orthoViewports = manager.viewports.filter(v => v.isOrthographic);
            chai.expect(orthoViewports.length).to.equal(3);
            
            const orthoNames = orthoViewports.map(v => v.name).sort();
            chai.expect(orthoNames).to.deep.equal(['front', 'right', 'top']);
        });
        
        it('should have perspective camera for perspective view', function() {
            manager.setQuadView();
            
            const perspViewport = manager.viewports.find(v => v.name === 'perspective');
            chai.expect(perspViewport.isOrthographic).to.be.false;
        });
        
        it('should return to single view', function() {
            manager.setQuadView();
            manager.setSingleView();
            
            chai.expect(manager.mode).to.equal('single');
            chai.expect(manager.viewports.length).to.equal(1);
        });
        
        it('should toggle between modes', function() {
            chai.expect(manager.mode).to.equal('single');
            
            manager.toggle();
            chai.expect(manager.mode).to.equal('quad');
            
            manager.toggle();
            chai.expect(manager.mode).to.equal('single');
        });
    });
    
    describe('Camera Presets', function() {
        it('should have correct preset positions', function() {
            chai.expect(cameraPresets.top.position).to.deep.equal([0, 1000, 0]);
            chai.expect(cameraPresets.front.position).to.deep.equal([0, 0, 1000]);
            chai.expect(cameraPresets.right.position).to.deep.equal([1000, 0, 0]);
            chai.expect(cameraPresets.perspective.position).to.deep.equal([50, 40, 50]);
        });
        
        it('should have correct up vectors', function() {
            chai.expect(cameraPresets.top.up).to.deep.equal([0, 0, -1]);
            chai.expect(cameraPresets.front.up).to.deep.equal([0, 1, 0]);
            chai.expect(cameraPresets.right.up).to.deep.equal([0, 1, 0]);
        });
        
        it('should set view in single mode', function() {
            manager.init(scene, camera, renderer, controls);
            
            manager.setView('top');
            
            // Camera should be looking down Y axis
            chai.expect(camera.up.x).to.equal(0);
            chai.expect(camera.up.z).to.equal(-1);
        });
        
        it('should set view in quad mode (activates viewport)', function() {
            manager.init(scene, camera, renderer, controls);
            manager.setQuadView();
            
            manager.setView('front');
            
            chai.expect(manager.activeViewport.preset).to.equal('front');
        });
    });
    
    describe('Selection Sync', function() {
        it('should render to all viewports in quad mode', function() {
            manager.init(scene, camera, renderer, controls);
            manager.setQuadView();
            
            manager.render();
            
            // Each viewport should have rendered
            manager.viewports.forEach(vp => {
                chai.expect(vp.renderer._lastRender).to.not.be.undefined;
                chai.expect(vp.renderer._lastRender.scene).to.equal(scene);
            });
        });
    });
    
    describe('Mode Callbacks', function() {
        it('should call onModeChange when switching modes', function(done) {
            manager.init(scene, camera, renderer, controls);
            
            manager.onModeChange = (mode) => {
                chai.expect(mode).to.equal('quad');
                done();
            };
            
            manager.setQuadView();
        });
    });
    
    describe('Viewport Maximize', function() {
        it('should track maximized state', function() {
            manager.init(scene, camera, renderer, controls);
            manager.setQuadView();
            
            const vp = manager.viewports[0];
            chai.expect(vp.isMaximized).to.be.false;
        });
    });
    
    describe('Dispose', function() {
        it('should clean up resources on dispose', function() {
            manager.init(scene, camera, renderer, controls);
            manager.setQuadView();
            
            manager.dispose();
            
            // Quad container should be removed
            chai.expect(manager.quadContainer).to.be.null;
        });
        
        it('should dispose quad renderers', function() {
            manager.init(scene, camera, renderer, controls);
            manager.setQuadView();
            
            const quadRenderers = manager.viewports.map(v => v.renderer);
            
            manager.dispose();
            
            // Non-main renderers should be disposed
            quadRenderers.forEach(r => {
                if (r !== renderer) {
                    chai.expect(r._disposed).to.be.true;
                }
            });
        });
    });
    
    describe('API Methods', function() {
        beforeEach(function() {
            manager.init(scene, camera, renderer, controls);
        });
        
        it('getMode() should return current mode', function() {
            chai.expect(manager.getMode()).to.equal('single');
            
            manager.setQuadView();
            chai.expect(manager.getMode()).to.equal('quad');
        });
        
        it('getViewports() should return all viewports', function() {
            const viewports = manager.getViewports();
            chai.expect(viewports.length).to.equal(1);
            
            manager.setQuadView();
            const quadViewports = manager.getViewports();
            chai.expect(quadViewports.length).to.equal(4);
        });
        
        it('getActiveViewport() should return active viewport', function() {
            const active = manager.getActiveViewport();
            chai.expect(active).to.not.be.null;
            chai.expect(active.name).to.equal('perspective');
        });
    });
});

describe('Camera Presets', function() {
    it('should have labels for all presets', function() {
        Object.values(cameraPresets).forEach(preset => {
            chai.expect(preset.label).to.be.a('string');
            chai.expect(preset.label.length).to.be.greaterThan(0);
        });
    });
    
    it('should have 4 presets (top, front, right, perspective)', function() {
        const keys = Object.keys(cameraPresets);
        chai.expect(keys.length).to.equal(4);
        chai.expect(keys).to.include('top');
        chai.expect(keys).to.include('front');
        chai.expect(keys).to.include('right');
        chai.expect(keys).to.include('perspective');
    });
});
