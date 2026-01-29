/**
 * Ameri-CAD App Integration
 * 
 * Wires together:
 * - Kernel Bridge (OpenCASCADE)
 * - Command System
 * - Command Line UI
 * - Document State
 */

import { kernel, meshToThreeGeometry } from '../kernel/bridge.js';
import { execute, registerCommand, on as onCommand, listCommands, autocomplete } from './commands.js';
import { registerPrimitiveCommands } from '../commands/primitives.js';
import { registerBooleanCommands } from '../commands/booleans.js';
import { registerGeneralCommands } from '../commands/general.js';
import { registerExportCommands } from '../commands/export.js';
import { registerSweepCommands } from '../commands/sweep.js';
import { registerTransformCommands } from '../commands/transforms.js';
import { registerSketchCommands } from '../commands/sketch.js';
import { registerMeasureCommands } from '../commands/measure.js';

// Application context - shared state between commands
const appContext = {
    kernel: null,
    document: null,
    selection: [],
    history: null,
    view: null,
    camera: null,
    scene: null,
    THREE: null,
    measureTool: null,
    
    // Sweep state tracking
    _lastProfile: null,
    _lastPath: null,
    
    // Callbacks for app integration
    onBodyCreated: null,
    onBodyDeleted: null,
    onSelectionChanged: null,
    log: console.log,
    
    // Sweep helpers
    setLastProfile(id) {
        appContext._lastProfile = id;
    },
    getLastProfile() {
        return appContext._lastProfile;
    },
    setLastPath(id) {
        appContext._lastPath = id;
    },
    getLastPath() {
        return appContext._lastPath;
    }
};

/**
 * Simple document state manager
 */
class Document {
    constructor() {
        this.bodies = new Map();
        this.nextBodyNum = 1;
    }
    
    addBody(id, data) {
        const name = data.name || `BODY_${String(this.nextBodyNum++).padStart(3, '0')}`;
        const body = { id, name, ...data };
        this.bodies.set(id, body);
        return body;
    }
    
    getBody(id) {
        return this.bodies.get(id);
    }
    
    removeBody(id) {
        this.bodies.delete(id);
    }
    
    getAllBodies() {
        return Array.from(this.bodies.values());
    }
    
    getBodiesByType(type) {
        return this.getAllBodies().filter(b => b.type === type);
    }
    
    clear() {
        this.bodies.clear();
        this.nextBodyNum = 1;
    }
}

/**
 * Initialize the complete Ameri-CAD system
 */
export async function initializeSystem(options = {}) {
    const {
        THREE,
        scene,
        camera,
        onBodyCreated,
        onBodyDeleted,
        onSelectionChanged,
        log = console.log
    } = options;
    
    // Store references
    appContext.THREE = THREE;
    appContext.scene = scene;
    appContext.camera = camera;
    appContext.onBodyCreated = onBodyCreated;
    appContext.onBodyDeleted = onBodyDeleted;
    appContext.onSelectionChanged = onSelectionChanged;
    appContext.log = log;
    appContext.document = new Document();
    
    // Initialize kernel (async - runs in background)
    log('INIT KERNEL...', 'info');
    try {
        appContext.kernel = kernel;
        await kernel.init();
        log('KERNEL READY (OCCT)', 'success');
    } catch (error) {
        log(`KERNEL FAILED: ${error.message}`, 'error');
        console.error('[Ameri-CAD] Kernel init error:', error);
        // Continue without kernel - use fallback Three.js geometry
    }
    
    // Register all commands
    registerAllCommands();
    
    // Set up command event listeners
    onCommand('execute', (event) => {
        log(`CMD: ${event.command.name}`, 'info');
    });
    
    onCommand('error', (event) => {
        log(`CMD ERROR: ${event.error.message}`, 'error');
    });
    
    return {
        kernel,
        document: appContext.document,
        executeCommand,
        context: appContext
    };
}

/**
 * Register all command modules
 */
function registerAllCommands() {
    // Create a wrapped kernel for commands that returns mesh data compatible with app
    const wrappedKernel = createWrappedKernel();
    
    // Register command modules
    registerPrimitiveCommands(wrappedKernel);
    registerBooleanCommands(wrappedKernel);
    registerGeneralCommands(appContext);
    registerExportCommands(appContext);
    registerSweepCommands(wrappedKernel);
    registerTransformCommands(wrappedKernel);
    registerSketchCommands(appContext);
    registerMeasureCommands(appContext);
    
    // Register custom app commands
    registerAppCommands();
}

/**
 * Create wrapped kernel that integrates with Three.js scene
 */
