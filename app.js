/**
 * Ameri-CAD CAD SYSTEM
 * Version: 2.1.0-LA
 * Classification: UNRESTRICTED
 * 
 * Space Grade / HiRel / RadHard 3D CAD Platform
 * 
 * Refactored with ES Modules and Command Pattern undo/redo
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

// Local modules
import { generateId, computeBoundingBox, calculateFitDistance, radToDeg } from './src/core/math.js';
import { updateMouseCoords, getWorldPosition, performRaycast, getObjectMatrix4 } from './src/core/transforms.js';
import { selectionManager } from './src/state/selection.js';
import { commandManager, CreatePrimitiveCommand, DeleteCommand, TransformCommand } from './src/state/history.js';

// Kernel and command system integration
import { initializeSystem, executeCommand as execCmd, isKernelReady, getCommandSuggestions } from './src/core/app-integration.js';
import { kernel, meshToThreeGeometry } from './src/kernel/bridge.js';

// ========================================
// SYSTEM STATE
// ========================================
const System = {
    version: '2.2.0-LA',
    ready: false,
    loading: true,
    kernelReady: false,
    
    // Tool State
    tool: 'select',
    transformMode: 'translate',
    space: 'world',
    
    // Scene State
    objects: [],
    sketches: [],
    features: [],
    
    // View State
    view: '3d',
    renderMode: 'shaded',
    
    // Settings
    snap: true,
    grid: true,
    shadows: false,
    units: 'mm',
    
    // Interaction
    isDragging: false,
    isTransforming: false,
    transformStartMatrix: null,
    mouse: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(),
    
    // Stats
    fps: 60,
    frameCount: 0,
    lastTime: performance.now(),
    
    // Command system state
    commandHistory: [],
    commandHistoryIndex: -1,
    suggestions: []
};

// ========================================
// THREE.JS CORE
// ========================================
let scene, camera, renderer, controls, transformControl;
let gridHelper, axesHelper;

// ========================================
// DOM REFERENCES
// ========================================
const DOM = {
    splash: null,
    app: null,
    canvas: null,
    viewport: null,
    commandInput: null,
    commandHint: null,
    toolOptions: null,
    contextMenu: null,
    modalOverlay: null,
    loadingStatus: null
};

// ========================================
// INITIALIZATION
// ========================================
async function startApp() {
    try {
        await initialize();
        window.AMERICAD_LOADED = true;
    } catch (e) {
        console.error('[Ameri-CAD] Failed to start:', e);
        window.AMERICAD_LOADED = true;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

async function initialize() {
    const safetyTimeout = setTimeout(() => {
        console.log('[Ameri-CAD] Safety timeout triggered');
        if (DOM.splash) DOM.splash.classList.add('hidden');
        if (DOM.app) DOM.app.classList.remove('hidden');
    }, 8000); // Extended for kernel loading
    
    try {
        console.log('[Ameri-CAD] Starting initialization...');
        
        cacheDOM();
        updateLoadingStatus('INIT THREE.JS...');
        await initThreeJS();
        
        updateLoadingStatus('INIT UI...');
        initUI();
        
        updateLoadingStatus('BIND EVENTS...');
        setupEvents();
        setupHistoryCallbacks();
        
        // Initialize kernel and command system (async, non-blocking)
        updateLoadingStatus('INIT KERNEL...');
        initKernelSystem();
        
        updateLoadingStatus('BUILD SCENE...');
        createDefaultScene();
        
        updateLoadingStatus('START RENDERER...');
        requestAnimationFrame(render);
        
        clearTimeout(safetyTimeout);
        
        setTimeout(() => {
            try {
                System.loading = false;
                System.ready = true;
                
                if (DOM.splash) DOM.splash.classList.add('hidden');
                if (DOM.app) DOM.app.classList.remove('hidden');
                
                onResize();
                console.log('[Ameri-CAD] SYSTEM READY');
                log('SYSTEM READY // KERNEL LOADING IN BACKGROUND', 'success');
            } catch (e) {
                console.error('[Ameri-CAD] Error revealing app:', e);
            }
        }, 300);
        
    } catch (error) {
        console.error('[Ameri-CAD] INIT ERROR:', error);
        updateLoadingStatus('INIT FAILED: ' + error.message);
        
        setTimeout(() => {
            clearTimeout(safetyTimeout);
            if (DOM.splash) DOM.splash.classList.add('hidden');
            if (DOM.app) DOM.app.classList.remove('hidden');
        }, 500);
    }
}

/**
 * Initialize the OpenCASCADE kernel and command system
 */
async function initKernelSystem() {
    try {
        const result = await initializeSystem({
            THREE,
            scene,
            camera,
            onBodyCreated: (mesh, body) => {
                // Add to system objects array
                System.objects.push(mesh);
                selectObject(mesh);
                updateFeatureTree();
            },
            onBodyDeleted: (id) => {
                // Remove from objects array
                System.objects = System.objects.filter(o => o.userData?.kernelId !== id);
                updateFeatureTree();
            },
            log: log
        });
        
        System.kernelReady = true;
        log('KERNEL ONLINE (OCCT B-REP)', 'success');
        
        // Update status indicator
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.style.backgroundColor = 'var(--success)';
        }
        
    } catch (error) {
        console.error('[Ameri-CAD] Kernel init failed:', error);
        log('KERNEL FALLBACK MODE (THREE.JS)', 'warn');
    }
}

/**
 * Update feature tree UI
 */
