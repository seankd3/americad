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
import { initializeSystem, executeCommand as execCmd, isKernelReady, getCommandSuggestions, getContext } from './src/core/app-integration.js';
import { kernel, meshToThreeGeometry } from './src/kernel/bridge.js';

// Modular AmericaD class - the unified CAD architecture
import { AmericaD, app as americadApp } from './src/main.js';

// Feature tree UI
import { FeatureTreeUI, addFeatureTreeStyles } from './src/ui/feature-tree.js';
import { initPropertyPanel } from './src/ui/property-panel.js';

// Sketch system
import { sketchManager, SketchMode, ConstraintType, SketchLine, SketchCircle } from './src/sketch/sketch-manager.js';
import { SketchRenderer } from './src/sketch/sketch-renderer.js';
import { solveSketch } from './src/sketch/constraint-solver.js';

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
    
    // Sketch Mode State
    inSketchMode: false,
    activeSketch: null,
    sketchPlane: 'xy',
    
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
let sketchRenderer; // For 2D sketch visualization
let featureTreeUI; // Feature tree UI component
let propertyPanel; // Property panel UI component

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
        
        // Initialize the modular AmericaD class and wire it to the scene
        try {
            await americadApp.init(THREE);
            americadApp.setScene(scene, camera, renderer, controls, transformControl);
            System.americad = americadApp;
            
            // Connect measureTool to the command context
            const context = getContext();
            if (context && americadApp.measureTool) {
                context.measureTool = americadApp.measureTool;
                context.app = americadApp;
                log('MEASURE TOOL READY', 'success');
            }
            
            log('DOCUMENT MODEL READY', 'success');
        } catch (err) {
            console.warn('[Ameri-CAD] AmericaD class init warning:', err);
            // Non-fatal - system still works without DocumentModel
        }
        
        // Initialize the feature tree UI
        initFeatureTreeUI();
        
        // Update status indicator
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.style.backgroundColor = 'var(--success)';
        }
        
    } catch (error) {
        console.error('[Ameri-CAD] Kernel init failed:', error);
        log('KERNEL FALLBACK MODE (THREE.JS)', 'warn');
        
        // Still try to init feature tree with fallback
        initFeatureTreeUI();
    }
}

/**
 * Initialize the Feature Tree UI and wire callbacks
 */
function initFeatureTreeUI() {
    // Add feature tree styles
    addFeatureTreeStyles();
    
    // Get the document model
    const docModel = System.americad?.document;
    if (!docModel) {
        console.warn('[Ameri-CAD] DocumentModel not available for feature tree');
        return;
    }
    
    // Create the feature tree UI
    featureTreeUI = new FeatureTreeUI('#feature-tree', docModel);
    
    // Wire selection: clicking tree item selects object in 3D viewport
    featureTreeUI.onFeatureSelect = (featureId) => {
        const feature = docModel.getFeature(featureId);
        if (!feature) return;
        
        // Find the mesh in System.objects by matching IDs
        const mesh = System.objects.find(obj => 
            obj.userData?.id === featureId || 
            obj.userData?.kernelId === feature.kernelId ||
            obj.uuid === feature.meshId
        );
        
        if (mesh) {
            selectObject(mesh);
            log(`SELECTED: ${feature.name}`, 'info');
        }
    };
    
    // Wire double-click to edit parameters (placeholder for future)
    featureTreeUI.onFeatureDoubleClick = (featureId) => {
        const feature = docModel.getFeature(featureId);
        if (feature) {
            log(`EDIT: ${feature.name} (params: ${JSON.stringify(feature.params)})`, 'info');
            // TODO: Show parameter edit dialog
        }
    };
    
    // Wire visibility toggle
    featureTreeUI.onVisibilityToggle = (featureId, visible) => {
        const feature = docModel.getFeature(featureId);
        if (!feature) return;
        
        // Update feature visibility
        feature.visible = visible;
        
        // Find and update the mesh
        const mesh = System.objects.find(obj => 
            obj.userData?.id === featureId || 
            obj.userData?.kernelId === feature.kernelId ||
            obj.uuid === feature.meshId
        );
        
        if (mesh) {
            mesh.visible = visible;
        }
        
        // Also update in evaluator if using unified architecture
        if (System.americad?.evaluator) {
            System.americad.evaluator.setVisibility(featureId, visible);
        }
        
        log(`${feature.name}: ${visible ? 'SHOWN' : 'HIDDEN'}`, 'info');
        featureTreeUI.render();
    };
    
    // Wire delete from tree
    featureTreeUI.onFeatureDelete = (featureId) => {
        const feature = docModel.getFeature(featureId);
        if (!feature) return;
        
        const name = feature.name;
        
        // Find the mesh
        const mesh = System.objects.find(obj => 
            obj.userData?.id === featureId || 
            obj.userData?.kernelId === feature.kernelId ||
            obj.uuid === feature.meshId
        );
        
        // Remove from scene and objects array
        if (mesh) {
            scene.remove(mesh);
            System.objects = System.objects.filter(o => o !== mesh);
            
            // Dispose geometry and material
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            
            // Deselect if selected
            if (selectionManager.getSelected() === mesh) {
                selectionManager.deselect(transformControl);
            }
        }
        
        // Clean up kernel shape
        if (feature.kernelId && kernel) {
            kernel.deleteShape(feature.kernelId).catch(() => {});
        }
        
        // Remove from document model (will trigger tree update via callback)
        docModel.untrackExternalFeature(featureId, true);
        
        log(`DELETED: ${name}`, 'warn');
    };
    
    // Wire rename
    featureTreeUI.onFeatureRename = (featureId, newName) => {
        const feature = docModel.getFeature(featureId);
        if (!feature) return;
        
        const oldName = feature.name;
        feature.name = newName;
        
        // Also update the mesh userData
        const mesh = System.objects.find(obj => 
            obj.userData?.id === featureId || 
            obj.userData?.kernelId === feature.kernelId ||
            obj.uuid === feature.meshId
        );
        
        if (mesh) {
            mesh.userData.name = newName;
            mesh.name = newName;
        }
        
        log(`RENAMED: ${oldName} → ${newName}`, 'info');
    };
    
    console.log('[Ameri-CAD] Feature tree UI initialized');
    
    // Initialize property panel
    propertyPanel = initPropertyPanel({
        document: docModel,
        onPropertyChange: async (featureId, type, value) => {
            const feature = docModel.getFeature(featureId);
            if (!feature) return;
            
            switch (type) {
                case 'name':
                    // Update feature name
                    feature.name = value;
                    docModel.modifiedAt = Date.now();
                    
                    // Update mesh userData
                    const mesh = System.objects.find(obj => obj.userData?.id === featureId);
                    if (mesh) mesh.userData.name = value;
                    
                    // Update feature tree
                    if (featureTreeUI) featureTreeUI.render();
                    log(`RENAMED: ${feature.name}`, 'info');
                    break;
                    
                case 'param':
                    // Update geometry with new parameters
                    feature.updateParams(value);
                    
                    // Regenerate geometry using the unified architecture
                    if (System.americad?.kernelReady && System.americad?.evaluator) {
                        await System.americad.evaluator.reEvaluateFromFeature(featureId);
                        
                        // Refresh property panel with new geometry info
                        const updatedMesh = System.americad.evaluator.getMesh(featureId);
                        if (propertyPanel && updatedMesh) {
                            propertyPanel.bind(feature, updatedMesh);
                        }
                    }
                    log(`UPDATED: ${feature.name} params`, 'info');
                    break;
                    
                case 'transform':
                    // Apply transform to mesh
                    const objMesh = System.objects.find(obj => obj.userData?.id === featureId);
                    if (objMesh) {
                        objMesh.position.set(value.position.x, value.position.y, value.position.z);
                        objMesh.rotation.set(
                            value.rotation.x * Math.PI / 180,
                            value.rotation.y * Math.PI / 180,
                            value.rotation.z * Math.PI / 180
                        );
                        objMesh.scale.set(value.scale.x, value.scale.y, value.scale.z);
                    }
                    break;
            }
        }
    });
    
    console.log('[Ameri-CAD] Property panel initialized');
}

