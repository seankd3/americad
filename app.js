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

// ========================================
// SYSTEM STATE
// ========================================
const System = {
    version: '2.1.0-LA',
    ready: false,
    loading: true,
    
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
    lastTime: performance.now()
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
    }, 5000);
    
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

function createPrimitive(type, options = {}) {
    if (!renderer || !scene) {
        log('CREATE ' + type.toUpperCase() + ' (WEBGL NOT READY)', 'warn');
        return null;
    }
    
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
        created: Date.now()
    };
    
    scene.add(mesh);
    System.objects.push(mesh);
    
    // Record in history
    const cmd = new CreatePrimitiveCommand(scene, System.objects, mesh);
    commandManager.push(cmd);
    
    selectObject(mesh);
    log(`CREATED: ${mesh.userData.name}`, 'info');
    
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
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => setTool(btn.dataset.tool));
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
            if (e.key === 'Enter') {
                executeCommand(DOM.commandInput.value);
                DOM.commandInput.value = '';
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        if (DOM.contextMenu && !e.target.closest('.context-menu')) {
            DOM.contextMenu.classList.add('hidden');
        }
    });
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
function executeCommand(cmd) {
    const command = cmd.trim().toLowerCase();
    if (!command) return;
    
    log(`> ${command}`, 'info');
    
    const parts = command.split(' ');
    const action = parts[0];
    
    switch(action) {
        case '?':
        case 'help':
            showHelp();
            break;
        case 'box':
            createPrimitive('box');
            break;
        case 'sphere':
            createPrimitive('sphere');
            break;
        case 'cylinder':
            createPrimitive('cylinder');
            break;
        case 'cone':
            createPrimitive('cone');
            break;
        case 'torus':
            createPrimitive('torus');
            break;
        case 'clear':
            clearScene();
            break;
        case 'fit':
            zoomToFit();
            break;
        case 'undo':
            undo();
            break;
        case 'redo':
            redo();
            break;
        case 'grid':
            System.grid = !System.grid;
            if (gridHelper) gridHelper.visible = System.grid;
            const gridBtn = document.getElementById('grid-toggle');
            if (gridBtn) {
                gridBtn.classList.toggle('active', System.grid);
                gridBtn.textContent = `GRID: ${System.grid ? 'ON' : 'OFF'}`;
            }
            break;
        case 'snap':
            System.snap = !System.snap;
            const snapBtn = document.getElementById('snap-toggle');
            if (snapBtn) {
                snapBtn.classList.toggle('active', System.snap);
                snapBtn.textContent = `SNAP: ${System.snap ? 'ON' : 'OFF'}`;
            }
            break;
        default:
            log(`UNKNOWN: ${action}`, 'error');
    }
}

function showHelp() {
    const help = `
COMMANDS:
  box sphere cylinder cone torus  CREATE PRIMITIVE
  clear                           CLEAR SCENE
  fit                             ZOOM TO FIT
  undo / redo                     UNDO/REDO (Ctrl+Z/Ctrl+Shift+Z)
  grid                            TOGGLE GRID
  snap                            TOGGLE SNAP
  help                            SHOW THIS HELP

SHORTCUTS:
  S=Select C=Sketch E=Extrude
  L=Line R=Rect O=Circle
  T=Move R=Rotate G=Scale
  1=Front 2=Top 3=Right 4=Iso
  F=Fit Delete=Remove ESC=Cancel
  Ctrl+Z=Undo Ctrl+Shift+Z=Redo
`;
    console.log(help);
    log('HELP IN CONSOLE (F12)', 'info');
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