function updateFeatureTree() {
    // Future: sync feature tree with document state
    const bodiesNode = document.querySelector('.tree-node .tree-label');
    // Could update tree here
}

function cacheDOM() {
    DOM.splash = document.getElementById('splash-screen');
    DOM.app = document.getElementById('app');
    DOM.canvas = document.getElementById('cad-canvas');
    DOM.viewport = document.getElementById('viewport');
    DOM.commandInput = document.getElementById('command-input');
    DOM.commandHint = document.getElementById('command-hint');
    DOM.toolOptions = document.getElementById('tool-options');
    DOM.contextMenu = document.getElementById('context-menu');
    DOM.modalOverlay = document.getElementById('modal-overlay');
    DOM.loadingStatus = document.getElementById('loading-status');
}

function updateLoadingStatus(text) {
    if (DOM.loadingStatus) DOM.loadingStatus.textContent = text;
}

// ========================================
// HISTORY CALLBACKS
// ========================================
function setupHistoryCallbacks() {
    // Update UI when history state changes
    commandManager.onStateChange((canUndo, canRedo) => {
        // Could update undo/redo button states here
        console.log(`[Ameri-CAD] History: Undo=${canUndo}, Redo=${canRedo}`);
    });
    
    // Update properties panel when selection changes
    selectionManager.onSelectionChange((selected) => {
        if (selected) {
            updateProperties();
            log(`SELECTED: ${selected.userData.name}`, 'info');
        }
    });
}

// ========================================
// THREE.JS SETUP
// ========================================
async function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0b);
    scene.fog = new THREE.Fog(0x0a0a0b, 100, 500);
    
    let aspect = 1;
    if (DOM.viewport && DOM.viewport.clientWidth > 0) {
        aspect = DOM.viewport.clientWidth / DOM.viewport.clientHeight;
    }
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(50, 40, 50);
    
    if (!DOM.canvas) throw new Error('Canvas element not found');
    
    try {
        renderer = new THREE.WebGLRenderer({
            canvas: DOM.canvas,
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
        });
        
        const width = DOM.viewport.clientWidth || 800;
        const height = DOM.viewport.clientHeight || 600;
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch (e) {
        console.error('[Ameri-CAD] WebGL error:', e);
        renderer = null;
        drawFallbackCanvas();
        return;
    }
    
    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 1;
    controls.maxDistance = 500;
    controls.target.set(0, 0, 0);
    
    // Transform Controls
    transformControl = new TransformControls(camera, renderer.domElement);
    transformControl.addEventListener('dragging-changed', (e) => {
        controls.enabled = !e.value;
        
        // Track transform start/end for undo
        if (e.value) {
            // Started dragging
            System.isTransforming = true;
            const selected = selectionManager.getSelected();
            if (selected) {
                System.transformStartMatrix = getObjectMatrix4(selected);
            }
        } else {
            // Stopped dragging
            if (System.isTransforming) {
                System.isTransforming = false;
                const selected = selectionManager.getSelected();
                if (selected && System.transformStartMatrix) {
                    const endMatrix = getObjectMatrix4(selected);
                    const cmd = new TransformCommand(selected, System.transformStartMatrix, endMatrix);
                    commandManager.push(cmd);
                    log('TRANSFORM RECORDED', 'info');
                }
                System.transformStartMatrix = null;
            }
        }
    });
    transformControl.addEventListener('change', () => {
        updateProperties();
    });
    transformControl.visible = false;
    scene.add(transformControl);
    
    setupLighting();
    setupGridAndAxes();
}

function drawFallbackCanvas() {
    const width = DOM.viewport?.clientWidth || 800;
    const height = DOM.viewport?.clientHeight || 600;
    DOM.canvas.width = width;
    DOM.canvas.height = height;
    
    const ctx = DOM.canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#0a0a0b';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#1f1f22';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    const cx = width / 2;
    const cy = height / 2;
    
    ctx.fillStyle = '#e8b13f';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('◆ Ameri-CAD', cx, cy - 60);
    
    ctx.fillStyle = '#ff6b47';
    ctx.font = '14px monospace';
    ctx.fillText('3D ENGINE FAILED TO LOAD', cx, cy - 20);
    
    ctx.fillStyle = '#a0a0a5';
    ctx.font = '12px monospace';
    ctx.fillText('Run: python3 -m http.server 8000', cx, cy + 20);
    ctx.fillText('Then open: http://localhost:8000', cx, cy + 40);
}

function setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambient);
    
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(50, 100, 50);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 500;
    keyLight.shadow.camera.left = -100;
    keyLight.shadow.camera.right = 100;
    keyLight.shadow.camera.top = 100;
    keyLight.shadow.camera.bottom = -100;
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0x4a9eff, 0.2);
    fillLight.position.set(-50, 30, -50);
    scene.add(fillLight);
    
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.15);
    rimLight.position.set(0, 50, -100);
    scene.add(rimLight);
}