function createWrappedKernel() {
    return {
        async createBox(width, height, depth, center) {
            if (!appContext.kernel?.isReady()) {
                throw new Error('Kernel not ready');
            }
            const result = await appContext.kernel.createBox(width, height, depth, center);
            return addMeshToScene(result, 'box', { width, height, depth, center });
        },
        
        async createCylinder(radius, height, center) {
            if (!appContext.kernel?.isReady()) {
                throw new Error('Kernel not ready');
            }
            const result = await appContext.kernel.createCylinder(radius, height, center);
            return addMeshToScene(result, 'cylinder', { radius, height, center });
        },
        
        async createSphere(radius, center) {
            if (!appContext.kernel?.isReady()) {
                throw new Error('Kernel not ready');
            }
            const result = await appContext.kernel.createSphere(radius, center);
            return addMeshToScene(result, 'sphere', { radius, center });
        },
        
        async createCone(radius1, radius2, height, center) {
            if (!appContext.kernel?.isReady()) {
                throw new Error('Kernel not ready');
            }
            const result = await appContext.kernel.createCone(radius1, radius2, height, center);
            return addMeshToScene(result, 'cone', { radius1, radius2, height, center });
        },
        
        // Sweep-related methods
        async createLineWire(start, end) {
            if (!appContext.kernel?.isReady()) {
                throw new Error('Kernel not ready');
            }
            return await appContext.kernel.createLineWire(start, end);
        },
        
        async createArcWire(start, mid, end) {
            if (!appContext.kernel?.isReady()) {
                throw new Error('Kernel not ready');
            }
            return await appContext.kernel.createArcWire(start, mid, end);
        },
        
        async createHelixWire(radius, pitch, height, center) {
            if (!appContext.kernel?.isReady()) {
                throw new Error('Kernel not ready');
            }
            return await appContext.kernel.createHelixWire(radius, pitch, height, center);
        },
        
        async createCircleWire(center, radius, normal) {
            if (!appContext.kernel?.isReady()) {
                throw new Error('Kernel not ready');
            }
            return await appContext.kernel.createCircleWire(center, radius, normal);
        },
        
        async createWireFromPolygon(points) {
            if (!appContext.kernel?.isReady()) {
                throw new Error('Kernel not ready');
            }
            return await appContext.kernel.createWireFromPolygon(points);
        },
        
        async createFaceFromWire(wireId, planar) {
            if (!appContext.kernel?.isReady()) {
                throw new Error('Kernel not ready');
            }
            return await appContext.kernel.createFaceFromWire(wireId, planar);
        },
        
        async sweep(profileId, pathId) {
            if (!appContext.kernel?.isReady()) {
                throw new Error('Kernel not ready');
            }
            const result = await appContext.kernel.sweep(profileId, pathId);
            return addMeshToScene(result, 'sweep', { profileId, pathId });
        }
    };
}

/**
 * Convert kernel mesh to Three.js and add to scene
 */
function addMeshToScene(kernelResult, type, params) {
    const THREE = appContext.THREE;
    if (!THREE || !appContext.scene) {
        throw new Error('Three.js not initialized');
    }
    
    // Convert kernel mesh data to Three.js geometry
    const geometry = meshToThreeGeometry(kernelResult.mesh, THREE);
    
    // Create material
    const material = new THREE.MeshStandardMaterial({
        color: 0x808080,
        metalness: 0.4,
        roughness: 0.6
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Add edges for CAD look
    const edges = new THREE.EdgesGeometry(geometry, 15);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    mesh.add(new THREE.LineSegments(edges, edgeMat));
    
    // Store metadata
    const body = appContext.document.addBody(kernelResult.id, {
        type,
        params,
        mesh: kernelResult.mesh
    });
    
    mesh.userData = {
        type: 'body',
        name: body.name,
        id: kernelResult.id,
        kernelId: kernelResult.id,
        bodyType: type,
        params
    };
    
    // Add to scene
    appContext.scene.add(mesh);
    
    // Notify app
    if (appContext.onBodyCreated) {
        appContext.onBodyCreated(mesh, body);
    }
    
    appContext.log(`CREATED: ${body.name} (${type})`, 'success');
    
    return {
        id: kernelResult.id,
        mesh: mesh,
        body: body
    };
}

/**
 * Register app-specific commands
 */
function registerAppCommands() {
    // FIT - zoom to fit all
    registerCommand('fit', {
        aliases: ['zoomfit', 'zf'],
        description: 'Zoom to fit all objects',
        category: 'view',
        execute() {
            if (appContext.view?.fitAll) {
                appContext.view.fitAll();
            }
            return 'Zoomed to fit';
        }
    });
    
    // GRID - toggle grid
    registerCommand('grid', {
        description: 'Toggle grid visibility',
        category: 'view',
        execute(_params, _context) {
            // This will be handled by the app
            return 'GRID TOGGLED';
        }
    });
    
    // SNAP - toggle snap
    registerCommand('snap', {
        description: 'Toggle snap',
        category: 'view',
        execute() {
            return 'SNAP TOGGLED';
        }
    });
}

/**
 * Execute a command string
 */
export async function executeCommand(input, extraContext = {}) {
    const context = {
        ...appContext,
        ...extraContext
    };
    
    try {
        const result = await execute(input, context);
        return { success: true, result };
    } catch (error) {
        appContext.log(`ERROR: ${error.message}`, 'error');
        if (error.suggestion) {
            appContext.log(error.suggestion, 'info');
        }
        return { success: false, error };
    }
}

/**
 * Get command suggestions for autocomplete
 */
export function getCommandSuggestions(partial) {
    return autocomplete(partial);
}

/**
 * List all available commands
 */
export function getAllCommands() {
    return listCommands();
}

/**
 * Check if kernel is ready
 */
export function isKernelReady() {
    return appContext.kernel?.isReady() ?? false;
}

/**
 * Get the application context
 */
export function getContext() {
    return appContext;
}

export default {
    initializeSystem,
    executeCommand,
    getCommandSuggestions,
    getAllCommands,
    isKernelReady,
    getContext
};