/**
 * Update feature tree UI
 */
function updateFeatureTree() {
    if (featureTreeUI) {
        featureTreeUI.render();
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
            
            // Update property panel with selected feature
            if (propertyPanel) {
                const featureId = selected.userData?.id;
                const docModel = System.americad?.document || americadApp?.document;
                if (featureId && docModel) {
                    const feature = docModel.getFeature(featureId);
                    if (feature) {
                        propertyPanel.bind(feature, selected);
                    }
                }
            }
            
            log(`SELECTED: ${selected.userData.name}`, 'info');
        } else {
            // Clear property panel when nothing is selected
            if (propertyPanel) {
                propertyPanel.clear();
            }
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
    
    // Initialize sketch renderer
    sketchRenderer = new SketchRenderer(scene);
    
    // Set up sketch manager callbacks
    sketchManager.onSketchUpdate = (sketch, previewEntity) => {
        if (sketchRenderer && sketch) {
            sketchRenderer.renderSketch(sketch, sketchManager.selectedEntities);
            if (previewEntity) {
                sketchRenderer.renderPreview(previewEntity, sketch);
            }
        }
    };
    
    sketchManager.onModeChange = (mode, sketch) => {
        const modeEl = document.getElementById('tool-mode');
        if (modeEl) {
            if (mode === SketchMode.NONE) {
                modeEl.textContent = 'SELECT';
            } else {
                modeEl.textContent = `SKETCH: ${mode.toUpperCase()}`;
            }
        }
    };
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
    
    // Also track in AmericaD DocumentModel if available (unified architecture)
    if (System.americad?.document) {
        try {
            // Create a feature reference for the DocumentModel
            System.americad.document.trackExternalFeature({
                id: mesh.userData.id,
                kernelId: result.id,
                type: type,
                name: mesh.userData.name,
                mesh: mesh
            });
        } catch (err) {
            // Non-fatal - tracking is optional
            console.debug('[Ameri-CAD] Document tracking skipped:', err.message);
        }
    }
    
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
        bodyType: type,
        material: 'AL-6061-T6',
        created: Date.now(),
        isKernelGeometry: false
    };
    
    scene.add(mesh);
    System.objects.push(mesh);
    
    // Record in history
    const cmd = new CreatePrimitiveCommand(scene, System.objects, mesh);
    commandManager.push(cmd);
    
    // Track in DocumentModel for feature tree (unified architecture)
    if (System.americad?.document) {
        try {
            System.americad.document.trackExternalFeature({
                id: mesh.userData.id,
                type: type,
                name: mesh.userData.name,
                mesh: mesh
            });
        } catch (err) {
            console.debug('[Ameri-CAD] Document tracking skipped:', err.message);
        }
    }
    
    selectObject(mesh);
    log(`CREATED: ${mesh.userData.name} (FALLBACK)`, 'info');
    
    return mesh;
}

// ========================================
// SELECTION (delegates to SelectionManager)
// ========================================
let isSelectingObject = false; // Guard against selectObject ↔ featureTreeUI.selectFeature infinite loop