function setupGridAndAxes() {
    gridHelper = new THREE.GridHelper(200, 100, 0x35353a, 0x1f1f22);
    gridHelper.name = 'grid';
    scene.add(gridHelper);
    
    axesHelper = new THREE.Group();
    axesHelper.name = 'axes';
    
    // X Axis (Red)
    const xGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(15, 0, 0)
    ]);
    axesHelper.add(new THREE.Line(xGeo, new THREE.LineBasicMaterial({ color: 0xff4444 })));
    
    // Y Axis (Green)
    const yGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 15, 0)
    ]);
    axesHelper.add(new THREE.Line(yGeo, new THREE.LineBasicMaterial({ color: 0x44ff44 })));
    
    // Z Axis (Blue)
    const zGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 15)
    ]);
    axesHelper.add(new THREE.Line(zGeo, new THREE.LineBasicMaterial({ color: 0x4444ff })));
    
    // Labels
    const createLabel = (text, color, pos) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 32, 32);
        
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex });
        const sprite = new THREE.Sprite(mat);
        sprite.position.copy(pos);
        sprite.scale.set(3, 3, 1);
        return sprite;
    };
    
    axesHelper.add(createLabel('X', '#ff4444', new THREE.Vector3(17, 0, 0)));
    axesHelper.add(createLabel('Y', '#44ff44', new THREE.Vector3(0, 17, 0)));
    axesHelper.add(createLabel('Z', '#4444ff', new THREE.Vector3(0, 0, 17)));
    
    scene.add(axesHelper);
}

// ========================================
// SCENE OBJECTS
// ========================================
function createDefaultScene() {
    createPrimitive('box', { 
        size: [20, 20, 20],
        position: [0, 10, 0],
        color: 0x808080,
        name: 'BODY_001'
    });
}

/**
 * Create a primitive using the kernel (B-Rep) or fallback to Three.js
 */
async function createPrimitive(type, options = {}) {
    if (!renderer || !scene) {
        log('CREATE ' + type.toUpperCase() + ' (WEBGL NOT READY)', 'warn');
        return null;
    }
    
    // Try to use the kernel for real B-Rep geometry
    if (isKernelReady()) {
        try {
            return await createKernelPrimitive(type, options);
        } catch (error) {
            console.warn('[Ameri-CAD] Kernel primitive failed, using fallback:', error);
            log('KERNEL ERROR - USING FALLBACK', 'warn');
        }
    }
    
    // Fallback to Three.js geometry
    return createFallbackPrimitive(type, options);
}

/**
 * Create primitive using OpenCASCADE kernel (real B-Rep geometry)
 */
async function createKernelPrimitive(type, options = {}) {
    const size = options.size ?? [10, 10, 10];
    const pos = options.position ?? [0, 0, 0];
    const center = { x: pos[0], y: pos[1], z: pos[2] };
    
    let result;
    
    switch(type) {
        case 'box':
        case 'cube':
            result = await kernel.createBox(size[0], size[1], size[2], center);
            break;
        case 'sphere':
            result = await kernel.createSphere(options.radius ?? 10, center);
            break;
        case 'cylinder':
            result = await kernel.createCylinder(options.radius ?? 8, options.height ?? 20, center);
            break;
        case 'cone':
            result = await kernel.createCone(options.radius ?? 8, 0, options.height ?? 16, center);
            break;
        default:
            result = await kernel.createBox(10, 10, 10, center);
    }
    
    // Convert kernel mesh to Three.js
    const geometry = meshToThreeGeometry(result.mesh, THREE);
    
    const color = options.color ?? 0x808080;
    const material = new THREE.MeshStandardMaterial({
        color,
        metalness: options.metalness ?? 0.4,
        roughness: options.roughness ?? 0.6
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Add edges for CAD look
    const edges = new THREE.EdgesGeometry(geometry, 15);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    mesh.add(new THREE.LineSegments(edges, edgeMat));
    
    // Metadata
    mesh.userData = {
        type: 'body',
        name: options.name ?? `BODY_${String(System.objects.length + 1).padStart(3, '0')}`,
        id: generateId(),
        kernelId: result.id,
        bodyType: type,
        material: 'AL-6061-T6',
        created: Date.now(),
        isKernelGeometry: true
    };
    
    scene.add(mesh);
    System.objects.push(mesh);
    
    // Record in history
    const cmd = new CreatePrimitiveCommand(scene, System.objects, mesh);
    commandManager.push(cmd);
    
    selectObject(mesh);
    log(`CREATED: ${mesh.userData.name} (B-REP)`, 'success');
    
    return mesh;
}

/**
 * Fallback: Create primitive using Three.js (tessellated, not B-Rep)
 */
function createFallbackPrimitive(type, options = {}) {
    let geometry;
    const color = options.color ?? 0x808080;
    const metalness = options.metalness ?? 0.4;
    const roughness = options.roughness ?? 0.6;
    
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    
    switch(type) {
        case 'box':
            const size = options.size ?? [10, 10, 10];
            geometry = new THREE.BoxGeometry(...size);
            break;
        case 'sphere':
            geometry = new THREE.SphereGeometry(options.radius ?? 10, 32, 16);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(
                options.radius ?? 8, options.radius ?? 8, options.height ?? 20, 32
            );
            break;
        case 'cone':
            geometry = new THREE.ConeGeometry(options.radius ?? 8, options.height ?? 16, 32);
            break;
        case 'torus':
            geometry = new THREE.TorusGeometry(options.radius ?? 8, options.tube ?? 3, 16, 100);
            break;
        default:
            geometry = new THREE.BoxGeometry(10, 10, 10);
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    const pos = options.position ?? [0, 0, 0];
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Edges
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    mesh.add(new THREE.LineSegments(edges, edgeMat));
    
    // Metadata
    mesh.userData = {
        type: 'body',
        name: options.name ?? `BODY_${String(System.objects.length + 1).padStart(3, '0')}`,
        id: generateId(),
        material: 'AL-6061-T6',
        created: Date.now(),
        isKernelGeometry: false
    };
    
    scene.add(mesh);
    System.objects.push(mesh);
    
    // Record in history
    const cmd = new CreatePrimitiveCommand(scene, System.objects, mesh);
    commandManager.push(cmd);
    
    selectObject(mesh);
    log(`CREATED: ${mesh.userData.name} (FALLBACK)`, 'info');
    
    return mesh;
}

// ========================================
// SELECTION (delegates to SelectionManager)
// ========================================
function selectObject(object) {
    selectionManager.select(object, transformControl, System.transformMode);
    updateProperties();
}

function deselectObject() {
    selectionManager.deselect(transformControl);
}

function deleteSelected() {
    const selected = selectionManager.getSelected();
    if (!selected) return;
    
    const name = selected.userData.name;
    
    // Record in history
    const cmd = new DeleteCommand(scene, System.objects, selected);
    commandManager.execute(cmd);
    
    selectionManager.deselect(transformControl);
    
    log(`DELETED: ${name}`, 'warn');
}

// ========================================
// UNDO / REDO
// ========================================
function undo() {
    const cmd = commandManager.undo();
    if (cmd) {
        log(`UNDO: ${cmd.name}`, 'info');
        // Re-select if the object still exists
        selectionManager.deselect(transformControl);
    } else {
        log('NOTHING TO UNDO', 'warn');
    }
}

function redo() {
    const cmd = commandManager.redo();
    if (cmd) {
        log(`REDO: ${cmd.name}`, 'info');
        selectionManager.deselect(transformControl);
    } else {
        log('NOTHING TO REDO', 'warn');
    }
}

// ========================================
// TOOLS & TRANSFORM
// ========================================
function setTool(tool) {
    System.tool = tool;
    
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    
    if (DOM.canvas) {
        const cursors = {
            select: 'default',
            sketch: 'crosshair',
            line: 'crosshair',
            rectangle: 'crosshair',
            circle: 'crosshair',
            extrude: 'ns-resize',
            move: 'move'
        };
        DOM.canvas.style.cursor = cursors[tool] ?? 'default';
    }
    
    const transformTools = ['move', 'rotate', 'scale'];
    if (transformTools.includes(tool)) {
        System.transformMode = tool === 'move' ? 'translate' : tool;
        if (transformControl?.visible) {
            transformControl.setMode(System.transformMode);
        }
    }
    
    const toolMode = document.getElementById('tool-mode');
    if (toolMode) toolMode.textContent = tool.toUpperCase();
    
    log(`TOOL: ${tool.toUpperCase()}`, 'info');
}

function setView(view) {
    if (camera && controls) {
        const distance = camera.position.length();
        const target = controls.target.clone();
        
        switch(view) {
            case 'top':
                camera.position.set(target.x, distance, target.z);
                break;
            case 'front':
                camera.position.set(target.x, target.y, target.z + distance);
                break;
            case 'right':
                camera.position.set(target.x + distance, target.y, target.z);
                break;
            case 'left':
                camera.position.set(target.x - distance, target.y, target.z);
                break;
            case 'back':
                camera.position.set(target.x, target.y, target.z - distance);
                break;
            case 'iso':
                camera.position.set(distance * 0.6, distance * 0.6, distance * 0.6);
                break;
        }
        
        camera.lookAt(target);
        controls.update();
    }
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    System.view = view;
    log(`VIEW: ${view.toUpperCase()}`, 'info');
}

function setRenderMode(mode) {
    System.renderMode = mode;
    
    System.objects.forEach(obj => {
        if (!obj.material) return;
        
        switch(mode) {
            case 'shaded':
                obj.material.wireframe = false;
                obj.material.transparent = false;
                obj.material.opacity = 1;
                break;
            case 'wireframe':
                obj.material.wireframe = true;
                break;
            case 'xray':
                obj.material.wireframe = false;
                obj.material.transparent = true;
                obj.material.opacity = 0.5;
                break;
        }
    });
}

function zoomToFit() {
    if (!camera || !controls) {
        log('ZOOM FIT (3D NOT READY)', 'warn');
        return;
    }
    
    if (System.objects.length === 0) {
        log('NO OBJECTS TO FIT', 'warn');
        return;
    }
    
    const { center, size } = computeBoundingBox(System.objects);
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = calculateFitDistance(maxDim, camera.fov);
    
    const direction = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(center).add(direction.multiplyScalar(distance));
    controls.target.copy(center);
    controls.update();
    
    log('ZOOM FIT', 'info');
}

// ========================================
// UI INITIALIZATION
// ========================================
function initUI() {
    // Tool buttons (select, sketch, etc.)
    document.querySelectorAll('.tool-btn:not(.primitive-btn)').forEach(btn => {
        if (btn.dataset.tool) {
            btn.addEventListener('click', () => setTool(btn.dataset.tool));
        }
    });
    
    // Primitive creation buttons - dispatch commands!
    document.querySelectorAll('.primitive-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const primitiveType = btn.dataset.primitive;
            log(`CREATING ${primitiveType.toUpperCase()}...`, 'info');
            
            // Default sizes for each primitive type
            const defaults = {
                box: { size: [20, 20, 20], position: [0, 10, 0] },
                sphere: { radius: 10, position: [0, 10, 0] },
                cylinder: { radius: 8, height: 20, position: [0, 10, 0] },
                cone: { radius: 8, height: 16, position: [0, 8, 0] },
                torus: { radius: 10, tube: 3, position: [0, 13, 0] }
            };
            
            await createPrimitive(primitiveType, defaults[primitiveType] || {});
        });
    });
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => setView(btn.dataset.view));
    });
    
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            handleToggle(btn.dataset.toggle, btn.classList.contains('active'));
        });
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });
    
    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('collapsed');
        });
    });
    
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => handleMenuAction(item.dataset.action));
    });
    
    document.querySelectorAll('.header-btn').forEach(btn => {
        btn.addEventListener('click', () => handleMenuAction(btn.dataset.action));
    });
    
    document.querySelectorAll('[data-action="close-modal"], [data-action="cancel"]').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
    
    document.querySelectorAll('[data-action="create"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const selected = document.querySelector('.template-item.selected');
            if (selected) {
                const template = selected.dataset.template;
                if (template !== 'empty') createPrimitive(template);
            }
            closeModals();
        });
    });
    
    document.querySelectorAll('.template-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.template-item').forEach(t => t.classList.remove('selected'));
            item.classList.add('selected');
        });
    });
    
    const renderSelect = document.getElementById('render-mode');
    if (renderSelect) {
        renderSelect.addEventListener('change', (e) => setRenderMode(e.target.value));
    }
    
    const snapToggle = document.getElementById('snap-toggle');
    if (snapToggle) {
        snapToggle.addEventListener('click', () => {
            System.snap = !System.snap;
            snapToggle.classList.toggle('active', System.snap);
            snapToggle.textContent = `SNAP: ${System.snap ? 'ON' : 'OFF'}`;
        });
    }
    
    const gridToggle = document.getElementById('grid-toggle');
    if (gridToggle) {
        gridToggle.addEventListener('click', () => {
            System.grid = !System.grid;
            gridToggle.classList.toggle('active', System.grid);
            gridToggle.textContent = `GRID: ${System.grid ? 'ON' : 'OFF'}`;
            if (gridHelper) gridHelper.visible = System.grid;
        });
    }
    
    document.querySelectorAll('.viewcube .face').forEach(face => {
        face.addEventListener('click', () => {
            setView(face.classList[1]);
        });
    });
}