function selectObject(object) {
    if (isSelectingObject) return; // Prevent re-entry from tree callback
    isSelectingObject = true;
    
    try {
        selectionManager.select(object, transformControl, System.transformMode);
        updateProperties();
        
        // Sync selection with feature tree (won't trigger callback loop due to guard)
        if (featureTreeUI && object?.userData?.id) {
            featureTreeUI.selectFeature(object.userData.id);
        }
    } finally {
        isSelectingObject = false;
    }
}

function deselectObject() {
    if (isSelectingObject) return; // Prevent re-entry
    isSelectingObject = true;
    
    try {
        selectionManager.deselect(transformControl);
        
        // Clear feature tree selection
        if (featureTreeUI) {
            featureTreeUI.selectedFeatureId = null;
            featureTreeUI.render();
        }
    } finally {
        isSelectingObject = false;
    }
}

function deleteSelected() {
    const selected = selectionManager.getSelected();
    if (!selected) return;
    
    const name = selected.userData.name;
    const featureId = selected.userData.id;
    
    // Record in history
    const cmd = new DeleteCommand(scene, System.objects, selected);
    commandManager.execute(cmd);
    
    // Remove from document model (triggers feature tree update)
    if (featureId && System.americad?.document) {
        System.americad.document.untrackExternalFeature(featureId, true);
    }
    
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
    // Handle sketch mode entry
    if (tool === 'sketch') {
        if (!System.inSketchMode) {
            enterSketchMode('xy'); // Default to XY plane
        }
        return;
    }
    
    // Handle sketch tools when in sketch mode
    if (System.inSketchMode) {
        const sketchToolMap = {
            'line': SketchMode.LINE,
            'rectangle': SketchMode.RECTANGLE,
            'circle': SketchMode.CIRCLE,
            'arc': SketchMode.ARC,
            'spline': SketchMode.SPLINE,
            'select': SketchMode.SELECT
        };
        
        if (sketchToolMap[tool]) {
            setSketchTool(sketchToolMap[tool]);
            System.tool = tool;
            
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === tool);
            });
            return;
        }
    }
    
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
            spline: 'crosshair',
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

// ========================================
// SKETCH MODE
// ========================================

/**
 * Enter sketch mode on a plane
 */
function enterSketchMode(plane = 'xy') {
    if (System.inSketchMode) {
        log('ALREADY IN SKETCH MODE', 'warn');
        return;
    }
    
    // Create or get a sketch
    const sketchName = `SKETCH_${String(System.sketches.length + 1).padStart(3, '0')}`;
    const sketch = sketchManager.createSketch(sketchName, plane);
    System.sketches.push(sketch);
    System.activeSketch = sketch;
    System.inSketchMode = true;
    System.sketchPlane = plane;
    
    // Enter sketch editing
    sketchManager.enterSketch(sketch);
    sketchRenderer.enterSketch(sketch);
    
    // Set camera to view the plane
    setSketchView(plane);
    
    // Hide 3D grid, show sketch grid
    if (gridHelper) gridHelper.visible = false;
    
    // Change scene background to indicate sketch mode
    if (scene) {
        scene.userData.normalBackground = scene.background.clone();
        scene.background = new THREE.Color(0x0a0a18); // Slightly blue tint
    }
    
    // Disable orbit controls rotation (only pan/zoom in sketch mode)
    if (controls) {
        controls.enableRotate = false;
    }
    
    // Update UI
    updateSketchUI(true);
    
    log(`SKETCH MODE: ${plane.toUpperCase()} PLANE`, 'success');
}

/**
 * Exit sketch mode
 */
function exitSketchMode() {
    if (!System.inSketchMode) return;
    
    const sketch = System.activeSketch;
    
    // Exit sketch editing
    sketchManager.exitSketch();
    sketchRenderer.exitSketch();
    
    System.inSketchMode = false;
    System.activeSketch = null;
    
    // Restore 3D view
    if (gridHelper) gridHelper.visible = System.grid;
    
    // Restore scene background
    if (scene && scene.userData.normalBackground) {
        scene.background = scene.userData.normalBackground;
    }
    
    // Re-enable orbit controls
    if (controls) {
        controls.enableRotate = true;
    }
    
    // Update UI
    updateSketchUI(false);
    
    // Reset to select tool
    setTool('select');
    
    log('EXITED SKETCH MODE', 'info');
    
    return sketch;
}

/**
 * Apply dimension (length) constraint to selected sketch entities
 */
async function applyDimensionConstraint(value) {
    if (!System.inSketchMode || !System.activeSketch) {
        return { success: false, error: 'No active sketch' };
    }
    
    const sketch = System.activeSketch;
    const selectedEntities = [];
    
    // Find selected lines and circles
    for (const id of sketchManager.selectedEntities) {
        const entity = sketch.getEntity(id);
        if (entity) {
            if (entity instanceof SketchLine) {
                selectedEntities.push({ entity, type: 'line', id });
            } else if (entity instanceof SketchCircle) {
                selectedEntities.push({ entity, type: 'circle', id });
            }
        }
    }
    
    if (selectedEntities.length === 0) {
        return { success: false, error: 'Select a line or circle first' };
    }
    
    let addedCount = 0;
    
    for (const { entity, type, id } of selectedEntities) {
        // Check if already has a length/radius constraint
        const constraintType = type === 'circle' ? ConstraintType.RADIUS : ConstraintType.LENGTH;
        const existing = Array.from(sketch.constraints.values())
            .filter(c => c.entities.includes(id) && 
                        (c.type === ConstraintType.LENGTH || c.type === ConstraintType.RADIUS));
        
        if (existing.length > 0) {
            // Update existing constraint value
            existing[0].value = value;
        } else {
            // Add new constraint
            sketch.addConstraint(constraintType, [id], value);
            addedCount++;
        }
    }
    
    // Solve the sketch to apply constraints
    const result = solveSketch(sketch);
    
    // Update the visual representation
    updateSketchView();
    
    return { 
        success: true, 
        value: value,
        count: addedCount || selectedEntities.length,
        solverStatus: result.status,
        converged: result.converged
    };
}