function handleToggle(toggle, active) {
    switch(toggle) {
        case 'grid':
            System.grid = active;
            if (gridHelper) gridHelper.visible = active;
            break;
        case 'axes':
            if (axesHelper) axesHelper.visible = active;
            break;
        case 'shadows':
            System.shadows = active;
            if (renderer) {
                renderer.shadowMap.enabled = active;
                scene.traverse(child => {
                    if (child.material) child.material.needsUpdate = true;
                });
            }
            break;
    }
}

function setTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `panel-${tab}`);
    });
}

function handleMenuAction(action) {
    switch(action) {
        case 'new':
            showModal('new-design-modal');
            break;
        case 'open':
            log('OPEN FILE...', 'info');
            break;
        case 'save':
            log('SAVED', 'success');
            break;
        case 'import':
            log('IMPORT...', 'info');
            break;
        case 'export':
            exportScene();
            break;
        case 'undo':
            undo();
            break;
        case 'redo':
            redo();
            break;
        case 'fit':
        case 'zoom-fit':
            zoomToFit();
            break;
        case 'front':
        case 'top':
        case 'right':
        case 'iso':
            setView(action);
            break;
        case 'settings':
            log('SETTINGS...', 'info');
            break;
        case 'help':
            showHelp();
            break;
        case 'close-modal':
        case 'cancel':
            closeModals();
            break;
    }
}

function showModal(id) {
    if (DOM.modalOverlay) DOM.modalOverlay.classList.remove('hidden');
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
}

function closeModals() {
    if (DOM.modalOverlay) DOM.modalOverlay.classList.add('hidden');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

// ========================================
// EVENT HANDLERS
// ========================================
function setupEvents() {
    window.addEventListener('resize', onResize);
    
    if (DOM.canvas) {
        DOM.canvas.addEventListener('mousedown', onMouseDown);
        DOM.canvas.addEventListener('mousemove', onMouseMove);
        DOM.canvas.addEventListener('mouseup', onMouseUp);
        DOM.canvas.addEventListener('contextmenu', onContextMenu);
        DOM.canvas.addEventListener('wheel', onWheel, { passive: false });
    }
    
    document.addEventListener('keydown', onKeyDown);
    
    if (DOM.commandInput) {
        DOM.commandInput.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'Enter':
                    executeCommand(DOM.commandInput.value);
                    DOM.commandInput.value = '';
                    hideSuggestions();
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    navigateHistory(-1);
                    break;
                    
                case 'ArrowDown':
                    e.preventDefault();
                    navigateHistory(1);
                    break;
                    
                case 'Tab':
                    e.preventDefault();
                    completeSuggestion();
                    break;
                    
                case 'Escape':
                    DOM.commandInput.value = '';
                    hideSuggestions();
                    DOM.commandInput.blur();
                    break;
            }
        });
        
        DOM.commandInput.addEventListener('input', (e) => {
            updateSuggestions(e.target.value);
        });
        
        // Focus command line with backtick
        document.addEventListener('keydown', (e) => {
            if (e.key === '`' && document.activeElement !== DOM.commandInput) {
                e.preventDefault();
                DOM.commandInput.focus();
            }
        });
    }
    
    // Hide context menu when clicking outside
    document.addEventListener('click', (e) => {
        if (DOM.contextMenu && !e.target.closest('.context-menu')) {
            DOM.contextMenu.classList.add('hidden');
        }
    });
}

/**
 * Navigate command history
 */
function navigateHistory(direction) {
    if (System.commandHistory.length === 0) return;
    
    System.commandHistoryIndex += direction;
    
    if (System.commandHistoryIndex < 0) {
        System.commandHistoryIndex = 0;
    }
    if (System.commandHistoryIndex >= System.commandHistory.length) {
        System.commandHistoryIndex = System.commandHistory.length;
        DOM.commandInput.value = '';
        return;
    }
    
    DOM.commandInput.value = System.commandHistory[System.commandHistoryIndex];
}

/**
 * Update autocomplete suggestions
 */
function updateSuggestions(input) {
    if (!input || input.includes(' ')) {
        hideSuggestions();
        return;
    }
    
    const suggestions = getCommandSuggestions(input);
    System.suggestions = suggestions;
    
    if (suggestions.length > 0 && suggestions.length <= 8) {
        showSuggestions(suggestions);
    } else {
        hideSuggestions();
    }
}

/**
 * Show autocomplete suggestions
 */
function showSuggestions(suggestions) {
    const hint = DOM.commandHint;
    if (!hint) return;
    
    const text = suggestions.map(s => s.name).join(' | ');
    hint.textContent = text;
    hint.classList.add('text-accent');
}

/**
 * Hide autocomplete suggestions
 */
function hideSuggestions() {
    const hint = DOM.commandHint;
    if (!hint) return;
    
    hint.textContent = 'READY // TYPE ? FOR HELP';
    hint.classList.remove('text-accent');
    System.suggestions = [];
}

/**
 * Complete with first suggestion
 */
function completeSuggestion() {
    if (System.suggestions.length > 0) {
        DOM.commandInput.value = System.suggestions[0].name + ' ';
        hideSuggestions();
    }
}

function onResize() {
    if (!DOM.viewport) return;
    
    const width = DOM.viewport.clientWidth;
    const height = DOM.viewport.clientHeight;
    
    if (renderer && camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    } else if (DOM.canvas) {
        DOM.canvas.width = width;
        DOM.canvas.height = height;
        drawFallbackCanvas();
    }
}

function onMouseDown(e) {
    if (!System.ready) return;
    
    if (!renderer) {
        log('WEBGL NOT AVAILABLE - USE SERVER', 'error');
        return;
    }
    
    System.mouse = updateMouseCoords(e, DOM.canvas);
    System.isDragging = true;
    
    if (e.button === 0 && System.tool === 'select') {
        const hit = performRaycast(System.mouse, camera, System.raycaster, System.objects);
        if (hit) {
            selectObject(hit);
        } else {
            deselectObject();
        }
    }
}

function onMouseMove(e) {
    if (!System.ready) return;
    
    System.mouse = updateMouseCoords(e, DOM.canvas);
    
    const worldPos = getWorldPosition(System.mouse, camera, System.raycaster, System.objects);
    if (worldPos) updateCursorDisplay(worldPos);
}

function onMouseUp() {
    System.isDragging = false;
}

function onContextMenu(e) {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY);
}

function onWheel() {
    // Let OrbitControls handle
}

function showContextMenu(x, y) {
    if (!DOM.contextMenu) return;
    DOM.contextMenu.style.left = `${x}px`;
    DOM.contextMenu.style.top = `${y}px`;
    DOM.contextMenu.classList.remove('hidden');
}

function onKeyDown(e) {
    // Prevent default for tool shortcuts when not in input
    const inInput = document.activeElement?.tagName === 'INPUT';
    
    // Ctrl shortcuts (always active)
    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'z':
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                return;
            case 'y':
                e.preventDefault();
                redo();
                return;
            case 'n':
                e.preventDefault();
                showModal('new-design-modal');
                return;
            case 's':
                e.preventDefault();
                log('SAVED', 'success');
                return;
        }
    }
    
    // Skip tool shortcuts when in input
    if (inInput) return;
    
    // Tool shortcuts
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 's':
                setTool('select');
                break;
            case 'c':
                setTool('sketch');
                break;
            case 'e':
                setTool('extrude');
                break;
            case 'l':
                setTool('line');
                break;
            case 'r':
                setTool('rectangle');
                break;
            case 'o':
                setTool('circle');
                break;
            case 'm':
                setTool('move');
                break;
            case 't':
                setTool('move');
                break;
            case 'delete':
            case 'backspace':
                deleteSelected();
                break;
            case 'escape':
                deselectObject();
                closeModals();
                break;
            case '1':
                setView('front');
                break;
            case '2':
                setView('top');
                break;
            case '3':
                setView('right');
                break;
            case '4':
                setView('iso');
                break;
            case 'f':
                zoomToFit();
                break;
        }
    }
    
    // Transform mode shortcuts (when object selected)
    const selected = selectionManager.getSelected();
    if (selected && transformControl?.visible) {
        switch(e.key.toLowerCase()) {
            case 't':
                System.transformMode = 'translate';
                transformControl.setMode('translate');
                log('MODE: TRANSLATE', 'info');
                break;
            case 'r':
                System.transformMode = 'rotate';
                transformControl.setMode('rotate');
                log('MODE: ROTATE', 'info');
                break;
            case 'g':
                System.transformMode = 'scale';
                transformControl.setMode('scale');
                log('MODE: SCALE', 'info');
                break;
        }
    }
}