/**
 * Apply radius constraint to selected circles
 */
async function applyRadiusConstraint(value) {
    if (!System.inSketchMode || !System.activeSketch) {
        return { success: false, error: 'No active sketch' };
    }
    
    const sketch = System.activeSketch;
    const selectedCircles = [];
    
    // Find selected circles
    for (const id of sketchManager.selectedEntities) {
        const entity = sketch.getEntity(id);
        if (entity instanceof SketchCircle) {
            selectedCircles.push({ entity, id });
        }
    }
    
    if (selectedCircles.length === 0) {
        return { success: false, error: 'Select a circle first' };
    }
    
    let addedCount = 0;
    
    for (const { entity, id } of selectedCircles) {
        // Check if already has a radius constraint
        const existing = Array.from(sketch.constraints.values())
            .filter(c => c.entities.includes(id) && c.type === ConstraintType.RADIUS);
        
        if (existing.length > 0) {
            existing[0].value = value;
        } else {
            sketch.addConstraint(ConstraintType.RADIUS, [id], value);
            addedCount++;
        }
    }
    
    // Solve the sketch
    const result = solveSketch(sketch);
    
    // Update visuals
    updateSketchView();
    
    return { 
        success: true, 
        value: value,
        count: addedCount || selectedCircles.length,
        solverStatus: result.status,
        converged: result.converged
    };
}

/**
 * Update sketch view after constraints change
 */
function updateSketchView() {
    if (!System.activeSketch || !sketchRenderer) return;
    
    sketchRenderer.renderSketch(System.activeSketch, sketchManager.selectedEntities);
}

/**
 * Set camera view for sketch plane
 */
function setSketchView(plane) {
    if (!camera || !controls) return;
    
    const distance = 100;
    const target = controls.target.clone();
    
    switch (plane) {
        case 'xy':
            // Look down Z axis
            camera.position.set(target.x, target.y, target.z + distance);
            camera.up.set(0, 1, 0);
            break;
        case 'xz':
            // Look down Y axis (top view)
            camera.position.set(target.x, target.y + distance, target.z);
            camera.up.set(0, 0, -1);
            break;
        case 'yz':
            // Look down X axis (right view)
            camera.position.set(target.x + distance, target.y, target.z);
            camera.up.set(0, 1, 0);
            break;
    }
    
    camera.lookAt(target);
    controls.update();
}

/**
 * Update UI for sketch mode
 */
function updateSketchUI(inSketch) {
    // Update tool buttons visibility
    const sketchTools = document.querySelectorAll('[data-tool="line"], [data-tool="rectangle"], [data-tool="circle"], [data-tool="arc"]');
    sketchTools.forEach(btn => {
        btn.classList.toggle('sketch-active', inSketch);
    });
    
    // Add/remove exit sketch button and mode indicator
    let exitBtn = document.getElementById('exit-sketch-btn');
    let modeIndicator = document.getElementById('sketch-mode-indicator');
    
    if (inSketch) {
        // Create exit button
        if (!exitBtn) {
            const toolbar = document.querySelector('.viewport-toolbar .toolbar-left-group');
            if (toolbar) {
                exitBtn = document.createElement('button');
                exitBtn.id = 'exit-sketch-btn';
                exitBtn.className = 'view-btn sketch-exit-btn';
                exitBtn.textContent = '✓ FINISH SKETCH';
                exitBtn.style.backgroundColor = 'var(--success)';
                exitBtn.style.color = 'var(--bg-100)';
                exitBtn.style.marginLeft = '10px';
                exitBtn.addEventListener('click', exitSketchMode);
                toolbar.appendChild(exitBtn);
            }
        }
        
        // Create sketch mode indicator overlay
        if (!modeIndicator) {
            const viewport = document.getElementById('viewport');
            if (viewport) {
                modeIndicator = document.createElement('div');
                modeIndicator.id = 'sketch-mode-indicator';
                modeIndicator.innerHTML = `
                    <div style="
                        position: absolute;
                        top: 10px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: linear-gradient(135deg, #0066cc, #0044aa);
                        color: #fff;
                        padding: 8px 20px;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 12px;
                        font-weight: bold;
                        letter-spacing: 0.1em;
                        box-shadow: 0 2px 8px rgba(0,100,200,0.4);
                        z-index: 100;
                        pointer-events: none;
                        border: 1px solid #0088ff;
                    ">
                        ✎ SKETCH MODE — ${System.sketchPlane.toUpperCase()} PLANE
                    </div>
                    <div style="
                        position: absolute;
                        bottom: 50px;
                        left: 10px;
                        background: rgba(0,50,100,0.8);
                        color: #66ccff;
                        padding: 10px;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 11px;
                        line-height: 1.6;
                        z-index: 100;
                        border: 1px solid #004488;
                    ">
                        <div><b>L</b> - Line</div>
                        <div><b>R</b> - Rectangle</div>
                        <div><b>O</b> - Circle</div>
                        <div><b>A</b> - Arc (3-point)</div>
                        <div><b>Esc</b> - Cancel/Exit</div>
                        <div><b>Enter</b> - Finish</div>
                    </div>
                `;
                viewport.appendChild(modeIndicator);
            }
        }
    } else {
        if (exitBtn) exitBtn.remove();
        if (modeIndicator) modeIndicator.remove();
    }
    
    // Update status bar
    const statusItem = document.querySelector('.status-left .status-item:first-child span:last-child');
    if (statusItem) {
        statusItem.textContent = inSketch ? 'SKETCH MODE' : 'SYSTEM READY';
    }
    
    // Update status indicator color
    const statusIndicator = document.querySelector('.status-indicator');
    if (statusIndicator) {
        statusIndicator.style.backgroundColor = inSketch ? '#0088ff' : 'var(--success)';
    }
}