// ========================================
// COMMANDS
// ========================================
async function executeCommand(cmd) {
    const command = cmd.trim();
    if (!command) return;
    
    log(`> ${command}`, 'info');
    
    // Add to command history
    if (System.commandHistory[System.commandHistory.length - 1] !== command) {
        System.commandHistory.push(command);
        if (System.commandHistory.length > 100) System.commandHistory.shift();
    }
    System.commandHistoryIndex = System.commandHistory.length;
    
    const parts = command.toLowerCase().split(' ');
    const action = parts[0];
    const args = parts.slice(1);
    
    // Handle primitives with optional parameters (e.g., "box 20 30 10")
    if (['box', 'cube', 'block'].includes(action)) {
        const w = parseFloat(args[0]) || 20;
        const h = parseFloat(args[1]) || w;
        const d = parseFloat(args[2]) || w;
        await createPrimitive('box', { size: [w, h, d], position: [0, h/2, 0] });
        return;
    }
    
    if (['sphere', 'ball'].includes(action)) {
        const r = parseFloat(args[0]) || 10;
        await createPrimitive('sphere', { radius: r, position: [0, r, 0] });
        return;
    }
    
    if (['cylinder', 'cyl'].includes(action)) {
        const r = parseFloat(args[0]) || 8;
        const h = parseFloat(args[1]) || 20;
        await createPrimitive('cylinder', { radius: r, height: h, position: [0, h/2, 0] });
        return;
    }
    
    if (action === 'cone') {
        const r = parseFloat(args[0]) || 8;
        const h = parseFloat(args[1]) || 16;
        await createPrimitive('cone', { radius: r, height: h, position: [0, h/2, 0] });
        return;
    }
    
    if (['torus', 'donut'].includes(action)) {
        const r = parseFloat(args[0]) || 8;
        const t = parseFloat(args[1]) || 3;
        await createPrimitive('torus', { radius: r, tube: t, position: [0, r + t, 0] });
        return;
    }
    
    // Other commands
    switch(action) {
        case '?':
        case 'help':
            showHelp();
            break;
        case 'clear':
        case 'clearall':
            clearScene();
            break;
        case 'fit':
        case 'zf':
        case 'zoomfit':
            zoomToFit();
            break;
        case 'undo':
        case 'u':
            undo();
            break;
        case 'redo':
        case 'y':
            redo();
            break;
        case 'delete':
        case 'del':
        case 'rm':
            deleteSelected();
            break;
        case 'grid':
            System.grid = !System.grid;
            if (gridHelper) gridHelper.visible = System.grid;
            const gridBtn = document.getElementById('grid-toggle');
            if (gridBtn) {
                gridBtn.classList.toggle('active', System.grid);
                gridBtn.textContent = `GRID: ${System.grid ? 'ON' : 'OFF'}`;
            }
            log(`GRID: ${System.grid ? 'ON' : 'OFF'}`, 'info');
            break;
        case 'snap':
            System.snap = !System.snap;
            const snapBtn = document.getElementById('snap-toggle');
            if (snapBtn) {
                snapBtn.classList.toggle('active', System.snap);
                snapBtn.textContent = `SNAP: ${System.snap ? 'ON' : 'OFF'}`;
            }
            log(`SNAP: ${System.snap ? 'ON' : 'OFF'}`, 'info');
            break;
        case 'kernel':
            if (isKernelReady()) {
                log('KERNEL: ONLINE (OCCT B-REP)', 'success');
            } else {
                log('KERNEL: OFFLINE (FALLBACK MODE)', 'warn');
            }
            break;
        case 'status':
            log(`OBJECTS: ${System.objects.length} | KERNEL: ${isKernelReady() ? 'ON' : 'OFF'} | FPS: ${System.fps}`, 'info');
            break;
        default:
            // Try the advanced command system
            try {
                const result = await execCmd(command);
                if (result.success && result.result !== undefined) {
                    log(String(result.result), 'info');
                }
            } catch (e) {
                log(`UNKNOWN: ${action}`, 'error');
            }
    }
}

function showHelp() {
    const help = `
╔═══════════════════════════════════════════════════════════╗
║                    Ameri-CAD COMMANDS                     ║
╠═══════════════════════════════════════════════════════════╣
║ PRIMITIVES (uses real B-Rep kernel when available):       ║
║   box [w] [h] [d]      Create box (e.g., "box 20 10 30")  ║
║   sphere [r]           Create sphere (e.g., "sphere 15")  ║
║   cylinder [r] [h]     Create cylinder ("cyl 8 20")       ║
║   cone [r] [h]         Create cone                        ║
║   torus [r] [t]        Create torus ("torus 10 3")        ║
╠═══════════════════════════════════════════════════════════╣
║ GENERAL:                                                  ║
║   undo / redo          Undo/redo (Ctrl+Z / Ctrl+Y)        ║
║   delete / del         Delete selected                    ║
║   clear                Clear entire scene                 ║
║   fit                  Zoom to fit all                    ║
║   grid                 Toggle grid                        ║
║   snap                 Toggle snap                        ║
║   status               Show system status                 ║
║   kernel               Show kernel status                 ║
╠═══════════════════════════════════════════════════════════╣
║ KEYBOARD SHORTCUTS:                                       ║
║   \`         Focus command line                           ║
║   Tab       Autocomplete command                          ║
║   ↑/↓       Command history                               ║
║   1-4       View: Front/Top/Right/Iso                     ║
║   F         Zoom to fit                                   ║
║   Delete    Remove selected                               ║
║   Ctrl+Z    Undo                                          ║
╚═══════════════════════════════════════════════════════════╝
`;
    console.log(help);
    log('HELP PRINTED TO CONSOLE (F12)', 'info');
}