/**
 * Set sketch drawing mode
 */
function setSketchTool(mode) {
    if (!System.inSketchMode) {
        log('ENTER SKETCH MODE FIRST', 'warn');
        return;
    }
    
    sketchManager.setMode(mode);
    
    // Update canvas cursor
    if (DOM.canvas) {
        DOM.canvas.style.cursor = mode === SketchMode.SELECT ? 'default' : 'crosshair';
    }
    
    log(`SKETCH TOOL: ${mode.toUpperCase()}`, 'info');
}

/**
 * Extrude the active sketch
 */
async function extrudeSketch(height) {
    if (!System.activeSketch && System.sketches.length === 0) {
        log('NO SKETCH TO EXTRUDE', 'error');
        return;
    }
    
    // Get the sketch to extrude
    const sketch = System.activeSketch || System.sketches[System.sketches.length - 1];
    
    // Exit sketch mode if still in it
    if (System.inSketchMode) {
        exitSketchMode();
    }
    
    // Find closed profiles (rectangles, circles, or closed line chains)
    const profiles = findClosedProfiles(sketch);
    
    if (profiles.length === 0) {
        log('NO CLOSED PROFILES TO EXTRUDE', 'error');
        return;
    }
    
    log(`EXTRUDING ${profiles.length} PROFILE(S) BY ${height}MM...`, 'info');
    
    // Extrude each profile
    for (const profile of profiles) {
        await extrudeProfile(profile, sketch, height);
    }
}

/**
 * Find closed profiles in a sketch
 * Uses the sketch's built-in profile detection
 */
function findClosedProfiles(sketch) {
    // Use the sketch's improved profile detection
    if (sketch.getClosedProfiles) {
        return sketch.getClosedProfiles();
    }
    
    // Fallback for older sketches
    const profiles = [];
    
    // Rectangles are always closed profiles
    for (const rect of sketch.rectangles.values()) {
        profiles.push({
            type: 'rectangle',
            entity: rect,
            points: rect.points.map(p => ({ x: p.x, y: p.y })),
            width: Math.abs(rect.p2.x - rect.p1.x),
            height: Math.abs(rect.p4.y - rect.p1.y),
            center: {
                x: (rect.p1.x + rect.p3.x) / 2,
                y: (rect.p1.y + rect.p3.y) / 2
            }
        });
    }
    
    // Circles are closed profiles
    for (const circle of sketch.circles.values()) {
        profiles.push({
            type: 'circle',
            entity: circle,
            center: { x: circle.center.x, y: circle.center.y },
            radius: circle.radius
        });
    }
    
    return profiles;
}

/**
 * Extrude a profile into a 3D body
 * Uses kernel B-Rep extrusion when available, falls back to primitives
 */