function clearScene() {
    System.objects.forEach(obj => scene.remove(obj));
    System.objects = [];
    selectionManager.deselect(transformControl);
    commandManager.clear();
    log('SCENE CLEARED', 'warn');
}

// ========================================
// EXPORT
// ========================================
function exportScene() {
    log('EXPORT: STL FORMAT', 'info');
    
    const selected = selectionManager.getSelected();
    const objects = selected ? [selected] : System.objects;
    
    if (objects.length === 0) {
        log('NO OBJECTS TO EXPORT', 'error');
        return;
    }
    
    let stl = 'solid exported\n';
    
    objects.forEach(obj => {
        if (!obj.geometry) return;
        
        const posAttribute = obj.geometry.attributes.position;
        if (!posAttribute) return;
        
        for (let i = 0; i < posAttribute.count; i += 3) {
            const v1 = new THREE.Vector3().fromBufferAttribute(posAttribute, i);
            const v2 = new THREE.Vector3().fromBufferAttribute(posAttribute, i + 1);
            const v3 = new THREE.Vector3().fromBufferAttribute(posAttribute, i + 2);
            
            v1.applyMatrix4(obj.matrixWorld);
            v2.applyMatrix4(obj.matrixWorld);
            v3.applyMatrix4(obj.matrixWorld);
            
            const normal = new THREE.Vector3()
                .subVectors(v2, v1)
                .cross(new THREE.Vector3().subVectors(v3, v1))
                .normalize();
            
            stl += `  facet normal ${normal.x} ${normal.y} ${normal.z}\n`;
            stl += '    outer loop\n';
            stl += `      vertex ${v1.x} ${v1.y} ${v1.z}\n`;
            stl += `      vertex ${v2.x} ${v2.y} ${v2.z}\n`;
            stl += `      vertex ${v3.x} ${v3.y} ${v3.z}\n`;
            stl += '    endloop\n';
            stl += '  endfacet\n';
        }
    });
    
    stl += 'endsolid exported\n';
    
    const blob = new Blob([stl], { type: 'application/sla' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.stl';
    a.click();
    URL.revokeObjectURL(url);
    
    log('EXPORTED: export.stl', 'success');
}

// ========================================
// UI UPDATES
// ========================================
function updateProperties() {
    const obj = selectionManager.getSelected();
    if (!obj) return;
    
    const posInputs = document.querySelectorAll('.vector-inputs')[0]?.querySelectorAll('input');
    if (posInputs) {
        posInputs[0].value = obj.position.x.toFixed(3);
        posInputs[1].value = obj.position.y.toFixed(3);
        posInputs[2].value = obj.position.z.toFixed(3);
    }
    
    const rotInputs = document.querySelectorAll('.vector-inputs')[1]?.querySelectorAll('input');
    if (rotInputs) {
        rotInputs[0].value = radToDeg(obj.rotation.x).toFixed(1);
        rotInputs[1].value = radToDeg(obj.rotation.y).toFixed(1);
        rotInputs[2].value = radToDeg(obj.rotation.z).toFixed(1);
    }
    
    const scaleInputs = document.querySelectorAll('.vector-inputs')[2]?.querySelectorAll('input');
    if (scaleInputs) {
        scaleInputs[0].value = obj.scale.x.toFixed(3);
        scaleInputs[1].value = obj.scale.y.toFixed(3);
        scaleInputs[2].value = obj.scale.z.toFixed(3);
    }
}

function updateCursorDisplay(pos) {
    const xEl = document.getElementById('cursor-x');
    const yEl = document.getElementById('cursor-y');
    const zEl = document.getElementById('cursor-z');
    
    if (xEl) xEl.textContent = pos.x.toFixed(3);
    if (yEl) yEl.textContent = pos.y.toFixed(3);
    if (zEl) zEl.textContent = pos.z.toFixed(3);
}

function log(message, type = 'info') {
    console.log(`[Ameri-CAD] ${message}`);
    
    const hint = DOM.commandHint || document.getElementById('command-hint');
    if (hint) {
        hint.textContent = message;
        hint.classList.remove('text-accent', 'text-success', 'text-alert');
        
        switch(type) {
            case 'success':
                hint.classList.add('text-success');
                break;
            case 'error':
                hint.classList.add('text-alert');
                break;
            case 'warn':
                hint.classList.add('text-accent');
                break;
        }
    }
}

// ========================================
// RENDER LOOP
// ========================================
function render() {
    requestAnimationFrame(render);
    
    System.frameCount++;
    const now = performance.now();
    if (now - System.lastTime >= 1000) {
        System.fps = System.frameCount;
        System.frameCount = 0;
        System.lastTime = now;
        
        const fpsEl = document.getElementById('fps-counter');
        if (fpsEl) fpsEl.textContent = System.fps;
    }
    
    if (renderer && scene && camera) {
        if (controls) controls.update();
        updateViewCube();
        renderer.render(scene, camera);
    }
}

function updateViewCube() {
    const viewcube = document.getElementById('viewcube');
    if (!viewcube || !camera) return;
    
    const rotX = -camera.rotation.x * (180 / Math.PI);
    const rotY = -camera.rotation.y * (180 / Math.PI);
    
    viewcube.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
}

// ========================================
// PUBLIC API
// ========================================
window.AmericaD = {
    System,
    scene,
    camera,
    renderer,
    controls,
    selectionManager,
    commandManager,
    createPrimitive,
    setTool,
    setView,
    selectObject,
    deselectObject,
    deleteSelected,
    undo,
    redo,
    zoomToFit,
    clearScene,
    exportScene,
    log
};