async function extrudeProfile(profile, sketch, height) {
    const plane = sketch.plane;
    const name = `EXTRUDE_${String(System.objects.length + 1).padStart(3, '0')}`;
    
    // Try kernel-based extrusion for real B-Rep geometry
    if (isKernelReady()) {
        try {
            log('EXTRUDING VIA KERNEL...', 'info');
            
            const result = await kernel.extrudeSketchProfile(profile, height, plane);
            
            // Convert kernel mesh to Three.js
            const geometry = meshToThreeGeometry(result.mesh, THREE);
            
            const material = new THREE.MeshStandardMaterial({
                color: 0x808080,
                metalness: 0.4,
                roughness: 0.6
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
                name: name,
                id: generateId(),
                kernelId: result.id,
                bodyType: 'extrude',
                material: 'AL-6061-T6',
                created: Date.now(),
                isKernelGeometry: true,
                sourceProfile: profile.type,
                sketchPlane: plane
            };
            
            scene.add(mesh);
            System.objects.push(mesh);
            
            // Track in DocumentModel
            if (System.americad?.document) {
                System.americad.document.trackExternalFeature({
                    id: mesh.userData.id,
                    kernelId: result.id,
                    type: 'extrude',
                    name: name,
                    mesh: mesh
                });
            }
            
            selectObject(mesh);
            log(`EXTRUDED: ${profile.type.toUpperCase()} (B-REP)`, 'success');
            return mesh;
            
        } catch (error) {
            console.warn('[Ameri-CAD] Kernel extrude failed, using fallback:', error);
            log('KERNEL EXTRUDE FAILED - USING FALLBACK', 'warn');
        }
    }
    
    // Fallback to creating primitives
    if (profile.type === 'rectangle') {
        const width = profile.width;
        const depth = profile.height;
        const centerX = profile.center.x;
        const centerY = profile.center.y;
        
        let position;
        let size;
        
        switch (plane) {
            case 'xy':
                position = [centerX, centerY, height / 2];
                size = [width, depth, height];
                break;
            case 'xz':
                position = [centerX, height / 2, centerY];
                size = [width, height, depth];
                break;
            case 'yz':
                position = [height / 2, centerY, centerX];
                size = [height, depth, width];
                break;
            default:
                position = [centerX, centerY, height / 2];
                size = [width, depth, height];
        }
        
        await createPrimitive('box', { size, position, name });
        log(`EXTRUDED: BOX ${width.toFixed(1)} x ${depth.toFixed(1)} x ${height}`, 'success');
    }
    else if (profile.type === 'circle') {
        const radius = profile.radius;
        const cx = profile.center.x;
        const cy = profile.center.y;
        
        let position;
        
        switch (plane) {
            case 'xy': position = [cx, cy, height / 2]; break;
            case 'xz': position = [cx, height / 2, cy]; break;
            case 'yz': position = [height / 2, cy, cx]; break;
            default: position = [cx, cy, height / 2];
        }
        
        await createPrimitive('cylinder', { radius, height, position, name });
        log(`EXTRUDED: CYLINDER R${radius.toFixed(1)} x H${height}`, 'success');
    }
    else if (profile.type === 'polygon') {
        // Polygon profiles can only be extruded with kernel
        log('POLYGON EXTRUDE REQUIRES KERNEL', 'error');
    }
}

/**
 * Revolve the active sketch around an axis
 * @param {number} angle - Revolution angle in degrees (default 360)
 * @param {string} axisName - Axis name ('x', 'y', or 'z')
 */
async function revolveSketch(angle = 360, axisName = 'y') {
    if (!System.activeSketch && System.sketches.length === 0) {
        log('NO SKETCH TO REVOLVE', 'error');
        return;
    }
    
    // Get the sketch to revolve
    const sketch = System.activeSketch || System.sketches[System.sketches.length - 1];
    
    // Exit sketch mode if still in it
    if (System.inSketchMode) {
        exitSketchMode();
    }
    
    // Find closed profiles (rectangles, circles, or closed line chains)
    const profiles = findClosedProfiles(sketch);
    
    if (profiles.length === 0) {
        log('NO CLOSED PROFILES TO REVOLVE', 'error');
        return;
    }
    
    log(`REVOLVING ${profiles.length} PROFILE(S) BY ${angle}°...`, 'info');
    
    // Revolve each profile
    for (const profile of profiles) {
        await revolveProfile(profile, sketch, angle, axisName);
    }
}

/**
 * Revolve a profile into a 3D body around an axis
 * @param {Object} profile - Profile data
 * @param {Object} sketch - Source sketch
 * @param {number} angle - Revolution angle in degrees
 * @param {string} axisName - Axis name ('x', 'y', 'z')
 */
async function revolveProfile(profile, sketch, angle, axisName) {
    const plane = sketch.plane;
    const name = `REVOLVE_${String(System.objects.length + 1).padStart(3, '0')}`;
    
    // Determine axis based on name and plane
    // For lathe-like revolve, we typically revolve around an axis at the edge of the profile
    let axis;
    
    // Calculate profile bounds for axis positioning
    let profileMinX = 0, profileMaxX = 0, profileMinY = 0, profileMaxY = 0;
    if (profile.type === 'rectangle') {
        profileMinX = profile.center.x - profile.width / 2;
        profileMaxX = profile.center.x + profile.width / 2;
        profileMinY = profile.center.y - profile.height / 2;
        profileMaxY = profile.center.y + profile.height / 2;
    } else if (profile.type === 'circle') {
        profileMinX = profile.center.x - profile.radius;
        profileMaxX = profile.center.x + profile.radius;
        profileMinY = profile.center.y - profile.radius;
        profileMaxY = profile.center.y + profile.radius;
    }
    
    // Set axis based on plane and axis name
    // The axis origin is positioned at the edge of the profile for lathe-like behavior
    switch (axisName.toLowerCase()) {
        case 'x':
            axis = {
                origin: { x: 0, y: 0, z: 0 },
                direction: { x: 1, y: 0, z: 0 }
            };
            break;
        case 'y':
            // For Y-axis revolve on XY plane, put axis at left edge of profile
            axis = {
                origin: { x: profileMinX, y: 0, z: 0 },
                direction: { x: 0, y: 1, z: 0 }
            };
            break;
        case 'z':
            axis = {
                origin: { x: 0, y: 0, z: 0 },
                direction: { x: 0, y: 0, z: 1 }
            };
            break;
        default:
            axis = {
                origin: { x: profileMinX, y: 0, z: 0 },
                direction: { x: 0, y: 1, z: 0 }
            };
    }
    
    // Try kernel-based revolution for real B-Rep geometry
    if (isKernelReady()) {
        try {
            log('REVOLVING VIA KERNEL...', 'info');
            
            const result = await kernel.revolveSketchProfile(profile, axis, angle, plane);
            
            // Convert kernel mesh to Three.js
            const geometry = meshToThreeGeometry(result.mesh, THREE);
            
            const material = new THREE.MeshStandardMaterial({
                color: 0x808080,
                metalness: 0.4,
                roughness: 0.6
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
                name: name,
                id: generateId(),
                kernelId: result.id,
                bodyType: 'revolve',
                material: 'AL-6061-T6',
                created: Date.now(),
                isKernelGeometry: true,
                sourceProfile: profile.type,
                sketchPlane: plane,
                revolveAngle: angle,
                revolveAxis: axisName
            };
            
            scene.add(mesh);
            System.objects.push(mesh);
            
            // Track in DocumentModel
            if (System.americad?.document) {
                System.americad.document.trackExternalFeature({
                    id: mesh.userData.id,
                    kernelId: result.id,
                    type: 'revolve',
                    name: name,
                    mesh: mesh
                });
            }
            
            selectObject(mesh);
            log(`REVOLVED: ${profile.type.toUpperCase()} ${angle}° (B-REP)`, 'success');
            return mesh;
            
        } catch (error) {
            console.warn('[Ameri-CAD] Kernel revolve failed:', error);
            log('KERNEL REVOLVE FAILED: ' + error.message, 'error');
        }
    } else {
        log('REVOLVE REQUIRES KERNEL - NOT AVAILABLE', 'error');
    }
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
            openDocument();
            break;
        case 'save':
            saveDocument();
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
        case 'measure':
            // Toggle measure mode via the command system
            executeCommand('measure');
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
    
    // Handle sketch mode clicks
    if (System.inSketchMode && e.button === 0) {
        const worldPoint = getSketchPlaneIntersection(System.mouse);
        if (worldPoint) {
            sketchManager.handleClick(worldPoint);
        }
        return;
    }
    
    if (e.button === 0 && System.tool === 'select') {
        const hit = performRaycast(System.mouse, camera, System.raycaster, System.objects);
        if (hit) {
            selectObject(hit);
        } else {
            deselectObject();
        }
    }
}

/**
 * Get intersection point with sketch plane
 */
function getSketchPlaneIntersection(mouse) {
    if (!System.activeSketch) return null;
    
    // Create a plane at the origin based on sketch plane
    const plane = new THREE.Plane();
    
    switch (System.sketchPlane) {
        case 'xy':
            plane.setFromNormalAndCoplanarPoint(
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(0, 0, 0)
            );
            break;
        case 'xz':
            plane.setFromNormalAndCoplanarPoint(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 0, 0)
            );
            break;
        case 'yz':
            plane.setFromNormalAndCoplanarPoint(
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(0, 0, 0)
            );
            break;
    }
    
    System.raycaster.setFromCamera(mouse, camera);
    const intersection = new THREE.Vector3();
    
    if (System.raycaster.ray.intersectPlane(plane, intersection)) {
        return intersection;
    }
    
    return null;
}

function onMouseMove(e) {
    if (!System.ready) return;
    
    System.mouse = updateMouseCoords(e, DOM.canvas);
    
    // Handle sketch mode mouse move (for preview)
    if (System.inSketchMode) {
        const worldPoint = getSketchPlaneIntersection(System.mouse);
        if (worldPoint) {
            sketchManager.handleMove(worldPoint);
            updateCursorDisplay(worldPoint);
        }
        return;
    }
    
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
                saveDocument();
                return;
            case 'o':
                e.preventDefault();
                openDocument();
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
            case 'a':
                setTool('arc');
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
                if (System.inSketchMode) {
                    // Cancel current sketch operation or exit sketch mode
                    if (sketchManager.tempPoints.length > 0) {
                        sketchManager.cancel();
                        log('SKETCH OPERATION CANCELLED', 'info');
                    } else {
                        exitSketchMode();
                    }
                } else {
                    deselectObject();
                    closeModals();
                }
                break;
            case 'enter':
                if (System.inSketchMode) {
                    sketchManager.finish();
                }
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
    
    // Sketch commands
    if (action === 'sketch') {
        const plane = args[0] || 'xy';
        enterSketchMode(plane);
        return;
    }
    
    if (['extrude', 'ext'].includes(action)) {
        const height = parseFloat(args[0]) || 20;
        await extrudeSketch(height);
        return;
    }
    
    if (['revolve', 'rev', 'spin', 'lathe'].includes(action)) {
        const angle = parseFloat(args[0]) || 360;
        const axis = args[1] || 'y';
        await revolveSketch(angle, axis);
        return;
    }
    
    if (action === 'exit' || action === 'finish') {
        if (System.inSketchMode) {
            exitSketchMode();
            return;
        }
    }
    
    // Dimension/length constraint commands
    if (['dimension', 'dim', 'distance', 'd', 'length', 'len'].includes(action)) {
        if (!System.inSketchMode) {
            log('ERROR: Enter sketch mode first', 'error');
            return;
        }
        
        const value = parseFloat(args[0]);
        if (!value || value <= 0) {
            log('ERROR: Provide a positive dimension value', 'error');
            return;
        }
        
        const result = await applyDimensionConstraint(value);
        if (result.success) {
            log(`DIMENSION: ${value} applied (${result.count} constraint${result.count > 1 ? 's' : ''})`, 'success');
        } else {
            log(`ERROR: ${result.error}`, 'error');
        }
        return;
    }
    
    // Radius constraint command
    if (['radius', 'rad'].includes(action)) {
        if (!System.inSketchMode) {
            log('ERROR: Enter sketch mode first', 'error');
            return;
        }
        
        const value = parseFloat(args[0]);
        if (!value || value <= 0) {
            log('ERROR: Provide a positive radius value', 'error');
            return;
        }
        
        const result = await applyRadiusConstraint(value);
        if (result.success) {
            log(`RADIUS: ${value} applied`, 'success');
        } else {
            log(`ERROR: ${result.error}`, 'error');
        }
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
        case 'save':
            saveDocument();
            break;
        case 'open':
        case 'load':
            openDocument();
            break;
        case 'info':
            if (System.americad) {
                const info = System.americad.getDocumentInfo();
                log(`DOC: ${info.name} | FEATURES: ${info.featureCount}`, 'info');
            } else {
                log(`OBJECTS: ${System.objects.length}`, 'info');
            }
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
║ FILE OPERATIONS:                                          ║
║   save                 Save document (Ctrl+S)             ║
║   open / load          Open document (Ctrl+O)             ║
║   info                 Show document info                 ║
╠═══════════════════════════════════════════════════════════╣
║ SKETCH MODE:                                              ║
║   sketch [plane]       Enter sketch (xy/xz/yz)            ║
║   exit / finish        Exit sketch mode                   ║
║   extrude [height]     Extrude sketch profile             ║
║                                                           ║
║ SKETCH TOOLS (in sketch mode):                            ║
║   L         Line tool - click two points                  ║
║   R         Rectangle tool - click two corners            ║
║   O         Circle tool - click center + radius           ║
║   A         Arc tool - click three points                 ║
║                                                           ║
║ SKETCH CONSTRAINTS (in sketch mode):                      ║
║   dim [value]          Set line length or circle radius   ║
║   dimension [value]    Same as dim                        ║
║   length [value]       Set line length (dim alias)        ║
║   radius [value]       Set circle radius                  ║
║   h                    Make line horizontal               ║
║   v                    Make line vertical                 ║
║                                                           ║
║ WORKFLOW: sketch → draw → dim 100 → exit → extrude 20    ║
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
║   Ctrl+S    Save document (.americad)                     ║
║   Ctrl+O    Open document                                 ║
║   C         Enter sketch mode                             ║
║   L/R/O/A   Sketch tools (Line/Rect/Circle/Arc)           ║
║   Esc       Cancel / Exit sketch                          ║
║   Enter     Finish current operation                      ║
║   \`         Focus command line                           ║
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
// EXPORT / SAVE / LOAD
// ========================================

/**
 * Save the current document to a .americad file
 */
function saveDocument() {
    if (System.americad) {
        try {
            // Get document name from UI
            const titleEl = document.querySelector('.doc-title span[contenteditable]');
            let docName = titleEl?.textContent?.replace('.AD', '') || 'design';
            
            System.americad.saveDocument(docName);
            log(`SAVED: ${docName}.americad`, 'success');
            
            // Update modified indicator
            const badge = document.querySelector('.doc-title .badge');
            if (badge) badge.style.display = 'none';
        } catch (error) {
            console.error('[Ameri-CAD] Save failed:', error);
            log(`SAVE FAILED: ${error.message}`, 'error');
        }
    } else if (System.objects.length > 0) {
        // Fallback: export as JSON scene snapshot
        saveSceneSnapshot();
    } else {
        log('NOTHING TO SAVE', 'warn');
    }
}

/**
 * Open a document from a .americad file
 */
async function openDocument() {
    if (System.americad) {
        try {
            log('OPENING FILE...', 'info');
            const success = await System.americad.openDocument();
            
            if (success) {
                const info = System.americad.getDocumentInfo();
                log(`LOADED: ${info.name} (${info.featureCount} features)`, 'success');
                
                // Sync loaded features with System.objects
                syncObjectsFromDocument();
                
                // Update UI
                const titleEl = document.querySelector('.doc-title span[contenteditable]');
                if (titleEl) titleEl.textContent = info.name + '.AD';
                
                // Hide modified indicator
                const badge = document.querySelector('.doc-title .badge');
                if (badge) badge.style.display = 'none';
            }
        } catch (error) {
            console.error('[Ameri-CAD] Open failed:', error);
            log(`OPEN FAILED: ${error.message}`, 'error');
        }
    } else {
        log('DOCUMENT MODEL NOT READY', 'error');
    }
}

/**
 * Sync System.objects with the document model after loading
 */
function syncObjectsFromDocument() {
    if (!System.americad?.evaluator) return;
    
    // Clear current objects array
    System.objects = [];
    
    // Collect all meshes from the evaluator
    const evaluator = System.americad.evaluator;
    for (const [featureId, mesh] of evaluator.meshes) {
        if (mesh) {
            System.objects.push(mesh);
        }
    }
    
    console.log(`[Ameri-CAD] Synced ${System.objects.length} objects from document`);
}

/**
 * Fallback: Save scene as JSON snapshot (when DocumentModel not available)
 */
function saveSceneSnapshot() {
    const snapshot = {
        version: '1.0',
        name: 'Scene Snapshot',
        created: new Date().toISOString(),
        objects: System.objects.map(obj => ({
            name: obj.userData.name,
            type: obj.userData.bodyType || 'unknown',
            position: obj.position.toArray(),
            rotation: obj.rotation.toArray(),
            scale: obj.scale.toArray()
        }))
    };
    
    const json = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene-snapshot.json';
    a.click();
    URL.revokeObjectURL(url);
    
    log('SAVED: scene-snapshot.json (fallback)', 'success');
}

async function exportScene() {
    // Try STEP export first (B-Rep, best for CAD interoperability)
    if (isKernelReady()) {
        try {
            log('EXPORT: STEP FORMAT (ISO 10303-21, AP214)', 'info');
            const result = await kernel.exportSTEPAll();
            
            const blob = new Blob([result.content], { type: 'application/step' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'export.step';
            a.click();
            URL.revokeObjectURL(url);
            
            log(`EXPORTED: export.step (${result.count} shape${result.count > 1 ? 's' : ''})`, 'success');
            return;
        } catch (error) {
            console.warn('[Ameri-CAD] STEP export failed, falling back to STL:', error);
            log('STEP EXPORT FAILED - USING STL FALLBACK', 'warn');
        }
    }
    
    // Fallback to STL export (tessellated mesh)
    log('EXPORT: STL FORMAT (FALLBACK)', 'info');
    
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
    sketchManager,
    sketchRenderer,
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
    saveDocument,
    openDocument,
    enterSketchMode,
    exitSketchMode,
    extrudeSketch,
    revolveSketch,
    applyDimensionConstraint,
    applyRadiusConstraint,
    updateSketchView,
    log,
    // Unified architecture access
    get app() { return System.americad; },
    get document() { return System.americad?.document; },
    get evaluator() { return System.americad?.evaluator; },
    get featureTree() { return featureTreeUI; },
    get propertyPanel() { return propertyPanel; },
    kernel
};
